// ─── Global State ────────────────────────────────────────────────────────────
const isLocalFrontend = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_HOSTS = isLocalFrontend
    ? ['http://127.0.0.1:5001', 'http://localhost:5001']
    : [''];
let API = API_HOSTS[0];
let currentSection = 'upload';
let uploadedFile = null;
let currentNoteId = null;
let generatedQuestions = [];
let currentQuestionId = null;
let analysisResult = null;
let currentSummary = '';
let voiceAudio = null;
let voiceAudioUrl = null;

// ─── On Page Load ─────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (isLoggedIn) {
        showMainApp();
        loadProfileData();
    } else {
        showAuthPage();
        showLogin();
    }

    // Drag and drop
    const uploadArea = document.getElementById('upload-area');
    if (uploadArea) {
        uploadArea.addEventListener('dragover', e => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--primary-color)';
            uploadArea.style.background = '#F8FAFC';
        });
        uploadArea.addEventListener('dragleave', e => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--border-color)';
            uploadArea.style.background = 'transparent';
        });
        uploadArea.addEventListener('drop', e => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--border-color)';
            uploadArea.style.background = 'transparent';
            const file = e.dataTransfer.files[0];
            if (file && (file.type === 'application/pdf' || file.type === 'text/plain')) {
                uploadedFile = file;
                displayFilePreview(file);
            } else {
                alert('Please upload a PDF or TXT file only.');
            }
        });
    }

});

// ─── Auth ─────────────────────────────────────────────────────────────────────
function showLogin() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('signup-form').classList.add('hidden');
}
function showSignup() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.remove('hidden');
}
function showAuthPage() {
    document.getElementById('auth-page').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
}
function showMainApp() {
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    showSection('upload');
}

async function resolveBackend() {
    for (const host of API_HOSTS) {
        console.log(`Trying backend host: ${host}`);
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);

            const res = await fetch(`${host}/health`, {
                method: 'GET',
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            clearTimeout(timeout);

            const contentType = res.headers.get('content-type') || '';
            console.log(`Backend host ${host} returned status ${res.status} and content-type ${contentType}`);

            if (res.ok && contentType.includes('application/json')) {
                API = host;
                console.log(`✅ Selected backend API host: ${API}`);
                console.log(`Frontend will use: ${API}`);
                return true;
            }

            console.warn(`Backend host ${host} was skipped because it did not return JSON health data.`);
        } catch (err) {
            console.warn(`❌ Backend host ${host} unreachable:`, err.message || err);
        }
    }
    console.error('❌ No reachable backend host found.');
    console.error('Make sure Flask is running on port 5001.');
    return false;
}

function loginUser() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) { alert('Please fill in all fields'); return; }

    fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })
    .then(r => r.json())
    .then(data => {
        if (data.message === 'Login successful') {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('loginProvider', 'Email');
            localStorage.setItem('userId', data.user_id);
            localStorage.setItem('userName', data.name || email.split('@')[0]);
            localStorage.setItem('userEmail', data.email || email);
            showMainApp();
            loadProfileData();
        } else {
            alert(data.message || 'Login failed');
        }
    })
    .catch(() => alert('Cannot connect to server. Is Flask running on port 5001?'));
}

