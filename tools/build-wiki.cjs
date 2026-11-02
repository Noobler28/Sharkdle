// Validate all wiki modules, references, artwork and local destinations.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = { window: {} };
const homepage = fs.readFileSync(path.join(root, 'wiki.html'), 'utf8');
const contentFiles = [...homepage.matchAll(/<script src="(Wiki\/[^"]+\.js)" defer><\/script>/g)].map(match => match[1]).filter(file => file !== 'Wiki/wiki.js');
for (const file of contentFiles) vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
const data = context.window.SHARKDLE_WIKI;
if (!Array.isArray(data?.categories) || !Array.isArray(data?.entries)) throw Error('Wiki categories and entries must be lists.');
const ids = new Set();
let tables = 0, rows = 0, words = 0;
for (const entry of data.entries) {
  if (!entry.id || !entry.title || !data.categories.includes(entry.category)) throw Error('Each article needs an id, title, and an existing category.');
  if (ids.has(entry.id)) throw Error('Duplicate article id: ' + entry.id);
  ids.add(entry.id);
  words += [entry.summary, ...(entry.sections || []).flatMap(section => [section.title, ...(Array.isArray(section.text) ? section.text : [section.text]), ...(section.bullets || [])])].filter(Boolean).join(' ').split(/\s+/).length;
}
const checkedImages = new Set();
function imageExists(image) {
  if (checkedImages.has(image)) return;
  if (!/^images\/[\w./ -]+$/.test(image) || image.includes('..') || !fs.existsSync(path.join(root, image))) throw Error('Missing or invalid image: ' + image);
  let directory = root;
  for (const component of image.split('/')) {
    if (!fs.readdirSync(directory).includes(component)) throw Error('Incorrect image path casing: ' + image);
    directory = path.join(directory, component);
  }
  checkedImages.add(image);
}
function checkCell(cell, articleId) {
  if (cell && typeof cell === 'object') {
    if (!cell.text && !cell.image) throw Error('Empty structured cell in ' + articleId);
    if (cell.article && !ids.has(cell.article)) throw Error('Broken linked cell in ' + articleId + ': ' + cell.article);
    if (cell.href) localLink(cell.href);
    if (cell.image) imageExists(cell.image.src);
  }
}
function localLink(href) {
  if (/^https?:\/\//.test(href)) return;
  if (href.startsWith('#/article/')) { const id = decodeURIComponent(href.slice('#/article/'.length).split('?')[0]); if (!ids.has(id)) throw Error('Broken article link: ' + href); return; }
  if (href.startsWith('#/category/')) { if (!data.categories.includes(decodeURIComponent(href.slice('#/category/'.length)))) throw Error('Broken category link: ' + href); return; }
  if (['#/', '#/directory', '#/guides'].includes(href)) return;
  if (href.startsWith('#')) return;
  const file = decodeURIComponent(href.split(/[?#]/)[0]);
  if (!file || path.isAbsolute(file) || file.includes('..') || !fs.existsSync(path.join(root, file))) throw Error('Broken local destination: ' + href);
}
const cosmetics = new Map();
for (const item of data.cosmetics || []) {
  if (!item.id || !item.name || !item.obtainment || !item.rarity || !item.availability) throw Error('Incomplete cosmetic: ' + item.id);
  if (cosmetics.has(item.id)) throw Error('Duplicate cosmetic id: ' + item.id);
  cosmetics.set(item.id, item);
  const images = [item.image, ...[...(item.preview || '').matchAll(/url\(([^)]+)\)/g)].map(match => match[1])].filter(Boolean);
  for (const image of images) imageExists(image);
}
for (const entry of data.entries) {
  for (const id of entry.related || []) if (!ids.has(id)) throw Error('Broken related article: ' + id);
  if (entry.playUrl) localLink(entry.playUrl);
  if (entry.image) imageExists(entry.image.src);
  for (const image of [...(entry.preview || '').matchAll(/url\(([^)]+)\)/g)]) imageExists(image[1]);
  for (const row of entry.facts || []) {
    if (row.length !== 2 || !row[0]) throw Error('Invalid infobox row in ' + entry.id);
    checkCell(row[1], entry.id);
  }
  for (const section of entry.sections || []) {
    if (!section.title) throw Error('Untitled section in ' + entry.id);
    if (section.image) imageExists(section.image.src);
    for (const link of section.links || []) {
      if (link.article && !ids.has(link.article)) throw Error('Broken article link in ' + entry.id + ': ' + link.article);
      if (link.href) localLink(link.href);
    }
    if (section.table) {
      const table = section.table; tables++; rows += table.rows.length;
      for (const row of table.rows) {
        if (row.length !== table.columns.length) throw Error('Table column count mismatch in ' + entry.id + ': ' + section.title);
        for (const cell of row) checkCell(cell, entry.id);
      }
    }
    for (const reference of section.catalog || []) {
      const id = typeof reference === 'string' ? reference : reference.id;
      if (!cosmetics.has(id)) throw Error('Broken cosmetic reference: ' + id);
    }
  }
}
for (const match of homepage.matchAll(/href="([^"]+)"/g)) localLink(match[1]);
for (const category of data.categories) if (!data.entries.some(entry => entry.category === category)) throw Error('Empty category: ' + category);
console.log(`Wiki ready: ${data.categories.length} sections, ${data.entries.length} pages (${data.entries.filter(entry => entry.guide).length} guides).`);
console.log(`Checked ${data.species?.length || 0} species, ${cosmetics.size} catalogue items, ${tables} tables / ${rows} rows, all artwork and article links.`);
console.log(`${words.toLocaleString('en-GB')} words of summaries, explanatory text and bullet points. No files generated.`);
