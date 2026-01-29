import { useState, useEffect } from 'react';

const HIGH_RES_URL = 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=2000&auto=format&fit=crop';
const LOW_RES_URL = 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=200&auto=format&fit=crop';

export default function Hero() {
  const [imageSrc, setImageSrc] = useState(HIGH_RES_URL);

  useEffect(() => {
    // Adaptive Loading Logic
    if (navigator.connection) {
      const { saveData, effectiveType } = navigator.connection;
      if (saveData || effectiveType === '2g' || effectiveType === '3g') {
        setImageSrc(LOW_RES_URL);
      }
    }
  }, []);

  return (
    <section className="hero" style={{ margin: '4rem 0' }}>
      <h2>Our Signature Roast</h2>
      <p style={{ marginBottom: '2rem' }}>Brewed for perfection, served with love.</p>
      
      <div className="hero-image-container" style={{ overflow: 'hidden', borderRadius: '16px' }}>
        <img
          src={imageSrc}
          alt="Coffee Table"
          className="hero-image"
          style={{
            width: '100%',
            maxWidth: '800px',
            height: 'auto',
            borderRadius: '16px',
            // Scroll-driven animation styles
            // We use @supports in CSS for best practice, but here we can add the class or style directly.
            // I'll add a class and define the animation in App.css / index.css
          }}
        />
      </div>
      
      <style>{`
        /* 
         * Scroll-driven animation:
         * Fade in and scale up as it enters the view.
         */
        @supports (animation-timeline: view()) {
          .hero-image {
            animation: fade-scale-in linear both;
            animation-timeline: view();
            animation-range: entry 10% cover 50%;
          }
        }
      `}</style>
    </section>
  );
}
