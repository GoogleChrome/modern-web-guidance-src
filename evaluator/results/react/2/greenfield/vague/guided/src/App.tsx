import { Hero } from './components/Hero'
import { ProductDetails } from './components/ProductDetails'

function App() {
  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 selection:bg-amber-200">
      <Hero />
      <ProductDetails />
      <footer className="py-8 text-center text-stone-500 text-sm">
        <p>&copy; {new Date().getFullYear()} Artisan Coffee. Built with cutting-edge Web APIs.</p>
      </footer>
    </div>
  )
}

export default App
