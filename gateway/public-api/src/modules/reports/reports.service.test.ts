import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReportsService } from './reports.service.js';

const prisma = vi.hoisted(() => ({
  report: { findMany: vi.fn(), findFirst: vi.fn() },
}));
vi.mock('@x-hunter/db', () => ({ getPrisma: () => prisma }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('historical report access', () => {
  it('lets the loopback-only local operator read archived reports from old organizations', async () => {
    vi.stubEnv('OPENHUNTER_LOCAL_MODE', '1');
    prisma.report.findMany.mockResolvedValue([]);
    prisma.report.findFirst.mockResolvedValue(null);
    const service = new ReportsService();

    await service.list('local_org');
    await service.get('legacy_report', 'local_org');

    expect(prisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { state: 'final' } }));
    expect(prisma.report.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'legacy_report' } }));
  });

  it('keeps organization isolation outside local mode', async () => {
    vi.stubEnv('OPENHUNTER_LOCAL_MODE', '0');
    prisma.report.findMany.mockResolvedValue([]);
    prisma.report.findFirst.mockResolvedValue(null);
    const service = new ReportsService();

    await service.list('org_1');
    await service.get('report_1', 'org_1');

    expect(prisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { state: 'final', project: { organizationId: 'org_1' } },
    }));
    expect(prisma.report.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'report_1', project: { organizationId: 'org_1' } },
    }));
  });
});
