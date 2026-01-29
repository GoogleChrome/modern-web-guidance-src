import { useState, useEffect } from 'react';

export default function ImageWithLoader({ src, tinySrc, alt, className, style }) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => setIsLoaded(true);
  }, [src]);

  return (
    <div className={`image-wrapper ${className}`} style={{ position: 'relative', overflow: 'hidden', ...style }}>
      {/* Tiny Placeholder */}
      <img
        src={tinySrc || src} // Fallback to src if tinySrc not provided, but logic implies tinySrc usage
        alt={alt}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: 'blur(10px)',
          transition: 'opacity 0.5s ease-out',
          opacity: isLoaded ? 0 : 1,
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1,
        }}
        aria-hidden="true"
      />

      {/* High Quality Image */}
      <img
        src={src}
        alt={alt}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transition: 'opacity 0.5s ease-in',
          opacity: isLoaded ? 1 : 0,
          position: 'relative',
          zIndex: 2,
        }}
      />
    </div>
  );
}
