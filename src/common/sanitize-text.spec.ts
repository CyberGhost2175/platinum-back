import { sanitizeText } from './sanitize-text';

describe('sanitizeText', () => {
  it('strips HTML and script-like fragments from names and comments', () => {
    expect(sanitizeText('<script>alert(1)</script>Анна')).toBe('alert(1)Анна');
    expect(sanitizeText('Иван <b onclick=evil()>Петров</b>')).toBe(
      'Иван Петров',
    );
    expect(sanitizeText('javascript:alert(1)')).toBe('alert(1)');
    expect(sanitizeText('  Кольцо   585  ')).toBe('Кольцо 585');
  });

  it('leaves non-strings unchanged', () => {
    expect(sanitizeText(null)).toBeNull();
    expect(sanitizeText(12)).toBe(12);
  });
});
