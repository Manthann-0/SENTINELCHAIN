// Shared severity mapping — the single source of truth for what a score MEANS.
// Color always encodes the same severity across every view (cards, map, tiles,
// tables, sidebar badge). normal = calm · moderate/stressed = amber · disrupted = red.

export function severityFromScore(score) {
  const s = Number(score) || 0;
  if (s >= 75) return 'disrupted';
  if (s >= 50) return 'stressed';
  if (s >= 30) return 'moderate';
  return 'normal';
}

export const SEV_LABEL = {
  normal: 'NORMAL',
  moderate: 'MODERATE',
  stressed: 'STRESSED',
  disrupted: 'DISRUPTED',
};

export const SEV_COLOR = {
  normal: 'var(--sev-normal)',
  moderate: 'var(--sev-moderate)',
  stressed: 'var(--sev-stressed)',
  disrupted: 'var(--sev-disrupted)',
};

// Corridor identity (decorative accent) — distinct from severity meaning.
export const CORRIDOR_META = {
  hormuz: { label: 'Strait of Hormuz', short: 'Hormuz', color: '#f59e0b' },
  red_sea: { label: 'Bab-el-Mandeb / Red Sea', short: 'Red Sea', color: '#14b8a6' },
  malacca: { label: 'Strait of Malacca', short: 'Malacca', color: '#8b5cf6' },
};

export const CORRIDORS = ['hormuz', 'red_sea', 'malacca'];
export const SUPPLIERS = ['Saudi Arabia', 'Russia', 'UAE', 'USA', 'Nigeria'];
