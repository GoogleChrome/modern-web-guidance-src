document.addEventListener('DOMContentLoaded', () => {
    // Adaptive Loading Logic
    const heroImg = document.getElementById('hero-img');
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    const setHeroImage = () => {
        let isSlow = false;
        
        if (connection) {
            // Check for save-data mode or slow connection
            if (connection.saveData === true) {
                isSlow = true;
            } else if (['slow-2g', '2g', '3g'].includes(connection.effectiveType)) {
                // Considering 3g as "slow" enough to retain placeholder or load lighter image
                // Prompt said "slow networks", 3g is borderline, let's keep it safe.
                isSlow = true;
            }
        }

        if (isSlow) {
            console.log('Slow connection detected. Loading low-res image.');
            heroImg.src = 'assets/hero-low-res.svg';
        } else {
            console.log('Fast connection detected. Loading high-res image.');
            heroImg.src = 'assets/hero-high-res.svg';
        }
    };

    setHeroImage();

    // Listen for connection changes (optional, but good practice)
    if (connection) {
        connection.addEventListener('change', setHeroImage);
    }

    // Popover Hover Logic
    // Requirement: "Details" button triggers non-modal popover ON HOVER.
    
    const detailsBtn = document.getElementById('details-btn');
    const popover = document.getElementById('ingredients-popover');

    if (detailsBtn && popover) {
        // Show on mouseenter
        detailsBtn.addEventListener('mouseenter', () => {
            try {
                // showPopover() throws if already open, but "manual" popovers tolerate it usually or we check
                popover.showPopover();
            } catch (e) {
                // Ignore if already open
            }
        });

        // Hide on mouseleave
        // To make it usable, we should potentially allow hovering the popover itself?
        // Basic requirement: "triggers a non-modal popover when a user hovers over it".
        // Often creates a flickering UX if you can't mouse to the popover.
        // I'll add a small delay or check bounds, but simplest valid satisfying implementation
        // is hiding when leaving the button.
        // Let's improve it slightly: hide only if not hovering popover.

        const hidePopover = () => {
            try {
                popover.hidePopover();
            } catch (e) {
                // Ignore
            }
        };

        detailsBtn.addEventListener('mouseleave', (e) => {
            // Give a tiny moment to move to popover if needed, or stick to strict "hover button"
            // For now, simple implementation:
            hidePopover();
        });
        
        // If we wanted to allow hovering the popover content (e.g. to copy ingredients),
        // we'd need more complex logic (timeout + cancel on popover enter).
        // Since requirements are simple, I'll stick to button hover for now.
    }
});
