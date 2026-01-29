import { useState } from 'react'

function App() {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <>
      <div className="container">
        <button 
          id="tooltip-trigger"
          onMouseOver={() => setShowTooltip(true)}
          onMouseOut={() => setShowTooltip(false)}
        >
          Hover over me
        </button>
        {showTooltip && (
          <div id="tooltip">I'm a manual tooltip!</div>
        )}
      </div>
    </>
  )
}

export default App
