function parkImageSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[ʻ’']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getParkBadgeUrl(name: string): string {
  return `${import.meta.env.BASE_URL}parks/${parkImageSlug(name)}.webp`;
}