function signupUser() {
    const name = document.getElementById('signup-fullname').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    if (!name || !email || !password) { alert('Please fill in all fields'); return; }

    fetch(`${API}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
    })
    .then(r => r.json())
    .then(data => {
        if (data.message === 'Signup successful') {
            alert('Account created! Please sign in.');
            showLogin();
        } else {
            alert(data.message || 'Signup failed');
        }
    })
    .catch(() => alert('Cannot connect to server. Is Flask running on port 5001?'));
}

function loginWithGoogle() { simulateOAuthLogin('Google'); }
function loginWithGithub()  { simulateOAuthLogin('GitHub'); }

function simulateOAuthLogin(provider) {
    const email    = provider === 'Google' ? 'google.user@example.com' : 'github.user@example.com';
    const name     = provider === 'Google' ? 'Google User' : 'GitHub User';
    const password = 'oauth_placeholder_123';

    fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })
    .then(r => r.json())
    .then(data => {
        if (data.message === 'Login successful') {
            storeSession(data.user_id, name, email, provider);
        } else {
            return fetch(`${API}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            })
            .then(r => r.json())
            .then(() => fetch(`${API}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            }))
            .then(r => r.json())
            .then(loginData => {
                if (loginData.message === 'Login successful') {
                    storeSession(loginData.user_id, name, email, provider);
                } else {
                    alert('OAuth login failed. Please use email instead.');
                }
            });
        }
    })
    .catch(() => alert('Cannot connect to server.'));
}

function storeSession(userId, name, email, provider) {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userId', userId);
    localStorage.setItem('userName', name);
    localStorage.setItem('userEmail', email);
    localStorage.setItem('loginProvider', provider);
    showMainApp();
    loadProfileData();
}

function logout() {
    if (!confirm('Are you sure you want to logout?')) return;
    localStorage.clear();
    location.reload();
}

// ─── Profile ──────────────────────────────────────────────────────────────────
function loadProfileData() {
    const name     = localStorage.getItem('userName') || 'User';
    const email    = localStorage.getItem('userEmail') || '';
    const provider = localStorage.getItem('loginProvider') || 'Email';
    const userId   = localStorage.getItem('userId');
    const bio      = localStorage.getItem('userBio') || 'Passionate learner focused on mastering AI and machine learning concepts.';

    document.getElementById('profile-name').textContent        = name;
    document.getElementById('header-profile-name').textContent = name;
    document.getElementById('profile-email').textContent       = email;
    document.getElementById('login-provider').textContent      = provider;
    document.getElementById('profile-bio').textContent         = bio;

    updateProfileAvatar();
    updateHeaderProfileAvatar();

    if (userId) {
        fetch(`${API}/profile/progress?user_id=${userId}`)
            .then(r => r.json())
            .then(data => {
                const cards = document.querySelectorAll('.progress-content h3');
                if (cards.length >= 4) {
                    cards[2].textContent = data.questions_attempted   ?? 0;
                    cards[3].textContent = data.concept_gaps_detected ?? 0;
                }
            })
            .catch(() => {});
    }
}

function editProfile() {
    const name = prompt('Enter your name:', document.getElementById('profile-name').textContent);
    const bio  = prompt('Enter your bio:',  document.getElementById('profile-bio').textContent);
    if (name) {
        document.getElementById('profile-name').textContent        = name;
        document.getElementById('header-profile-name').textContent = name;
        localStorage.setItem('userName', name);
    }
    if (bio) {
        document.getElementById('profile-bio').textContent = bio;
        localStorage.setItem('userBio', bio);
    }
}

function changeProfilePicture(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        localStorage.setItem('userAvatar', e.target.result);
        updateProfileAvatar();
        updateHeaderProfileAvatar();
    };
    reader.readAsDataURL(file);
}

function updateProfileAvatar() {
    const avatar    = localStorage.getItem('userAvatar');
    const container = document.getElementById('profile-avatar-img-container');
    container.innerHTML = avatar
        ? `<img src="${avatar}" alt="Profile Picture" class="profile-avatar-image">`
        : `<svg width="80" height="80" viewBox="0 0 80 80" fill="none"><circle cx="40" cy="40" r="40" fill="#407093"/><circle cx="40" cy="32" r="16" fill="#F5F5F5"/><path d="M40 48c-13 0-24 6.5-24 14.5v3.5c0 2.2 1.8 4 4 4h40c2.2 0 4-1.8 4-4v-3.5C64 54.5 53 48 40 48z" fill="#F5F5F5"/></svg>`;
}

function updateHeaderProfileAvatar() {
    const avatar    = localStorage.getItem('userAvatar');
    const container = document.getElementById('header-profile-avatar-container');
    container.innerHTML = avatar
        ? `<img src="${avatar}" alt="Profile" style="width:32px;height:32px;border-radius:50%">`
        : `<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#407093"/><circle cx="16" cy="12.8" r="6.4" fill="#F5F5F5"/><path d="M16 19.2c-5.2 0-9.6 2.6-9.6 5.8v1.4c0 0.88 0.72 1.6 1.6 1.6h16c0.88 0 1.6-0.72 1.6-1.6v-1.4C25.6 21.8 21.2 19.2 16 19.2z" fill="#F5F5F5"/></svg>`;
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function showSection(name) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const section = document.getElementById(`${name}-section`);
    if (section) { section.classList.add('active'); currentSection = name; }
    const navItem = document.querySelector(`[data-section="${name}"]`);
    if (navItem) navItem.classList.add('active');
    window.scrollTo(0, 0);

    // Auto-load AI content when navigating to a section that needs it
    if (currentNoteId) {
        if (name === 'summary')   loadSummary(currentNoteId);
        if (name === 'keywords')  loadKeywords(currentNoteId);
        if (name === 'questions') loadQuestions(currentNoteId);
    }
}
function goBack(prev) { showSection(prev); }

// ─── File Upload ──────────────────────────────────────────────────────────────
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) { console.log("No file selected"); return; }
    uploadedFile = file;
    displayFilePreview(file);
}

