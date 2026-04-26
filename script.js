let currentUser = null;

const LOGIN_PAGE_URL = "login.html";
const JOURNAL_STORAGE_KEY = "healingHub_journalEntries";
const HABITS_STORAGE_KEYS = ["healingHub_habits", "habits"];

document.addEventListener("DOMContentLoaded", async () => {
    if (typeof loadDarkMode === "function") {
        loadDarkMode();
    }

    const user = await checkUserLogin();

    if (!user) {
        console.warn("No valid user found.");
        return;
    }

    applyUserToDashboard(user);
    await updateDashboardData();
    initializeNotificationBadge();
    initializeDashboardSearch();
});

async function checkUserLogin() {
    try {
        let resolvedUser = null;

        if (typeof getCurrentUserFromAPI === "function") {
            const result = await getCurrentUserFromAPI();
            if (result && result.user && result.user.email) {
                resolvedUser = normalizeUserObject(result.user);
            }
        }

        if (!resolvedUser && typeof getStoredCurrentUser === "function") {
            const storedUser = getStoredCurrentUser();
            if (storedUser && storedUser.email) {
                resolvedUser = normalizeUserObject(storedUser);
            }
        }

        if (!resolvedUser) {
            try {
                const raw =
                    localStorage.getItem("healingHub_currentUser") ||
                    localStorage.getItem("currentUser");

                const parsed = raw ? JSON.parse(raw) : null;

                if (parsed && parsed.email) {
                    resolvedUser = normalizeUserObject(parsed);
                }
            } catch (parseError) {
                console.error("User parse error:", parseError);
            }
        }

        if (resolvedUser && resolvedUser.email) {
            currentUser = resolvedUser;

            if (typeof setStoredCurrentUser === "function") {
                setStoredCurrentUser(resolvedUser);
            } else {
                const value = JSON.stringify(resolvedUser);
                localStorage.setItem("healingHub_currentUser", value);
                localStorage.setItem("currentUser", value);
            }

            sessionStorage.removeItem("healingHub_justSignedUp");
            return resolvedUser;
        }

        window.location.href = LOGIN_PAGE_URL;
        return null;
    } catch (error) {
        console.error("Login error:", error);
        window.location.href = LOGIN_PAGE_URL;
        return null;
    }
}

function normalizeUserObject(user) {
    return {
        id: user?.id || "",
        firstName: user?.firstName || "",
        lastName: user?.lastName || "",
        username: user?.username || "",
        email: user?.email || "",
        profilePicture: user?.profilePicture || ""
    };
}

function getCurrentUserId() {
    if (!currentUser) return "guest";
    return currentUser.id || currentUser.email || "guest";
}

function getCurrentUserEmail() {
    if (!currentUser || !currentUser.email) return "";
    return String(currentUser.email).trim().toLowerCase();
}

function getApiBase() {
    if (typeof API_CONFIG !== "undefined") {
        return API_CONFIG.BASE_URL || API_CONFIG.API_BASE_URL || "http://localhost:5000/api";
    }
    return "http://localhost:5000/api";
}

function getSafeToken() {
    try {
        const token =
            typeof getAuthToken === "function"
                ? getAuthToken()
                : (
                    localStorage.getItem("healingHub_authToken") ||
                    localStorage.getItem("healingHub_token") ||
                    localStorage.getItem("authToken") ||
                    localStorage.getItem("token") ||
                    ""
                );

        if (!token) return "";

        const cleaned = String(token).trim();

        if (
            !cleaned ||
            cleaned === "undefined" ||
            cleaned === "null" ||
            cleaned === "[object Object]"
        ) {
            return "";
        }

        const parts = cleaned.split(".");
        if (parts.length !== 3) {
            return "";
        }

        return cleaned;
    } catch (error) {
        console.warn("Token read error:", error);
        return "";
    }
}

function applyUserToDashboard(user) {
    const name = document.getElementById("userName");
    const avatar = document.getElementById("profile-avatar");
    const navbar = document.getElementById("navbarTitle");

    if (name) {
        name.textContent = user.firstName || user.username || "User";
    }

    if (avatar) {
        avatar.src = user.profilePicture || "https://via.placeholder.com/40";
    }

    if (navbar) {
        navbar.textContent = "Welcome " + (user.firstName || user.username || "User");
    }
}

