document.addEventListener('DOMContentLoaded', () => {
    // --- Popover Logic ---
    const detailsBtn = document.getElementById('detailsBtn');
    const popover = document.getElementById('ingredientsPopover');
    
    // We want hover behavior, but popover API is usually click/toggle.
    // We can manually show/hide on mouse events.
    
    detailsBtn.addEventListener('mouseenter', () => {
        try {
            // Check if already open to avoid error
             if (!popover.matches(':popover-open')) {
                popover.showPopover();
                
                // Optional: Basic positioning workaround since anchor positioning is not fully cross-browser yet
                // or we just let it be centered (default). 
                // Let's improve positioning slightly to be near the button if possible,
                // but native popover center is fine for "non-modal" if styling permits.
                // Actually, "non-modal popover" usually implies manual positioning or anchor.
                // Let's just keep it simple as requested "triggers a non-modal popover".
             }
        } catch (e) {
            console.error('Popover not supported or error:', e);
        }
    });

    detailsBtn.addEventListener('mouseleave', () => {
        // We might want a small delay to allow moving to the popover, 
        // but for strict "hover over button" -> "show", "leave button" -> "hide":
        setTimeout(() => {
             // Check if we are hovering the popover itself? 
             // For strict UI, maybe we hide it. 
             try {
                popover.hidePopover();
             } catch(e){}
        }, 100);
    });
    
    // --- Adaptive Loading Logic ---
    const heroImg = document.getElementById('heroImg');
    const highResUrl = 'https://placehold.co/1200x800/1a1a1a/d4a373?text=Artisan+Coffee+High-Res'; 
    const lowResUrl = 'https://placehold.co/600x400/1a1a1a/d4a373?text=Artisan+Coffee+Low-Res'; // Simulating placeholder

    const updateImage = () => {
        let isSlow = false;
        
        if (navigator.connection) {
            if (navigator.connection.saveData === true || 
                ['slow-2g', '2g', '3g'].includes(navigator.connection.effectiveType)) {
                isSlow = true;
                console.log('Slow connection detected. Loading low-res image.');
            }
        }
        
        heroImg.src = isSlow ? lowResUrl : highResUrl;
    };

    updateImage();
    
    // Listen for connection changes if available
    if (navigator.connection) {
        navigator.connection.addEventListener('change', updateImage);
    }
});
