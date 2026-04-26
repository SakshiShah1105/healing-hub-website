// mood-journal.js
let currentUser = null;
const LOGIN_PAGE_URL = 'login.html';

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async function () {
    const user = await checkUserLogin();
    if (!user) return;

    loadUserName();
    loadAllEntries();
    updateStats();
    generateInsights();
});

// ==================== USER HELPERS ====================
function getCurrentUser() {
    return currentUser;
}

function getCurrentUserEmail() {
    const user = getCurrentUser();
    return user && user.email ? user.email.toLowerCase() : null;
}

function getAllJournalEntries() {
    try {
        const entries = JSON.parse(localStorage.getItem('healingHub_journalEntries') || '[]');
        return Array.isArray(entries) ? entries : [];
    } catch (error) {
        console.error('Error reading journal entries:', error);
        return [];
    }
}

function getUserJournalEntries() {
    const userEmail = getCurrentUserEmail();
    if (!userEmail) return [];

    return getAllJournalEntries().filter(entry =>
        entry.userEmail && entry.userEmail.toLowerCase() === userEmail
    );
}

// ==================== CHECK USER LOGIN ====================
async function checkUserLogin() {
    try {
        const savedUser = getStoredCurrentUser();

        if (savedUser && savedUser.email) {
            currentUser = savedUser;

            const token = safeGetAuthToken();
            if (token) {
                try {
                    const response = await safeGetCurrentUserFromAPI();
                    if (response && response.user) {
                        currentUser = mergeUserData(savedUser, response.user);
                        setStoredCurrentUser(currentUser);
                    }
                } catch (apiError) {
                    console.warn('Background sync failed, continuing with local user:', apiError);
                }
            }

            return currentUser;
        }

        const token = safeGetAuthToken();
        if (token) {
            try {
                const response = await safeGetCurrentUserFromAPI();

                if (response && response.user) {
                    currentUser = normalizeUserObject(response.user);
                    setStoredCurrentUser(currentUser);
                    return currentUser;
                }
            } catch (apiError) {
                console.warn('Backend user fetch failed:', apiError);
            }
        }

        const fallbackUser = getFallbackUserFromUsers();
        if (fallbackUser && fallbackUser.email) {
            currentUser = fallbackUser;
            setStoredCurrentUser(currentUser);
            return currentUser;
        }

        safeClearAuthToken();
        clearStoredCurrentUser();
        window.location.href = LOGIN_PAGE_URL;
        return null;
    } catch (error) {
        console.error('Login error:', error);
        safeClearAuthToken();
        clearStoredCurrentUser();
        window.location.href = LOGIN_PAGE_URL;
        return null;
    }
}

// ==================== SAFE AUTH HELPERS ====================
function safeGetAuthToken() {
    try {
        if (typeof getAuthToken === 'function') {
            return getAuthToken();
        }

        return (
            localStorage.getItem('healingHub_token') ||
            localStorage.getItem('authToken') ||
            localStorage.getItem('token') ||
            ''
        );
    } catch (error) {
        console.warn('Token read error:', error);
        return '';
    }
}

async function safeGetCurrentUserFromAPI() {
    if (typeof getCurrentUserFromAPI === 'function') {
        return await getCurrentUserFromAPI();
    }
    throw new Error('getCurrentUserFromAPI is not available');
}

function safeClearAuthToken() {
    try {
        if (typeof clearAuthToken === 'function') {
            clearAuthToken();
            return;
        }

        localStorage.removeItem('healingHub_token');
        localStorage.removeItem('authToken');
        localStorage.removeItem('token');
    } catch (error) {
        console.warn('Token clear error:', error);
    }
}

function getStoredCurrentUser() {
    try {
        const raw = localStorage.getItem('healingHub_currentUser');
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !parsed.email) return null;

        return normalizeUserObject(parsed);
    } catch (error) {
        console.warn('Stored current user parse error:', error);
        return null;
    }
}

function setStoredCurrentUser(user) {
    try {
        const normalizedUser = normalizeUserObject(user);
        localStorage.setItem('healingHub_currentUser', JSON.stringify(normalizedUser));
        syncCurrentUserIntoUsersList(normalizedUser);
    } catch (error) {
        console.error('Set current user error:', error);
    }
}

function clearStoredCurrentUser() {
    try {
        localStorage.removeItem('healingHub_currentUser');
    } catch (error) {
        console.warn('Clear current user error:', error);
    }
}

