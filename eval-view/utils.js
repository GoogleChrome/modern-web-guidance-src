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
    const diff = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const units = [
        { name: 'year', s: 31536000 }, { name: 'month', s: 2592000 },
        { name: 'day', s: 86400 }, { name: 'hour', s: 3600 },
        { name: 'minute', s: 60 }, { name: 'second', s: 1 }
    ];
    const u = units.find(u => Math.abs(diff) >= u.s) || units[units.length - 1];
    return rtf.format(-Math.floor(diff / u.s), /** @type {Intl.RelativeTimeFormatUnit} */ (u.name));
}

export function calculateChartData(results) {
    const apps = {};
    const taskNames = {};
    
    Object.keys(results).forEach(key => {
        const parts = key.split(' - ');
        if (parts.length < 3) return;
        const [taskName, guide, runType] = parts;

        if (!['guided', 'unguided'].includes(runType)) return;
        const scenario = `${taskName} (${guide})`;
        if (!apps[scenario]) apps[scenario] = { guided: [], unguided: [] };
        
        const runs = results[key];
        if (runs.length > 0 && runs[0].taskName) {
            taskNames[scenario] = runs[0].taskName;
        }
        
        const passed = runs.reduce((acc, r) => acc + getRunStats(r.results).passed, 0);
        const total = runs.reduce((acc, r) => acc + r.results.length, 0);
        apps[scenario][runType].push(total > 0 ? (passed / total) * 100 : 0);
    });
    
    const labels = Object.keys(apps).sort((a, b) => {
        const taskA = taskNames[a] || a;
        const taskB = taskNames[b] || b;
        return taskA.localeCompare(taskB);
    });
    const getAvg = (l, type) => {
        const s = apps[l][type];
        return s.length > 0 ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : 0;
    };
    return { labels, guided: labels.map(l => getAvg(l, 'guided')), unguided: labels.map(l => getAvg(l, 'unguided')) };
}


export function formatTestName(name) {
    if (!name) return name;
    return name.split(' - ').join(' / ');
}

// Google Identity Services (One Tap & Button) Integration
const GOOGLE_CLIENT_ID = '169412140096-fk4rtf6iqk982d43385s1ilucrda91g2.apps.googleusercontent.com';
let idToken = localStorage.getItem('gsi_id_token') || null;

export function getIdToken() {
    return idToken;
}

export function initOneTap(onAuthSuccess, onPromptMoment) {
    if (!window.google || !window.google.accounts) {
        setTimeout(() => initOneTap(onAuthSuccess, onPromptMoment), 50);
        return;
    }

    const handleResponse = (response) => {
        console.log('Logged in via Google Identity Services.');
        idToken = response.credential;
        localStorage.setItem('gsi_id_token', idToken);
        
        const authBtn = document.getElementById('auth-btn');
        if (authBtn) {
            authBtn.textContent = 'Authenticated ✓';
            authBtn.disabled = true;
            authBtn.style.backgroundColor = 'var(--accent-success)';
            authBtn.style.color = 'white';
            authBtn.style.borderColor = 'var(--accent-success)';
        }
        
        if (onAuthSuccess) onAuthSuccess(idToken);
    };

    window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        use_fedcm: true,
        callback: handleResponse
    });
    
    // Render the fallback button if container exists
    const btnContainer = document.getElementById('google-btn-container');
    if (btnContainer) {
        window.google.accounts.id.renderButton(btnContainer, { theme: "outline", size: "large" });
    }

    window.google.accounts.id.prompt((notification) => {
        if (onPromptMoment) onPromptMoment(notification);
    });
}

export async function authenticatedFetch(url, options = {}) {
    if (idToken) {
        options.headers = options.headers || {};
        options.headers['Authorization'] = `Bearer ${idToken}`;
    }
    const res = await fetch(url, options);
    if (res.status === 401) {
        console.warn('ID Token expired or invalid. Clearing token.');
        localStorage.removeItem('gsi_id_token');
        idToken = null;
        
        // Reset button UI if available
        const authBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('auth-btn'));
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

/**
 * @template {string} T
 * @typedef {T extends `${infer TagName}#${string}` 
 *   ? TagName extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[TagName] : TagName extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[TagName] : HTMLElement 
 *   : T extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[T] : T extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[T] : HTMLElement} ParseSelector
 */

/**
 * Guaranteed querySelector. Always returns an element or throws if nothing matches.
 * @template {string} T
 * @param {T} query
 * @param {ParentNode=} context
 * @return {ParseSelector<T>}
 */
export function $(query, context) {
  const result = (context || document).querySelector(query);
  if (result === null) {
    throw new Error(`querySelector('${query}') not found`);
  }
  return /** @type {ParseSelector<T>} */ (result);
}

