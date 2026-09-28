# AI-Powered Intelligent Study Assistant

A web app for uploading study notes and generating summaries, keywords, practice questions, answer feedback, and spoken explanations.

## Features

- Upload PDF and TXT study materials.
- Extract PDF text with PyPDF2.
- Generate summaries, keywords, practice questions, and answer feedback.
- Use Gemini or OpenAI for AI-generated text when configured; built-in extractive and token-overlap fallbacks are available.
- Optionally run local BART summarization and MiniLM semantic answer scoring.
- Listen to explanations using gTTS audio, with browser speech as a fallback.
- Create accounts and track study progress.

## Technology

- Frontend: HTML, CSS, and JavaScript.
- Backend: Python and Flask.
- Database: SQLite by default; MySQL is supported through `DATABASE_URL`.
- Text processing: NLTK.
- Optional local models: Transformers BART and Sentence Transformers MiniLM.
- Speech: gTTS, which requires internet access and sends narration text to Google's service.

## Local Setup

Requirements: Python 3.12 or later and pip. MySQL is optional.

From the repository root, create and activate a virtual environment in PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
```

If `backend/.env` does not exist, copy the example file and add your AI provider key if you want AI-generated summaries and explanations:

```powershell
Copy-Item backend\.env.example backend\.env
```

Set `AI_PROVIDER=gemini` and provide `GEMINI_API_KEY`, or set `AI_PROVIDER=openai` and provide `OPENAI_API_KEY`. Keep real keys in `.env` or your hosting provider's secret settings; never commit them.

To use local BART and MiniLM, install the larger optional dependencies and set `ENABLE_LOCAL_MODELS=true` in `backend/.env`:

```powershell
python -m pip install -r backend\requirements-ml.txt
```

The first inference downloads model weights. BART is large and can be slow on CPU. Leave local models disabled to use the configured hosted AI provider and lightweight fallbacks.

### Run Locally

Start the API from the repository root:

```powershell
python backend\app.py
```

The Flask server serves the complete app at `http://127.0.0.1:5001`. To keep the separate frontend development setup, open a second terminal at the repository root and run:

```powershell
python -m http.server 8000 --directory frontend
```

Then open `http://127.0.0.1:8000`; the frontend connects to the API on port 5001. Both modes are supported.

### Run Tests

From the repository root in PowerShell:

```powershell
$env:PYTHONPATH = "$PWD;$PWD\backend"
python -m unittest discover -s backend\tests -v
```

## Deploy to Render

1. Push the repository to GitHub.
2. In Render, select **New > Blueprint** and connect the repository. Render reads the root-level `render.yaml`.
3. Add a valid `GEMINI_API_KEY` in the Render environment settings when prompted. The blueprint generates `SECRET_KEY` and disables local model downloads.
4. After deployment, open the service URL Render assigns and verify `/health` returns `{"status":"ok","backend":"running"}`.

The Render service serves the frontend and API from the same origin. The browser therefore uses the deployed API rather than `localhost`.

SQLite is suitable for local development and demos. Data on a free web service may be lost when its filesystem is reset. For persistent production data, configure a MySQL database and set `DATABASE_URL`, for example `mysql://USER:PASSWORD@HOST:3306/study_assistant`. URL-encode special characters in the username or password.

The Dockerfile can be built from the repository root with:

```powershell
docker build -f backend/Dockerfile -t study-assistant .
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
