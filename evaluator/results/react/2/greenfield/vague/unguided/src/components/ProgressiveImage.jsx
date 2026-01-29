import React, { useState } from 'react';

const ProgressiveImage = ({ src, placeholder, alt, className, style = {} }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`progressive-image-container ${className || ''}`} style={{ position: 'relative', overflow: 'hidden', ...style }}>
      <img
        src={placeholder}
        alt={alt}
        className="placeholder"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: 'blur(20px)',
          transition: 'opacity 0.5s ease-out',
          opacity: loaded ? 0 : 1,
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1
        }}
      />
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.5s ease-in',
          display: 'block' // Ensure no extra space
        }}
      />
    </div>
  );
};

export default ProgressiveImage;
