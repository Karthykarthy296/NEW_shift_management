from flask import Flask
from app.models.models import db, User
from app.routes.routes import bp as api_bp
from flask_jwt_extended import JWTManager
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'supersecretkey')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-super-secret')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL', 
    f"mysql+pymysql://{os.environ.get('DB_USER', 'root')}:{os.environ.get('DB_PASSWORD', 'rootpassword')}@{os.environ.get('DB_HOST', 'localhost')}/{os.environ.get('DB_NAME', 'prod_weekoff_db')}"
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)
jwt = JWTManager(app)

app.register_blueprint(api_bp, url_prefix='/api')

def init_db():
    with app.app_context():
        db.create_all()

if __name__ == '__main__':
    # Start scheduler
    from app.services.scheduler import start_scheduler
    
    init_db()
    start_scheduler()
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
