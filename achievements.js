const ACHIEVEMENT_STORY_STORAGE_KEY = "sharkdle_story_mode_v2";
const SECRET_SAVE_KEY = "sharkdle_secret_save_v2";
let achievementAuthReady = false;

// Achievement Definitions
const achievementDefinitions = {
    // Special Achievements
    special: [
        {
            id: 'speed_win',
            name: 'Lightning Fast',
            description: 'Win in 2 guesses',
            icon: '⚡',
            points: 75,
            type: 'special'
        },
        {
            id: 'comeback_win',
            name: 'Comeback King',
            description: 'Win with only 1 guess left',
            icon: '👑',
            points: 75,
            type: 'special'
        },
        {
            id: 'secret_command_found',
            name: 'Depths Discovered',
            description: 'Discover the hidden Shark Rescue Command page',
            icon: '🦈',
            points: 180,
            type: 'special',
            themeRewardId: 'pearl-reef',
            themeRewardName: 'Pearl Reef'
        },
        {
            id: 'crate_opened',
            name: 'First Unboxing',
            description: 'Open a Cosmetic Crate',
            icon: '📦',
            points: 40,
            type: 'special'
        },
        {
            id: 'summer_crate_opened',
            name: 'First Summer Unboxing',
            description: 'Open a Summer Crate',
            icon: '☀️',
            points: 40,
            type: 'special'
        },
        {
            id: 'halloween_crate_opened',
            name: 'First Halloween Unboxing',
            description: 'Open a Halloween Crate',
            icon: '🎃',
            points: 40,
            type: 'special'
        },
        {
            id: 'christmas_crate_opened',
            name: 'First Christmas Unboxing',
            description: 'Open a Christmas Crate',
            icon: '🎁',
            points: 40,
            type: 'special'
        },
        {
            id: 'secret_prestige_1',
            name: 'First Renown',
            description: 'Prestige once in Shark Rescue Command',
            icon: '👑',
            points: 100,
            type: 'special',
            hiddenUntilSecret: true
        },
        {
            id: 'secret_missions_25',
            name: 'Command Veteran',
            description: 'Complete 25 missions in Shark Rescue Command',
            icon: '📡',
            points: 140,
            type: 'special',
            hiddenUntilSecret: true
        },
        {
            id: 'secret_apex_cells_10',
            name: 'Cell Splitter',
            description: 'Earn 10 Apex Cells in Shark Rescue Command',
            icon: '🧬',
            points: 180,
            type: 'special',
            hiddenUntilSecret: true
        },
        {
            id: 'streak_shield_used',
            name: 'Saviour',
            description: 'Lose a game but have a streak shield protect your win streak',
            icon: '🛡️',
            points: 100,
            type: 'special'
        }
    ],
    
    // Win Milestones
    wins: [
        { id: 'wins_1', name: 'Novice Observer', description: 'Win 1 game', icon: '⭐', points: 10, milestone: 1 },
        { id: 'wins_3', name: 'Rising Observer', description: 'Win 3 games', icon: '⭐⭐', points: 20, milestone: 3 },
        { id: 'wins_5', name: 'Skilled Observer', description: 'Win 5 games', icon: '⭐⭐', points: 25, milestone: 5 },
        { id: 'wins_10', name: 'Experienced Observer', description: 'Win 10 games', icon: '⭐⭐⭐', points: 50, milestone: 10 },
        { id: 'wins_25', name: 'Legendary Observer', description: 'Win 25 games', icon: '👑', points: 100, milestone: 25 },
        { id: 'wins_50', name: 'Master Observer', description: 'Win 50 games', icon: '👑👑', points: 150, milestone: 50 },
        { id: 'wins_100', name: 'Mythical Observer', description: 'Win 100 games', icon: '🏆', points: 250, milestone: 100 },
        { id: 'wins_250', name: 'Transcendant Observer', description: 'Win 250 games', icon: '🏆🏆', points: 400, milestone: 250 }
    ],
    
    // Games Played Milestones
    games: [
        { id: 'games_10', name: 'Getting Started', description: 'Play 10 games', icon: '🎮', points: 15, milestone: 10 },
        { id: 'games_20', name: 'Committed Player', description: 'Play 20 games', icon: '🎮🎮', points: 30, milestone: 20 },
        { id: 'games_50', name: 'Dedicated Gamer', description: 'Play 50 games', icon: '🎮🎮🎮', points: 75, milestone: 50 },
        { id: 'games_100', name: 'Obsessed', description: 'Play 100 games', icon: '🎮🎮🎮🎮', points: 150, milestone: 100 },
        { id: 'games_250', name: 'Cant Stop', description: 'Play 250 games', icon: '💪', points: 250, milestone: 250 },
        { id: 'games_500', name: 'True Addict', description: 'Play 500 games', icon: '🌊', points: 400, milestone: 500 }
    ],
    
    // Streak Milestones
    streaks: [
        { id: 'streak_1', name: 'On a Roll', description: 'Win 1 game in a row', icon: '🔥', points: 10, milestone: 1 },
        { id: 'streak_3', name: 'On Fire', description: 'Win 3 games in a row', icon: '🔥', points: 25, milestone: 3 },
        { id: 'streak_5', name: 'Hot Streak', description: 'Win 5 games in a row', icon: '🔥🔥', points: 40, milestone: 5 },
        { id: 'streak_10', name: 'Unbeatable', description: 'Win 10 games in a row', icon: '🔥🔥🔥', points: 100, milestone: 10 },
        { id: 'streak_25', name: 'Unstoppable', description: 'Win 25 games in a row', icon: '⚡', points: 200, milestone: 25 },
        { id: 'streak_50', name: 'Invincible', description: 'Win 50 games in a row', icon: '⚡⚡', points: 350, milestone: 50 }
    ],
    
    // Efficiency Achievements
    efficiency: [
        { id: 'avg_guesses_low', name: 'Sharp Mind', description: 'Average 4 or fewer guesses per win', icon: '🧠', points: 100, type: 'efficiency' },
        { id: 'guess_master', name: 'Guess Master', description: 'Average 3 or fewer guesses per win', icon: '🎯', points: 150, type: 'efficiency', themeRewardId: 'deep-abyss', themeRewardName: 'Deep Abyss' }
    ],

    duels: [
        { id: 'duel_played', name: 'First Blood', description: 'Play your first friend duel', icon: '⚔️', points: 40, type: 'duel' },
        { id: 'duel_won', name: 'Apex Rival', description: 'Win a friend duel', icon: '🏆', points: 75, type: 'duel', themeRewardId: 'storm-current', themeRewardName: 'Storm Current' }
    ],

    // World Map Achievements
    worldmap: [
        {
            id: 'atlantic_master',
            name: 'Atlantic Mastered',
            description: 'Complete the World Map Atlantic Challenge',
            icon: '🧩',
            points: 150,
            type: 'worldmap'
        },
        {
            id: 'pacific_master',
            name: 'Pacific Mastered',
            description: 'Complete the World Map Pacific Challenge',
            icon: '🧩',
            points: 200,
            type: 'worldmap',
            themeRewardId: 'coral-bloom',
            themeRewardName: 'Coral Bloom'
        },
        {
            id: 'indian_master',
            name: 'Indian Mastered',
            description: 'Complete Indian Region on the world map',
            icon: '🧩',
            points: 250,
            type: 'worldmap'
        },
        {
            id: 'sothafrica_master',
            name: 'South Africa Mastered',
            description: 'Complete South Africa region on the world map',
            icon: '🧩',
            points: 300,
            type: 'worldmap'
        },
        {
            id: 'usa_master',
            name: 'USA Mastered',
            description: 'Complete USA region on the world map',
            icon: '🧩',
            points: 350,
            type: 'worldmap'
        },
        {
            id: 'mediterranean_master',
            name: 'Mediterranean Mastered',
            description: 'Complete Mediterranean region on the world map',
            icon: '🧩',
            points: 300,
            type: 'worldmap'
        },
        {
            id: 'japan_master',
            name: 'Japan Mastered',
            description: 'Complete Japan region on the world map',
            icon: '🧩',
            points: 450,
            type: 'worldmap'
        },
        {
            id: 'australia_master',
            name: 'Australia Mastered',
            description: 'Complete Australia region on the world map',
            icon: '🧩',
            points: 325,
            type: 'worldmap'
        },
    ],
    // Social Achievements
    milestones: [
        { id: 'friends_1', name: 'First Friend', description: 'Add your first friend', icon: '👋', points: 25, milestone: 1 },
        { id: 'friends_3', name: 'Social Butterfly', description: 'Add 3 friends', icon: '🦋', points: 50, milestone: 3 },
        { id: 'friends_5', name: 'Popular', description: 'Add 5 friends', icon: '⭐', points: 100, milestone: 5 },
        { id: 'friends_10', name: 'Socialite', description: 'Add 10 friends', icon: '👥', points: 200, milestone: 10 }
    ]
};

