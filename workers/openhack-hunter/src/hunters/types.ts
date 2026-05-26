import type { FindingCandidate } from '@x-hunter/shared';
import type { OpenHackInput } from '../index.js';

export interface HunterOutput {
  candidates: FindingCandidate[];
  warnings: string[];
  hardening: string[];
  coverageGaps: string[];
}

export type Hunter = (input: OpenHackInput) => HunterOutput;
