import { useState } from 'react';
import ImageWithLoader from './ImageWithLoader';

export default function ProductCard({ title, description, price, ingredients, imageSrc, tinyImageSrc }) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="product-card" style={{
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      overflow: 'hidden',
      transition: 'transform 0.3s ease',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ height: '200px', overflow: 'hidden' }}>
        <ImageWithLoader
          src={imageSrc}
          tinySrc={tinyImageSrc}
          alt={title}
          className="product-image"
          style={{ height: '100%', width: '100%' }}
        />
      </div>
      
      <div className="product-info" style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--color-primary)' }}>{title}</h3>
        <p style={{ marginBottom: '1rem', color: '#666', flex: 1 }}>{description}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{price}</span>
          
          <div style={{ position: 'relative' }}>
            <button
              className="details-btn"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              style={{
                background: 'var(--color-secondary)',
                color: '#fff',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                fontSize: '0.9rem',
                transition: 'background 0.3s'
              }}
            >
              Details
            </button>
            
            {showTooltip && (
              <div className="tooltip" style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                marginBottom: '8px',
                background: 'var(--color-primary)',
                color: '#fff',
                padding: '0.75rem',
                borderRadius: '4px',
                width: '200px',
                fontSize: '0.85rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                zIndex: 10,
                animation: 'fadeIn 0.2s ease-out'
              }}>
                <strong>Ingredients:</strong>
                <ul style={{ paddingLeft: '1.2rem', marginTop: '0.25rem' }}>
                  {ingredients.map((ing, i) => (
                    <li key={i}>{ing}</li>
                  ))}
                </ul>
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: '20px',
                  borderWidth: '6px',
                  borderStyle: 'solid',
                  borderColor: 'var(--color-primary) transparent transparent transparent'
                }}></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
