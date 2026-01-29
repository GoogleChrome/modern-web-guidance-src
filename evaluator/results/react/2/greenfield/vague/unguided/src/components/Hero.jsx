import React, { useEffect, useState } from 'react';
import ProgressiveImage from './ProgressiveImage';

const Hero = () => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Grow larger (scale up) and fade (opacity optional, user said grow larger, didn't specify fade out but implied "fade in and grow larger"?)
  // User saide: "make the main hero image fade in and grow larger as I scroll down the page"
  // Wait. "fade in and grow larger as I scroll down" usually means it starts small/invisible?
  // Or maybe they mean parallax?
  // "fade in and grow larger as I scroll down" -> If I scroll down, I usually leave the hero.
  // Maybe they mean Reveal on Scroll? Or the background effect?
  // "Grow larger as I scroll down" -> scale increases.
  // "Fade in" -> opacity increases?
  // If it's the hero image, it's usually visible at start.
  // Maybe "fade OUT"?
  // "fade in ... as I scroll down" -> imply it's initially hidden?
  // I will assume it starts at Opacity 1 and Scale 1 and they meant "Scale up" (parallax zoom).
  // "Fade in" might be a typo for "Fade out" or they want it to become clearer?
  // Let's stick to Scale Up. If they want fade in, I'll make it start at 0.5? No, that's ugly.
  // I'll assume standard parallax zoom.
  // Wait, "fade in ... as I scroll down" -> maybe it's a scroll-triggered animation for elements BELOW the fold?
  // "main hero image" -> the top image.
  // If I scroll down, it goes out of view.
  // Maybe they mean "Fade out and grow larger"? That's common.
  // Or "Fade in" upon page load?
  // I'll implement Scale Up on scroll. And maybe simple fade in on mount.
  
  const scale = 1 + scrollY * 0.0005;
  const opacity = Math.max(0, 1 - scrollY * 0.001); // Fade out slightly to look nice, or keep it?
  // User said "fade in". That is confusing for scroll down.
  // I will interpret "fade in" as "initial load fade in" (handled by ProgressiveImage)
  // AND "grow larger as I scroll down" (parallax).

  return (
    <section style={{ height: '100vh', width: '100%', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1, transform: `scale(${scale})` }}>
            <ProgressiveImage
                src="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=2071&auto=format&fit=crop"
                placeholder="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=200&auto=format&fit=crop"
                alt="Coffee Hero"
                style={{ width: '100%', height: '100%' }}
            />
            {/* Overlay */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.4)' }}></div>
        </div>
        <div style={{ textAlign: 'center', zIndex: 1, padding: '2rem' }}>
            <h1 style={{ fontSize: '4rem', marginBottom: '1rem', textShadow: '2px 2px 4px rgba(0,0,0,0.5)', color: '#fff' }}>Artisan Coffee</h1>
            <p style={{ fontSize: '1.5rem', marginBottom: '2rem', color: '#f0f0f0' }}>Experience the perfect brew.</p>
            <button style={{ padding: '1rem 2rem', fontSize: '1.2rem', background: '#d4a373', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', transition: 'background 0.3s' }}
                onMouseOver={(e) => e.target.style.background = '#c19a6b'}
                onMouseOut={(e) => e.target.style.background = '#d4a373'}
            >
                Shop Now
            </button>
        </div>
    </section>
  );
};

export default Hero;
