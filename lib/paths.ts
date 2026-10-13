export function listBackHref(
  path: string,
  params: Record<string, string | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

/** Only same-origin paths. Anything else falls back, so `back` cannot send us off-site. */
export function safeBackPath(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const path = raw.startsWith("/") ? raw : fallback;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return fallback;
  }
  return path;
}
