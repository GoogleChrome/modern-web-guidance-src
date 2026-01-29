import Hero from './components/Hero';
import ProductDetails from './components/ProductDetails';

function App() {
  return (
    <div className="app">
      <header style={{ marginBottom: '4rem' }}>
        <h1 style={{ fontSize: '3rem', color: 'var(--color-primary)' }}>Velvet Bean Coffee</h1>
        <p>Experience the finest roast.</p>
      </header>

      <main>
        <Hero />
        <div style={{ height: '100px' }} /> {/* Spacer */}
        <ProductDetails />
        <div style={{ height: '100vh' }} /> {/* Extra scroll space to test things */}
      </main>
    </div>
  );
}

export default App;
