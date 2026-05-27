import { Link, NavLink } from 'react-router-dom';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <header className="topbar">
        <Link className="brand" to="/">
          OpenHunterAI
        </Link>
        <nav>
          <NavLink to="/projects">Projects</NavLink>
          <NavLink to="/scans">Scans</NavLink>
          <NavLink to="/findings">Findings</NavLink>
          <NavLink to="/login">Login</NavLink>
        </nav>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
