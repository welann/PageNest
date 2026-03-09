import { Outlet } from "react-router-dom";

import { Sidebar } from "@components/shell/Sidebar";

export function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <header className="topbar">
          <div>
            <div className="eyebrow">Private AI Workshop</div>
            <h1 className="topbar__title">PageNest</h1>
          </div>
          <div className="topbar__meta">
            <span>Cloudflare-first</span>
            <span>Modules in code</span>
          </div>
        </header>
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

