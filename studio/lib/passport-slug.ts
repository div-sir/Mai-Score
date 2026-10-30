const RESERVED_SLUGS = new Set([
  "api", "collector", "passport", "privacy", "studio", "admin", "help", "support", "www"
]);

export function normalizePassportSlug(value: unknown): string {
  if (typeof value !== "string") throw new Error("Choose a profile name.");
  const slug = value.normalize("NFKC").trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/.test(slug) || slug.includes("--")) {
    throw new Error("Profile names use 3–30 lowercase letters, numbers, or single hyphens.");
  }
  if (RESERVED_SLUGS.has(slug)) throw new Error("That profile name is reserved.");
  return slug;
}

export function suggestPassportSlug(displayName: string): string {
  const candidate = displayName.normalize("NFKD").toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 30)
    .replace(/-+$/g, "");
  return candidate.length >= 3 && !RESERVED_SLUGS.has(candidate) ? candidate : "";
}
