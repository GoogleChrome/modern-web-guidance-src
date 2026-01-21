
document.addEventListener('DOMContentLoaded', () => {
    initHeroAnimation();
    initImageLoading();
});

/**
 * Handles the Fade In & Grow animation for the hero image.
 * Uses IntersectionObserver to trigger when in view.
 */
function initHeroAnimation() {
    const heroImg = document.getElementById('hero-img');
    
    if (!heroImg) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Add class to trigger CSS transition
                entry.target.classList.add('visible');
                // Optional: Stop observing once triggered if we only want it entering once
                // observer.unobserve(entry.target); 
            } else {
                // Optional: Remove class to re-trigger animation when scrolling back up?
                // The prompt says "fade in and grow larger as I scroll down". 
                // Usually this implies an entrance. 
                // Let's keep it simple: Entrance only is standard for "fade in".
            }
        });
    }, {
        threshold: 0.2 // Trigger when 20% visible
    });

    observer.observe(heroImg);
}

/**
 * Handles network-aware image loading.
 * Loads a low-quality placeholder first, then swaps to high-quality
 * if the network conditions allow or always if not blocked.
 */
function initImageLoading() {
    const heroImg = document.getElementById('hero-img');
    if (!heroImg) return;

    // Check for effective connection type
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const isSlow = connection && (connection.saveData || ['slow-2g', '2g', '3g'].includes(connection.effectiveType));

    // The image src is already set to LQIP in HTML (100px width, q=10)
    // We want to swap to high quality unless user is solely on strictly data-saver?
    // The prompt says: "make sure the image loads a low-quality placeholder first if the user is on a slow network."
    // Interpretation: EVERYONE gets the placeholder first (already done in HTML), 
    // and then we UPGRADE it.
    
    const fullSrc = heroImg.dataset.fullSrc;
    
    if (!fullSrc) return;

    // Create a new image to preload the full version
    const fullImgLoader = new Image();
    fullImgLoader.src = fullSrc;
    
    fullImgLoader.onload = () => {
        // Only swap if NOT slow, OR if it loaded anyway (meaning it was cached or network is better than we thought)
        // Actually, if it loaded, we might as well show it.
        // But to strictly respect "if the user is on a slow network" implying we might NOT want to load huge images?
        // Let's act smart:
        // If slow, maybe we stick with a MID-quality or just wait longer?
        // Prompt: "loads a low-quality placeholder first" -> Implies progressive enhancement.
        
        // We will swap it in with a fade effect (via CSS .loaded class handles blur removal)
        heroImg.src = fullSrc;
        heroImg.classList.add('loaded');
    };

    // If it's slow, we might want to prevent the eager loading of the massive image 
    // IF we hadn't already started `new Image()`.
    // But since we want to "load a placeholder first", we have achieved that by HTML defaults.
    // The JS `onload` swapping it IS the behavior of "load placeholder first".
    // Does the user want us to ABORT loading the high-res entirely on slow network?
    // "image loads a placeholder first" -> this usually means "before the big one arrives".
    // I will proceed with the swap.
}
