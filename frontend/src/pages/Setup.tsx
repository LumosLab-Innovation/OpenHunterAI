import { useState } from "react";
import { ArrowUpRight, CheckCircle2, Circle, RefreshCw } from "lucide-react";
import { useAuth } from "../lib/auth";
import { PageHeader } from "../components/PageHeader";
import { CopyCommand } from "../components/CopyCommand";
import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/States";
import { OrcaRouterProviderPanel } from "../components/orcarouter/OrcaRouterProviderPanel";
import { SKILL_COMMAND } from "./Workspace";

export function SetupPage() {
  const { status, loading, error, refresh } = useAuth();
  const [reasoningProvider, setReasoningProvider] = useState("orcarouter");
  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Setup & models"
        description="Everything you need to run OpenHunterAI on this machine."
        actions={
          <Button
            variant="secondary"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw size={15} />
            Check connection
          </Button>
        }
      />
      {error && <ErrorState message={error} className="mb-6" />}
      <div className="max-w-3xl divide-y divide-hairline">
        <section className="pb-8">
          <h2 className="text-base font-semibold">
            1. Start the local workspace
          </h2>
          <p className="mb-4 mt-2 text-sm text-ink-muted">
            From the repository folder, run this command with Node.js 22+ and
            Docker available.
          </p>
          <CopyCommand command="node ops/local.mjs start" />
          <div className="mt-5 flex flex-wrap gap-6">
            {(["api", "database", "queue"] as const).map((key) => (
              <span
                key={key}
                className="flex items-center gap-2 text-xs text-ink-muted"
              >
                {status?.services[key] === "connected" ? (
                  <CheckCircle2 size={15} className="text-emerald-500" />
                ) : (
                  <Circle size={15} />
                )}
                {key === "api"
                  ? "API"
                  : key === "database"
                    ? "Database"
                    : "Queue"}
                :{" "}
                {loading
                  ? "checking"
                  : (status?.services[key] ?? "unavailable")}
              </span>
            ))}
          </div>
        </section>
        <section className="py-8">
          <h2 className="text-base font-semibold">2. Configure AI reasoning</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Choose a provider for the reasoning routes, add its key, then restart
            the stack. OrcaRouter is a named provider with two sign-in choices:
            paste an API key or connect through OAuth 2.0 + PKCE.
          </p>
          <label className="mt-4 block text-xs font-medium" htmlFor="reasoning-provider">
            Reasoning provider
          </label>
          <select
            id="reasoning-provider"
            data-testid="reasoning-provider"
            className="mt-1 w-full max-w-sm rounded-md border border-hairline bg-canvas px-3 py-2 text-sm"
            value={reasoningProvider}
            onChange={(event) => setReasoningProvider(event.target.value)}
          >
            <option value="orcarouter">OrcaRouter Cyber Inference</option>
            <option value="deepseek">DeepSeek</option>
            <option value="openai">OpenAI</option>
            <option value="claude">Claude</option>
          </select>
          {reasoningProvider === "orcarouter" ? (
            <OrcaRouterProviderPanel />
          ) : (
            <p className="mt-4 rounded-lg border border-hairline px-4 py-3 text-xs leading-5 text-ink-muted">
              {reasoningProvider} stays configured through the private{" "}
              <code>.env.local</code> keys and model aliases already used by the
              gateway. Select OrcaRouter Cyber Inference to configure it here.
            </p>
          )}
          <div className="my-5 divide-y divide-hairline rounded-lg border border-hairline px-4">
            {(
              status?.models ?? [
                { role: "low", provider: "—", model: "", configured: false },
                { role: "high", provider: "—", model: "", configured: false },
              ]
            ).map((item) => (
              <div
                key={item.role}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <p className="text-sm font-medium">
                    {item.role === "low" ? "Fast analysis" : "Deep reasoning"}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {item.provider} / {item.model || "not set"}
                  </p>
                </div>
                <span className="text-xs text-ink-muted">
                  {item.configured
                    ? "Key & model configured"
                    : "Needs configuration"}
                </span>
              </div>
            ))}
          </div>
          <p className="mb-3 text-xs text-ink-muted">
            Configured means a key is present; it does not verify provider
            access or billing.
          </p>
          <CopyCommand command="node ops/local.mjs restart" />
        </section>
        <section className="py-8">
          <h2 className="text-base font-semibold">
            3. Connect your coding agent
          </h2>
          <p className="mb-4 mt-2 text-sm leading-6 text-ink-muted">
            Run in the project you want to assess. Installs for Codex, Claude
            Code, Gemini CLI and Grok Build. OMP can discover the shared
            .agents/skills directory.
          </p>
          <CopyCommand command={SKILL_COMMAND} />
          <a
            href="https://github.com/LumosLab-Innovation/OpenHunterAI/blob/main/docs/LOCAL_WORKSPACE.md"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-xs text-signal"
          >
            Local setup & agent compatibility <ArrowUpRight size={13} />
          </a>
        </section>
        <section className="py-8">
          <h2 className="text-base font-semibold">
            Optional advanced runtimes
          </h2>
          <p className="mb-4 mt-2 text-sm leading-6 text-ink-muted">
            The stack includes browser inspection, ZAP, Nuclei and recon.
            OpenHack and Strix need separately installed runtimes and their
            adapter URLs in .env.local. Unavailable tools are reported as
            unavailable, not as a clean scan. Queue connectivity alone does not
            prove every worker is ready.
          </p>
          <CopyCommand command="node ops/local.mjs status" />
        </section>
      </div>
    </div>
  );
}
