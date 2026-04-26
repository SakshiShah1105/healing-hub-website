function sanitizeToken(token) {
    if (!token) return '';

    const cleaned = String(token).trim();

    if (
        !cleaned ||
        cleaned === 'undefined' ||
        cleaned === 'null' ||
        cleaned === '[object Object]'
    ) {
        return '';
    }

    const parts = cleaned.split('.');
    if (parts.length !== 3) {
        return '';
    }

    return cleaned;
}

function getAuthToken() {
    const token =
        localStorage.getItem('healingHub_authToken') ||
        localStorage.getItem('healingHub_token') ||
        localStorage.getItem('authToken') ||
        localStorage.getItem('token') ||
        '';

    return sanitizeToken(token);
}

function setAuthToken(token) {
    const safeToken = sanitizeToken(token);
    if (!safeToken) return;

    localStorage.setItem('healingHub_authToken', safeToken);
    localStorage.setItem('healingHub_token', safeToken);
    localStorage.setItem('authToken', safeToken);
    localStorage.setItem('token', safeToken);
}

function clearAuthToken() {
    localStorage.removeItem('healingHub_authToken');
    localStorage.removeItem('healingHub_token');
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    localStorage.removeItem('healingHub_currentUser');
    localStorage.removeItem('currentUser');
}

function getStoredCurrentUser() {
    try {
        const user =
            localStorage.getItem('healingHub_currentUser') ||
            localStorage.getItem('currentUser');

        const parsed = user ? JSON.parse(user) : null;
        return parsed && parsed.email ? parsed : null;
    } catch (e) {
        return null;
    }
}

function setStoredCurrentUser(user) {
    try {
        if (!user) return;
        const value = JSON.stringify(user);
        localStorage.setItem('healingHub_currentUser', value);
        localStorage.setItem('currentUser', value);
    } catch (e) {
        console.error('Cannot store user:', e);
    }
}

function clearStoredCurrentUser() {
    localStorage.removeItem('healingHub_currentUser');
    localStorage.removeItem('currentUser');
}

async function getCurrentUserFromAPI() {
    const token = getAuthToken();
    const storedUser = getStoredCurrentUser();

    if (!token) {
        return storedUser ? { user: storedUser, source: 'local' } : null;
    }

    try {
        const response = await apiRequest('/auth/me', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (response?.user) {
            setStoredCurrentUser(response.user);
            return { ...response, source: 'api' };
        }

        return storedUser ? { user: storedUser, source: 'local' } : null;
    } catch (error) {
        console.warn('getCurrentUserFromAPI failed, using local user fallback:', error);
        return storedUser ? { user: storedUser, source: 'local' } : null;
    }
}

async function logoutUser() {
    const token = getAuthToken();

    try {
        if (token) {
            await apiRequest('/auth/logout', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
        }
    } catch (error) {
        console.warn('Logout request failed:', error);
    }

    clearAuthToken();
    clearStoredCurrentUser();
    sessionStorage.removeItem('healingHub_justSignedUp');
    window.location.replace('landing-page.html');
}