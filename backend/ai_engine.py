import os
import re
import logging
from collections import Counter
from functools import lru_cache

try:
    import requests
except ImportError:  # pragma: no cover
    requests = None

STOP_WORDS = {
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'had',
    'has', 'have', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'our', 'that',
    'the', 'their', 'this', 'to', 'was', 'were', 'will', 'with', 'you', 'your'
}

logger = logging.getLogger(__name__)


def _local_models_enabled():
    return os.getenv('ENABLE_LOCAL_MODELS', '').lower() in {'1', 'true', 'yes'}


@lru_cache(maxsize=1)
def _load_bart_summarizer():
    if not _local_models_enabled():
        return None

    try:
        from transformers import pipeline

        model_name = os.getenv('BART_MODEL', 'facebook/bart-large-cnn')
        return pipeline('summarization', model=model_name)
    except Exception as error:
        logger.warning('BART model could not be loaded: %s', error)
        return None


def _summarize_with_bart(text):
    if len(text.split()) < 80:
        return None

    try:
        summarizer = _load_bart_summarizer()
        if summarizer is None:
            return None
        words = text.split()
        chunks = [' '.join(words[index:index + 400]) for index in range(0, len(words), 400)]
        results = summarizer(
            chunks,
            max_length=140,
            min_length=20,
            do_sample=False,
            truncation=True
        )
        summaries = [result['summary_text'] for result in results]
        return '\n'.join(summaries).strip() or None
    except ImportError:
        return None
    except Exception as error:
        logger.warning('BART summarization unavailable: %s', error)
        return None


@lru_cache(maxsize=1)
def _load_minilm_model():
    if not _local_models_enabled():
        return None

    try:
        from sentence_transformers import SentenceTransformer

        model_name = os.getenv('MINILM_MODEL', 'sentence-transformers/all-MiniLM-L6-v2')
        return SentenceTransformer(model_name)
    except Exception as error:
        logger.warning('MiniLM model could not be loaded: %s', error)
        return None


def _semantic_similarity(first_text, second_text):
    try:
        model = _load_minilm_model()
        if model is None:
            return None
        embeddings = model.encode([first_text, second_text], normalize_embeddings=True)
        similarity = float(embeddings[0] @ embeddings[1])
        return round(max(0.0, min(similarity, 1.0)) * 100, 2)
    except Exception as error:
        logger.warning('MiniLM similarity unavailable: %s', error)
        return None


def _split_sentences(text):
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]


def _tokenize(text):
    try:
        from nltk.tokenize import wordpunct_tokenize

        return [
            word.lower()
            for word in wordpunct_tokenize(text)
            if re.fullmatch(r"[a-zA-Z']+", word)
        ]
    except ImportError:
        return re.findall(r"[a-zA-Z']+", text.lower())


def _call_ai(prompt):
    if requests is None:
        return None

    provider = os.getenv('AI_PROVIDER', 'gemini').lower()

    if provider == 'gemini':
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            return None
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={api_key}"
        payload = {
            'contents': [{'parts': [{'text': prompt}]}],
            'generationConfig': {'temperature': 0.4, 'maxOutputTokens': 400}
        }
        try:
            response = requests.post(url, json=payload, timeout=40)
            if response.ok:
                data = response.json()
                return data['candidates'][0]['content']['parts'][0]['text']
        except Exception:
            return None

    if provider == 'openai':
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            return None
        base_url = os.getenv('OPENAI_BASE_URL', 'https://api.openai.com/v1').rstrip('/')
        model = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
        try:
            response = requests.post(
                f'{base_url}/chat/completions',
                headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
                json={
                    'model': model,
                    'messages': [
                        {'role': 'system', 'content': 'You are a helpful study assistant.'},
                        {'role': 'user', 'content': prompt}
                    ],
                    'temperature': 0.4,
                    'max_tokens': 400
                },
                timeout=40
            )
            if response.ok:
                data = response.json()
                return data['choices'][0]['message']['content']
        except Exception:
            return None

    return None


def generate_summary(text):
    if not text or not text.strip():
        return 'No text provided.'

    bart_summary = _summarize_with_bart(text)
    if bart_summary:
        return bart_summary

    ai_prompt = (
        'Create a concise study summary from the following notes. '
        'Keep it clear, helpful, and easy to read.\n\n' + text
    )
    ai_result = _call_ai(ai_prompt)
    if ai_result and ai_result.strip():
        return ai_result.strip()

    text = ' '.join(text.split())
    sentences = _split_sentences(text)
    if len(sentences) <= 3:
        return text[:1000]

    words = [w for w in _tokenize(text) if w not in STOP_WORDS]
    word_freq = Counter(words)
    sentence_scores = {}
    for sent in sentences:
        sent_words = [w for w in _tokenize(sent) if w not in STOP_WORDS]
        score = sum(word_freq.get(w, 0) for w in sent_words)
        sentence_scores[sent] = score

    top_sentences = sorted(sentence_scores, key=sentence_scores.get, reverse=True)[:5]
    summary = '\n'.join(top_sentences)
    return summary if summary.strip() else text[:500]


def extract_keywords(text):
    if not text:
        return []

    ai_prompt = 'Extract 10 important study keywords from the following notes. Respond as a simple comma-separated list.\n\n' + text
    ai_result = _call_ai(ai_prompt)
    if ai_result and ai_result.strip():
        keywords = [k.strip() for k in ai_result.replace('\n', ',').split(',') if k.strip()]
        if keywords:
            return keywords[:10]

    words = [w for w in _tokenize(text) if w not in STOP_WORDS and len(w) > 2]
    word_freq = Counter(words)
    return [word for word, _ in word_freq.most_common(10)]


def generate_questions(text):
    if not text:
        return []

    ai_prompt = 'Generate 5 short study questions from the following notes. Return one question per line.\n\n' + text
    ai_result = _call_ai(ai_prompt)
    if ai_result and ai_result.strip():
        questions = [q.strip('- ').strip() for q in ai_result.splitlines() if q.strip()]
        if questions:
            return questions[:5]

    sentences = _split_sentences(text)
    return [f"What does the following sentence mean: {s}" for s in sentences[:5]]


def detect_concept_gap(student_answer, expected_answer):
    if not student_answer or not expected_answer:
        return {'score': 0, 'gap_detected': True}

    score = _semantic_similarity(student_answer, expected_answer)
    if score is None:
        student_words = set(_tokenize(student_answer))
        expected_words = set(_tokenize(expected_answer))
        overlap = student_words & expected_words
        score = round((len(overlap) / max(1, len(expected_words))) * 100, 2)
    return {'score': score, 'gap_detected': score < 50}


def generate_voice_explanation(summary):
    if not summary:
        return 'No summary provided.'
    ai_prompt = (
        'Explain the following study summary in clear, simple language for a student. '
        'Keep the explanation natural to listen to and preserve the important ideas.\n\n'
        + summary
    )
    ai_result = _call_ai(ai_prompt)
    if ai_result and ai_result.strip():
        return ai_result.strip()
    return summary