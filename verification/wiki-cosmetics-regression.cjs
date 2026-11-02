// Exercise the static wiki router and catalogue filters without loading game code,
// opening a browser, contacting Firebase, or adding dependencies.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const decode = value => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function element(tagName = 'DIV') {
  const classes = new Set();
  const listeners = {};
  return { tagName, value: '', hidden: false, dataset: {}, textContent: '', innerHTML: '', listeners,
    addEventListener(type, listener) { (listeners[type] ||= []).push(listener); }, setAttribute() {}, removeAttribute() {}, focus() {},
    scrollIntoView() { this.scrolled = true; },
    querySelectorAll() { return []; },
    classList: { toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); }, contains(name) { return classes.has(name); } }
  };
}
const shell = Object.fromEntries(['page-content', 'wiki-search', 'sidebar', 'menu-toggle', 'menu-backdrop', 'wiki-nav', 'wiki-status', 'main-content', 'search-form'].map(id => [id, element()]));
let dynamic = {}, cards = [], sections = [], referenceTables = [], markup = 'Original home content';
const page = shell['page-content'];
Object.defineProperty(page, 'innerHTML', {
  get: () => markup,
  set(html) {
    markup = html; dynamic = {}; cards = []; sections = []; referenceTables = [];
    for (const match of html.matchAll(/\bid="([^"]+)"/g)) dynamic[match[1]] = element();
    for (const section of html.matchAll(/<section class="article-section catalog-section"[^>]*>([\s\S]*?)<\/section>/g)) {
      const sectionCards = [...section[1].matchAll(/<article class="cosmetic-card" data-catalog-text="([^"]*)" data-rarity="([^"]*)" data-availability="([^"]*)" data-kind="([^"]*)" data-collection="([^"]*)"/g)].map(match => ({
        hidden: false,
        dataset: { catalogText: decode(match[1]), rarity: match[2], availability: match[3], kind: decode(match[4]), collection: decode(match[5]) }
      }));
      cards.push(...sectionCards);
      sections.push({ hidden: false, querySelectorAll: () => sectionCards });
    }
    for (const table of html.matchAll(/<div class="wiki-table-block" data-table-container>([\s\S]*?)<\/table><\/div><\/div>/g)) {
      const rows = [...table[1].matchAll(/<tr data-table-text="([^"]*)"/g)].map(match => ({ hidden: false, dataset: { tableText: decode(match[1]) } }));
      const counter = element();
      const container = { querySelectorAll: () => rows, querySelector: () => counter };
      const input = element('INPUT');
      input.classList.toggle('wiki-table-filter', true);
      input.closest = selector => selector === '[data-table-container]' ? container : null;
      referenceTables.push({ rows, input, counter });
    }
  }
});
page.querySelectorAll = selector => selector === '.cosmetic-card' ? cards : selector === '.catalog-section' ? sections : [];
const window = { scrollTo() {}, addEventListener() {} };
const location = { hash: '' };
const context = vm.createContext({ window, location, URLSearchParams,
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  document: { activeElement: element('BODY'), title: '', addEventListener() {}, querySelector: () => element(), getElementById: id => shell[id] || dynamic[id] || null }
});
const contentFiles = [...read('wiki.html').matchAll(/<script src="(Wiki\/[^"]+\.js)" defer><\/script>/g)].map(match => match[1]).filter(file => file !== 'Wiki/wiki.js');
for (const file of contentFiles) vm.runInContext(read(file), context, { filename: file });
const data = window.SHARKDLE_WIKI;
vm.runInContext(read('Wiki/wiki.js').replace(/\n\}\)\(\);\s*$/, '\nwindow.wikiTest = { render, filterCatalog, resetCatalog };\n})();'), context);
const navigate = route => { location.hash = route; window.wikiTest.render(); };
const shown = () => cards.filter(card => !card.hidden).length;
assert.equal(markup, 'Original home content');
assert.ok(data.entries.length > 1400);
for (const [route, expected] of [['all-cosmetics', 152], ['cosmetic-portraits', 62], ['cosmetic-badges', 61], ['cosmetic-themes', 29], ['crates', 56]]) {
  navigate('#/article/' + route);
  assert.equal(cards.length, expected, route + ' renders every catalogue record');
  assert.equal(shown(), expected);
  assert.ok(!markup.includes('undefined'));
  assert.equal(dynamic['catalog-count'].textContent, `${expected} of ${expected} items shown`);
}
navigate('#/article/all-cosmetics');
assert.equal(cards.filter(card => card.dataset.kind === 'Portrait').length, 62);
assert.equal(cards.filter(card => card.dataset.kind === 'Badge').length, 61);
assert.equal(cards.filter(card => card.dataset.kind === 'Profile theme').length, 29);
dynamic['catalog-kind'].value = 'Badge';
dynamic['catalog-collection'].value = 'Cosmetic Crate 1';
window.wikiTest.filterCatalog();
assert.equal(shown(), 4, 'combined type and collection filters');
dynamic['catalog-query'].value = 'no match';
dynamic['catalog-rarity'].value = 'rare';
dynamic['catalog-availability'].value = 'Available';
window.wikiTest.filterCatalog();
assert.equal(shown(), 0);
window.wikiTest.resetCatalog();
assert.equal(shown(), 152, 'Show all clears every filter and restores the full collection');
assert.ok(sections.every(section => !section.hidden));
navigate('#/category/Cosmetics');
assert.ok(markup.includes('#/article/all-cosmetics'));
navigate('#/article/cosmetic-badges');
dynamic['catalog-query'].value = 'rollin';
window.wikiTest.filterCatalog();
assert.equal(shown(), 1);
dynamic['catalog-rarity'].value = 'legendary';
window.wikiTest.filterCatalog();
assert.equal(shown(), 0);
assert.equal(dynamic['catalog-empty'].hidden, false);
dynamic['catalog-query'].value = '';
dynamic['catalog-availability'].value = 'Unavailable';
window.wikiTest.filterCatalog();
assert.equal(shown(), 3, 'disabled boss rewards remain identifiable');
assert.equal(dynamic['catalog-empty'].hidden, true);
navigate('#/article/cosmetic-portraits');
dynamic['catalog-query'].value = 'whale shark';
window.wikiTest.filterCatalog();
assert.equal(shown(), 2, 'starter and Summer artwork are separate unlocks');
dynamic['catalog-availability'].value = 'Retired';
window.wikiTest.filterCatalog();
assert.equal(shown(), 1);
navigate('#/search?q=Whiptail%20Stingray');
assert.ok(markup.includes('#/article/cosmetic-portraits'));
assert.ok(markup.includes('#/article/crates'), 'global wiki search includes referenced item names');
navigate('#/article/crates?section=5');
assert.ok(dynamic['wiki-section-5'].scrolled, 'contents links scroll to the selected section');
navigate('#/article/how-guessing-works');
assert.ok(markup.includes('<h1>' + data.entries.find(entry => entry.id === 'how-guessing-works').title + '</h1>'));
assert.equal(cards.length, 0);
navigate('#/');
assert.equal(markup, 'Original home content', 'the authored introduction survives navigation');

