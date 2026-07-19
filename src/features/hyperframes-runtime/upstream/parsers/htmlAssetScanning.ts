function maskRange(src: string, pattern: RegExp): string {
  return src.replace(pattern, (match) => " ".repeat(match.length));
}

function maskHtmlComments(src: string): string {
  const chunks: string[] = [];
  let cursor = 0;

  while (true) {
    const start = src.indexOf("<!--", cursor);
    if (start === -1) break;
    const end = src.indexOf("-->", start + 4);
    if (end === -1) break;
    const afterComment = end + 3;
    chunks.push(src.slice(cursor, start), " ".repeat(afterComment - start));
    cursor = afterComment;
  }

  return chunks.length === 0 ? src : chunks.join("") + src.slice(cursor);
}

/** Blanks comments and script/style bodies while preserving source offsets. */
export function maskNonScannableRanges(html: string): string {
  let out = maskHtmlComments(html);
  out = maskRange(out, /<style\b[^>]*>[\s\S]*?<\/style\b[^>]*>/gi);
  out = maskRange(out, /<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gi);
  return out;
}
