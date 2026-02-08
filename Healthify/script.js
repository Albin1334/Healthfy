// Configuration
const API_URL = 'http://localhost:5000/api/analyze';
const SKIN_API_URL = 'http://localhost:5000/api/analyze-skin';

// State
let ttsEnabled = false;
let speechSynthesis = window.speechSynthesis;
let currentUser = null;

// DOM Elements
const welcomeMessage = document.getElementById('welcomeMessage');
const chatMessages = document.getElementById('chatMessages');
const responseCard = document.getElementById('responseCard');
const symptomInput = document.getElementById('symptomInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const ttsToggle = document.getElementById('ttsToggle');

// Profile Elements
const profileBtn = document.getElementById('profileBtn');
const profileDropdown = document.querySelector('.profile-dropdown');
const profileName = document.getElementById('profileName');
const profileMenu = document.getElementById('profileMenu');
const menuUserName = document.getElementById('menuUserName');
const menuUserEmail = document.getElementById('menuUserEmail');
const logoutBtn = document.getElementById('logoutBtn');
const viewProfileBtn = document.getElementById('viewProfile');

// History Elements (now in profile menu)
const historyBtn = document.getElementById('historyBtn');
const historySidebar = document.getElementById('historySidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const closeSidebarBtn = document.getElementById('closeSidebar');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistory');

// Medicines Elements
const medicinesBtn = document.getElementById('medicinesBtn');
const medicinesSidebar = document.getElementById('medicinesSidebar');
const closeMedicinesBtn = document.getElementById('closeMedicines');
const medicinesOverlay = document.getElementById('medicinesOverlay');

// Modal Elements
const profileModal = document.getElementById('profileModal');
const closeProfileModal = document.getElementById('closeProfileModal');

// ============ Authentication ============

function checkAuth() {
    const userFromLocal = localStorage.getItem('healthify_user');
    const userFromSession = sessionStorage.getItem('healthify_user');

    if (userFromLocal) {
        currentUser = JSON.parse(userFromLocal);
    } else if (userFromSession) {
        currentUser = JSON.parse(userFromSession);
    }

    if (currentUser && currentUser.loggedIn) {
        updateUIForUser();
    } else {
        // Redirect to login
        window.location.href = 'login.html';
    }
}

function updateUIForUser() {
    if (!currentUser) return;

    // Update profile display
    const firstName = currentUser.name ? currentUser.name.split(' ')[0] : 'User';
    profileName.textContent = firstName;
    menuUserName.textContent = currentUser.name || 'Guest User';
    menuUserEmail.textContent = currentUser.isGuest ? 'Guest Mode' : (currentUser.email || 'No email');

    // Update welcome message
    const welcomeText = document.getElementById('welcomeText');
    if (welcomeText) {
        welcomeText.textContent = `Hello ${firstName}! I'm Healthify, your virtual triage nurse.`;
    }
}

// Profile Dropdown Toggle
profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle('open');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!profileDropdown.contains(e.target)) {
        profileDropdown.classList.remove('open');
    }
});

// View Profile
viewProfileBtn.addEventListener('click', () => {
    profileDropdown.classList.remove('open');
    openProfileModal();
});

// Logout
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('healthify_user');
    sessionStorage.removeItem('healthify_user');
    window.location.href = 'login.html';
});

// ============ Profile Modal ============

function openProfileModal() {
    // Update modal content
    document.getElementById('modalUserName').textContent = currentUser?.name || 'Guest User';
    document.getElementById('modalUserEmail').textContent = currentUser?.isGuest ? 'Guest Mode' : (currentUser?.email || 'No email');

    // Get member since date
    if (currentUser && !currentUser.isGuest) {
        const users = JSON.parse(localStorage.getItem('healthify_users') || '{}');
        const userData = users[currentUser.email];
        if (userData && userData.createdAt) {
            const date = new Date(userData.createdAt);
            document.getElementById('modalMemberSince').textContent = date.toLocaleDateString();
        }
    } else {
        document.getElementById('modalMemberSince').textContent = 'N/A (Guest)';
    }

    // Update stats
    const history = getChatHistory();
    document.getElementById('totalChats').textContent = history.length;

    // Count chats this month
    const now = new Date();
    const thisMonth = history.filter(item => {
        const itemDate = new Date(item.timestamp);
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
    }).length;
    document.getElementById('thisMonth').textContent = thisMonth;

    profileModal.classList.add('open');
}

closeProfileModal.addEventListener('click', () => {
    profileModal.classList.remove('open');
});

profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) {
        profileModal.classList.remove('open');
    }
});

// ============ Chat History ============

