import { useEffect, useState } from 'react';
import ImageWithLoader from './ImageWithLoader';

export default function Hero() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scale grows as we scroll down
  const scale = 1 + scrollY * 0.0005;
  // Optional: fade out content or fade in image further? 
  // User said "fade in and grow larger as I scroll". 
  // Maybe they mean opacity starts low? 
  // Taking "fade in" as separate "on load" animation already handled by ImageWithLoader.
  // But if explicitly "as I scroll", maybe opacity increases with scroll?
  // That's unusual for a Hero at the top. I'll stick to scaling for scroll, and load fade-in.
  
  return (
    <section className="hero" style={{ 
      height: '80vh', 
      overflow: 'hidden', 
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      textAlign: 'center'
    }}>
      <div className="hero-background" style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        willChange: 'transform'
      }}>
        <ImageWithLoader
          src="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=1600&q=80"
          tinySrc="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=50&q=20"
          alt="Cozy Coffee Shop Interior"
          className="hero-image"
          style={{ height: '100%', width: '100%' }}
        />
      </div>
      
      <div className="hero-content" style={{
        backgroundColor: 'rgba(0,0,0,0.4)',
        padding: '2rem',
        borderRadius: '8px',
        backdropFilter: 'blur(4px)'
      }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>Brewed to Perfection</h1>
        <p style={{ fontSize: '1.25rem', maxWidth: '600px' }}>
          Experience the finest coffee beans sourced from around the world.
        </p>
      </div>
    </section>
  );
}
