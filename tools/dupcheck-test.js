'use strict';
const assert = require('assert');
const { scanTopLevel, findDuplicates } = require('./dupcheck');

// 1. Top-level declarations
const decls = scanTopLevel([
  'const A = 1;',
  'let b = 2, c = 3;',
  'var d = 4;',
  'function foo() { const inner = 1; }',
  'async function bar() {}',
  'class Baz { method() { let x = 0; } }'
].join('\n'));

assert.deepStrictEqual(decls, [
  { name: 'A', type: 'const', line: 1 },
  { name: 'b', type: 'let', line: 2 },
  { name: 'c', type: 'let', line: 2 },
  { name: 'd', type: 'var', line: 3 },
  { name: 'foo', type: 'function', line: 4 },
  { name: 'bar', type: 'function', line: 5 },
  { name: 'Baz', type: 'class', line: 6 }
]);

// 2. Ignores comments, strings, templates, regexes, nested scopes
const ignored = scanTopLevel([
  '// function commentedOut() {}',
  '/* const blockComment = 1; */',
  'const s1 = "function inStr() {}";',
  'const s2 = `var inTpl = ${1 + 2};`;',
  'const re = /let inRegex = 1/;',
  '(function() { var iife = 1; })();',
  'if (true) { let blockScoped = 2; }'
].join('\n'));

assert.deepStrictEqual(ignored.map((d) => d.name), ['s1', 's2', 're']);

// 3. Cross-file duplicates & allowlist
const fixtures = [
  { file: 'a.js', text: 'function shared() {}\nconst UNIQUE_A = 1;\nvar allowed = 1;' },
  { file: 'b.js', text: 'function shared() {}\nconst UNIQUE_B = 2;\nvar allowed = 2;' }
];

const dups = findDuplicates(fixtures, {});
assert.strictEqual(dups.length, 2);
assert.strictEqual(dups[0].name, 'shared');
assert.strictEqual(dups[1].name, 'allowed');

const dupsAllowed = findDuplicates(fixtures, { allowed: true });
assert.strictEqual(dupsAllowed.length, 1);
assert.strictEqual(dupsAllowed[0].name, 'shared');

// 4. Clean fixtures
const clean = findDuplicates([
  { file: 'x.js', text: 'const X = 1;' },
  { file: 'y.js', text: 'const Y = 2;' }
], {});
assert.strictEqual(clean.length, 0);

console.log('ALL DUPCHECK TESTS PASSED');
