# Models for the Study Assistant

from dataclasses import dataclass
from typing import Optional

@dataclass
class User:
    id: Optional[int]
    name: str
    email: str
    password: Optional[str]
    provider: str = 'local'
    created_at: Optional[str] = None

@dataclass
class Note:
    id: Optional[int]
    user_id: int
    note_text: str
    upload_date: Optional[str] = None

@dataclass
class Question:
    id: Optional[int]
    note_id: int
    question: str

@dataclass
class Answer:
    id: Optional[int]
    question_id: int
    user_answer: str
    score: Optional[float]

@dataclass
class Progress:
    id: Optional[int]
    user_id: int
    questions_attempted: int = 0
    concept_gaps_detected: int = 0