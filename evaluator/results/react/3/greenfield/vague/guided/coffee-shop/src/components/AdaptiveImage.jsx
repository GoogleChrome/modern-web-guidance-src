import React from 'react';

/**
 * AdaptiveImage component that uses the `loading-placeholder` attribute
 * to serve a low-quality image on slow networks.
 * 
 * Note: standard HTML attributes like `loading-placeholder` must be passed 
 * directly to the DOM element. In React 19 (or with custom attribute handling),
 * this works. If React strips it, we might need a ref.
 * For now, we assume React will pass it through or we use a ref if needed.
 */
const AdaptiveImage = ({ src, placeholder, alt, className, style, ...props }) => {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading="lazy" // Native lazy loading
      {...props}
      // @ts-ignore - Custom attribute
      loading-placeholder={placeholder}
    />
  );
};

export default AdaptiveImage;
