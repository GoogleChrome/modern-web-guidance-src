import React, { useRef } from 'react';
import './IngredientsPopover.css';

const IngredientsPopover = () => {
  const popoverRef = useRef(null);

  const showPopover = () => {
    if (popoverRef.current) {
      try {
        popoverRef.current.showPopover();
      } catch {
        // Already showing or not supported
      }
    }
  };

  const hidePopover = () => {
    if (popoverRef.current) {
      try {
        popoverRef.current.hidePopover();
      } catch {
        // Already hidden
      }
    }
  };

  return (
    <div className="popover-wrapper">
      <button
        className="details-btn"
        onMouseEnter={showPopover}
        onMouseLeave={hidePopover}
        aria-haspopup="true"
        aria-controls="ingredients-popover"
      >
        Details
      </button>

      <div
        id="ingredients-popover"
        className="ingredients-popover"
        popover="manual"
        ref={popoverRef}
      >
        <h3>Our Secret Blend</h3>
        <ul>
          <li>100% Arabica Beans</li>
          <li>Notes of Dark Chocolate</li>
          <li>Hint of Vanilla</li>
          <li>Sourced from Ethiopia</li>
        </ul>
      </div>
    </div>
  );
};

export default IngredientsPopover;
