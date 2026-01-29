import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Layout({ children }) {
  return (
    <>
      <nav>
        <div className="logo"><Link to="/" style={{ color: 'white', textDecoration: 'none' }}>THE DAILY GRIND</Link></div>
        <ul>
          <li><Link to="/menu">Menu</Link></li>
          <li><Link to="/locations">Locations</Link></li>
          <li><Link to="/rewards">Rewards</Link></li>
          <li><Link to="/account">My Account</Link></li>
          <li><Link to="/logout" className="logout-link">Logout</Link></li>
        </ul>
      </nav>
      {children}
      <footer>
        <div className="footer-links">
          <Link to="/about">Our Story</Link> |
          <Link to="/careers">Join the Team</Link> |
          <Link to="/contact">Contact Us</Link> |
          <Link to="/privacy-policy">Privacy</Link>
        </div>
        <p>&copy; 2026 The Daily Grind Coffee Co. All rights reserved.</p>
      </footer>
    </>
  )
}

function Home() {
  return (
    <>
      <header className="hero">
        <h1>Wake Up Your Senses</h1>
        <p>Ethically sourced, locally roasted, delivered to your cup.</p>
        <Link to="/order-online" className="btn">Order Now</Link>
      </header>

      <main className="container">
        <section>
          <h2 style={{ textAlign: 'center' }}>Seasonal Favorites</h2>
          <div className="grid">
            <div className="card">
              <h3>Maple Oat Latte</h3>
              <p>Creamy oat milk with a hint of Vermont maple syrup.</p>
              <Link to="/menu/seasonal" className="btn">View Details</Link>
            </div>
            <div className="card">
              <h3>Dark Roast Espresso</h3>
              <p>Bold, smokey, and perfect for a morning boost.</p>
              <Link to="/menu/espresso" className="btn">View Details</Link>
            </div>
            <div className="card">
              <h3>Cold Brew</h3>
              <p>Steeped for 18 hours for maximum smoothness.</p>
              <Link to="/menu/cold-brew" className="btn">View Details</Link>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}

// Placeholder Components
function Menu() {
  return (
    <div className="container" style={{ padding: '40px 20px', textAlign: 'center' }}>
      <h2>Our Menu</h2>
      <p>Explore our wide selection of coffees, teas, and pastries.</p>
      <div className="grid">
        <div className="card">
          <h3>Coffee</h3>
          <p>Freshly brewed favorites.</p>
          <Link to="/menu/coffee" className="btn">See Items</Link>
        </div>
        <div className="card">
          <h3>Tea</h3>
          <p>Premium loose-leaf teas.</p>
          <Link to="/menu/tea" className="btn">See Items</Link>
        </div>
        <div className="card">
          <h3>Pastries</h3>
          <p>Baked fresh daily.</p>
          <Link to="/menu/pastries" className="btn">See Items</Link>
        </div>
      </div>
    </div>
  )
}

function Locations() {
  return (
    <div className="container" style={{ padding: '40px 20px', textAlign: 'center' }}>
      <h2>Our Locations</h2>
      <p>Find a Daily Grind near you.</p>
      <div className="grid">
        <div className="card">
          <h3>Downtown</h3>
          <p>123 Main St</p>
          <button className="btn" style={{ border: 'none', cursor: 'pointer' }}>Get Directions</button>
        </div>
        <div className="card">
          <h3>Uptown</h3>
          <p>456 Broad St</p>
          <button className="btn" style={{ border: 'none', cursor: 'pointer' }}>Get Directions</button>
        </div>
      </div>
    </div>
  )
}

function Rewards() {
  return (
    <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
      <h2>Daily Rewards</h2>
      <p>Earn points with every sip. Join today and get a free drink on your birthday!</p>
      <Link to="/account" className="btn">Sign Up / Login</Link>
    </div>
  )
}

function Account() {
  return (
    <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
      <h2>My Account</h2>
      <p>Manage your profile, orders, and rewards.</p>
    </div>
  )
}

function PagePlaceholder({ title }) {
  return (
    <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
      <h2>{title}</h2>
      <p>Coming soon!</p>
      <Link to="/" className="btn">Back to Home</Link>
    </div>
  )
}

function Logout() {
  return (
    <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
      <h2>Logged Out</h2>
      <p>You have been successfully logged out.</p>
      <Link to="/" className="btn">Return Home</Link>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/account" element={<Account />} />
          <Route path="/logout" element={<Logout />} />

          <Route path="/order-online" element={<PagePlaceholder title="Order Online" />} />
          <Route path="/about" element={<PagePlaceholder title="Our Story" />} />
          <Route path="/careers" element={<PagePlaceholder title="Join the Team" />} />
          <Route path="/contact" element={<PagePlaceholder title="Contact Us" />} />
          <Route path="/privacy-policy" element={<PagePlaceholder title="Privacy Policy" />} />

          {/* Dynamic or Specific Routes */}
          <Route path="/menu/*" element={<PagePlaceholder title="Menu Item" />} />

          <Route path="*" element={<PagePlaceholder title="Page Not Found" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
