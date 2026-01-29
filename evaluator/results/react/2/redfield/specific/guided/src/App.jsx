import './App.css'

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
        <div id="tooltip" popover="hint">I'm a modern popover tooltip!</div>
      </div>
    </>
  )
}

export default App