function normalizeUserObject(user) {
    return {
        id: user?.id || Date.now(),
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        username: user?.username || '',
        email: user?.email || '',
        age: user?.age || '',
        gender: user?.gender || '',
        country: user?.country || '',
        bio: user?.bio || '',
        profilePicture: user?.profilePicture || '',
        createdAt: user?.createdAt || '',
        updatedAt: user?.updatedAt || '',
        loginTime: user?.loginTime || new Date().toISOString(),
        password: user?.password || ''
    };
}

function mergeUserData(localUser, apiUser) {
    return normalizeUserObject({
        ...localUser,
        ...apiUser,
        loginTime: new Date().toISOString(),
        password: localUser?.password || apiUser?.password || ''
    });
}

function syncCurrentUserIntoUsersList(user) {
    try {
        const users = JSON.parse(localStorage.getItem('healingHub_users') || '[]');
        const safeUsers = Array.isArray(users) ? users : [];

        const index = safeUsers.findIndex(item =>
            (item?.email || '').toLowerCase() === (user?.email || '').toLowerCase()
        );

        if (index >= 0) {
            safeUsers[index] = {
                ...safeUsers[index],
                ...user
            };
        } else {
            safeUsers.push(user);
        }

        localStorage.setItem('healingHub_users', JSON.stringify(safeUsers));
    } catch (error) {
        console.warn('Users list sync error:', error);
    }
}

function getFallbackUserFromUsers() {
    try {
        const users = JSON.parse(localStorage.getItem('healingHub_users') || '[]');
        if (!Array.isArray(users) || !users.length) return null;

        const validUsers = users
            .filter(user => user && user.email)
            .sort((a, b) => {
                const aTime = new Date(a.loginTime || a.updatedAt || a.createdAt || 0).getTime();
                const bTime = new Date(b.loginTime || b.updatedAt || b.createdAt || 0).getTime();
                return bTime - aTime;
            });

        if (!validUsers.length) return null;

        return normalizeUserObject(validUsers[0]);
    } catch (error) {
        console.warn('Fallback user error:', error);
        return null;
    }
}

// ==================== LOAD USER NAME ====================
function loadUserName() {
    const user = getCurrentUser();
    const sidebarName = document.getElementById('sidebar-name');

    if (user && sidebarName) {
        const hour = new Date().getHours();
        let greeting = 'Welcome';

        if (hour < 12) greeting = 'Good morning';
        else if (hour < 18) greeting = 'Good afternoon';
        else greeting = 'Good evening';

        sidebarName.textContent = user.firstName ? `${greeting}, ${user.firstName}` : greeting;
    }
}

// ==================== MOOD SELECTION ====================
function setMood(mood, element) {
    document.querySelectorAll('.mood-btn').forEach(btn => btn.classList.remove('selected'));
    if (element) {
        element.classList.add('selected');
    }
    document.getElementById('selected-mood').value = mood;
}

// ==================== SLIDER UPDATES ====================
function updateIntensityDisplay() {
    const value = document.getElementById('mood-intensity').value;
    document.getElementById('intensity-display').textContent = value;
}

function updateEnergyDisplay() {
    const value = document.getElementById('energy-level').value;
    document.getElementById('energy-display').textContent = value;
}

function updateSleepDisplay() {
    const value = document.getElementById('sleep-quality').value;
    document.getElementById('sleep-display').textContent = value;
}

// ==================== TAG SELECTION ====================
function toggleTag(element, tag) {
    element.classList.toggle('selected');

    const selected = Array.from(document.querySelectorAll('.tag-btn.selected'))
        .map(btn => btn.getAttribute('onclick').match(/'([^']+)'/)[1])
        .join(',');

    document.getElementById('selected-tags').value = selected;
}

// ==================== CHARACTER COUNT ====================
function updateCharCount() {
    const text = document.getElementById('journal-text').value;
    document.getElementById('char-count').textContent = text.length;
}

