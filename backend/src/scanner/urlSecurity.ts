import dns from 'node:dns/promises';
import net from 'node:net';

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.azure.com',
  'instance-data',
  'kubernetes.default.svc',
]);

const parseIpv4 = (address: string): number[] | null => {
  if (net.isIP(address) !== 4) return null;
  return address.split('.').map(Number);
};

const isBlockedIpv4 = (address: string): boolean => {
  const octets = parseIpv4(address);
  if (!octets) return false;
  const [a, b, c] = octets;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
};

const isBlockedIpv6 = (address: string): boolean => {
  if (net.isIP(address) !== 6) return false;
  const normalized = address.toLowerCase().split('%')[0];

  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith('ff')) return true;

  const dottedMapped = normalized.match(/^(?:::|0:0:0:0:0:)ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dottedMapped) return isBlockedIpv4(dottedMapped[1]);

  const hexMapped = normalized.match(/^(?:::|0:0:0:0:0:)ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped) {
    const high = Number.parseInt(hexMapped[1], 16);
    const low = Number.parseInt(hexMapped[2], 16);
    const ipv4 = `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
    return isBlockedIpv4(ipv4);
  }
  return false;
};

export const isBlockedIp = (address: string): boolean =>
  isBlockedIpv4(address) || isBlockedIpv6(address);

const parseAndNormalize = (input: string): URL => {
  const trimmed = input.trim();
  let url: URL;

  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new UnsafeUrlError('That does not look like a valid web address.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new UnsafeUrlError('Only http and https addresses can be scanned.');
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('Addresses containing usernames or passwords are not supported.');
  }
  if (url.port && !/^\d{1,5}$/.test(url.port)) {
    throw new UnsafeUrlError('The address contains an invalid port.');
  }

  url.hash = '';
  return url;
};

export class UrlGuard {
  async assertPublic(input: string): Promise<URL> {
    const url = parseAndNormalize(input);
    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();

    if (
      BLOCKED_HOSTNAMES.has(hostname) ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      throw new UnsafeUrlError('That address points to a private or internal network.');
    }

    if (net.isIP(hostname)) {
      if (isBlockedIp(hostname)) {
        throw new UnsafeUrlError('That address points to a private or reserved network.');
      }
      return url;
    }

    await this.validateDns(hostname);
    return url;
  }

  private async validateDns(hostname: string): Promise<void> {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new UnsafeUrlError('The domain could not be resolved.');
    }

    if (addresses.length === 0 || addresses.some(({ address }) => isBlockedIp(address))) {
      throw new UnsafeUrlError('That domain resolves to a private or reserved network.');
    }
  }
}

export const normalizeAndValidateUrl = async (input: string): Promise<URL> =>
  new UrlGuard().assertPublic(input);
