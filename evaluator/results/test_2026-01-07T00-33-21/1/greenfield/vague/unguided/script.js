document.addEventListener('DOMContentLoaded', () => {
    const heroImage = document.getElementById('hero-image');
    const heroBg = document.querySelector('.hero-bg');

    // 1. Progressive Image Loading
    // Create a new image object for the high-res version
    const highResImage = new Image();
    // Use the data-src attribute
    highResImage.src = heroImage.dataset.src;
    
    highResImage.onload = () => {
        // Once loaded, swap the source
        heroImage.src = highResImage.src;
        heroImage.classList.remove('placeholder');
        heroImage.classList.add('loaded');
    };

    // 2. Scroll Animation (Parallax / Grow)
    // "Grow larger as I scroll down the page"
    window.addEventListener('scroll', () => {
        const scrollPosition = window.scrollY;
        // Calculate scale: Starts at 1, grows to 1.2 by 1000px scroll
        const scale = 1 + (scrollPosition * 0.0002);
        
        // Also fade out slightly as we scroll away? Optional, but prompt just said "grow"
        // Let's keep it simple: Grow
        
        // Use requestAnimationFrame for performance optimization if desired, 
        // but direct transform is usually okay for simple scenarios.
        requestAnimationFrame(() => {
            heroImage.style.transform = `scale(${scale})`;
        });
    });
});
