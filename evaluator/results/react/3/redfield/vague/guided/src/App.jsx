

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
        <div id="tooltip" popover="hint">I'm a native tooltip!</div>
      </div>
    </>
  )
}

export default App
