import React from 'react';

// Start of Selection
declare module 'react' {
  interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
    interestfor?: string;
  }
}

export const ProductDetails: React.FC = () => {
  return (
    <section className="py-24 bg-stone-50">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1">
            <h2 className="text-4xl font-bold text-stone-900 mb-6">Signature Espresso Blend</h2>
            <p className="text-lg text-stone-600 mb-8 leading-relaxed">
              Our signature blend combines beans from Ethiopia and Colombia, offering a bright acidity with deep chocolate undertones. Perfect for both black coffee lovers and milk-based drinks.
            </p>

            <div className="relative inline-block">
              {/* Trigger Button */}
              {/* @ts-ignore - interestfor is experimental */}
              <button
                id="details-trigger"
                className="my-trigger text-amber-700 font-semibold underline decoration-2 underline-offset-4 hover:text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded px-2 py-1 -ml-2"
                interestfor="ingredients-popover"
                style={{ anchorName: '--details-trigger' } as React.CSSProperties}
              >
                View Ingredients Details
              </button>

              {/* Popover Content */}
              <div
                id="ingredients-popover"
                popover="auto"
                className="bg-white p-6 rounded-lg shadow-xl border border-stone-200 max-w-sm mt-2 transition-opacity duration-200 opacity-0 open:opacity-100"
                style={{
                  positionAnchor: '--details-trigger',
                  // @ts-ignore
                  positionArea: 'top center',
                  margin: '0',
                  bottom: 'calc(anchor(top) + 10px)',
                  justifySelf: 'anchor-center'
                } as React.CSSProperties}
              >
                <h3 className="font-bold text-stone-900 mb-3 border-b border-stone-100 pb-2">Blend Composition</h3>
                <ul className="space-y-2 text-stone-600 text-sm">
                  <li className="flex justify-between">
                    <span>Ethiopian Yirgacheffe</span>
                    <span className="font-medium">60%</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Colombian Supremo</span>
                    <span className="font-medium">40%</span>
                  </li>
                </ul>
                <div className="mt-4 pt-3 border-t border-stone-100 text-xs text-stone-400">
                  <span className="font-semibold text-amber-600">Note:</span> Contains natural caffeine.
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 md:order-2">
            <img
              src="https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=800&q=80"
              alt="Espresso Cup"
              className="rounded-2xl shadow-2xl w-full object-cover h-96 hover:scale-[1.02] transition-transform duration-500"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