function getChatHistory() {
    const key = currentUser?.isGuest ? 'healthify_history_guest' : `healthify_history_${currentUser?.email}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
}

function saveChatHistory(history) {
    const key = currentUser?.isGuest ? 'healthify_history_guest' : `healthify_history_${currentUser?.email}`;
    localStorage.setItem(key, JSON.stringify(history));
}

function addToHistory(symptom, response) {
    const history = getChatHistory();

    const severityEmoji = {
        'HOME_CARE': '✅',
        'CONSULT_GP': '⚠️',
        'EMERGENCY': '🚨'
    };

    history.unshift({
        id: Date.now(),
        symptom: symptom,
        severity: response.severity_level,
        severityEmoji: severityEmoji[response.severity_level] || '❓',
        spokenResponse: response.spoken_response,
        timestamp: new Date().toISOString()
    });

    // Keep only last 50 items
    if (history.length > 50) {
        history.pop();
    }

    saveChatHistory(history);
    renderHistory();
}

function renderHistory() {
    const history = getChatHistory();

    if (history.length === 0) {
        historyList.innerHTML = `
            <div class="empty-history">
                <div class="empty-history-icon">📭</div>
                <p>No chat history yet</p>
                <p>Your conversations will appear here</p>
            </div>
        `;
        return;
    }

    historyList.innerHTML = history.map(item => {
        const date = new Date(item.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="history-item" data-id="${item.id}">
                <div class="history-item-header">
                    <span class="history-date">${dateStr}</span>
                    <span class="history-severity">${item.severityEmoji}</span>
                </div>
                <div class="history-symptom">${item.symptom}</div>
            </div>
        `;
    }).join('');

    // Add click handlers
    document.querySelectorAll('.history-item').forEach(el => {
        el.addEventListener('click', () => {
            const id = parseInt(el.dataset.id);
            const item = history.find(h => h.id === id);
            if (item) {
                closeSidebar();
                symptomInput.value = item.symptom;
            }
        });
    });
}

// History Sidebar Controls (from profile menu)
historyBtn.addEventListener('click', () => {
    profileDropdown.classList.remove('open');
    renderHistory();
    historySidebar.classList.add('open');
    sidebarOverlay.classList.add('open');
});

function closeSidebar() {
    historySidebar.classList.remove('open');
    sidebarOverlay.classList.remove('open');
}

closeSidebarBtn.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

// Clear History
clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all chat history?')) {
        saveChatHistory([]);
        renderHistory();
    }
});

// ============ Medicines Sidebar ============

medicinesBtn.addEventListener('click', () => {
    profileDropdown.classList.remove('open');
    medicinesSidebar.classList.add('open');
    medicinesOverlay.classList.add('open');
});

function closeMedicinesSidebar() {
    medicinesSidebar.classList.remove('open');
    medicinesOverlay.classList.remove('open');
}

closeMedicinesBtn.addEventListener('click', closeMedicinesSidebar);
medicinesOverlay.addEventListener('click', closeMedicinesSidebar);

// ============ Text-to-Speech ============

ttsToggle.addEventListener('click', () => {
    ttsEnabled = !ttsEnabled;
    ttsToggle.classList.toggle('active');

    if (ttsEnabled) {
        if (!('speechSynthesis' in window)) {
            alert('Sorry, your browser does not support text-to-speech.');
            ttsEnabled = false;
            ttsToggle.classList.remove('active');
            return;
        }
        speak('Voice Support is now on. I will read all responses to you.');
    } else {
        speechSynthesis.cancel();
    }
});

// ============ Symptom Analysis ============

document.querySelectorAll('.example-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        const symptom = chip.getAttribute('data-symptom');
        symptomInput.value = symptom;
        analyzeSymptoms();
    });
});

symptomInput.addEventListener('input', () => {
    symptomInput.style.height = 'auto';
    symptomInput.style.height = symptomInput.scrollHeight + 'px';
});

symptomInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        analyzeSymptoms();
    }
});

analyzeBtn.addEventListener('click', analyzeSymptoms);

async function analyzeSymptoms() {
    const symptoms = symptomInput.value.trim();

    if (!symptoms) {
        alert('Please describe your symptoms first.');
        return;
    }

    if (welcomeMessage) {
        welcomeMessage.style.display = 'none';
    }

    addMessage(symptoms, 'user');

    symptomInput.value = '';
    symptomInput.style.height = 'auto';

    analyzeBtn.disabled = true;
    loadingIndicator.style.display = 'flex';
    responseCard.style.display = 'none';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ symptoms: symptoms })
        });

        if (!response.ok) {
            throw new Error('Failed to analyze symptoms');
        }

        const data = await response.json();

        displayResponse(data);
        addToHistory(symptoms, data);

        if (ttsEnabled && data.spoken_response) {
            speak(data.spoken_response);
        }

        // Auto scroll to response
        setTimeout(() => {
            responseCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

    } catch (error) {
        console.error('Error:', error);
        addMessage('Sorry, I encountered an error analyzing your symptoms. Please try again.', 'bot');
        alert('Error connecting to Healthify. Please ensure the server is running.');
    } finally {
        analyzeBtn.disabled = false;
        loadingIndicator.style.display = 'none';
    }
}

function addMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
    chatMessages.appendChild(messageDiv);
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function displayResponse(data) {
    const { severity_level, severity_color, spoken_response, detailed_plan, verified_sources, medications, home_remedies } = data;

    const severityBadge = document.getElementById('severityBadge');
    const severityTitle = document.getElementById('severityTitle');

    severityBadge.className = `severity-badge ${severity_color}`;

    const severityConfig = {
        'HOME_CARE': { icon: '✅', title: 'Safe for Home Care' },
        'CONSULT_GP': { icon: '⚠️', title: 'Consult Your Doctor' },
        'EMERGENCY': { icon: '🚨', title: 'EMERGENCY - Seek Help Now!' }
    };

    const config = severityConfig[severity_level] || severityConfig['CONSULT_GP'];
    severityBadge.textContent = config.icon;
    severityTitle.textContent = config.title;

    document.getElementById('spokenResponse').textContent = spoken_response;
    document.getElementById('detailedPlan').innerHTML = formatDetailedPlan(detailed_plan);

    // Medications
    const medsSection = document.getElementById('symptomMedicationsSection');
    const medsList = document.getElementById('symptomMedicationsList');
    if (medications && medications.length > 0) {
        medsList.innerHTML = medications.map(med => `
            <div class="medication-item">
                <span class="medication-name">${med.name}</span>
                <span class="medication-dosage">${med.dosage}</span>
                <span class="medication-type">${med.type}</span>
            </div>
        `).join('');
        medsSection.style.display = 'block';
    } else {
        medsSection.style.display = 'none';
    }

    // Home Remedies
    const remediesSection = document.getElementById('symptomRemediesSection');
    const remediesList = document.getElementById('symptomRemediesList');
    if (home_remedies && home_remedies.length > 0) {
        remediesList.innerHTML = home_remedies.map(remedy => `
            <li>${remedy}</li>
        `).join('');
        remediesSection.style.display = 'block';
    } else {
        remediesSection.style.display = 'none';
    }

    const sourcesList = document.getElementById('sourcesList');
    sourcesList.innerHTML = '';

    if (verified_sources && verified_sources.length > 0) {
        verified_sources.forEach(source => {
            const link = document.createElement('a');
            link.href = source;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'source-link';

            const domain = new URL(source).hostname.replace('www.', '');
            link.textContent = domain;

            sourcesList.appendChild(link);
        });
    }

    responseCard.style.display = 'block';
}

function formatDetailedPlan(plan) {
    if (!plan) return '';
    let formatted = plan
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/• /g, '<br>• ')
        .replace(/\n/g, '<br>');

    return formatted;
}

// ============ Speech Synthesis ============

function speak(text) {
    if (!('speechSynthesis' in window)) {
        console.warn('Speech synthesis not supported');
        return;
    }

    speechSynthesis.cancel();

    setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);

        utterance.rate = 0.85;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.lang = 'en-US';

        const voices = speechSynthesis.getVoices();

        if (voices.length > 0) {
            const preferredVoice = voices.find(voice =>
                voice.lang.startsWith('en') &&
                (voice.name.includes('Female') ||
                    voice.name.includes('Samantha') ||
                    voice.name.includes('Karen') ||
                    voice.name.includes('Google') ||
                    voice.name.includes('Microsoft') ||
                    voice.name.includes('Zira'))
            );

            if (preferredVoice) {
                utterance.voice = preferredVoice;
            } else {
                const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
                if (englishVoice) {
                    utterance.voice = englishVoice;
                }
            }
        }

        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event.error);
        };

        try {
            speechSynthesis.speak(utterance);
        } catch (error) {
            console.error('Error speaking:', error);
        }
    }, 100);
}

// Load voices
let voicesLoaded = false;

function loadVoices() {
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
        voicesLoaded = true;
        console.log(`Loaded ${voices.length} voices for text-to-speech`);
    }
}

loadVoices();

if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        speechSynthesis.cancel();
    }
});

// ============ Initialize ============

// Check authentication on page load
checkAuth();

console.log('🏥 Healthify initialized');
console.log('💡 Tip: Enable Voice Support for text-to-speech responses');

// ============ SKIN ANALYSIS ============

