import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Crosshair,
  FileText,
  FolderKanban,
  House,
  Menu,
  Moon,
  Radar,
  Settings2,
  Sun,
  X,
} from "lucide-react";
import { cn } from "../lib/cn";
import { useTheme } from "../lib/theme";
import { useAuth } from "../lib/auth";
import { Button } from "./ui/Button";
import { ButtonLink } from "./ui/ButtonLink";

const NAV = [
  { to: "/", label: "Overview", icon: House },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/scans", label: "Scan runs", icon: Radar },
  { to: "/findings", label: "Findings", icon: Crosshair },
  { to: "/reports", label: "Reports", icon: FileText },
];
const REPO = "https://github.com/LumosLab-Innovation/OpenHunterAI";

function BrandMark() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal text-signal-ink">
        <Crosshair size={18} />
      </span>
      <span className="font-display text-base font-semibold tracking-tight">
        OpenHunter<span className="text-ink-muted">AI</span>
      </span>
    </Link>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </Button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, mode, status, loading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);
  const title =
    location.pathname === "/setup"
      ? "Setup & models"
      : (NAV.find(({ to }) => to !== "/" && location.pathname.startsWith(to))
          ?.label ?? "Overview");

  if (mode === "hosted" && !user && !loading)
    return (
      <div className="min-h-screen">
        <header className="border-b border-hairline">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
            <BrandMark />
            <div className="flex gap-2">
              <ThemeToggle />
              <ButtonLink to="/login" variant="ghost">
                Sign in
              </ButtonLink>
              <ButtonLink to="/register">Create workspace</ButtonLink>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    );

  function navigation() {
    return (
      <>
        <p className="mb-3 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          Workspace
        </p>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            end={to === "/"}
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                "mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-signal/10 text-signal"
                  : "text-ink-muted hover:bg-surface-raised hover:text-ink",
              )
            }
          >
            <Icon size={17} strokeWidth={1.6} />
            {label}
          </NavLink>
        ))}
        <div className="my-5 border-t border-hairline" />
        <NavLink
          to="/setup"
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors",
              isActive
                ? "bg-signal/10 text-signal"
                : "text-ink-muted hover:text-ink",
            )
          }
        >
          <Settings2 size={17} />
          Setup & models
        </NavLink>
        <a
          href={REPO}
          target="_blank"
          rel="noreferrer"
          className="mt-1 flex items-center gap-3 px-3 py-2.5 text-[13px] text-ink-muted hover:text-ink"
        >
          <ArrowUpRight size={17} />
          GitHub repository
        </a>
      </>
    );
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <a
        href="#workspace-content"
        className="sr-only z-50 rounded bg-signal p-3 text-signal-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-hairline bg-surface lg:flex">
        <div className="flex h-[76px] shrink-0 items-center px-5">
          <BrandMark />
        </div>
        <nav
          aria-label="Main navigation"
          className="flex-1 overflow-y-auto px-3 py-5"
        >
          {navigation()}
        </nav>
        <div className="m-4 border-t border-hairline pt-4">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                status ? "bg-emerald-500" : "bg-ink-faint",
              )}
            />
            {mode === "local"
              ? "Local workspace"
              : (user?.orgName ?? "Workspace")}
          </div>
          <p className="mt-2 text-[11px] leading-5 text-ink-faint">
            {mode === "local"
              ? "Runs on your machine.\nNo account needed."
              : user?.email}
          </p>
          {mode === "hosted" && user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void signOut().then(() => navigate("/login"))}
            >
              Sign out
            </Button>
          )}
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-[64px] items-center justify-between border-b border-hairline bg-canvas/95 px-5 backdrop-blur lg:px-9">
          <div className="lg:hidden">
            <BrandMark />
          </div>
          <div className="hidden items-center gap-3 text-xs lg:flex">
            <span className="text-ink-faint">Workspace</span>
            <span className="text-ink-faint">/</span>
            <span className="font-medium">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded border border-hairline px-2 py-1 font-mono text-[10px] text-ink-muted sm:inline">
              {mode === "local" ? "LOCAL" : "HOSTED"}
            </span>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>
          </div>
        </header>
        {mobileOpen && (
          <nav
            aria-label="Mobile navigation"
            className="fixed inset-0 top-16 z-40 overflow-y-auto bg-surface p-5 lg:hidden"
          >
            {navigation()}
          </nav>
        )}
        <main
          id="workspace-content"
          className="mx-auto w-full max-w-[1280px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
