import React from 'react';

export function Hero() {
  return (
    <section className="hero" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      textAlign: 'center',
      padding: '4rem 1rem' 
    }}>
      <h1 style={{ fontSize: '4rem', marginBottom: '1rem', color: 'var(--coffee-dark)' }}>
        The Daily Grind
      </h1>
      <p style={{ fontSize: '1.5rem', marginBottom: '4rem', color: 'var(--coffee-medium)' }}>
        Artisan coffee, roasted with love.
      </p>
      
      <div style={{ height: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--coffee-light)', fontStyle: 'italic' }}>Scroll down to reveal...</p>
      </div>
      
      {/* 
        Scroll-driven animation: 
        The image uses class 'scroll-fade-in' which is defined in index.css
        Adaptive Loading: 
        Uses 'loading-placeholder' attribute which is handled by our script in index.html
      */}
      <img 
        src="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=1200&q=80"
        loading-placeholder="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=50&q=10"
        alt="Premium Coffee Beans"
        className="scroll-fade-in"
        style={{
          width: '100%',
          maxWidth: '800px',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          marginTop: '2rem'
        }}
      />
    </section>
  );
}
