/**
 * Adaptive Image Loading
 * Uses Network Information API to determine if we should load the high-res image.
 */

document.addEventListener('DOMContentLoaded', () => {
    const heroImage = document.getElementById('hero-image');
    
    if (!heroImage) return;

    const highResSrc = heroImage.getAttribute('data-high-res');
    
    // Function to update image source
    const updateImageQuality = () => {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        if (connection) {
            console.log(`Current connection type: ${connection.effectiveType}`);
            
            // If connection is 4g or it's not available (assume fast), load high res
            // Actually, if !connection, we usually assume fast or let browser decide (but here we manual swap).
            // Let's be conservative: if undefined, try high res? Or adhere to user "load low quality first".
            // Implementation: We ALREADY loaded low quality (in src).
            // So we only swap if we are CONFIDENT it is fast.
            
            if (connection.effectiveType === '4g' && !connection.saveData) {
                // Preload high res
                const img = new Image();
                img.src = highResSrc;
                img.onload = () => {
                   heroImage.src = highResSrc;
                   heroImage.style.filter = 'none'; // Remove blur if we had it
                };
            }
        } else {
            // Fallback for no API support - Load high res anyway to not punish desktop users without the API?
            // Or stick to optimization? 
            // Most modern browsers support it or we can just load it.
            // Let's lazy load the high res one effectively.
            heroImage.src = highResSrc;
        }
    };

    // Initial check
    updateImageQuality();

    // Listen for network changes
    if (navigator.connection) {
        navigator.connection.addEventListener('change', updateImageQuality);
    }
});