async function updateDashboardData() {
    try {
        const journalEntries = getCurrentUserJournalEntries();
        const habits = await getDashboardHabits();

        updateMoodEntriesCard(journalEntries);
        updateStreakCard(journalEntries);
        updatePointsCard(journalEntries, habits);
        updateHabitsCard(habits);
        updateDashboardReminders(habits);
        updateRecentActivity(journalEntries, habits);
    } catch (error) {
        console.error("Dashboard data error:", error);
    }
}

function getCurrentUserJournalEntries() {
    try {
        const user =
            currentUser ||
            (typeof getStoredCurrentUser === "function"
                ? getStoredCurrentUser()
                : JSON.parse(localStorage.getItem("healingHub_currentUser") || "null"));

        if (!user || !user.email) return [];

        const userEmail = String(user.email).trim().toLowerCase();
        const raw = localStorage.getItem(JOURNAL_STORAGE_KEY) || "[]";
        const allEntries = JSON.parse(raw);

        if (!Array.isArray(allEntries)) return [];

        return allEntries
            .filter(entry => {
                const entryEmail = String(entry?.userEmail || "").trim().toLowerCase();
                return entryEmail && entryEmail === userEmail;
            })
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    } catch (error) {
        console.error("Journal read error:", error);
        return [];
    }
}

async function getDashboardHabits() {
    try {
        const token = getSafeToken();
        const headers = {};

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(
            `${getApiBase()}/habits/user/${encodeURIComponent(getCurrentUserId())}`,
            {
                method: "GET",
                credentials: "include",
                headers
            }
        );

        if (!response.ok) {
            throw new Error("Failed to load habits");
        }

        const data = await response.json();
        return Array.isArray(data.habits) ? data.habits : [];
    } catch (error) {
        console.warn("Using local habits fallback:", error);

        for (const key of HABITS_STORAGE_KEYS) {
            try {
                const localHabits = JSON.parse(localStorage.getItem(key) || "[]");
                if (Array.isArray(localHabits)) {
                    return localHabits;
                }
            } catch (fallbackError) {
                console.warn(`Habit fallback failed for ${key}:`, fallbackError);
            }
        }

        return [];
    }
}

function updateMoodEntriesCard(entries) {
    const moodCount = document.getElementById("moodCount");
    const moodChart = document.getElementById("moodChart");

    if (moodCount) {
        moodCount.textContent = entries.length;
    }

    if (!moodChart) return;

    moodChart.innerHTML = "";
    moodChart.style.display = "none";
}

function updateStreakCard(entries) {
    const streakCount = document.getElementById("streakCount");
    const streakCircle = document.getElementById("streakCircle");

    const streak = calculateStreak(entries);

    if (streakCount) {
        streakCount.textContent = streak;
    }

    if (streakCircle) {
        const circumference = 251.2;
        const safeProgressDays = Math.min(streak, 7);
        const progress = safeProgressDays / 7;
        const offset = circumference - (circumference * progress);

        streakCircle.style.strokeDasharray = `${circumference}`;
        streakCircle.style.strokeDashoffset = `${offset}`;
    }
}

function updatePointsCard(entries, habits) {
    const pointsCount = document.getElementById("pointsCount");
    const pointsProgress = document.getElementById("pointsProgress");

    const points = (entries.length * 10) + (getActiveHabits(habits).length * 5);
    const progress = Math.min((points % 100), 100);

    if (pointsCount) {
        pointsCount.textContent = points;
    }

    if (pointsProgress) {
        pointsProgress.style.width = `${progress}%`;
    }
}

function updateHabitsCard(habits) {
    const habitsCount = document.getElementById("habitsCount");
    const habitList = document.querySelector(".habits-card .habit-list");

    const activeHabits = getActiveHabits(habits);

    if (habitsCount) {
        habitsCount.textContent = activeHabits.length;
    }

    if (!habitList) return;

    if (!activeHabits.length) {
        habitList.innerHTML = `
            <div class="habit-item">
                <i class="fas fa-circle-notch"></i>
                <span>No active habits</span>
            </div>
        `;
        return;
    }

    habitList.innerHTML = activeHabits.slice(0, 2).map(habit => `
        <div class="habit-item">
            <i class="fas fa-check-circle"></i>
            <span>${escapeHtml(getHabitName(habit))}</span>
        </div>
    `).join("");
}