function displayFilePreview(file) {
    const fileNameEl = document.getElementById("file-name");
    const fileSizeEl = document.getElementById("file-size");
    const previewEl  = document.getElementById("file-preview");
    if (fileNameEl) fileNameEl.innerText = file.name;
    if (fileSizeEl) fileSizeEl.innerText = (file.size / 1024).toFixed(2) + " KB";
    if (previewEl)  previewEl.classList.remove("hidden");
}


// ─── Process Notes → POST /notes/upload-notes ────────────────────────────────
async function processNotes() {
    if (event) event.preventDefault();

    const backendReady = await resolveBackend();
    if (!backendReady) {
        alert('Backend is unreachable. Start Flask on http://127.0.0.1:5001 and retry.');
        return;
    }

    // Accept file from click-upload OR drag-and-drop
    const fileInput = document.getElementById("file-input");
    const file = (fileInput && fileInput.files[0]) ? fileInput.files[0] : uploadedFile;

    if (!file) {
        alert("Please select a file first");
        return;
    }

    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert("You must be logged in to upload notes.");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_id", userId);

    // Show loading feedback
    console.log('processNotes: Uploading to', `${API}/notes/upload-notes`);
    const btn = document.querySelector('[onclick="processNotes()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }

    try {
        const response = await fetch(`${API}/notes/upload-notes`, {
            method: "POST",
            body: formData
        });

        const data = await response.json().catch(() => null);
        
        console.log("Upload response status:", response.status);
        console.log("Upload response data:", data);

        if (!response.ok) {
            const errorMsg = data?.message || `Server error: ${response.status}`;
            throw new Error(errorMsg);
        }

        if (btn) { btn.disabled = false; btn.textContent = 'Process Notes'; }

        if (data && data.note_id) {
            currentNoteId = data.note_id;
            showSection('summary');
            loadSummary(currentNoteId);
        } else {
            alert(data?.message || "Upload failed — no note_id returned.");
        }
    } catch (error) {
        console.error("Upload error:", error);
        if (btn) { btn.disabled = false; btn.textContent = 'Process Notes'; }
        alert("Upload failed.\n\nError: " + (error.message || "Unknown error"));
    }
}


// ─── AI: Summary → POST /ai/generate-summary ─────────────────────────────────
function loadSummary(noteId) {
    const el = document.getElementById('summary-content');
    currentSummary = '';
    el.innerHTML = '<div class="loading-spinner">Generating AI summary...</div>';

    fetch(`${API}/ai/generate-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_id: noteId })
    })
    .then(r => { if (!r.ok) throw new Error(`Status ${r.status}`); return r.json(); })
    .then(data => {
        console.log('[Summary]', data);
        if (data.summary) {
            currentSummary = data.summary.trim();
            // Split summary by newlines and display as formatted text
            const summaryText = currentSummary
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .join('<br>');
            el.innerHTML = `
                <p style="line-height:1.8;font-size:16px">${summaryText}</p>
                <button class="btn btn-primary" onclick="showSection('keywords')" style="margin-top:24px">
                    Next: View Key Concepts →
                </button>`;
        } else {
            el.innerHTML = `<p style="color:orange">⚠️ ${data.message || 'Could not generate summary'}</p>
                <button class="btn btn-primary" onclick="loadSummary(${noteId})" style="margin-top:16px">Retry</button>`;
        }
    })
    .catch(err => {
        console.error('[Summary] Error:', err);
        el.innerHTML = `<div style="color:#e53e3e;background:#fff5f5;border:1px solid #fed7d7;border-radius:8px;padding:16px">
            ⚠️ Failed to generate summary: ${err.message}
            <br><br><button class="btn btn-primary" onclick="loadSummary(${noteId})">Retry</button></div>`;
    });
}

// ─── AI: Keywords → POST /ai/extract-keywords ────────────────────────────────
function loadKeywords(noteId) {
    const el = document.getElementById('keywords-container');
    el.innerHTML = '<div class="loading-spinner">Extracting keywords...</div>';

    fetch(`${API}/ai/extract-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_id: noteId })
    })
    .then(r => { if (!r.ok) throw new Error(`Status ${r.status}`); return r.json(); })
    .then(data => {
        console.log('[Keywords]', data);
        if (data.keywords && data.keywords.length > 0) {
            const tags = data.keywords.map(k => `<span class="keyword-tag">${k}</span>`).join('');
            el.innerHTML = `${tags}
                <div style="width:100%;margin-top:24px">
                    <button class="btn btn-primary" onclick="showSection('questions')">
                        Next: Practice Questions →
                    </button>
                </div>`;
        } else {
            el.innerHTML = `<p style="color:orange">⚠️ No keywords found.</p>
                <button class="btn btn-primary" onclick="loadKeywords(${noteId})" style="margin-top:16px">Retry</button>`;
        }
    })
    .catch(err => {
        console.error('[Keywords] Error:', err);
        el.innerHTML = `<div style="color:#e53e3e;background:#fff5f5;border:1px solid #fed7d7;border-radius:8px;padding:16px">
            ⚠️ Failed to extract keywords: ${err.message}
            <br><br><button class="btn btn-primary" onclick="loadKeywords(${noteId})">Retry</button></div>`;
    });
}