// Initialize achievements on page load
document.addEventListener('DOMContentLoaded', async function() {
    if (document.getElementById('achievements-content')) {
        await waitForAchievementAuthState();
        await loadAndDisplayAchievements();
    }
});

function getStoredAchievementIds(key) {
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn(`Error parsing ${key}:`, error);
        return [];
    }
}

function setStoredAchievementIds(key, values) {
    localStorage.setItem(key, JSON.stringify([...new Set(Array.isArray(values) ? values : [])]));
}

function mergeAchievementIdLists(...lists) {
    return [...new Set(lists.flatMap(list => Array.isArray(list) ? list : []))];
}

async function addAchievementIdToRemote(fieldName, achievementId, fallbackList = []) {
    if (!currentUser || !db || !achievementId) return;
    try {
        const fieldValue = typeof firebase !== "undefined"
            && firebase.firestore
            && firebase.firestore.FieldValue
            ? firebase.firestore.FieldValue
            : null;
        const payload = fieldValue?.arrayUnion
            ? { [fieldName]: fieldValue.arrayUnion(achievementId) }
            : { [fieldName]: fallbackList };
        await db.collection("userStats").doc(currentUser.uid).set(payload, { merge: true });
    } catch (error) {
        console.warn(`Error syncing ${fieldName} to Firebase:`, error);
    }
}

