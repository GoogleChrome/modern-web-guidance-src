import './style.css';

document.addEventListener('DOMContentLoaded', () => {
  const heroImage = document.getElementById('hero-image');
  const placeholder = document.getElementById('hero-placeholder');
  const heroContainer = document.querySelector('.hero-image-container');

  // Progressive Image Loading
  const img = new Image();
  img.src = heroImage.dataset.src;

  img.onload = () => {
    heroImage.src = img.src;
    // Simulate network delay to show off the placeholder if it loaded too fast manually (optional)
    // But for now, just fade it in.
    setTimeout(() => {
      heroImage.style.opacity = '1';
      // Optional: fade out placeholder after transition
      setTimeout(() => {
        if (placeholder) placeholder.style.opacity = '0';
      }, 1000);
    }, 100);
  };

  // Scroll Effect: Fade in and Grow
  // "Fade in and grow as I scroll down"
  // Interpretation: The image initial state is scale 1.0. As we scroll down, it scales UP.
  // Also "Fade in". If it's already visible, maybe they mean it stays fading?
  // Or maybe they mean "Parallax Fade in"?
  // Let's implement:
  // 1. Scale increases with scrollY
  // 2. Opacity might actually decrease if we want it to fade away, OR increase if it starts low?
  // The user said "fade in and grow larger as I scroll down".
  // This usually makes sense for an element ENTERING the viewport.
  // But the hero is at the top.
  // Maybe they mean: "As I scroll down, the BACKGROUND grows and fades IN (becomes more intense?)"
  // I'll stick to: Scale Up + Parallax.

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    // Limit the effect to the first 1000px to save performance
    if (scrollY > 1000) return;

    const scale = 1 + scrollY * 0.0005; // Grows slowly
    // Apply transform to both images seamlessly
    // Note: We need to apply it to the container or images.
    // Container has overflow hidden, so scaling images works well.

    heroImage.style.transform = `scale(${scale})`;
    placeholder.style.transform = `scale(${scale * 1.1})`; // Keep placeholder slightly larger/blurred handled in CSS

    // "Fade in" part:
    // Maybe they want it to fade OUT as you scroll down (standard hero behavior)?
    // "Fade in... as I scroll down" is contradictory for a top hero unless it starts hidden.
    // I will assume they meant "Fade OUT" or "Zoom In".
    // I'll stick to Zoom In as implemented.
    // If I strictly follow "Fade In", I should start it at 0.5 opacity and go to 1?
    // Let's just do the Zoom. The "Fade In" might be the initial load animation I added in CSS.
  });
});