// Every article must render: this catches schema mismatches that a data-only
// catalogue count cannot detect, including linked cells and new guide images.
for (const entry of data.entries) {
  navigate('#/article/' + encodeURIComponent(entry.id));
  assert.ok(markup.includes('<h1>'), 'Article did not render: ' + entry.id);
  assert.ok(!markup.includes('[object Object]'), 'Unrendered table cell: ' + entry.id);
  assert.ok(!markup.includes('src="undefined"'), 'Missing image: ' + entry.id);
  assert.ok(!markup.includes('href="undefined"'), 'Missing link: ' + entry.id);
  if (entry.facts?.length) assert.ok(markup.includes('class="wiki-infobox"'), 'Infobox missing: ' + entry.id);
  if (entry.image) assert.ok(markup.includes('src="' + entry.image.src + '"'), 'Article artwork missing: ' + entry.id);
}
assert.equal(data.entries.filter(entry => entry.id.startsWith('rng-potion-') && entry.id !== 'rng-potion-catalogue').length, 24);
assert.equal(data.entries.filter(entry => entry.id.startsWith('rng-prestige-upgrade-')).length, 35);
assert.equal(data.entries.filter(entry => entry.id.startsWith('mutation-') && !['mutation-catalogue', 'mutation-seasonal'].includes(entry.id)).length, 244);
assert.equal(data.entries.filter(entry => entry.id.startsWith('achievement-') && entry.id !== 'achievement-catalogue').length, 60);
for (const [prefix, count] of [['bottle-', 4], ['rescue-operation-', 12], ['rescue-research-', 10], ['rescue-program-', 6], ['rescue-apex-', 6], ['community-boss-', 4]]) {
  const records = data.entries.filter(entry => entry.id.startsWith(prefix));
  assert.equal(records.length, count, 'Missing named profiles: ' + prefix);
  assert.ok(records.every(entry => entry.facts?.length && entry.sections.length >= 2), 'Incomplete profile: ' + prefix);
}
for (const cosmetic of data.cosmetics.filter(item => item.kind !== 'Utility item')) {
  const entry = data.entries.find(entry => entry.id === 'cosmetic-' + cosmetic.id);
  assert.ok(entry?.facts?.length && entry.sections.length >= 2, 'Incomplete named cosmetic article: ' + cosmetic.name);
}
navigate('#/article/cosmetic-badges');
assert.ok(markup.includes('#/article/cosmetic-badge-rollin'), 'Badge cards open their full articles');
navigate('#/article/cosmetic-badge-rollin');
assert.ok(markup.includes('Limp Bizkit') && markup.includes('Trivia'), 'The named badge retains its reference trivia');
navigate('#/article/sharkdle');
assert.ok(markup.includes('#/article/identical-species-clues'), 'Wiki articles link to specific explanations');
for (const category of data.categories) {
  navigate('#/category/' + encodeURIComponent(category));
  assert.ok(markup.includes('result-card'), 'Empty category: ' + category);
  assert.ok((markup.match(/class="result-card"/g) || []).length <= 24, 'Unbounded result page: ' + category);
}
navigate('#/category/Species?kind=reference&page=2');
assert.equal((markup.match(/class="result-card"/g) || []).length, 24);
assert.ok(markup.includes('Page 2 of'));
navigate('#/directory?page=99999');
assert.ok(!markup.includes('NaN'));
assert.ok((markup.match(/class="result-card"/g) || []).length > 0);
navigate('#/search?q=Frilled%20Shark');
assert.ok(markup.includes('#/article/species-frilled-shark'));
assert.ok(markup.indexOf('#/article/species-frilled-shark') < markup.indexOf('#/article/species-southern-african-frilled-shark'), 'Exact species titles outrank partial matches');
navigate('#/article/species-directory');
const sharkTable = referenceTables.find(table => table.rows.length === 540);
assert.ok(sharkTable);
sharkTable.input.value = 'southern african frilled';
for (const listener of page.listeners.input) listener({ target: sharkTable.input });
assert.equal(sharkTable.rows.filter(row => !row.hidden).length, 1);
assert.equal(sharkTable.counter.textContent, '1 of 540 entries');
sharkTable.input.value = '';
for (const listener of page.listeners.input) listener({ target: sharkTable.input });
assert.equal(sharkTable.rows.filter(row => !row.hidden).length, 540);

