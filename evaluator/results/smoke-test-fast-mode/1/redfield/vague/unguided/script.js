document.addEventListener('DOMContentLoaded', () => {
    const trigger = document.getElementById('tooltip-trigger');
    const tooltip = document.getElementById('tooltip');

    if (!trigger || !tooltip) return;

    const showTooltip = () => {
        tooltip.classList.add('is-visible');
        trigger.setAttribute('aria-expanded', 'true');
        tooltip.setAttribute('aria-hidden', 'false');
    };

    const hideTooltip = () => {
        tooltip.classList.remove('is-visible');
        trigger.setAttribute('aria-expanded', 'false');
        tooltip.setAttribute('aria-hidden', 'true');
    };

    // Mouse Interaction
    trigger.addEventListener('mouseenter', showTooltip);
    trigger.addEventListener('mouseleave', hideTooltip);

    // Keyboard Interaction
    trigger.addEventListener('focus', showTooltip);
    trigger.addEventListener('blur', hideTooltip);

    // Accessibility: Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && tooltip.classList.contains('is-visible')) {
            hideTooltip();
            trigger.focus(); // Return focus to trigger
        }
    });
});
