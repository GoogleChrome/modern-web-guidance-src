import { Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import Home from './pages/Home';
import Menu from './pages/Menu';
import MenuSeasonal from './pages/MenuSeasonal';
import MenuEspresso from './pages/MenuEspresso';
import MenuColdBrew from './pages/MenuColdBrew';
import Locations from './pages/Locations';
import Rewards from './pages/Rewards';
import Account from './pages/Account';
import Logout from './pages/Logout';
import OrderOnline from './pages/OrderOnline';
import About from './pages/About';
import Careers from './pages/Careers';
import Contact from './pages/Contact';
import Privacy from './pages/Privacy';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="menu" element={<Menu />} />
        <Route path="menu/seasonal" element={<MenuSeasonal />} />
        <Route path="menu/espresso" element={<MenuEspresso />} />
        <Route path="menu/cold-brew" element={<MenuColdBrew />} />
        <Route path="locations" element={<Locations />} />
        <Route path="rewards" element={<Rewards />} />
        <Route path="account" element={<Account />} />
        <Route path="logout" element={<Logout />} />
        <Route path="order-online" element={<OrderOnline />} />
        <Route path="about" element={<About />} />
        <Route path="careers" element={<Careers />} />
        <Route path="contact" element={<Contact />} />
        <Route path="privacy-policy" element={<Privacy />} />
      </Route>
    </Routes>
  );
}

export default App;
