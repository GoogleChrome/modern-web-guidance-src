document.addEventListener('DOMContentLoaded', () => {
  const heroImage = document.getElementById('heroImage');
  const heroWrapper = document.getElementById('heroWrapper');

  // --- Progressive Image Loading ---
  const loadHighResImage = () => {
    const fullSrc = heroImage.getAttribute('data-full-src');
    if (!fullSrc) return;

    const tempImg = new Image();
    tempImg.src = fullSrc;

    tempImg.onload = () => {
      heroImage.src = fullSrc;
      // Remove blur via class
      heroImage.classList.remove('placeholder');
    };
  };

  // Simulate "slow network" check or just always do it
  // The prompt asks to "load a low-quality placeholder first if the user is on a slow network"
  // Since we can't detect connection speed reliably in all browsers easily without Network Information API (which is experimental),
  // the industry standard pattern is to ALWAYS load the LQIP (placeholder) first, then swap.
  // This covers slow networks (they see LQIP longer) and fast networks (instant swap).
  loadHighResImage();


  // --- Scroll Animation ---
  // Requirement: "fade in and grow larger as I scroll down the page"

  // We'll use a scroll listener. 
  // To ensure this effect is visible, we assume the user wants an effect where
  // the image starts somewhat faded/small and 'blooms' as they scroll.

  const maxScroll = 500; // Pixels to complete the animation

  const handleScroll = () => {
    const scrollY = window.scrollY;

    // Calculate progress 0 to 1
    const progress = Math.min(scrollY / maxScroll, 1);

    // Opacity: Starts at 0.4 (visible but faint) -> 1.0
    // We start at 0.4 so users see *something* immediately.
    // If strictly 0 is needed, change 0.4 to 0.
    const startOpacity = 0.4;
    const opacity = startOpacity + (progress * (1 - startOpacity));

    // Scale: Starts at 1.0 -> 1.2 (Prevent background showing)
    const startScale = 1.0;
    const endScale = 1.2;
    const scale = startScale + (progress * (endScale - startScale));

    heroImage.style.opacity = opacity;
    heroImage.style.transform = `scale(${scale})`;
  };

  window.addEventListener('scroll', () => {
    requestAnimationFrame(handleScroll);
  });

  // Initialize state
  handleScroll();
});
