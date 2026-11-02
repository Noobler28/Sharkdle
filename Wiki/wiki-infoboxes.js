/* Overview infoboxes complement the item-specific records in each content file. */
(() => {
  const wiki = window.SHARKDLE_WIKI;
  const facts = {
    'rng-overview': [['Activity', 'Species and mutation collection'], ['Species', '1,244'], ['Rarity tiers', '33'], ['Mutation definitions', '244 (238 enabled, 6 disabled Christmas variants)'], ['Potion types', '24'], ['Coin upgrade tracks', '15'], ['Prestige upgrades', '35'], ['Main currencies', 'RNG coins · RNG XP · prestige resources']],
    'rng-luck': [['System', 'SharkRNG roll selection'], ['Reference rating', 'Different from literal per-roll probability'], ['Luck sources', 'Upgrades · equipment · rank · potions · prestige · collection rewards'], ['Guarantees', 'Read the potion or roll condition individually']],
    'rng-tiers': [['Type', 'Rarity reference'], ['Named tiers', '33'], ['Ordinary ladder', 'Common through Omniversal'], ['Extended tiers', '8 endgame tiers'], ['Used by', 'SharkRNG collection and rating displays']],
    'rng-upgrades': [['Currency', 'RNG coins'], ['Visible tracks', '15'], ['Listed purchase levels', '2,280'], ['Persistence', 'See the prestige reset rules'], ['Full data', 'Individual track articles and searchable level tables']],
    'rng-potions': [['Item system', 'Consumable rolling effects'], ['Potion types', '24'], ['Duration', 'Listed in charges / rolls, with item-specific rules'], ['Sources', 'Shop · quests · index rewards · certain permanent upgrades']],
    'rng-potion-catalogue': [['Type', 'Potion reference'], ['Potion articles', '24'], ['Comparison fields', 'Cost · charges · effect · category'], ['Important distinction', 'A roll action can produce several results']],
    'rng-prestige': [['Activity', 'SharkRNG'], ['Base reward', '5 tokens per prestige'], ['Permanent upgrade types', '35'], ['Purchase levels', '171'], ['Main decision', 'Reset a run for longer-term progression'], ['Before resetting', 'Check trial requirements and persistence rules']],
    'rng-prestige-upgrades': [['Currency', 'Prestige tokens'], ['Upgrade types', '35'], ['Listed purchase levels', '171'], ['Costs', 'Per-level and cumulative costs in the individual articles']],
    'rng-index': [['Collection', 'Base species and enabled mutation variants'], ['Base species', '1,244'], ['Index reward milestones', '297'], ['Completion target', 'Depends on the current species and enabled variants']],
    'rng-index-rewards': [['Type', 'Collection milestone reference'], ['Milestones', '297'], ['Rewards', 'Luck bonuses and consumables, as listed'], ['Completion count', 'Dynamic; do not use an old fixed placeholder']],
    'mutations': [['Activity', 'SharkRNG'], ['Defined variants', '244'], ['Enabled variants', '238'], ['Disabled variants', '6 Christmas variants'], ['Current maximum per result', '1 mutation'], ['Collection identity', 'Species plus mutation']],
    'mutation-catalogue': [['Type', 'Mutation reference'], ['Definitions', '244'], ['Individual articles', '244'], ['Images', 'Existing game mutation artwork'], ['Availability', 'Enabled and disabled variants are distinguished']],
    'mutation-seasonal': [['Enabled seasons', 'Summer · Halloween'], ['Disabled season', 'Christmas'], ['Variants per season', '6'], ['Separate system', 'Cosmetic seasonal crates follow different event controls']],
    'cosmetics': [['Types', 'Portrait · badge · profile theme'], ['Total cosmetics', '152'], ['Portraits', '62'], ['Badges', '61'], ['Themes', '29'], ['Equipping', 'Profile → Locker'], ['Utility items', 'Streak Shields are separate from cosmetics']],
    'all-cosmetics': [['Catalogue', 'All current and historical profile cosmetics'], ['Total records', '152'], ['Portraits', '62'], ['Badges', '61'], ['Profile themes', '29'], ['Default filter', 'All rarities and availability']],
    'cosmetic-portraits': [['Cosmetic type', 'Profile picture'], ['Portraits', '62'], ['Equipping', 'Profile → Locker → Portraits'], ['Different artwork', 'Separate collection unlocks']],
    'cosmetic-badges': [['Cosmetic type', 'Profile symbol'], ['Badges', '61'], ['Equipping', 'Profile → Locker → Badges'], ['Trivia', { text: 'Music and game references', article: 'badge-references' }]],
    'cosmetic-themes': [['Cosmetic type', 'Profile card background'], ['Themes', '29'], ['Equipping', 'Profile → Locker → Themes'], ['Separate from', 'Seasonal site appearance']],
    'crates': [['Reward collections', '5, including retired pools'], ['Current standard pool', { text: 'Cosmetic Crate 2', article: 'crate-cosmetic-crate-2' }], ['Normal rarity weights', '58% Common · 28% Rare · 10% Epic · 4% Legendary'], ['Legendary guarantee', '25 openings maximum without a Legendary'], ['Seasonal recipe', '2 standard crates → 1 enabled seasonal crate'], ['Duplicates', 'Base XP by cosmetic rarity']],
    'species-guide': [['Playable species', '1,244'], ['Sharks', '540'], ['Relatives', '704'], ['Families', '64'], ['Orders', '13'], ['Reference scope', 'Recorded game values']],
    'species-directory': [['Type', 'Playable species reference'], ['Species', '1,244'], ['Families', '64'], ['Orders', '13'], ['Every name', 'Links to an individual species article']],
    'taxonomy-clues': [['Hierarchy', 'Order → family → genus → species'], ['Matching rule', 'Recorded group equality'], ['Strongest named group', 'Genus'], ['Caveat', 'Some species still share all six clues']],
    'species-size-depth': [['Size categories', 'Tiny · Small · Medium · Large · Giant'], ['Depth categories', 'Epipelagic · Mesopelagic · Bathypelagic'], ['Feedback', 'Category matching'], ['Directional arrow', 'Discovery year only']],
    'minigames-status': [['Additional playable activities', 'SharkRNG · Shark Rescue Command'], ['Separate campaign', 'Story Mode'], ['Not implemented', 'Shark Cards · Shark Slots · Shark Incremental · Shark Lagoon · Shivers']],
    'settings-and-accessibility': [['Location', 'Profile → Settings'], ['Fun Mode default', 'Off'], ['Sound effects default', 'On'], ['Background audio default', 'Off'], ['Background volume default', '35%'], ['Crate presentation', 'Instant reveal option']],
    'badge-references': [['References covered', '3 badges'], ['Songs', 'Rollin’ · I’m Not Okay (I Promise)'], ['Game', 'The Elder Scrolls V: Skyrim'], ['Effect', 'Trivia; unlock rules remain separate']]
  };
  for (const [id, rows] of Object.entries(facts)) {
    const entry = wiki.entries.find(entry => entry.id === id);
    if (entry && !entry.facts?.length) entry.facts = rows;
  }
})();
