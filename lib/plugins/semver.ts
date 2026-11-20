// Just enough semantic versioning for plugin compatibility: parse
// `MAJOR.MINOR.PATCH` (an optional `-prerelease` is allowed and sorts before
// the release), compare two versions. No ranges — a plugin names one lowest
// and optionally one highest Barynt version.
//
// Hand-written on purpose: `semver` is only a transitive dependency, and the
// manifest validator has to run in the plugin store's CI as well.

export interface Semver {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
}

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export function parseSemver(value: string): Semver | null {
  const m = SEMVER_RE.exec(value);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ?? null,
  };
}

export function isSemver(value: string): boolean {
  return parseSemver(value) !== null;
}

function comparePrerelease(a: string | null, b: string | null): number {
  // A release is greater than any prerelease of the same triple.
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const pa = a.split(".");
  const pb = b.split(".");
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) {
      if (Number(x) !== Number(y)) return Number(x) < Number(y) ? -1 : 1;
    } else if (nx !== ny) {
      return nx ? -1 : 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

/** Negative if a < b, 0 if equal, positive if a > b. Throws on invalid input. */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) throw new Error(`invalid version: ${!pa ? a : b}`);
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;
  return comparePrerelease(pa.prerelease, pb.prerelease);
}

/** A version with a `-prerelease` part: a beta, a release candidate, … */
export function isPrerelease(version: string): boolean {
  return parseSemver(version)?.prerelease != null;
}

const newestFirst = (versions: string[]) =>
  [...versions].sort((a, b) => compareSemver(b, a));

/**
 * `versions` as the store's picker shows them: the real releases, then the
 * betas, each newest first.
 */
export function splitVersions(versions: string[]): {
  releases: string[];
  prereleases: string[];
} {
  const sorted = newestFirst(versions);
  return {
    releases: sorted.filter((v) => !isPrerelease(v)),
    prereleases: sorted.filter(isPrerelease),
  };
}

/**
 * The version to offer first: the newest real release, even when a newer
 * beta exists — a beta only when there is no release at all.
 */
export function preferredVersion(versions: string[]): string | null {
  const { releases, prereleases } = splitVersions(versions);
  return releases[0] ?? prereleases[0] ?? null;
}

/**
 * What an installed `current` should be offered as an update: the newest
 * real release above it. A beta only to someone who is on a beta already —
 * the newest above theirs; nobody on a release is pushed onto one.
 */
export function updateTarget(
  versions: string[],
  current: string,
): string | null {
  const { releases, prereleases } = splitVersions(
    versions.filter((v) => compareSemver(v, current) > 0),
  );
  if (releases[0]) return releases[0];
  return isPrerelease(current) ? (prereleases[0] ?? null) : null;
}
