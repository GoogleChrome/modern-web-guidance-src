// Import Polyfills
import 'interestfor';
import '@oddbird/popover-polyfill';
import '@oddbird/css-anchor-positioning';

// Adaptive Loading Logic
// Checks for loading-placeholder support or implements simple fallback
if (!('loadingPlaceholder' in HTMLImageElement.prototype)) {
  // Simple check for "slow" connection if Network Information API is available
  // This is a basic simulation of the behavior since we don't have the full native implementation
  // in all browsers yet.
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const isSlow = connection ? (connection.saveData || /2g|3g/.test(connection.effectiveType)) : false;

  if (isSlow) {
    const images = document.querySelectorAll('img[loading-placeholder]');
    images.forEach(img => {
      const placeholder = img.getAttribute('loading-placeholder');
      if (placeholder) {
        // Swap src to placeholder
        // Store original src
        const originalSrc = img.getAttribute('src');
        img.dataset.originalSrc = originalSrc;
        img.src = placeholder;
        
        // Optionally load original if user interacts or after delay?
        // For strict "Adaptive Loading" pattern, we keep it low-res on slow networks 
        // until maybe explicit action or load.
        console.log(`[Adaptive Loading] Served placeholder for ${originalSrc} due to slow network.`);
      }
    });
  }
}
