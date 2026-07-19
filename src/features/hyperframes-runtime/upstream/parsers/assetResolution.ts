import { existsSync } from "node:fs";
import { isAbsolute, posix, relative, resolve } from "node:path";
import { decodeUrlPathVariants } from "./composition.js";
export { maskNonScannableRanges } from "./htmlAssetScanning.js";

/**
 * Shared local-asset resolution helpers for every package that maps
 * composition asset URLs to files on disk (lint project rules, the HEVC
 * preview check, studio-server's media codec scan). Import via the
 * `@hyperframes/parsers/asset-resolution` subpath.
 */

export function isRemoteOrInlineUrl(url: string): boolean {
  return /^(https?:|data:|blob:|\/\/|#)/i.test(url);
}

export function cleanAssetUrl(url: string): string {
  return url.trim().split(/[?#]/, 1)[0] ?? "";
}

export function isWithinProjectRoot(projectDir: string, candidate: string): boolean {
  const projectRoot = resolve(projectDir);
  const relativePath = relative(projectRoot, candidate);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function addCandidate(candidates: string[], candidate: string): void {
  if (!candidates.includes(candidate)) candidates.push(candidate);
}

export function resolveLocalAssetCandidates(projectDir: string, url: string): string[] {
  const cleanUrl = cleanAssetUrl(url);
  const projectRoot = resolve(projectDir);
  const candidates: string[] = [];

  for (const variant of decodeUrlPathVariants(cleanUrl)) {
    const projectRelative = variant.startsWith("/") ? variant.slice(1) : variant;
    const resolved = resolve(projectRoot, projectRelative);
    if (isWithinProjectRoot(projectRoot, resolved)) {
      addCandidate(candidates, resolved);
      continue;
    }

    const normalized = posix.normalize(projectRelative.replace(/\\/g, "/"));
    const clamped = normalized.replace(/^(\.\.\/)+/, "");
    if (clamped && !clamped.startsWith("..")) {
      addCandidate(candidates, resolve(projectRoot, clamped));
    }
  }

  return candidates;
}

export function resolveExistingLocalAsset(
  projectDir: string,
  url: string,
): { resolved: string; rootRelativePath: string } | null {
  const projectRoot = resolve(projectDir);
  const resolved = resolveLocalAssetCandidates(projectRoot, url).find(existsSync);
  if (!resolved) return null;
  return { resolved, rootRelativePath: relative(projectRoot, resolved) };
}
