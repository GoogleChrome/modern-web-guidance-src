
import React, { useState } from 'react';

const AdaptiveImage = ({ src, placeholder, alt, className, style, ...props }) => {
  const [shouldLoadHighRes] = useState(() => {
    if (typeof navigator === 'undefined') return true;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      const isSlow = connection.saveData === true ||
        connection.effectiveType === 'slow-2g' ||
        connection.effectiveType === '2g';
      return !isSlow;
    }
    return true;
  });

  return (
    <img
      src={shouldLoadHighRes ? src : placeholder}
      alt={alt}
      className={className}
      style={style}
      {...props}
    />
  );
};

export default AdaptiveImage;
