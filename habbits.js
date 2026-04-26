let habits = [];
let currentUser = null;
let currentDifficulty = "easy";
let reminderIntervalId = null;
let isHabitSubmitting = false;

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initHabitsPage();
    } catch (error) {
        console.error("Habit page init error:", error);
        safeToast("Something went wrong while loading habits.", "error");
    }
});

async function initHabitsPage() {
    await checkUserLoginForHabits();
    await loadHabitsFromBackend();
    updateStats();
    renderAllHabitSections();
    startReminderEngine();
}

async function checkUserLoginForHabits() {
    try {
        const storedUser = JSON.parse(localStorage.getItem("healingHub_currentUser")) || null;

        if (storedUser && storedUser.email) {
            currentUser = storedUser;
            return;
        }

        if (typeof getCurrentUserFromAPI === "function") {
            const response = await getCurrentUserFromAPI();
            if (response && response.user) {
                currentUser = response.user;
                localStorage.setItem("healingHub_currentUser", JSON.stringify(response.user));
                return;
            }
        }

        const users = JSON.parse(localStorage.getItem("healingHub_users")) || [];
        if (Array.isArray(users) && users.length > 0) {
            currentUser = users[users.length - 1];
            localStorage.setItem("healingHub_currentUser", JSON.stringify(currentUser));
            return;
        }

        window.location.href = "login.html";
    } catch (error) {
        console.error("Auth error:", error);
        window.location.href = "login.html";
    }
}

function getCurrentUserId() {
    if (!currentUser) return "guest";
    return currentUser.id || currentUser.email || "guest";
}

function getCurrentUserEmail() {
    if (!currentUser) return "";
    return (currentUser.email || "").toLowerCase();
}

function getApiBase() {
    if (typeof API_CONFIG !== "undefined" && API_CONFIG.BASE_URL) {
        return API_CONFIG.BASE_URL;
    }
    return "http://localhost:5000/api";
}

function syncHabitsToLocalStorage() {
    try {
        const userId = getCurrentUserId();
        const userEmail = getCurrentUserEmail();

        const syncedHabits = habits.map(habit => ({
            ...habit,
            userId: habit.userId || userId,
            userEmail: habit.userEmail || userEmail,
            email: habit.email || userEmail,
            active: habit.active !== false
        }));

        localStorage.setItem("healingHub_habits", JSON.stringify(syncedHabits));
        localStorage.setItem("habits", JSON.stringify(syncedHabits));
    } catch (error) {
        console.error("Habit localStorage sync error:", error);
    }
}

