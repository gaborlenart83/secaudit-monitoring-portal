'use strict';

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/authMiddleware');
const { validateUrl } = require('../utils/urlValidator');
const { calculateSecurityScore } = require('../utils/securityScorer');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const where = req.user.role === 'ADMIN' ? undefined : { userId: req.user.id };
    const sites = await prisma.monitoredSite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        scans: {
          orderBy: { scannedAt: 'desc' },
          take: 1,
        },
      },
    });

    return res.json({
      sites: sites.map(({ scans, ...site }) => ({
        ...site,
        latestScan: scans[0] ?? null,
      })),
    });
  } catch (error) {
    console.error('Failed to list sites:', error);
    return res.status(500).json({ error: 'Failed to list sites' });
  }
});

router.post('/', async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const url = typeof req.body.url === 'string' ? req.body.url.trim() : '';

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const urlResult = validateUrl(url);
    if (!urlResult.valid) {
      return res.status(400).json({ error: urlResult.reason });
    }

    const site = await prisma.monitoredSite.create({
      data: {
        name,
        url,
        userId: req.user.id,
      },
    });

    return res.status(201).json({ site });
  } catch (error) {
    console.error('Failed to create site:', error);
    return res.status(500).json({ error: 'Failed to create site' });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid site id' });
    }

    const site = await prisma.monitoredSite.findUnique({
      where: { id },
      include: {
        scans: {
          orderBy: { scannedAt: 'desc' },
        },
        incidents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    if (site.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { scans, incidents, ...siteData } = site;
    return res.json({
      site: siteData,
      scans,
      incidents,
    });
  } catch (error) {
    console.error('Failed to get site history:', error);
    return res.status(500).json({ error: 'Failed to get site history' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid site id' });
    }

    const site = await prisma.monitoredSite.findUnique({ where: { id } });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    if (site.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.$transaction([
      prisma.securityScan.deleteMany({ where: { siteId: id } }),
      prisma.incidentLog.deleteMany({ where: { siteId: id } }),
      prisma.monitoredSite.delete({ where: { id } }),
    ]);

    return res.json({ message: 'Site deleted' });
  } catch (error) {
    console.error('Failed to delete site:', error);
    return res.status(500).json({ error: 'Failed to delete site' });
  }
});

router.post('/:id/scan', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid site id' });
    }

    const site = await prisma.monitoredSite.findUnique({ where: { id } });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    if (site.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const urlResult = validateUrl(site.url);
    if (!urlResult.valid) {
      return res.status(400).json({ error: urlResult.reason });
    }

    let statusCode = 0;
    let responseTimeMs = 0;
    let networkError = false;
    let hasHttps = false;
    let hasHsts = false;
    let hasCsp = false;
    let hasXFrame = false;
    let networkErrorMessage = '';

    const startedAt = Date.now();
    try {
      const response = await fetch(site.url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });

      responseTimeMs = Date.now() - startedAt;
      statusCode = response.status;

      const responseUrl = response.url ? new URL(response.url) : new URL(site.url);
      hasHttps = responseUrl.protocol === 'https:';
      hasHsts = Boolean(response.headers.get('strict-transport-security'));
      hasCsp = Boolean(response.headers.get('content-security-policy'));
      hasXFrame = Boolean(response.headers.get('x-frame-options'));
    } catch (error) {
      responseTimeMs = Date.now() - startedAt;
      networkError = true;
      statusCode = 0;
      networkErrorMessage =
        error && error.name === 'TimeoutError'
          ? 'A céloldal válasza túllépte az 5 másodperces időkorlátot'
          : 'A céloldal nem volt elérhető';
      hasHttps = new URL(site.url).protocol === 'https:';
    }

    const scoreResult = calculateSecurityScore({
      statusCode,
      responseTimeMs,
      hasHttps,
      hasHsts,
      hasCsp,
      hasXFrame,
    });

    const shouldCreateIncident =
      networkError || scoreResult.grade === 'F' || statusCode >= 400;

    let scan;
    let incident = null;

    if (shouldCreateIncident) {
      const incidentMessage = networkError
        ? networkErrorMessage
        : statusCode >= 500
          ? `A céloldal ${statusCode} hibakóddal válaszolt`
          : `A céloldal ${statusCode} státuszkóddal válaszolt; biztonsági osztályzat: ${scoreResult.grade}`;

      const result = await prisma.$transaction(async (tx) => {
        const createdScan = await tx.securityScan.create({
          data: {
            siteId: id,
            statusCode,
            responseTimeMs,
            hasHttps,
            hasHsts,
            hasCsp,
            hasXFrame,
            score: scoreResult.score,
            grade: scoreResult.grade,
          },
        });
        const createdIncident = await tx.incidentLog.create({
          data: {
            siteId: id,
            severity: networkError || statusCode >= 500 ? 'CRITICAL' : 'WARNING',
            message: incidentMessage.slice(0, 1000),
          },
        });
        return { scan: createdScan, incident: createdIncident };
      });
      scan = result.scan;
      incident = result.incident;
    } else {
      scan = await prisma.securityScan.create({
        data: {
          siteId: id,
          statusCode,
          responseTimeMs,
          hasHttps,
          hasHsts,
          hasCsp,
          hasXFrame,
          score: scoreResult.score,
          grade: scoreResult.grade,
        },
      });
    }

    return res.status(201).json({
      scan,
      ...(incident ? { incident } : {}),
    });
  } catch (error) {
    console.error('Failed to scan site:', error);
    return res.status(500).json({ error: 'Failed to scan site' });
  }
});

module.exports = router;
