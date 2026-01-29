
import React from 'react';
import Hero from './components/Hero';
import ProductCard from './components/ProductCard';
import './App.css';

function App() {
  const products = [
    {
      name: "Ethiopian Yirgacheffe",
      description: "Floral and citrus notes with a light body.",
      ingredients: ["100% Arabica Coffee Beans", "Light Roast", "Single Origin"],
      image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80",
      placeholder: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=50&q=10"
    },
    {
      name: "Colombian Supremo",
      description: "Rich and full-bodied with hints of caramel.",
      ingredients: ["100% Arabica Coffee Beans", "Medium Roast", "Washed Process"],
      image: "https://images.unsplash.com/photo-1521302080334-4bebac270444?auto=format&fit=crop&w=600&q=80",
      placeholder: "https://images.unsplash.com/photo-1521302080334-4bebac270444?auto=format&fit=crop&w=50&q=10"
    },
    {
      name: "Sumatra Mandheling",
      description: "Earthy and herbal with a heavy body.",
      ingredients: ["100% Arabica Coffee Beans", "Dark Roast", "Wet Hulled"],
      image: "https://images.unsplash.com/photo-1512568400610-43a042550f24?auto=format&fit=crop&w=600&q=80",
      placeholder: "https://images.unsplash.com/photo-1512568400610-43a042550f24?auto=format&fit=crop&w=50&q=10"
    }
  ];

  return (
    <div className="app">
      <header className="header">
        <nav>
          <div className="logo">The Daily Grind</div>
          <ul>
            <li><a href="#menu">Menu</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
        </nav>
      </header>

      <main>
        <Hero />

        <section id="menu" className="menu-section">
          <h2>Our Selection</h2>
          <div className="product-grid">
            {products.map((product, index) => (
              <ProductCard key={index} {...product} />
            ))}
          </div>
        </section>

        <section id="about" className="about-section">
          <h2>About Us</h2>
          <p>We believe in sustainable sourcing and expert roasting.</p>
        </section>
      </main>

      <footer>
        <p>&copy; 2024 The Daily Grind Coffee Shop</p>
      </footer>
    </div>
  );
}

export default App;
