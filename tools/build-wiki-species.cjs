// Refresh the wiki's compact public species reference. Does not modify game data.
const fs = require('node:fs');
const path = require('node:path');
const { reader } = require('./wiki-sources.cjs');
process.chdir(path.resolve(__dirname, '..'));
const rng = reader('Minigames/SharkRNG/rng-mode.js');
for (const name of ['ENDGAME_CATCH_DEFS', 'TIERS', 'TIER_ORDER', 'TIER_RANK']) rng.get(name);
for (const name of ['hashString', 'computeRarityScore', 'scoreToTierName', 'getTierOneInFloor', 'buildOneIn', 'tierNameFromOneIn', 'getTierMeta']) rng.fn(name);
const records = [];
for (const [file, key, pool] of [['sharks.js', 'sharks', 'Sharks'], ['rays.js', 'rays', 'Relatives']]) {
  for (const species of reader(file).get(key)) {
    if (!['name', 'family', 'order', 'genus'].every(field => typeof species[field] === 'string' && species[field].trim() && species[field].trim().toLowerCase() !== 'unknown')) continue;
    const scoreTier = rng.context.scoreToTierName(rng.context.computeRarityScore(species));
    const rating = rng.context.buildOneIn(species, scoreTier, rng.context.getTierMeta(scoreTier));
    records.push({ name: species.name, pool, order: species.order, family: species.family, genus: species.genus, size: species.size, depth: species.depth, year: species.yod, rngRating: rating, rngTier: rng.context.tierNameFromOneIn(rating) });
  }
}
const names = new Set();
for (const record of records) {
  if (names.has(record.name)) throw Error('Duplicate species name: ' + record.name);
  names.add(record.name);
}
const file = 'Wiki/wiki-species-data.js';
const story = reader('Story/story.js');
const areas = story.get('areaDefinitions');
const visualProfiles = story.get('SHARK_VISUAL_PROFILES');
const evidence = story.get('SHARK_EVIDENCE_LINES');
const storyNotes = {};
for (const name of new Set([...Object.keys(visualProfiles), ...areas.flatMap(area => area.sharks)])) {
  const area = areas.find(area => area.sharks.includes(name));
  storyNotes[name] = { visual: visualProfiles[name] || [], evidence: evidence[name] || [], ...(area ? { chapter: area.name, chapterId: 'story-' + area.id, description: area.speciesDescriptions?.[name] || '' } : {}) };
}
fs.writeFileSync(file, '// Public game reference values. Refresh with node tools/build-wiki-species.cjs.\nwindow.SHARKDLE_WIKI.species = [\n' + records.map(record => '  ' + JSON.stringify(record)).join(',\n') + '\n];\nwindow.SHARKDLE_WIKI.speciesStory = ' + JSON.stringify(storyNotes, null, 2) + ';\n');
console.log(`Updated ${records.length} species: ${records.filter(s => s.pool === 'Sharks').length} sharks and ${records.filter(s => s.pool === 'Relatives').length} relatives.`);
