
document.addEventListener('DOMContentLoaded', () => {
    // 1. Adaptive Loading
    const heroImg = document.getElementById('hero-img');
    const placeholderSrc = 'coffee_hero_placeholder.png';
    const highResSrc = 'coffee_hero.png';

    // Check network connection
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (connection) {
        console.log(`Effective connection type: ${connection.effectiveType}`);
        console.log(`SaveData: ${connection.saveData}`);
        
        // If slow connection or save data is on
        const isSlow = connection.saveData || 
                      (connection.effectiveType && ['slow-2g', '2g', '3g'].includes(connection.effectiveType));
        
        if (isSlow) {
            console.log('Slow connection detected. Loading placeholder.');
            heroImg.src = placeholderSrc;
        } else {
            console.log('Fast connection detected. Loading high-res image.');
            heroImg.src = highResSrc;
        }
    } else {
        // Fallback for browsers without Network Information API
        heroImg.src = highResSrc;
    }

    // 2. Popover Behavior (Hover)
    // Notes: The popover attribute provides click toggle by default.
    // We want HOVER behavior.
    
    const detailsBtn = document.querySelector('.details-btn');
    const popover = document.getElementById('ingredients-popover');
    
    if (detailsBtn && popover) {
        // Show on mouse enter
        detailsBtn.addEventListener('mouseenter', () => {
             try {
                popover.showPopover();
             } catch (e) {
                // Ignore if already open or not supported
             }
        });

        // Hide on mouse leave (from both button and popover to allow hovering content)
        // Actually, usually we might want to keep it open if user moves to popover
        
        let timeoutId;

        const hidePopover = () => {
            timeoutId = setTimeout(() => {
                try {
                    popover.hidePopover();
                } catch (e) {}
            }, 100); // Small delay
        };

        const cancelHide = () => {
            clearTimeout(timeoutId);
        };

        detailsBtn.addEventListener('mouseleave', hidePopover);
        popover.addEventListener('mouseenter', cancelHide);
        popover.addEventListener('mouseleave', hidePopover);
    }
});
