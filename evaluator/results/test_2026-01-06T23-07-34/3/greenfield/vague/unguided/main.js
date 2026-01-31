document.addEventListener('DOMContentLoaded', () => {
  const heroImage = document.getElementById('heroImage');
  
  // 1. Image Loading Logic
  // Simulate low quality to high quality swap if we had separate URLs
  // For now, we handle the fade-in on load
  
  const img = new Image();
  img.src = heroImage.src;
  
  img.onload = () => {
    // Add visible class to fade in
    heroImage.classList.add('visible');
  };

  // 2. Scroll Animation (Grow larger as I scroll down)
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    // Calculate scale: starts at 1, grows to max 1.1 or 1.2 as we scroll down
    const scale = 1 + (scrollY / 1000); 
    
    // Limit max scale to avoid it getting too huge
    const clampedScale = Math.min(scale, 1.2);
    
    if(heroImage.classList.contains('visible')) {
        heroImage.style.transform = `scale(${clampedScale})`;
    }
  });

  // Tooltip logic is handled via CSS (:hover), which is more performant for simple tooltips
  // But if we needed JS for complex positioning we would add it here.
});
