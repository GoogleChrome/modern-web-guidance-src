// script.js

// Feature Detection and Polyfill Loading
// This ensures our modern features work across environments that might not support them yet.

(async function init() {
    console.log("Initializing Coffee Shop App...");

    // 1. Check for Popover API
    const supportsPopover = HTMLElement.prototype.hasOwnProperty("popover");
    if (!supportsPopover) {
        console.log("Popover API not supported. Loading polyfill...");
        await loadScript("https://unpkg.com/@oddbird/popover-polyfill@0.6.1/dist/popover.min.js");
    }

    // 2. Check for Interest Invokers (interestfor attribute)
    // Note: 'interestForElement' is a proposed property.
    const supportsInterest = HTMLButtonElement.prototype.hasOwnProperty("interestForElement");
    if (!supportsInterest) {
        console.log("Interest Invokers not supported. Loading polyfill...");
        await loadScript("https://unpkg.com/interestfor@1.0.7/src/interestfor.min.js");
    }

    // 3. Check for CSS Anchor Positioning
    // We can't easily polyfill CSS anchor positioning perfectly in JS without layout thrashing, 
    // but @oddbird/css-anchor-positioning is a good attempt.
    const supportsAnchor = CSS.supports("position-anchor: --foo");
    if (!supportsAnchor) {
         console.log("CSS Anchor Positioning not supported. Loading polyfill...");
         await loadScript("https://unpkg.com/@oddbird/css-anchor-positioning@0.8.0/dist/css-anchor-positioning.js");
    }

    // 4. Adaptive Loading Logic
    // If the browser doesn't natively support loading-placeholder (which none do yet as it is experimental),
    // we implement the logic here using the Network Information API.
    handleAdaptiveLoading();

})();

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function handleAdaptiveLoading() {
    const images = document.querySelectorAll('img[loading-placeholder]');
    
    if (images.length === 0) return;

    // Check Network Information API
    // Note: navigator.connection is supported in Chrome/Edge/Android
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (connection) {
        console.log(`Effective connection type: ${connection.effectiveType}`);
    }

    // Simple heuristic: if we are on 2g/3g or if save-data is on, use the placeholder.
    // In a real browser implementation of this attribute, the browser would decide.
    const isSlow = connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g' || connection.effectiveType === '3g' || connection.saveData);
    
    // For demonstration purposes, we will ALSO check a query param `?force-slow=true` to easily test this.
    const urlParams = new URLSearchParams(window.location.search);
    const forceSlow = urlParams.get('force-slow') === 'true';

    if (isSlow || forceSlow) {
        console.log("Slow network detected (or forced). Using placeholders.");
        
        images.forEach(img => {
            const placeholder = img.getAttribute('loading-placeholder');
            const originalSrc = img.getAttribute('src');
            
            if (placeholder) {
                // Swap src to placeholder
                img.src = placeholder;
                
                // Optional: We could lazily load the high-res one if the user stops scrolling, etc.
                // But for "Adaptive Loading" we often just want to serve the lighter version.
                // However, let's make it a "progressive" load for better UX if it's just slow-ish.
                // Actually, let's keep it simple: stick to placeholder to save data, 
                // but maybe load high-res on click or if network improves.
                
                // Let's implement a 'click to load high-res' pattern for these images?
                // Or just leave them as low-res to save data (pure adaptive loading).
                // Let's stick to the prompt: "load a low-quality placeholder first"
                // It implies the high quality one comes later? Or replaces it? 
                // "load a low-quality placeholder first if the user is on a slow network"
                // This usually implies progressive enhancement.
                
                // Let's try to load the high-res one in background effectively?
                // Or just show placeholder. 
                // If I just show placeholder, it might look bad forever.
                // Let's swap it back to high-res after 'load' event of the window maybe? 
                // Or just keep the placeholder if it's *really* slow.
                
                // Let's assume for this demo we WANT the high res eventually, just placeholder first.
                // So we do: src = placeholder. 
                // Then create a new Image() for high-res. When that loads, swap it in.
                
                const highResLoader = new Image();
                highResLoader.src = originalSrc;
                highResLoader.onload = () => {
                   console.log("High-res image loaded in background. Swapping.");
                   img.src = originalSrc;
                   img.classList.add('high-res-loaded'); // for potential CSS transitions
                };
            }
        });
    } else {
        console.log("Fast network detected. Using high-res images directly.");
    }
}
