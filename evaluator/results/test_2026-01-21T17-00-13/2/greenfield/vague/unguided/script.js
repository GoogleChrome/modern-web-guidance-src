document.addEventListener('DOMContentLoaded', () => {
    // 1. Network-Aware Image Loading
    const heroImg = document.getElementById('hero-img');
    const highResUrl = 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=2000&auto=format&fit=crop';
    const lowResUrl = 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=10&w=100&auto=format&fit=crop';

    const getEffectiveConnection = () => {
        return navigator.connection ? navigator.connection.effectiveType : 'unknown';
    };

    const loadHeroImage = () => {
        const connectionType = getEffectiveConnection();
        // If slow connection (2g or slow-2g), load low res. Otherwise high res.
        if (connectionType === '2g' || connectionType === 'slow-2g') {
            console.log('Slow network detected. Loading low-quality image.');
            heroImg.src = lowResUrl;
            // Optionally upgrade later or keep it low res
        } else {
            console.log('Fast network or unknown. Loading high-quality image.');
            heroImg.src = highResUrl;
        }
    };

    loadHeroImage();

    // 2. Scroll Animation (IntersectionObserver)
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const heroObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Optional: Stop observing once animated
                // observer.unobserve(entry.target); 
            } else {
                // If we want it to animate every time it comes into view:
                entry.target.classList.remove('visible');
            }
        });
    }, observerOptions);

    if (heroImg) {
        heroObserver.observe(heroImg);
    }
});
