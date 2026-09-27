import { transliterateUzLatinToCyrillic } from './transliterate-uz';

describe('transliterateUzLatinToCyrillic', () => {
  it('transliterates a plain lowercase word', () => {
    expect(transliterateUzLatinToCyrillic('salom')).toBe('салом');
  });

  it('preserves a capitalized first letter', () => {
    expect(transliterateUzLatinToCyrillic('Salom')).toBe('Салом');
  });

  it('handles o‘ -> ў with a straight apostrophe', () => {
    expect(transliterateUzLatinToCyrillic("o'zbek")).toBe('ўзбек');
  });

  it('handles g‘ -> ғ with a straight apostrophe', () => {
    expect(transliterateUzLatinToCyrillic("g'oz")).toBe('ғоз');
  });

  it('normalizes a curly right-single-quote apostrophe the same as a straight one', () => {
    expect(transliterateUzLatinToCyrillic('o’zbek')).toBe('ўзбек');
  });

  it('accepts the canonical ʻ (U+02BB) apostrophe directly', () => {
    expect(transliterateUzLatinToCyrillic('gʻildirak')).toBe('ғилдирак');
  });

  it('maps word-initial "e" to э', () => {
    expect(transliterateUzLatinToCyrillic('ekskavator')).toBe('экскаватор');
  });

  it('maps a non-initial "e" to е', () => {
    expect(transliterateUzLatinToCyrillic('sement')).toBe('семент');
  });

  it('maps the sh digraph', () => {
    expect(transliterateUzLatinToCyrillic('shakar')).toBe('шакар');
  });

  it('maps the ch digraph', () => {
    expect(transliterateUzLatinToCyrillic('charchoq')).toBe('чарчоқ');
  });

  it('maps a plain word with no digraphs', () => {
    expect(transliterateUzLatinToCyrillic('non')).toBe('нон');
  });

  it('maps the ng digraph mid-word', () => {
    expect(transliterateUzLatinToCyrillic('singil')).toBe('сингил');
  });

  it('maps sh at word end', () => {
    expect(transliterateUzLatinToCyrillic('ish')).toBe('иш');
  });

  it('maps the ts digraph (Russian loanword)', () => {
    expect(transliterateUzLatinToCyrillic('tsex')).toBe('цех');
  });

  it('maps the yo digraph', () => {
    expect(transliterateUzLatinToCyrillic('yoq')).toBe('ёқ');
  });

  it('maps the yu digraph', () => {
    expect(transliterateUzLatinToCyrillic('yumshoq')).toBe('юмшоқ');
  });

  it('maps ya followed by the ng digraph', () => {
    expect(transliterateUzLatinToCyrillic('yangi')).toBe('янги');
  });

  it('maps the ye digraph to е, not э, even word-initially', () => {
    expect(transliterateUzLatinToCyrillic('yer')).toBe('ер');
  });

  it('leaves an all-uppercase brand code untouched', () => {
    expect(transliterateUzLatinToCyrillic('SHANTUI')).toBe('SHANTUI');
  });

  it('leaves an all-uppercase acronym untouched', () => {
    expect(transliterateUzLatinToCyrillic('CAT')).toBe('CAT');
  });

  it('leaves a digit-containing model code untouched', () => {
    expect(transliterateUzLatinToCyrillic('320D')).toBe('320D');
  });

  it('leaves a digit-containing brand+model code untouched', () => {
    expect(transliterateUzLatinToCyrillic('WD615')).toBe('WD615');
  });

  it('leaves a whole "CAT 320D"-style phrase untouched', () => {
    expect(transliterateUzLatinToCyrillic('CAT 320D')).toBe('CAT 320D');
  });

  it('does NOT recognize a title-case, digit-free brand word as a code — it gets transliterated (documented limitation, no brand dictionary)', () => {
    expect(transliterateUzLatinToCyrillic('Cummins')).toBe('Кумминс');
  });

  it('transliterates a full sentence, preserving spacing and punctuation', () => {
    expect(
      transliterateUzLatinToCyrillic('Gidronasos va turbokompressor'),
    ).toBe('Гидронасос ва турбокомпрессор');
  });

  it('transliterates a realistic product description with a preserved OEM code', () => {
    expect(
      transliterateUzLatinToCyrillic("Tishli g'ildirak, OEM 612600020933"),
    ).toBe('Тишли ғилдирак, OEM 612600020933');
  });
});
