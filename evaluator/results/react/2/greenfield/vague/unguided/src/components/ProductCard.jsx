import React from 'react';

const ProductCard = ({ title, description, price, image }) => {
  return (
    <div style={{ background: '#1E1E1E', borderRadius: '12px', overflow: 'hidden', width: '320px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 20px rgba(0,0,0,0.3)', transition: 'transform 0.3s' }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <div style={{ height: '220px', overflow: 'hidden' }}>
        <img src={image} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', color: '#d4a373' }}>{title}</h3>
        <p style={{ color: '#aaa', marginBottom: 'auto', lineHeight: '1.5' }}>{description}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>${price}</span>
            <div className="tooltip-container" style={{ position: 'relative' }}>
                <button
                    className="details-btn"
                    style={{ background: 'transparent', border: '1px solid #d4a373', color: '#d4a373', padding: '0.6rem 1.2rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.3s' }}
                >
                    Details
                </button>
                <div className="tooltip" style={{
                    position: 'absolute',
                    bottom: '120%',
                    left: '50%',
                    transform: 'translateX(-50%) translateY(10px)',
                    background: '#fff',
                    color: '#333',
                    padding: '0.8rem',
                    borderRadius: '6px',
                    width: '180px',
                    textAlign: 'center',
                    boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
                    opacity: 0,
                    visibility: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                    zIndex: 10,
                    pointerEvents: 'none'
                }}>
                    <strong style={{ display: 'block', marginBottom: '0.25rem', color: '#d4a373' }}>Ingredients</strong>
                    <span style={{ fontSize: '0.9rem' }}>100% Arabica Coffee Beans, Note of Chocolate</span>
                    <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderTop: '6px solid #fff', borderLeft: '6px solid transparent', borderRight: '6px solid transparent' }}></div>
                </div>
            </div>
        </div>
      </div>
      <style>{`
        .tooltip-container:hover .tooltip {
            opacity: 1;
            visibility: visible;
            transform: translateX(-50%) translateY(0);
        }
        .details-btn:hover {
            background: #d4a373 !important;
            color: #fff !important;
        }
      `}</style>
    </div>
  );
};

export default ProductCard;
