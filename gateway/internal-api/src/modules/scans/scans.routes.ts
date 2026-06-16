import { Router } from 'express';
import { workerAuth } from '../../middlewares/worker-auth.middleware.js';
import { CallbacksService, type WorkerStepResult, type WorkerSignal } from './callbacks.service.js';
import { ScanStateService } from './scan-state.service.js';
import { ApprovalService, type CreateApprovalInput } from './approval.service.js';
import { BrowserSessionStateService } from './browser-session-state.service.js';

export const scanRoutes = Router();
const service = new CallbacksService();
const stateService = new ScanStateService();
const approvalService = new ApprovalService();
const browserSessionStateService = new BrowserSessionStateService();

// All worker callbacks require the shared worker token.
scanRoutes.use(workerAuth);

scanRoutes.post('/:id/steps', async (req, res) => {
  const scanId = req.params.id!;
  const scan = await service.findScan(scanId);
  if (!scan) {
    res.status(404).json({ error: { code: 'SCAN_NOT_FOUND' } });
    return;
  }
  try {
    const step = await service.recordStep(scanId, req.body as WorkerStepResult);
    res.status(202).json({ accepted: true, stepId: step.id });
  } catch (err) {
    res.status(400).json({ error: { code: 'STEP_PERSIST_FAILED', message: (err as Error).message } });
  }
});

scanRoutes.post('/:id/findings', async (req, res) => {
  const scanId = req.params.id!;
  const scan = await service.findScan(scanId);
  if (!scan) {
    res.status(404).json({ error: { code: 'SCAN_NOT_FOUND' } });
    return;
  }
  const signals = (req.body?.signals ?? []) as WorkerSignal[];
  const workerType = (req.body?.workerType as string) ?? 'unknown';
  try {
    const result = await service.recordFindings(scanId, workerType, signals);
    res.status(202).json({ accepted: true, count: result.count });
  } catch (err) {
    res.status(400).json({ error: { code: 'FINDINGS_PERSIST_FAILED', message: (err as Error).message } });
  }
});

scanRoutes.post('/:id/activity', async (req, res) => {
  const scanId = req.params.id!;
  const scan = await service.findScan(scanId);
  if (!scan) {
    res.status(404).json({ error: { code: 'SCAN_NOT_FOUND' } });
    return;
  }
  try {
    const result = await service.recordActivityEvent(scanId, req.body);
    res.status(202).json(result);
  } catch (err) {
    res.status(400).json({ error: { code: 'ACTIVITY_PERSIST_FAILED', message: (err as Error).message } });
  }
});

// Orchestrator-driven scan state transitions (queued -> running -> completed,
// etc). Validated so a late/duplicate callback cannot revive a terminal scan.
scanRoutes.post('/:id/state', async (req, res) => {
  const scanId = req.params.id!;
  const to = req.body?.state as string | undefined;
  if (!to) {
    res.status(400).json({ error: { code: 'STATE_REQUIRED' } });
    return;
  }
  const result = await stateService.transition(scanId, to as never, req.body?.errorMessage);
  if (!result.ok && result.reason === 'SCAN_NOT_FOUND') {
    res.status(404).json({ error: { code: 'SCAN_NOT_FOUND' } });
    return;
  }
  if (!result.ok) {
    res.status(409).json({ error: { code: result.reason }, state: result.state });
    return;
  }
  res.json({ ok: true, state: result.state });
});

// Worker creates an approval request for a sensitive action and then polls its
// status. The worker must not perform the action until status is 'approved'.
scanRoutes.post('/:id/approvals', async (req, res) => {
  const scanId = req.params.id!;
  const scan = await service.findScan(scanId);
  if (!scan) {
    res.status(404).json({ error: { code: 'SCAN_NOT_FOUND' } });
    return;
  }
  const body = req.body as CreateApprovalInput;
  if (!body?.action || !body?.target) {
    res.status(400).json({ error: { code: 'ACTION_AND_TARGET_REQUIRED' } });
    return;
  }
  const request = await approvalService.create(scanId, body);
  res.status(201).json({ approvalId: request.id, state: request.state, expiresAt: request.expiresAt });
});

scanRoutes.get('/:id/approvals/:approvalId', async (req, res) => {
  const { state, expired } = await approvalService.status(req.params.approvalId!);
  if (state === null) {
    res.status(404).json({ error: { code: 'APPROVAL_NOT_FOUND' } });
    return;
  }
  res.json({ state, expired });
});

scanRoutes.get('/:id/browser-session-state', async (req, res) => {
  const state = await browserSessionStateService.getForScan(req.params.id!);
  if (!state) {
    res.status(404).json({ error: { code: 'AUTH_SESSION_REQUIRED' } });
    return;
  }
  res.json(state);
});
