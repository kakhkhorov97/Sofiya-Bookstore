import fs from 'node:fs';
import path from 'node:path';

// LEGACY: the old API imported './Member.service' while the file was
// 'member.service.ts'. macOS ignores the difference; Linux servers do not,
// so the app would not start once deployed. Every relative import in src
// must match the file name on disk exactly.

function tsFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return tsFiles(full);
    return e.name.endsWith('.ts') ? [full] : [];
  });
}

function existsWithExactCase(target: string): boolean {
  const parts = path.relative(__dirname, target).split(path.sep);
  let dir = __dirname;
  for (const part of parts) {
    if (part === '..') {
      dir = path.dirname(dir);
      continue;
    }
    if (!fs.readdirSync(dir).includes(part)) return false;
    dir = path.join(dir, part);
  }
  return true;
}

function resolveImport(fromFile: string, spec: string): string | null {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const candidate of [`${base}.ts`, path.join(base, 'index.ts'), base]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

describe('LEGACY: relative imports match file names exactly', () => {
  const importRe = /from\s+['"](\.{1,2}\/[^'"]+)['"]/g;

  it.each(tsFiles(__dirname).map((f) => [path.relative(__dirname, f), f]))(
    '%s',
    (_rel, file) => {
      const source = fs.readFileSync(file, 'utf8');
      for (const [, spec] of source.matchAll(importRe)) {
        const resolved = resolveImport(file, spec);
        expect({ spec, resolved: resolved !== null }).toEqual({
          spec,
          resolved: true,
        });
        expect({ spec, exactCase: existsWithExactCase(resolved!) }).toEqual({
          spec,
          exactCase: true,
        });
      }
    },
  );
});