function waitForAchievementAuthState(timeoutMs = 1500) {
    if (achievementAuthReady) return Promise.resolve();
    if (typeof firebase === "undefined" || typeof firebase.auth !== "function") {
        achievementAuthReady = true;
        return Promise.resolve();
    }

    return new Promise(resolve => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            achievementAuthReady = true;
            resolve();
        };

        const authInstance = firebase.auth();
        const unsubscribe = authInstance.onAuthStateChanged(() => {
            unsubscribe();
            finish();
        });

        setTimeout(() => {
            unsubscribe();
            finish();
        }, timeoutMs);
    });
}

async function hydrateAchievementStateFromRemote() {
    const localUnlocked = getStoredAchievementIds("unlockedAchievements");
    const localClaimed = getStoredAchievementIds("claimedAchievements");
    if (!currentUser || !db) {
        return { unlockedAchievements: localUnlocked, claimedAchievements: localClaimed };
    }

    try {
        const statsSnap = await db.collection("userStats").doc(currentUser.uid).get();
        const remoteData = statsSnap.exists ? (statsSnap.data() || {}) : {};
        const mergedUnlocked = mergeAchievementIdLists(localUnlocked, remoteData.unlockedAchievements);
        const mergedClaimed = mergeAchievementIdLists(localClaimed, remoteData.claimedAchievements);
        setStoredAchievementIds("unlockedAchievements", mergedUnlocked);
        setStoredAchievementIds("claimedAchievements", mergedClaimed);
        const remoteUnlockedCount = Array.isArray(remoteData.unlockedAchievements) ? remoteData.unlockedAchievements.length : 0;
        const remoteClaimedCount = Array.isArray(remoteData.claimedAchievements) ? remoteData.claimedAchievements.length : 0;
        if (mergedUnlocked.length !== remoteUnlockedCount || mergedClaimed.length !== remoteClaimedCount) {
            await db.collection("userStats").doc(currentUser.uid).set({
                unlockedAchievements: mergedUnlocked,
                claimedAchievements: mergedClaimed
            }, { merge: true });
        }
        return { unlockedAchievements: mergedUnlocked, claimedAchievements: mergedClaimed };
    } catch (error) {
        console.warn("Error hydrating achievement state from Firebase:", error);
        return { unlockedAchievements: localUnlocked, claimedAchievements: localClaimed };
    }
}

function getStoryStateSnapshot() {
    try {
        return JSON.parse(localStorage.getItem(ACHIEVEMENT_STORY_STORAGE_KEY) || "{}");
    } catch (error) {
        console.warn("Error parsing story state:", error);
        return {};
    }
}

function isStoryAreaCompleted(areaId) {
    if (localStorage.getItem(`storyAreaCompleted_${areaId}`) === 'true') {
        return true;
    }
    const storyState = getStoryStateSnapshot();
    return Boolean(storyState?.areas?.[areaId]?.completed);
}

function getCategoryAchievements(categoryKey) {
    const achievements = [...achievementDefinitions[categoryKey]];
    if (categoryKey !== 'worldmap') {
        return achievements;
    }

    const worldMapOrder = [
        'atlantic_master',
        'pacific_master',
        'indian_master',
        'mediterranean_master',
        'australia_master',
        'sothafrica_master',
        'usa_master',
        'japan_master'
    ];

    return achievements.sort((a, b) => worldMapOrder.indexOf(a.id) - worldMapOrder.indexOf(b.id));
}

async function getAchievementFriendCount() {
    if (!currentUser || !db) return 0;
    try {
        if (typeof getFriendNetworkData === "function") {
            const networkData = await getFriendNetworkData(currentUser.uid);
            return Array.isArray(networkData?.friends) ? networkData.friends.length : 0;
        }
        if (typeof ensureFriendDocument === "function") {
            const networkData = await ensureFriendDocument(currentUser.uid);
            return Array.isArray(networkData?.friends) ? networkData.friends.length : 0;
        }
        const collectionName = typeof FRIENDS_COLLECTION === "string" ? FRIENDS_COLLECTION : "friendNetwork";
        const doc = await db.collection(collectionName).doc(currentUser.uid).get();
        const data = doc.exists ? (doc.data() || {}) : {};
        return Array.isArray(data.friends) ? data.friends.length : 0;
    } catch (error) {
        console.warn("Error loading friends count for achievements:", error);
        return 0;
    }
}



