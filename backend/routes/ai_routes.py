from io import BytesIO
from flask import Blueprint, request, jsonify, send_file
from database import get_db, is_mysql
from ai_engine import (
    generate_summary,
    extract_keywords,
    generate_questions,
    detect_concept_gap,
    generate_voice_explanation
)

ai_bp = Blueprint('ai', __name__, url_prefix='/ai')


@ai_bp.route('/generate-summary', methods=['POST'])
def api_generate_summary():
    data = request.json
    note_id = data.get('note_id')

    db = get_db()
    cursor = db.cursor()
    placeholder = '%s' if is_mysql() else '?'
    cursor.execute(f'SELECT note_text FROM notes WHERE id = {placeholder}', (note_id,))
    note = cursor.fetchone()
    db.close()

    if note:
        summary = generate_summary(note[0])
        return jsonify({'summary': summary})

    return jsonify({'message': 'Note not found'}), 404


@ai_bp.route('/extract-keywords', methods=['POST'])
def api_extract_keywords():
    data = request.json
    note_id = data.get('note_id')

    db = get_db()
    cursor = db.cursor()
    placeholder = '%s' if is_mysql() else '?'
    cursor.execute(f'SELECT note_text FROM notes WHERE id = {placeholder}', (note_id,))
    note = cursor.fetchone()
    db.close()

    if note:
        keywords = extract_keywords(note[0])
        return jsonify({'keywords': keywords})

    return jsonify({'message': 'Note not found'}), 404


@ai_bp.route('/generate-questions', methods=['POST'])
def api_generate_questions():
    data = request.json
    note_id = data.get('note_id')

    db = get_db()
    cursor = db.cursor()
    placeholder = '%s' if is_mysql() else '?'
    cursor.execute(f'SELECT note_text FROM notes WHERE id = {placeholder}', (note_id,))
    note = cursor.fetchone()

    if note:
        questions = generate_questions(note[0])

        for q in questions:
            cursor.execute(
                f'INSERT INTO questions (note_id, question) VALUES ({placeholder}, {placeholder})',
                (note_id, q)
            )

        db.commit()
        db.close()

        return jsonify({'questions': questions})

    db.close()
    return jsonify({'message': 'Note not found'}), 404


@ai_bp.route('/submit-answer', methods=['POST'])
def api_submit_answer():
    data = request.json
    question_id = data.get('question_id')
    user_answer = data.get('user_answer')

    db = get_db()
    cursor = db.cursor()
    placeholder = '%s' if is_mysql() else '?'
    cursor.execute(f'SELECT question FROM questions WHERE id = {placeholder}', (question_id,))
    q = cursor.fetchone()

    if q:
        expected = q[0]
        gap = detect_concept_gap(user_answer, expected)
        score = gap['score']

        cursor.execute(
            f'INSERT INTO answers (question_id, user_answer, score) VALUES ({placeholder}, {placeholder}, {placeholder})',
            (question_id, user_answer, score)
        )

        db.commit()
        db.close()

        return jsonify({'score': score, 'gap': gap})

    db.close()
    return jsonify({'message': 'Question not found'}), 404


@ai_bp.route('/detect-concept-gap', methods=['POST'])
def api_detect_concept_gap():
    data = request.json
    gap = detect_concept_gap(
        data.get('student_answer'),
        data.get('expected_answer')
    )
    return jsonify(gap)


@ai_bp.route('/voice-explanation', methods=['POST'])
def api_voice_explanation():
    data = request.json
    summary = data.get('summary') or data.get('concept')
    explanation = generate_voice_explanation(summary)
    return jsonify({'explanation': explanation})


@ai_bp.route('/voice-audio', methods=['POST'])
def api_voice_audio():
    data = request.get_json(silent=True) or {}
    text = (data.get('text') or '').strip()
    if not text:
        return jsonify({'message': 'Text is required'}), 400

    try:
        from gtts import gTTS

        audio = BytesIO()
        gTTS(text=text, lang=data.get('lang', 'en')).write_to_fp(audio)
        audio.seek(0)
        return send_file(audio, mimetype='audio/mpeg', download_name='study-explanation.mp3')
    except ImportError:
        return jsonify({'message': 'gTTS is not installed'}), 503
    except Exception:
        return jsonify({'message': 'Text-to-speech service is unavailable'}), 502
