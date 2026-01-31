/**
 * Adaptive Loading & Polyfill Logic
 */

// 1. Adaptive Loading Logic
function initAdaptiveLoading() {
    if (!('loadingPlaceholder' in HTMLImageElement.prototype)) {
        console.log('Native loading-placeholder not supported, applying manual adaptive loading...');
        
        // Check network connection
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        const isSlow = connection && (
            connection.saveData || 
            ['slow-2g', '2g', '3g'].includes(connection.effectiveType)
        );

        if (isSlow) {
            console.log('Network is slow (or saveData is on), switching to placeholders.');
            const images = document.querySelectorAll('img[loading-placeholder]');
            
            images.forEach(img => {
                const placeholder = img.getAttribute('loading-placeholder');
                if (placeholder) {
                    // Create a temp image to verify it loads? 
                    // Or just swap it. For this demo, we swap.
                    img.src = placeholder;
                }
            });
        }
    }
}

// 2. Load Polyfills if needed
async function loadPolyfills() {
    // Interest Invokers (Interest For)
    if (!HTMLButtonElement.prototype.hasOwnProperty("interestForElement")) {
        console.log('Loading interestfor polyfill...');
        // In a real app we'd load from local or CDN. For this demo we'll inject a script tag.
        // Using unpkg as per best practices in prompt (but we are in offline env potentially, 
        // however the user requests native features, so we assume some connectivity or we should have downloaded it.
        // I will attempt to load it from CDN.)
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/interestfor@1.0.7/src/interestfor.min.js';
        script.type = 'module';
        document.body.appendChild(script);
    }

    // CSS Anchor Positioning
    if (!("positionAnchor" in document.documentElement.style)) {
        console.log('Loading css-anchor-positioning polyfill...');
        const script = document.createElement('script');
        // This polyfill is quite heavy, but necessary for the anchor positioning without native support
        script.src = 'https://unpkg.com/@oddbird/css-anchor-positioning@0.8.0/dist/css-anchor-positioning.js';
        script.type = 'module';
        document.body.appendChild(script);
    }
}

// Initialize
initAdaptiveLoading();
loadPolyfills();
