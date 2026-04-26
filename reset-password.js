document.addEventListener('DOMContentLoaded', function () {
    const currentUser = localStorage.getItem('healingHub_currentUser');
    if (currentUser) {
        window.location.href = 'index.html';
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('token');
    const storedToken = localStorage.getItem('healingHub_resetToken');
    const resetEmail = localStorage.getItem('healingHub_resetEmail');
    const subtext = document.getElementById('reset-subtext');

    if (!resetToken || !storedToken || resetToken !== storedToken || !resetEmail) {
        showToast('Reset session expired. Please try again.', 'error');
        setTimeout(() => {
            window.location.href = 'forgot-password.html';
        }, 1500);
        return;
    }

    if (subtext) {
        subtext.textContent = `Create a new password for ${resetEmail}`;
    }
});

function togglePassword(event, inputId) {
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

function handleResetPassword(event) {
    event.preventDefault();

    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('token');
    const storedToken = localStorage.getItem('healingHub_resetToken');
    const resetEmail = localStorage.getItem('healingHub_resetEmail');

    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const updateBtn = document.getElementById('update-password-btn');

    const newPassword = newPasswordInput ? newPasswordInput.value : '';
    const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

    if (!resetToken || !storedToken || resetToken !== storedToken || !resetEmail) {
        showToast('Reset session expired. Please try again.', 'error');
        setTimeout(() => {
            window.location.href = 'forgot-password.html';
        }, 1500);
        return;
    }

    if (!newPassword || !confirmPassword) {
        showToast('Please fill both password fields.', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters long.', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match.', 'error');
        return;
    }

    const users = getStoredUsers();
    const userIndex = users.findIndex(user => (user.email || '').toLowerCase() === resetEmail.toLowerCase());

    if (userIndex === -1) {
        showToast('User account not found.', 'error');
        setTimeout(() => {
            window.location.href = 'forgot-password.html';
        }, 1500);
        return;
    }

    showLoading(true);
    if (updateBtn) updateBtn.disabled = true;

    setTimeout(() => {
        users[userIndex].password = newPassword;
        users[userIndex].updatedAt = new Date().toISOString();

        localStorage.setItem('healingHub_users', JSON.stringify(users));
        localStorage.removeItem('healingHub_resetEmail');
        localStorage.removeItem('healingHub_resetToken');

        showLoading(false);
        if (updateBtn) updateBtn.disabled = false;

        showToast('Password updated successfully. Redirecting to sign in...', 'success');

        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1600);
    }, 1200);
}

function getStoredUsers() {
    try {
        const users = JSON.parse(localStorage.getItem('healingHub_users') || '[]');
        return Array.isArray(users) ? users : [];
    } catch (error) {
        return [];
    }
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