// ─── AI: Questions → POST /ai/generate-questions ─────────────────────────────
function loadQuestions(noteId) {
    const el = document.getElementById('questions-container');
    el.innerHTML = '<div class="loading-spinner">Generating practice questions...</div>';

    fetch(`${API}/ai/generate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_id: noteId })
    })
    .then(r => { if (!r.ok) throw new Error(`Status ${r.status}`); return r.json(); })
    .then(data => {
        console.log('[Questions]', data);
        if (data.questions && data.questions.length > 0) {
            generatedQuestions = data.questions;
            currentQuestionId  = 0;

            const cards = data.questions.map((q, i) => `
                <div class="question-card" onclick="selectQuestion(${i})" id="qcard-${i}" style="cursor:pointer">
                    <span class="question-number">Question ${i + 1}</span>
                    <p class="question-text">${truncateText(q, 120)}</p>
                </div>`).join('');

            el.innerHTML = `
                ${cards}
                <p style="color:var(--text-muted);font-size:14px;margin-top:8px">Click a question to select it.</p>
                <div style="text-align:center;margin-top:24px">
                    <button class="btn btn-primary btn-large" onclick="showSection('answer')">
                        Answer Questions →
                    </button>
                </div>`;

            selectQuestion(0);
        } else {
            el.innerHTML = `<p style="color:orange">⚠️ No questions generated.</p>
                <button class="btn btn-primary" onclick="loadQuestions(${noteId})" style="margin-top:16px">Retry</button>`;
        }
    })
    .catch(err => {
        console.error('[Questions] Error:', err);
        el.innerHTML = `<div style="color:#e53e3e;background:#fff5f5;border:1px solid #fed7d7;border-radius:8px;padding:16px">
            ⚠️ Failed to generate questions: ${err.message}
            <br><br><button class="btn btn-primary" onclick="loadQuestions(${noteId})">Retry</button></div>`;
    });
}

function selectQuestion(index) {
    document.querySelectorAll('.question-card').forEach((c, i) => {
        c.style.border     = i === index ? '2px solid var(--primary-color)' : '2px solid transparent';
        c.style.background = i === index ? '#EBF5FB' : '';
    });
    currentQuestionId = index;

    // Show selected question text above the answer textarea
    const titleEl = document.querySelector('#answer-section .card-title');
    if (titleEl && generatedQuestions[index]) {
        const questionPreview = truncateText(generatedQuestions[index], 230);
        titleEl.innerHTML = `Write Your Answer
            <br><small style="font-size:13px;font-weight:400;color:var(--text-secondary);display:block;margin-top:6px">
            Q${index + 1}: ${questionPreview}</small>`;
    }
}

function truncateText(text, maxChars = 150) {
    if (!text) return '';
    const normalized = text.replace(/\s+/g, ' ').trim();
    return normalized.length > maxChars ? normalized.slice(0, maxChars - 3).trim() + '...' : normalized;
}

// ─── Submit Answer → POST /ai/detect-concept-gap ─────────────────────────────
function submitAnswer() {
    const answer = document.getElementById('student-answer').value.trim();
    if (!answer) { alert('Please write your answer before submitting'); return; }

    if (generatedQuestions.length === 0) {
        alert('No questions available. Please upload and process your notes first.');
        showSection('upload');
        return;
    }

    const question = generatedQuestions[currentQuestionId ?? 0];

    showSection('gap-analysis');
    document.getElementById('gap-analysis-content').innerHTML =
        '<div class="loading-spinner">Analysing your answer...</div>';

    fetch(`${API}/ai/detect-concept-gap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_answer: answer, expected_answer: question })
    })
    .then(r => { if (!r.ok) throw new Error(`Status ${r.status}`); return r.json(); })
    .then(data => {
        console.log('[Gap Analysis]', data);
        analysisResult = data;
        renderGapAnalysis(data);
    })
    .catch(err => {
        console.error('[Gap Analysis] Error:', err);
        document.getElementById('gap-analysis-content').innerHTML =
            `<div style="color:#e53e3e;background:#fff5f5;border:1px solid #fed7d7;border-radius:8px;padding:16px">
            ⚠️ Failed to analyse answer: ${err.message}</div>`;
    });
}

