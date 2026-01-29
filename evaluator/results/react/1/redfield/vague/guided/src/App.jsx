import 'interestfor';
import '@oddbird/popover-polyfill';
import '@oddbird/css-anchor-positioning';

function App() {
  return (
    <>
      <div className="container">
        <button
          id="tooltip-trigger"
          interestfor="tooltip"
        >
          Hover over me
        </button>
        <div id="tooltip" popover="hint">I'm a modern tooltip!</div>
      </div>
    </>
  )
}

export default App
