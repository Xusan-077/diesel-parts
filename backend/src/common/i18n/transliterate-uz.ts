/**
 * Deterministic Uzbek Latin -> Cyrillic transliteration (the "oz" locale).
 * This is NOT translation and never calls Gemini/AI — oz is mechanically
 * derived from the uz text, so it stays correct even when the AI service is
 * unavailable.
 *
 * Token boundary rule (what counts as a "code" left untouched):
 * a run of letters/digits is skipped (returned verbatim) when it contains a
 * digit (model codes like "320D", "WD615") or is made up entirely of
 * uppercase letters, 2+ of them (acronyms/brand codes like "SHANTUI", "OEM").
 * A title-case brand word with no digit (e.g. "Weichai", "Cummins") is NOT
 * caught by this rule and WILL be transliterated letter-by-letter — there is
 * no brand dictionary here. Callers that must preserve such brand names
 * verbatim need to substitute placeholders before calling this function.
 */
export function transliterateUzLatinToCyrillic(text: string): string {
  return text.replace(/[A-Za-z0-9ʻʼ'‘’`]+/g, (token) =>
    transliterateToken(token),
  );
}

const APOSTROPHE_VARIANTS = /[ʼ'‘’`]/g;
const CANONICAL_APOSTROPHE = 'ʻ'; // ʻ

/** Longest-match-first; only entries whose Cyrillic result loses information
 * by being checked out of order need to precede shorter overlapping ones —
 * none of these overlap, so order only matters for scan efficiency. */
const DIGRAPHS: Array<[string, string]> = [
  ['o' + CANONICAL_APOSTROPHE, 'ў'], // oʻ -> ў
  ['g' + CANONICAL_APOSTROPHE, 'ғ'], // gʻ -> ғ
  ['ts', 'ц'], // ц
  ['sh', 'ш'], // ш
  ['ch', 'ч'], // ч
  ['yo', 'ё'], // ё
  ['yu', 'ю'], // ю
  ['ya', 'я'], // я
  ['ye', 'е'], // е (same as mid-word plain "e" — see word-initial "e" rule below)
  ['ng', 'нг'], // нг
];

const SINGLES: Record<string, string> = {
  a: 'а',
  b: 'б',
  c: 'к', // rare standalone; only meaningfully Uzbek inside "ch"/"ts"
  d: 'д',
  e: 'е',
  f: 'ф',
  g: 'г',
  h: 'ҳ',
  i: 'и',
  j: 'ж',
  k: 'к',
  l: 'л',
  m: 'м',
  n: 'н',
  o: 'о',
  p: 'п',
  q: 'қ',
  r: 'р',
  s: 'с',
  t: 'т',
  u: 'у',
  v: 'в',
  x: 'х',
  y: 'й',
  z: 'з',
};

function isUpper(ch: string): boolean {
  return ch === ch.toUpperCase() && ch !== ch.toLowerCase();
}

function isCode(token: string): boolean {
  if (/\d/.test(token)) return true;
  const letters = token.replace(APOSTROPHE_VARIANTS, '').replace(/ʻ/g, '');
  if (letters.length < 2) return false;
  return letters === letters.toUpperCase() && letters !== letters.toLowerCase();
}

/** Applies the case of `source` onto `cyr`. When lengths match, maps
 * character-by-character (needed for "Ng"/"NG" -> "Нг"/"НГ"); otherwise the
 * whole (typically single-character) result takes the first source
 * character's case (e.g. "Sh"/"SH" both -> "Ш" — a single Cyrillic letter
 * cannot represent two independently-cased Latin letters). */
function applyCase(source: string, cyr: string): string {
  if (source.length === cyr.length) {
    return [...cyr]
      .map((ch, i) =>
        isUpper(source[i]) ? ch.toUpperCase() : ch.toLowerCase(),
      )
      .join('');
  }
  return isUpper(source[0]) ? cyr[0].toUpperCase() + cyr.slice(1) : cyr;
}

function transliterateToken(rawToken: string): string {
  if (isCode(rawToken)) return rawToken;

  const token = rawToken.replace(APOSTROPHE_VARIANTS, CANONICAL_APOSTROPHE);
  let result = '';
  let i = 0;
  while (i < token.length) {
    const match = DIGRAPHS.find(
      ([lat]) => token.slice(i, i + lat.length).toLowerCase() === lat,
    );
    if (match) {
      const [lat, cyr] = match;
      result += applyCase(token.slice(i, i + lat.length), cyr);
      i += lat.length;
      continue;
    }

    const ch = token[i];
    const lower = ch.toLowerCase();
    if (lower === 'e') {
      // Word-initial "e" (not part of a "ye" digraph, already handled above)
      // is э; everywhere else it's е.
      const cyr = i === 0 ? 'э' : 'е';
      result += isUpper(ch) ? cyr.toUpperCase() : cyr;
    } else if (SINGLES[lower]) {
      result += isUpper(ch) ? SINGLES[lower].toUpperCase() : SINGLES[lower];
    } else {
      result += ch; // unmapped char (e.g. "w", a stray apostrophe): keep as-is
    }
    i += 1;
  }
  return result;
}
