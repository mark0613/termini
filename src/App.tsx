import "./App.css";

const emptyConnections = [
  "建立 vault 之後，SSH profiles 會出現在這裡。",
  "選取 profile 會開新 tab 並連線。",
  "sudo/password prompt helper 會在 terminal pane 內提示。",
];

function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">T</span>
          <div>
            <h1>Termini</h1>
            <p>Local SSH vault</p>
          </div>
        </div>

        <section className="sidebar-section">
          <div className="section-heading">
            <h2>Vaults</h2>
            <button type="button" aria-label="新增 vault">
              +
            </button>
          </div>
          <button type="button" className="vault-row is-active">
            Personal
          </button>
        </section>

        <section className="sidebar-section grow">
          <div className="section-heading">
            <h2>Connections</h2>
            <button type="button" aria-label="新增 SSH profile">
              +
            </button>
          </div>
          <div className="empty-list">
            {emptyConnections.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>
      </aside>

      <section className="workspace">
        <header className="tabbar">
          <button type="button" className="tab is-active">
            Welcome
          </button>
          <button type="button" className="new-tab" aria-label="新增 tab">
            +
          </button>
        </header>

        <section className="terminal-area">
          <div className="terminal-placeholder">
            <h2>No active SSH session</h2>
            <p>建立 vault 與 connection 後，terminal 會在這裡開啟。</p>
          </div>
        </section>

        <footer className="statusbar">
          <span>Disconnected</span>
          <span>Alt+Shift+D split</span>
          <span>Alt+Shift++ vertical</span>
          <span>Alt+Shift+- horizontal</span>
        </footer>
      </section>
    </main>
  );
}

export default App;