// Skin Analysis Elements
const symptomTab = document.getElementById('symptomTab');
const skinTab = document.getElementById('skinTab');
const symptomsMode = document.getElementById('symptomsMode');
const skinMode = document.getElementById('skinMode');
const uploadArea = document.getElementById('uploadArea');
const skinImageInput = document.getElementById('skinImageInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const removeImageBtn = document.getElementById('removeImage');
const skinDescription = document.getElementById('skinDescription');
const analyzeSkinBtn = document.getElementById('analyzeSkinBtn');
const skinResponseCard = document.getElementById('skinResponseCard');

let selectedSkinImage = null;

// Tab Switching
symptomTab?.addEventListener('click', () => {
    symptomTab.classList.add('active');
    skinTab.classList.remove('active');
    symptomsMode.classList.add('active');
    skinMode.classList.remove('active');
    skinResponseCard.style.display = 'none';
});

skinTab?.addEventListener('click', () => {
    skinTab.classList.add('active');
    symptomTab.classList.remove('active');
    skinMode.classList.add('active');
    symptomsMode.classList.remove('active');
    responseCard.style.display = 'none';
});

// Image Upload - Click
uploadArea?.addEventListener('click', () => {
    if (!selectedSkinImage) {
        skinImageInput.click();
    }
});

// Image Upload - File Selection
skinImageInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleImageUpload(file);
    }
});

// Image Upload - Drag and Drop
uploadArea?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea?.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        handleImageUpload(file);
    }
});

function handleImageUpload(file) {
    if (file.size > 10 * 1024 * 1024) {
        alert('Image too large. Please select an image under 10MB.');
        return;
    }

    selectedSkinImage = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        document.querySelector('.upload-content').style.display = 'none';
        imagePreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

// Remove Image
removeImageBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedSkinImage = null;
    skinImageInput.value = '';
    previewImg.src = '';
    imagePreview.style.display = 'none';
    document.querySelector('.upload-content').style.display = 'flex';
});

// Analyze Skin
analyzeSkinBtn?.addEventListener('click', analyzeSkin);

skinDescription?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        analyzeSkin();
    }
});

async function analyzeSkin() {
    const description = skinDescription.value.trim();

    if (!description) {
        alert('Please describe what you see on your skin (e.g., "red itchy rash", "dry patches")');
        return;
    }

    if (welcomeMessage) {
        welcomeMessage.style.display = 'none';
    }

    analyzeSkinBtn.disabled = true;
    loadingIndicator.style.display = 'flex';
    skinResponseCard.style.display = 'none';

    try {
        const formData = new FormData();
        formData.append('description', description);
        if (selectedSkinImage) {
            formData.append('image', selectedSkinImage);
        }

        const response = await fetch(SKIN_API_URL, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Failed to analyze skin condition');
        }

        const data = await response.json();
        displaySkinResponse(data);

        if (ttsEnabled) {
            speak(`I've identified this as ${data.condition_name}. ${data.description}`);
        }

    } catch (error) {
        console.error('Error:', error);
        alert('Error analyzing skin condition. Please ensure the server is running.');
    } finally {
        analyzeSkinBtn.disabled = false;
        loadingIndicator.style.display = 'none';
    }
}

function displaySkinResponse(data) {
    // Severity badge
    const severityBadge = document.getElementById('skinSeverityBadge');
    severityBadge.className = `severity-badge ${data.severity_color}`;

    const severityEmojis = {
        'HOME_CARE': '✅',
        'CONSULT_GP': '⚠️',
        'EMERGENCY': '🚨'
    };
    severityBadge.textContent = severityEmojis[data.severity_level] || '⚠️';

    // Condition info
    document.getElementById('conditionName').textContent = data.condition_name;
    document.getElementById('conditionDescription').textContent = data.description;

    // Medications
    const medicationsList = document.getElementById('medicationsList');
    medicationsList.innerHTML = data.medications.map(med => `
        <div class="medication-item">
            <span class="medication-name">${med.name}</span>
            <span class="medication-dosage">${med.dosage}</span>
            <span class="medication-type">${med.type}</span>
        </div>
    `).join('');

    // Home Remedies
    const remediesList = document.getElementById('remediesList');
    remediesList.innerHTML = data.home_remedies.map(remedy => `
        <li>${remedy}</li>
    `).join('');

    // When to see doctor
    document.getElementById('whenToSeeDoctor').textContent = data.when_to_see_doctor;

    // Sources
    const sourcesList = document.getElementById('skinSourcesList');
    sourcesList.innerHTML = '';
    if (data.sources && data.sources.length > 0) {
        data.sources.forEach(source => {
            const link = document.createElement('a');
            link.href = source;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'source-link';
            const domain = new URL(source).hostname.replace('www.', '');
            link.textContent = domain;
            sourcesList.appendChild(link);
        });
    }

    skinResponseCard.style.display = 'block';

    setTimeout(() => {
        skinResponseCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

console.log('🩺 Skin Analysis feature loaded');
