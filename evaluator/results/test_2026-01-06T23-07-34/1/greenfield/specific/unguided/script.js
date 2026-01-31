document.addEventListener('DOMContentLoaded', () => {
    // Adaptive Loading
    const heroBg = document.getElementById('hero-image');
    if (navigator.connection && navigator.connection.saveData) {
        // User asked for reduced data usage
        heroBg.classList.add('low-res');
        console.log('Adaptive Loading: Low-res mode enabled (saveData=true)');
    } else {
        // Normal mode
        heroBg.classList.add('high-res');
        console.log('Adaptive Loading: High-res mode enabled');
    }

    // Popover Trigger on Hover
    const detailsBtn = document.getElementById('details-btn');
    const popover = document.getElementById('ingredients-popover');

    // We use the Popover API's showPopover/hidePopover methods
    // Since it's "manual" triggering via hover, we might need popover="manual" if we want to control it fully,
    // or keep it "auto" and just trigger it. "auto" has light-dismiss.
    
    // To make it behave nicely on hover:
    // Mouseenter button -> show
    // Mouseleave button -> hide (maybe with a delay to allow moving to popover?)
    // But usually hover popovers are tricky. Let's try simple show on enter, hide on leave.
    
    let hideTimeout;

    const show = () => {
        clearTimeout(hideTimeout);
        try {
            popover.showPopover();
            // Position it near the button if we want (simple bounding box math)
            // Or rely on CSS centering for now as per previous CSS.
            // If we want it strictly "next to" the button without Anchor API:
            const rect = detailsBtn.getBoundingClientRect();
            // This is basic, might need adjustment for scroll
            popover.style.top = `${rect.bottom + window.scrollY + 10}px`;
            popover.style.left = `${rect.left + window.scrollX}px`;
            popover.style.transform = 'none'; // Overriding CSS center transform
        } catch (e) {
            // popover might already be open
        }
    };

    const hide = () => {
        hideTimeout = setTimeout(() => {
            try {
                popover.hidePopover();
            } catch (e) {
                // popover might already be closed
            }
        }, 200); // short delay
    };

    detailsBtn.addEventListener('mouseenter', show);
    detailsBtn.addEventListener('mouseleave', hide);
    
    // Also keep it open if hovering the popover itself
    popover.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
    popover.addEventListener('mouseleave', hide);
});
