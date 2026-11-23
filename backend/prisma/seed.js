'use strict';

const bcrypt = require('bcrypt');
const { PrismaClient, Role, Grade, Severity } = require('@prisma/client');

const prisma = new PrismaClient();

async function ensureUser(email, password, name, role) {
  const hashedPassword = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: { password: hashedPassword, name, role },
    create: { email, password: hashedPassword, name, role },
  });
}

async function ensureDemoSite(ownerId, data, scanTemplates, incidents) {
  let site = await prisma.monitoredSite.findFirst({
    where: { userId: ownerId, name: data.name, url: data.url },
  });

  if (site) {
    await prisma.securityScan.deleteMany({ where: { siteId: site.id } });
    await prisma.incidentLog.deleteMany({ where: { siteId: site.id } });
  } else {
    site = await prisma.monitoredSite.create({
      data: { ...data, userId: ownerId },
    });
  }

  for (let index = 0; index < scanTemplates.length; index += 1) {
    const template = scanTemplates[index];
    await prisma.securityScan.create({
      data: {
        siteId: site.id,
        statusCode: template.statusCode,
        responseTimeMs: template.responseTimeMs,
        hasHttps: template.hasHttps,
        hasHsts: template.hasHsts,
        hasCsp: template.hasCsp,
        hasXFrame: template.hasXFrame,
        score: template.score,
        grade: template.grade,
        scannedAt: new Date(Date.now() - index * 24 * 60 * 60 * 1000),
      },
    });
  }

  for (const incident of incidents) {
    await prisma.incidentLog.create({
      data: {
        siteId: site.id,
        severity: incident.severity,
        message: incident.message,
        isResolved: incident.isResolved,
      },
    });
  }

  return site;
}

async function main() {
  const admin = await ensureUser(
    'admin@secaudit.hu',
    'Admin123!',
    'SecAudit Admin',
    Role.ADMIN,
  );
  const user = await ensureUser(
    'user@secaudit.hu',
    'User123!',
    'SecAudit User',
    Role.USER,
  );

  const history = [
    [
      { statusCode: 200, responseTimeMs: 420, hasHttps: true, hasHsts: true, hasCsp: true, hasXFrame: true, score: 100, grade: Grade.A },
      { statusCode: 200, responseTimeMs: 560, hasHttps: true, hasHsts: true, hasCsp: true, hasXFrame: true, score: 95, grade: Grade.A },
    ],
    [
      { statusCode: 200, responseTimeMs: 680, hasHttps: true, hasHsts: true, hasCsp: false, hasXFrame: true, score: 80, grade: Grade.B },
      { statusCode: 200, responseTimeMs: 720, hasHttps: true, hasHsts: false, hasCsp: false, hasXFrame: true, score: 65, grade: Grade.C },
    ],
    [
      { statusCode: 200, responseTimeMs: 1200, hasHttps: true, hasHsts: false, hasCsp: false, hasXFrame: false, score: 55, grade: Grade.D },
      { statusCode: 503, responseTimeMs: 1300, hasHttps: false, hasHsts: false, hasCsp: false, hasXFrame: false, score: 0, grade: Grade.F },
    ],
    [
      { statusCode: 200, responseTimeMs: 480, hasHttps: true, hasHsts: true, hasCsp: true, hasXFrame: false, score: 85, grade: Grade.B },
      { statusCode: 500, responseTimeMs: 1800, hasHttps: false, hasHsts: false, hasCsp: false, hasXFrame: false, score: 0, grade: Grade.F },
    ],
  ];

  await ensureDemoSite(
    admin.id,
    { name: 'Secured Example', url: 'https://example.com' },
    history[0],
    [],
  );
  await ensureDemoSite(
    user.id,
    { name: 'GitHub Monitor', url: 'https://github.com' },
    history[1],
    [{ severity: Severity.WARNING, message: 'CSP vagy HSTS fejlec hianya mertett.', isResolved: true }],
  );
  await ensureDemoSite(
    user.id,
    { name: 'HTTP Demo', url: 'http://example.com' },
    history[2],
    [{ severity: Severity.CRITICAL, message: 'A szerver nem volt elerheto; HTTP 503.', isResolved: false }],
  );
  await ensureDemoSite(
    admin.id,
    { name: 'Slow Public Site', url: 'https://httpbin.org' },
    history[3],
    [
      { severity: Severity.CRITICAL, message: 'HTTP 500 hibavalasz mertett.', isResolved: false },
      { severity: Severity.WARNING, message: 'Rovid valaszido kovetkezett be.', isResolved: true },
    ],
  );

  console.log('SecAudit seed data is ready.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
