document.addEventListener('DOMContentLoaded', () => {
    const heroImage = document.getElementById('hero-image');
    
    // --- Network Awareness & Image Loading ---
    // Check connection type
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const isSlow = connection ? 
        (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') : 
        false;

    console.log('Network condition:', isSlow ? 'Slow/DataSaver' : 'Fast/Normal');

    if (!isSlow) {
        // Load high quality image if on fast network
        // We simulate this by checking if we are already using low, then swapping
        // In this demo, 'hero-high.svg' is our "high res" version
        const highResSrc = 'hero-high.svg';
        
        // Create a temporary image to preload
        const img = new Image();
        img.src = highResSrc;
        img.onload = () => {
            heroImage.src = highResSrc;
            heroImage.classList.add('visible'); // Trigger fade-in after load
        };
        // Fallback if it fails? already have low res
    } else {
        // Slow network: just keep low res or ensure it's loaded
        // heroImage.src is already 'hero-low.svg' from HTML
        heroImage.classList.add('visible');
    }

    // --- Scroll Effect ---
    // We want the image to grow larger as we scroll down
    // We can use the 'scroll' event for continuous updates or IntersectionObserver for visibility
    // For "grow as I scroll down", valid logic is mapping scrollY to scale
    
    window.addEventListener('scroll', () => {
        const scrollPosition = window.scrollY;
        const windowHeight = window.innerHeight;
        
        // Only animate if we are in the hero section area
        if (scrollPosition <= windowHeight) {
            // Calculate scale: starts at 1, goes up to 1.2 over 100vh
            const scaleAmount = 1 + (scrollPosition / windowHeight) * 0.2;
            
            // We apply it via transform
            // Note: We need to preserve the CSS transition/transform logic if any
            // But doing it on scroll usually requires removing CSS transition for transform to avoid lag, 
            // OR we use CSS variables if we want to be fancy.
            // Let's use direct style for immediate feedback, but it might fight with the 'scrolled' class if we used that.
            // Actually, the request "fade in and grow larger as I scroll down" might mean:
            // 1. Fade in on load (handled above)
            // 2. Grow larger AS I SCROLL (parallax-like zoom)
            
            heroImage.style.transform = `scale(${scaleAmount})`;
        }
    });
});
