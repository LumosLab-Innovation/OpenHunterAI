import { useEffect, useState } from "react";
import {
  ArrowRight,
  Crosshair,
  FolderPlus,
  Terminal,
  Radar,
  RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { ButtonLink } from "../components/ui/ButtonLink";
import { CopyCommand } from "../components/CopyCommand";
import { ErrorState } from "../components/ui/States";

export const SKILL_COMMAND =
  "npx skills add LumosLab-Innovation/OpenHunterAI --skill openhunter --agent codex claude-code gemini-cli grok --yes";

export function WorkspacePage() {
  const { status, error, loading, refresh } = useAuth();
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [projectsError, setProjectsError] = useState<string | null>(null);
  useEffect(() => {
    if (!status) {
      setProjects([]);
      setProjectsError(null);
      return;
    }
    let active = true;
    void apiFetch<{ projects: Array<{ id: string; name: string }> }>(
      "/v1/projects",
    ).then((res) => {
      if (!active) return;
      if (res.ok) {
        setProjects(res.data.projects);
        setProjectsError(null);
      } else setProjectsError(res.error.message ?? "Could not load projects.");
    });
    return () => {
      active = false;
    };
  }, [status]);
  const ready = Boolean(status);

  return (
    <div className="animate-fade-up">
      <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
            Your machine. Your workspace.
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Security workspace
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-muted">
            Create a project, define your target, and follow the investigation
            from first signal to verified finding.
          </p>
        </div>
        <ButtonLink to={ready ? "/projects?new=1" : "/setup"}>
          <FolderPlus size={16} />
          {ready ? "New project" : "Set up workspace"}
        </ButtonLink>
      </div>

      {error && (
        <ErrorState
          message={error}
          onRetry={() => void refresh()}
          className="mb-6"
        />
      )}

      <div className="mb-10 flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-hairline py-4 text-xs">
        <span className="font-medium text-ink">Local runtime</span>
        {(["api", "database", "queue"] as const).map((service) => (
          <span
            key={service}
            className="flex items-center gap-2 text-ink-muted"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${status?.services[service] === "connected" ? "bg-emerald-500" : "bg-ink-faint"}`}
            />
            {service === "api"
              ? "API"
              : service === "database"
                ? "Database"
                : "Queue"}
            <span className="text-ink-faint">
              {loading ? "Checking…" : (status?.services[service] ?? "Offline")}
            </span>
          </span>
        ))}
        <Link
          to="/setup"
          className="ml-auto flex items-center gap-1 text-ink-muted hover:text-signal"
        >
          Setup & models <ArrowRight size={13} />
        </Link>
      </div>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <section className="min-w-0">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Projects</h2>
            <Link
              to="/projects"
              className="text-xs text-ink-muted hover:text-signal"
            >
              View all <span aria-hidden="true">↗</span>
            </Link>
          </div>
          {projectsError && <ErrorState message={projectsError} />}
          {projects.length ? (
            <div className="divide-y divide-hairline border-y border-hairline">
              {projects.slice(0, 5).map((project) => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="group flex items-center gap-4 py-5"
                >
                  <span className="rounded-lg bg-surface-raised p-3 text-signal">
                    <Crosshair size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-medium">
                      {project.name}
                    </h3>
                    <p className="mt-1 text-xs text-ink-faint">
                      Targets, scope and scan history
                    </p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-ink-faint transition-transform group-hover:translate-x-1"
                  />
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-hairline-strong px-6 py-8 text-center">
              <Radar
                size={34}
                strokeWidth={1.25}
                className="mb-4 text-ink-faint"
              />
              <h3 className="text-sm font-semibold">
                {loading ? "Connecting to your workspace" : ready ? "Your first investigation starts here" : "Connect your local workspace"}
              </h3>
              <p className="mt-2 max-w-xs text-sm leading-6 text-ink-muted">
                {ready ? "Group your target domains, scan runs and evidence in one project." : "Start the local stack to load your projects and continue your work."}
              </p>
              <ButtonLink
                to={ready ? "/projects?new=1" : "/setup"}
                variant="secondary"
                className="mt-5"
              >
                {ready ? "Create a project" : "Connect local runtime"}
                <ArrowRight size={14} />
              </ButtonLink>
            </div>
          )}

          <div className="mt-8 flex gap-3">
            <Terminal size={18} className="mt-1 shrink-0 text-ink-faint" />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium">
                Use it with your coding agent
              </h3>
              <p className="mb-3 mt-1 text-xs leading-5 text-ink-muted">
                Install the OpenHunter skill in your project, then ask your
                agent to prepare an authorized security assessment.
              </p>
              <CopyCommand command={SKILL_COMMAND} />
              <p className="mt-2 text-[11px] text-ink-faint">
                Codex · Claude Code · Gemini CLI · compatible Agent Skills
                clients
              </p>
            </div>
          </div>
        </section>

        <aside className="xl:border-l xl:border-hairline xl:pl-8">
          <h2 className="mb-6 font-display text-lg font-semibold">
            From target to evidence
          </h2>
          <ol className="space-y-7">
            {[
              [
                "01",
                "Create a project",
                "Give your investigation a name. Your work stays organized here.",
              ],
              [
                "02",
                "Verify & define scope",
                "Add your domain, verify ownership, and choose the allowed actions.",
              ],
              [
                "03",
                "Run & review",
                "Follow worker activity, inspect findings, and export a report.",
              ],
            ].map(([number, title, text]) => (
              <li key={number} className="flex gap-4">
                <span className="font-mono text-xs leading-6 text-signal">
                  {number}
                </span>
                <div>
                  <h3 className="text-sm font-medium">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-ink-muted">
                    {text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8 border-t border-hairline pt-6">
            <p className="text-xs font-medium text-ink">
              Bring your own model keys
            </p>
            <p className="mt-2 text-xs leading-5 text-ink-muted">
              Workspace data stays in your local database. AI reasoning sends
              sanitized context to your configured provider.
            </p>
            <Link
              to="/setup"
              className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-signal"
            >
              Check configuration <ArrowRight size={14} />
            </Link>
          </div>
          <Button
            onClick={() => void refresh()}
            disabled={loading}
            variant="ghost"
            size="sm"
            className="mt-5"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh status
          </Button>
        </aside>
      </div>
    </div>
  );
}
