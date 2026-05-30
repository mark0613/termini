const emptyConnections = [
  "建立 vault 之後，SSH profiles 會出現在這裡。",
  "選取 profile 會開新 tab 並連線。",
  "sudo/password prompt helper 會在 terminal pane 內提示。",
];

function App() {
  return (
    <main className="grid h-dvh w-full grid-cols-[280px_minmax(0,1fr)] overflow-hidden bg-[#11161c] text-[#e7edf3] max-[820px]:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="flex min-w-0 flex-col border-r border-[#25313c] bg-[#161d24]">
        <div className="flex min-h-[72px] items-center gap-3 border-b border-[#25313c] p-4">
          <span className="grid size-9 place-items-center rounded-lg bg-[#55c2a2] font-extrabold text-[#081117]">
            T
          </span>
          <div>
            <h1 className="text-lg leading-6 font-semibold">Termini</h1>
            <p className="text-xs leading-4 text-[#8fa1b2]">Local SSH vault</p>
          </div>
        </div>

        <section className="flex min-h-0 flex-col border-b border-[#25313c] px-3 py-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <h2 className="text-xs font-bold tracking-normal text-[#8fa1b2] uppercase">
              Vaults
            </h2>
            <button
              type="button"
              className="grid size-7 cursor-pointer place-items-center rounded-md border border-[#334353] bg-[#1d2731] hover:bg-[#263442]"
              aria-label="新增 vault"
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="min-h-9 w-full cursor-pointer rounded-md border border-[#2e6f5d] bg-[#1f3a34] px-2.5 text-left text-[#d9e3ec]"
          >
            Personal
          </button>
        </section>

        <section className="flex min-h-0 flex-1 flex-col px-3 py-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <h2 className="text-xs font-bold tracking-normal text-[#8fa1b2] uppercase">
              Connections
            </h2>
            <button
              type="button"
              className="grid size-7 cursor-pointer place-items-center rounded-md border border-[#334353] bg-[#1d2731] hover:bg-[#263442]"
              aria-label="新增 SSH profile"
            >
              +
            </button>
          </div>
          <div className="grid gap-2 text-[13px] leading-[18px] text-[#8fa1b2]">
            {emptyConnections.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>
      </aside>

      <section className="grid h-full min-w-0 grid-rows-[44px_minmax(0,1fr)_28px]">
        <header className="flex items-end gap-1 border-b border-[#25313c] bg-[#151b22] px-2 pt-1.5">
          <button
            type="button"
            className="h-9 min-w-33 max-w-55 cursor-pointer rounded-t-lg border border-b-0 border-[#25313c] bg-[#202b35] px-3 text-left"
          >
            Welcome
          </button>
          <button
            type="button"
            className="grid size-7 cursor-pointer place-items-center rounded-md border border-[#334353] bg-[#1d2731] hover:bg-[#263442]"
            aria-label="新增 tab"
          >
            +
          </button>
        </header>

        <section className="min-h-0 min-w-0 bg-[#0d1116] p-3">
          <div className="grid size-full place-content-center gap-2 rounded-lg border border-dashed border-[#334353] text-center text-[#8fa1b2]">
            <h2 className="text-lg font-semibold text-[#d9e3ec]">
              No active SSH session
            </h2>
            <p>建立 vault 與 connection 後，terminal 會在這裡開啟。</p>
          </div>
        </section>

        <footer className="flex min-w-0 items-center gap-[18px] overflow-hidden border-t border-[#25313c] bg-[#151b22] px-2.5 text-xs whitespace-nowrap text-[#8fa1b2] max-[820px]:gap-2.5">
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
