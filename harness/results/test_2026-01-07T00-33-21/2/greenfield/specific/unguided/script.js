document.addEventListener('DOMContentLoaded', () => {
    // --- Adaptive Loading Logic ---
    const heroImg = document.getElementById('hero-image');
    const { isSlow } = window.adaptiveContext || { isSlow: false };
    
    // URLs for diff qualities (using placeholders for demo as generation failed)
    const highResUrl = 'https://picsum.photos/id/1060/1200/900'; // Coffee-like image
    const lowResUrl = 'https://picsum.photos/id/1060/400/300?blur=5'; // Same image, small & blurred

    if (isSlow) {
        console.log('Slow connection detected. Loading optimized assets.');
        heroImg.src = lowResUrl;
        heroImg.alt = "Steaming cup of coffee (Low Bandwidth Mode)";
    } else {
        console.log('Fast connection detected. Loading high-res assets.');
        heroImg.src = highResUrl;
    }

    // --- Popover Hover Interaction ---
    // The Popover API is declarative for click, but for hover we need JS helper.
    // Spec says 'popovertarget' handles toggling on click.
    // For hover, we can manually show/hide or trigger the click.
    
    const detailsBtn = document.querySelector('.details-btn');
    const popover = document.getElementById('ingredients-popover');

    // We want "triggers... when a user HOVERS over it"
    // And ideally hides when they leave, or stays open? 
    // Usually hover popovers are transient.
    
    if (detailsBtn && popover) {
        detailsBtn.addEventListener('mouseenter', () => {
            // Show the popover if not already open
            // manual toggle via showPopover()
            try {
                popover.showPopover();
            } catch (e) {
                // Fallback for older browsers if polyfill missing (though we assume native support as requested)
                console.warn('Popover API not supported or error:', e);
            }
        });

        // Optional: Hide on mouseleave?
        // User didn't strictly say "hide on leave", but "hover triggers it".
        // It's annoying if it stays stuck open after hover.
        // Let's add mouseleave logic for the button AND the popover itself (so you can hover into it).
        
        let closeTimeout;

        const scheduleClose = () => {
            closeTimeout = setTimeout(() => {
                try {
                    popover.hidePopover();
                } catch(e){}
            }, 300); // slight delay
        };

        const cancelClose = () => {
            if (closeTimeout) clearTimeout(closeTimeout);
        };

        detailsBtn.addEventListener('mouseleave', scheduleClose);
        
        // If user moves mouse INTO the popover, keep it open
        popover.addEventListener('mouseenter', cancelClose);
        popover.addEventListener('mouseleave', scheduleClose);
    }
});