async function loadHabitsFromBackend() {
    try {
        const response = await fetch(`${getApiBase()}/habits/user/${encodeURIComponent(getCurrentUserId())}`, {
            method: "GET",
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error("Failed to load habits");
        }

        const data = await response.json();
        habits = Array.isArray(data.habits) ? data.habits : [];
        habits = removeDuplicateHabits(habits);

        syncHabitsToLocalStorage();
    } catch (error) {
        console.error("Load habits error:", error);
        habits = [];
        syncHabitsToLocalStorage();
    }
}

function removeDuplicateHabits(items) {
    const seen = new Set();
    const unique = [];

    for (const habit of items) {
        const key = [
            (habit.name || "").trim().toLowerCase(),
            (habit.category || "").trim().toLowerCase(),
            (habit.frequency || "").trim().toLowerCase(),
            Number(habit.duration || 0),
            (habit.description || "").trim().toLowerCase(),
            habit.reminder?.time || "",
            (habit.reminder?.message || "").trim().toLowerCase()
        ].join("|");

        if (!seen.has(key)) {
            seen.add(key);
            unique.push(habit);
        }
    }

    return unique;
}

function switchTab(index) {
    const buttons = document.querySelectorAll(".tab-btn");
    const panes = document.querySelectorAll(".tab-pane");

    buttons.forEach((btn, i) => btn.classList.toggle("active", i === index));
    panes.forEach((pane, i) => pane.classList.toggle("active", i === index));
}

function setDifficulty(level, buttonEl) {
    currentDifficulty = level;

    const hiddenInput = document.getElementById("habit-difficulty");
    if (hiddenInput) hiddenInput.value = level;

    document.querySelectorAll(".diff-btn").forEach(btn => btn.classList.remove("active"));
    if (buttonEl) buttonEl.classList.add("active");
}

async function handleAddHabit(event) {
    event.preventDefault();

    if (isHabitSubmitting) return;
    isHabitSubmitting = true;

    const submitBtn = document.getElementById("create-habit-btn");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.7";
    }

    try {
        const name = document.getElementById("new-habit")?.value.trim();
        const category = document.getElementById("habit-category")?.value || "fitness";
        const frequency = document.getElementById("habit-frequency")?.value || "daily";
        const duration = parseInt(document.getElementById("habit-duration")?.value || "15", 10);
        const description = document.getElementById("habit-description")?.value.trim() || "";
        const reminderTime = document.getElementById("habit-reminder-time")?.value || "";
        const reminderMessage =
            document.getElementById("habit-reminder-message")?.value.trim() || "Time for your habit ✨";
        const reminderEnabled = document.getElementById("habit-reminder-enabled")?.checked || false;
        const reminderDays = Array.from(document.querySelectorAll(".reminder-day:checked")).map(cb => Number(cb.value));
        const difficulty = document.getElementById("habit-difficulty")?.value || currentDifficulty || "easy";

        if (!name) {
            safeToast("Habit name is required.", "error");
            return;
        }

        const duplicateExists = habits.some(habit =>
            (habit.name || "").trim().toLowerCase() === name.toLowerCase() &&
            (habit.category || "").trim().toLowerCase() === category.toLowerCase() &&
            (habit.frequency || "").trim().toLowerCase() === frequency.toLowerCase() &&
            Number(habit.duration || 0) === duration &&
            (habit.description || "").trim().toLowerCase() === description.toLowerCase()
        );

        if (duplicateExists) {
            safeToast("This habit is already added.", "error");
            return;
        }

        const newHabit = {
            userId: getCurrentUserId(),
            userEmail: getCurrentUserEmail(),
            email: getCurrentUserEmail(),
            active: true,
            name,
            category,
            frequency,
            duration,
            description,
            difficulty,
            streak: 0,
            completedToday: false,
            totalCompletions: 0,
            createdAt: new Date().toISOString(),
            lastCompletedAt: null,
            reminder: {
                enabled: reminderEnabled,
                time: reminderTime,
                message: reminderMessage,
                days: reminderDays
            }
        };

        const response = await fetch(`${getApiBase()}/habits`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify(newHabit)
        });

        if (!response.ok) {
            throw new Error("Failed to create habit");
        }

        const data = await response.json();

        const createdHabit = {
            ...data.habit,
            userId: data.habit?.userId || getCurrentUserId(),
            userEmail: data.habit?.userEmail || getCurrentUserEmail(),
            email: data.habit?.email || getCurrentUserEmail(),
            active: data.habit?.active !== false
        };

        habits.unshift(createdHabit);
        habits = removeDuplicateHabits(habits);
        syncHabitsToLocalStorage();

        document.getElementById("habit-form").reset();
        resetDifficultyUI();

        updateStats();
        renderAllHabitSections();
        switchTab(1);

        safeToast("Habit created successfully.", "success");
    } catch (error) {
        console.error("Create habit error:", error);
        safeToast("Habit could not be saved. Please check the backend.", "error");
    } finally {
        isHabitSubmitting = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = "1";
        }
    }
}

function resetDifficultyUI() {
    currentDifficulty = "easy";

    const hiddenInput = document.getElementById("habit-difficulty");
    if (hiddenInput) hiddenInput.value = "easy";

    document.querySelectorAll(".diff-btn").forEach(btn => btn.classList.remove("active"));
    const firstBtn = document.querySelector(".diff-btn");
    if (firstBtn) firstBtn.classList.add("active");
}

