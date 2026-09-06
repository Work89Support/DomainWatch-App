export function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const username = value.trim();
  return username.length > 0 && username.length <= 100 && !/[\s\u0000-\u001f\u007f]/u.test(username) ? username : null;
}
