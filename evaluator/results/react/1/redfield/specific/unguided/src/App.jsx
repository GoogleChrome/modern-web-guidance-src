

function App() {
  return (
    <>
      <div className="container">
        <button
          id="tooltip-trigger"
          interesttarget="tooltip"
        >
          Hover over me
        </button>
        <div id="tooltip" popover="auto">I'm a native popover tooltip!</div>
      </div>
    </>
  )
}

export default App
