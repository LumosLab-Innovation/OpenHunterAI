#!/usr/bin/env node

import { createInterface } from 'node:readline/promises';
import { isIP } from 'node:net';
import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { renderTerminalArt } from './terminal-art.mjs';
import { runReaCli } from './rea.mjs';

export const BANNER = renderTerminalArt({ columns: 64, rows: 27, color: false });

const HELP = `OpenHunterAI — local, evidence-first security testing

Usage:
  openhunterai                         Choose CLI scan or open dashboard
  openhunterai scan --host HOST_OR_URL --authorized [--profile quick|standard|deep] [--scope path|host] [--json]
  openhunterai dashboard               Open the local dashboard
  openhunterai rea doctor              Check the optional pinned REA runtime
  openhunterai rea analyze DIRECTORY --authorized
                                      Analyze an authorized local web artifact with REA
  openhunterai llm-routes              Show system-wide module routes
  openhunterai llm-routes probe        Check installed coding CLIs
  openhunterai llm-routes set USE SLOT CLI MODEL LEVEL

Options:
  --host URL        Public HTTPS host or URL (required when non-interactive)
  --scope MODE      path (default) or host when URL contains a path
  --profile NAME    standard (default), quick, or deep; no finding-count quota
  --accept-gaps     Continue when preflight reports unavailable optional workers
  --deep-risk-accepted  Confirm Deep targets a staging/dev/test environment you control
  --api URL         OpenHunter API; defaults to http://127.0.0.1:4000
  --dashboard-url  Dashboard URL; defaults to http://127.0.0.1:3001
  --project-id ID   Reuse an existing project; otherwise create/reuse one named HOST
  --authorized      Confirm you have authority to test HOST (required when non-interactive)
  --no-wait         Start the scan and print its ID without waiting for a report
  --json            Machine-readable JSON; never print terminal art
  --help            Show this help

The local self-hosted engine needs no account or password.
`;

export function normalizeScanTarget(input) {
  const raw = input.trim();
  if (!raw) throw new Error('A public HTTPS host is required.');
  if (/:[0-9]+(?:[/?#]|$)/.test(raw)) throw new Error('Enter a hostname without a port.');
  const target = new URL(raw.includes('://') ? raw : `https://${raw}`);
  if (target.protocol !== 'https:' || target.username || target.password || target.port ||
      target.search || target.hash) {
    throw new Error('Enter one public HTTPS URL without credentials, ports, or query strings.');
  }
  const host = target.hostname.toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(host) || !host.includes('.') || host.includes('..') ||
      ['.local', '.localhost', '.internal', '.intranet', '.lan', '.home.arpa'].some((suffix) => host.endsWith(suffix)) || isIP(host) !== 0) {
    throw new Error('Enter a valid public hostname.');
  }
  return { host, path: target.pathname.replace(/\/+$/, '') || '/' };
}

export function normalizeTarget(input) { return normalizeScanTarget(input).host; }

export function parseArgs(args) {
  const options = { command: args.includes('--host') ? 'scan' : 'menu', api: process.env.OPENHUNTER_API_BASE ?? 'http://127.0.0.1:4000' };
  const rest = [...args];
  if (rest[0] && !rest[0].startsWith('--')) options.command = rest.shift();
  if (options.command === 'rea') {
    options.reaArgs = rest;
    options.help = rest.length === 1 && ['--help', '-h'].includes(rest[0]);
    return options;
  }
  if (options.command === 'llm-routes') {
    options.llmArgs = [];
    while (rest[0] && !rest[0].startsWith('--')) options.llmArgs.push(rest.shift());
  }
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (['--host', '--api', '--project-id', '--dashboard-url', '--scope', '--profile'].includes(arg)) {
      if (!rest[i + 1] || rest[i + 1].startsWith('--')) throw new Error(`${arg} needs a value.`);
      options[arg.slice(2).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())] = rest[++i];
    } else if (arg === '--authorized') options.authorized = true;
    else if (arg === '--accept-gaps') options.acceptGaps = true;
    else if (arg === '--deep-risk-accepted') options.deepRiskAccepted = true;
    else if (arg === '--no-wait') options.noWait = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (options.scope && !['path', 'host'].includes(options.scope)) throw new Error('--scope must be path or host.');
  if (options.profile && !['quick', 'standard', 'deep'].includes(options.profile)) throw new Error('--profile must be quick, standard, or deep.');
  return options;
}

function dashboardUrl(options) {
  const url = new URL(options.dashboardUrl ?? process.env.OPENHUNTER_DASHBOARD_URL ?? 'http://127.0.0.1:3001');
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Dashboard URL must be an HTTPS origin (HTTP allowed only on loopback).');
  }
  return url.origin;
}

