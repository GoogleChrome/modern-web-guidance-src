import Hero from './components/Hero';
import ProductCard from './components/ProductCard';

function App() {
  const products = [
    {
      id: 1,
      title: 'Signature Latte',
      description: 'A smooth blend of rich espresso and creamy steamed milk, finished with detailed latte art.',
      price: '$4.50',
      ingredients: ['Espresso (Single Origin)', 'Steamed Whole Milk', 'Microfoam'],
      imageSrc: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80',
      tinySrc: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=50&q=20'
    },
    {
      id: 2,
      title: 'Cold Brew',
      description: 'Steeped for 24 hours to extract maximum flavor with low acidity. Served over ice.',
      price: '$5.00',
      ingredients: ['Coarse Ground Coffee', 'Filtered Water', 'Ice'],
      // Different image if possible, using a generic coffee placeholder if needed or reuse
      imageSrc: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=800&q=80',
      tinySrc: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=50&q=20'
    },
    {
      id: 3,
      title: 'Espresso Macchiato',
      description: 'A bold shot of espresso with just a dollop of foam to mark the heart.',
      price: '$3.50',
      ingredients: ['Espresso', 'Milk Foam'],
      imageSrc: 'https://images.unsplash.com/photo-1485808191679-5f8c7c97a297?auto=format&fit=crop&w=800&q=80',
      tinySrc: 'https://images.unsplash.com/photo-1485808191679-5f8c7c97a297?auto=format&fit=crop&w=50&q=20'
    }
  ];

  return (
    <div className="app">
      <header style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        padding: '1.5rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
        color: '#fff'
      }}>
        <div style={{ fontWeight: 'bold', fontSize: '1.5rem', letterSpacing: '1px' }}>
          NOCTURNE
        </div>
        <nav>
          <ul style={{ display: 'flex', gap: '2rem', listStyle: 'none' }}>
            <li><a href="#menu" style={{ color: '#fff', textDecoration: 'none', fontWeight: 500 }}>Menu</a></li>
            <li><a href="#about" style={{ color: '#fff', textDecoration: 'none', fontWeight: 500 }}>About</a></li>
            <li><a href="#locations" style={{ color: '#fff', textDecoration: 'none', fontWeight: 500 }}>Locations</a></li>
          </ul>
        </nav>
      </header>

      <Hero />

      <main id="menu" className="container" style={{ padding: '6rem 1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--color-primary)' }}>Our Menu</h2>
          <p style={{ color: '#666', maxWidth: '600px', margin: '0 auto' }}>
            Hand-crafted beverages made with passion and precision.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '2rem'
        }}>
          {products.map(product => (
            <ProductCard
              key={product.id}
              {...product}
            />
          ))}
        </div>
      </main>

      <footer style={{
        background: 'var(--color-primary)',
        color: '#fff',
        padding: '3rem 1rem',
        textAlign: 'center',
        marginTop: 'auto'
      }}>
        <p>&copy; 2026 Nocturne Coffee. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
