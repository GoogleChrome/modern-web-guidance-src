document.addEventListener('DOMContentLoaded', () => {
    initAdaptiveLoading();
    initPopoverHover();
});

function initAdaptiveLoading() {
    const heroImg = document.getElementById('hero-img');
    const saveData = navigator.connection && navigator.connection.saveData;
    const effectiveType = navigator.connection && navigator.connection.effectiveType;
    
    // Logic: Use small image if Data Saver is on OR connection is 2g/slow-2g
    // Also consider '3g' possibly slow? Let's be strict for demo.
    const isSlow = saveData || (effectiveType && (effectiveType.includes('2g')));

    if (isSlow) {
        heroImg.src = 'hero-small.svg';
        console.log(`Adaptive Loading: Slow connection (${effectiveType}) or Save-Data (${saveData}). Loaded hero-small.svg`);
    } else {
        heroImg.src = 'hero-large.svg';
        console.log(`Adaptive Loading: Good connection (${effectiveType}). Loaded hero-large.svg`);
    }
}

function initPopoverHover() {
    const btn = document.querySelector('[popovertarget="ingredients-popover"]');
    const popover = document.getElementById('ingredients-popover');
    
    if (!btn || !popover) return;

    // Show on mouse enter
    btn.addEventListener('mouseenter', () => {
        try {
            popover.showPopover();
        } catch (e) {
            // Already open or error
        }
    });

    // Hide on mouse leave (details button)
    btn.addEventListener('mouseleave', (e) => {
        // We might want to keep it open if user moves to popover itself?
        // Simple implementation: close when leaving button.
        // But user said "triggers... when a user hovers over it".
        // Usually implies it might stay open? 
        // For simplicity: close when mouse leaves button.
        try {
            popover.hidePopover();
        } catch (e) {
            // Not open
        }
    });

    // Optional: Keep open if hovering strictly on popover?
    // Not explicitly requested ("triggers ... when user hovers over IT [the button]")
}
