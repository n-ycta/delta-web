/**
 * Minimal semver implementation sufficient for contract negotiation.
 * Supports: exact "1.2.3", caret "^1.2", tilde "~1.2.3", ">=1.0.0 <2.0.0", "*", "1.x".
 */
export interface SemVer { major: number; minor: number; patch: number; pre?: string }

const RE = /^v?(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?(?:-([0-9A-Za-z.-]+))?$/;

export function parse(v: string): SemVer | null {
  const m = RE.exec(v.trim());
  if (!m) return null;
  const n = (s?: string) => (s === undefined || s === 'x' || s === '*' ? 0 : Number(s));
  return { major: Number(m[1]), minor: n(m[2]), patch: n(m[3]), pre: m[4] };
}

export function isValid(v: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(v.trim());
}

export function compare(a: string | SemVer, b: string | SemVer): number {
  const A = typeof a === 'string' ? parse(a) : a;
  const B = typeof b === 'string' ? parse(b) : b;
  if (!A || !B) return 0;
  if (A.major !== B.major) return A.major - B.major;
  if (A.minor !== B.minor) return A.minor - B.minor;
  if (A.patch !== B.patch) return A.patch - B.patch;
  if (A.pre && !B.pre) return -1;
  if (!A.pre && B.pre) return 1;
  return (A.pre ?? '').localeCompare(B.pre ?? '');
}

function satisfiesComparator(v: SemVer, comp: string): boolean {
  comp = comp.trim();
  if (comp === '' || comp === '*' || comp === 'x') return true;
  const op = /^(\^|~|>=|<=|>|<|=)?\s*(.+)$/.exec(comp);
  if (!op) return false;
  const operator = op[1] ?? '';
  const raw = op[2];
  const target = parse(raw);
  if (!target) return false;
  const parts = raw.split('.');
  const c = compare(v, target);
  switch (operator) {
    case '^':
      if (target.major > 0) return c >= 0 && v.major === target.major;
      if (target.minor > 0) return c >= 0 && v.major === 0 && v.minor === target.minor;
      return c >= 0 && v.major === 0 && v.minor === 0 && v.patch === target.patch;
    case '~':
      return c >= 0 && v.major === target.major && (parts.length < 2 || v.minor === target.minor);
    case '>=': return c >= 0;
    case '<=': return c <= 0;
    case '>': return c > 0;
    case '<': return c < 0;
    default:
      if (parts.length < 3 || parts.includes('x') || parts.includes('*')) {
        if (v.major !== target.major) return false;
        if (parts.length >= 2 && parts[1] !== 'x' && parts[1] !== '*' && v.minor !== target.minor) return false;
        return true;
      }
      return c === 0;
  }
}

/** range: space-separated comparators (AND), "||" separated sets (OR). */
export function satisfies(version: string, range: string): boolean {
  const v = parse(version);
  if (!v) return false;
  return range.split('||').some((set) => set.trim().split(/\s+/).every((comp) => satisfiesComparator(v, comp)));
}

export function diffKind(from: string, to: string): 'major' | 'minor' | 'patch' | 'none' {
  const a = parse(from), b = parse(to);
  if (!a || !b) return 'none';
  if (b.major !== a.major) return 'major';
  if (b.minor !== a.minor) return 'minor';
  if (b.patch !== a.patch) return 'patch';
  return 'none';
}