function renderAllHabitSections() {
    renderReminderList();
    renderActiveHabits();
    renderCompletedHabits();
    renderInsights();
}

function renderReminderList() {
    const reminderList = document.getElementById("reminder-list");
    const emptyReminders = document.getElementById("empty-reminders");
    const reminderCount = document.getElementById("upcoming-reminder-count");

    if (!reminderList || !emptyReminders || !reminderCount) return;

    const reminderHabits = habits.filter(
        habit => habit.reminder && habit.reminder.enabled && habit.reminder.time
    );

    reminderCount.textContent = reminderHabits.length;

    if (reminderHabits.length === 0) {
        reminderList.innerHTML = "";
        emptyReminders.style.display = "block";
        return;
    }

    emptyReminders.style.display = "none";

    reminderList.innerHTML = reminderHabits.map(habit => `
        <div class="reminder-item">
            <div>
                <strong>${escapeHtml(habit.name)}</strong>
                <p>${escapeHtml(habit.reminder.message || "Time for your habit ✨")}</p>
            </div>
            <span>${formatTime(habit.reminder.time)}</span>
        </div>
    `).join("");
}

function renderActiveHabits() {
    const habitList = document.getElementById("habit-list");
    const emptyActive = document.getElementById("empty-active");
    const activeCount = document.getElementById("active-count");

    if (!habitList || !emptyActive || !activeCount) return;

    const activeHabits = habits.filter(habit => !habit.completedToday && habit.active !== false);
    activeCount.textContent = activeHabits.length;

    if (activeHabits.length === 0) {
        habitList.innerHTML = "";
        emptyActive.style.display = "block";
        return;
    }

    emptyActive.style.display = "none";

    habitList.innerHTML = activeHabits.map(habit => `
        <div class="habit-card">
            <div class="habit-card-top">
                <div>
                    <h3>${escapeHtml(habit.name)}</h3>
                    <p>${escapeHtml(habit.description || getCategoryText(habit.category))}</p>
                </div>
            </div>

            <div class="habit-meta">
                <span><i class="fas fa-repeat"></i> ${capitalize(habit.frequency)}</span>
                <span><i class="fas fa-hourglass-half"></i> ${Number(habit.duration || 0)} min</span>
                <span><i class="fas fa-bolt"></i> ${capitalize(habit.difficulty || "easy")}</span>
            </div>

            <div class="habit-streak">
                <i class="fas fa-fire"></i> ${Number(habit.streak || 0)} streak
            </div>

            <div class="habit-actions">
                <button class="btn-primary" onclick="markHabitComplete('${habit._id}')">
                    <i class="fas fa-check"></i> Mark Complete
                </button>
                <button class="btn-secondary" onclick="deleteHabit('${habit._id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join("");
}

function renderCompletedHabits() {
    const completedList = document.getElementById("completed-list");
    const emptyCompleted = document.getElementById("empty-completed");
    const completedCount = document.getElementById("completed-count");

    if (!completedList || !emptyCompleted || !completedCount) return;

    const completedHabits = habits.filter(habit => habit.completedToday);
    completedCount.textContent = completedHabits.length;

    if (completedHabits.length === 0) {
        completedList.innerHTML = "";
        emptyCompleted.style.display = "block";
        return;
    }

    emptyCompleted.style.display = "none";

    completedList.innerHTML = completedHabits.map(habit => `
        <div class="habit-card completed-habit">
            <div class="habit-card-top">
                <div>
                    <h3>${escapeHtml(habit.name)}</h3>
                    <p>Completed successfully today</p>
                </div>
            </div>

            <div class="habit-meta">
                <span><i class="fas fa-check-circle"></i> Done today</span>
                <span><i class="fas fa-fire"></i> ${Number(habit.streak || 0)} streak</span>
                <span><i class="fas fa-trophy"></i> ${Number(habit.totalCompletions || 0)} total</span>
            </div>

            <div class="habit-actions">
                <button class="btn-secondary" onclick="undoHabitComplete('${habit._id}')">
                    <i class="fas fa-rotate-left"></i> Undo
                </button>
                <button class="btn-secondary" onclick="deleteHabit('${habit._id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join("");
}

function renderInsights() {
    const completionRateEl = document.getElementById("completion-rate");
    const currentStreakEl = document.getElementById("current-streak");
    const totalMinutesEl = document.getElementById("total-minutes");
    const habitPointsEl = document.getElementById("habit-points");
    const performanceEl = document.getElementById("habit-performance");
    const achievementsEl = document.getElementById("achievements");
    const suggestionsEl = document.getElementById("smart-suggestions");

    const total = habits.length;
    const completed = habits.filter(h => h.completedToday).length;
    const bestStreak = habits.reduce((max, h) => Math.max(max, Number(h.streak || 0)), 0);
    const totalMinutes = habits
        .filter(h => h.completedToday)
        .reduce((sum, h) => sum + Number(h.duration || 0), 0);

    const points = habits.reduce((sum, h) => {
        const diff = h.difficulty || "easy";
        const diffPoints = diff === "hard" ? 30 : diff === "medium" ? 20 : 10;
        return sum + (Number(h.totalCompletions || 0) * diffPoints);
    }, 0);

    const rate = total === 0 ? 0 : Math.round((completed / total) * 100);

    if (completionRateEl) completionRateEl.textContent = `${rate}%`;
    if (currentStreakEl) currentStreakEl.textContent = bestStreak;
    if (totalMinutesEl) totalMinutesEl.textContent = totalMinutes;
    if (habitPointsEl) habitPointsEl.textContent = points;

    if (performanceEl) {
        performanceEl.innerHTML = habits.length
            ? habits.map(h => `
                <div class="performance-card">
                    <strong>${escapeHtml(h.name)}</strong>
                    <p>${capitalize(h.category)} • ${Number(h.duration || 0)} min</p>
                    <div class="performance-value">${Number(h.totalCompletions || 0)}</div>
                    <span>done</span>
                </div>
            `).join("")
            : `<p>No habit performance data yet.</p>`;
    }

    if (achievementsEl) {
        achievementsEl.innerHTML = buildAchievements(bestStreak, completed, total).map(item => `
            <div class="achievement-item">
                <div class="achievement-icon">${item.icon}</div>
                <div>
                    <h4>${item.title}</h4>
                    <p>${item.desc}</p>
                </div>
            </div>
        `).join("");
    }

    if (suggestionsEl) {
        suggestionsEl.innerHTML = buildSuggestions().map(text => `
            <div class="suggestion-chip">${escapeHtml(text)}</div>
        `).join("");
    }

    updateWeeklyBars();
}

function buildAchievements(bestStreak, completed, total) {
    const items = [];

    if (total >= 1) items.push({ icon: "🌱", title: "Getting Started", desc: "Created your first habit" });
    if (completed >= 1) items.push({ icon: "✅", title: "Daily Win", desc: "Completed a habit today" });
    if (bestStreak >= 3) items.push({ icon: "🔥", title: "On Fire", desc: "Reached a 3+ day streak" });
    if (bestStreak >= 7) items.push({ icon: "🏆", title: "Week Warrior", desc: "Maintained a 7-day streak" });

    if (items.length === 0) {
        items.push({ icon: "✨", title: "Start Today", desc: "Your next achievement is one habit away" });
    }

    return items;
}

function buildSuggestions() {
    if (habits.length === 0) {
        return [
            "Start with one small 10-minute habit",
            "Choose a fixed reminder time",
            "Keep the first habit easy and realistic"
        ];
    }

    const suggestions = [];
    const hasReminder = habits.some(h => h.reminder && h.reminder.enabled);
    const hasMindfulness = habits.some(h => h.category === "mindfulness");
    const hardOnly = habits.length > 0 && habits.every(h => h.difficulty === "hard");

    if (!hasReminder) suggestions.push("Enable reminders for better consistency");
    if (!hasMindfulness) suggestions.push("Add a mindfulness habit for mental balance");
    if (hardOnly) suggestions.push("Mix one easy habit to avoid burnout");
    if (suggestions.length === 0) suggestions.push("Your routine looks balanced — keep going");

    return suggestions.slice(0, 3);
}

function updateWeeklyBars() {
    const bars = document.querySelectorAll(".day-bar");
    const completedCount = habits.filter(h => h.completedToday).length;

    bars.forEach((bar, index) => {
        const height = Math.max(20, Math.min(100, completedCount * 12 + (index * 4)));
        bar.style.height = `${height}px`;
    });
}

function updateStats() {
    const totalHabitsEl = document.getElementById("total-habits");
    const longestStreakEl = document.getElementById("longest-streak");
    const totalCompletedEl = document.getElementById("total-completed");

    const totalHabits = habits.length;
    const longestStreak = habits.reduce((max, h) => Math.max(max, Number(h.streak || 0)), 0);
    const totalCompleted = habits.filter(h => h.completedToday).length;

    if (totalHabitsEl) totalHabitsEl.textContent = totalHabits;
    if (longestStreakEl) longestStreakEl.textContent = longestStreak;
    if (totalCompletedEl) totalCompletedEl.textContent = totalCompleted;
}

async function markHabitComplete(habitId) {
    const habit = habits.find(h => h._id === habitId);
    if (!habit) return;

    const updatedHabit = {
        ...habit,
        completedToday: true,
        streak: Number(habit.streak || 0) + 1,
        totalCompletions: Number(habit.totalCompletions || 0) + 1,
        lastCompletedAt: new Date().toISOString(),
        active: true
    };

    await saveHabitUpdate(updatedHabit);
    safeToast("Habit completed successfully.", "success");
}

async function undoHabitComplete(habitId) {
    const habit = habits.find(h => h._id === habitId);
    if (!habit) return;

    const updatedHabit = {
        ...habit,
        completedToday: false,
        streak: Math.max(0, Number(habit.streak || 0) - 1),
        totalCompletions: Math.max(0, Number(habit.totalCompletions || 0) - 1),
        active: true
    };

    await saveHabitUpdate(updatedHabit);
    safeToast("Habit updated.", "success");
}

async function saveHabitUpdate(updatedHabit) {
    try {
        const response = await fetch(`${getApiBase()}/habits/${updatedHabit._id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify(updatedHabit)
        });

        if (!response.ok) {
            throw new Error("Update failed");
        }

        const data = await response.json();
        const savedHabit = {
            ...data.habit,
            userId: data.habit?.userId || getCurrentUserId(),
            userEmail: data.habit?.userEmail || getCurrentUserEmail(),
            email: data.habit?.email || getCurrentUserEmail(),
            active: data.habit?.active !== false
        };

        const index = habits.findIndex(h => h._id === updatedHabit._id);
        if (index !== -1) habits[index] = savedHabit;

        habits = removeDuplicateHabits(habits);
        syncHabitsToLocalStorage();

        updateStats();
        renderAllHabitSections();
    } catch (error) {
        console.error("Update habit error:", error);
        safeToast("Habit update failed.", "error");
    }
}

async function deleteHabit(habitId) {
    const ok = window.confirm("Are you sure you want to delete this habit?");
    if (!ok) return;

    try {
        const response = await fetch(`${getApiBase()}/habits/${habitId}`, {
            method: "DELETE",
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error("Delete failed");
        }

        habits = habits.filter(h => h._id !== habitId);
        syncHabitsToLocalStorage();

        updateStats();
        renderAllHabitSections();
        safeToast("Habit deleted successfully.", "success");
    } catch (error) {
        console.error("Delete habit error:", error);
        safeToast("Habit delete failed.", "error");
    }
}

function requestReminderPermission() {
    if (!("Notification" in window)) {
        safeToast("Browser notifications are not supported.", "error");
        return;
    }

    if (Notification.permission === "granted") {
        safeToast("Notifications are already enabled.", "success");
        return;
    }

    if (Notification.permission === "denied") {
        safeToast("Notifications are blocked. Please enable them from browser settings.", "error");
        return;
    }

    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            safeToast("Notifications enabled.", "success");

            new Notification("Healing Hub", {
                body: "Browser notifications are enabled for your habits ✨"
            });
        } else {
            safeToast("Notification permission denied.", "error");
        }
    });
}

function startReminderEngine() {
    if (reminderIntervalId) {
        clearInterval(reminderIntervalId);
    }

    reminderIntervalId = setInterval(checkReminders, 30000);
    checkReminders();
}

function checkReminders() {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5);

    habits.forEach(habit => {
        if (!habit.reminder || !habit.reminder.enabled) return;
        if (!habit.reminder.time) return;
        if (!Array.isArray(habit.reminder.days)) return;
        if (!habit.reminder.days.includes(currentDay)) return;
        if (habit.reminder.time !== currentTime) return;

        const key = `habit_reminder_${habit._id}_${new Date().toDateString()}_${currentTime}`;
        if (sessionStorage.getItem(key)) return;

        sessionStorage.setItem(key, "1");
        triggerBrowserReminder(habit);
    });
}

function triggerBrowserReminder(habit) {
    const message = habit.reminder?.message || "Time for your habit ✨";

    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(habit.name, {
            body: message
        });
    } else {
        safeToast(`${habit.name}: ${message}`, "success");
    }
}

function safeToast(message, type = "success") {
    try {
        if (typeof showToastPopup === "function") {
            showToastPopup({
                title: type === "error" ? "Error" : type === "success" ? "Success" : "Notice",
                message: message,
                type: type
            });
            return;
        }
    } catch (e) {
        console.warn("showToastPopup failed:", e);
    }

    try {
        const existing = document.querySelector(".hh-simple-toast");
        if (existing) existing.remove();

        const toast = document.createElement("div");
        toast.className = "hh-simple-toast";
        toast.textContent = message;
        toast.style.position = "fixed";
        toast.style.top = "24px";
        toast.style.right = "24px";
        toast.style.zIndex = "99999";
        toast.style.padding = "14px 18px";
        toast.style.borderRadius = "14px";
        toast.style.color = "#fff";
        toast.style.fontWeight = "600";
        toast.style.fontFamily = "Inter, sans-serif";
        toast.style.boxShadow = "0 10px 25px rgba(0,0,0,0.18)";
        toast.style.maxWidth = "320px";
        toast.style.background = type === "error"
            ? "linear-gradient(135deg, #ef4444, #f87171)"
            : "linear-gradient(135deg, #6366f1, #818cf8)";

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(-8px)";
            toast.style.transition = "all 0.25s ease";
        }, 2200);

        setTimeout(() => {
            toast.remove();
        }, 2600);
    } catch (e) {
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}

function getCategoryText(category) {
    const map = {
        fitness: "health",
        mindfulness: "mental wellness",
        nutrition: "nutrition",
        sleep: "better sleep",
        learning: "self growth",
        social: "connection",
        work: "productivity"
    };

    return map[category] || category || "wellness";
}

function capitalize(text = "") {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatTime(time) {
    if (!time) return "--:--";
    const [hour, minute] = time.split(":");
    let h = parseInt(hour, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${minute} ${ampm}`;
}

function escapeHtml(text = "") {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function handleLogout() {
    if (typeof showConfirmPopup === "function") {
        showConfirmPopup({
            type: "warning",
            icon: "👋",
            title: "Logout from Healing Hub?",
            message: "You can come back anytime and continue your wellness journey.",
            confirmText: "Logout",
            cancelText: "Stay Here",
            onConfirm: function () {
                localStorage.removeItem("healingHub_currentUser");
                localStorage.removeItem("healingHub_token");
                localStorage.removeItem("authToken");
                localStorage.removeItem("token");
                window.location.href = "login.html";
            }
        });
        return;
    }

    localStorage.removeItem("healingHub_currentUser");
    localStorage.removeItem("healingHub_token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("token");
    window.location.href = "login.html";
}