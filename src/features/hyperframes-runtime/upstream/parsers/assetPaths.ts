/**
 * Shared primitives for scanning and rewriting asset paths in HTML/CSS.
 *
 * Used by: rewriteSubCompPaths (core), collectExternalAssets (producer),
 * localizeExternalAssets (CLI publish).
 */

import { isAbsolute, relative, resolve } from "node:path";
export { CSS_URL_RE, PATH_ATTRS, isNonRelativeUrl } from "./assetReferencePrimitives.js";

/**
 * Cross-platform containment check: is `childPath` inside `parentPath`?
 * Equality counts as "inside".
 */
export function isPathInside(childPath: string, parentPath: string): boolean {
  const absChild = resolve(childPath);
  const absParent = resolve(parentPath);
  if (absChild === absParent) return true;
  const rel = relative(absParent, absChild);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}
