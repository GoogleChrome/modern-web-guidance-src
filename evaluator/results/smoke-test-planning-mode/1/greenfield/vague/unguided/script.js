document.addEventListener('DOMContentLoaded', () => {
    initHeroAnimation();
    initNetworkAwareImageLoading();
});

/**
 * Handles the "fade in and grow" animation for the hero image upon scrolling into view.
 */
function initHeroAnimation() {
    const heroImg = document.querySelector('.hero-img');
    
    if (!heroImg) return;

    const observerOption = {
        root: null, // viewport
        rootMargin: '0px',
        threshold: 0.2 // Trigger when 20% visible
    };

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Optional: Stop observing once visible if we only want it to happen once
                obs.unobserve(entry.target);
            }
        });
    }, observerOption);

    observer.observe(heroImg);
}

/**
 * Loads a high-quality image only if the user is not on a data-saver mode
 * or smooth network conditions.
 */
function initNetworkAwareImageLoading() {
    const heroImg = document.querySelector('#hero-img');
    if (!heroImg) return;

    // Check for Save-Data header
    const saveData = navigator.connection && navigator.connection.saveData;
    
    // Check for effective connection type (e.g., '4g', '3g', '2g', 'slow-2g')
    const effectiveType = navigator.connection ? navigator.connection.effectiveType : '4g'; // Assume fast if unknown
    
    // Logic: 
    // If Save-Data is true => Keep placeholder (do nothing)
    // If connection is 2g or slow-2g => Keep placeholder
    // Otherwise => Swap to high-res
    
    const isSlowConnection = effectiveType === '2g' || effectiveType === 'slow-2g';

    if (!saveData && !isSlowConnection) {
        const highResUrl = heroImg.dataset.highRes;
        if (highResUrl) {
            // Create a temporary loader to ensure smooth transition
            const tempImg = new Image();
            tempImg.src = highResUrl;
            tempImg.onload = () => {
                heroImg.src = highResUrl;
                heroImg.classList.add('loaded');
            };
        }
    } else {
        console.log('Skipping high-res image load due to network constraints.');
        // Still mark as loaded to remove blur if desired, or keep it blurred to indicate low quality?
        // User asked for "low-quality placeholder FIRST", implying it might verify.
        // Let's at least remove the blur if we are keeping the low-res one, 
        // to show it clearly even if pixelated.
        heroImg.classList.add('loaded');
    }
}
