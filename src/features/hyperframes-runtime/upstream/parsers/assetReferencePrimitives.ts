/** Browser-safe primitives for scanning HTML and CSS asset references. */

export const CSS_URL_RE = /\burl\(\s*(["']?)([^)"'\s](?:[^)"']*[^)"'\s])?)\1\s*\)/g;

export const PATH_ATTRS = ["src", "href"] as const;

export function isNonRelativeUrl(val: string): boolean {
  return (
    !val ||
    val.startsWith("http://") ||
    val.startsWith("https://") ||
    val.startsWith("//") ||
    val.startsWith("data:") ||
    val.startsWith("#") ||
    val.startsWith("/")
  );
}
