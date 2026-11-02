// Read selected public game definitions without starting the game or contacting services.
const fs = require('node:fs');
const vm = require('node:vm');
function balanced(source, start, endAtSemicolon = false) {
  let depth = 0, quote = '', lineComment = false, blockComment = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (lineComment) { if (c === '\n') lineComment = false; continue; }
    if (blockComment) { if (c === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
    if (c === '/' && next === '/') { lineComment = true; i++; continue; }
    if (c === '/' && next === '*') { blockComment = true; i++; continue; }
    if ('\'"`'.includes(c)) { quote = c; continue; }
    if ('[{('.includes(c)) depth++;
    if (']})'.includes(c)) { depth--; if (!endAtSemicolon && depth === 0) return source.slice(start, i + 1); }
    if (c === ';' && depth === 0 && endAtSemicolon) return source.slice(start, i);
  }
  throw Error('Unterminated source definition at ' + start);
}
function reader(file, initial = {}) {
  const source = fs.readFileSync(file, 'utf8');
  const context = vm.createContext({ ...initial });
  return {
    source, context,
    get(name) {
      if (Object.hasOwn(context, name)) return context[name];
      const match = new RegExp('\\b(?:const|let)\\s+' + name + '\\s*=\\s*').exec(source);
      if (!match) throw Error('Missing definition: ' + file + ' / ' + name);
      const expr = balanced(source, match.index + match[0].length, true);
      context[name] = vm.runInContext('(' + expr + ')', context, { timeout: 3000 });
      return context[name];
    },
    fn(name) {
      const match = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(source);
      if (!match) throw Error('Missing function: ' + name);
      const open = source.indexOf('{', match.index);
      const declaration = source.slice(match.index, open) + balanced(source, open);
      vm.runInContext(declaration, context);
      return context[name];
    }
  };
}
module.exports = { reader, balanced };
