import React from 'react';
import Hero from './components/Hero';
import ProductCard from './components/ProductCard';

function App() {
  return (
    <div>
      <Hero />
      <section style={{ padding: '6rem 2rem', background: '#121212', minHeight: '100vh' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '3rem', color: '#d4a373' }}>Our Collection</h2>
        <p style={{ textAlign: 'center', marginBottom: '4rem', color: '#888', maxWidth: '600px', margin: '0 auto 4rem' }}>
            Discover our carefully selected blends, roasted to perfection to bring out the unique character of every bean.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '3rem' }}>
            <ProductCard
                title="Ethiopian Yirgacheffe"
                description="Known for its sweet flavor and aroma with a light to medium body. Notes of wine and berry."
                price="18.00"
                image="https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=1587&auto=format&fit=crop"
            />
            <ProductCard
                title="Colombian Supremo"
                description="The highest grade of Colombian coffee. Sweet, smooth, and balanced with nutty undertones."
                price="16.50"
                image="https://images.unsplash.com/photo-1512568400610-62da28bc8a13?q=80&w=1587&auto=format&fit=crop"
            />
            <ProductCard
                title="Midnight Espresso"
                description="A bold, dark roast with a rich crema and intense flavor. Perfect for your morning shot."
                price="20.00"
                image="https://images.unsplash.com/photo-1506452305024-9d3f02d1c9b5?q=80&w=1770&auto=format&fit=crop"
            />
        </div>
      </section>
      <footer style={{ padding: '3rem 2rem', textAlign: 'center', background: '#080808', color: '#444', borderTop: '1px solid #222' }}>
        <p>&copy; 2026 Artisan Coffee. Crafted with passion.</p>
      </footer>
    </div>
  );
}

export default App;
