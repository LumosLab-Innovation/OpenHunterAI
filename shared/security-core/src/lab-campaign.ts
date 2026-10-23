/**
 * Lab campaign contract. Separate from a public website scan.
 *
 * Declaring subnet, approval, isolation, or rollback does not enable pivot,
 * persistence, or destructive actions. Deep/aggressive_staging does not inherit
 * this contract. The executor is intentionally absent.
 */

export type LabAction = 'pivot' | 'persistence' | 'destructive';

export interface LabCampaignDeclaration {
  kind: 'lab_campaign';
  subnet: string;
  webEntry: string;
  windowStart: string;
  windowEnd: string;
  testAccounts: string[];
  budget: { maxRequests: number; maxMinutes: number };
  approvalId?: string;
  snapshotId?: string;
  rollbackStep?: string;
  oneTimeLab: boolean;
  isolationChecked: boolean;
  restoreVerified: boolean;
}

export interface LabAuthorization {
  allowed: false;
  code:
    | 'PUBLIC_SCAN_CANNOT_PIVOT'
    | 'LAB_DECLARATION_INCOMPLETE'
    | 'LAB_EXECUTOR_NOT_ENABLED';
  message: string;
}

export function authorizeLabAction(
  action: LabAction,
  campaign: { kind?: string } | LabCampaignDeclaration,
): LabAuthorization {
  if (campaign.kind !== 'lab_campaign') {
    return {
      allowed: false,
      code: 'PUBLIC_SCAN_CANNOT_PIVOT',
      message: 'A public website scan cannot pivot, persist, or run a destructive action.',
    };
  }
  const lab = campaign as LabCampaignDeclaration;
  const complete = Boolean(
    lab.subnet
    && lab.webEntry
    && lab.windowStart
    && lab.windowEnd
    && lab.testAccounts.length > 0
    && lab.budget.maxRequests > 0
    && lab.budget.maxMinutes > 0
    && lab.approvalId
    && lab.snapshotId
    && lab.rollbackStep
    && lab.oneTimeLab
    && lab.isolationChecked
    && lab.restoreVerified,
  );
  if (!complete) {
    return {
      allowed: false,
      code: 'LAB_DECLARATION_INCOMPLETE',
      message: `${action} needs a one-time lab declaration with subnet, window, accounts, budget, approval, snapshot, rollback, isolation, and restore.`,
    };
  }
  return {
    allowed: false,
    code: 'LAB_EXECUTOR_NOT_ENABLED',
    message: `${action} stays denied. No lab executor is enabled, including for Deep scans.`,
  };
}
