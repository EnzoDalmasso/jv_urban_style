export function normalizeStaffName(name: string) {
  const normalized = name.trim().toLowerCase();

  if (normalized.includes('nico')) {
    return 'Joel';
  }

  if (normalized.includes('lara')) {
    return 'Gino';
  }

  return name;
}
