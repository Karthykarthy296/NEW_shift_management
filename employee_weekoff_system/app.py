from flask import Flask, redirect, url_for
from models import db, AdminUser
from routes import bp as routes_bp
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'supersecretkey')
# Default to sqlite for local dev if mysql isn't ready
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL', 
    f"mysql+pymysql://{os.environ.get('DB_USER', 'root')}:{os.environ.get('DB_PASSWORD', 'rootpassword')}@{os.environ.get('DB_HOST', 'localhost')}/{os.environ.get('DB_NAME', 'weekoff_db')}"
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

app.register_blueprint(routes_bp)

def init_db():
    with app.app_context():
        try:
            db.create_all()
            if not AdminUser.query.filter_by(username='admin').first():
                admin = AdminUser(username='admin', email='admin@example.com')
                admin.set_password('admin123')
                db.session.add(admin)
                db.session.commit()
                print("Admin user created.")
        except Exception as e:
            print(f"Error initializing DB: {e}")

if __name__ == '__main__':
    # When running locally you might want to use SQLite just to quickly test
    if 'mysql' not in app.config['SQLALCHEMY_DATABASE_URI']:
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///weekoff.db'
    
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
