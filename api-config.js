const API_URLS = [
    'http://localhost:5000/api',
    'http://127.0.0.1:5000/api'
];

const API_BASE_URL = API_URLS[0];

const API_CONFIG = {
    BASE_URL: API_BASE_URL,
    API_BASE_URL: API_BASE_URL,
    API_URLS
};

function getStoredTokenSafe() {
    return (
        localStorage.getItem('healingHub_authToken') ||
        localStorage.getItem('healingHub_token') ||
        localStorage.getItem('authToken') ||
        localStorage.getItem('token') ||
        ''
    );
}

async function tryFetchWithFallback(endpoint, config = {}, timeoutMs = 6000) {
    let lastError = null;

    for (const baseUrl of API_URLS) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(`${baseUrl}${endpoint}`, {
                ...config,
                signal: controller.signal
            });

            clearTimeout(timeout);
            return response;
        } catch (error) {
            clearTimeout(timeout);
            lastError = error;
            console.warn(`Fetch failed for ${baseUrl}${endpoint}:`, error);
        }
    }

    throw lastError || new Error('Unable to connect to backend server.');
}

async function parseResponseSafely(response) {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        try {
            return await response.json();
        } catch (error) {
            return {};
        }
    }

    try {
        const text = await response.text();
        return text ? { message: text } : {};
    } catch (error) {
        return {};
    }
}

async function apiRequest(endpoint, options = {}) {
    const isFormData = options.body instanceof FormData;
    const token = getStoredTokenSafe();

    const headers = {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token && !options.skipAuth ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };

    const config = {
        method: options.method || 'GET',
        headers,
        credentials: 'include'
    };

    if (options.body !== undefined && options.body !== null) {
        if (isFormData) {
            config.body = options.body;
        } else if (typeof options.body === 'string') {
            config.body = options.body;
        } else {
            config.body = JSON.stringify(options.body);
        }
    }

    try {
        const response = await tryFetchWithFallback(
            endpoint,
            config,
            options.timeout || 6000
        );

        const data = await parseResponseSafely(response);

        if (!response.ok) {
            throw new Error(
                data?.message ||
                data?.error ||
                `HTTP ${response.status}`
            );
        }

        return data;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Backend server took too long to respond.');
        }

        console.error(`API Error [${config.method} ${endpoint}]:`, error);
        throw error;
    }
}