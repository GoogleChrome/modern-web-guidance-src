document.addEventListener('DOMContentLoaded', () => {
  const heroImg = document.querySelector('.hero-img');

  // Network Detection & Image Loading
  const loadHeroImage = () => {
    // Default High-Res Image (Coffee Shop Theme)
    let imageUrl = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=2500&auto=format&fit=crop';
    
    // Check Network Status
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      const isSlow = connection.saveData || 
                     connection.effectiveType === 'slow-2g' || 
                     connection.effectiveType === '2g';
      
      if (isSlow) {
        console.log('Slow network detected. Using low-quality image.');
        // Low-Res Variant
        imageUrl = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=30&w=600&auto=format&fit=crop'; 
      }
    }

    // Preload and set
    const imgLoader = new Image();
    imgLoader.src = imageUrl;
    imgLoader.onload = () => {
      heroImg.src = imageUrl;
      // Trigger CSS fade-in
      heroImg.classList.add('loaded');
    };
  };

  loadHeroImage();

  // Scroll Animation (Parallax Zoom)
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        // Only animate if arguably within view or close to top
        // Grow scale: 1 -> 1.15 over 500px scroll
        const scale = 1 + (scrollY * 0.0003);
        
        // Apply transform directly for performance
        // We use translate3d(0,0,0) to force hardware acceleration
        heroImg.style.transform = `scale(${scale}) translateZ(0)`;
        
        ticking = false;
      });
      ticking = true;
    }
  });
});
