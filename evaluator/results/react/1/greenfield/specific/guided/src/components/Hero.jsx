import React from 'react';
import { AdaptiveImage } from './AdaptiveImage';
import '../index.css';

export function Hero() {
  return (
    <section className="hero" style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      color: 'var(--color-text-primary)'
    }}>
      <div className="hero-content" style={{ zIndex: 2, textAlign: 'center' }}>
        <h1 style={{ fontSize: '4rem', marginBottom: '1rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
          Morning Brew
        </h1>
        <p style={{ fontSize: '1.5rem', marginBottom: '2rem', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
          Experience coffee in its purest form.
        </p>
      </div>

      <div className="hero-image-wrapper" style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        // Scroll-driven animation support check can be done in CSS,
        // but we'll apply the class that has the animation.
      }}>
        <style>{`
          .hero-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            
            /* Fallback opacity for when animation isn't supported/triggered yet */
            opacity: 1; 
          }

          @supports (animation-timeline: view()) {
            .hero-img {
              opacity: 0; /* Start hidden for animation */
              animation: fade-scale-in linear both;
              animation-timeline: view();
              animation-range: entry 0% cover 40%;
            }
          }
        `}</style>
        <AdaptiveImage
          src="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=2000&q=80"
          placeholder="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=200&q=10"
          alt="Cozy coffee shop interior"
          className="hero-img"
        />
      </div>
    </section>
  );
}
