import { useState } from 'react';

export default function Tooltip({ 
  content, 
  children, 
  position = 'top' 
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="tooltip-wrapper"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div 
          className={`tooltip-content tooltip-${position}`}
          role="tooltip"
        >
          {content}
          <div className="tooltip-arrow" />
        </div>
      )}
    </div>
  );
}
