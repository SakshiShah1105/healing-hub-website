function applyTheme(theme) {
    const body = document.body;
    const themeIcon = document.getElementById("darkModeIcon");

    if (!body) return;

    if (theme === "dark") {
        body.classList.add("dark-mode");
        body.setAttribute("data-theme", "dark");

        if (themeIcon) {
            themeIcon.classList.remove("fa-moon");
            themeIcon.classList.add("fa-sun");
        }
    } else {
        body.classList.remove("dark-mode");
        body.setAttribute("data-theme", "light");

        if (themeIcon) {
            themeIcon.classList.remove("fa-sun");
            themeIcon.classList.add("fa-moon");
        }
    }
}

function loadDarkMode() {
    try {
        const savedTheme = localStorage.getItem("healingHub_theme") || "light";
        applyTheme(savedTheme);
    } catch (error) {
        console.error("Theme load error:", error);
        applyTheme("light");
    }
}

function toggleDarkMode() {
    try {
        const isDark = document.body.classList.contains("dark-mode");
        const newTheme = isDark ? "light" : "dark";

        localStorage.setItem("healingHub_theme", newTheme);
        applyTheme(newTheme);
    } catch (error) {
        console.error("Theme toggle error:", error);
    }
}

/* Backward compatibility */
function applySavedTheme() {
    loadDarkMode();
}

function toggleTheme() {
    toggleDarkMode();
}

document.addEventListener("DOMContentLoaded", function () {
    loadDarkMode();
});