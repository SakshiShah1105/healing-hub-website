let currentUser = null;
const LOGIN_PAGE_URL = 'login.html';
const BACKEND_BASE_URL = 'http://localhost:5000';

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async function () {
    const user = await checkUserLogin();
    if (!user) return;

    loadUserProfile();
    setupEventListeners();
    loadPasswordChangedDate();
    refreshProfile();
});

// ==================== USER HELPERS ====================
function getCurrentUser() {
    return currentUser;
}

// ==================== CHECK USER LOGIN ====================
async function checkUserLogin() {
    try {
        const savedUser = getStoredCurrentUser();

        if (savedUser && savedUser.email) {
            currentUser = enrichUserFromUsersList(savedUser);

            const token = safeGetAuthToken();
            if (token) {
                try {
                    const response = await safeGetCurrentUserFromAPI();
                    if (response && response.user) {
                        currentUser = mergeUserData(currentUser, response.user);
                        currentUser = enrichUserFromUsersList(currentUser);
                        setStoredCurrentUser(currentUser);
                    }
                } catch (apiError) {
                    console.warn('Profile background sync failed, continuing with local user:', apiError);
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
                    currentUser = enrichUserFromUsersList(currentUser);
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
        console.error('Error checking login:', error);
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
            localStorage.getItem('healingHub_authToken') ||
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
        localStorage.removeItem('healingHub_authToken');
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
        age: user?.age ?? '',
        gender: user?.gender ?? '',
        country: user?.country ?? '',
        bio: user?.bio ?? '',
        profilePicture: user?.profilePicture || '',
        createdAt: user?.createdAt || '',
        updatedAt: user?.updatedAt || '',
        loginTime: user?.loginTime || new Date().toISOString(),
        password: user?.password || '',
        name: user?.name || ''
    };
}

function mergeUserData(localUser, apiUser) {
    const safeLocal = normalizeUserObject(localUser || {});
    const safeApi = normalizeUserObject(apiUser || {});

    return normalizeUserObject({
        ...safeLocal,
        ...safeApi,
        age: safeApi.age !== null && safeApi.age !== undefined && safeApi.age !== ''
            ? safeApi.age
            : safeLocal.age,
        gender: safeApi.gender !== null && safeApi.gender !== undefined && safeApi.gender !== ''
            ? safeApi.gender
            : safeLocal.gender,
        country: safeApi.country !== null && safeApi.country !== undefined && safeApi.country !== ''
            ? safeApi.country
            : safeLocal.country,
        bio: safeApi.bio !== null && safeApi.bio !== undefined && safeApi.bio !== ''
            ? safeApi.bio
            : safeLocal.bio,
        profilePicture: safeApi.profilePicture !== null && safeApi.profilePicture !== undefined && safeApi.profilePicture !== ''
            ? safeApi.profilePicture
            : safeLocal.profilePicture,
        createdAt: safeApi.createdAt || safeLocal.createdAt,
        updatedAt: safeApi.updatedAt || safeLocal.updatedAt,
        loginTime: new Date().toISOString(),
        password: safeLocal.password || safeApi.password || '',
        name: safeApi.name || safeLocal.name || `${safeApi.firstName || safeLocal.firstName || ''} ${safeApi.lastName || safeLocal.lastName || ''}`.trim()
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

function getUserFromUsersListByEmail(email) {
    try {
        if (!email) return null;

        const users = JSON.parse(localStorage.getItem('healingHub_users') || '[]');
        if (!Array.isArray(users)) return null;

        const matchedUser = users.find(user =>
            (user?.email || '').toLowerCase() === String(email).toLowerCase()
        );

        return matchedUser ? normalizeUserObject(matchedUser) : null;
    } catch (error) {
        console.warn('Users list fetch by email error:', error);
        return null;
    }
}

function enrichUserFromUsersList(user) {
    const normalizedUser = normalizeUserObject(user);
    const matchedUser = getUserFromUsersListByEmail(normalizedUser.email);

    if (!matchedUser) {
        return normalizedUser;
    }

    return mergeUserData(matchedUser, normalizedUser);
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

function resolveProfileImage(profilePicture) {
    if (!profilePicture) {
        return 'https://via.placeholder.com/150';
    }

    if (profilePicture.startsWith('http://') || profilePicture.startsWith('https://')) {
        return profilePicture;
    }

    if (profilePicture.startsWith('/uploads/')) {
        return `${BACKEND_BASE_URL}${profilePicture}`;
    }

    return profilePicture;
}

// ==================== LOAD USER PROFILE ====================
function loadUserProfile() {
    try {
        const user = enrichUserFromUsersList(getCurrentUser());
        if (!user) return;

        currentUser = user;
        setStoredCurrentUser(currentUser);

        const fullname = `${user.firstName || ''} ${user.lastName || ''}`.trim();

        setText('display-fullname', fullname || user.name || 'User');
        setText('display-username', user.username ? `@${user.username}` : '@user');
        setText('display-bio', user.bio || 'No bio added yet.');
        setText('display-country', user.country || '-');
        setText('display-age', user.age || '-');
        setText('display-gender', user.gender || '-');

        const profilePic = document.getElementById('profile-pic-display');
        if (profilePic) {
            profilePic.src = resolveProfileImage(user.profilePicture);
        }

        setText('detail-first-name', user.firstName || '-');
        setText('detail-last-name', user.lastName || '-');
        setText('detail-email', user.email || '-');
        setText('detail-username', user.username || '-');
        setText('detail-age', user.age || '-');
        setText('detail-gender', user.gender || '-');
        setText('detail-country', user.country || '-');
        setText('full-bio', user.bio || 'No bio added yet.');

        const memberDate = user.createdAt || user.loginTime;
        if (memberDate) {
            const parsedDate = new Date(memberDate);
            setText(
                'detail-member-since',
                isNaN(parsedDate.getTime()) ? '-' : parsedDate.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                })
            );
        } else {
            setText('detail-member-since', '-');
        }

        setText('setting-email-value', user.email || '-');
        setText('setting-username-value', user.username || '-');

        loadStats();
        loadDetailedActivity();
    } catch (error) {
        console.error('Error loading profile:', error);
        showToastMessage('Could not load your profile properly.', 'error');
    }
}

// ==================== DATA HELPERS ====================
function getUserEmailLower() {
    const user = getCurrentUser();
    return (user?.email || '').toLowerCase();
}

function getJournalEntriesForCurrentUser() {
    try {
        const userEmail = getUserEmailLower();
        const entries = JSON.parse(localStorage.getItem('healingHub_journalEntries') || '[]');
        if (!Array.isArray(entries)) return [];
        return entries.filter(entry => (entry?.userEmail || '').toLowerCase() === userEmail);
    } catch (error) {
        console.warn('Journal read error:', error);
        return [];
    }
}

function getHabitsForCurrentUser() {
    try {
        const userEmail = getUserEmailLower();

        let habits = JSON.parse(localStorage.getItem('healingHub_habits') || '[]');
        if (!Array.isArray(habits) || habits.length === 0) {
            habits = JSON.parse(localStorage.getItem('habits') || '[]');
        }

        if (!Array.isArray(habits)) return [];

        return habits.filter(habit => {
            if (!habit) return false;
            const habitUserEmail = (habit.userEmail || habit.email || '').toLowerCase();
            return habitUserEmail === userEmail;
        });
    } catch (error) {
        console.warn('Habits read error:', error);
        return [];
    }
}

function getQuizHistoryForCurrentUser() {
    try {
        const userEmail = getUserEmailLower();
        const quizHistory = JSON.parse(localStorage.getItem('vibeCheckHistory') || '[]');
        if (!Array.isArray(quizHistory)) return [];
        return quizHistory.filter(item => (item?.userEmail || '').toLowerCase() === userEmail);
    } catch (error) {
        console.warn('Quiz history read error:', error);
        return [];
    }
}

function getActivityDate(item) {
    return (
        item?.date ||
        item?.createdAt ||
        item?.updatedAt ||
        item?.completedAt ||
        item?.lastCompletedAt ||
        item?.timestamp ||
        item?.takenAt ||
        null
    );
}

function formatDisplayDate(dateValue) {
    if (!dateValue) return '-';
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '-';

    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text = '') {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getMoodLabel(entry) {
    return entry?.mood ? String(entry.mood) : 'Unknown';
}

function getQuizLabel(item) {
    return (
        item?.result ||
        item?.mood ||
        item?.title ||
        item?.quizType ||
        item?.category ||
        'Quiz Completed'
    );
}

function getQuizScoreText(item) {
    if (item?.score !== undefined && item?.score !== null && item?.score !== '') {
        return `Score: ${item.score}`;
    }
    if (item?.percentage !== undefined && item?.percentage !== null && item?.percentage !== '') {
        return `Percentage: ${item.percentage}%`;
    }
    if (item?.totalScore !== undefined && item?.totalScore !== null && item?.totalScore !== '') {
        return `Score: ${item.totalScore}`;
    }
    return 'Score not available';
}

// ==================== LOAD STATS ====================
function loadStats() {
    try {
        const user = getCurrentUser();
        if (!user || !user.email) return;

        const userJournalEntries = getJournalEntriesForCurrentUser();
        const userHabits = getHabitsForCurrentUser();
        const userQuizHistory = getQuizHistoryForCurrentUser();

        const activeHabits = userHabits.filter(habit => habit.active !== false);

        setText('entries-count', userJournalEntries.length);
        setText('habits-count', activeHabits.length);
        setText(
            'points-count',
            (userJournalEntries.length * 10) + (userHabits.length * 5) + (userQuizHistory.length * 15)
        );
        setText('quizzes-count', userQuizHistory.length);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ==================== DETAILED ACTIVITY ====================
function loadDetailedActivity() {
    try {
        const journalEntries = getJournalEntriesForCurrentUser()
            .sort((a, b) => new Date(getActivityDate(b) || 0) - new Date(getActivityDate(a) || 0));

        const habits = getHabitsForCurrentUser()
            .sort((a, b) => new Date(getActivityDate(b) || 0) - new Date(getActivityDate(a) || 0));

        const quizHistory = getQuizHistoryForCurrentUser()
            .sort((a, b) => new Date(getActivityDate(b) || 0) - new Date(getActivityDate(a) || 0));

        renderActivitySummary(journalEntries, habits, quizHistory);
        renderRecentTimeline(journalEntries, habits, quizHistory);
        renderJournalActivity(journalEntries);
        renderHabitActivity(habits);
        renderQuizActivity(quizHistory);
    } catch (error) {
        console.error('Detailed activity load error:', error);
    }
}

function renderActivitySummary(journalEntries, habits, quizHistory) {
    const totalHabitCompletions = habits.reduce((sum, habit) => sum + Number(habit?.totalCompletions || 0), 0);
    const bestStreak = habits.reduce((max, habit) => Math.max(max, Number(habit?.streak || 0)), 0);
    const totalActivities = journalEntries.length + habits.length + quizHistory.length;

    const latestDates = []
        .concat(journalEntries.map(getActivityDate))
        .concat(habits.map(getActivityDate))
        .concat(quizHistory.map(getActivityDate))
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a));

    setText('activity-total-count', totalActivities);
    setText('activity-total-habit-completions', totalHabitCompletions);
    setText('activity-best-streak', bestStreak);
    setText('activity-latest-date', latestDates.length ? formatDisplayDate(latestDates[0]) : '-');
}

function renderRecentTimeline(journalEntries, habits, quizHistory) {
    const container = document.getElementById('recent-activity-list');
    if (!container) return;

    const combined = [];

    journalEntries.forEach(entry => {
        combined.push({
            type: 'Journal',
            title: `${capitalize(getMoodLabel(entry))} journal entry`,
            subtitle: `${entry?.text ? truncateText(entry.text, 120) : 'Journal entry added.'}`,
            date: getActivityDate(entry)
        });
    });

    habits.forEach(habit => {
        combined.push({
            type: 'Habit',
            title: habit?.name || 'Habit',
            subtitle: `Category: ${capitalize(habit?.category || 'general')} • Streak: ${Number(habit?.streak || 0)} • Total completions: ${Number(habit?.totalCompletions || 0)} • ${habit?.completedToday ? 'Completed today' : 'Pending today'}`,
            date: getActivityDate(habit)
        });
    });

    quizHistory.forEach(item => {
        combined.push({
            type: 'Quiz',
            title: getQuizLabel(item),
            subtitle: getQuizScoreText(item),
            date: getActivityDate(item)
        });
    });

    combined.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    if (!combined.length) {
        container.innerHTML = '<p>No recent activity found.</p>';
        return;
    }

    container.innerHTML = combined.slice(0, 10).map(item => `
        <div class="detail-item" style="margin-bottom: 16px;">
            <label>${escapeHtml(item.type)}</label>
            <p style="font-weight: 700; margin-bottom: 6px;">${escapeHtml(item.title)}</p>
            <p style="margin-bottom: 6px; line-height: 1.6;">${escapeHtml(item.subtitle)}</p>
            <p style="font-size: 13px; opacity: 0.8;">${escapeHtml(formatDisplayDate(item.date))}</p>
        </div>
    `).join('');
}

function renderJournalActivity(journalEntries) {
    const container = document.getElementById('journal-activity-list');
    if (!container) return;

    if (!journalEntries.length) {
        container.innerHTML = '<p>No journal entries found.</p>';
        return;
    }

    container.innerHTML = journalEntries.map(entry => `
        <div class="detail-item" style="margin-bottom: 16px;">
            <label>Journal Entry</label>
            <p style="font-weight: 700; margin-bottom: 6px;">Mood: ${escapeHtml(capitalize(getMoodLabel(entry)))}</p>
            <p style="margin-bottom: 6px;">Intensity: ${escapeHtml(String(entry?.intensity ?? '-'))} • Energy: ${escapeHtml(String(entry?.energy ?? '-'))} • Sleep: ${escapeHtml(String(entry?.sleep ?? '-'))}</p>
            <p style="margin-bottom: 6px; line-height: 1.6;">${escapeHtml(entry?.text || 'No journal text available.')}</p>
            <p style="font-size: 13px; opacity: 0.8;">${escapeHtml(formatDisplayDate(getActivityDate(entry)))}</p>
        </div>
    `).join('');
}

function renderHabitActivity(habits) {
    const container = document.getElementById('habit-activity-list');
    if (!container) return;

    if (!habits.length) {
        container.innerHTML = '<p>No habit activity found.</p>';
        return;
    }

    container.innerHTML = habits.map(habit => `
        <div class="detail-item" style="margin-bottom: 16px;">
            <label>Habit</label>
            <p style="font-weight: 700; margin-bottom: 6px;">${escapeHtml(habit?.name || 'Untitled Habit')}</p>
            <p style="margin-bottom: 6px;">Category: ${escapeHtml(capitalize(habit?.category || 'general'))} • Frequency: ${escapeHtml(capitalize(habit?.frequency || 'daily'))} • Duration: ${escapeHtml(String(habit?.duration || 0))} min</p>
            <p style="margin-bottom: 6px;">Difficulty: ${escapeHtml(capitalize(habit?.difficulty || 'easy'))} • Streak: ${escapeHtml(String(habit?.streak || 0))} • Total Completions: ${escapeHtml(String(habit?.totalCompletions || 0))}</p>
            <p style="margin-bottom: 6px;">Status: ${habit?.completedToday ? 'Completed today' : 'Pending today'}</p>
            <p style="margin-bottom: 6px;">Reminder: ${habit?.reminder?.enabled ? `${escapeHtml(habit?.reminder?.time || 'On')} - ${escapeHtml(habit?.reminder?.message || 'Enabled')}` : 'Disabled'}</p>
            <p style="font-size: 13px; opacity: 0.8;">${escapeHtml(formatDisplayDate(getActivityDate(habit)))}</p>
        </div>
    `).join('');
}

function renderQuizActivity(quizHistory) {
    const container = document.getElementById('quiz-activity-list');
    if (!container) return;

    if (!quizHistory.length) {
        container.innerHTML = '<p>No quiz activity found.</p>';
        return;
    }

    container.innerHTML = quizHistory.map(item => `
        <div class="detail-item" style="margin-bottom: 16px;">
            <label>Quiz</label>
            <p style="font-weight: 700; margin-bottom: 6px;">${escapeHtml(getQuizLabel(item))}</p>
            <p style="margin-bottom: 6px;">${escapeHtml(getQuizScoreText(item))}</p>
            <p style="margin-bottom: 6px;">${escapeHtml(item?.description || item?.summary || item?.status || 'Quiz completed successfully.')}</p>
            <p style="font-size: 13px; opacity: 0.8;">${escapeHtml(formatDisplayDate(getActivityDate(item)))}</p>
        </div>
    `).join('');
}

// ==================== SETUP EVENT LISTENERS ====================
function setupEventListeners() {
    const bioInput = document.getElementById('edit-bio');
    if (bioInput) {
        bioInput.addEventListener('input', function () {
            setText('bio-char-count', `${this.value.length}/200`);
        });
    }

    const editForm = document.getElementById('edit-form');
    if (editForm) {
        editForm.addEventListener('submit', handleEditSubmit);
    }

    const picInput = document.getElementById('pic-upload-input');
    if (picInput) {
        picInput.addEventListener('change', handlePictureUpload);
    }

    const passwordForm = document.getElementById('change-password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', handleChangePassword);
    }

    const passwordOverlay = document.getElementById('password-modal-overlay');
    if (passwordOverlay) {
        passwordOverlay.addEventListener('click', function (event) {
            if (event.target === passwordOverlay) {
                closeChangePasswordModal();
            }
        });
    }
}

// ==================== TAB SWITCHING ====================
function switchTab(tabIndex) {
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const selectedPane = document.getElementById(`tab-${tabIndex}`);
    const selectedButton = document.querySelectorAll('.tab-btn')[tabIndex];

    if (selectedPane) {
        selectedPane.classList.add('active');
    }

    if (selectedButton) {
        selectedButton.classList.add('active');
    }
}

// ==================== UPLOAD PROFILE PICTURE ====================
function uploadProfilePicture() {
    const input = document.getElementById('pic-upload-input');
    if (input) {
        input.click();
    }
}

async function handlePictureUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showToastMessage('Profile picture must be less than 5MB.', 'error');
        return;
    }

    if (!file.type.startsWith('image/')) {
        showToastMessage('Please upload a valid image file.', 'error');
        return;
    }

    try {
        const previewUrl = await fileToDataURL(file);

        let updatedUser = {
            ...currentUser,
            profilePicture: previewUrl,
            updatedAt: new Date().toISOString()
        };

        const token = safeGetAuthToken();

        if (token && typeof apiRequest === 'function') {
            try {
                const formData = new FormData();
                formData.append('profilePicture', file);

                const response = await apiRequest('/users/profile-picture', {
                    method: 'PUT',
                    body: formData,
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                if (response && response.user) {
                    updatedUser = mergeUserData(updatedUser, response.user);
                }
            } catch (apiError) {
                console.warn('Backend profile picture update failed, saved locally:', apiError);
            }
        }

        currentUser = normalizeUserObject(updatedUser);
        setStoredCurrentUser(currentUser);

        const profilePic = document.getElementById('profile-pic-display');
        if (profilePic) {
            profilePic.src = resolveProfileImage(currentUser.profilePicture);
        }

        loadUserProfile();
        refreshProfile();
        showToastMessage('Your profile picture has been updated.', 'success');
    } catch (error) {
        console.error('Profile picture update failed:', error);
        showToastMessage(error.message || 'Could not update your profile picture.', 'error');
    }
}

// ==================== EDIT PROFILE ====================
function toggleEditMode() {
    try {
        const user = getCurrentUser();
        if (!user) return;

        setValue('edit-first-name', user.firstName || '');
        setValue('edit-last-name', user.lastName || '');
        setValue('edit-username', user.username || '');
        setValue('edit-bio', user.bio || '');
        setValue('edit-age', user.age || '');
        setValue('edit-gender', user.gender || '');
        setValue('edit-country', user.country || '');

        const bioValue = document.getElementById('edit-bio')?.value || '';
        setText('bio-char-count', `${bioValue.length}/200`);

        openModal();
    } catch (error) {
        console.error('Error opening edit mode:', error);
        showToastMessage('The edit form could not be opened right now.', 'error');
    }
}

async function handleEditSubmit(event) {
    event.preventDefault();

    const firstName = (document.getElementById('edit-first-name')?.value || '').trim();
    const lastName = (document.getElementById('edit-last-name')?.value || '').trim();
    const username = (document.getElementById('edit-username')?.value || '').trim();
    const bio = (document.getElementById('edit-bio')?.value || '').trim();
    const age = (document.getElementById('edit-age')?.value || '').trim();
    const gender = (document.getElementById('edit-gender')?.value || '').trim();
    const country = (document.getElementById('edit-country')?.value || '').trim();

    if (!firstName || !lastName || !username || !age || !gender || !country) {
        showToastMessage('Please fill all required profile fields.', 'error');
        return;
    }

    try {
        let updatedUser = {
            ...currentUser,
            firstName,
            lastName,
            username,
            bio,
            age,
            gender,
            country,
            updatedAt: new Date().toISOString()
        };

        const token = safeGetAuthToken();

        if (token && typeof apiRequest === 'function') {
            try {
                const response = await apiRequest('/users/profile', {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`
                    },
                    body: {
                        firstName,
                        lastName,
                        username,
                        bio,
                        age,
                        gender,
                        country
                    }
                });

                if (response && response.user) {
                    updatedUser = mergeUserData(updatedUser, response.user);
                }
            } catch (apiError) {
                console.warn('Backend profile update failed, saved locally:', apiError);
            }
        }

        currentUser = normalizeUserObject(updatedUser);
        currentUser = enrichUserFromUsersList(currentUser);
        setStoredCurrentUser(currentUser);

        loadUserProfile();
        refreshProfile();
        closeModal();

        showToastMessage('Your profile changes were saved successfully.', 'success');
    } catch (error) {
        console.error('Error updating profile:', error);
        showToastMessage(error.message || 'Something went wrong while updating your profile.', 'error');
    }
}

// ==================== MODAL FUNCTIONS ====================
function openModal() {
    const modal = document.getElementById('edit-modal');
    const overlay = document.getElementById('modal-overlay');

    if (modal) modal.style.display = 'block';
    if (overlay) overlay.style.display = 'block';
}

function closeModal() {
    const modal = document.getElementById('edit-modal');
    const overlay = document.getElementById('modal-overlay');

    if (modal) modal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
}

// ==================== CHANGE PASSWORD ====================
function openChangePasswordModal() {
    const modal = document.getElementById('password-modal-overlay');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeChangePasswordModal() {
    const modal = document.getElementById('password-modal-overlay');
    const form = document.getElementById('change-password-form');

    if (modal) {
        modal.classList.remove('active');
    }

    if (form) {
        form.reset();
    }

    resetPasswordEyes();
}

function toggleProfilePassword(event, inputId) {
    event.preventDefault();

    const input = document.getElementById(inputId);
    const button = event.currentTarget || event.target.closest('.toggle-password');

    if (!input || !button) return;

    const icon = button.querySelector('i');

    if (input.type === 'password') {
        input.type = 'text';
        if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    } else {
        input.type = 'password';
        if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
}

function resetPasswordEyes() {
    ['current-password', 'new-profile-password', 'confirm-profile-password'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.type = 'password';
        }
    });

    document.querySelectorAll('#password-modal-overlay .toggle-password i').forEach(icon => {
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    });
}

async function handleChangePassword(event) {
    event.preventDefault();

    const currentPassword = document.getElementById('current-password')?.value || '';
    const newPassword = document.getElementById('new-profile-password')?.value || '';
    const confirmPassword = document.getElementById('confirm-profile-password')?.value || '';

    if (!currentPassword || !newPassword || !confirmPassword) {
        showToastMessage('Please fill all password fields.', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showToastMessage('New password must be at least 6 characters long.', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showToastMessage('New password and confirm password do not match.', 'error');
        return;
    }

    if (newPassword === currentPassword) {
        showToastMessage('New password must be different from current password.', 'error');
        return;
    }

    try {
        let updatedUser = {
            ...currentUser,
            password: newPassword,
            updatedAt: new Date().toISOString()
        };

        const token = safeGetAuthToken();

        if (token && typeof apiRequest === 'function') {
            try {
                const response = await apiRequest('/users/change-password', {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`
                    },
                    body: {
                        currentPassword,
                        newPassword
                    }
                });

                if (response?.user) {
                    updatedUser = mergeUserData(updatedUser, response.user);
                }

                updatePasswordChangedText(response?.changedAt || updatedUser?.updatedAt || new Date().toISOString());
            } catch (apiError) {
                console.warn('Backend password update failed, saved locally:', apiError);

                if ((currentUser?.password || '') && currentUser.password !== currentPassword) {
                    showToastMessage('Current password is incorrect.', 'error');
                    return;
                }

                updatePasswordChangedText(updatedUser.updatedAt);
            }
        } else {
            if ((currentUser?.password || '') && currentUser.password !== currentPassword) {
                showToastMessage('Current password is incorrect.', 'error');
                return;
            }

            updatePasswordChangedText(updatedUser.updatedAt);
        }

        currentUser = normalizeUserObject(updatedUser);
        setStoredCurrentUser(currentUser);

        closeChangePasswordModal();
        showToastMessage('Password changed successfully.', 'success');
    } catch (error) {
        showToastMessage(error.message || 'Something went wrong. Please try again.', 'error');
    }
}

function loadPasswordChangedDate() {
    try {
        const user = getCurrentUser();
        if (user && user.updatedAt) {
            updatePasswordChangedText(user.updatedAt);
        } else {
            updatePasswordChangedText(null);
        }
    } catch (error) {
        updatePasswordChangedText(null);
    }
}

function updatePasswordChangedText(dateString) {
    const text = document.getElementById('pass-changed');
    if (!text) return;

    if (!dateString) {
        text.textContent = 'Never';
        return;
    }

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
        text.textContent = 'Never';
        return;
    }

    text.textContent = date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

// ==================== HELPERS ====================
function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.value = value;
    }
}

function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function (e) {
            resolve(e.target.result);
        };

        reader.onerror = function () {
            reject(new Error('Could not read the selected image file.'));
        };

        reader.readAsDataURL(file);
    });
}

