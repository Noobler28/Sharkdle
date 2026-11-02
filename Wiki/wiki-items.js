/* Named cosmetic and crate articles share the canonical catalogue records. */
(() => {
  const wiki = window.SHARKDLE_WIKI;
  const items = wiki.cosmetics || [];
  const cosmetics = items.filter(item => item.kind !== 'Utility item');
  const titleCase = value => value[0].toUpperCase() + value.slice(1);
  const rarityLabel = rarity => ({ core: 'Starter', code: 'Code' })[rarity] || titleCase(rarity);
  const duplicateXP = { common: 40, rare: 85, epic: 160, legendary: 320 };
  const crateGuide = wiki.entries.find(entry => entry.id === 'crates');
  const pools = (crateGuide?.sections || []).filter(section => section.catalog);
  const crateId = title => 'crate-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/g, '');
  const poolName = title => title.split(' — ')[0];
  const itemId = item => 'cosmetic-' + item.id;
  const sources = {
    'Starter portraits': ['Available immediately', 'The starter portraits are available without opening a crate or earning a pass reward. Choose one in the Portraits section of your Locker.'],
    'Shark Pass 2': ['Season progress', 'This is part of the Shark Pass 2 season track. Earn the required season XP and reach the reward’s listed level. Overall account level is a separate number, so an older account does not automatically satisfy a current season milestone.'],
    'Shark Pass 1 portraits': ['Account-level reward', 'These older portraits are still recognised through account-level progression. They are labelled Shark Pass 1 in the collection, but their present portrait unlock is based on account level, unlike retired Pass 1 badges and themes.'],
    'Cosmetic Crate 2': ['Current standard crate', 'The standard Cosmetic Crate uses the Cosmetic Crate 2 reward pool. It first rolls a rarity, then selects equally among the rewards in that rarity. Owning this cosmetic does not remove it from future rolls.'],
    'Cosmetic Crate 1': ['Original crate collection', 'This cosmetic belongs to the original standard crate collection. That pool has retired: current standard openings use Cosmetic Crate 2. An alternative achievement route, where one exists, is listed in the obtainment rather than implied by the retired crate label.'],
    'Halloween Crate': ['Seasonal crate', 'New Halloween Crates are tied to the globally enabled Halloween event. During that event, the seasonal crafting route exchanges two standard crates for one Halloween Crate, and the event crate costs 750 pearls in the Pearl Shop. Previously owned Halloween Crates can be opened outside the event.'],
    'Christmas Crate': ['Seasonal crate', 'New Christmas Crates depend on the globally enabled Christmas event. The seasonal recipe exchanges two standard crates for one Christmas Crate, and the Pearl Shop sells the active event crate for 750 pearls. Changing your own site appearance does not enable the event.'],
    'Summer Crate': ['Retired seasonal collection', 'Summer Crates are retired. This entry records a historical reward, not a possible result from the current standard crate. Old Summer Crate balances use a two-to-one conversion into standard crates, with the Summer balance cleared.'],
    'Code portraits': ['Code reward', 'The code must be recognised by the game and claimed while signed in. Each recognised code is claimable once per account. A portrait unlock is separate from the XP or pearls included in the same code reward. Retired code promotions are identified in the availability notes.'],
    'Login, wheel and leaderboard portraits': ['Activity reward', 'This portrait has its own activity requirement. Login cycles, the daily win wheel and leaderboard placements are separate systems; it is not added to a standard crate simply because it is a profile picture.'],
    'Lost Treasures': ['Collection grand reward', 'The grand reward requires the complete Lost Treasures album, followed by claiming the completion reward. Finishing one ten-scroll set does not award the grand prize. Both portraits and the Treasure Keeper badge belong to that final reward.'],
    'Starter and special badges': ['Special requirement', 'Read the individual obtainment carefully. This group includes a default badge, restricted or retired role rewards, random prizes and unusual gameplay conditions. A shared category does not mean the badges have the same unlock route.'],
    'Achievement badges': ['Achievement claim', 'Meet the named achievement requirement and claim the achievement reward. The badge’s rarity and the achievement’s own rarity are separate labels. The badge is equipped from the Locker after it has been unlocked.'],
    'Retired pass badges': ['Historical season reward', 'This badge belongs to a retired pass collection. Its original level is preserved for reference. Reaching the same number in a different season does not award the retired badge.'],
    'Community boss badges': ['Unavailable boss reward', 'The badge is listed as a community boss reward, but the community boss display is disabled in this version. A historical boss schedule is not an active claim route. It is included here so an older badge can still be identified.'],
    'Starter theme': ['Default appearance', 'Starter Blue is the default profile card background. It is available without a crate opening or an achievement claim. A profile theme is separate from seasonal site decoration.'],
    'Achievement themes': ['Achievement claim', 'Complete and claim the matching achievement. The theme changes the background of the profile card; the achievement may also award points or XP under its own rules.'],
    'Daily win wheel theme': ['Wheel reward', 'Sign in and win a Daily or Infinite game to unlock the normal wheel spin for the local day. The theme is one possible wheel result. Repeated wins do not stack unlimited normal spins.'],
    'Retired pass themes': ['Historical season reward', 'This background is retained as part of the retired Shark Pass 1 collection. Its original level identifies where it came from, rather than a current Shark Pass 2 unlock requirement.']
  };
  const rarityRows = pool => {
    const refs = pool.catalog.map(reference => typeof reference === 'string' ? { id: reference } : reference);
    return refs.map(reference => {
      const item = items.find(item => item.id === reference.id);
      return [{ text: item.name, article: item.kind === 'Utility item' ? 'streak-shields' : itemId(item) }, item.kind, rarityLabel(item.rarity), reference.chance || 'Retired pool', item.availability];
    });
  };
  for (const pool of pools) {
    const name = poolName(pool.title);
    const retired = /retired/.test(pool.title);
    const seasonal = /Halloween|Christmas/.test(name);
    const list = pool.catalog.map(reference => items.find(item => item.id === (typeof reference === 'string' ? reference : reference.id)));
    const kindCounts = ['Portrait', 'Badge', 'Profile theme', 'Utility item'].map(kind => `${list.filter(item => item.kind === kind).length} ${kind.toLowerCase()}${list.filter(item => item.kind === kind).length === 1 ? '' : 's'}`).filter(line => !line.startsWith('0 '));
    const entry = {
      id: crateId(name), category: 'Cosmetics', title: name, kind: 'reference',
      summary: `${name} is ${retired ? 'a retired reward collection' : seasonal ? 'a seasonal reward crate' : 'the current reward collection used by the standard Cosmetic Crate'}. Its ${list.length} rewards include ${kindCounts.join(', ')}.`,
      icon: /Halloween/.test(name) ? '🎃' : /Christmas/.test(name) ? '🎁' : /Summer/.test(name) ? '☀️' : '📦',
      facts: [['Type', 'Reward crate / collection'], ['Availability', retired ? 'Retired' : seasonal ? 'Enabled global event required for new crates' : 'Available'], ['Reward entries', String(list.length)], ['Rewards per opening', 'One'], ['Standard rarity roll', retired ? 'Historical collection' : '58% Common · 28% Rare · 10% Epic · 4% Legendary'], ['Legendary guarantee', retired ? 'No current opening route' : 'By the 25th consecutive opening without one'], ['Crafting cost', seasonal ? '2 standard Cosmetic Crates' : 'Not a seasonal crafting output'], ['Pearl Shop', retired ? 'Not a current shop crate' : seasonal ? '750 pearls while enabled' : '500 pearls for the standard crate']],
      related: ['crates', 'all-cosmetics', 'pearl-shop'],
      sections: [
        { title: 'Overview', text: [...pool.text, name === 'Cosmetic Crate 2' ? 'The inventory button still calls the container Cosmetic Crate. The “2” identifies the updated reward collection, rather than a separate second standard crate that you choose when opening. Saving a standard crate does not preserve access to the original collection.' : retired ? 'The reward table remains useful for identifying older collections. It should not be used as the drop list for an opening that now draws from a different crate.' : 'The crate keeps its own collection. A seasonal event does not turn ordinary win drops into this crate; you need the specific seasonal obtainment route.'] },
        { title: 'Obtainment and availability', text: [name === 'Cosmetic Crate 2' ? 'Eligible Daily and Infinite wins by signed-in players have a 50% chance to award a standard crate. Other routes include the 500-pearl shop purchase, the daily win wheel and eligible sharing or referral rewards. These routes give unopened crates rather than a selected cosmetic.' : seasonal ? sources[name][1] : name === 'Summer Crate' ? 'Summer is retired. Every pair of old Summer Crates converts to one standard Cosmetic Crate, with the old Summer balance cleared. An odd leftover does not round up to another standard crate.' : 'Cosmetic Crate 1 is no longer the active standard reward pool. Its cosmetic records list any alternative obtainment individually; Volcanic Ember, for example, has an achievement route.', 'Opening spends one crate and gives one result. Use the reward preview before spending it if you are collecting a particular theme, portrait or badge.'] },
        { title: 'Complete reward table', table: { caption: name + ' rewards', columns: ['Reward', 'Type', 'Rarity', 'Ordinary individual chance', 'Item availability'], rows: rarityRows(pool) } },
        ...(!retired ? [
          { title: 'How the odds work', text: ['The rarity roll happens first. The stated 58%, 28%, 10% and 4% apply to Common, Rare, Epic and Legendary tiers, not to each named item. The game then chooses equally among that tier’s rewards.', `This pool has ${list.filter(item => item.rarity === 'epic').length} Epic rewards. On a normal 10% Epic roll, each therefore has a ${Number((10 / list.filter(item => item.rarity === 'epic').length).toFixed(2))}% ordinary chance. A guaranteed Legendary opening uses a different first step and is not covered by those normal per-item percentages.`] },
          { title: 'Duplicates and the guarantee', text: ['An owned portrait, badge or theme can be rolled again. Its duplicate gives base XP by rarity: Common 40, Rare 85, Epic 160 and Legendary 320. An active XP event can increase the award. Owning an item does not remove it from the pool.', 'The Legendary counter is shared across current crate types. After 24 openings without a Legendary, the next opening guarantees that rarity. It can still be a duplicate, and any Legendary resets the counter. The guarantee cannot be saved up to select a particular item.'] }
        ] : []),
        { title: 'Collection advice', text: [retired ? 'Treat this page as a collection record. Check the full article for an item before assuming it is permanently unobtainable, because an achievement may provide an alternative even when the crate route is retired.' : seasonal ? 'Craft for the collection you want, rather than because an event crate automatically has better odds. Two standard crates buy one seasonal opening: that trades two results from one collection for one result from another. The rarity weights themselves are the same.' : 'Before chasing an Epic or Legendary theme through random openings, check whether its achievement route is a realistic goal. Neon Reef and Lunar Current have such routes. That can make a direct target more useful than hoping for the right result from a rarity tier.'] }
      ]
    };
    wiki.entries.push(entry);
    pool.links = [{ label: 'Read the ' + name + ' article', article: entry.id }];
  }
  for (const item of cosmetics) {
    const source = sources[item.group];
    const pool = pools.find(pool => poolName(pool.title) === item.group);
    const poolReference = pool?.catalog.find(reference => (typeof reference === 'string' ? reference : reference.id) === item.id);
    const chance = typeof poolReference === 'object' ? poolReference.chance : '';
    const similar = cosmetics.filter(other => other.kind === item.kind && other.name === item.name && other.id !== item.id);
    const notes = item.notes || '';
    const triviaIndex = notes.indexOf('Trivia:');
    const practicalNotes = triviaIndex >= 0 ? notes.slice(0, triviaIndex).trim() : notes;
    const trivia = triviaIndex >= 0 ? notes.slice(triviaIndex + 7).trim() : '';
    const catalogue = item.kind === 'Portrait' ? 'cosmetic-portraits' : item.kind === 'Badge' ? 'cosmetic-badges' : 'cosmetic-themes';
    const entry = {
      id: itemId(item), category: 'Cosmetics', title: `${item.name} (${item.kind.toLowerCase()})`, kind: 'reference',
      summary: `${item.name} is ${/^[aeiou]/i.test(rarityLabel(item.rarity)) ? 'an' : 'a'} ${rarityLabel(item.rarity)} ${item.kind.toLowerCase()} from ${item.group}. ${item.obtainment}`,
      facts: [['Type', item.kind], ['Rarity', rarityLabel(item.rarity)], ['Collection', item.group], ['Availability', item.availability], ['Obtainment', item.obtainment], ...(chance ? [['Ordinary drop chance', chance], ['Duplicate base XP', String(duplicateXP[item.rarity]) + ' XP']] : []), ['Gameplay effect', 'Profile appearance only']],
      ...(item.image ? { image: { src: item.image, alt: item.name + ' portrait', caption: item.group + ' portrait artwork' } } : {}),
      ...(item.emoji ? { icon: item.emoji } : {}), ...(item.preview ? { preview: item.preview } : {}),
      related: [catalogue, 'all-cosmetics', ...(pool ? [crateId(poolName(pool.title)), 'crates'] : item.group === 'Shark Pass 2' ? ['shark-pass'] : item.group === 'Lost Treasures' ? ['lost-treasures-rewards'] : item.group === 'Code portraits' ? ['codes'] : [])],
      sections: [
        { title: 'Obtainment', text: [item.obtainment, source?.[1], practicalNotes].filter(Boolean) },
        ...(chance ? [{ title: 'Drop chance and duplicate reward', text: [`The ordinary chance for this item is ${chance}. That figure comes from the rarity weight divided by the number of rewards in the same rarity tier of this crate. It is not the chance on a guaranteed Legendary roll.`, `If you already own this ${item.kind.toLowerCase()}, another crate result converts into ${duplicateXP[item.rarity]} base XP. It does not add a second equippable copy. The crate still counts as an opening, and a Legendary result resets the shared Legendary guarantee counter whether it is new or a duplicate.`] }] : []),
        { title: 'Equipping', text: [`Open your profile, choose Locker, then select ${item.kind === 'Portrait' ? 'Portraits' : item.kind === 'Badge' ? 'Badges' : 'Themes'}. Once this reward is unlocked, select ${item.name} to equip it in that slot. You can combine it with cosmetics from other collections.`, item.kind === 'Profile theme' ? 'This changes the profile card background. It is separate from the seasonal site appearance and does not enable a crate event or a seasonal RNG mutation.' : item.kind === 'Badge' ? 'The badge displays its symbol on the profile. Its name, rarity and obtainment identify the reward; they do not add luck, improve guessing feedback or alter crate odds.' : 'The portrait changes the profile picture. Unlocking it does not change the species available in a guessing pool or increase the chance of rolling that species in SharkRNG.'] },
        ...(similar.length ? [{ title: 'Other versions with the same name', text: ['These are separate cosmetic unlocks with different artwork or collection sources. Owning one version does not mean the other version is unlocked.'], table: { caption: 'Other ' + item.name + ' cosmetics', columns: ['Version', 'Collection', 'Availability'], rows: similar.map(other => [{ text: other.name, article: itemId(other) }, other.group, other.availability]) } }] : []),
        ...(trivia ? [{ title: 'Trivia', text: [trivia[0].toUpperCase() + trivia.slice(1)], links: [{ label: 'Music and game references behind the badges', article: 'badge-references' }] }] : [])
      ]
    };
    wiki.entries.push(entry);
  }
})();
