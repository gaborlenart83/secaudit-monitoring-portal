'use strict';

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken, requireAdmin);

router.get('/overview', async (_req, res) => {
  try {
    const [
      userCount,
      siteCount,
      scanCount,
      activeIncidentCount,
      averageResult,
      sites,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.monitoredSite.count(),
      prisma.securityScan.count(),
      prisma.incidentLog.count({ where: { isResolved: false } }),
      prisma.securityScan.aggregate({ _avg: { score: true } }),
      prisma.monitoredSite.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { email: true, name: true },
          },
          scans: {
            orderBy: { scannedAt: 'desc' },
            take: 1,
          },
          incidents: {
            where: { isResolved: false },
            select: { id: true },
          },
        },
      }),
    ]);

    return res.json({
      stats: {
        userCount,
        siteCount,
        scanCount,
        activeIncidentCount,
        averageScore: averageResult._avg.score == null
          ? null
          : Math.round(averageResult._avg.score * 100) / 100,
      },
      sites: sites.map(({ scans, incidents, ...site }) => ({
        ...site,
        latestScan: scans[0] ?? null,
        activeIncidentCount: incidents.length,
      })),
    });
  } catch (error) {
    console.error('Failed to get admin overview:', error);
    return res.status(500).json({ error: 'Failed to get admin overview' });
  }
});

router.delete('/sites/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid site id' });
    }

    const site = await prisma.monitoredSite.findUnique({ where: { id } });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    await prisma.$transaction([
      prisma.securityScan.deleteMany({ where: { siteId: id } }),
      prisma.incidentLog.deleteMany({ where: { siteId: id } }),
      prisma.monitoredSite.delete({ where: { id } }),
    ]);

    return res.json({ message: 'Site deleted' });
  } catch (error) {
    console.error('Failed to delete site by admin:', error);
    return res.status(500).json({ error: 'Failed to delete site' });
  }
});

module.exports = router;