// ==================== SAVE ENTRY ====================
function saveJournalEntry() {
    const mood = document.getElementById('selected-mood').value;
    const intensity = document.getElementById('mood-intensity').value;
    const energy = document.getElementById('energy-level').value;
    const sleep = document.getElementById('sleep-quality').value;
    const tags = document.getElementById('selected-tags').value;
    const text = document.getElementById('journal-text').value;

    if (!text.trim()) {
        showToastPopup({
            type: 'warning',
            icon: '📝',
            title: 'Empty Entry',
            message: 'Please write something in your journal entry.'
        });
        return;
    }

    const user = getCurrentUser();
    if (!user || !user.email) {
        showPopup({
            type: 'warning',
            icon: '🔒',
            title: 'Session Expired',
            message: 'Please login again to continue journaling.',
            buttons: [
                {
                    text: 'Go to Login',
                    className: 'primary',
                    onClick: function () {
                        hidePopup();
                        window.location.href = 'login.html';
                    }
                }
            ]
        });
        return;
    }

    const entry = {
        id: Date.now(),
        mood: mood,
        intensity: parseInt(intensity, 10),
        energy: parseInt(energy, 10),
        sleep: parseInt(sleep, 10),
        tags: tags ? tags.split(',').filter(Boolean) : [],
        text: text,
        date: new Date().toISOString(),
        userEmail: user.email
    };

    const entries = getAllJournalEntries();
    entries.push(entry);
    localStorage.setItem('healingHub_journalEntries', JSON.stringify(entries));

    clearEntry();
    loadAllEntries();
    updateStats();
    generateInsights();

    showToastPopup({
        type: 'success',
        icon: '🌸',
        title: 'Entry Saved',
        message: 'Your thoughts have been saved successfully.'
    });
}

