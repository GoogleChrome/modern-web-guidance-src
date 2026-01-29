import Tooltip from './components/Tooltip';

function App() {
  return (
    <div className="app-container">
      <div className="card">
        <img
          className="avatar"
          src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"
          alt="User Avatar"
        />
        <h2>
          Jane Doe
          <Tooltip content="Verified User" position="top">
            <span className="info-icon" tabIndex="0" aria-label="More info">i</span>
          </Tooltip>
        </h2>
        <p>Senior Software Engineer @ Tech Corp</p>

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <Tooltip content="Send an email" position="bottom">
            <button>Contact</button>
          </Tooltip>
          <Tooltip content="View full profile details" position="right">
            <button>Profile</button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

export default App
