import { VERSION_PRE_RELEASE_ORDER } from "../constants/index.ts";

interface VersionParts {
  major: number;
  minor: number;
  patch: number;
  preRelease: string[];
}

function toNumber(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) {
    return 0;
  }

  return Number.parseInt(value, 10);
}

function normalizePreReleaseIdentifier(identifier: string): string[] {
  const compactMatch = identifier.match(/^([a-zA-Z]+)(\d+)$/);
  if (compactMatch) {
    return [compactMatch[1].toLowerCase(), compactMatch[2]];
  }

  return [identifier.toLowerCase()];
}

function parseVersion(version: string): VersionParts {
  const withoutPrefix = version.trim().replace(/^v/i, "");
  const withoutBuild = withoutPrefix.split("+", 1)[0] ?? "";
  const [core, preReleasePart = ""] = withoutBuild.split("-", 2);
  const [major, minor, patch] = core.split(".");

  return {
    major: toNumber(major),
    minor: toNumber(minor),
    patch: toNumber(patch),
    preRelease: preReleasePart
      .split(".")
      .filter(Boolean)
      .flatMap(normalizePreReleaseIdentifier),
  };
}

function comparePreReleaseIdentifier(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);

  if (leftNumeric && rightNumeric) {
    const leftValue = Number.parseInt(left, 10);
    const rightValue = Number.parseInt(right, 10);
    return Math.sign(leftValue - rightValue);
  }

  if (leftNumeric) {
    return -1;
  }

  if (rightNumeric) {
    return 1;
  }

  const leftOrder =
    VERSION_PRE_RELEASE_ORDER[left as keyof typeof VERSION_PRE_RELEASE_ORDER] ?? 0;
  const rightOrder =
    VERSION_PRE_RELEASE_ORDER[right as keyof typeof VERSION_PRE_RELEASE_ORDER] ?? 0;

  if (leftOrder !== rightOrder) {
    return Math.sign(leftOrder - rightOrder);
  }

  return left > right ? 1 : -1;
}

// Compare version strings following SemVer-like precedence.
// Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
export function compareVersions(v1: string, v2: string): number {
  const ver1 = parseVersion(v1);
  const ver2 = parseVersion(v2);

  for (const key of ["major", "minor", "patch"] as const) {
    if (ver1[key] > ver2[key]) return 1;
    if (ver1[key] < ver2[key]) return -1;
  }

  if (ver1.preRelease.length === 0 && ver2.preRelease.length > 0) return 1;
  if (ver1.preRelease.length > 0 && ver2.preRelease.length === 0) return -1;

  const maxLength = Math.max(ver1.preRelease.length, ver2.preRelease.length);
  for (let index = 0; index < maxLength; index += 1) {
    const left = ver1.preRelease[index];
    const right = ver2.preRelease[index];

    if (left === undefined && right === undefined) return 0;
    if (left === undefined) return -1;
    if (right === undefined) return 1;

    const comparison = comparePreReleaseIdentifier(left, right);
    if (comparison !== 0) {
      return comparison > 0 ? 1 : -1;
    }
  }

  return 0;
}

export function isVersionNewer(v1: string, v2: string): boolean {
  return compareVersions(v1, v2) > 0;
}
