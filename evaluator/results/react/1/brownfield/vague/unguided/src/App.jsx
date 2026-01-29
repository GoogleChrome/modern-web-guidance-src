import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Locations from './pages/Locations';
import Rewards from './pages/Rewards';
import Account from './pages/Account';
import About from './pages/About';
import Order from './pages/Order';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="menu" element={<Menu />} />
        <Route path="menu/*" element={<Menu />} /> {/* Handle sub-routes like /menu/seasonal */}
        <Route path="locations" element={<Locations />} />
        <Route path="rewards" element={<Rewards />} />
        <Route path="account" element={<Account />} />
        <Route path="about" element={<About />} />
        <Route path="careers" element={<About />} /> {/* Reuse About for placeholders */}
        <Route path="contact" element={<About />} />
        <Route path="privacy-policy" element={<About />} />
        <Route path="order-online" element={<Order />} />
        <Route path="*" element={<Home />} /> {/* Fallback */}
      </Route>
    </Routes>
  );
}

export default App;
