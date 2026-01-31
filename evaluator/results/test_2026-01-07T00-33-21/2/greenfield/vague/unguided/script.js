document.addEventListener('DOMContentLoaded', () => {
    const heroImage = document.querySelector('.hero-image');
    
    // 1. Image Progressive Loading (Blur-up)
    const loadHighResImage = () => {
        const highResUrl = heroImage.dataset.src;
        if (!highResUrl) return;

        const img = new Image();
        img.src = highResUrl;
        img.onload = () => {
            heroImage.src = highResUrl;
            heroImage.classList.remove('placeholder');
        };
    };

    // Simulate "slow network" check or just basic lazy load
    // For this demo, we'll start loading immediately but keep the blur pending load
    if (heroImage) {
        loadHighResImage();
    }

    // 2. Scroll Animation (Fade in + Grow)
    // "Main hero image fade in and grow larger as I scroll down"
    // Interpretation: Parallax or Scroll-Entrance
    // Since it's the hero, we want it to likely enter as we scroll if it starts hidden,
    // OR if it's already there, maybe it scales UP as we scroll DOWN?
    // Let's implement an IntersectionObserver for the "Fade In" part (entry),
    // and a scroll listener for the "Grow" part (parallax-like).

    // Initial Entry
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    if (heroImage) {
        observer.observe(heroImage);
    }

    // Grow on Scroll
    window.addEventListener('scroll', () => {
        if (!heroImage) return;
        
        const scrollY = window.scrollY;
        // Only animate if we are in the hero section area roughly
        if (scrollY < window.innerHeight) {
            // Scale grows from 1 to 1.1 as we scroll down 500px
            const scale = 1 + (scrollY / 10000); // Subtle growth
            // We also want to fade it OUT if the user meant that?
            // "fade in and grow larger as I scroll down"
            // This phrasing is tricky. "Fade in ... as I scroll down" usually implies it wasn't there.
            // But it's the hero.
            // Let's assume it starts at opacity 0 (handled by CSS .visible) and animates IN when page loads/scrolled to.
            // AND as we scroll down further, it grows.
            
            // Let's do a direct mapping for the "Grow" part
            // Base scale is 1 (after visible class added).
            // We'll apply transform manually.
            
            if (heroImage.classList.contains('visible')) {
                // We need to keep the 1 scale from CSS and ADD to it.
                // Actually, let's just use the scroll to drive scale roughly.
                // Current approach: CSS handles opacity entry. JS handles parallax growth.
                heroImage.style.transform = `scale(${1 + scrollY * 0.0005})`; 
            }
        }
    });
});
