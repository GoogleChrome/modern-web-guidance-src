// Adaptive Loading
document.addEventListener('DOMContentLoaded', () => {
    const heroImage = document.getElementById('hero-image');
    if (!heroImage) return;

    // High res image
    const highResUrl = 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=1600&auto=format&fit=crop';
    // Low res / Placeholder image
    const lowResUrl = 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=40&w=400&auto=format&fit=crop';

    let useHighRes = true;

    if (navigator.connection) {
        const connection = navigator.connection;
        // Check for slow connection
        if (connection.saveData === true || 
            connection.effectiveType === 'slow-2g' || 
            connection.effectiveType === '2g' || 
            connection.effectiveType === '3g') {
            useHighRes = false;
        }
    }

    heroImage.src = useHighRes ? highResUrl : lowResUrl;
    console.log(`Loaded ${useHighRes ? 'High' : 'Low'} resolution hero image.`);
});

// Popover Hover Interaction
document.addEventListener('DOMContentLoaded', () => {
    // Map of trigger button ID to popover ID
    const triggers = [
        { btnId: 'details-latte', popId: 'popover-latte' },
        { btnId: 'details-coldbrew', popId: 'popover-coldbrew' }
    ];

    triggers.forEach(pair => {
        const btn = document.getElementById(pair.btnId);
        const pop = document.getElementById(pair.popId);

        if (btn && pop) {
            // Function to show popover
            const show = () => {
                // Check if already open to avoid error
                if (!pop.matches(':popover-open')) {
                    pop.showPopover();
                }
            };

            // Function to hide popover
            const hide = () => {
                 if (pop.matches(':popover-open')) {
                    pop.hidePopover();
                }
            };

            // Event listeners
            btn.addEventListener('mouseenter', show);
            btn.addEventListener('mouseleave', hide);
            
            // Also handle focus for keyboard users
            btn.addEventListener('focus', show);
            btn.addEventListener('blur', hide);

            // Keep it open if user moves mouse into the popover itself (optional but good UX)
            pop.addEventListener('mouseenter', show);
            pop.addEventListener('mouseleave', hide);
        }
    });
});
