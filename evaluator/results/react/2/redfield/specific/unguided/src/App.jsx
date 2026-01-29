

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
        <div id="tooltip" popover="auto">
          <img src="https://picsum.photos/id/10/200/100" alt="Scenic view" style={{ display: 'block', marginBottom: '8px', borderRadius: '4px' }} />
          I'm a native popover tooltip!
        </div>
      </div>
    </>
  )
}

export default App
