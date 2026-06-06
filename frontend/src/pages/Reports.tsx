import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE, apiFetch } from '../lib/api';

interface ReportEnvelope {
  snapshot: {
    id: string;
    version: number;
    state: string;
    content: ReportContent;
    generatedAt: string;
    finalizedAt?: string | null;
  };
  latestOverlay: {
    findingStatuses: Array<{ id: string; status: string; severity: string }>;
    retestStates: Array<{ findingId: string; retestRunId: string; result?: string | null }>;
    monitor: { maxMonitoredFindings: number; maxRetests: number; cooldownDays: number };
  };
  exports: { formats: string[]; generatedOnDemand: boolean };
}

interface ReportContent {
  reportType?: string;
  ownerSummary?: {
    headline?: string;
    riskLevel?: string;
    whatWasTested?: string;
    topRiskOrOutcome?: string;
    businessImpact?: string;
    recommendedNextAction?: string;
  };
  findings?: Array<{
    id: string;
    rank: number;
    title: string;
    severity: string;
    confidence: string;
    affectedAsset: string;
    impact: string;
    fixSummary: string;
    sanitizedProof?: { description?: string };
  }>;
  developerFixPack?: Array<{
    findingId: string;
    rootCauseHypothesis: string;
    concreteFixPrompt: string;
    validationSteps: string[];
    regressionTestIdeas: string[];
    acceptanceCriteria: string;
  }>;
  coverage?: {
    workersRun?: string[];
    huntersRun?: string[];
    coverageGaps?: string[];
    limitations?: string[];
  };
  hardeningRecommendations?: string[];
  retestAndMonitor?: {
    eligibleFindings?: string[];
    remainingRetestQuota?: number;
    cooldownDays?: number;
    manualRetestActions?: string[];
  };
}

export function ReportDetailPage() {
  const { id = '' } = useParams();
  const [report, setReport] = useState<ReportEnvelope | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<{ report: ReportEnvelope }>(`/v1/reports/${id}`).then((res) => {
      if (res.ok) setReport(res.data.report);
      else setError(res.error.message ?? `HTTP ${res.status}`);
    });
  }, [id]);

  const content = report?.snapshot.content ?? {};
  const exportBase = `${API_BASE}/v1/reports/${id}/export`;

  return (
    <section className="panel">
      <div className="report-header">
        <div>
          <h1>{content.ownerSummary?.headline ?? `Report ${id.slice(0, 8)}`}</h1>
          <p className="badge">{report?.snapshot.state ?? 'loading'}</p>
        </div>
        <div className="actions">
          <a className="button" href={`${exportBase}?format=html&view=latest`}>
            Export HTML
          </a>
          <a className="button" href={`${exportBase}?format=pdf&view=latest`}>
            Export PDF
          </a>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <section className="report-grid">
        <article>
          <h2>Owner Summary</h2>
          <p>{content.ownerSummary?.topRiskOrOutcome}</p>
          <p className="muted">{content.ownerSummary?.businessImpact}</p>
          <strong>{content.ownerSummary?.recommendedNextAction}</strong>
        </article>
        <article>
          <h2>Retest / Monitor</h2>
          <p>Retests: {content.retestAndMonitor?.remainingRetestQuota ?? report?.latestOverlay.monitor.maxRetests ?? 0}</p>
          <p>Cooldown: {content.retestAndMonitor?.cooldownDays ?? report?.latestOverlay.monitor.cooldownDays ?? 0} days</p>
        </article>
      </section>
      <h2>Findings</h2>
      {(content.findings ?? []).length === 0 ? (
        <p className="muted">No valuable finding was confirmed within the scan budget.</p>
      ) : (
        <div className="report-list">
          {(content.findings ?? []).map((finding) => (
            <article key={finding.id} className="report-item">
              <h3>
                {finding.rank}. {finding.title}
              </h3>
              <p className="badge">
                {finding.severity} / {finding.confidence}
              </p>
              <p>{finding.impact}</p>
              <p className="muted">{finding.sanitizedProof?.description}</p>
              <strong>Fix:</strong> {finding.fixSummary}
            </article>
          ))}
        </div>
      )}
      <h2>Developer Fix Pack</h2>
      <div className="report-list">
        {(content.developerFixPack ?? []).map((fix) => (
          <article key={fix.findingId} className="report-item">
            <h3>{fix.findingId.slice(0, 8)}</h3>
            <p>{fix.concreteFixPrompt}</p>
            <p className="muted">{fix.acceptanceCriteria}</p>
          </article>
        ))}
      </div>
      <h2>Coverage</h2>
      <p>Workers: {(content.coverage?.workersRun ?? []).join(', ') || 'none'}</p>
      <p>Hunters: {(content.coverage?.huntersRun ?? []).join(', ') || 'none'}</p>
      <p className="muted">{(content.coverage?.limitations ?? []).join('; ')}</p>
    </section>
  );
}