// Retroactively unlock achievements that players have already earned based on current stats
async function retroactivelyUnlockAchievements(profileData, unlockedAchievements) {
    const wins = profileData.wins || 0;
    const gamesPlayed = profileData.gamesPlayed || 0;
    const currentStreak = profileData.currentStreak || 0;
    const totalGuesses = profileData.totalGuesses || 0;
    
    // Check win milestones
    achievementDefinitions.wins.forEach(achievement => {
        if (wins >= achievement.milestone && !unlockedAchievements.includes(achievement.id)) {
            unlockedAchievements.push(achievement.id);
        }
    });
    
    // Check games played milestones
    achievementDefinitions.games.forEach(achievement => {
        if (gamesPlayed >= achievement.milestone && !unlockedAchievements.includes(achievement.id)) {
            unlockedAchievements.push(achievement.id);
        }
    });
    
    // Check streak milestones
    achievementDefinitions.streaks.forEach(achievement => {
        if (currentStreak >= achievement.milestone && !unlockedAchievements.includes(achievement.id)) {
            unlockedAchievements.push(achievement.id);
        }
    });
    
    // Check efficiency achievements
    if (wins > 0) {
        const avgGuesses = totalGuesses / wins;
        if (avgGuesses <= 4 && !unlockedAchievements.includes('avg_guesses_low')) {
            unlockedAchievements.push('avg_guesses_low');
        }
        if (avgGuesses <= 3 && !unlockedAchievements.includes('guess_master')) {
            unlockedAchievements.push('guess_master');
        }
    }
    
    // Check friends milestones
    const friendsCount = Number.isFinite(Number(profileData.friendsCount))
        ? Number(profileData.friendsCount)
        : await getAchievementFriendCount();
    achievementDefinitions.milestones.forEach(achievement => {
        if (friendsCount >= achievement.milestone && !unlockedAchievements.includes(achievement.id)) {
            unlockedAchievements.push(achievement.id);
        }
    });

    const duelGames = profileData.duelGames || 0;
    const duelWins = profileData.duelWins || 0;
    if (duelGames >= 1 && !unlockedAchievements.includes('duel_played')) {
        unlockedAchievements.push('duel_played');
    }
    if (duelWins >= 1 && !unlockedAchievements.includes('duel_won')) {
        unlockedAchievements.push('duel_won');
    }
    if (localStorage.getItem('secretGameDiscovered') === 'true' && !unlockedAchievements.includes('secret_command_found')) {
        unlockedAchievements.push('secret_command_found');
    }
    if (typeof window.getOpenedCrateCount === 'function' && window.getOpenedCrateCount(profileData) >= 1 && !unlockedAchievements.includes('crate_opened')) {
        unlockedAchievements.push('crate_opened');
    }
    if (typeof window.getOpenedCrateCount === 'function' && window.getOpenedCrateCount(profileData, 'summer') >= 1 && !unlockedAchievements.includes('summer_crate_opened')) {
        unlockedAchievements.push('summer_crate_opened');
    }
    if (typeof window.getOpenedCrateCount === 'function' && window.getOpenedCrateCount(profileData, 'halloween') >= 1 && !unlockedAchievements.includes('halloween_crate_opened')) {
        unlockedAchievements.push('halloween_crate_opened');
    }
    if (typeof window.getOpenedCrateCount === 'function' && window.getOpenedCrateCount(profileData, 'christmas') >= 1 && !unlockedAchievements.includes('christmas_crate_opened')) {
        unlockedAchievements.push('christmas_crate_opened');
    }
    const secretState = getSecretCommandState();
    if ((secretState.prestigeCount || 0) >= 1 && !unlockedAchievements.includes('secret_prestige_1')) {
        unlockedAchievements.push('secret_prestige_1');
    }
    if ((secretState.missionsCompleted || 0) >= 25 && !unlockedAchievements.includes('secret_missions_25')) {
        unlockedAchievements.push('secret_missions_25');
    }
    if ((secretState.apexCells || 0) >= 10 && !unlockedAchievements.includes('secret_apex_cells_10')) {
        unlockedAchievements.push('secret_apex_cells_10');
    }

    // Check story/world map progress
    try {
        const atlanticChallenges = JSON.parse(localStorage.getItem('atlanticChallenges') || '[false,false,false,false,false]');
        const atlanticComplete = Array.isArray(atlanticChallenges) && atlanticChallenges.every(Boolean);
        if ((atlanticComplete || localStorage.getItem('atlanticCrosswordComplete') === 'true' || isStoryAreaCompleted('atlantic')) && !unlockedAchievements.includes('atlantic_master')) {
            unlockedAchievements.push('atlantic_master');
        }
        if ((localStorage.getItem('pacificWordsearchComplete') === 'true' || isStoryAreaCompleted('pacific')) && !unlockedAchievements.includes('pacific_master')) {
            unlockedAchievements.push('pacific_master');
        }
        if (isStoryAreaCompleted('indian') && !unlockedAchievements.includes('indian_master')) {
            unlockedAchievements.push('indian_master');
        }
        if (isStoryAreaCompleted('mediterranean') && !unlockedAchievements.includes('mediterranean_master')) {
            unlockedAchievements.push('mediterranean_master');
        }
        if (isStoryAreaCompleted('australia') && !unlockedAchievements.includes('australia_master')) {
            unlockedAchievements.push('australia_master');
        }
        if (isStoryAreaCompleted('south_africa') && !unlockedAchievements.includes('sothafrica_master')) {
            unlockedAchievements.push('sothafrica_master');
        }
        if (isStoryAreaCompleted('usa_east') && !unlockedAchievements.includes('usa_master')) {
            unlockedAchievements.push('usa_master');
        }
        if (isStoryAreaCompleted('japan') && !unlockedAchievements.includes('japan_master')) {
            unlockedAchievements.push('japan_master');
        }
    } catch (error) {
        console.warn('Error checking world map achievements:', error);
    }
    
    // Save the updated list
    localStorage.setItem("unlockedAchievements", JSON.stringify(unlockedAchievements));
    
    return unlockedAchievements;
}

