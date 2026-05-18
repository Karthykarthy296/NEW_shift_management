import os
import shutil
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Setup logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(os.path.dirname(__file__), 'migration.log'), encoding='utf-8')
    ]
)
logger = logging.getLogger("DB_Migration")

# Import models and default engines
from database import (
    Base, User, Department, Employee, Shift, Schedule, Leave,
    WeeklyOffSwap, OvertimeLog, WeeklyShiftChange, ScheduleGenerationLog
)

# 1. Define Paths & Configuration
SQLITE_DB = os.path.join(os.path.dirname(__file__), "shift_db_new.db")
SQLITE_BAK = os.path.join(os.path.dirname(__file__), "shift_db_new.db.bak")

MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "rootpassword")
MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = os.getenv("MYSQL_PORT", "3306")
MYSQL_DB = os.getenv("MYSQL_DB", "shift_db_new")

MYSQL_SERVER_URL = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}"
MYSQL_DB_URL = f"{MYSQL_SERVER_URL}/{MYSQL_DB}?charset=utf8mb4"

def make_sqlite_backup():
    """Create a backup of the SQLite database before migration."""
    logger.info("Step 1: Backing up SQLite database...")
    if not os.path.exists(SQLITE_DB):
        logger.error(f"SQLite database file not found at {SQLITE_DB}!")
        return False
    try:
        shutil.copy2(SQLITE_DB, SQLITE_BAK)
        logger.info(f"✓ Backup successfully created at: {SQLITE_BAK}")
        return True
    except Exception as e:
        logger.error(f"Failed to create SQLite backup: {str(e)}")
        return False

