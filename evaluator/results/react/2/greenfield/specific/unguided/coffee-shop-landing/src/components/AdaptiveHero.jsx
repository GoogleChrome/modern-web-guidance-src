import React, { useEffect, useState } from 'react';
import './AdaptiveHero.css';

const AdaptiveHero = () => {
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  useEffect(() => {
    const checkConnection = () => {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (connection) {
        // Check for slow connection (2g, 3g) or data saver preference
        const isSlow = connection.saveData || 
                       connection.effectiveType === '2g' || 
                       connection.effectiveType === '3g';
        setIsSlowConnection(isSlow);
      }
    };

    checkConnection();
    
    // Listen for changes if supported
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      connection.addEventListener('change', checkConnection);
      return () => connection.removeEventListener('change', checkConnection);
    }
  }, []);

  return (
    <div className="hero-container">
      {isSlowConnection ? (
        <div className="hero-placeholder fade-scale">
          <div className="placeholder-content">
            <h1>Artisan Coffee</h1>
            <p>Brewed for perfection</p>
          </div>
        </div>
      ) : (
        <img 
          src="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=2071&auto=format&fit=crop" 
          alt="Artisan Coffee" 
          className="hero-image fade-scale"
          loading="eager"
        />
      )}
      <div className="hero-overlay">
        <h1>Morning Brew</h1>
        <p>Start your day right.</p>
      </div>
    </div>
  );
};

export default AdaptiveHero;
