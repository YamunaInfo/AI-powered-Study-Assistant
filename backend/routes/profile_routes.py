from flask import Blueprint, request, jsonify
from database import get_db, is_mysql

profile_bp = Blueprint('profile', __name__, url_prefix='/profile')


@profile_bp.route('/', methods=['GET'])
def get_profile():
    user_id = request.args.get('user_id')

    db = get_db()
    cursor = db.cursor()
    placeholder = '%s' if is_mysql() else '?'
    cursor.execute(
        f'SELECT name, email, created_at FROM users WHERE id = {placeholder}',
        (user_id,)
    )
    user = cursor.fetchone()
    db.close()

    if user:
        return jsonify({
            'name': user[0],
            'email': user[1],
            'created_at': str(user[2])
        })

    return jsonify({'message': 'User not found'}), 404


@profile_bp.route('/progress', methods=['GET'])
def get_progress():
    user_id = request.args.get('user_id')

    db = get_db()
    cursor = db.cursor()
    placeholder = '%s' if is_mysql() else '?'

    cursor.execute(
        f'SELECT questions_attempted, concept_gaps_detected FROM progress WHERE user_id = {placeholder}',
        (user_id,)
    )
    progress = cursor.fetchone()

    if not progress:
        cursor.execute(
            f'INSERT INTO progress (user_id) VALUES ({placeholder})',
            (user_id,)
        )
        db.commit()
        progress = (0, 0)

    db.close()

    return jsonify({
        'questions_attempted': progress[0],
        'concept_gaps_detected': progress[1]
    })
