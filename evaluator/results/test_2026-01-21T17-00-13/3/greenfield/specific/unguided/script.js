document.addEventListener('DOMContentLoaded', () => {
    initAdaptiveLoading();
    initPopoverHover();
});

/**
 * Adaptive Loading Logic
 * specific/unguided/script.js
 */
function initAdaptiveLoading() {
    const heroImg = document.getElementById('hero-img');
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    // Default to high quality if connection API is not supported
    // But honestly, if it's not supported, we might just default to high or let the browser decide.
    // Here we explicitly check for slow connections.
    
    let isSlow = false;
    
    if (connection) {
        // Check for Save-Data mode or slow effective connection type
        if (connection.saveData === true || 
            connection.effectiveType === 'slow-2g' || 
            connection.effectiveType === '2g' || 
            connection.effectiveType === '3g') { // treating 3g as "slow" for high-res image context might be good
            isSlow = true;
            console.log('Adaptive Loading: Slow connection detected. Loading low-res image.');
        } else {
            console.log('Adaptive Loading: Fast connection detected. Loading high-res image.');
        }
    }

    const src = isSlow ? heroImg.dataset.srcLow : heroImg.dataset.srcHigh;
    
    // Apply the source
    heroImg.src = src;
    
    // Optional: Listen for connection changes
    if (connection) {
        connection.addEventListener('change', () => {
            // If connection improves effectively, we *could* upgrade, but maybe distracting.
            // We'll stick to initial decision for stability vs jumping content.
             console.log(`Connection type changed from ${connection.effectiveType} to ${connection.effectiveType}`);
        });
    }
}

/**
 * Popover Hover Logic
 * The Popover API is click-based by default (toggle). We want hover.
 */
function initPopoverHover() {
    const detailsBtn = document.getElementById('details-btn');
    const popover = document.getElementById('ingredients-popover');
    let timeoutId;

    const showPopover = () => {
        clearTimeout(timeoutId);
        try {
            popover.showPopover();
        } catch (e) {
            // Already open or not supported? 
            // showPopover throws if already open in some implementations, checks exist.
            if (!popover.matches(':popover-open')) {
                console.error(e);
            }
        }
    };

    const hidePopover = () => {
        timeoutId = setTimeout(() => {
            try {
                popover.hidePopover();
            } catch (e) {
                // Ignore
            }
        }, 300); // 300ms delay to allow moving to popover
    };

    // Button Events
    detailsBtn.addEventListener('mouseenter', showPopover);
    detailsBtn.addEventListener('mouseleave', hidePopover);
    detailsBtn.addEventListener('focus', showPopover);
    detailsBtn.addEventListener('blur', hidePopover);

    // Popover Events (keep open when hovering the popover itself)
    popover.addEventListener('mouseenter', () => clearTimeout(timeoutId));
    popover.addEventListener('mouseleave', hidePopover);
}
