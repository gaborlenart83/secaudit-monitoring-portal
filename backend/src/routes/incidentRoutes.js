'use strict';

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.patch('/:id/resolve', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid incident id' });
    }

    const incident = await prisma.incidentLog.findUnique({
      where: { id },
      include: { site: true },
    });

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    if (incident.site.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updatedIncident = await prisma.incidentLog.update({
      where: { id },
      data: { isResolved: true },
    });

    return res.json(updatedIncident);
  } catch (error) {
    console.error('Failed to resolve incident:', error);
    return res.status(500).json({ error: 'Failed to resolve incident' });
  }
});

module.exports = router;
