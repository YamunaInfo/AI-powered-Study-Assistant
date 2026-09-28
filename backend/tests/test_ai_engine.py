import unittest
from unittest.mock import patch
from backend.ai_engine import (
    _semantic_similarity,
    _summarize_with_bart,
    _tokenize,
    generate_summary,
    extract_keywords,
    generate_questions,
    detect_concept_gap,
    generate_voice_explanation,
)

class TestAIEngine(unittest.TestCase):
    def test_generate_summary_empty(self):
        self.assertEqual(generate_summary(''), 'No text provided.')

    def test_generate_summary_uses_bart_when_available(self):
        with patch('backend.ai_engine._summarize_with_bart', return_value='BART summary'):
            self.assertEqual(generate_summary('A long passage.'), 'BART summary')

    def test_bart_pipeline_results_are_joined(self):
        summarizer = unittest.mock.Mock(return_value=[{'summary_text': 'BART result'}])
        with patch('backend.ai_engine._load_bart_summarizer', return_value=summarizer):
            result = _summarize_with_bart('study ' * 80)
        self.assertEqual(result, 'BART result')
        self.assertEqual(summarizer.call_args.args[0], [' '.join(['study'] * 80)])

    def test_nltk_tokenization(self):
        self.assertEqual(_tokenize('Plants use light-energy.'), ['plants', 'use', 'light', 'energy'])

    def test_extract_keywords_empty(self):
        self.assertEqual(extract_keywords(''), [])

    def test_generate_questions_empty(self):
        self.assertEqual(generate_questions(''), [])

    def test_detect_concept_gap(self):
        result = detect_concept_gap('Photosynthesis uses light.', 'Photosynthesis uses sunlight to make food.')
        self.assertIn('score', result)
        self.assertIn('gap_detected', result)
        self.assertIsInstance(result['score'], float)

    def test_detect_concept_gap_uses_minilm_score(self):
        with patch('backend.ai_engine._semantic_similarity', return_value=82.5):
            result = detect_concept_gap('A meaning-based answer', 'A related question')
        self.assertEqual(result, {'score': 82.5, 'gap_detected': False})

    def test_generate_voice_explanation_empty(self):
        self.assertEqual(generate_voice_explanation(''), 'No summary provided.')

    def test_generate_voice_explanation(self):
        explanation = generate_voice_explanation('osmosis')
        self.assertIsInstance(explanation, str)
        self.assertTrue('osmosis' in explanation.lower() or 'concept' in explanation.lower())

    def test_generate_voice_explanation_falls_back_to_summary(self):
        summary = 'Photosynthesis converts light energy into chemical energy.'
        with patch('backend.ai_engine._call_ai', return_value=None) as call_ai:
            self.assertEqual(generate_voice_explanation(summary), summary)
        self.assertIn(summary, call_ai.call_args.args[0])

if __name__ == '__main__':
    unittest.main()
