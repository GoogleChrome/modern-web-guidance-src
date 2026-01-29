import React from 'react';
import AdaptiveHero from './components/AdaptiveHero';
import IngredientsPopover from './components/IngredientsPopover';
import './App.css';

function App() {
  return (
    <div className="app">
      <nav className="navbar">
        <div className="logo">☕ CoffeeCo</div>
        <div className="links">
          <a href="#shop">Shop</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </div>
      </nav>

      <main>
        <AdaptiveHero />

        <section className="details-section">
          <h2>Discover the Magic</h2>
          <p>
            Every cup is brewed with passion and precision.
            Want to know what makes our coffee special?
          </p>
          <IngredientsPopover />
        </section>

        <section className="more-content">
          {/* Content to allow scrolling */}
          <h2>Our Story</h2>
          <p>
            Founded in 2024, we bring the finest beans from around the world directly to your cup.
            We believe in sustainable sourcing and fair trade practices.
          </p>
          <div className="spacer" style={{ height: '100vh', background: '#f5f5f5', padding: '2rem' }}>
            <p>Scroll down to see the hero animation in action (if you refresh and scroll from top).</p>
            <p>Actually, the view() timeline animation triggers as it enters/exits the viewport.</p>
          </div>
        </section>
      </main>

      <footer>
        <p>&copy; 2024 CoffeeCo. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