function showToastMessage(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) {
        alert(message);
        return;
    }

    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

function capitalize(text = '') {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function truncateText(text = '', length = 100) {
    const value = String(text || '');
    if (value.length <= length) return value;
    return `${value.slice(0, length)}...`;
}

// ==================== LOGOUT ====================
function handleLogout() {
    showConfirmPopup({
        type: 'warning',
        icon: '👋',
        title: 'Logout from Healing Hub?',
        message: 'You can come back anytime and continue your wellness journey.',
        confirmText: 'Logout',
        cancelText: 'Stay Here',
        onConfirm: async function () {
            try {
                if (typeof logoutUser === 'function') {
                    try {
                        await logoutUser();
                    } catch (error) {
                        console.error('Logout error:', error);
                    }
                }
            } finally {
                safeClearAuthToken();
                clearStoredCurrentUser();
                window.location.href = LOGIN_PAGE_URL;
            }
        }
    });
}

function refreshProfile() {
    const user = getCurrentUser();
    if (!user) return;

    const fullNameElement = document.querySelector('.profile-info-main h1');
    const usernameElement = document.querySelector('.username');
    const bioElement = document.querySelector('.bio');

    if (fullNameElement) {
        fullNameElement.textContent = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
    }

    if (usernameElement) {
        usernameElement.textContent = user.username ? `@${user.username}` : '@user';
    }

    if (bioElement) {
        bioElement.textContent = user.bio || 'No bio yet';
    }

    const profilePic = document.getElementById('profile-pic-display');
    if (profilePic) {
        profilePic.src = resolveProfileImage(user.profilePicture);
    }

    loadDetailedActivity();
}