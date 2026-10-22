import React, { useEffect, useRef } from 'react';

export default function AdSlotBanner() {
  const adSlotRef = useRef(null);

  useEffect(() => {
    if (adSlotRef.current) {
      window.adNetwork = window.adNetwork || [];
      window.adNetwork.push({
        type: 'adSlot',
        config: {
          adType: 'banner',
          slotElement: adSlotRef.current,
        },
      });
    }
  }, []);

  return <div ref={adSlotRef} className="w-full my-4 transition-height duration-500"></div>;
}
