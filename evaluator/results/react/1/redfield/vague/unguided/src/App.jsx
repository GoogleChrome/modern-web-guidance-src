import { useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';

function App() {
  return (
    <Tooltip.Provider>
      <div className="container">
        <Tooltip.Root delayDuration={200}>
          <Tooltip.Trigger asChild>
            <button className="IconButton" aria-label="More information">
              <Info size={20} />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content className="TooltipContent" sideOffset={5}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontWeight: '600', fontSize: '13px' }}>Information</span>
                <span style={{ opacity: 0.9 }}>This is a premium, accessible tooltip.</span>
              </div>
              <Tooltip.Arrow className="TooltipArrow" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>
    </Tooltip.Provider>
  );
}

export default App;
