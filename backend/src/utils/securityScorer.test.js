'use strict';

const { calculateSecurityScore } = require('./securityScorer');
const { validateUrl } = require('./urlValidator');

describe('calculateSecurityScore', () => {
  test('hibátlan oldal 100 pontot és A osztályzatot kap', () => {
    const result = calculateSecurityScore({
      statusCode: 200,
      responseTimeMs: 500,
      hasHttps: true,
      hasHsts: true,
      hasCsp: true,
      hasXFrame: true,
    });

    expect(result).toEqual({
      score: 100,
      grade: 'A',
      deductions: [],
    });
  });

  test('HTTPS hiánya 40 pontot von le', () => {
    const result = calculateSecurityScore({
      statusCode: 200,
      responseTimeMs: 500,
      hasHttps: false,
      hasHsts: true,
      hasCsp: true,
      hasXFrame: true,
    });

    expect(result.score).toBe(60);
    expect(result.grade).toBe('C');
    expect(result.deductions).toContainEqual({
      reason: 'HTTPS hiánya',
      points: 40,
    });
  });

  test('a CSP, HSTS és X-Frame-Options hiánya összesen 50 pontot von le', () => {
    const result = calculateSecurityScore({
      statusCode: 200,
      responseTimeMs: 500,
      hasHttps: true,
      hasHsts: false,
      hasCsp: false,
      hasXFrame: false,
    });

    expect(result.score).toBe(50);
    expect(result.grade).toBe('D');
    expect(result.deductions).toEqual(
      expect.arrayContaining([
        { reason: 'Content-Security-Policy hiánya', points: 20 },
        { reason: 'Strict-Transport-Security hiánya', points: 15 },
        { reason: 'X-Frame-Options hiánya', points: 15 },
      ]),
    );
  });

  test('az 1000 ms feletti válaszidő 10 pontot von le', () => {
    const result = calculateSecurityScore({
      statusCode: 200,
      responseTimeMs: 1001,
      hasHttps: true,
      hasHsts: true,
      hasCsp: true,
      hasXFrame: true,
    });

    expect(result.score).toBe(90);
    expect(result.grade).toBe('A');
    expect(result.deductions).toContainEqual({
      reason: 'Lassú válaszidő (> 1000 ms)',
      points: 10,
    });
  });

  test('leállt vagy elérhetetlen szerver F osztályzatot kap', () => {
    expect(calculateSecurityScore({ statusCode: 0 }).grade).toBe('F');

    const result = calculateSecurityScore({ statusCode: 503 });
    expect(result).toEqual({
      score: 0,
      grade: 'F',
      deductions: [
        {
          reason: 'Az oldal nem elérhető (statusCode 0 vagy >= 500)',
          points: 100,
        },
      ],
    });
  });
});

describe('validateUrl', () => {
  test.each([
    'http://localhost',
    'http://127.0.0.1',
    'http://10.0.0.1',
    'http://192.168.1.1',
    'http://172.16.0.1',
  ])('belso vagy helyi címet utasít el: %s', (url) => {
    expect(validateUrl(url)).toEqual({
      valid: false,
      reason: expect.any(String),
    });
  });

  test('érvényes publikus HTTPS URL-t elfogad', () => {
    expect(validateUrl('https://example.com')).toEqual({ valid: true });
  });

  test.each(['file:///etc/passwd', 'ftp://example.com'])(
    'érvénytelen protokollt utasít el: %s',
    (url) => {
      expect(validateUrl(url)).toEqual({
        valid: false,
        reason: 'Csak http: és https: protokoll engedélyezett',
      });
    },
  );
});
