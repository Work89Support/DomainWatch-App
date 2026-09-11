// Match the complete URL, preserving path, query and fragment differences.
export function sameLinkUrl(a: string, b: string) {
  try { return new URL(a.trim()).href === new URL(b.trim()).href; }
  catch { return false; }
}
