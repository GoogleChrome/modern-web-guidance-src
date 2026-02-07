document.addEventListener('DOMContentLoaded', () => {
    const heroImage = document.getElementById('heroImage');
    
    // Progressive Image Loading
    const loadHighResImage = () => {
        const highResUrl = heroImage.getAttribute('data-src');
        if (!highResUrl) return;

        const img = new Image();
        img.src = highResUrl;
        img.onload = () => {
            heroImage.src = highResUrl;
            heroImage.classList.add('loaded');
        };
    };

    // Simulate network delay to show off the "low quality first" feature if local
    // But mostly we just run it.
    // If we want to strictly follow "load low-quality... first", the HTML already has src=low-quality.
    // We just need to swap it.
    if (heroImage) {
        // Slight delay to ensure user sees the blur effect (optional, removed for production feel but good for demo)
        // setTimeout(loadHighResImage, 500); 
        loadHighResImage();
    }

    // Scroll Animation
    // Requirement: "fade in and grow larger as I scroll down"
    const handleScroll = () => {
        const scrollY = window.scrollY;
        
        // Settings
        const maxScroll = window.innerHeight; // Animation finishes after 1 viewport height
        const startScale = 1.0;
        const endScale = 1.25;
        const startOpacity = 0.4;
        const endOpacity = 1.0;

        // Calculate progress (0 to 1)
        let progress = Math.min(scrollY / maxScroll, 1);
        
        // Calculate new values
        const scale = startScale + (progress * (endScale - startScale));
        const opacity = startOpacity + (progress * (endOpacity - startOpacity));

        if (heroImage) {
            heroImage.style.transform = `scale(${scale})`;
            heroImage.style.opacity = opacity;
        }
    };

    window.addEventListener('scroll', () => {
        requestAnimationFrame(handleScroll);
    });
    
    // Initial call to set values
    handleScroll();
});
