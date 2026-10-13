const LOGIN_DOMAIN = "futbolpormipais.org";

/**
 * The login field is a person's first name. Supabase Auth still wants an
 * email, so "Marjorie" and "Marjorie Méndez" both become
 * marjorie@futbolpormipais.org. A full email is passed through unchanged.
 */
export function loginToEmail(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes("@")) return trimmed.toLowerCase();

  const first = trimmed.split(/\s+/)[0] ?? trimmed;
  const local = first
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

  return `${local}@${LOGIN_DOMAIN}`;
}