async function loadAndDisplayAchievements() {
    const hydratedState = await hydrateAchievementStateFromRemote();
    let profileData = typeof window.getCurrentProfileData === "function"
        ? window.getCurrentProfileData()
        : JSON.parse(localStorage.getItem("userProfile") || "{}");
    profileData.friendsCount = await getAchievementFriendCount();
    let unlockedAchievements = hydratedState.unlockedAchievements;
    
    // Remove old XP-based achievement IDs that no longer exist
    const oldAchievementIds = ['100_xp_earned', '500_xp_earned', '1000_xp_earned', '2000_xp_earned'];
    unlockedAchievements = unlockedAchievements.filter(id => !oldAchievementIds.includes(id));
    localStorage.setItem("unlockedAchievements", JSON.stringify(unlockedAchievements));
    
    // Retroactively unlock achievements for existing players based on current stats
    unlockedAchievements = await retroactivelyUnlockAchievements(profileData, unlockedAchievements);
    if (currentUser && db) {
        try {
            await db.collection("userStats").doc(currentUser.uid).set({ unlockedAchievements }, { merge: true });
        } catch (error) {
            console.warn("Error syncing retroactive achievements:", error);
        }
    }
    if (typeof window.syncAchievementThemeUnlocks === "function") {
        const themeSyncResult = window.syncAchievementThemeUnlocks(profileData);
        profileData = themeSyncResult.profileData;
        if (themeSyncResult.changed && typeof window.syncStatsToFirebase === "function") {
            window.syncStatsToFirebase().catch(error => console.error("Error syncing achievement themes:", error));
        }
    }
    
    renderAchievements(profileData, unlockedAchievements);
    updateAchievementStats(unlockedAchievements);
}

function getSecretCommandState() {
    try {
        return JSON.parse(localStorage.getItem(SECRET_SAVE_KEY) || "{}");
    } catch (error) {
        console.warn("Error parsing secret command state:", error);
        return {};
    }
}

function hasSecretPageDiscovery() {
    return localStorage.getItem('secretGameDiscovered') === 'true';
}

function renderAchievements(profileData, unlockedAchievements) {
    const container = document.getElementById('achievements-content');
    if (!container) {
        console.warn("renderAchievements: #achievements-content not found in DOM");
        return;
    }
    container.innerHTML = '';

    // Render World Map achievements
    if (achievementDefinitions.worldmap.length > 0) {
        container.appendChild(createCategorySection('🗺️ World Map', 'worldmap', profileData, unlockedAchievements));
    }
    // Render special achievements
    if (achievementDefinitions.special.length > 0) {
        container.appendChild(createCategorySection('🌟 Special Achievements', 'special', profileData, unlockedAchievements));
    }
    if (achievementDefinitions.duels.length > 0) {
        container.appendChild(createCategorySection('⚔️ Duel Achievements', 'duels', profileData, unlockedAchievements));
    }

    
    // Render win milestones
    if (achievementDefinitions.wins.length > 0) {
        container.appendChild(createCategorySection('⭐ Win Milestones', 'wins', profileData, unlockedAchievements));
    }
    
    // Render games played milestones
    if (achievementDefinitions.games.length > 0) {
        container.appendChild(createCategorySection('🎮 Games Played Milestones', 'games', profileData, unlockedAchievements));
    }
    
    // Render streak milestones
    if (achievementDefinitions.streaks.length > 0) {
        container.appendChild(createCategorySection('🔥 Win Streak Milestones', 'streaks', profileData, unlockedAchievements));
    }
    
    // Render efficiency achievements
    if (achievementDefinitions.efficiency.length > 0) {
        container.appendChild(createCategorySection('💡 Efficiency Achievements', 'efficiency', profileData, unlockedAchievements));
    }
    
    // Render milestone achievements
    if (achievementDefinitions.milestones.length > 0) {
        container.appendChild(createCategorySection('🎯 Milestone Achievements', 'milestones', profileData, unlockedAchievements));
    }
}

