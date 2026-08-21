/**
 * What the small line above a catalog card's name says.
 *
 * The brief for the card is "brand and name", and in this trade the name
 * usually *is* the brand and name: parts are catalogued as "CAT 950
 * transmissiya filtri", "Doosan DX140 dvigatel klapani". Printing the brand
 * again above that gives every card in the grid a "CAT / CAT 950…" stutter.
 *
 * So the line is spent on whichever of the two the name has not already said.
 * A name that opens with its brand gets the category instead — which is the
 * other thing a buyer scanning a grid of similar parts wants — and a name
 * entered without its brand gets the brand. Either way it is exactly one line
 * on every card, which is what keeps the rows below it aligned.
 */
export function cardEyebrow(
  name: string,
  brandName: string,
  categoryName: string
): string {
  if (brandName.length > 0 && !startsWithBrand(name, brandName)) {
    return brandName;
  }
  return categoryName;
}

/**
 * Whether a part's name already opens with its brand.
 *
 * Compared case-insensitively and only at a word boundary, so "CAT 950" counts
 * for CAT while "Caterpillar-mos filtr" does not count for "Cat" — a name that
 * merely starts with the same letters is not the brand being named.
 */
export function startsWithBrand(name: string, brandName: string): boolean {
  const brand = brandName.trim().toLowerCase();
  if (brand.length === 0) {
    return false;
  }

  const head = name.trim().toLowerCase();
  if (!head.startsWith(brand)) {
    return false;
  }

  const next = head.charAt(brand.length);
  return next === "" || !/[\p{L}\p{N}]/u.test(next);
}
