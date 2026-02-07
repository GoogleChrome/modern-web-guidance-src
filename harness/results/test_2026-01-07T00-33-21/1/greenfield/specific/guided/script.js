/**
 * Adaptive Loading Script
 * 
 * Uses the Network Information API (navigator.connection) to determine if the user
 * is on a slow connection (effectiveType 'slow-2g', '2g', '3g') or has Save-Data enabled.
 * If so, it keeps the placeholder or loads the low-res image defined in `loading-placeholder`.
 * Otherwise, it loads the high-res image (src).
 */

(function initAdaptiveLoading() {
    const images = document.querySelectorAll('img[loading-placeholder]');

    images.forEach(img => {
        const placeholderSrc = img.getAttribute('loading-placeholder');
        const originalSrc = img.getAttribute('src');

        // Check Network Information API
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        let isSlow = false;
        
        if (connection) {
            // Check for Save-Data mode
            if (connection.saveData) {
                isSlow = true;
            }
            // Check for slow connection types
            const effectiveType = connection.effectiveType; // 'slow-2g', '2g', '3g', '4g'
            if (effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g') {
                isSlow = true;
            }
        }

        if (isSlow && placeholderSrc) {
            // If slow, we might want to ensure we are using the placeholder
            // But usually browsers fetch 'src' by default. We need to swap them if we want to SAVE data.
            // Ideally this runs before the parser fetches the image, but in JS it might be too late for the initial request 
            // unless we use <img src="placeholder" data-src="high-res"> pattern.
            // HOWEVER, the prompt asked to use the `adaptive-loading` API "loading-placeholder" attribute strictly?
            // Actually the `loading-placeholder` is a proposed standard or custom implementation, so we are implementing the logic for it.
            
            // For true adaptive loading we should probably swap the src to the placeholder if it's not already.
            console.log('Adaptive Loading: Slow connection detected. Using placeholder.');
            img.src = placeholderSrc;
        } else {
            console.log('Adaptive Loading: Fast connection detected. Using high-res image.');
            // Ensure high-res is loaded
            img.src = originalSrc;
        }
    });

    // Log connection info for debugging
    if (navigator.connection) {
         console.log(`Effective connection type: ${navigator.connection.effectiveType}`);
         console.log(`SaveData: ${navigator.connection.saveData}`);
    }
})();