function printBrand(options) {
  if (options.json || !process.stdout.isTTY) return;
  process.stdout.write(renderTerminalArt({
    columns: process.stdout.columns ?? 80,
    rows: process.stdout.rows ?? 32,
    color: !process.env.NO_COLOR,
  }));
}

async function openDashboard(options) {
  const url = dashboardUrl(options);
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5000) }).catch(() => null);
  if (!response?.ok) throw new Error('The local dashboard is not running. Start the self-hosted Docker stack first.');
  const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  await new Promise((resolve, reject) => {
    const child = spawn(command, [url], { detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
  process.stdout.write(`Opened ${url}\n`);
}

async function menu(options) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) { process.stdout.write(HELP); return; }
  printBrand(options);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  let choice;
  try {
    process.stdout.write('\n  1  Scan a target in the CLI\n  2  Open the dashboard\n  3  Exit\n\n');
    choice = (await prompt.question('Choose [1-3]: ')).trim();
  } finally { prompt.close(); }
  if (choice === '1') await scan({ ...options, command: 'scan', brandPrinted: true });
  else if (choice === '2') await openDashboard(options);
  else if (choice !== '3') throw new Error('Choose 1, 2, or 3.');
}

function validateApi(input) {
  const api = new URL(input);
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(api.hostname);
  if ((api.protocol !== 'https:' && !(loopback && api.protocol === 'http:')) ||
      api.username || api.password || api.search || api.hash || api.pathname !== '/') {
    throw new Error('API must be an HTTPS origin (HTTP allowed only on loopback).');
  }
  return api.origin;
}

export async function run(options) {
  if (options.help) { process.stdout.write(HELP); return; }
  if (options.command === 'menu') return menu(options);
  if (options.command === 'dashboard') { printBrand(options); return openDashboard(options); }
  if (options.command === 'llm-routes') return llmRoutes(options);
  if (options.command === 'rea') {
    const { exitCode, output } = await runReaCli(options.reaArgs ?? []);
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    process.exitCode = exitCode;
    return;
  }
  if (options.command !== 'scan') throw new Error('Choose scan, rea, dashboard, or llm-routes.');
  return scan(options);
}

async function scan(options) {
  const api = validateApi(options.api);
  if (!options.brandPrinted) printBrand(options);

  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  let target = options.host ? normalizeScanTarget(options.host) : null;
  let authorized = options.authorized ?? false;
  let profile = options.profile ?? 'standard';
  let deepRiskAccepted = options.deepRiskAccepted ?? false;
  if ((!target || !authorized) && !interactive) {
    throw new Error('Non-interactive scan requires --host and --authorized.');
  }
  if (interactive && (!target || !authorized)) {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try {
      if (!target) target = normalizeScanTarget(await prompt.question('Public HTTPS URL or host: '));
      if (!options.profile) {
        const answer = (await prompt.question('Profile: standard (controlled), quick (safe discovery), or deep (staging only)? [standard] ')).trim().toLowerCase();
        if (answer) {
          if (!['quick', 'standard', 'deep'].includes(answer)) throw new Error('Choose quick, standard, or deep.');
          profile = answer;
        }
      }
      if (target.path !== '/' && !options.scope) {
        const answer = (await prompt.question(`Scope: only ${target.host}${target.path} and descendants [p], or entire host [h]? [p/H] `)).trim().toLowerCase();
        options.scope = answer === 'h' || answer === 'host' ? 'host' : 'path';
      }
      if (!authorized) {
        const scopeLabel = options.scope === 'host' || target.path === '/' ? target.host : `${target.host}${target.path} and descendants`;
        const answer = (await prompt.question(`Confirm you are authorized to run a ${profile} scan of ${scopeLabel}? [y/N] `)).trim().toLowerCase();
        authorized = answer === 'y' || answer === 'yes';
      }
      if (profile === 'deep' && !deepRiskAccepted) {
        const answer = (await prompt.question('Confirm this is staging/dev/test you control and accept active-testing risk? [y/N] ')).trim().toLowerCase();
        deepRiskAccepted = answer === 'y' || answer === 'yes';
      }
    } finally { prompt.close(); }
  }
  if (!authorized) throw new Error('Explicit authority confirmation is required.');
  if (profile === 'deep' && !deepRiskAccepted) throw new Error('Deep requires --deep-risk-accepted for staging/dev/test.');
  const host = target.host;
  const allowedPaths = target.path !== '/' && options.scope !== 'host' ? [target.path] : [];

  async function request(path, method = 'GET', body) {
    const response = await fetch(`${api}${path}`, {
      method,
      redirect: 'manual',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status >= 300 && response.status < 400) throw new Error(`${path}: unexpected redirect.`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status} (${data?.error?.code ?? 'REQUEST_FAILED'}).`);
    return data;
  }

  const engineMode = await request('/v1/auth/mode');
  if (!engineMode.localMode) throw new Error('This CLI requires a local-mode OpenHunterAI engine.');
  const targetUrl = `https://${host}${target.path === '/' ? '/' : target.path}`;
  const body = {
    schemaVersion: 'scan_request_v2', targetUrl, profile, authorityConfirmed: true,
    scope: { allowedPaths, excludedPaths: [] },
    aggressiveStagingRiskAccepted: deepRiskAccepted,
    ...(options.projectId ? { projectId: options.projectId } : {}),
  };
  const preflight = (await request('/v1/scans/preflight', 'POST', body)).preflight;
  if (!options.json && Array.isArray(preflight?.moduleRoutes)) {
    for (const row of preflight.moduleRoutes.filter((item) => item.invoked)) {
      process.stdout.write(`${formatRouteHop(row.useCase, 'primary', row.primary)}; ${formatRouteHop(row.useCase, 'fallback', row.fallback)}\n`);
    }
  }
  if (!preflight?.ok) throw new Error(`Preflight blocked: ${(preflight?.failures ?? []).map((failure) => failure.code ?? 'UNKNOWN').join(', ')}`);
  const gaps = preflight.coverageGaps ?? [];
  if (gaps.length > 0 && !options.acceptGaps) {
    if (!interactive) throw new Error(`Unavailable workers: ${gaps.join(', ')}. Use --accept-gaps to continue with the same ${profile} profile.`);
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try {
      process.stdout.write(`Unavailable workers: ${gaps.join(', ')}\n`);
      const answer = (await prompt.question(`Continue ${profile} scan with these coverage gaps? [y/N] `)).trim().toLowerCase();
      if (answer !== 'y' && answer !== 'yes') throw new Error('Scan cancelled before start.');
    } finally { prompt.close(); }
  }
  const scan = (await request('/v1/scans', 'POST', { ...body, acceptedCoverageGaps: gaps })).scan;
  if (!scan?.id) throw new Error('Scan did not start.');

  if (!options.json) process.stdout.write(`Scan ${scan.id} started for ${host}.\n`);
  if (options.noWait) {
    if (options.json) process.stdout.write(`${JSON.stringify({ scanId: scan.id, targetHost: host, profile, coverageGaps: gaps, state: 'started' })}\n`);
    return;
  }
  const deadline = Date.now() + 12 * 60_000;
  let current;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    current = (await request(`/v1/scans/${encodeURIComponent(scan.id)}`)).scan;
    if (['completed', 'failed', 'cancelled', 'timeout'].includes(current?.state)) break;
  }
  if (current?.state !== 'completed') throw new Error(`Scan ${scan.id} ended without a report (${current?.state ?? 'wait_timeout'}).`);
  const finalReport = current.reports?.find((report) => report.state === 'final');
  if (!finalReport) throw new Error(`Scan ${scan.id} completed without a final report.`);
  const content = (await request(`/v1/reports/${encodeURIComponent(finalReport.id)}`)).report?.snapshot?.content;
  if (content?.formatVersion !== 'report_v2') throw new Error('Final report contract is invalid.');
  const summary = {
    scanId: scan.id,
    reportId: finalReport.id,
    targetHost: host,
    reportType: content.reportType,
    findings: content.findings ?? [],
    coverage: content.coverage ?? {},
  };
  if (options.json) process.stdout.write(`${JSON.stringify(summary)}\n`);
  else {
    process.stdout.write(`Report ${summary.reportId}: ${summary.findings.length} validated finding(s).\n`);
    for (const finding of summary.findings) process.stdout.write(`  ${finding.severity}: ${finding.title}\n`);
    for (const gap of summary.coverage.coverageGaps ?? []) process.stdout.write(`  Coverage gap: ${gap}\n`);
    process.stdout.write(`Open the dashboard: ${dashboardUrl(options)}/reports/${summary.reportId}\n`);
  }
}

function formatRouteHop(useCase, slot, route) {
  const who = route?.transport === 'api_key' ? route.provider : route?.cli;
  const level = route?.reasoningLevel ? `/${route.reasoningLevel}` : '';
  const state = route?.accepted ? 'accepted' : `not accepted (${route?.reason ?? 'unavailable'})`;
  return `${useCase} ${slot} ${who ?? 'unset'}/${route?.model ?? 'unset'}${level} ${state}`;
}

async function llmRoutes(options) {
  const api = validateApi(options.api);
  async function request(path, method = 'GET', body) {
    const response = await fetch(`${api}${path}`, {
      method,
      redirect: 'manual',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status >= 300 && response.status < 400) throw new Error(`${path}: unexpected redirect.`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status} (${data?.error?.message ?? data?.error?.code ?? 'REQUEST_FAILED'}).`);
    return data;
  }
  const [action, useCase, slot, cli, model, level] = options.llmArgs ?? [];
  if (!action) {
    const settings = await request('/v1/llm-routes');
    if (options.json) process.stdout.write(`${JSON.stringify(settings)}\n`);
    else {
      process.stdout.write('System-wide reasoning routes. A running scan keeps the copy taken when it was created.\n');
      process.stdout.write('Coding CLI completion is not enabled. Probes stay on the OpenHunter tool broker.\n');
      for (const row of settings.preview ?? []) {
        process.stdout.write(`${formatRouteHop(row.useCase, 'primary', row.primary)}; ${formatRouteHop(row.useCase, 'fallback', row.fallback)}\n`);
      }
    }
    return;
  }
  if (action === 'probe') {
    const settings = await request('/v1/llm-routes/probe', 'POST', {});
    if (options.json) process.stdout.write(`${JSON.stringify(settings.probes ?? settings)}\n`);
    else {
      for (const probe of Object.values(settings.probes ?? {})) {
        process.stdout.write(`${probe.cli}: installed=${probe.installed} authenticated=${probe.authenticated} ${probe.errorCode ?? 'ok'}\n`);
      }
    }
    return;
  }
  if (action !== 'set' || !useCase || !slot || !cli || !model || !level) {
    throw new Error('Usage: openhunterai llm-routes set USE_CASE primary|fallback CLI MODEL LEVEL');
  }
  const route = cli === 'openai' || cli === 'deepseek'
    ? { transport: 'api_key', provider: cli, model }
    : { transport: 'coding_cli', cli, model, reasoningLevel: level };
  const settings = await request('/v1/llm-routes', 'PUT', { update: { useCase, slot, route } });
  const row = (settings.preview ?? []).find((item) => item.useCase === useCase);
  if (options.json) process.stdout.write(`${JSON.stringify(row ?? settings)}\n`);
  else if (row) process.stdout.write(`${formatRouteHop(row.useCase, 'primary', row.primary)}; ${formatRouteHop(row.useCase, 'fallback', row.fallback)}\n`);
}

function isDirectInvocation() {
  if (!process.argv[1]) return false;
  try {
    // npm install -g from a checkout links the entrypoint; Node resolves the
    // module to its real path while argv still contains the symlink path.
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (isDirectInvocation()) {
  run(parseArgs(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`OpenHunterAI: ${error.message}\n`);
    process.exitCode = 1;
  });
}
