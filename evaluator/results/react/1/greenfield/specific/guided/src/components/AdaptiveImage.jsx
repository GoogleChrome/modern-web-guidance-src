import React, { useEffect, useRef } from 'react';

/**
 * AdaptiveImage component that uses the `loading-placeholder` attribute
 * for adaptive loading on supported browsers, with a polyfill fallback.
 */
export function AdaptiveImage({ src, placeholder, alt, className, style }) {
  const imgRef = useRef(null);

  useEffect(() => {
    // Check if adaptive loading is supported
    if (!('loadingPlaceholder' in HTMLImageElement.prototype)) {
      // Setup polyfill or fallback logic if needed
      // For now, we rely on the attribute being ignored by unsupported browsers
      // and checking if we should manually swap (which requires Network Information API)
      
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (connection) {
        // Simple manual check
        if (connection.saveData || /2g|3g/.test(connection.effectiveType)) {
          if (imgRef.current) {
            imgRef.current.src = placeholder;
          }
        }
      }
    }
  }, [placeholder]);

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      className={className}
      style={style}
      // @ts-ignore - loading-placeholder is not yet in React types
      loading-placeholder={placeholder}
    />
  );
}
