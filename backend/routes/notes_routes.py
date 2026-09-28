from flask import Blueprint, request, jsonify
import os
import uuid
from pathlib import Path
from PyPDF2 import PdfReader
from database import get_db, is_mysql

notes_bp = Blueprint('notes', __name__, url_prefix='/notes')

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_FOLDER = BASE_DIR / 'uploads'
ALLOWED_EXTENSIONS = {'txt', 'pdf'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def extract_text_from_file(filepath):
    try:
        if filepath.endswith('.txt'):
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        elif filepath.endswith('.pdf'):
            reader = PdfReader(filepath)
            text = ''
            for page in reader.pages:
                text += page.extract_text() or ''
            return text
    except Exception as e:
        print(f"Error extracting text: {e}")
    return ''


@notes_bp.route('/upload-notes', methods=['POST'])
def upload_notes():
    try:
        if 'file' not in request.files:
            return jsonify({'message': 'No file part'}), 400

        file = request.files['file']
        user_id = request.form.get('user_id')

        if not user_id:
            return jsonify({'message': 'user_id is required'}), 400

        if file.filename == '':
            return jsonify({'message': 'No selected file'}), 400

        if file and allowed_file(file.filename):
            ext = file.filename.rsplit('.', 1)[1].lower()
            unique_filename = f"{user_id}-{uuid.uuid4()}.{ext}"
            filepath = UPLOAD_FOLDER / unique_filename
            file.save(filepath)

            text = extract_text_from_file(str(filepath))

            if not text.strip():
                return jsonify({'message': 'Could not extract text from file'}), 400

            try:
                db = get_db()
                cursor = db.cursor()
                placeholder = '%s' if is_mysql() else '?'
                cursor.execute(
                    f'INSERT INTO notes (user_id, note_text) VALUES ({placeholder}, {placeholder})',
                    (user_id, text)
                )
                note_id = cursor.lastrowid
                db.commit()
                db.close()

                return jsonify({'message': 'Notes uploaded successfully', 'note_id': note_id}), 200
            except Exception as db_err:
                print(f"Database error: {db_err}")
                return jsonify({'message': f'Database error: {str(db_err)}'}), 500

        return jsonify({'message': 'Invalid file type. Only PDF and TXT allowed.'}), 400

    except Exception as e:
        print(f"Upload error: {e}")
        return jsonify({'message': f'Server error: {str(e)}'}), 500