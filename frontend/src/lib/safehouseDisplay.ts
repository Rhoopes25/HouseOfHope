/** User-facing label for DB safehouse names (e.g. "Lighthouse Safehouse 3" → "House 3"). */
export function displaySafehouseName(dbName: string): string {
  if (!dbName.trim()) return '';
  const m = dbName.match(/Lighthouse\s+Safehouse\s*(\d+)/i);
  if (m) return `House ${m[1]}`;
  return dbName.replace(/\bLighthouse\b/gi, 'House');
}
