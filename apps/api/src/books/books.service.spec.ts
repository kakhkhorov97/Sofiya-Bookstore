import { escapeLike } from './books.service';
import { slugify } from '../db/seed/seed';
import { CATALOGUE } from '../db/seed/catalogue';

describe('escapeLike', () => {
  it('escapes LIKE wildcards and backslashes', () => {
    expect(escapeLike('100%_off\\')).toBe('100\\%\\_off\\\\');
  });

  it('leaves normal text alone', () => {
    expect(escapeLike('Jane Eyre')).toBe('Jane Eyre');
  });
});

describe('catalogue slugs', () => {
  it('are unique and URL-safe', () => {
    const slugs = CATALOGUE.map((b) => slugify(b.title, b.author));
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('strips accents', () => {
    expect(slugify('Les Misérables', 'Victor Hugo')).toBe(
      'les-miserables-hugo',
    );
  });
});
