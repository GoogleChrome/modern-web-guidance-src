import '@oddbird/css-anchor-positioning/fn';
import '@oddbird/popover-polyfill';
import 'interestfor';

// Adaptive Loading Polyfill for loading-placeholder
if (!('loadingPlaceholder' in HTMLImageElement.prototype)) {
  const images = document.querySelectorAll('img[loading-placeholder]');
  
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const effectiveType = connection ? connection.effectiveType : '4g';
  const saveData = connection ? connection.saveData : false;

  // Logic: If connection is poor (limit to 2g/3g) or save-data is on, swap src with placeholder
  const isSlow = effectiveType.includes('2g') || effectiveType === '3g' || saveData;

  if (isSlow) {
    images.forEach(img => {
      const placeholder = img.getAttribute('loading-placeholder');
      if (placeholder) {
        // We want to load the placeholder INSTEAD of the src if we can intercept early enough,
        // but often the browser starts fetching src immediately.
        // For a true polyfill, we'd swap it ASAP.
        const originalSrc = img.getAttribute('src');
        img.src = placeholder;
        
        // Optional: Allow user to load high-res on click or lazily?
        // For this demo, we just show the placeholder and log it.
        console.log(`[Adaptive Loading] Served placeholder for ${originalSrc} due to slow connection (${effectiveType}).`);
      }
    });
  }
}
