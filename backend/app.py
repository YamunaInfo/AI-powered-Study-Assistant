import os
from pathlib import Path
from flask import Flask, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from routes.auth_routes import auth_bp
from routes.notes_routes import notes_bp
from routes.ai_routes import ai_bp
from routes.profile_routes import profile_bp
import database

BASE_DIR = Path(__file__).resolve().parent
env_path = BASE_DIR / '.env'
if not env_path.exists():
    env_path = BASE_DIR.parent / '.env'
load_dotenv(env_path)
os.environ.setdefault('AI_PROVIDER', 'gemini')

FRONTEND_DIR = BASE_DIR.parent / "frontend"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-change-me")

CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=False)


@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/health")
def health_check():
    return {"status": "ok", "backend": "running"}, 200


@app.route("/health/db")
def health_check_db():
    try:
        db = database.get_db()
        db.execute("SELECT 1")
        db.close()
        return {"status": "ok", "database": "connected"}, 200
    except Exception as e:
        return {"status": "error", "database": str(e)}, 500


# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(notes_bp)
app.register_blueprint(ai_bp)
app.register_blueprint(profile_bp)

# Initialize database
database.create_tables()


if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=int(os.environ.get('PORT', 5001)))