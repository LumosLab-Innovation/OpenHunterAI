/**
 * Dev seed. Run with: pnpm db:seed
 * Creates a demo organization, user, and project for local development.
 *
 * Never run in production. The default user password is meant for local use.
 */

import * as pkg from '../generated/client/index.js';
const PrismaClient = (pkg as any).PrismaClient;
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 32);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { name: 'Demo Org', slug: 'demo' },
  });

  const user = await prisma.user.upsert({
    where: { email: 'demo@xhunter.local' },
    update: { passwordHash: hashPassword('demo-pass-rotate-me') },
    create: {
      email: 'demo@xhunter.local',
      organizationId: org.id,
      passwordHash: hashPassword('demo-pass-rotate-me'),
      displayName: 'Demo User',
      role: 'owner',
    },
  });

  const project = await prisma.project.upsert({
    where: { id: 'demo-project-1' },
    update: {},
    create: {
      id: 'demo-project-1',
      organizationId: org.id,
      name: 'Demo Project',
      packageTier: 'free_hunter',
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded: org=${org.id} user=${user.email} project=${project.id}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    return prisma.$disconnect().then(() => {
      process.exit(1);
    });
  });
