import { publishEvent } from '@openhunter/event-core';

export const Events = {
  ScanCreated: 'scan.created',
  ScanStepStarted: 'scan.step.started',
  ScanStepCompleted: 'scan.step.completed',
  ScanStepFailed: 'scan.step.failed',
  FindingCreated: 'finding.created',
  ReportRequested: 'report.requested',
  ReportGenerated: 'report.generated',
  RetestRequested: 'retest.requested',
  RetestCompleted: 'retest.completed',
} as const;

export type EventSubject = (typeof Events)[keyof typeof Events];

export function enqueue<T>(subject: EventSubject, payload: T): Promise<void> {
  return publishEvent(subject, payload);
}
