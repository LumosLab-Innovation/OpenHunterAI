import { createBridgeClient, type CodingCliBridge } from '@x-hunter/llm-gateway';
import { isLlmRouteSnapshot, type LlmCallAudit, type LlmRouteSnapshot } from '@x-hunter/shared';

export function bridgeFromEnv(): CodingCliBridge | null {
  const baseUrl = process.env.OPENHUNTER_LLM_BRIDGE_URL;
  const token = process.env.OPENHUNTER_LLM_BRIDGE_TOKEN;
  if (!baseUrl || !token) return null;
  return createBridgeClient({ baseUrl, token });
}

export function snapshotFromPlan(plan: unknown): LlmRouteSnapshot | null {
  const snapshot = plan && typeof plan === 'object' ? (plan as { llmRouteSnapshot?: unknown }).llmRouteSnapshot : null;
  return isLlmRouteSnapshot(snapshot) ? snapshot : null;
}

export async function storeLlmAudits(prisma: any, scanId: string, audits: LlmCallAudit[], coverageGaps: string[]): Promise<void> {
  if (audits.length === 0 && coverageGaps.length === 0) return;
  const scan = await prisma.scanJob.findUnique({ where: { id: scanId }, select: { budgetUsed: true } });
  const current = scan?.budgetUsed && typeof scan.budgetUsed === 'object' && !Array.isArray(scan.budgetUsed) ? scan.budgetUsed : {};
  const previous = Array.isArray(current.llmAudits) ? current.llmAudits : [];
  const previousGaps = Array.isArray(current.llmCoverageGaps) ? current.llmCoverageGaps : [];
  await prisma.scanJob.update({
    where: { id: scanId },
    data: {
      budgetUsed: {
        ...current,
        llmAudits: [...previous, ...audits],
        llmCoverageGaps: [...previousGaps, ...coverageGaps],
      },
    },
  });
  await prisma.scanActivityEvent.create({
    data: {
      scanJobId: scanId,
      eventType: 'llm_route_call',
      actor: 'findings',
      titleKey: 'activity.llm_route.title',
      bodyKey: 'activity.llm_route.body',
      bodyParams: { audits, coverageGaps },
      status: coverageGaps.length > 0 ? 'gap' : 'ok',
      sanitized: true,
    },
  }).catch(() => undefined);
}
