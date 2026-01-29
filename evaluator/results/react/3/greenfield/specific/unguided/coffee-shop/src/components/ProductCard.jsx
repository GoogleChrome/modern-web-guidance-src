
import React, { useRef } from 'react';
import AdaptiveImage from './AdaptiveImage';
import './ProductCard.css';

const ProductCard = ({ name, description, ingredients, image, placeholder }) => {
  const popoverRef = useRef(null);
  const popoverId = `popover-${name.replace(/\s+/g, '-').toLowerCase()}`;

  const handleMouseEnter = () => {
    if (popoverRef.current) {
      try {
        // Check if already open to avoid error
        if (!popoverRef.current.matches(':popover-open')) {
          popoverRef.current.showPopover();
        }
      } catch (e) {
        console.warn('Popover API error:', e);
      }
    }
  };

  const handleMouseLeave = () => {
    if (popoverRef.current) {
      try {
        popoverRef.current.hidePopover();
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="product-card">
      <div className="product-image-container">
        <AdaptiveImage
          src={image}
          placeholder={placeholder}
          alt={name}
          className="product-image"
        />
      </div>
      <div className="product-info">
        <h3>{name}</h3>
        <p>{description}</p>
        <button
          className="details-btn"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          // accessibilty
          aria-expanded={false}
          aria-controls={popoverId}
          popovertarget={popoverId}
        >
          Details
        </button>

        <div
          id={popoverId}
          ref={popoverRef}
          popover="auto"
          className="ingredients-popover"
        >
          <h4>{name} Ingredients</h4>
          <ul>
            {ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