def ensure_mysql_database():
    """Ensure the target MySQL database exists."""
    logger.info("Step 2: Connecting to MySQL server and ensuring database exists...")
    try:
        # Connect to MySQL server without database specified
        server_engine = create_engine(MYSQL_SERVER_URL)
        with server_engine.connect() as conn:
            # Check if DB exists or create it
            conn.execute(text(f"CREATE DATABASE IF NOT EXISTS {MYSQL_DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
            conn.commit()
        logger.info(f"✓ Target MySQL Database '{MYSQL_DB}' is ready.")
        return True
    except Exception as e:
        logger.error(f"Could not connect or create database in MySQL server: {str(e)}")
        logger.error("Please verify that:")
        logger.error(f" 1. MySQL Server is running on {MYSQL_HOST}:{MYSQL_PORT}")
        logger.error(f" 2. The credentials (User: {MYSQL_USER}) are correct")
        logger.error(" 3. The current user has permissions to create databases")
        return False

def get_record_counts(session):
    """Utility to count records in all tables for comparison."""
    counts = {}
    models = [
        ("users", User),
        ("departments", Department),
        ("shifts", Shift),
        ("employees", Employee),
        ("leaves", Leave),
        ("schedules", Schedule),
        ("weekly_off_swaps", WeeklyOffSwap),
        ("overtime_logs", OvertimeLog),
        ("weekly_shift_changes", WeeklyShiftChange),
        ("schedule_generation_logs", ScheduleGenerationLog)
    ]
    for name, model in models:
        try:
            counts[name] = session.query(model).count()
        except Exception as e:
            counts[name] = 0
            logger.debug(f"Could not count {name}: {e}")
    return counts

def migrate_table_data(sqlite_session, mysql_session, model_class, table_name):
    """Safely migrate all rows for a given SQLAlchemy model class."""
    logger.info(f"Migrating data for table '{table_name}'...")
    try:
        # Fetch all records from SQLite
        records = sqlite_session.query(model_class).all()
        total_records = len(records)
        
        if total_records == 0:
            logger.info(f" - Table '{table_name}' has 0 records. Skipping transfer.")
            return True

        logger.info(f" - Found {total_records} records in SQLite '{table_name}'. Copying to MySQL...")
        
        # Disable identity/foreign key safety for fast bulk copy if supported,
        # but to be safe and ORM compatible, we just map them row-by-row
        # and flush in batches of 500.
        batch_size = 500
        for i in range(0, total_records, batch_size):
            batch = records[i:i+batch_size]
            for record in batch:
                # Expel the record from the SQLite session so we can attach it to MySQL session
                sqlite_session.expunge(record)
                # Merge or add to MySQL session
                mysql_session.merge(record)
            mysql_session.commit()
            logger.info(f"   * Migrated records {i+1} to {min(i+batch_size, total_records)}...")
            
        logger.info(f"✓ Table '{table_name}' successfully migrated.")
        return True
    except Exception as e:
        logger.error(f"❌ Error migrating table '{table_name}': {str(e)}")
        mysql_session.rollback()
        return False

def run_migration():
    """Main function to run the full migration pipeline."""
    logger.info("==============================================")
    logger.info("   SQLITE TO MYSQL SAFE MIGRATION PIPELINE")
    logger.info("==============================================")

    # 1. Make Backup of SQLite
    if not make_sqlite_backup():
        logger.error("Migration halted: Backup could not be created safely.")
        return False

    # 2. Ensure target MySQL database exists
    if not ensure_mysql_database():
        logger.error("Migration halted: MySQL database is not accessible.")
        return False

    # 3. Create Engines and Sessions
    logger.info("Step 3: Creating SQLite and MySQL connections...")
    sqlite_engine = create_engine(f"sqlite:///{SQLITE_DB}")
    mysql_engine = create_engine(MYSQL_DB_URL)

    SqliteSession = sessionmaker(bind=sqlite_engine)
    MysqlSession = sessionmaker(bind=mysql_engine)

    sqlite_sess = SqliteSession()
    mysql_sess = MysqlSession()

    try:
        # 4. Create Tables in MySQL
        logger.info("Step 4: Creating schema tables in MySQL...")
        # This will create tables if they do not exist, matching current models
        Base.metadata.create_all(bind=mysql_engine)
        logger.info("✓ MySQL tables created successfully.")

        # 5. Fetch SQLite record counts
        logger.info("Step 5: Fetching existing SQLite record counts...")
        sqlite_counts = get_record_counts(sqlite_sess)
        for name, count in sqlite_counts.items():
            logger.info(f" - SQLite '{name}': {count} records")

        # 6. Check if MySQL is already populated
        logger.info("Step 6: Checking existing MySQL record counts...")
        mysql_counts = get_record_counts(mysql_sess)
        mysql_populated = any(c > 0 for c in mysql_counts.values())
        if mysql_populated:
            logger.warning("Target MySQL database already contains some records!")
            logger.warning("To avoid duplicating data or violating primary key constraints,")
            logger.warning("please ensure your MySQL database is empty before running this migration.")
            logger.warning("Current MySQL counts:")
            for name, count in mysql_counts.items():
                logger.warning(f" - MySQL '{name}': {count} records")
            
            # Prompt or raise error to prevent accidental overwrite
            confirm = input("Do you want to continue and try merging data? (y/n): ") if not os.getenv("NON_INTERACTIVE") else "n"
            if confirm.lower() != 'y':
                logger.error("Migration aborted by user due to existing MySQL data.")
                return False

        # 7. Migrate tables in safe topological/foreign key order
        logger.info("Step 7: Starting data transfer...")
        
        migration_order = [
            (User, "users"),
            (Department, "departments"),
            (Shift, "shifts"),
            (Employee, "employees"),
            (Leave, "leaves"),
            (Schedule, "schedules"),
            (WeeklyOffSwap, "weekly_off_swaps"),
            (OvertimeLog, "overtime_logs"),
            (WeeklyShiftChange, "weekly_shift_changes"),
            (ScheduleGenerationLog, "schedule_generation_logs")
        ]

        success = True
        for model_class, table_name in migration_order:
            if not migrate_table_data(sqlite_sess, mysql_sess, model_class, table_name):
                success = False
                logger.error(f"❌ Migration failed at table '{table_name}'. Rollback triggered.")
                break

        if not success:
            logger.error("Migration encountered errors! Database state might be inconsistent.")
            return False

        # 8. Post-migration validation (Compare Counts)
        logger.info("Step 8: Validating record counts post-migration...")
        mysql_final_counts = get_record_counts(mysql_sess)
        
        validation_failed = False
        logger.info("================ MIGRATION REPORT ================")
        logger.info(f"{'Table Name':<30} | {'SQLite Count':<15} | {'MySQL Count':<15} | {'Status':<10}")
        logger.info("-" * 80)
        
        for table_name in sqlite_counts.keys():
            sq_count = sqlite_counts[table_name]
            my_count = mysql_final_counts.get(table_name, 0)
            status = "MATCH" if sq_count == my_count else "MISMATCH ❌"
            
            if sq_count != my_count:
                validation_failed = True
                
            logger.info(f"{table_name:<30} | {sq_count:<15} | {my_count:<15} | {status:<10}")
        logger.info("==================================================")

        if validation_failed:
            logger.error("❌ Validation Failed: Some record counts do not match between SQLite and MySQL.")
            logger.error("Please examine the migration logs above to resolve the mismatch.")
            return False
        else:
            logger.info("🎉 SUCCESS: All database tables migrated and validated perfectly!")
            logger.info("Now you can configure your backend to use MySQL by setting:")
            logger.info("  DATABASE_TYPE = mysql")
            logger.info("  MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST, MYSQL_PORT, MYSQL_DB environment variables.")
            return True

    except Exception as e:
        logger.critical(f"Unhandled critical error during migration: {str(e)}", exc_info=True)
        return False
    finally:
        sqlite_sess.close()
        mysql_sess.close()

if __name__ == "__main__":
    # If environment variables are not set, you can print them
    logger.info(f"Target MySQL host: {MYSQL_HOST}:{MYSQL_PORT}")
    logger.info(f"Target MySQL database name: {MYSQL_DB}")
    logger.info(f"Target MySQL user: {MYSQL_USER}")
    
    # We run the migration
    run_migration()
