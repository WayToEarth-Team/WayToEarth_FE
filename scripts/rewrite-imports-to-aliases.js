/*
  Rewrite relative imports to path aliases defined in tsconfig/babel config.
  Aliases:
    @app -> src/app
    @features -> src/features
    @shared -> src/shared
    @utils -> utils
    @types -> types
    @assets -> assets
    @hooks -> hooks
    @contexts -> contexts
    @navigation -> navigation

  This script resolves each import/require specifier to an absolute path and
  if it points into one of the aliased roots, it rewrites the specifier to the
  corresponding alias form.
*/

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

const aliasMap = [
  { alias: '@app', root: path.join(projectRoot, 'src', 'app') },
  { alias: '@features', root: path.join(projectRoot, 'src', 'features') },
  { alias: '@shared', root: path.join(projectRoot, 'src', 'shared') },
  { alias: '@utils', root: path.join(projectRoot, 'utils') },
  { alias: '@types', root: path.join(projectRoot, 'types') },
  { alias: '@assets', root: path.join(projectRoot, 'assets') },
  { alias: '@hooks', root: path.join(projectRoot, 'hooks') },
  { alias: '@contexts', root: path.join(projectRoot, 'contexts') },
  { alias: '@navigation', root: path.join(projectRoot, 'navigation') },
];

const exts = new Set(['.ts', '.tsx', '.js', '.jsx']);

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'android' || ent.name === 'ios') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, files);
    else if (exts.has(path.extname(ent.name))) files.push(full);
  }
  return files;
}

function toAlias(spec, basedir) {
  if (!spec.startsWith('.')) return null; // only relative
  // Ignore style and asset-ish imports that don't need rewrite (will be resolved below via fs check)
  const abs = path.normalize(path.resolve(basedir, spec));
  for (const { alias, root } of aliasMap) {
    const rel = path.relative(root, abs);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
      // inside this root
      const aliased = alias + '/' + rel.replace(/\\/g, '/');
      return aliased;
    }
  }
  return null;
}

function rewriteFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  let out = src;
  const dir = path.dirname(file);

  // import ... from '...'
  out = out.replace(/(import\s+[^;]*?from\s+['"])([^'"\n]+)(['"]\s*;?)/g, (m, p1, spec, p3) => {
    const aliased = toAlias(spec, dir);
    if (aliased) return p1 + aliased + p3;
    return m;
  });

  // export ... from '...'
  out = out.replace(/(export\s+[^;]*?from\s+['"])([^'"\n]+)(['"]\s*;?)/g, (m, p1, spec, p3) => {
    const aliased = toAlias(spec, dir);
    if (aliased) return p1 + aliased + p3;
    return m;
  });

  // require('...')
  out = out.replace(/(require\(\s*['"])([^'"\n]+)(['"]\s*\))/g, (m, p1, spec, p3) => {
    const aliased = toAlias(spec, dir);
    if (aliased) return p1 + aliased + p3;
    return m;
  });

  if (out !== src) {
    fs.writeFileSync(file, out, 'utf8');
    return true;
  }
  return false;
}

const files = walk(projectRoot, []);
let changed = 0;
for (const f of files) {
  try {
    if (rewriteFile(f)) changed++;
  } catch (e) {
    // ignore parse errors, continue
  }
}
console.log(`Rewritten imports with aliases in ${changed} files.`);

