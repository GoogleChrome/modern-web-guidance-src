document.addEventListener('DOMContentLoaded', () => {
    /* ----------------------------------------------------------------
       Adaptive Loading Logic
       Uses Network Information API to serve appropriate image quality
    ---------------------------------------------------------------- */
    const heroImg = document.querySelector('.hero-img');
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    // High-quality image (Unsplash)
    const hqImage = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=2000&auto=format&fit=crop';
    // Low-quality placeholder (Unsplash, low quality & size)
    const lqImage = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=10&w=200&auto=format&fit=crop';

    const updateImageSource = () => {
        const effectiveType = connection ? connection.effectiveType : '4g';
        // Treat 4g as fast, everything else (2g, 3g, slow-2g) as slow for this demo
        const isSlow = effectiveType && (effectiveType.includes('2g') || effectiveType === '3g');
        
        console.log(`Network status: ${effectiveType}, Loading ${isSlow ? 'Low-Res' : 'High-Res'} Image`);
        
        if (isSlow) {
            heroImg.src = lqImage;
            heroImg.style.filter = 'blur(10px)'; // Add blur for lo-fi feel
        } else {
            heroImg.src = hqImage;
            heroImg.style.filter = '';
        }
    };

    // Initial check
    updateImageSource();

    // Listen for connection changes
    if (connection) {
        connection.addEventListener('change', updateImageSource);
    }

    /* ----------------------------------------------------------------
       Popover Logic (Hover Trigger)
       Uses native Popover API with JS triggers for hover Effect
    ---------------------------------------------------------------- */
    const detailsBtn = document.getElementById('details-btn');
    const popover = document.getElementById('ingredients-popover');

    if (detailsBtn && popover) {
        
        const showPopover = () => {
            try {
                // Determine position manually since CSS Anchor Positioning is not fully universal yet
                // We want it centered above the button
                const btnRect = detailsBtn.getBoundingClientRect();
                
                // We need the popover to be visible/layout to get its dimensions, 
                // but showPopover() does that.
                // However, popover defaults to fixed position usually or we set absolute.
                // To avoid flash, we can set visibility hidden first if needed, but let's try direct.
                popover.showPopover();
                
                const popRect = popover.getBoundingClientRect();
                
                const top = btnRect.top + window.scrollY - popRect.height - 15; // 15px gap
                const left = btnRect.left + window.scrollX + (btnRect.width / 2) - (popRect.width / 2);
                
                popover.style.top = `${top}px`;
                popover.style.left = `${left}px`;
                
            } catch (e) {
                // Fallback or already shown
            }
        };

        const hidePopover = () => {
            try {
                popover.hidePopover();
            } catch (e) {
                // already hidden
            }
        };

        detailsBtn.addEventListener('mouseenter', showPopover);
        detailsBtn.addEventListener('mouseleave', hidePopover);
        
        // Also allow hovering the popover itself? The prompt says "triggers... when a user hovers over IT [the button]".
        // Usually valid UX allows hovering the content too, but strict reading suggests just button.
        // We will keep it simple.
    }
});
