document.addEventListener('DOMContentLoaded', function () {
    initializeLoginPage();
});

async function initializeLoginPage() {
    await redirectIfAlreadyLoggedIn();
    loadRememberedEmail();
}

async function redirectIfAlreadyLoggedIn() {
    try {
        const storedUser = JSON.parse(localStorage.getItem('healingHub_currentUser') || 'null');

        if (storedUser && storedUser.email) {
            window.location.href = 'index.html';
            return;
        }

        if (typeof getAuthToken === 'function' && typeof getCurrentUserFromAPI === 'function') {
            const token = getAuthToken();
            if (!token) return;

            const response = await getCurrentUserFromAPI();
            if (response && response.user) {
                const user = {
                    ...response.user,
                    loginTime: new Date().toISOString()
                };

                localStorage.setItem('healingHub_currentUser', JSON.stringify(user));
                syncLoggedInUserToUsers(user);
                window.location.href = 'index.html';
            }
        }
    } catch (error) {
        if (typeof clearAuthToken === 'function') {
            clearAuthToken();
        }
        localStorage.removeItem('healingHub_currentUser');
    }
}

function toggleLoginPassword(event) {
    event.preventDefault();

    const passwordField = document.getElementById('login-password');
    const button = event.currentTarget || event.target.closest('.toggle-password');

    if (!passwordField || !button) return;

    const icon = button.querySelector('i');

    if (passwordField.type === 'password') {
        passwordField.type = 'text';
        if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    } else {
        passwordField.type = 'password';
        if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
}

async function handleLogin(event) {
    event.preventDefault();

    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const rememberMe = document.getElementById('remember-me');
    const loginBtn = document.getElementById('login-btn');

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!email || !password) {
        showErrorToast('Please enter both email and password.');
        return;
    }

    if (!isValidEmail(email)) {
        showErrorToast('Please enter a valid email address.');
        return;
    }

    setLoading(true);
    if (loginBtn) loginBtn.disabled = true;

    try {
        let loggedInUser = null;

        // Try backend first
        try {
            if (typeof apiRequest === 'function') {
                const responseData = await Promise.race([
                    apiRequest('/auth/login', {
                        method: 'POST',
                        body: { email, password }
                    }),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Backend timeout')), 4000)
                    )
                ]);

                if (responseData?.token) {
                    localStorage.setItem('healingHub_authToken', responseData.token);
                }

                loggedInUser = {
                    ...(responseData?.user || {}),
                    email,
                    loginTime: new Date().toISOString()
                };
            }
        } catch (apiError) {
            console.warn('Backend login failed, using local fallback:', apiError);
        }

        // Local fallback (always works)
        if (!loggedInUser || !loggedInUser.email) {
            const users = getStoredUsers();

            const matchedUser = users.find(user =>
                (user.email || '').toLowerCase() === email.toLowerCase() &&
                (user.password || '') === password
            );

            if (!matchedUser) {
                throw new Error('Invalid email or password.');
            }

            loggedInUser = {
                ...matchedUser,
                loginTime: new Date().toISOString()
            };

            localStorage.setItem('healingHub_authToken', 'demo-token');
        }

        localStorage.setItem(
            'healingHub_currentUser',
            JSON.stringify(loggedInUser)
        );

        syncLoggedInUserToUsers(loggedInUser);

        if (rememberMe && rememberMe.checked) {
            localStorage.setItem('healingHub_rememberedEmail', email);
        } else {
            localStorage.removeItem('healingHub_rememberedEmail');
        }

        showSuccessMessage('Login successful! Redirecting...');

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 800);

    } catch (error) {
        setLoading(false);
        if (loginBtn) loginBtn.disabled = false;
        showErrorToast(error.message || 'Invalid email or password.');
    }
}

function syncLoggedInUserToUsers(loggedInUser) {
    const users = getStoredUsers();
    const index = users.findIndex(user =>
        (user.email || '').toLowerCase() === (loggedInUser.email || '').toLowerCase()
    );

    if (index === -1) {
        users.push(loggedInUser);
    } else {
        users[index] = {
            ...users[index],
            ...loggedInUser
        };
    }

    localStorage.setItem('healingHub_users', JSON.stringify(users));
}

function getStoredUsers() {
    try {
        const users = JSON.parse(localStorage.getItem('healingHub_users') || '[]');
        return Array.isArray(users) ? users : [];
    } catch (error) {
        return [];
    }
}

function loadRememberedEmail() {
    const rememberedEmail = localStorage.getItem('healingHub_rememberedEmail');
    const emailInput = document.getElementById('login-email');
    const rememberMe = document.getElementById('remember-me');

    if (rememberedEmail && emailInput) {
        emailInput.value = rememberedEmail;
        if (rememberMe) rememberMe.checked = true;
    }
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setLoading(isLoading) {
    const spinner = document.getElementById('loading-spinner');
    const loginBtn = document.getElementById('login-btn');

    if (spinner) spinner.style.display = isLoading ? 'flex' : 'none';
    if (loginBtn) loginBtn.disabled = isLoading;
}

function showErrorToast(message) {
    const toast = document.getElementById('error-toast');
    const spinner = document.getElementById('loading-spinner');
    const loginBtn = document.getElementById('login-btn');

    if (spinner) spinner.style.display = 'none';
    if (loginBtn) loginBtn.disabled = false;

    if (!toast) {
        alert(message);
        return;
    }

    toast.textContent = message;
    toast.style.background = '#ef4444';
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showSuccessMessage(message) {
    const toast = document.getElementById('error-toast');
    const spinner = document.getElementById('loading-spinner');

    if (spinner) spinner.style.display = 'none';

    if (!toast) {
        alert(message);
        return;
    }

    toast.textContent = message;
    toast.style.background = '#10b981';
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        toast.style.background = '#ef4444';
    }, 2000);
}