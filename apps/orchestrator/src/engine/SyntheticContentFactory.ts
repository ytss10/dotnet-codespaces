import { createHash, randomBytes } from "node:crypto";

export type SyntheticFallbackStrategy = "synthesize" | "reject" | "loopback";

interface SyntheticDescriptor {
  url: string;
  imprint: string;
  checksum: string;
  issuedAt: number;
  entropy: string;
}

interface SynthesizeContext {
  label?: string;
  tags?: string[];
  seed?: string;
}

export class SyntheticContentFactory {
  private readonly baseHost: string;
  private readonly atlas = new Map<string, SyntheticDescriptor>();
  private readonly salt: string;

  constructor(options: { baseHost?: string; salt?: string } = {}) {
    this.baseHost = options.baseHost ?? "https://synthetic.mega.local";
    this.salt = options.salt ?? randomBytes(16).toString("hex");
  }

  generateUrl(seed: string, context: SynthesizeContext = {}): string {
    const hash = this.primeHash(`${this.salt}:${seed}:${context.label ?? ""}`);
    const segments = [hash.slice(0, 8), hash.slice(8, 16), hash.slice(16, 32)];
    return `${this.baseHost}/${segments.join("/")}`;
  }

  ensureSyntheticDescriptor(seed: string, context: SynthesizeContext = {}): SyntheticDescriptor {
    const url = this.generateUrl(seed, context);
    const existing = this.atlas.get(url);
    if (existing) {
      return existing;
    }

    const imprintSource = this.composeImprintSource(url, context);
    const imprint = this.encodeImprint(imprintSource);
    const checksum = this.primeHash(imprintSource).slice(0, 32);
    const descriptor: SyntheticDescriptor = {
      url,
      imprint,
      checksum,
      entropy: this.primeHash(`${seed}:${checksum}`),
      issuedAt: Date.now()
    };
    this.atlas.set(url, descriptor);
    return descriptor;
  }

  generateBatch(count: number, context: SynthesizeContext = {}): SyntheticDescriptor[] {
    const descriptors: SyntheticDescriptor[] = [];
    for (let i = 0; i < count; i++) {
      const seed = `${context.seed ?? "auto"}-${i}-${Date.now()}`;
      descriptors.push(this.ensureSyntheticDescriptor(seed, context));
    }
    return descriptors;
  }

  isSynthetic(url: string): boolean {
    return url.startsWith(this.baseHost);
  }

  private composeImprintSource(url: string, context: SynthesizeContext): string {
    const tags = (context.tags ?? []).join(",");
    return `${url}|${context.label ?? "synthetic"}|${tags}|${this.salt}`;
  }

  private encodeImprint(source: string): string {
    return Buffer.from(source, "utf8").toString("base64url");
  }

  private primeHash(value: string): string {
    const hash = createHash("sha512");
    hash.update(value);
    return hash.digest("hex");
  }
}
