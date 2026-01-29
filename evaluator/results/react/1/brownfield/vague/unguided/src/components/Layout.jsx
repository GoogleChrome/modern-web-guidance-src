import { Link, Outlet } from 'react-router-dom';

function Layout() {
  return (
    <>
      <nav>
        <div className="logo">THE DAILY GRIND</div>
        <ul>
          <li><Link to="/menu">Menu</Link></li>
          <li><Link to="/locations">Locations</Link></li>
          <li><Link to="/rewards">Rewards</Link></li>
          <li><Link to="/account">My Account</Link></li>
          <li><Link to="/logout" className="logout-link">Logout</Link></li>
        </ul>
      </nav>

      <Outlet />

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
  );
}

export default Layout;
