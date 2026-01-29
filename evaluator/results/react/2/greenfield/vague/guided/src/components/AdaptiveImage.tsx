import React, { type ImgHTMLAttributes, useEffect, useRef } from 'react';

// Extend HTMLImageElement to include loading-placeholder for TypeScript
declare global {
  interface HTMLImageElement {
    loadingPlaceholder?: string;
  }
}

// Add loading-placeholder to React props
declare module 'react' {
  interface ImgHTMLAttributes<T> extends HTMLAttributes<T> {
    'loading-placeholder'?: string;
  }
}

interface AdaptiveImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  placeholderSrc: string;
}

export const AdaptiveImage: React.FC<AdaptiveImageProps> = ({
  src,
  placeholderSrc,
  className,
  alt,
  ...props
}) => {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Feature detection for native support is practically non-existent for this experimental API
    // so we rely on the polyfill presence or just setting the attribute.
    // The polyfill typically runs on DOMContentLoaded or MutationObserver.
    // We just ensure the attribute is set.
  }, []);

  return (
    <img
      ref={imgRef}
      src={src}
      loading-placeholder={placeholderSrc}
      className={className}
      alt={alt}
      {...props}
    />
  );
};
