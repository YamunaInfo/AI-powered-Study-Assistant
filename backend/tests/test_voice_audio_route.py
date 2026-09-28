import sys
import unittest
from pathlib import Path
from types import ModuleType
from unittest.mock import patch

from flask import Flask

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from routes.ai_routes import ai_bp


class VoiceAudioRouteTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.register_blueprint(ai_bp)
        self.client = app.test_client()

    def test_voice_audio_requires_text(self):
        response = self.client.post('/ai/voice-audio', json={})
        self.assertEqual(response.status_code, 400)

    def test_voice_audio_returns_mp3(self):
        class FakeGTTS:
            def __init__(self, text, lang):
                self.text = text
                self.lang = lang

            def write_to_fp(self, output):
                output.write(b'fake-mp3-audio')

        fake_gtts = ModuleType('gtts')
        fake_gtts.gTTS = FakeGTTS
        with patch.dict(sys.modules, {'gtts': fake_gtts}):
            response = self.client.post(
                '/ai/voice-audio',
                json={'text': 'A short study summary.'}
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, 'audio/mpeg')
        self.assertEqual(response.data, b'fake-mp3-audio')


if __name__ == '__main__':
    unittest.main()