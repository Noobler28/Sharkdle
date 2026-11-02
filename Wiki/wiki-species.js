/* The species reference uses compact data, then builds linked reference pages.
 * Explanatory text lives here; the game itself is never loaded by the wiki. */
(() => {
  const wiki = window.SHARKDLE_WIKI;
  const species = wiki.species || [];
  const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const speciesId = value => 'species-' + slug(value);
  const familyId = value => 'species-family-' + slug(value);
  const orderId = value => 'species-order-' + slug(value);
  const families = [...new Set(species.map(item => item.family))].sort();
  const orders = [...new Set(species.map(item => item.order))].sort();
  const sort = list => [...list].sort((a, b) => a.name.localeCompare(b.name));
  const speciesCell = item => ({ text: item.name, article: speciesId(item.name) });
  const table = (caption, list) => ({ caption, searchable: true, columns: ['Species', 'Pool', 'Genus', 'Size', 'Depth', 'Discovery year', 'Base RNG rating', 'RNG tier'], rows: sort(list).map(item => [speciesCell(item), item.pool, item.genus, item.size || 'Unknown', item.depth || 'Unknown', String(item.year ?? 'Unknown'), '1 in ' + Number(item.rngRating).toLocaleString('en-GB'), item.rngTier]) });
  const counts = list => `${list.length} species, ${new Set(list.map(item => item.family)).size} families and ${new Set(list.map(item => item.genus)).size} genera`;
  const common = ['species-guide', 'species-directory', 'taxonomy-clues', 'species-size-depth'];
  wiki.entries.push(
    {
      id: 'species-guide', category: 'Species', title: 'Species guide: how to use the reference', guide: true,
      summary: 'Sharkdle compares recorded characteristics, so knowing how to read a species entry is more useful than trying to memorise a long list of names. This reference covers all 1,244 playable entries.',
      related: common, playUrl: 'Library/index.html',
      sections: [
        { title: 'What is included?', text: ['The Sharks pool contains 540 entries. Relatives adds 704 entries across rays, skates, sawfishes, guitarfishes, chimaeras and other related groups. Combined uses both pools. The directory includes an entry for every playable species, along with family and order pages for comparing them.', 'I use the game’s recorded names and categories throughout this reference. A wiki entry tells you what Sharkdle will compare when you submit that species. It is not a substitute for a scientific species account, and a single size or depth category does not describe every individual or every habitat occupied by that animal.'] },
        { title: 'Reading a species page', text: ['Start with the six comparison fields: order, family, genus, size, depth and discovery year. Order, family and genus describe nested classification groups. Size and depth are categories; the discovery year is a number with a higher-or-lower clue in guessing modes.', 'The pool tells you where the entry can appear. Sharks entries can appear in Sharks or Combined, while Relatives entries can appear in Relatives or Combined. The family link opens a complete comparison table, which is usually the most useful next step after confirming a family clue.'] },
        { title: 'Using the reference during a round', text: ['If a guess matches the target’s family, open that family’s page and compare its genera, sizes, depth categories and discovery years. Use the fields you have already confirmed to remove candidates. A matching size alone is much less restrictive than a matching genus, because many unrelated species share the same size category.', 'The related-species comparison on an individual page starts with its own genus. This is useful when you have found a genus match and need to distinguish close entries. Where a clue does not narrow a group to one answer, treat that as remaining uncertainty rather than assuming the most familiar species must be correct.'] },
        { title: 'What does the RNG rating mean?', text: ['Species pages also list the unmodified SharkRNG rating and its corresponding rarity tier. These values describe the RNG collection system, not how likely the animal is to be a Daily answer or how rare it is in the real ocean.', 'SharkRNG combines species selection, tier weighting, luck, guarantees and mutation effects. A displayed “1 in” rating is not a promise that every roll is a simple independent probability of exactly one divided by that number. Use the RNG luck guide for the mechanics. The ratings here are calculated from the current base roll rules, before player modifiers.'] },
        { title: 'Names and corrections', text: ['Some species have more than one common name. For guessing, select the name offered by the game’s suggestions rather than relying on an alternative name from elsewhere. This reference preserves game spellings so the entries remain searchable.', 'Complete classification is required for an entry to join the playable pools. If species information changes in a future update, the guessing reference and RNG base ratings need to be refreshed together.'] }
      ]
    },
    {
      id: 'taxonomy-clues', category: 'Species', title: 'Order, family and genus: reading classification clues', guide: true,
      summary: 'The three classification clues work together. They tell you whether to keep exploring the same group or make a larger change on your next guess.', related: common,
      sections: [
        { title: 'The hierarchy', text: ['For the groups used in the game, an order contains families, and a family contains genera. A genus contains individual species. These names are not three independent descriptions of the same thing: they are different levels of the classification tree.', 'A correct order can still leave many possibilities. A correct family narrows that order further, while a correct genus is often a much stronger lead. Some genera contain only one playable species; others contain many, so you still need to read the remaining fields.'] },
        { title: 'What to do with each result', bullets: ['Order matches, family does not: stay within the confirmed order, but investigate a different family.', 'Family matches, genus does not: look at other genera in that family. Do not keep repeating guesses from the genus already ruled out.', 'Genus matches: compare the remaining species in that genus using size, depth and discovery year.', 'None matches: the guess has still excluded a branch. Use it to choose a different order if possible rather than another very similar candidate.'] },
        { title: 'A worked example', text: ['Take the genus Chlamydoselachus. The game includes Frilled Shark and Southern African Frilled Shark in it. Both share a genus, family and order, so those clues alone do not distinguish them. Their recorded discovery years do: Frilled Shark is listed as 1884, while Southern African Frilled Shark is listed as 2009.', 'If the first of those guesses produces an upward discovery-year arrow alongside the classification matches, investigate the later entry. The arrow describes the target relative to your guess, not the age of the shark you selected. This is the kind of comparison the family and species tables are designed to make easier.'] },
        { title: 'Do not turn a non-match into a direction', text: ['A wrong family or genus tells you it is different; it does not say the correct one is alphabetically earlier, taxonomically “higher”, or more closely related to the previous guess. Only use the information the game actually gives.', 'If you are uncertain where a genus belongs, check its family page or use the Sharchive. Guessing a name you recognise can be a useful first step, but the follow-up should be guided by the recorded results.'] }
      ]
    },
    {
      id: 'species-size-depth', category: 'Species', title: 'Size and depth categories', guide: true,
      summary: 'Size and depth are matching categories in Sharkdle. Knowing their labels makes the results easier to read, but a wrong category does not give the same directional clue as discovery year.', related: common,
      sections: [
        { title: 'Size bands', text: ['The game divides size into Tiny, Small, Medium, Large and Giant. The guide ranges below explain the labels used by the game. Read the category assigned to an entry rather than trying to calculate a fresh category from a different measurement.'], table: { caption: 'Size labels used by Sharkdle', columns: ['Category', 'Guide range'], rows: [['Tiny', '0–3 feet'], ['Small', '3–6 feet'], ['Medium', '6–10 feet'], ['Large', '10–20 feet'], ['Giant', '20+ feet']] } },
        { title: 'Depth bands', text: ['Epipelagic, Mesopelagic and Bathypelagic are depth-zone labels. The game assigns one category to a species for the matching clue; this should not be read as a claim that it never moves into another depth range.'], table: { caption: 'Depth labels', columns: ['Category', 'Guide range'], rows: [['Epipelagic', '0–200 metres'], ['Mesopelagic', '200–1,000 metres'], ['Bathypelagic', '1,000–4,000 metres']] } },
        { title: 'Using these clues', text: ['A matching size or depth is a filter, not a species identification on its own. Many species in different orders can be Small and Epipelagic. Combine those matches with the classification clues before committing to a narrow group.', 'A size or depth non-match tells you the category differs. It does not say “bigger”, “smaller”, “deeper” or “shallower”. The discovery-year arrow is different: it explicitly tells you whether the target’s recorded year is later or earlier.'] },
        { title: 'Why a familiar species may surprise you', text: ['Common names often bring a mental image of a large adult, a photograph, or a particular habitat. Sharkdle uses a compact record for each species instead. When your expectation and the recorded category differ, use the recorded value for the puzzle.', 'The species directory and Sharchive give you a way to check the values without needing to remember every category. Learning the differences between nearby entries is more useful than assuming every member of a family shares a size or depth.'] }
      ]
    },
    {
      id: 'species-directory', category: 'Species', title: 'Complete species directory', kind: 'reference',
      summary: `${species.length} playable species across ${families.length} families and ${orders.length} orders. Every name opens its own reference page; the order and family indexes lead to full comparison tables.`, related: common,
      sections: [
        { title: 'Order index', table: { caption: 'Every order in the guessing pools', columns: ['Order', 'Species', 'Families'], rows: orders.map(order => [{ text: order, article: orderId(order) }, String(species.filter(item => item.order === order).length), String(new Set(species.filter(item => item.order === order).map(item => item.family)).size)]) } },
        { title: 'Family index', table: { caption: 'Every family in the guessing pools', searchable: true, columns: ['Family', 'Order', 'Species'], rows: families.map(family => { const list = species.filter(item => item.family === family); return [{ text: family, article: familyId(family) }, list[0].order, String(list.length)]; }) } },
        { title: 'All sharks', table: table('All 540 Sharks entries', species.filter(item => item.pool === 'Sharks')) },
        { title: 'All relatives', table: table('All 704 Relatives entries', species.filter(item => item.pool === 'Relatives')) }
      ]
    }
  );
  for (const order of orders) {
    const list = species.filter(item => item.order === order);
    const orderFamilies = [...new Set(list.map(item => item.family))].sort();
    wiki.entries.push({
      id: orderId(order), category: 'Species', title: order + ': order reference', kind: 'reference',
      facts: [['Classification', 'Order'], ['Playable species', String(list.length)], ['Families', String(orderFamilies.length)], ['Genera', String(new Set(list.map(item => item.genus)).size)]],
      summary: `${order} contains ${counts(list)} in Sharkdle. Use this page when the order clue matches but the family is still unknown.`,
      related: ['species-directory', 'taxonomy-clues'],
      sections: [
        { title: 'Comparing this order', text: [`A matching ${order} order clue keeps the species below in consideration. A wrong family does not rule out the whole order: move to another family within this list and compare the remaining clues.`, 'The tables record game comparison values. Follow a family link for a narrower list, or a species name to see its individual record.'], table: { caption: 'Families in ' + order, columns: ['Family', 'Playable species'], rows: orderFamilies.map(family => [{ text: family, article: familyId(family) }, String(list.filter(item => item.family === family).length)]) } },
        { title: 'Complete species list', table: table(order + ' species', list) }
      ]
    });
  }
  for (const family of families) {
    const list = species.filter(item => item.family === family);
    const genera = [...new Set(list.map(item => item.genus))].sort();
    wiki.entries.push({
      id: familyId(family), category: 'Species', title: family + ': family reference', kind: 'reference',
      facts: [['Classification', 'Family'], ['Order', { text: list[0].order, article: orderId(list[0].order) }], ['Playable species', String(list.length)], ['Genera', String(genera.length)]],
      summary: `${family} has ${list.length} playable species across ${genera.length} genera, in the order ${list[0].order}. Compare every entry here after confirming a family clue.`,
      related: [orderId(list[0].order), 'taxonomy-clues', 'species-directory'],
      sections: [
        { title: 'Using a family match', text: [`If your guess matches ${family}, use the genus clue to decide which part of the table to explore. The same family does not mean every size, depth or discovery year will match.`, genera.length === 1 ? `All playable members of this family use the genus ${genera[0]}. In this group, size, depth and discovery year are the fields to compare next.` : `There are ${genera.length} genera represented here. A wrong genus eliminates that genus from the current target without eliminating the rest of the family.`] },
        { title: 'Full family comparison', table: table(family + ' species', list) }
      ]
    });
  }
  for (const item of species) {
    const siblings = species.filter(other => other.genus === item.genus && other.family === item.family);
    const peers = siblings.filter(other => other.name !== item.name);
    const identical = peers.filter(other => ['order', 'family', 'genus', 'size', 'depth', 'year'].every(field => item[field] === other[field]));
    const notes = wiki.speciesStory?.[item.name];
    const illustration = (wiki.cosmetics || []).find(cosmetic => cosmetic.kind === 'Portrait' && cosmetic.name === item.name && cosmetic.image);
    const values = [
      ['Pool', item.pool + ' and Combined'], ['Order', { text: item.order, article: orderId(item.order) }], ['Family', { text: item.family, article: familyId(item.family) }], ['Genus', item.genus], ['Size category', item.size || 'Unknown'], ['Depth category', item.depth || 'Unknown'], ['Discovery year', String(item.year ?? 'Unknown')], ['SharkRNG base rating', '1 in ' + Number(item.rngRating).toLocaleString('en-GB')], ['SharkRNG base tier', item.rngTier]
    ];
    wiki.entries.push({
      id: speciesId(item.name), category: 'Species', title: item.name, kind: 'reference',
      facts: values,
      ...(illustration ? { image: { src: illustration.image, alt: item.name + ' profile artwork', caption: 'Profile artwork from ' + illustration.group + '. The portrait is a separate cosmetic unlock.' } } : {}),
      summary: `${item.name} is a ${item.pool} pool entry in ${item.genus}, family ${item.family}. Its guessing categories are ${item.size || 'Unknown'} size and ${item.depth || 'Unknown'} depth, with ${item.year ?? 'an unknown year'} recorded as its discovery year.`,
      playUrl: 'Library/index.html?search=' + encodeURIComponent(item.name) + '&species=' + encodeURIComponent(item.name),
      playLabel: 'Find in the Sharchive', related: [familyId(item.family), orderId(item.order), 'species-guide', ...(notes?.chapterId ? [notes.chapterId] : [])],
      sections: [
        { title: 'In the guessing game', text: [`${item.name} can be a target or a guess in ${item.pool} and Combined rounds. Its order, family and genus are classification matches; its ${item.size || 'Unknown'} size and ${item.depth || 'Unknown'} depth are category matches. The discovery year ${item.year ?? 'is unknown and therefore'} belongs to the year clue, which can give an earlier-or-later direction.`, identical.length ? `${identical.length} other playable ${identical.length === 1 ? 'entry shares' : 'entries share'} all six recorded clue values with ${item.name}: ${identical.map(other => other.name).join(', ')}. Matching every characteristic is therefore not the same as submitting the exact target name. The final species-name check still matters.` : peers.length ? `There are ${peers.length} other playable species in this genus to compare. The recorded non-classification fields can help distinguish them, but keep every confirmed clue in view rather than choosing a familiar name alone.` : 'It is the only playable member of this genus within its family. That makes a genus match particularly restrictive in the current species list.'] },
        ...(notes?.chapterId ? [{ title: 'Story appearance', text: [`${item.name} has a dossier in ${notes.chapter}. ${notes.description}`, 'The campaign tests whether an observed animal fits the current dossier. Read the sighting description before answering: a broadly similar shark is not automatically the species named by the mission. Completing its three tasks contributes to the chapter’s boss unlock.'], links: [{ label: notes.chapter + ' walkthrough', article: notes.chapterId }] }] : []),
        ...(notes?.visual?.length ? [{ title: 'Visual clues used in Story Mode', text: ['These are recognition details used by the Story sighting system. They describe what the observer sees in that activity; they are separate from the six numerical and classification fields used in ordinary guessing rounds.'], bullets: notes.visual.map(line => line[0].toUpperCase() + line.slice(1) + '.') }] : []),
        ...(notes?.evidence?.length ? [{ title: 'Sighting evidence', bullets: notes.evidence.map(line => line[0].toUpperCase() + line.slice(1) + '.') }] : []),
        { title: 'Comparing this entry', text: [siblings.length === 1 ? `${item.name} is the only playable species in its genus within this family. A matching genus is therefore a strong lead for this entry; check the full result to confirm the answer.` : `${siblings.length} playable entries share this genus within ${item.family}. Classification matches alone may not distinguish them. Compare the size, depth and discovery year in the table below.`, 'The RNG rating belongs to SharkRNG and is separate from the Daily or Infinite target selection. Luck, potion guarantees and mutations can change an RNG result; the base rating is not a literal promise of a fixed per-roll chance.'], ...(siblings.length > 1 ? { table: table('Other playable entries in ' + item.genus, siblings) } : {}) }
      ]
    });
  }
})();
