import { useState } from 'react'

function App() {
  return (
    <>
      <nav>
        <div className="logo">THE DAILY GRIND</div>
        <ul>
          <li><a href="/menu">Menu</a></li>
          <li><a href="/locations">Locations</a></li>
          <li><a href="/rewards">Rewards</a></li>
          <li><a href="/account">My Account</a></li>
          <li><a href="/logout" className="logout-link">Logout</a></li>
        </ul>
      </nav>

      <header className="hero">
        <h1>Wake Up Your Senses</h1>
        <p>Ethically sourced, locally roasted, delivered to your cup.</p>
        <a href="/order-online" className="btn">Order Now</a>
      </header>

      <main className="container">
        <section>
          <h2 style={{ textAlign: 'center' }}>Seasonal Favorites</h2>
          <div className="grid">
            <div className="card">
              <h3>Maple Oat Latte</h3>
              <p>Creamy oat milk with a hint of Vermont maple syrup.</p>
              <a href="/menu/seasonal" className="btn">View Details</a>
            </div>
            <div className="card">
              <h3>Dark Roast Espresso</h3>
              <p>Bold, smokey, and perfect for a morning boost.</p>
              <a href="/menu/espresso" className="btn">View Details</a>
            </div>
            <div className="card">
              <h3>Cold Brew</h3>
              <p>Steeped for 18 hours for maximum smoothness.</p>
              <a href="/menu/cold-brew" className="btn">View Details</a>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="footer-links">
          <a href="/about">Our Story</a> |
          <a href="/careers">Join the Team</a> |
          <a href="/contact">Contact Us</a> |
          <a href="/privacy-policy">Privacy</a>
        </div>
        <p>&copy; 2026 The Daily Grind Coffee Co. All rights reserved.</p>
      </footer>
    </>
  )
}

export default App
