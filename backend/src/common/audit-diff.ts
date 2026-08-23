/**
 * Reduces a before/after pair to the fields that actually moved.
 *
 * An audit line carrying every column makes a one-word note change look like
 * a rewrite of the row, and the trail stops being readable at exactly the
 * moment somebody needs to read it. Pure, so the comparison rules —
 * including dates, which are never equal by identity — are asserted in a
 * test.
 *
 * Ported from the root Next.js app's `lib/api/audit-diff.ts`.
 */
export type AuditValue = string | number | boolean | null;

export interface FieldDiff<T> {
  before: Partial<T>;
  after: Partial<T>;
}

function isSame(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  return Object.is(a, b);
}

/**
 * Returns null when nothing changed, so a caller can skip the audit write
 * entirely rather than record that a seller pressed save.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
): FieldDiff<T> | null {
  const changedBefore: Partial<T> = {};
  const changedAfter: Partial<T> = {};
  let changed = false;

  for (const key of Object.keys(after) as (keyof T)[]) {
    if (!isSame(before[key], after[key])) {
      changedBefore[key] = before[key];
      changedAfter[key] = after[key];
      changed = true;
    }
  }

  return changed ? { before: changedBefore, after: changedAfter } : null;
}
