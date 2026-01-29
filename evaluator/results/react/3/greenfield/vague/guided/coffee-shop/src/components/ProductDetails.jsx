import React from 'react';
import styles from './ProductDetails.module.css';

const ProductDetails = ({ title, description, ingredients }) => {
  // Unique IDs for accessibility and popover targeting
  // In a real app, use useId()
  const popoverId = `popover-${title.replace(/\s+/g, '-').toLowerCase()}`;
  const triggerId = `trigger-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      
      {/* 
        Button with interestfor attribute (Experimental/Polyfilled) 
        React 18 might raise a warning for unknown attributes, but it renders them.
      */}
      <button 
        id={triggerId}
        className={styles.detailsBtn}
        // @ts-ignore
        interestfor={popoverId}
      >
        Details
      </button>

      {/* Popover Element */}
      <div 
        id={popoverId} 
        popover="auto" 
        className={styles.popover}
      >
        <h4 className={styles.popoverTitle}>Ingredients</h4>
        <ul className={styles.ingredientsList}>
          {ingredients.map((ing, i) => (
            <li key={i}>{ing}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ProductDetails;
