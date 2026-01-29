import React from 'react';
import { AdaptiveImage } from './AdaptiveImage';

export const Hero: React.FC = () => {
  return (
    <section className="relative h-screen min-h-[600px] overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 z-0">
        <AdaptiveImage
          src="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=2000&q=80"
          placeholderSrc="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=200&q=10"
          alt="Coffee Shop Hero"
          className="w-full h-full object-cover animate-fade-in animation-timeline-view [animation-range:entry_0%_entry_100%]"
          style={{
            // Fallback for browsers without scroll-driven animations support
            // We can't easily detect support in inline styles, but pure CSS handles the interaction.
            // Tailwind config adds the animation definitions.
          }}
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <div className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
          Brewed to Perfection
        </h1>
        <p className="text-xl md:text-2xl mb-8 font-light text-gray-200">
          Experience the art of coffee in every cup. Sustainably sourced, expertly roasted.
        </p>
        <button className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 rounded-full text-lg font-semibold transition-colors">
          Order Now
        </button>
      </div>
    </section>
  );
};
