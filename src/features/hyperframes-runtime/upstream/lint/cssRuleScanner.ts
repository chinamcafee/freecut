/** Browser-safe CSS rule scanner for lint checks that only need selectors and declarations. */

export interface ScannedCssDeclaration {
  property: string;
  value: string;
}

export interface ScannedCssRule {
  selector: string;
  selectors: string[];
  declarations: ScannedCssDeclaration[];
  body: string;
}

const NESTED_RULE_AT_RULE = /^@(container|document|layer|media|scope|supports)\b/i;

export function scanCssRules(css: string): ScannedCssRule[] {
  const rules: ScannedCssRule[] = [];
  scanRange(css, 0, css.length, rules);
  return rules;
}

function scanRange(css: string, start: number, end: number, rules: ScannedCssRule[]): void {
  let cursor = start;
  while (cursor < end) {
    cursor = skipTrivia(css, cursor, end);
    if (cursor >= end) return;

    const boundary = findBoundary(css, cursor, end);
    if (!boundary) return;
    if (boundary.token !== "{") {
      cursor = boundary.index + 1;
      continue;
    }

    const prelude = css.slice(cursor, boundary.index).trim();
    const close = findMatchingBrace(css, boundary.index, end);
    if (close < 0) return;

    if (NESTED_RULE_AT_RULE.test(prelude)) {
      scanRange(css, boundary.index + 1, close, rules);
    } else if (prelude && !prelude.startsWith("@")) {
      const selectors = splitTopLevel(prelude, ",").map((value) => value.trim()).filter(Boolean);
      if (selectors.length > 0) {
        rules.push({
          selector: selectors.join(", "),
          selectors,
          body: css.slice(boundary.index + 1, close),
          declarations: scanDeclarations(css.slice(boundary.index + 1, close)),
        });
      }
    }

    cursor = close + 1;
  }
}

function scanDeclarations(block: string): ScannedCssDeclaration[] {
  const declarations: ScannedCssDeclaration[] = [];
  for (const candidate of splitTopLevel(block, ";")) {
    const colon = findTopLevelToken(candidate, ":");
    if (colon < 0) continue;
    const property = candidate.slice(0, colon).trim().toLowerCase();
    const value = candidate.slice(colon + 1).trim();
    if (property && value && !property.includes("{")) declarations.push({ property, value });
  }
  return declarations;
}

function splitTopLevel(value: string, delimiter: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let quote: "'" | '"' | null = null;
  let escaped = false;
  let comment = false;
  let parentheses = 0;
  let brackets = 0;
  let braces = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]!;
    const next = value[index + 1];
    if (comment) {
      if (char === "*" && next === "/") {
        comment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "/" && next === "*") {
      comment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") parentheses += 1;
    else if (char === ")") parentheses = Math.max(0, parentheses - 1);
    else if (char === "[") brackets += 1;
    else if (char === "]") brackets = Math.max(0, brackets - 1);
    else if (char === "{") braces += 1;
    else if (char === "}") braces = Math.max(0, braces - 1);
    else if (
      char === delimiter &&
      parentheses === 0 &&
      brackets === 0 &&
      braces === 0
    ) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(value.slice(start));
  return parts;
}

function findTopLevelToken(value: string, token: string): number {
  const parts = splitTopLevel(value, token);
  if (parts.length < 2) return -1;
  return parts[0]!.length;
}

function skipTrivia(css: string, start: number, end: number): number {
  let cursor = start;
  while (cursor < end) {
    if (/\s|;/.test(css[cursor]!)) {
      cursor += 1;
      continue;
    }
    if (css[cursor] === "/" && css[cursor + 1] === "*") {
      const close = css.indexOf("*/", cursor + 2);
      return close < 0 ? end : skipTrivia(css, close + 2, end);
    }
    break;
  }
  return cursor;
}

function findBoundary(
  css: string,
  start: number,
  end: number,
): { index: number; token: "{" | ";" | "}" } | null {
  let quote: "'" | '"' | null = null;
  let escaped = false;
  let parentheses = 0;
  let brackets = 0;

  for (let index = start; index < end; index += 1) {
    const char = css[index]!;
    const next = css[index + 1];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "/" && next === "*") {
      const close = css.indexOf("*/", index + 2);
      if (close < 0) return null;
      index = close + 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") parentheses += 1;
    else if (char === ")") parentheses = Math.max(0, parentheses - 1);
    else if (char === "[") brackets += 1;
    else if (char === "]") brackets = Math.max(0, brackets - 1);
    else if (parentheses === 0 && brackets === 0 && (char === "{" || char === ";" || char === "}")) {
      return { index, token: char };
    }
  }
  return null;
}

function findMatchingBrace(css: string, open: number, end: number): number {
  let depth = 1;
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (let index = open + 1; index < end; index += 1) {
    const char = css[index]!;
    const next = css[index + 1];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "/" && next === "*") {
      const close = css.indexOf("*/", index + 2);
      if (close < 0) return -1;
      index = close + 1;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return index;
  }
  return -1;
}