assert.equal(data.species.length, 1244);
assert.equal(data.species.find(species => species.name === 'Frilled Shark').rngRating, 57, 'Current RNG calculation, not the old stored OneIn value');
for (const [file, name, pool] of [['sharks.js', 'sharks', 'Sharks'], ['rays.js', 'rays', 'Relatives']]) {
  const { reader } = require('../tools/wiki-sources.cjs');
  const values = reader(path.join(root, file)).get(name);
  assert.equal(values.length, data.species.filter(species => species.pool === pool).length);
  for (const value of values) {
    const record = data.species.find(species => species.name === value.name && species.pool === pool);
    assert.ok(record, 'Missing species: ' + value.name);
    for (const field of ['order', 'family', 'genus', 'size', 'depth']) assert.equal(record[field], value[field], value.name + ': ' + field);
    assert.equal(record.year, value.yod);
  }
}

// Check coverage against the actual reward collections, independently of routes.
const game = read('script.js');
function sourceArray(name) {
  const start = game.indexOf(`const ${name} = `);
  assert.ok(start >= 0, name);
  const open = game.indexOf('[', start), end = game.indexOf('\n]', open) + 2;
  return vm.runInNewContext('(' + game.slice(open, end) + ')', { STREAK_SHIELD_ITEM_ID: 'streak-shield' });
}
const catalogue = Array.from(data.cosmetics);
const master = data.entries.find(entry => entry.id === 'all-cosmetics').sections.flatMap(section => section.catalog);
assert.equal(new Set(master).size, 152, 'no duplicate items pad the master collection count');
for (const item of catalogue.filter(item => item.kind !== 'Utility item')) assert.ok(master.includes(item.id), item.name + ' is visible on All cosmetics');
for (const name of ['crateRewardPool', 'legacyCrate1RewardPool', 'summerCrateRewardPool', 'christmasCrateRewardPool', 'halloweenCrateRewardPool', 'sharkPassRewards', 'levelRewards', 'RETIRED_TREASURE_PFPS']) {
  for (const reward of sourceArray(name)) {
    if (reward.type === 'crate') continue;
    if (reward.imagePath) assert.ok(catalogue.some(item => item.image === reward.imagePath), name + ': ' + reward.name);
    else assert.ok(catalogue.some(item => item.name === reward.name || (reward.themeId === 'horizonflare' && item.name === 'Horizon') || (reward.themeId === 'solsticeglow' && item.name === 'Summer Glow')), name + ': ' + reward.name);
  }
}
for (const theme of sourceArray('sharkPassCardThemes')) assert.ok(catalogue.some(item => item.id === 'theme-' + theme.id), theme.id);
for (const badge of [...sourceArray('allBadges'), ...sourceArray('currentPassBadgeDefs')]) assert.ok(catalogue.some(item => item.kind === 'Badge' && item.name === badge.name), badge.id);
const additionsStart = game.indexOf('allBadges.push(\n');
const additionsEnd = game.indexOf('\n);', additionsStart);
const extraBadges = vm.runInNewContext(`[${game.slice(additionsStart + 'allBadges.push('.length, additionsEnd)}]`);
for (const badge of extraBadges) assert.ok(catalogue.some(item => item.kind === 'Badge' && item.name === badge.name), 'Additional badge: ' + badge.id);
for (const image of game.matchAll(/imagePath:\s*['"](images\/[^'"]+)['"]/g)) assert.ok(catalogue.some(item => item.image === image[1]), 'Portrait referenced by game: ' + image[1]);
const used = new Set(data.entries.flatMap(entry => (entry.sections || []).flatMap(section => (section.catalog || []).map(reference => typeof reference === 'string' ? reference : reference.id))));
assert.equal(used.size, catalogue.length, 'every documented item is reachable from a page');

