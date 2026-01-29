import React from 'react';
import Hero from './components/Hero';
import ProductDetails from './components/ProductDetails';
import styles from './App.module.css';

const PRODUCTS = [
  {
    title: 'Ethiopian Yirgacheffe',
    description: 'Bright and floral with notes of jasmine and lemon.',
    ingredients: ['100% Arabica Coffee', 'Single Origin: Ethiopia', 'Washed Process']
  },
  {
    title: 'Sumatra Mandheling',
    description: 'Full-bodied, earthy, and complex with a hint of spice.',
    ingredients: ['100% Arabica Coffee', 'Single Origin: Indonesia', 'Wet-Hulled']
  },
  {
    title: 'Espresso Blend',
    description: 'A rich, creamy blend perfect for lattes and cappuccinos.',
    ingredients: ['Arabica & Robusta Blend', 'Notes of Chocolate & Caramel', 'Medium-Dark Roast']
  }
];

function App() {
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo}>Artisan Roast</div>
        <nav className={styles.nav}>
          <a href="#">Shop</a>
          <a href="#">Subscription</a>
          <a href="#">About</a>
        </nav>
      </header>

      <main>
        <Hero />

        <section className={styles.productsSection}>
          <h2 className={styles.sectionTitle}>Our Selection</h2>
          <div className={styles.grid}>
            {PRODUCTS.map((p) => (
              <ProductDetails key={p.title} {...p} />
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>&copy; 2024 Artisan Roast. Crafted with ❤️ and Caffeine.</p>
      </footer>
    </div>
  );
}

export default App;
