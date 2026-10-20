export const MAX_TIP_WORDS = 25;
const BANNED = [
  'diagnos',
  'injur',
  'disease',
  'pain is normal',
  'acl',
  'surgery',
  'medication',
  'medicine',
  'you have',
  'condition',
  'disorder',
];

/** Returns the cleaned tip, or null if it must be rejected (docs/07 §5.2 step 5). */
export function filterTip(raw: string): string | null {
  const tip = raw
    .trim()
    .replace(/^["'“]+|["'”]+$/g, '')
    .replace(/\s+/g, ' ');
  if (!tip) return null;
  if (tip.split(' ').length > MAX_TIP_WORDS) return null;
  if (/\d/.test(tip) || /degree|°/i.test(tip)) return null;
  const lower = tip.toLowerCase();
  if (BANNED.some((b) => new RegExp(`\\b${b}`).test(lower))) return null;
  return tip;
}