function createCategorySection(categoryName, categoryKey, profileData, unlockedAchievements) {
    const section = document.createElement('div');
    section.className = 'achievement-category';
    
    const achievements = getCategoryAchievements(categoryKey);
    const unlockedCount = achievements.filter(achievement => unlockedAchievements.includes(achievement.id)).length;
    const header = document.createElement('div');
    header.className = 'category-header';

    const title = document.createElement('h2');
    title.className = 'category-title';
    title.textContent = categoryName;

    const meta = document.createElement('div');
    meta.className = 'category-meta';
    meta.textContent = `${unlockedCount}/${achievements.length} unlocked`;

    header.appendChild(title);
    header.appendChild(meta);
    section.appendChild(header);
    
    const grid = document.createElement('div');
    grid.className = 'achievements-grid';
    
    achievements.forEach(achievement => {
        grid.appendChild(createAchievementCard(achievement, profileData, unlockedAchievements));
    });
    
    section.appendChild(grid);
    return section;
}

function createAchievementCard(achievement, profileData, unlockedAchievements) {
    const card = document.createElement('div');
    card.className = 'achievement-card';
    const secretHidden = achievement.hiddenUntilSecret && !hasSecretPageDiscovery();
    
    const isUnlocked = unlockedAchievements.includes(achievement.id);
    const claimedAchievements = getStoredAchievementIds("claimedAchievements");
    const isClaimed = claimedAchievements.includes(achievement.id);
    
    card.classList.add(isUnlocked ? 'unlocked' : 'locked');
    
    const media = document.createElement('div');
    media.className = 'achievement-media';

    const icon = document.createElement('div');
    icon.className = 'achievement-icon';
    icon.textContent = secretHidden ? '❔' : achievement.icon;
    media.appendChild(icon);
    
    const name = document.createElement('div');
    name.className = 'achievement-name';
    name.textContent = secretHidden ? '???' : achievement.name;
    
    const description = document.createElement('div');
    description.className = 'achievement-description';
    description.textContent = secretHidden ? '???' : achievement.description;
    
    const pointsDisplay = document.createElement('div');
    pointsDisplay.className = 'achievement-points';
    pointsDisplay.textContent = `+${achievement.points} XP`;
    
    const status = document.createElement('div');
    status.className = 'achievement-status';

    const content = document.createElement('div');
    content.className = 'achievement-content';
    content.appendChild(name);
    content.appendChild(description);
    if (achievement.themeRewardName && !secretHidden) {
        const rewardNote = document.createElement('div');
        rewardNote.className = 'achievement-description';
        rewardNote.textContent = `Unlocks the ${achievement.themeRewardName} profile theme when claimed.`;
        content.appendChild(rewardNote);
    }

    const side = document.createElement('div');
    side.className = 'achievement-side';
    side.appendChild(pointsDisplay);
    
    // Determine progress display
    let progressBar = null;
    if (isUnlocked) {
        if (isClaimed) {
            status.textContent = 'Claimed';
            status.classList.add('claimed');
        } else {
            status.textContent = 'Unlocked';
            status.classList.add('ready');
            const claimBtn = document.createElement('button');
            claimBtn.textContent = 'Claim Reward';
            claimBtn.className = 'achievement-claim-btn';
            claimBtn.onclick = async function(e) {
                e.stopPropagation();
                claimBtn.disabled = true;
                await claimAchievementReward(achievement.id, achievement.points);
                // Reload achievements to update display
                setTimeout(async () => await loadAndDisplayAchievements(), 300);
            };
            
            side.appendChild(status);
            side.appendChild(claimBtn);
            card.appendChild(media);
            card.appendChild(content);
            card.appendChild(side);
            return card;
        }
    } else if (achievement.milestone) {
        // Show progress for milestone achievements
        let currentProgress = 0;
        if (achievement.id.includes('wins_')) {
            currentProgress = profileData.wins || 0;
        } else if (achievement.id.includes('games_')) {
            currentProgress = profileData.gamesPlayed || 0;
        } else if (achievement.id.includes('streak_')) {
            currentProgress = profileData.currentStreak || 0;
        } else if (achievement.id.includes('friends_')) {
            currentProgress = profileData.friendsCount || 0;
        }
        
        const progress = Math.min((currentProgress / achievement.milestone) * 100, 100);
        status.textContent = `${currentProgress}/${achievement.milestone}`;
        status.classList.add('progressing');
        progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill';
        progressFill.style.width = `${progress}%`;
        progressBar.appendChild(progressFill);
    } else {
        status.textContent = 'Locked';
        status.classList.add('locked-pill');
    }
    
    side.appendChild(status);
    if (progressBar) content.appendChild(progressBar);
    card.appendChild(media);
    card.appendChild(content);
    card.appendChild(side);
    
    return card;
}

