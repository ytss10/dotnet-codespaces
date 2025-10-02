import { createHash } from "crypto";

export type PrefixLookupResult<T> = {
  value: T;
  prefixLength: number;
  prefix: number;
};

export class AdaptiveRadixTree<T> {
  private readonly buckets = new Map<number, Map<number, T>>();
  private entries = 0;

  insert(cidr: string, value: T): void {
    const { prefix, length } = parseCidr(cidr);
    const mask = maskFromLength(length);
    const key = prefix & mask;
    const bucket = this.getBucket(length);
    if (!bucket.has(key)) {
      this.entries += 1;
    }
    bucket.set(key, value);
  }

  insertPrefix(prefix: number, length: number, value: T): void {
    if (length < 0 || length > 32) {
      throw new RangeError(`Invalid prefix length ${length}`);
    }
    const mask = maskFromLength(length);
    const key = prefix & mask;
    const bucket = this.getBucket(length);
    if (!bucket.has(key)) {
      this.entries += 1;
    }
    bucket.set(key, value);
  }

  lookup(ip: string | number): PrefixLookupResult<T> | undefined {
    const ipNumber = typeof ip === "number" ? normalizeIpNumber(ip) : ipToNumber(ip);
    for (let length = 32; length >= 0; length -= 1) {
      const bucket = this.buckets.get(length);
      if (!bucket) continue;
      const mask = maskFromLength(length);
      const key = ipNumber & mask;
      const value = bucket.get(key);
      if (value !== undefined) {
        return { value, prefixLength: length, prefix: key };
      }
    }
    return undefined;
  }

  has(cidr: string): boolean {
    const { prefix, length } = parseCidr(cidr);
    const mask = maskFromLength(length);
    const bucket = this.buckets.get(length);
    return bucket?.has(prefix & mask) ?? false;
  }

  size(): number {
    return this.entries;
  }

  snapshot(): Array<{ prefix: number; prefixLength: number; value: T }> {
    const list: Array<{ prefix: number; prefixLength: number; value: T }> = [];
    for (const [length, bucket] of this.buckets) {
      for (const [prefix, value] of bucket) {
        list.push({ prefix, prefixLength: length, value });
      }
    }
    return list.sort((a, b) => {
      if (a.prefixLength !== b.prefixLength) {
        return b.prefixLength - a.prefixLength;
      }
      return a.prefix - b.prefix;
    });
  }

  private getBucket(length: number): Map<number, T> {
    let bucket = this.buckets.get(length);
    if (!bucket) {
      bucket = new Map();
      this.buckets.set(length, bucket);
    }
    return bucket;
  }
}

export function parseCidr(cidr: string): { prefix: number; length: number } {
  const [rawIp, rawLength] = cidr.trim().split("/");
  if (!rawIp || !rawLength) {
    throw new Error(`Invalid CIDR notation: ${cidr}`);
  }
  const length = Number.parseInt(rawLength, 10);
  if (!Number.isFinite(length) || length < 0 || length > 32) {
    throw new RangeError(`Invalid prefix length in ${cidr}`);
  }
  const prefix = ipToNumber(rawIp);
  const mask = maskFromLength(length);
  return { prefix: prefix & mask, length };
}

export function ipToNumber(ip: string): number {
  const octets = ip.trim().split(".");
  if (octets.length !== 4) {
    throw new Error(`Only IPv4 is supported. Received ${ip}`);
  }
  let result = 0;
  for (const octet of octets) {
    const value = Number.parseInt(octet, 10);
    if (!Number.isFinite(value) || value < 0 || value > 255) {
      throw new Error(`Invalid IPv4 segment ${octet} in ${ip}`);
    }
    result = (result << 8) | value;
  }
  return result >>> 0;
}

export function numberToIp(value: number): string {
  const normalized = normalizeIpNumber(value);
  return [
    (normalized >>> 24) & 0xff,
    (normalized >>> 16) & 0xff,
    (normalized >>> 8) & 0xff,
    normalized & 0xff
  ].join(".");
}

export function maskFromLength(length: number): number {
  if (length <= 0) {
    return 0;
  }
  if (length >= 32) {
    return 0xffffffff;
  }
  const mask = (~0 << (32 - length)) >>> 0;
  return mask;
}

export function normalizeIpNumber(value: number): number {
  return value >>> 0;
}

export function fingerprintKey(prefix: number, length: number): string {
  const buffer = Buffer.allocUnsafe(8);
  buffer.writeUInt32BE(prefix >>> 0, 0);
  buffer.writeUInt32BE(length >>> 0, 4);
  return createHash("sha1").update(buffer).digest("hex").slice(0, 16);
}
