/**
 * Adaptive Loading Script
 * 
 * Checks for network conditions and conditionally swaps the image source
 * to the placeholder URL if the network is detected as slow.
 */

// Basic check for Network Information API support
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

function updateImageLoading() {
    const images = document.querySelectorAll('img[loading-placeholder]');
    
    // Determine if we should load the placeholder
    let isSlow = false;
    
    if (connection) {
        // ECT: 'slow-2g', '2g', '3g', or '4g'
        const effectiveType = connection.effectiveType;
        const saveData = connection.saveData; // User preference for data saving
        
        console.log(`[Adaptive Loading] ECT: ${effectiveType}, SaveData: ${saveData}`);
        
        if (saveData === true || effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g') {
            isSlow = true;
        }
    } else {
        console.log('[Adaptive Loading] Network Information API not supported.');
    }
    
    // For testing purposes: You can force isSlow = true by uncommenting next line
    // isSlow = true; 

    if (isSlow) {
        images.forEach(img => {
            const placeholder = img.getAttribute('loading-placeholder');
            if (placeholder) {
                console.log(`[Adaptive Loading] Switching to placeholder for ${img.alt}`);
                // Store original src in data attribute just in case
                img.setAttribute('data-original-src', img.src);
                img.src = placeholder;
            }
        });
    }
}

// Run on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateImageLoading);
} else {
    updateImageLoading();
}

// Listen for network changes (if supported)
if (connection) {
    connection.addEventListener('change', updateImageLoading);
}
