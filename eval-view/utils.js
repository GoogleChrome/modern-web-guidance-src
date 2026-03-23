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
    const p = Math.max(0, Math.min(100, percentage));
    
    const RED = 'oklch(53% 0.18 26)';
    const YELLOW = 'oklch(72% 0.15 74)';
    const GREEN = 'oklch(52% 0.13 145)';

    if (p <= 30) return RED;
    if (p >= 90) return GREEN;
    
    if (p < 60) {
        const mix = Math.round((p - 30) / 30 * 100);
        return `color-mix(in oklch, ${RED}, ${YELLOW} ${mix}%)`;
    }
    
    const mix = Math.round((p - 60) / 30 * 100);
    return `color-mix(in oklch, ${YELLOW}, ${GREEN} ${mix}%)`;
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

export function timeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - new Date(date)) / 1000);
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

    const units = [
        { name: 'year', seconds: 31536000 },
        { name: 'month', seconds: 2592000 },
        { name: 'day', seconds: 86400 },
        { name: 'hour', seconds: 3600 },
        { name: 'minute', seconds: 60 },
        { name: 'second', seconds: 1 }
    ];

    for (const unit of units) {
        if (Math.abs(diffInSeconds) >= unit.seconds || unit.name === 'second') {
            const value = Math.floor(diffInSeconds / unit.seconds);
            return rtf.format(-value, unit.name);
        }
    }
    return 'just now';
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