// Check exact asset casing as well as existence for case-sensitive web hosting.
for (const item of catalogue) {
  const assets = [item.image, ...[...(item.preview || '').matchAll(/url\(([^)]+)\)/g)].map(match => match[1])].filter(Boolean);
  for (const asset of assets) {
    let directory = root;
    for (const component of asset.split('/')) {
      assert.ok(fs.readdirSync(directory).includes(component), 'Asset spelling/case: ' + asset);
      directory = path.join(directory, component);
    }
  }
}
// Folder audit catches artwork outside the primary reward arrays (for example,
// creator codes, old login rewards, and leaderboard portraits).
const documentedAssets = new Set(catalogue.flatMap(item => [item.image, ...[...(item.preview || '').matchAll(/url\(([^)]+)\)/g)].map(match => match[1])].filter(Boolean)));
function auditArtwork(directory) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const relative = directory + '/' + entry.name;
    if (entry.isDirectory()) auditArtwork(relative);
    else if (/\.(png|jpe?g|webp|svg)$/i.test(entry.name)) assert.ok(documentedAssets.has(relative), 'Uncatalogued collection artwork: ' + relative);
  }
}
for (const directory of ['images/pfp', 'images/levelPfp', 'images/codePfp', 'images/cratePfp', 'images/loginPfp', 'images/leaderPfp', 'images/WheelPfp', 'images/SharkPass2', 'images/lostTreasure/Pfp', 'images/profileThemes']) auditArtwork(directory);
const html = read('wiki.html');
assert.ok(html.indexOf('Wiki/wiki-data.js') < html.indexOf('Wiki/wiki-cosmetics.js'));
assert.ok(html.indexOf('Wiki/wiki-cosmetics.js') < html.indexOf('Wiki/wiki.js'));
assert.ok(html.includes('Wiki/wiki-cosmetics.css'));
console.log(`Wiki checks passed: every one of ${data.entries.length} articles renders, all 17 categories have content, pagination/search/table filters work, and species/cosmetic records and artwork match the game.`);
