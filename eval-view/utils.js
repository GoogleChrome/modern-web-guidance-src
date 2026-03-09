/**
 * Utility functions shared between Dashboard and Landing pages.
 */

export function getRunStats(checks) {
    if (!checks || !checks.length) return { rate: 0, passed: 0, total: 0 };
    const passed = checks.filter(c => c.passed).length;
    const total = checks.length;
    const rate = Math.round((passed / total) * 100);
    return { rate, passed, total };
}

export function getColor(percentage) {
    if (percentage >= 90) return 'var(--accent-success)';
    if (percentage >= 50) return '#dbab09';
    return 'var(--accent-failure)';
}

export function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function capitalize(s) {
    if (typeof s !== 'string' || s.length === 0) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatTestName(name) {
    if (!name) return name;
    return name.split(' - ').join(' / ');
}

// Google Identity Services (OAuth) Integration
const GOOGLE_CLIENT_ID = '169412140096-fk4rtf6iqk982d43385s1ilucrda91g2.apps.googleusercontent.com';
let accessToken = localStorage.getItem('gcs_access_token') || null;

export function getAccessToken() {
    return accessToken;
}

export function initGoogleAuth(onAuthSuccess) {
    const init = () => {
        if (!window.google || !window.google.accounts) {
            // Wait for script to load
            setTimeout(init, 50);
            return;
        }

        const authBtn = document.getElementById('auth-btn');
        if (authBtn) {
            authBtn.style.display = 'block';
            if (accessToken) {
                authBtn.textContent = 'Authenticated ✓';
                authBtn.disabled = true;
                authBtn.style.backgroundColor = 'var(--accent-success)';
                authBtn.style.color = 'white';
                authBtn.style.borderColor = 'var(--accent-success)';
            }
        }

        const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/devstorage.read_only',
            callback: (response) => {
                if (response.error !== undefined) {
                    console.error('OAuth Error:', response);
                    return;
                }
                accessToken = response.access_token;
                localStorage.setItem('gcs_access_token', accessToken);
                console.log('Successfully authenticated with Google.');
                if (authBtn) {
                    authBtn.textContent = 'Authenticated ✓';
                    authBtn.disabled = true;
                    authBtn.style.backgroundColor = 'var(--accent-success)';
                    authBtn.style.color = 'white';
                    authBtn.style.borderColor = 'var(--accent-success)';
                }
                if (onAuthSuccess) onAuthSuccess();
            },
        });

        if (authBtn) {
            authBtn.addEventListener('click', () => {
                // Request an access token
                tokenClient.requestAccessToken();
            });
        }
    };
    init();
}

export async function authenticatedFetch(url, options = {}) {
    if (accessToken) {
        options.headers = options.headers || {};
        options.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const res = await fetch(url, options);
    if (res.status === 401) {
        console.warn('Google Access Token expired or invalid. Clearing token.');
        localStorage.removeItem('gcs_access_token');
        accessToken = null;
        
        // Reset button UI if available
        const authBtn = document.getElementById('auth-btn');
        if (authBtn) {
            authBtn.textContent = 'Sign in with Google';
            authBtn.disabled = false;
            authBtn.style.backgroundColor = '';
            authBtn.style.color = '';
            authBtn.style.borderColor = '';
        }
    }
    return res;
}
