'use strict';

/**
 * SSRF elleni URL-validátor.
 * Nem dob kivételt: mindig { valid: boolean, reason?: string } értéket ad vissza.
 *
 * Fontos: a függvény szinkron, ezért csak magát az URL-t vizsgálja. Az olyan
 * hosztnevet, amely DNS-feloldás után belső címre mutat (DNS rebinding), nem
 * ismeri fel. Kérés előtt a feloldott IP-t is ellenőrizni kell (isBlockedIp).
 */

const net = require('node:net');

const MAX_URL_LENGTH = 2048;
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** IPv4 → 32 bites szám. Feltételezi, hogy a bemenet szabályos pontozott alak. */
function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, octet) => acc * 256 + Number(octet), 0);
}

function inCidr4(ipInt, base, bits) {
  const size = 2 ** (32 - bits);
  const start = ipInt - (ipInt % size);
  return start === ipv4ToInt(base);
}

const BLOCKED_V4 = [
  ['0.0.0.0', 8], // "this network", 0.0.0.0
  ['10.0.0.0', 8], // privát
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local (felhős metadata: 169.254.169.254)
  ['172.16.0.0', 12], // privát
  ['192.168.0.0', 16], // privát
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // fenntartott + broadcast
];

function isBlockedIpv4(ip) {
  const n = ipv4ToInt(ip);
  return BLOCKED_V4.some(([base, bits]) => inCidr4(n, base, bits));
}

/** IPv6 szöveg → 8 db 16 bites szám (vagy null, ha érvénytelen). */
function parseIpv6(input) {
  let str = input;
  const zone = str.indexOf('%');
  if (zone !== -1) str = str.slice(0, zone);

  // Beágyazott IPv4 a végén (pl. ::ffff:1.2.3.4) → két hextet.
  const lastColon = str.lastIndexOf(':');
  const tail = str.slice(lastColon + 1);
  if (tail.includes('.')) {
    if (net.isIPv4(tail) === false) return null;
    const n = ipv4ToInt(tail);
    str = `${str.slice(0, lastColon + 1)}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }

  const halves = str.split('::');
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;

  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  if (groups.length !== 8) return null;

  const out = groups.map((g) => (/^[0-9a-fA-F]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return out.some(Number.isNaN) ? null : out;
}

function isBlockedIpv6(ip) {
  const g = parseIpv6(ip);
  if (!g) return true; // értelmezhetetlen → biztonsági okból tiltott

  const embeddedV4 = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  const firstSixZero = g.slice(0, 6).every((x) => x === 0);

  if (g.slice(0, 7).every((x) => x === 0) && (g[7] === 0 || g[7] === 1)) return true; // :: és ::1
  if (firstSixZero) return true; // ::/96 (IPv4-compatible, elavult)
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isBlockedIpv4(embeddedV4); // ::ffff:a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return isBlockedIpv4(embeddedV4); // NAT64 64:ff9b::/96
  }
  if ((g[0] & 0xfe00) === 0xfc00) return true; // ULA fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast ff00::/8
  return false;
}

/**
 * Igaz, ha az IP-cím (v4 vagy v6) belső / tiltott tartományba esik.
 * DNS-feloldás utáni ellenőrzésre is használható.
 * @param {string} ip
 * @returns {boolean}
 */
function isBlockedIp(ip) {
  if (typeof ip !== 'string') return true;
  const v = net.isIP(ip);
  if (v === 4) return isBlockedIpv4(ip);
  if (v === 6) return isBlockedIpv6(ip);
  return true;
}

/**
 * @param {unknown} input
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateUrl(input) {
  try {
    if (typeof input !== 'string') return { valid: false, reason: 'Az URL szöveg kell legyen' };

    const raw = input.trim();
    if (raw === '') return { valid: false, reason: 'Az URL nem lehet üres' };
    if (raw.length > MAX_URL_LENGTH) {
      return { valid: false, reason: `Az URL túl hosszú (max ${MAX_URL_LENGTH} karakter)` };
    }

    let url;
    try {
      url = new URL(raw);
    } catch {
      return { valid: false, reason: 'Érvénytelen URL formátum' };
    }

    if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
      return { valid: false, reason: 'Csak http: és https: protokoll engedélyezett' };
    }

    // A WHATWG URL a hosztot normalizálja: kisbetűs, és az alternatív IPv4 alakokat
    // (2130706433, 0x7f.1, 127.1) pontozott decimálisra írja át.
    let host = url.hostname;
    if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
    host = host.replace(/\.$/, ''); // záró pont: "localhost."

    if (host === '') return { valid: false, reason: 'Hiányzó hosztnév' };

    if (host === 'localhost' || host.endsWith('.localhost')) {
      return { valid: false, reason: 'A localhost tiltott' };
    }

    if (net.isIP(host) !== 0) {
      if (isBlockedIp(host)) {
        return { valid: false, reason: 'Privát vagy belső IP-cím tiltott' };
      }
    }

    return { valid: true };
  } catch {
    // Semmilyen váratlan hiba nem szivároghat ki kezeletlen kivételként.
    return { valid: false, reason: 'Az URL nem ellenőrizhető' };
  }
}

module.exports = { validateUrl, isBlockedIp };