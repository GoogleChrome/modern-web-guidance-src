import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import Menu from './pages/Menu'
import Locations from './pages/Locations'
import Rewards from './pages/Rewards'
import Account from './pages/Account'
import OrderOnline from './pages/OrderOnline'
import Seasonal from './pages/Seasonal'
import Espresso from './pages/Espresso'
import ColdBrew from './pages/ColdBrew'

function App() {
  return (
    <>
      <nav>
        <div className="logo">THE DAILY GRIND</div>
        <ul>
          <li><Link to="/menu">Menu</Link></li>
          <li><Link to="/locations">Locations</Link></li>
          <li><Link to="/rewards">Rewards</Link></li>
          <li><Link to="/account">My Account</Link></li>
          <li><a href="/logout" className="logout-link">Logout</a></li>
        </ul>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/locations" element={<Locations />} />
        <Route path="/rewards" element={<Rewards />} />
        <Route path="/account" element={<Account />} />
        <Route path="/order-online" element={<OrderOnline />} />
        <Route path="/menu/seasonal" element={<Seasonal />} />
        <Route path="/menu/espresso" element={<Espresso />} />
        <Route path="/menu/cold-brew" element={<ColdBrew />} />
      </Routes>

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

export default App
