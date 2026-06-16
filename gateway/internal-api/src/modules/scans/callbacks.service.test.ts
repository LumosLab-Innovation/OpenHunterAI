import { describe, expect, it } from 'vitest';
import { activityForWorkerResult, retestUpdateFromWorkerResult } from './callbacks.service.js';

describe('retestUpdateFromWorkerResult', () => {
  it('maps sanitized retest worker metadata into a RetestRun update', () => {
    expect(
      retestUpdateFromWorkerResult({
        scanId: 'scan_1',
        workerType: 'retest',
        state: 'done',
        meta: { retestRunId: 'retest_1', result: 'fixed' },
        summary: 'Retest no longer reproduces.',
        startedAt: '2026-06-15T10:00:00.000Z',
        finishedAt: '2026-06-15T10:01:00.000Z',
      }),
    ).toEqual({
      retestRunId: 'retest_1',
      data: {
        result: 'fixed',
        notes: 'Retest no longer reproduces.',
        startedAt: new Date('2026-06-15T10:00:00.000Z'),
        finishedAt: new Date('2026-06-15T10:01:00.000Z'),
        errorCode: null,
      },
    });
  });

  it('records cannot_verify for failed retest worker results', () => {
    expect(
      retestUpdateFromWorkerResult({
        scanId: 'scan_1',
        workerType: 'retest',
        state: 'failed',
        errorCode: 'SCOPE_REJECTED',
        errorMsg: 'blocked',
        meta: { retestRunId: 'retest_1' },
      })?.data,
    ).toMatchObject({
      result: 'cannot_verify',
      notes: 'blocked',
      errorCode: 'SCOPE_REJECTED',
    });
  });
});

describe('activityForWorkerResult', () => {
  it('emits a dedicated auth-session-required activity', () => {
    expect(activityForWorkerResult('browser_inspector', 'skipped', { errorCode: 'AUTH_SESSION_REQUIRED' })).toEqual({
      eventType: 'auth_session_required',
      titleKey: 'activity.auth_session_required.title',
      bodyKey: 'activity.auth_session_required.body',
      severity: 'medium',
    });
  });
});