function updateAchievementStats(unlockedAchievements) {
    const totalAchievements = Object.values(achievementDefinitions).flat().length;
    const unlockedCount = new Set(unlockedAchievements).size;
    const claimedAchievements = getStoredAchievementIds("claimedAchievements");
    const claimedPoints = calculateClaimedPoints(claimedAchievements);
    const percentage = Math.round((unlockedCount / totalAchievements) * 100);
    
    const countEl = document.getElementById('achievement-count');
    const pointsEl = document.getElementById('achievement-points');
    const percentageEl = document.getElementById('achievement-percentage');
    
    if (countEl) countEl.textContent = unlockedCount;
    if (pointsEl) pointsEl.textContent = claimedPoints;
    if (percentageEl) percentageEl.textContent = percentage + '%';
}

function calculateClaimedPoints(claimedAchievements) {
    let total = 0;
    const allAchievements = Object.values(achievementDefinitions).flat();
    claimedAchievements.forEach(id => {
        const achievement = allAchievements.find(a => a.id === id);
        if (achievement) {
            total += achievement.points;
        }
    });
    return total;
}

function unlockAchievement(achievementId) {
    const unlockedAchievements = getStoredAchievementIds("unlockedAchievements");
    
    if (!unlockedAchievements.includes(achievementId)) {
        unlockedAchievements.push(achievementId);
        setStoredAchievementIds("unlockedAchievements", unlockedAchievements);
        addAchievementIdToRemote("unlockedAchievements", achievementId, unlockedAchievements);
        
        // Sync to Firebase to sync achievements across devices
        if (window.syncStatsToFirebase) {
            try {
                window.syncStatsToFirebase().catch(error => 
                    console.error("Error syncing achievements to Firebase:", error)
                );
            } catch (error) {
                console.error("Error calling syncStatsToFirebase:", error);
            }
        }
        
        // Show notification (if on achievements page)
        const allAchievements = Object.values(achievementDefinitions).flat();
        const achievement = allAchievements.find(a => a.id === achievementId);
        if (achievement) {
            showAchievementNotification(achievement);
        }
    }
}

async function claimAchievementReward(achievementId, points) {
    const { claimedAchievements: hydratedClaimed } = await hydrateAchievementStateFromRemote();
    const claimedAchievements = [...hydratedClaimed];
    
    if (!claimedAchievements.includes(achievementId)) {
        claimedAchievements.push(achievementId);
        setStoredAchievementIds("claimedAchievements", claimedAchievements);
        await addAchievementIdToRemote("claimedAchievements", achievementId, claimedAchievements);
        
        // Add XP to user profile
        const profileData = typeof window.getCurrentProfileData === "function"
            ? window.getCurrentProfileData()
            : JSON.parse(localStorage.getItem("userProfile") || "{}");
        const xpAward = typeof window.applyLimitedTimeXpBonus === "function"
            ? window.applyLimitedTimeXpBonus(points)
            : { totalXp: points, multiplier: 1, baseXp: points };
        profileData.totalXP = (profileData.totalXP || 0) + xpAward.totalXp;
        
        // Handle special cosmetic rewards from achievement definitions
        const allAchievements = Object.values(achievementDefinitions).flat();
        const achievement = allAchievements.find(a => a.id === achievementId);
        if (achievement && achievement.cosmetic) {
            if (!profileData.earnedCosmetics) {
                profileData.earnedCosmetics = [];
            }
            if (!profileData.earnedCosmetics.some(c => c.name === achievement.cosmetic.name)) {
                profileData.earnedCosmetics.push(achievement.cosmetic);
            }
        }
        let unlockedThemeName = "";
        if (achievement?.themeRewardId && typeof window.syncAchievementThemeUnlocks === "function") {
            const themeSyncResult = window.syncAchievementThemeUnlocks(profileData);
            profileData.unlockedCardThemes = themeSyncResult.unlockedThemeIds;
            unlockedThemeName = achievement.themeRewardName || achievement.themeRewardId;
        }
        
        if (typeof window.saveUserProfileLocally === "function") {
            window.saveUserProfileLocally(profileData);
        } else {
            localStorage.setItem("userProfile", JSON.stringify(profileData));
        }
        
        // Sync to Firebase to prevent duplicate claims on other devices
        if (window.syncStatsToFirebase) {
            try {
                await window.syncStatsToFirebase();
            } catch (error) {
                console.error("Error syncing achievements to Firebase:", error);
            }
        }
        
        // Show claim notification
        showClaimNotification(xpAward.totalXp, xpAward.multiplier, xpAward.baseXp);
        if (unlockedThemeName && typeof showNotification === "function") {
            showNotification(`${unlockedThemeName} profile theme unlocked!`, 'success', 4200);
        }
    }
}

// Notification stack manager
let notificationStack = [];
let achievementAnimationInjected = false;