function updateDashboardReminders(habits) {
    const reminderCountCard = document.getElementById("reminderCountCard");
    const nextReminderTime = document.getElementById("nextReminderTime");
    const pendingHabitCount = document.getElementById("pendingHabitCount");

    const activeHabits = getActiveHabits(habits);
    const reminders = activeHabits.filter(habit => getHabitReminderTime(habit));
    const pending = activeHabits.filter(habit => !isHabitCompletedToday(habit));

    if (reminderCountCard) {
        reminderCountCard.textContent = `${reminders.length} Reminder${reminders.length === 1 ? "" : "s"}`;
    }

    if (pendingHabitCount) {
        pendingHabitCount.textContent = `${pending.length} Pending`;
    }

    if (nextReminderTime) {
        if (!reminders.length) {
            nextReminderTime.textContent = "--:--";
        } else {
            const sortedTimes = reminders
                .map(habit => getHabitReminderTime(habit))
                .filter(Boolean)
                .sort();

            nextReminderTime.textContent = sortedTimes[0] || "--:--";
        }
    }
}

function updateRecentActivity(entries, habits) {
    const activityList = document.getElementById("activityList");
    if (!activityList) return;

    const journalActivities = entries.slice(0, 3).map(entry => ({
        type: "journal",
        icon: getMoodEmoji(entry.mood),
        title: `Journal entry added`,
        subtitle: formatDate(entry.date)
    }));

    const habitActivities = getActiveHabits(habits).slice(0, 2).map(habit => ({
        type: "habit",
        icon: "⭐",
        title: `${getHabitName(habit)} active`,
        subtitle: "Habit Builder"
    }));

    const activities = [...journalActivities, ...habitActivities].slice(0, 5);

    if (!activities.length) {
        activityList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No activity yet. Start your wellness journey!</p>
            </div>
        `;
        return;
    }

    activityList.innerHTML = activities.map(item => `
        <div class="activity-item" style="display:flex; align-items:center; gap:12px; padding:14px 0; border-bottom:1px solid rgba(0,0,0,0.06);">
            <div style="width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; background:rgba(99,102,241,0.08); font-size:18px;">
                ${item.icon}
            </div>
            <div style="flex:1;">
                <div style="font-weight:600;">${escapeHtml(item.title)}</div>
                <div style="font-size:14px; opacity:0.7;">${escapeHtml(item.subtitle)}</div>
            </div>
        </div>
    `).join("");
}

function calculateStreak(entries) {
    if (!entries.length) return 0;

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

function getActiveHabits(habits) {
    if (!Array.isArray(habits)) return [];

    return habits.filter(habit => {
        if (!habit || typeof habit !== "object") return false;

        if (habit.isArchived === true) return false;
        if (habit.archived === true) return false;
        if (habit.active === false) return false;
        if (habit.status && String(habit.status).toLowerCase() === "archived") return false;

        return true;
    });
}

function getHabitName(habit) {
    return (
        habit?.title ||
        habit?.name ||
        habit?.habitName ||
        habit?.label ||
        "Habit"
    );
}

function getHabitReminderTime(habit) {
    return (
        habit?.reminderTime ||
        habit?.time ||
        habit?.reminder?.time ||
        ""
    );
}

function isHabitCompletedToday(habit) {
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);

    const completedDates = habit?.completedDates || habit?.completed || habit?.history || [];

    if (Array.isArray(completedDates)) {
        return completedDates.some(item => {
            const value = typeof item === "string"
                ? item
                : item?.date || item?.completedAt || "";

            return String(value).slice(0, 10) === todayKey;
        });
    }

    return false;
}

function getMoodEmoji(mood) {
    const moods = {
        happy: "😊",
        calm: "😌",
        neutral: "😐",
        anxious: "😟",
        sad: "😢",
        angry: "😠"
    };
    return moods[mood] || "😐";
}

function formatDate(date) {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
}

function toggleSidebar() {
    const sidebar = document.querySelector(".sidebar");
    if (sidebar) {
        sidebar.classList.toggle("open");
    }
}

function toggleProfileMenu() {
    const profileMenu = document.getElementById("profileMenu");
    if (profileMenu) {
        profileMenu.style.display = profileMenu.style.display === "block" ? "none" : "block";
    }
}

function toggleNotifications() {
    const panel = document.getElementById("notification-panel");
    if (panel) {
        panel.classList.toggle("hidden");
    }
}

function clearNotifications() {
    const notificationList = document.getElementById("notification-list");
    const badge = document.getElementById("notification-badge");

    if (notificationList) {
        notificationList.innerHTML = `<div class="empty-state"><p>No notifications</p></div>`;
    }

    if (badge) {
        badge.textContent = "0";
    }
}

function initializeNotificationBadge() {
    const badge = document.getElementById("notification-badge");
    const list = document.getElementById("notification-list");

    if (badge) {
        badge.textContent = "0";
    }

    if (list && !list.innerHTML.trim()) {
        list.innerHTML = `<div class="empty-state"><p>No notifications</p></div>`;
    }
}

function initializeDashboardSearch() {
    const searchInput = document.getElementById("dashboardSearchInput");
    const searchIcon = document.getElementById("dashboardSearchIcon");

    if (!searchInput) return;

    searchInput.addEventListener("input", handleDashboardSearch);

    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            handleDashboardSearch();
        }
    });

    if (searchIcon) {
        searchIcon.style.cursor = "pointer";
        searchIcon.addEventListener("click", handleDashboardSearch);
    }
}

function handleDashboardSearch() {
    const searchInput = document.getElementById("dashboardSearchInput");
    if (!searchInput) return;

    const query = searchInput.value.trim().toLowerCase();

    const searchableItems = [
        { element: document.querySelector('.welcome-card'), text: 'welcome start journal dashboard healing hub' },
        { element: document.querySelector('.mood-card'), text: 'mood entries emotions journal feelings track' },
        { element: document.querySelector('.streak-card'), text: 'day streak consistency progress fire' },
        { element: document.querySelector('.points-card'), text: 'wellness points level score progress' },
        { element: document.querySelector('.habits-card'), text: 'active habits habit builder routines meditation exercise' },
        { element: document.querySelector('.quick-actions-section:nth-of-type(1)'), text: "today's habit reminders reminder bell time pending manage habits" },
        { element: document.querySelector('.quick-actions-section:nth-of-type(2)'), text: 'quick actions journal vibe check meditate ai chat habit builder' },
        { element: document.querySelector('.recent-activity-section'), text: 'recent activity journal habits timeline history' },
        { element: document.querySelector('.wellness-tips'), text: 'daily wellness tips hydration sleep walk breathe meditation' }
    ];

    if (!query) {
        searchableItems.forEach(item => {
            if (item.element) {
                item.element.style.display = "";
            }
        });
        return;
    }

    let firstMatch = null;
    let hasMatch = false;

    searchableItems.forEach(item => {
        if (!item.element) return;

        const elementText = (item.element.innerText || "").toLowerCase();
        const extraText = item.text.toLowerCase();
        const isMatch = elementText.includes(query) || extraText.includes(query);

        item.element.style.display = isMatch ? "" : "none";

        if (isMatch && !firstMatch) {
            firstMatch = item.element;
        }

        if (isMatch) {
            hasMatch = true;
        }
    });

    if (firstMatch) {
        firstMatch.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (!hasMatch && typeof showPopup === "function") {
        showPopup("No matching result found.");
    }
}

async function handleLogout() {
    try {
        if (typeof logoutUser === "function") {
            await logoutUser();
            return;
        }
    } catch (error) {
        console.error("Logout error:", error);
    }

    localStorage.removeItem("healingHub_currentUser");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("healingHub_authToken");
    localStorage.removeItem("healingHub_token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("token");
    sessionStorage.removeItem("healingHub_justSignedUp");

    window.location.href = LOGIN_PAGE_URL;
}

window.addEventListener("storage", function (event) {
    if (
        event.key === JOURNAL_STORAGE_KEY ||
        event.key === "healingHub_habits" ||
        event.key === "habits"
    ) {
        updateDashboardData();
    }
});

document.addEventListener("click", function (event) {
    const profile = document.querySelector(".user-profile");
    const profileMenu = document.getElementById("profileMenu");

    if (profile && profileMenu && !profile.contains(event.target)) {
        profileMenu.style.display = "none";
    }

    const notificationWrapper = document.querySelector(".notification-wrapper");
    const notificationPanel = document.getElementById("notification-panel");

    if (notificationWrapper && notificationPanel && !notificationWrapper.contains(event.target)) {
        notificationPanel.classList.add("hidden");
    }
});