'use strict';

/**
 * Biztonsági pontozó motor (rendszerterv 4. fejezet).
 * Tiszta függvény: nincs I/O, nincs adatbázis-függőség, nincs mellékhatás.
 */

const BASE_SCORE = 100;
const SLOW_RESPONSE_THRESHOLD_MS = 1000;

// Levonások súlyozása a rendszerterv szerint.
const PENALTIES = Object.freeze({
  NO_HTTPS: 40,
  NO_CSP: 20,
  NO_HSTS: 15,
  NO_XFRAME: 15,
  SLOW_RESPONSE: 10,
});

// A Prisma `Grade` enum értékei (A, B, C, D, F – E nincs).
const GRADES = Object.freeze({ A: 'A', B: 'B', C: 'C', D: 'D', F: 'F' });

/**
 * Pontszámból osztályzat.
 * 90–100: A | 75–89: B | 60–74: C | 40–59: D | 0–39: F
 * @param {number} score
 * @returns {'A'|'B'|'C'|'D'|'F'}
 */
function calculateGrade(score) {
  if (score >= 90) return GRADES.A;
  if (score >= 75) return GRADES.B;
  if (score >= 60) return GRADES.C;
  if (score >= 40) return GRADES.D;
  return GRADES.F;
}

/**
 * @param {object} scanInput
 * @param {number}  scanInput.statusCode
 * @param {number}  [scanInput.responseTimeMs]
 * @param {boolean} [scanInput.hasHttps]
 * @param {boolean} [scanInput.hasHsts]
 * @param {boolean} [scanInput.hasCsp]
 * @param {boolean} [scanInput.hasXFrame]
 * @returns {{ score: number, grade: 'A'|'B'|'C'|'D'|'F',
 *             deductions: Array<{ reason: string, points: number }> }}
 */
function calculateSecurityScore(scanInput) {
  if (scanInput === null || typeof scanInput !== 'object') {
    throw new TypeError('scanInput must be an object');
  }

  const { statusCode, responseTimeMs, hasHttps, hasHsts, hasCsp, hasXFrame } = scanInput;

  // Nem elérhető oldal: statusCode === 0 vagy >= 500 (illetve érvénytelen/hiányzó kód).
  const unreachable =
    typeof statusCode !== 'number' ||
    !Number.isFinite(statusCode) ||
    statusCode === 0 ||
    statusCode >= 500;

  if (unreachable) {
    return {
      score: 0,
      grade: GRADES.F,
      deductions: [{ reason: 'Az oldal nem elérhető (statusCode 0 vagy >= 500)', points: BASE_SCORE }],
    };
  }

  const deductions = [];

  if (!hasHttps) deductions.push({ reason: 'HTTPS hiánya', points: PENALTIES.NO_HTTPS });
  if (!hasCsp) deductions.push({ reason: 'Content-Security-Policy hiánya', points: PENALTIES.NO_CSP });
  if (!hasHsts) deductions.push({ reason: 'Strict-Transport-Security hiánya', points: PENALTIES.NO_HSTS });
  if (!hasXFrame) deductions.push({ reason: 'X-Frame-Options hiánya', points: PENALTIES.NO_XFRAME });
  if (
    typeof responseTimeMs === 'number' &&
    Number.isFinite(responseTimeMs) &&
    responseTimeMs > SLOW_RESPONSE_THRESHOLD_MS
  ) {
    deductions.push({
      reason: `Lassú válaszidő (> ${SLOW_RESPONSE_THRESHOLD_MS} ms)`,
      points: PENALTIES.SLOW_RESPONSE,
    });
  }

  const total = deductions.reduce((sum, d) => sum + d.points, 0);
  const score = Math.min(BASE_SCORE, Math.max(0, BASE_SCORE - total));

  return { score, grade: calculateGrade(score), deductions };
}

module.exports = { calculateSecurityScore, calculateGrade, PENALTIES, GRADES };