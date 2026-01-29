import React from 'react';
import { AdaptiveImage } from './AdaptiveImage';

export function ProductCard({ title, price, description, ingredients, image, id }) {
  const popoverId = `popover-${id}`;
  const triggerStyle = {
    anchorName: `--anchor-${id}`,
  };
  const popoverStyle = {
    positionAnchor: `--anchor-${id}`,
    positionArea: 'top',
    margin: '0',
    marginBottom: '10px',
    backgroundColor: 'var(--color-surface)',
    padding: '1rem',
    borderRadius: '8px',
    border: '1px solid var(--color-text-secondary)',
    color: 'var(--color-text-primary)',
    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
    width: 'max-content',
    maxWidth: '250px',
  };

  return (
    <article className="product-card" style={{
      backgroundColor: 'var(--color-surface)',
      borderRadius: '12px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      paddingBottom: '1rem'
    }}>
      <div style={{ height: '200px', overflow: 'hidden' }}>
        <AdaptiveImage
          src={image}
          placeholder={image + '&w=50'}
          alt={title}
          className="product-img"
          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
        />
      </div>
      
      <div style={{ padding: '0 1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{title}</h3>
        <p style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{price}</p>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{description}</p>
        
        {/* Popover Trigger */}
        {/* @ts-ignore - interestfor is experimental */}
        <button 
          className="details-btn"
          style={triggerStyle}
          interestfor={popoverId}
        >
          Details
        </button>

        {/* Popover Content */}
        {/* @ts-ignore - popover is standard but Typescript might lag */}
        <div 
          id={popoverId} 
          popover="auto" // "hint" is better for hover but "auto" is more standard baseline for now if hint is behind flags
          style={popoverStyle}
        >
          <h4 style={{ margin: '0 0 0.5rem 0' }}>Ingredients</h4>
          <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
            {ingredients.map((ing, i) => (
              <li key={i}>{ing}</li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}
