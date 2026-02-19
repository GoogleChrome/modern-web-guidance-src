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
