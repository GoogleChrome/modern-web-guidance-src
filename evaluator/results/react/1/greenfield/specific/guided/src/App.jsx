import React from 'react';
import { Hero } from './components/Hero';
import { ProductCard } from './components/ProductCard';
import './index.css';

// Polyfills
import '@oddbird/popover-polyfill';
import '@oddbird/css-anchor-positioning';
// interestfor polyfill usually needs to be loaded as a script or imported to run side effects
import 'interestfor';

function App() {
  const products = [
    {
      id: 'latte',
      title: 'Velvet Latte',
      price: '$4.50',
      description: 'Smooth and creamy with a hint of caramel.',
      ingredients: ['Espresso', 'Steamed Milk', 'Caramel Syrup', 'Love'],
      image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=800&q=80'
    },
    {
      id: 'matcha',
      title: 'Zen Matcha',
      price: '$5.00',
      description: 'Premium ceremonial grade matcha.',
      ingredients: ['Matcha Powder', 'Hot Water', 'Oat Milk'],
      image: 'https://images.unsplash.com/photo-1515825838458-f2a94b20105a?auto=format&fit=crop&w=800&q=80'
    },
    {
      id: 'coldbrew',
      title: 'Midnight Cold Brew',
      price: '$4.00',
      description: 'Steeped for 24 hours for maximum punch.',
      ingredients: ['Coarse Ground Coffee', 'Cool Water', 'Time'],
      image: 'https://images.unsplash.com/photo-1517701604599-bb29b5c7dd8c?auto=format&fit=crop&w=800&q=80'
    }
  ];

  return (
    <div className="App">
      <Hero />

      <main className="container" style={{ padding: '4rem 1rem' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '3rem', fontSize: '2.5rem' }}>Our Signature Brews</h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem'
        }}>
          {products.map(product => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>
      </main>

      <footer style={{
        textAlign: 'center',
        padding: '2rem',
        borderTop: '1px solid var(--color-surface)',
        marginTop: '2rem',
        color: 'var(--color-text-secondary)'
      }}>
        <p>&copy; 2024 Morning Brew. Built with modern web features.</p>
      </footer>
    </div>
  );
}

export default App;
