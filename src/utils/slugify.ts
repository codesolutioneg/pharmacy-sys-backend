export function slugifyRoleName(displayName: string): string {
  return displayName.trim().toLowerCase().replace(/ /g, '_');
}

/** Generic kebab-case slug generator (e.g. for medicine/category slugs). */
export function slugify(text: string): string {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