function renderGapAnalysis(data) {
    const score    = data.score ?? 0;
    const isGood   = !data.gap_detected;
    const icon     = isGood
        ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`
        : `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;

    document.getElementById('gap-analysis-content').innerHTML = `
        <div class="analysis-result ${isGood ? 'result-success' : 'result-warning'}">
            <div class="result-title">${icon} ${isGood ? 'Good Understanding' : 'Concept Gap Detected'}</div>
            <p class="result-text">${isGood
                ? `Your answer scored ${score}% similarity. Great work!`
                : `Your answer scored ${score}% similarity. Review the material and try again.`}</p>
            <div class="concept-list">
                <div class="concept-item">Similarity Score: <strong>${score}%</strong></div>
                <div class="concept-item">${isGood
                    ? '✓ Your answer covers the concept well'
                    : '⚠ Include more relevant terminology and detail'}</div>
            </div>
        </div>
        <div style="text-align:center;margin-top:32px">
            <button class="btn btn-primary btn-large" onclick="showSection('voice')">
                Listen to Explanation →
            </button>
        </div>`;
}

// ─── Voice Explanation ────────────────────────────────────────────────────────
function playVoiceExplanation() {
    if (!currentSummary) {
        alert('Upload and process a file to generate a summary first.');
        return;
    }

    let narration = currentSummary;
    fetch(`${API}/ai/voice-explanation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: currentSummary })
    })
    .then(r => { if (!r.ok) throw new Error(`Status ${r.status}`); return r.json(); })
    .then(data => {
        narration = data.explanation || currentSummary;
        return fetch(`${API}/ai/voice-audio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: narration })
        });
    })
    .then(r => { if (!r.ok) throw new Error(`Audio status ${r.status}`); return r.blob(); })
    .then(blob => playAudio(blob, narration))
    .catch(err => {
        console.error('[Voice Explanation] Audio unavailable:', err);
        if ('speechSynthesis' in window) {
            speakText(narration);
        } else {
            alert('Voice playback is unavailable in this browser.');
        }
    });
}

function playAudio(blob, fallbackText) {
    const button = document.getElementById('play-voice-button');
    const voiceText = document.getElementById('voice-text');
    const voiceAnim = document.getElementById('voice-animation');
    if (voiceAudio) voiceAudio.pause();
    if (voiceAudioUrl) URL.revokeObjectURL(voiceAudioUrl);

    voiceAudioUrl = URL.createObjectURL(blob);
    voiceAudio = new Audio(voiceAudioUrl);
    button.disabled = true;
    button.textContent = 'Playing...';
    voiceText.textContent = 'Listen carefully...';
    voiceAnim.classList.add('playing');

    const reset = () => {
        if (voiceAudioUrl) URL.revokeObjectURL(voiceAudioUrl);
        voiceAudioUrl = null;
        button.disabled = false;
        button.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3L15 10L5 17V3Z"/></svg> Play Again`;
        voiceText.textContent = 'Click to hear the explanation again';
        voiceAnim.classList.remove('playing');
    };
    voiceAudio.onended = reset;
    voiceAudio.onerror = () => {
        reset();
        if ('speechSynthesis' in window) speakText(fallbackText);
    };
    voiceAudio.play().catch(() => {
        reset();
        if ('speechSynthesis' in window) speakText(fallbackText);
    });
}

function speakText(text) {
    const button    = document.getElementById('play-voice-button');
    const voiceText = document.getElementById('voice-text');
    const voiceAnim = document.getElementById('voice-animation');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate  = 0.9;
    utterance.pitch = 1;

    utterance.onstart = () => {
        button.disabled     = true;
        button.innerHTML    = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><rect x="6" y="4" width="3" height="12"/><rect x="11" y="4" width="3" height="12"/></svg> Playing...`;
        voiceText.textContent = 'Listen carefully...';
        voiceAnim.classList.add('playing');
    };
    utterance.onend = () => {
        button.disabled     = false;
        button.innerHTML    = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3L15 10L5 17V3Z"/></svg> Play Again`;
        voiceText.textContent = 'Click to hear the explanation again';
        voiceAnim.classList.remove('playing');
    };
    utterance.onerror = () => {
        button.disabled     = false;
        button.innerHTML    = `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3L15 10L5 17V3Z"/></svg> Play Explanation`;
        voiceText.textContent = 'Error. Please try again.';
        voiceAnim.classList.remove('playing');
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}