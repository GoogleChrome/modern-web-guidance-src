import React, { useEffect, useRef } from 'react';

function AdSlotFireplace() {
  const topSlotRef = useRef(null);
  const leftSlotRef = useRef(null);
  const rightSlotRef = useRef(null);

  useEffect(() => {
    if (topSlotRef.current && leftSlotRef.current && rightSlotRef.current) {
      window.adNetwork = window.adNetwork || [];
      window.adNetwork.push({
        type: 'adSlot',
        config: {
          adType: 'fireplace',
          slots: {
            top: topSlotRef.current,
            left: leftSlotRef.current,
            right: rightSlotRef.current,
          },
        },
      });
    }
  }, []);

  return (
    <>
      <div ref={topSlotRef} className="sticky top-0 h-[100px] z-10 col-span-full order-1"></div>
      <div ref={leftSlotRef} className="hidden xl:block fixed top-[100px] left-0 w-[200px] bottom-0 order-2"></div>
      <div ref={rightSlotRef} className="hidden xl:block fixed top-[100px] right-0 w-[200px] bottom-0 order-4"></div>
    </>
  );
}

export default AdSlotFireplace;
