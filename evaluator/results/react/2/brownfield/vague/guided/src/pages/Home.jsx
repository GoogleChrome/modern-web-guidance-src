import { Link } from 'react-router-dom';

export default function Home() {
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
  );
}
