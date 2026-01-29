import { useRef } from 'react';

export default function ProductDetails() {
  const popoverRef = useRef(null);

  const handleMouseEnter = () => {
    // Show popover on hover
    if (popoverRef.current) {
      try {
        popoverRef.current.showPopover();
      } catch (e) {
        console.error('Popover API not supported or error:', e);
      }
    }
  };

  const handleMouseLeave = () => {
    // Hide popover on leave
    if (popoverRef.current) {
      try {
        popoverRef.current.hidePopover();
      } catch (e) {
        console.error('Popover API not supported or error:', e);
      }
    }
  };

  return (
    <section className="product-details" style={{ position: 'relative', margin: '4rem 0' }}>
      <h3>Dark Roast Blend</h3>
      <p>Rich, bold, and smooth.</p>
      
      {/* 
        Using 'interestfor' pattern concept but manually implementing hover 
        because 'interesttarget' is fully experimental/deprecated.
        We use native Popover API with manual triggering.
      */}
      <button 
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="details-btn"
        aria-haspopup="dialog"
        style={{ marginTop: '1rem' }}
      >
        View Ingredients
      </button>

      {/* Popover Element */}
      <div 
        ref={popoverRef} 
        popover="manual" 
        id="ingredients-popover"
        style={{ marginTop: '10px' }}
      >
        <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-primary)' }}>Ingredients</h4>
        <ul style={{ paddingLeft: '1.2rem', margin: 0, textAlign: 'left' }}>
          <li>100% Arabica Beans</li>
          <li>Notes of Dark Chocolate</li>
          <li>Hint of Caramel</li>
        </ul>
      </div>
    </section>
  );
}
