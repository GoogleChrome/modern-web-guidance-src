document.addEventListener('DOMContentLoaded', () => {
    // 1. Adaptive Loading
    const heroImage = document.getElementById('hero-image');
    const highRes = heroImage.dataset.highRes;
    const lowRes = heroImage.dataset.lowRes;

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    let isSlow = false;

    if (connection) {
        if (connection.saveData === true) {
            isSlow = true;
        } else {
            const effectiveType = connection.effectiveType; // 'slow-2g', '2g', '3g', '4g'
            if (effectiveType === 'slow-2g' || effectiveType === '2g') {
                isSlow = true;
            }
        }
    }

    // Set the source based on network condition
    heroImage.src = isSlow ? lowRes : highRes;
    
    if (isSlow) {
        console.log('Slow connection detected. Loading low-res image.');
        heroImage.style.filter = 'blur(5px)'; // Visual cue for low-res
    } else {
        console.log('Fast connection detected. Loading high-res image.');
    }

    // 2. Hover Popover Logic
    // Prompt: 'triggers a non-modal popover when a user hovers over it'
    const detailsBtn = document.getElementById('details-btn');
    const popover = document.getElementById('ingredients-popover');
    
    // Check if Popover API is supported
    if (detailsBtn && popover && popover.showPopover) {
        
        const showPopover = () => {
             try {
                 popover.showPopover();
             } catch (e) {
                 // Already open or other state issue
             }
        };

        const hidePopover = () => {
            try {
                popover.hidePopover();
            } catch (e) {
                // Already hidden
            }
        };

        // Show on enter
        detailsBtn.addEventListener('mouseenter', showPopover);
        detailsBtn.addEventListener('focus', showPopover);

        // Hide on leave
        detailsBtn.addEventListener('mouseleave', hidePopover);
        detailsBtn.addEventListener('blur', hidePopover);
        
        // Also hide if we leave the popover itself (if user moves mouse to popover)
        // Note: For a pure hover tooltip experience, we often want the user to be able to hover the tooltip too.
        // But if the tooltip is far away, it might close. 
        // With Anchor Positioning, it should be close.
        
    } else {
        console.warn('Popover API not supported in this browser.');
    }
});
