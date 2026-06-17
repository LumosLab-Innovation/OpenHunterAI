import { describe, expect, it } from 'vitest';
import { readScanRuntimeConfig } from './scan-runtime.service.js';

describe('scan runtime config', () => {
  it('keeps VM wake disabled unless explicitly enabled', () => {
    const config = readScanRuntimeConfig({});

    expect(config.enabled).toBe(false);
    expect(config.healthUrl).toBeNull();
  });

  it('requires complete Compute Engine coordinates when wake is enabled', () => {
    expect(() =>
      readScanRuntimeConfig({
        SCAN_RUNTIME_WAKE_ENABLED: 'true',
        SCAN_RUNTIME_HEALTH_URL: 'http://10.148.0.3:4300/health',
        SCAN_RUNTIME_GCP_PROJECT: 'project-a',
        SCAN_RUNTIME_GCP_ZONE: 'asia-southeast1-b',
      }),
    ).toThrow(/SCAN_RUNTIME_GCP_INSTANCE/);
  });

  it('parses a bounded wake and poll policy', () => {
    const config = readScanRuntimeConfig({
      SCAN_RUNTIME_WAKE_ENABLED: 'true',
      SCAN_RUNTIME_HEALTH_URL: 'http://10.148.0.3:4300/health',
      SCAN_RUNTIME_GCP_PROJECT: 'project-a',
      SCAN_RUNTIME_GCP_ZONE: 'asia-southeast1-b',
      SCAN_RUNTIME_GCP_INSTANCE: 'openhunter-staging',
      SCAN_RUNTIME_WAKE_TIMEOUT_MS: '120000',
      SCAN_RUNTIME_POLL_INTERVAL_MS: '2500',
    });

    expect(config).toEqual({
      enabled: true,
      healthUrl: 'http://10.148.0.3:4300/health',
      project: 'project-a',
      zone: 'asia-southeast1-b',
      instance: 'openhunter-staging',
      wakeTimeoutMs: 120000,
      pollIntervalMs: 2500,
      requestTimeoutMs: 2500,
    });
  });
});
