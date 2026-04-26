document.addEventListener('DOMContentLoaded', function () {
    try {
        const currentUser = JSON.parse(localStorage.getItem('healingHub_currentUser'));
        if (currentUser && currentUser.email) {
            window.location.href = 'index.html';
        }
    } catch (error) {
        localStorage.removeItem('healingHub_currentUser');
    }
});

function handleForgotPassword(event) {
    event.preventDefault();
    requestResetStep();
}

function requestResetStep() {
    const emailInput = document.getElementById('reset-email');
    const email = emailInput ? emailInput.value.trim() : '';

    if (!email) {
        showToast('Please enter your email address.', 'error');
        return;
    }

    if (!isValidEmail(email)) {
        showToast('Please enter a valid email address.', 'error');
        return;
    }

    const users = getStoredUsers();
    const matchedUser = users.find(user =>
        (user.email || '').toLowerCase() === email.toLowerCase()
    );

    showLoading(true);

    setTimeout(() => {
        showLoading(false);

        if (!matchedUser) {
            showToast('This email is not registered yet.', 'error');
            return;
        }

        const resetToken = generateResetToken();
        localStorage.setItem('healingHub_resetEmail', email);
        localStorage.setItem('healingHub_resetToken', resetToken);

        showToast('Reset request accepted. Redirecting to reset page...', 'success');

        setTimeout(() => {
            window.location.href = `reset-password.html?token=${encodeURIComponent(resetToken)}`;
        }, 900);
    }, 700);
}

function generateResetToken() {
    return 'hh_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getStoredUsers() {
    try {
        const users = JSON.parse(localStorage.getItem('healingHub_users') || '[]');
        return Array.isArray(users) ? users : [];
    } catch (error) {
        return [];
    }
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showLoading(isLoading) {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.style.display = isLoading ? 'flex' : 'none';
    }
}

function showToast(message, type) {
    const toast = document.getElementById('toast-message');
    if (!toast) {
        alert(message);
        return;
    }

    toast.textContent = message;
    toast.className = 'toast-message show ' + type;

    setTimeout(() => {
        toast.className = 'toast-message';
    }, 3000);
}