document.addEventListener('DOMContentLoaded', () => {
    const heroMain = document.getElementById('hero-main');
    const heroPlaceholder = document.getElementById('hero-placeholder');
    const heroContainer = document.querySelector('.hero');
    
    // 1. Image Loading Logic (LQIP -> High Res)
    // We use a slight delay to simulate network if it's too fast locally, or just normal load.
    
    const img = new Image();
    img.src = heroMain.dataset.src;
    
    img.onload = () => {
        heroMain.src = img.src;
        // Small delay to ensure paint
        requestAnimationFrame(() => {
            heroMain.classList.add('loaded');
            // Hide placeholder after transition
            setTimeout(() => {
                heroPlaceholder.style.opacity = '0';
            }, 500); // 500ms match css transition if any, or just disappear
        });
    };

    // 2. Scroll Animation (Fade in & Grow)
    // "Fade in" is handled by the initial load, but we can make it "grow" on scroll.
    // The requirement: "Make the main hero image fade in and grow larger as I scroll down the page"
    // Interpretation: 
    // "Fade in" usually implies appearing. 
    // "Grow larger as I scroll down" -> Parallax zoom effect.
    
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        const windowHeight = window.innerHeight;
        
        // Only animate if hero is in view
        if (scrollY <= windowHeight) {
            const scale = 1 + (scrollY / windowHeight) * 0.2; // Max scale 1.2
            // Also fade out slightly as we scroll away? Or keep it?
            // "Fade in ... as I scroll down". 
            // Wait, usually "fade in" happens ONCE. "Grow larger" happens dynamically.
            // Maybe they mean "fade in" as in "opacity increases as I scroll"? 
            // Most likely they mean "Initial fade in, THEN grow on scroll".
            // Or "Opacity 0 -> 1 as I scroll".
            
            // Let's assume standard "Hero Zoom on Scroll" metadata.
            
            heroMain.style.transform = `scale(${scale})`;
        }
    });
});