// ==================== CLEAR ENTRY ====================
function clearEntry() {
    document.getElementById('selected-mood').value = 'neutral';
    document.getElementById('mood-intensity').value = 5;
    document.getElementById('energy-level').value = 5;
    document.getElementById('sleep-quality').value = 5;
    document.getElementById('journal-text').value = '';
    document.getElementById('selected-tags').value = '';
    document.getElementById('char-count').textContent = '0';

    document.querySelectorAll('.mood-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelectorAll('.tag-btn').forEach(btn => btn.classList.remove('selected'));

    updateIntensityDisplay();
    updateEnergyDisplay();
    updateSleepDisplay();
}

// ==================== LOAD ALL ENTRIES ====================
function loadAllEntries() {
    const entries = [...getUserJournalEntries()].sort((a, b) => new Date(b.date) - new Date(a.date));
    const timeline = document.getElementById('entries-timeline');
    const noEntries = document.getElementById('no-entries');

    if (!timeline || !noEntries) return;

    if (entries.length === 0) {
        timeline.style.display = 'none';
        noEntries.style.display = 'block';
        timeline.innerHTML = '';
        return;
    }

    timeline.style.display = 'flex';
    noEntries.style.display = 'none';

    timeline.innerHTML = entries.map(entry => `
        <div class="entry-item">
            <div class="entry-header">
                <div>
                    <span class="entry-mood">${getMoodEmoji(entry.mood)}</span>
                </div>
                <div class="entry-date">${formatDate(entry.date)}</div>
            </div>
            <div class="entry-title">${escapeHtml(getEntryTitle(entry.text))}</div>
            <div class="entry-preview">${escapeHtml(getEntryPreview(entry.text))}</div>
        </div>
    `).join('');
}

// ==================== FILTER & SORT ENTRIES ====================
function filterEntries() {
    const moodFilter = document.getElementById('mood-filter').value;
    const sortFilter = document.getElementById('sort-filter').value;
    const searchTerm = document.getElementById('search-entries').value.toLowerCase();

    let entries = getUserJournalEntries();

    if (moodFilter) {
        entries = entries.filter(e => e.mood === moodFilter);
    }

    if (searchTerm) {
        entries = entries.filter(e => (e.text || '').toLowerCase().includes(searchTerm));
    }

    if (sortFilter === 'oldest') {
        entries = entries.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (sortFilter === 'mood') {
        const moodOrder = { happy: 5, calm: 4, neutral: 3, anxious: 2, sad: 1, angry: 0 };
        entries = entries.sort((a, b) => moodOrder[b.mood] - moodOrder[a.mood]);
    } else {
        entries = entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    const timeline = document.getElementById('entries-timeline');
    const noEntries = document.getElementById('no-entries');

    if (!timeline || !noEntries) return;

    if (entries.length === 0) {
        timeline.style.display = 'none';
        noEntries.style.display = 'block';
        timeline.innerHTML = '';
        return;
    }

    timeline.style.display = 'flex';
    noEntries.style.display = 'none';

    timeline.innerHTML = entries.map(entry => `
        <div class="entry-item">
            <div class="entry-header">
                <div>
                    <span class="entry-mood">${getMoodEmoji(entry.mood)}</span>
                </div>
                <div class="entry-date">${formatDate(entry.date)}</div>
            </div>
            <div class="entry-title">${escapeHtml(getEntryTitle(entry.text))}</div>
            <div class="entry-preview">${escapeHtml(getEntryPreview(entry.text))}</div>
        </div>
    `).join('');
}

// ==================== UPDATE STATS ====================
function updateStats() {
    const entries = getUserJournalEntries();

    document.getElementById('total-entries').textContent = entries.length;
    document.getElementById('current-streak').textContent = calculateStreak(entries);
    document.getElementById('avg-mood').textContent = entries.length > 0 ? calculateAvgMood(entries) : '--';
}

// ==================== GENERATE INSIGHTS ====================
function generateInsights() {
    const entries = getUserJournalEntries();

    const totalWritten = document.getElementById('total-written');
    const avgPerEntry = document.getElementById('avg-per-entry');
    const avgEnergy = document.getElementById('avg-energy');
    const avgSleep = document.getElementById('avg-sleep');
    const moodChart = document.getElementById('mood-chart');
    const moodTrend = document.getElementById('mood-trend');
    const topTags = document.getElementById('top-tags');
    const recommendations = document.getElementById('recommendations');

    if (entries.length === 0) {
        if (totalWritten) totalWritten.textContent = '0';
        if (avgPerEntry) avgPerEntry.textContent = '0';
        if (avgEnergy) avgEnergy.textContent = '0';
        if (avgSleep) avgSleep.textContent = '0';
        if (moodChart) moodChart.innerHTML = '';
        if (moodTrend) moodTrend.innerHTML = '';
        if (topTags) topTags.innerHTML = '<span class="tag-item">No tags yet</span>';
        if (recommendations) recommendations.innerHTML = '<li>Start journaling regularly to unlock insights.</li>';
        return;
    }

    const totalWords = entries.reduce((sum, e) => sum + countWords(e.text), 0);
    const avgWordsPerEntry = Math.round(totalWords / entries.length);
    const avgEnergyValue = Math.round(entries.reduce((sum, e) => sum + e.energy, 0) / entries.length);
    const avgSleepValue = Math.round(entries.reduce((sum, e) => sum + e.sleep, 0) / entries.length);

    if (totalWritten) totalWritten.textContent = totalWords;
    if (avgPerEntry) avgPerEntry.textContent = avgWordsPerEntry;
    if (avgEnergy) avgEnergy.textContent = avgEnergyValue;
    if (avgSleep) avgSleep.textContent = avgSleepValue;

    generateMoodChart(entries);
    generateMoodTrend(entries);
    generateTopTags(entries);
    generateRecommendations(entries);
}

// ==================== HELPER FUNCTIONS ====================
function getMoodEmoji(mood) {
    const moods = {
        happy: '😊',
        calm: '😌',
        neutral: '😐',
        anxious: '😟',
        sad: '😢',
        angry: '😠'
    };
    return moods[mood] || '😐';
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function calculateStreak(entries) {
    if (entries.length === 0) return 0;

    const uniqueDays = [...new Set(
        entries.map(entry => {
            const d = new Date(entry.date);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
        })
    )].sort((a, b) => b - a);

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < uniqueDays.length; i++) {
        const expectedDate = new Date(today);
        expectedDate.setDate(today.getDate() - i);

        if (uniqueDays[i] === expectedDate.getTime()) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}

function calculateAvgMood(entries) {
    const moodValues = { happy: 5, calm: 4, neutral: 3, anxious: 2, sad: 1, angry: 0 };
    const avg = entries.reduce((sum, e) => sum + (moodValues[e.mood] ?? 3), 0) / entries.length;
    return avg.toFixed(1);
}

function generateMoodChart(entries) {
    const moods = { happy: 0, calm: 0, neutral: 0, anxious: 0, sad: 0, angry: 0 };
    entries.forEach(e => {
        if (moods.hasOwnProperty(e.mood)) {
            moods[e.mood]++;
        }
    });

    const chart = document.getElementById('mood-chart');
    if (!chart) return;

    const max = Math.max(...Object.values(moods), 1);

    chart.innerHTML = Object.entries(moods).map(([mood, count]) => `
        <div style="flex: 1; text-align: center;">
            <div class="chart-bar" style="height: ${(count / max) * 150}px;"></div>
            <div style="margin-top: 8px; font-size: 12px;">${getMoodEmoji(mood)}</div>
        </div>
    `).join('');
}

function generateMoodTrend(entries) {
    const last7Days = entries
        .filter(e => {
            const date = new Date(e.date);
            const now = new Date();
            return (now - date) < 7 * 24 * 60 * 60 * 1000;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const moodValues = { happy: 5, calm: 4, neutral: 3, anxious: 2, sad: 1, angry: 0 };
    const trend = last7Days.map(e => moodValues[e.mood] ?? 3);

    const chart = document.getElementById('mood-trend');
    if (!chart) return;

    if (trend.length === 0) {
        chart.innerHTML = '';
        return;
    }

    const max = Math.max(...trend, 5);

    chart.innerHTML = trend.map(val => `
        <div class="chart-bar" style="height: ${(val / max) * 150}px;"></div>
    `).join('');
}

function generateTopTags(entries) {
    const tagCounts = {};

    entries.forEach(e => {
        (e.tags || []).forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });

    const sorted = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const topTagsEl = document.getElementById('top-tags');
    if (!topTagsEl) return;

    if (sorted.length === 0) {
        topTagsEl.innerHTML = '<span class="tag-item">No tags yet</span>';
        return;
    }

    topTagsEl.innerHTML = sorted.map(([tag, count]) => `
        <span class="tag-item">${escapeHtml(tag)} (${count})</span>
    `).join('');
}

function generateRecommendations(entries) {
    const recommendations = [];

    if (entries.some(e => e.mood === 'sad' || e.mood === 'anxious')) {
        recommendations.push('Try breathing exercises when you feel overwhelmed.');
    }
    if (entries.some(e => e.energy < 3)) {
        recommendations.push('Low energy detected. Make sure to get enough rest and exercise.');
    }
    if (entries.some(e => e.sleep < 5)) {
        recommendations.push('Improve sleep quality by maintaining a consistent sleep schedule.');
    }

    if (recommendations.length === 0) {
        recommendations.push('Keep up the great work with your wellness journey!');
        recommendations.push('Remember to journal regularly for better self-awareness.');
    }

    const recommendationsEl = document.getElementById('recommendations');
    if (!recommendationsEl) return;

    recommendationsEl.innerHTML = recommendations
        .map(rec => `<li>${escapeHtml(rec)}</li>`)
        .join('');
}

function getEntryTitle(text) {
    const firstLine = (text || '').split('\n')[0].trim();
    if (!firstLine) return 'Untitled Entry';
    return firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
}

function getEntryPreview(text) {
    const cleanText = (text || '').trim();
    if (!cleanText) return '';
    return cleanText.length > 200 ? cleanText.substring(0, 200) + '...' : cleanText;
}

function countWords(text) {
    return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== TAB SWITCHING ====================
function switchJournalTab(index) {
    document.querySelectorAll('.journal-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const selectedTab = document.getElementById(`journal-tab-${index}`);
    const selectedBtn = document.querySelectorAll('.tab-btn')[index];

    if (selectedTab) selectedTab.classList.add('active');
    if (selectedBtn) selectedBtn.classList.add('active');

    if (index === 1) {
        loadAllEntries();
    } else if (index === 2) {
        generateInsights();
    }
}

// ==================== CRISIS MODAL ====================
function closeCrisisModal() {
    document.getElementById('crisis-modal').classList.add('hidden');
}

function closeAnalysis() {
    document.getElementById('ai-analysis').classList.add('hidden');
}

// ==================== LOGOUT ====================
function handleLogout() {
    showConfirmPopup({
        type: 'warning',
        icon: '👋',
        title: 'Leave Mood Journal?',
        message: 'Your saved entries will remain safe and ready for you later.',
        confirmText: 'Logout',
        cancelText: 'Stay',
        onConfirm: async function () {
            try {
                if (typeof logoutUser === 'function') {
                    await logoutUser();
                }
            } catch (error) {
                console.error('Logout error:', error);
            } finally {
                safeClearAuthToken();
                clearStoredCurrentUser();
                window.location.href = LOGIN_PAGE_URL;
            }
        }
    });
}