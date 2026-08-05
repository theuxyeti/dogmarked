/** Strip quotes / accidental Bearer prefix from FOURSQUARE_API_KEY env values. */
export function normalizeFoursquareApiKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  key = key.replace(/^Bearer\s+/i, "").trim();
  return key;
}
