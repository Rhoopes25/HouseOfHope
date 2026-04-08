/** Title-style labels for case category in admin UI; preserves mixed-case DB strings when already set. */
export function formatCaseCategoryLabel(value: string): string {
  const s = value.trim();
  if (!s) return '';
  if (s !== s.toLowerCase() && s !== s.toUpperCase()) {
    return s;
  }
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
