'use strict';
const fs = require('fs');
const path = require('path');
const STRICT = true;
function scanTopLevel(text) {
  const decls = [];
  const n = text.length;
  let i = 0;
  let line = 1;
  let brace = 0, paren = 0, bracket = 0;
  const tplStack = [];
  let canRegex = true;
  let varDecl = null;

  function isIdStart(c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$';
  }
  function isIdPart(c) {
    return isIdStart(c) || (c >= '0' && c <= '9');
  }

  while (i < n) {
    const c = text[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v') { i++; continue; }
    if (c === '/' && text[i + 1] === '/') {
      i += 2;
      while (i < n && text[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) {
        if (text[i] === '\n') line++;
        i++;
      }
      i += 2;
      continue;
    }
    if (c === "'" || c === '"') {
      const q = c;
      i++;
      while (i < n && text[i] !== q) {
        if (text[i] === '\\') { i++; if (text[i] === '\n') line++; }
        else if (text[i] === '\n') { line++; }
        i++;
      }
      i++;
      canRegex = false;
      continue;
    }
    if (c === '`') {
      i++;
      while (i < n) {
        if (text[i] === '\\') { i++; if (text[i] === '\n') line++; i++; }
        else if (text[i] === '$' && text[i + 1] === '{') {
          tplStack.push(brace); brace++; i += 2; canRegex = true; break;
        } else if (text[i] === '`') {
          i++; canRegex = false; break;
        } else {
          if (text[i] === '\n') line++;
          i++;
        }
      }
      continue;
    }
    if (c === '/' && canRegex) {
      i++;
      let inClass = false;
      while (i < n) {
        if (text[i] === '\\') { i += 2; }
        else if (text[i] === '[') { inClass = true; i++; }
        else if (text[i] === ']' && inClass) { inClass = false; i++; }
        else if (text[i] === '/' && !inClass) { i++; while (i < n && isIdStart(text[i])) i++; break; }
        else if (text[i] === '\n') { break; }
        else { i++; }
      }
      canRegex = false;
      continue;
    }
    if (c === '}' && tplStack.length > 0 && brace - 1 === tplStack[tplStack.length - 1]) {
      tplStack.pop();
      brace--;
      i++;
      while (i < n) {
        if (text[i] === '\\') { i++; if (text[i] === '\n') line++; i++; }
        else if (text[i] === '$' && text[i + 1] === '{') {
          tplStack.push(brace); brace++; i += 2; canRegex = true; break;
        } else if (text[i] === '`') {
          i++; canRegex = false; break;
        } else {
          if (text[i] === '\n') line++;
          i++;
        }
      }
      continue;
    }
    if (c === '{') { brace++; i++; canRegex = true; continue; }
    if (c === '}') { if (brace > 0) brace--; i++; canRegex = false; continue; }
    if (c === '(') { paren++; i++; canRegex = true; continue; }
    if (c === ')') { if (paren > 0) paren--; i++; canRegex = false; continue; }
    if (c === '[') { bracket++; i++; canRegex = true; continue; }
    if (c === ']') { if (bracket > 0) bracket--; i++; canRegex = false; continue; }
    if (c === ';') { if (brace === 0 && paren === 0 && bracket === 0) varDecl = null; i++; canRegex = true; continue; }
    if (c === ',') { if (varDecl && brace === 0 && paren === 0 && bracket === 0) varDecl.state = 'name'; i++; canRegex = true; continue; }
    if (c === '=') { if (varDecl && brace === 0 && paren === 0 && bracket === 0 && text[i + 1] !== '=') varDecl.state = 'skip'; i++; canRegex = true; continue; }
    if (c >= '0' && c <= '9') { while (i < n && (isIdPart(text[i]) || text[i] === '.')) i++; canRegex = false; continue; }
    if (isIdStart(c)) {
      const startLine = line;
      const prevChar = i > 0 ? text[i - 1] : '';
      let j = i + 1;
      while (j < n && isIdPart(text[j])) j++;
      const word = text.slice(i, j);
      i = j;
      const atTop = brace === 0 && paren === 0 && bracket === 0;
      if (atTop && prevChar !== '.') {
        if (varDecl && varDecl.state === 'name') {
          decls.push({ name: word, type: varDecl.type, line: startLine });
          varDecl.state = 'skip';
          canRegex = false;
          continue;
        }
        if (word === 'var' || word === 'let' || word === 'const') {
          varDecl = { type: word, state: 'name' };
          canRegex = true;
          continue;
        }
        if (word === 'function' || word === 'class') {
          varDecl = null;
          let k = i, fnLine = startLine;
          while (k < n && (text[k] === ' ' || text[k] === '\t' || text[k] === '\r' || text[k] === '\n' || text[k] === '*')) {
            if (text[k] === '\n') fnLine++;
            k++;
          }
          if (k < n && isIdStart(text[k])) {
            let m = k + 1;
            while (m < n && isIdPart(text[m])) m++;
            decls.push({ name: text.slice(k, m), type: word, line: fnLine });
            i = m;
          }
          canRegex = false;
          continue;
        }
        if (word === 'async') {
          let k = i;
          while (k < n && (text[k] === ' ' || text[k] === '\t' || text[k] === '\r')) k++;
          if (text.slice(k, k + 8) === 'function' && !isIdPart(text[k + 8] || '')) { canRegex = true; continue; }
        }
      }
      canRegex = (word === 'return' || word === 'typeof' || word === 'void' || word === 'delete' || word === 'throw' || word === 'case' || word === 'in' || word === 'of' || word === 'else' || word === 'yield' || word === 'await');
      continue;
    }
    canRegex = '+-*%&|^!~<>?:'.indexOf(c) !== -1;
    i++;
  }
  return decls;
}

function findDuplicates(files, allowlist) {
  const allow = allowlist || {};
  const map = new Map();
  for (const f of files) {
    const file = f.file || f.path || f.name || '';
    const decls = scanTopLevel(f.text || '');
    for (const d of decls) {
      if (Array.isArray(allow) ? allow.includes(d.name) : Object.prototype.hasOwnProperty.call(allow, d.name)) continue;
      if (!map.has(d.name)) map.set(d.name, []);
      map.get(d.name).push({ file, line: d.line, type: d.type });
    }
  }
  const dups = [];
  for (const [name, occurrences] of map.entries()) {
    if (occurrences.length > 1) dups.push({ name, occurrences });
  }
  return dups;
}

function readScriptsFromIndex(indexPath) {
  const html = fs.readFileSync(indexPath, 'utf8');
  const scripts = [];
  const re = /src="\.\/(js\/[^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const s = m[1];
    if (s === 'js/storage-idb.js' || s === 'js/sanitize.js') continue;
    scripts.push(s);
  }
  return scripts;
}

if (require.main === module) {
  const allowPath = process.argv[2] || path.join(__dirname, 'dup-allowlist.json');
  let allowlist = {};
  if (fs.existsSync(allowPath)) allowlist = JSON.parse(fs.readFileSync(allowPath, 'utf8'));
  const rootDir = path.resolve(__dirname, '..');
  const scriptPaths = readScriptsFromIndex(path.join(rootDir, 'index.html'));
  const files = scriptPaths.map((s) => ({ file: s, text: fs.readFileSync(path.join(rootDir, s), 'utf8') }));
  const dups = findDuplicates(files, allowlist);
  if (dups.length === 0) {
    console.log('OK: No top-level duplicates found across ' + files.length + ' scripts.');
    process.exit(0);
  }
  for (const d of dups) {
    const locs = d.occurrences.map((o) => o.file + ':' + o.line + ' (' + o.type + ')').join(', ');
    if (STRICT) {
      console.log('FAIL: Duplicate top-level "' + d.name + '" -> ' + locs);
    } else {
      const first = d.occurrences[0];
      console.log('::warning file=' + first.file + ',line=' + first.line + '::Duplicate top-level "' + d.name + '" (' + first.type + ') -> ' + locs);
    }
  }
  process.exit(STRICT ? 1 : 0);
}

module.exports = { STRICT, scanTopLevel, findDuplicates, readScriptsFromIndex };