function ensureAchievementAnimation() {
    if (achievementAnimationInjected || document.getElementById('achievement-toast-animation')) {
        achievementAnimationInjected = true;
        return;
    }

    const style = document.createElement('style');
    style.id = 'achievement-toast-animation';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    achievementAnimationInjected = true;
}

function getNotificationPosition() {
    const activeNotifications = document.querySelectorAll('[data-notification]').length;
    const notificationHeight = 100; // Approximate height of each notification
    const spacing = 16; // Spacing between notifications
    return 20 + (activeNotifications * (notificationHeight + spacing));
}

function showClaimNotification(points, multiplier = 1, basePoints = points) {
    ensureAchievementAnimation();
    const notification = document.createElement('div');
    notification.setAttribute('data-notification', 'true');
    
    const topPosition = getNotificationPosition();
    
    notification.style.cssText = `
        position: fixed;
        top: ${topPosition}px;
        right: 20px;
        background: linear-gradient(135deg, #00b4d8, #4dd0e1);
        color: #000;
        padding: 20px 30px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        font-weight: 700;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
        transition: top 0.3s ease;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 24px;">⭐</div>
            <div>
                <div style="font-weight: 700; font-size: 1.1em;">Reward Claimed!</div>
                <div style="font-size: 0.9em;">+${points} XP${multiplier > 1 ? ` (${multiplier}x from ${basePoints})` : ''}</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    notificationStack.push(notification);
    
    // Remove after 4 seconds
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
            notification.remove();
            notificationStack = notificationStack.filter(n => n !== notification);
        }, 300);
    }, 4000);
}

function checkAchievements(isWin, guessesTaken, wasGameWon) {
    const profileData = typeof window.getCurrentProfileData === "function"
        ? window.getCurrentProfileData()
        : JSON.parse(localStorage.getItem("userProfile") || "{}");
    
    // Check special achievements
    if (isWin && guessesTaken === 2) {
        unlockAchievement('speed_win');
    }
    
    if (isWin && guessesTaken === 11) {
        unlockAchievement('comeback_win');
    }
    

    
    // Check win milestones
    const wins = profileData.wins || 0;
    achievementDefinitions.wins.forEach(achievement => {
        if (wins >= achievement.milestone) {
            unlockAchievement(achievement.id);
        }
    });
    
    // Check games played milestones
    const gamesPlayed = profileData.gamesPlayed || 0;
    achievementDefinitions.games.forEach(achievement => {
        if (gamesPlayed >= achievement.milestone) {
            unlockAchievement(achievement.id);
        }
    });
    
    // Check streak milestones
    const streak = profileData.currentStreak || 0;
    achievementDefinitions.streaks.forEach(achievement => {
        if (streak >= achievement.milestone) {
            unlockAchievement(achievement.id);
        }
    });
    
    // Check efficiency achievements
    if (wins > 0) {
        const totalGuesses = profileData.totalGuesses || 0;
        const avgGuesses = totalGuesses / wins;
        if (avgGuesses <= 4) {
            unlockAchievement('avg_guesses_low');
        }
        if (avgGuesses <= 3) {
            unlockAchievement('guess_master');
        }
    }
    

    
    // Check XP milestone achievements
    const sharkPassLevel = profileData.sharkPassLevel || 0;
    if (sharkPassLevel >= 5) {
        unlockAchievement('level_5_sharkpass');
    }
    if (sharkPassLevel >= 15) {
        unlockAchievement('level_15_sharkpass');
    }
    if (sharkPassLevel >= 30) {
        unlockAchievement('level_30_sharkpass');
    }
    if (sharkPassLevel >= 50) {
        unlockAchievement('level_50_sharkpass');
    }
}

// Show achievement notification
function showAchievementNotification(achievement) {
    ensureAchievementAnimation();
    const notification = document.createElement('div');
    notification.setAttribute('data-notification', 'true');
    
    const topPosition = getNotificationPosition();
    
    notification.style.cssText = `
        position: fixed;
        top: ${topPosition}px;
        right: 20px;
        background: linear-gradient(135deg, #4caf50, #45a049);
        color: white;
        padding: 20px 30px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        font-weight: 600;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
        transition: top 0.3s ease;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 24px;">${achievement.icon}</div>
            <div>
                <div style="font-weight: 700; font-size: 1.1em;">Achievement Unlocked!</div>
                <div style="font-size: 0.9em;">${achievement.name}</div>
                <div style="font-size: 0.85em; opacity: 0.9;">+${achievement.points} XP</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    notificationStack.push(notification);
    
    // Remove after 4 seconds
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
            notification.remove();
            notificationStack = notificationStack.filter(n => n !== notification);
        }, 300);
    }, 4000);
}

// Expose function for game files
window.checkAchievements = checkAchievements;
window.unlockAchievement = unlockAchievement;
window.loadAndDisplayAchievements = loadAndDisplayAchievements;
window.claimAchievementReward = claimAchievementReward;
