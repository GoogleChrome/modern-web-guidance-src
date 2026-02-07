(function() {
  if ('loadingPlaceholder' in HTMLImageElement.prototype) return;

  function handleAdaptiveLoading() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const isSlow = connection && ['slow-2g', '2g', '3g'].includes(connection.effectiveType);
    
    if (isSlow) {
      document.querySelectorAll('img[loading-placeholder]').forEach(img => {
        const placeholder = img.getAttribute('loading-placeholder');
        if (placeholder) {
          // Store original src to maybe load later or let user request it
          img.dataset.originalSrc = img.src;
          img.src = placeholder;
        }
      });
    }
  }

  // Run early
  handleAdaptiveLoading();
  // And on load just in case
  window.addEventListener('DOMContentLoaded', handleAdaptiveLoading);
})();
