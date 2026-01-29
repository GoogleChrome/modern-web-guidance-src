import { Tooltip } from './components/Tooltip'

function App() {
  return (
    <>
      <div className="container">
        <Tooltip content="I'm a modern tooltip!">
          <button id="tooltip-trigger">
            Hover over me
          </button>
        </Tooltip>
      </div>
    </>
  )
}

export default App
