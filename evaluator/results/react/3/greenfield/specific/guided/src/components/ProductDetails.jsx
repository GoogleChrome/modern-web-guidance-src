import React from 'react';

export function ProductDetails() {
  return (
    <div style={{ margin: '4rem 0', textAlign: 'center', paddingBottom: '4rem' }}>
      <h2 style={{ color: 'var(--coffee-dark)' }}>Signature Blend</h2>
      <p style={{ marginBottom: '2rem' }}>A rich, full-bodied roast perfect for any time of day.</p>
      
      {/* Interest Target Button */}
      {/* We use 'interestfor' attribute for the polyfill/native feature */}
      <button 
        className="details-btn"
        interestfor="ingredients-popover" 
        style={{
          padding: '0.75rem 1.5rem',
          fontSize: '1.1rem',
          backgroundColor: 'var(--coffee-accent)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'background-color 0.2s'
        }}
        onMouseOver={(e) => e.target.style.backgroundColor = 'var(--coffee-dark)'}
        onMouseOut={(e) => e.target.style.backgroundColor = 'var(--coffee-accent)'}
      >
        Details
      </button>

      {/* Popover Content */}
      <div id="ingredients-popover" popover="hint">
        <h3 style={{ marginTop: 0, color: 'var(--coffee-dark)' }}>Ingredients</h3>
        <ul style={{ paddingLeft: '1.2rem', textAlign: 'left', margin: 0 }}>
          <li>100% Arabica Beans</li>
          <li>Notes of Dark Chocolate</li>
          <li>Hint of Caramel</li>
          <li>Sourced from Ethiopia</li>
        </ul>
      </div>
    </div>
  );
}
