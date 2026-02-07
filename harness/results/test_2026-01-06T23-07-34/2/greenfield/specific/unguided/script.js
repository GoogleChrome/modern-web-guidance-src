document.addEventListener('DOMContentLoaded', () => {
    // 1. Adaptive Loading Logic
    const heroImg = document.getElementById('hero-img');
    const placeholderSrc = 'assets/hero-coffee-placeholder.svg';
    const highResSrc = 'assets/hero-coffee.svg';

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    const setupImage = () => {
        let isSlow = false;
        
        if (connection) {
            // Check for saveData or slow connection types
            if (connection.saveData === true) {
                isSlow = true;
            } else if (['slow-2g', '2g', '3g'].includes(connection.effectiveType)) {
                // Considering 3g as slow for a "cinematic" 8k like image, 
                // but usually 3g is acceptable. Let's stick to strict "slow" definitions or user preference.
                // Prompt said "slow networks".
                isSlow = true;
            }
        }

        console.log(`Network status: ${connection ? connection.effectiveType : 'unknown'}, SaveData: ${connection ? connection.saveData : 'unknown'}`);

        if (isSlow) {
            console.log('Loading placeholder image');
            heroImg.src = placeholderSrc;
        } else {
            console.log('Loading high-res image');
            heroImg.src = highResSrc;
        }
    };

    setupImage();

    // Listen for connection changes if supported
    if (connection) {
        connection.addEventListener('change', setupImage);
    }

    // 2. Popover Hover Trigger
    const popoverBtn = document.getElementById('details-btn');
    const popover = document.getElementById('ingredients-popover');
    
    // Safety check for browser support
    if (popover && popover.showPopover) {
        let timeoutId;

        const show = () => {
            clearTimeout(timeoutId);
            try {
                popover.showPopover();
            } catch (e) {
                // Already open or other state issue
            }
        };

        const hide = () => {
            // Small delay to allow moving mouse to the popover if needed, 
            // though standard popover behavior with backdrop might make interaction tricky 
            // if it's "non-modal" (prompt said non-modal). 
            // HTML `popover` attribute defaults to "auto" which handles light dismissal.
            // "non-modal" usually implies `popover="manual"` or similar, but standard `popover` is non-modal in the sense it doesn't trap focus strictly like a dialog, but "auto" does have "light dismiss".
            // If "non-modal" means it doesn't block the page interaction, we should use `popover="manual"`.
            // BUT `popover="auto"` is generally better for "popup" behavior.
            // The prompt says "triggers a non-modal popover".
            // If I use `popover="manual"`, I have to manage closing it myself completely (clicking outside won't close it).
            // `popover="auto"` allows light dismiss.
            
            // Let's stick to hovering the button.
            timeoutId = setTimeout(() => {
                try {
                    popover.hidePopover();
                } catch (e) {
                    // Already closed
                }
            }, 300);
        };

        popoverBtn.addEventListener('mouseenter', show);
        popoverBtn.addEventListener('mouseleave', () => {
            // Check if we moved to the popover
             // If we want to allow hovering the popover itself:
             // We need to add listeners to the popover too.
             hide();
        });

        popover.addEventListener('mouseenter', () => {
            clearTimeout(timeoutId);
        });

        popover.addEventListener('mouseleave', hide);
        
        // Ensure manual clicks also work nicely (controlled by popovertarget in HTML)
        // Actually if we simply use hover, we might conflict with opacity transition if slightly off. 
        // With `popover` API, `showPopover` throws if already showing? No, it just works? 
        // Actually it might throw "InvalidStateError" if already open? 
        // MDN says: "If the popover is already in the showing state, this method does nothing." - Wait, need to verify.
    }
});
