(function () {
    'use strict';
    const categories = [
        { key: 'modes', label: 'Game Modes', icon: 'fa-gamepad' },
        { key: 'sharchive', label: 'Sharchive', icon: 'fa-book-open' },
        { key: 'sharkpass', label: 'Shark Pass', icon: 'fa-ticket' },
        { key: 'collection', label: 'Cosmetics', icon: 'fa-palette' },
        { key: 'events', label: 'Events', icon: 'fa-calendar-days' }
    ];
    const definitions = [];
    function tiers(category, source, field, targets, names, description, icon, points = [40, 90, 175, 300]) {
        targets.forEach((target, i) => definitions.push({
            id: `explore_${source}_${field}_${target}`, name: names[i], description: description(target),
            icon, points: points[Math.min(i, points.length - 1)], category,
            metric: `corner:${source}:${field}`, milestone: target,
            ...(source === 'rescue' ? { hiddenUntilSecret: true } : {})
        }));
    }
    function event(id, category, name, description, icon, points = 50) {
        definitions.push({ id, category, name, description, icon, points });
    }
    tiers('sharchive', 'library', 'favorites', [1, 5, 10, 25], ['A Favourite Fin', 'Reef Favourites', 'Personal Aquarium', 'Sharchive Curator'], n => `Favourite ${n} different species in the Sharchive`, '❤️');
    tiers('sharchive', 'library', 'recent', [1, 10, 20], ['A Closer Look', 'Species Researcher', 'Deep Research'], n => `Have ${n} different species in your recently viewed Sharchive list`, '🔎');
    tiers('worldmap', 'story', 'tasks', [10, 25, 50, 72], ['Archive Apprentice', 'Field Researcher', 'Archive Restorer', 'Ocean Archivist'], n => `Complete ${n} World Map species tasks`, '🧩');
    tiers('worldmap', 'story', 'bosses', [1, 4, 8], ['First Showdown', 'Current Breaker', 'Boss of the Oceans'], n => `Defeat ${n} World Map region bosses`, '⚔️');
    tiers('worldmap', 'story', 'regions', [4, 8], ['Halfway Around the World', 'World Restored'], n => `Complete ${n} World Map regions`, '🌍', [200, 500]);
    tiers('worldmap', 'story', 'finale', [1], ['The Final Chapter'], () => 'Watch the World Map story finale', '🎬', [250]);
    tiers('rescue', 'rescue', 'totalSaved', [1000, 10000, 100000, 1000000], ['Rescue Crew', 'Sanctuary Builder', 'Ocean Lifeline', 'Million Shark Sanctuary'], n => `Rescue ${n.toLocaleString('en-US')} sharks in Rescue Command`, '🛟');
    tiers('rescue', 'rescue', 'missionsCompleted', [1, 10, 50, 250], ['First Dispatch', 'Mission Ready', 'Command Specialist', 'Rescue Commander'], n => `Complete ${n} Rescue Command missions`, '📡');
    tiers('rescue', 'rescue', 'totalResearchEarned', [100, 1000], ['Research Station', 'Marine Science Institute'], n => `Earn ${n.toLocaleString('en-US')} total research in Rescue Command`, '🔬', [75, 200]);
    tiers('rescue', 'rescue', 'level', [10, 25], ['Command Officer', 'Admiral of the Reef'], n => `Reach Rescue Command level ${n}`, '🎖️', [100, 250]);
    tiers('rescue', 'rescue', 'prestigeCount', [10], ['Renowned Rescuer'], () => 'Prestige 10 times in Rescue Command', '👑', [500]);
    tiers('rescue', 'rescue', 'bestCombo', [1.25, 2], ['Rescue Rhythm', 'Flawless Dispatch'], n => `Reach a ${n}x combo in Rescue Command`, '⚡', [75, 175]);
    tiers('rng', 'rng', 'rolls', [100000, 1000000], ['Endless Casts', 'Million Roll Migration'], n => `Roll ${n.toLocaleString('en-US')} times in Shark RNG`, '🎲', [350, 600]);
    tiers('rng', 'rng', 'prestigeLevel', [25, 50], ['Timeless Hunter', 'Prestige Leviathan'], n => `Prestige ${n} times in Shark RNG`, '👑', [500, 750]);
    tiers('rng', 'rng', 'finds', [10, 50, 100], ['RNG Naturalist', 'Variant Vault', 'Living Encyclopedia'], n => `Collect ${n} different Shark RNG entries`, '📚');
    tiers('rng', 'rng', 'mutatedFinds', [1, 10, 25], ['Something Different', 'Mutation Researcher', 'Mutation Menagerie'], n => `Collect ${n} different mutated Shark RNG entries`, '🧬');
    tiers('rng', 'rng', 'indexClaims', [1, 10], ['Index Payday', 'Index Inspector'], n => `Claim ${n} Shark RNG index rewards`, '📖', [50, 150]);
    tiers('sharkpass', 'profile', 'passLevel', [10, 25, 50], ['Pass Explorer', 'Season Veteran', 'Season Apex'], n => `Reach Shark Pass level ${n} in a season`, '🎟️', [75, 175, 350]);
    tiers('sharkpass', 'profile', 'questClaims', [1, 10, 25, 50], ['Quest Accepted', 'Quest Diver', 'Mission Current', 'Quest Completionist'], n => `Claim ${n} Shark Pass quest rewards`, '📋');
    tiers('sharkpass', 'profile', 'passRewards', [1, 10, 20], ['Season Souvenir', 'Reward Route', 'Pass Treasure'], n => `Unlock ${n} Shark Pass cosmetic level rewards in a season`, '🎁');
    tiers('collection', 'profile', 'portraits', [5, 15, 30], ['Portrait Gallery', 'Face of the Ocean', 'Portrait Museum'], n => `Collect ${n} different earned profile portraits`, '🖼️');
    tiers('collection', 'profile', 'badges', [3, 10, 20], ['Badge Rack', 'Medal Cabinet', 'Decorated Diver'], n => `Unlock ${n} different badges beyond the starter badge`, '🏅');
    tiers('collection', 'profile', 'themes', [3, 5, 10], ['Fresh Palette', 'Reef Designer', 'Ocean Stylist'], n => `Unlock ${n} profile themes beyond the default theme`, '🎨');
    tiers('milestones', 'profile', 'socialClaims', [3, 5], ['Social Explorer', 'Connected Current'], n => `Claim ${n} different social rewards`, '📣', [100, 175]);
    tiers('account', 'profile', 'codes', [3, 5], ['Code Collector', 'Codebreaker'], n => `Redeem ${n} different game codes`, '🔑', [100, 175]);
    tiers('events', 'calendar', 'gifts', [1, 7, 14, 24], ['First Festive Gift', 'Week of Wonder', 'Festive Fortnight', 'Advent Adventurer'], n => `Claim ${n} Christmas calendar gifts`, '🎄');
    tiers('duels', 'profile', 'duelGames', [50, 100], ['Arena Regular', 'Hundred Challenges'], n => `Play ${n} friend duels`, '🤝', [250, 400]);
    tiers('duels', 'profile', 'duelWins', [50, 100], ['Arena Champion', 'Duel Legend'], n => `Win ${n} friend duels`, '🏆', [350, 600]);
    for (const [source, label] of [['daily', 'Daily'], ['infinite', 'Infinite'], ['practice', 'Practice']]) {
        event(`explore_${source}_win`, 'modes', `${label} Diver`, `Win a game in ${label} mode`, '🦈');
        event(`explore_${source}_ray`, 'modes', `${label} Ray Explorer`, `Win a ray game in ${label} mode`, '🌊', 75);
        event(`explore_${source}_perfect`, 'modes', `${label} Instinct`, `Win on the first guess in ${label} mode`, '🎯', 100);
    }
    event('explore_crafted_crate', 'collection', 'Reef Artisan', 'Craft a cosmetic crate', '🧰', 75);
    event('explore_pearl_purchase', 'collection', 'Pearl Trader', 'Buy an item from the Pearl Shop', '💎', 50);
    event('explore_profile_theme', 'collection', 'Signature Current', 'Equip a profile theme beyond the default', '🎨', 40);
    event('explore_profile_badge', 'collection', 'Wear Your Colours', 'Equip a badge beyond the starter badge', '🏅', 40);
    event('explore_profile_title', 'collection', 'Name with Renown', 'Equip an unlocked profile title', '📛', 40);
    event('explore_showcase', 'collection', 'Proud Display', 'Showcase a claimed achievement on your profile', '🏆', 40);

    const read = (key, fallback = {}) => {
        try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch (_) { return fallback; }
    };
    const count = value => Array.isArray(value) ? new Set(value.filter(Boolean)).size : 0;
    const positive = value => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
    function uid() {
        return (typeof currentUser !== 'undefined' ? currentUser?.uid : window.currentUser?.uid) || '';
    }
    function stored(source, profile) {
        if (source === 'profile') return profile || (typeof window.getCurrentProfileData === 'function' ? window.getCurrentProfileData() : read('userProfile'));
        if (source === 'rng') return read(uid() ? 'sharkRngProfile_' + uid() : 'sharkRngProfile');
        if (source === 'rescue') return read('sharkdle_secret_save_v2');
        if (source === 'story') return read('sharkdle_story_mode_v2');
        if (source === 'library') return { favorites: read('heartedSharks', []), recent: read('sharchiveRecentlyViewed', []) };
        return {};
    }
    function values(source, data = {}) {
        if (source === 'library') return { favorites: count(data.favorites), recent: count(data.recent) };
        if (source === 'story') {
            const areas = Object.values(data.areas || {});
            return { tasks: areas.reduce((sum, area) => sum + (Array.isArray(area.species) ? area.species.flat().filter(v => v === true).length : 0), 0), bosses: areas.filter(a => a.bossCompleted === true).length, regions: areas.filter(a => a.completed === true).length, finale: data.finale?.seen === true ? 1 : 0 };
        }
        if (source === 'rng') {
            const entries = Object.values(data.collection || {}).filter(v => v && positive(v.count) > 0);
            return { ...data, finds: entries.length, mutatedFinds: entries.filter(v => (Array.isArray(v.mutations) && v.mutations.length > 0) || v.mutation).length, indexClaims: count(data.claimedIndexRewards) };
        }
        if (source === 'profile') return {
            ...data, passLevel: typeof getCurrentPlayerLevel === 'function' ? getCurrentPlayerLevel(data) : positive(data.sharkPassLevel),
            questClaims: Object.values(data.sharkPassMissionClaims || {}).reduce((n, claims) => n + count(claims), 0),
            passRewards: typeof sharkPassRewards !== 'undefined' ? sharkPassRewards.filter(reward => reward.type !== 'crate' && reward.level <= (typeof getCurrentPlayerLevel === 'function' ? getCurrentPlayerLevel(data) : positive(data.sharkPassLevel))).length : 0,
            portraits: count((data.earnedCosmetics || []).map(v => v?.imagePath).filter(Boolean)),
            badges: count((data.unlockedBadges || []).filter(v => v !== 'starter')),
            themes: count((data.unlockedCardThemes || []).filter(v => v !== 'default')),
            socialClaims: count(data.socialRewardsClaimed), codes: count(data.redeemedCodes)
        };
        return data;
    }
    function progress(achievement, profile) {
        const [, source, field] = achievement.metric.split(':');
        return positive(values(source, stored(source, profile))[field]);
    }
    function award(id) {
        if (!definitions.some(a => a.id === id)) return;
        const unlocked = read('unlockedAchievements', []);
        if (!Array.isArray(unlocked) || unlocked.includes(id)) return;
        try {
            if (typeof window.recordSharkdleAchievement === 'function') window.recordSharkdleAchievement(id);
            else {
                localStorage.setItem('unlockedAchievements', JSON.stringify([...unlocked, id]));
                window.syncUnlockedAchievementToFirebase?.(id, [...unlocked, id]);
            }
        } catch (error) {
            console.warn('Achievement progress could not be saved:', error);
        }
    }
    function check(source, data) {
        const current = values(source, data || stored(source));
        definitions.filter(a => a.metric?.startsWith(`corner:${source}:`)).forEach(a => {
            if (positive(current[a.metric.split(':')[2]]) >= a.milestone) award(a.id);
        });
    }
    function win(mode, rays, guesses) {
        award(`explore_${mode}_win`);
        if (rays) award(`explore_${mode}_ray`);
        if (guesses === 1) award(`explore_${mode}_perfect`);
    }
    window.SharkdleCorners = { definitions, categories, progress, check, award, win };
})();
