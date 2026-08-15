(function () {
    "use strict";

    const STORAGE_KEY = "sharkRngProfile";
    const AUTO_ARROW_DISMISSED_KEY = "sharkRngAutoArrowDismissed";
    const LOCAL_SAVE_INTERVAL_MS = 120000;
    const BASE_ROLL_COOLDOWN_MS = 1600;
    const BASE_AUTO_INTERVAL_MS = 1800;
    const ULTRA_ONE_IN_THRESHOLD = 1_000_000;
    const GUARANTEED_ROLL_COIN_MULTIPLIER_CAP = 1.5;
    const GUARANTEED_ROLL_REWARD_RATES = {
        ultraPotion: 0.12,
        omegaPotion: 0.08,
        mutationPotion: 0.2
    };
    const RNG_LEADERBOARD_COLLECTION = "rngLeaderboard";
    const RNG_BROADCAST_COLLECTION = "rngBroadcasts";
    const RNG_BROADCAST_PLAYER_NAME_MAX = 32;
    const RNG_BROADCAST_SPECIES_NAME_MAX = 80;
    const RNG_LEADERBOARD_FALLBACK_COLLECTION = "userStats";
    const RNG_PROFILE_COLLECTION = "rngProfiles";
    const RNG_PROFILE_CHUNK_COLLECTION = "chunks";
    const RNG_PROFILE_SCHEMA_VERSION = 1;
    const RNG_PROFILE_CHUNK_SIZE = 300;
    const RNG_CLOUD_SAVE_INTERVAL_MS = 60000;
    const RNG_LEADERBOARD_LIMIT = 10;
    const RNG_LEADERBOARD_QUERY_LIMIT = 30;
    const RNG_LEADERBOARD_SYNC_INTERVAL_MS = 120000;
    const RNG_ADMIN_NEXT_ROLL_CONFIG_PREFIX = "rngNextRoll_";
    const RNG_ADMIN_NEXT_ROLL_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
    const RNG_ADMIN_NEXT_ROLL_CONSUMED_LIMIT = 30;
    const RNG_DAILY_QUEST_COUNT = 3;
    const RNG_DEV_UIDS = [
        "ETPtQC0VA2NiSnX67rS2P2ma2tC2",
        "gOcPqOuyPJRWisE4dxvFkGTOl5g2"
    ];
    const RNG_FIREBASE_CONFIG = {
        apiKey: "AIzaSyAS9l8O1jRMafPt3r0lF6mqjr2-gl-EbZ0",
        authDomain: "sharkdle-leaderboard.firebaseapp.com",
        databaseURL: "https://sharkdle-leaderboard-default-rtdb.firebaseio.com",
        projectId: "sharkdle-leaderboard",
        storageBucket: "sharkdle-leaderboard.firebasestorage.app",
        messagingSenderId: "429123174628",
        appId: "1:429123174628:web:42ae9baed69c4b087c2cf1",
        measurementId: "G-HV5FFNKM5C"
    };

    const TIERS = [
        { name: "Common", baseOneIn: 2, coinReward: 12, className: "common" },
        { name: "Uncommon", baseOneIn: 8, coinReward: 30, className: "uncommon" },
        { name: "Rare", baseOneIn: 35, coinReward: 90, className: "rare" },
        { name: "Epic", baseOneIn: 200, coinReward: 300, className: "epic" },
        { name: "Legendary", baseOneIn: 2500, coinReward: 2500, className: "legendary" },
        { name: "Mythical", baseOneIn: 50000, coinReward: 18000, className: "mythical" },
        { name: "Secret", baseOneIn: 500000, coinReward: 90000, className: "secret" },
        { name: "Ultra", baseOneIn: 2_000_000, coinReward: 2500000, className: "ultra" },
        { name: "Hyper", baseOneIn: 25_000_000, coinReward: 4000000, className: "hyper" },
        { name: "Omega", baseOneIn: 250_000_000, coinReward: 10000000, className: "omega" },
        { name: "Singularity", baseOneIn: 1_000_000_000, coinReward: 7000000, className: "singularity" }
    ];

    const INDEX_REWARD_DEFS = buildIndexRewardDefs();

    const EQUIPPED_LUCK_BONUS_BY_TIER = {
        Common: 0,
        Uncommon: 0.005,
        Rare: 0.015,
        Epic: 0.03,
        Legendary: 0.05,
        Mythical: 0.075,
        Secret: 0.1,
        Ultra: 0.14,
        Hyper: 0.18,
        Omega: 0.23,
        Singularity: 0.3
    };

    const MIN_LUCK_ODDS_BY_TIER = {
        Common: 2,
        Uncommon: 4,
        Rare: 15,
        Epic: 75,
        Legendary: 500,
        Mythical: 3_000,
        Secret: 15_000,
        Ultra: 60_000,
        Hyper: 150_000,
        Omega: 300_000,
        Singularity: 750_000
    };

    const LUCK_BALANCE_REFERENCE = 450;
    const LUCK_OVERCHARGE_SPAN = 3;
    const HIGH_LUCK_TIER_WEIGHT_MULTIPLIERS = {
        Common: 0.006,
        Uncommon: 0.025,
        Rare: 0.3,
        Epic: 1.3,
        Legendary: 7,
        Mythical: 18,
        Secret: 35,
        Ultra: 45,
        Hyper: 30,
        Omega: 12,
        Singularity: 3
    };
    const OVERCHARGED_LUCK_TIER_WEIGHT_MULTIPLIERS = {
        Common: 1,
        Uncommon: 1,
        Rare: 1,
        Epic: 1.05,
        Legendary: 1.2,
        Mythical: 1.8,
        Secret: 3,
        Ultra: 5,
        Hyper: 8,
        Omega: 14,
        Singularity: 18
    };

    const ULTRA_REVEAL_CONFIGS = {
        Ultra: {
            eyebrow: "Ultra Rarity Detected",
            particleCount: 24,
            ringCount: 1,
            beamCount: 0,
            particleSymbols: ["*", ".", "o"]
        },
        Hyper: {
            eyebrow: "Hyper Rarity Detected",
            particleCount: 34,
            ringCount: 2,
            beamCount: 3,
            particleSymbols: ["*", "+", "."]
        },
        Omega: {
            eyebrow: "Omega Rarity Detected",
            particleCount: 46,
            ringCount: 3,
            beamCount: 5,
            particleSymbols: ["*", "+", "x"]
        },
        Singularity: {
            eyebrow: "Singularity Rarity Detected",
            particleCount: 70,
            ringCount: 5,
            beamCount: 8,
            particleSymbols: ["*", "+", ".", "x"]
        }
    };

    const APEX_REVEAL_CONFIG = {
        eyebrow: "Apex Predator Detected",
        tierLabel: "Apex Mutation",
        particleCount: 84,
        ringCount: 6,
        beamCount: 12,
        particleSymbols: ["!", "A", "X", "\u25B2"]
    };

    const STREAK_LUCK_INTERVAL = 10;
    const STREAK_LUCK_BASE = 2;
    const CUTSCENE_SKIP_TIERS = ["Ultra", "Hyper", "Omega", "Singularity"];

    const SHOP_TIER_NAMES = [
        "Bronze", "Silver", "Gold", "Platinum", "Diamond",
        "Mythic", "Abyssal", "Celestial", "Void", "Singularity",
        "Event Horizon", "Quantum", "Eclipse", "Transcendent"
    ];

    const PLAYER_RANK_ICON = "\u{1F988}";
    const RANK_LUCK_PER_LEVEL = 0.025;
    const RANK_LUCK_MULTIPLIER_CAP = 3;
    const PRESTIGE_MIN_BEST_ONE_IN = 1_000_000;
    const PRESTIGE_ROLL_STEP = 750;
    const PRESTIGE_COLLECTION_STEP = 45;
    const PRESTIGE_HISTORY_LIMIT = 6;
    const PRESTIGE_LUCK_PER_POINT = 0.035;
    const PRESTIGE_COIN_PER_POINT = 0.025;
    const PRESTIGE_XP_PER_POINT = 0.015;
    const PRESTIGE_MULTI_ROLL_COUNTS = [1, 2, 3, 5, 8, 16, 32];
    const POTION_BUY_AMOUNT_MAX = 999_999;
    const INDEX_BUILD_BATCH_SIZE = 80;
    const INDEX_RENDER_BATCH_SIZE = 48;
    const RNG_MOBILE_BREAKPOINT_PX = 820;
    const MOBILE_INDEX_BUILD_BATCH_SIZE = 34;
    const MOBILE_INDEX_RENDER_BATCH_SIZE = 16;
    const MOBILE_AUTO_INDEX_BUILD_BATCH_SIZE = 22;
    const MOBILE_AUTO_INDEX_RENDER_BATCH_SIZE = 8;
    const MOBILE_COLLECTION_SEARCH_DELAY_MS = 160;
    const PRESTIGE_UPGRADE_DEFS = [
        {
            id: "pearlLuck",
            name: "Pearl Luck",
            icon: "fa-clover",
            desc: "Permanent luck on every run.",
            costs: [1, 2, 3, 5, 8, 13],
            format: (level) => `+${Math.round(level * 6)}% luck`
        },
        {
            id: "treasureCurrent",
            name: "Treasure Current",
            icon: "fa-coins",
            desc: "Permanent coin multiplier.",
            costs: [1, 2, 4, 6, 9, 14],
            format: (level) => `+${Math.round(level * 5)}% coins`
        },
        {
            id: "researchMemory",
            name: "Research Memory",
            icon: "fa-book-open",
            desc: "Permanent RNG XP gains.",
            costs: [1, 2, 4, 7, 10, 15],
            format: (level) => `+${Math.round(level * 4)}% XP`
        },
        {
            id: "swiftReturn",
            name: "Swift Return",
            icon: "fa-bolt",
            desc: "Permanent roll cooldown reduction.",
            costs: [2, 3, 5, 8, 12],
            format: (level) => `-${level * 60}ms cooldown`
        },
        {
            id: "starterCache",
            name: "Starter Cache",
            icon: "fa-box-open",
            desc: "Start each prestige run with coins.",
            costs: [2, 4, 7, 11, 16],
            format: (level) => `Start with ${formatCompactCoins(getPrestigeStarterCoinsForLevel(level))} coins`
        },
        {
            id: "mutagenArchive",
            name: "Mutagen Archive",
            icon: "fa-dna",
            desc: "Unlocks and boosts natural mutations forever.",
            costs: [3, 5, 8, 12, 17],
            format: (level) => `+${Math.round(level * 8)}% mutation odds`
        },
        {
            id: "apexMemory",
            name: "Apex Memory",
            icon: "fa-crown",
            desc: "Unlocks and boosts rare Apex rolls forever.",
            costs: [4, 7, 11, 16, 22],
            format: (level) => `+${Math.round(level * 6)}% Apex odds`
        },
        {
            id: "abyssBounty",
            name: "Abyss Bounty",
            icon: "fa-sack-dollar",
            desc: "Mutated species pay more coins forever.",
            costs: [2, 4, 7, 11, 16],
            format: (level) => `+${Math.round(level * 10)}% mutated coins`
        },
        {
            id: "potionSatchel",
            name: "Potion Satchel",
            icon: "fa-flask",
            desc: "Begin each prestige run with free potions.",
            costs: [3, 6, 10, 15],
            format: (level) => `${getPrestigeStarterPotionTotal(level)} starter potion${getPrestigeStarterPotionTotal(level) === 1 ? "" : "s"}`
        },
        {
            id: "autoSpark",
            name: "Auto Spark",
            icon: "fa-robot",
            desc: "Begin each prestige run with Auto Roll levels.",
            costs: [4, 8, 14],
            format: (level) => level ? `Start with Auto Lv.${level}` : "Auto locked"
        },
        {
            id: "multiRoll",
            name: "Multi Roll",
            icon: "fa-layer-group",
            desc: "Roll several species per click or Auto Roll burst.",
            costs: [4, 9, 18, 32, 55, 90],
            format: (level) => `${getPrestigeMultiRollCount(level)} roll${getPrestigeMultiRollCount(level) === 1 ? "" : "s"} per action`
        },
        {
            id: "legacyTide",
            name: "Legacy Tide",
            icon: "fa-water",
            desc: "Earn more prestige points from each rebirth.",
            costs: [5, 9, 14, 20],
            format: (level) => `+${Math.round(level * 10)}% prestige gain`
        },
        {
            id: "surveyCompass",
            name: "Survey Compass",
            icon: "fa-compass",
            desc: "New finds count extra toward prestige progress.",
            costs: [3, 6, 10, 15, 21],
            format: (level) => `+${Math.round(level * 12)}% new-find value`
        },
        {
            id: "deepVault",
            name: "Deep Vault",
            icon: "fa-vault",
            desc: "Rare pulls pay extra coins forever.",
            costs: [3, 5, 9, 14, 20],
            format: (level) => `+${Math.round(level * 7)}% rare-pull coins`
        },
        {
            id: "potionContract",
            name: "Potion Contract",
            icon: "fa-file-signature",
            desc: "Permanent discount on potion shop prices.",
            costs: [3, 6, 10, 15],
            format: (level) => `${Math.round(level * 5)}% potion discount`
        },
        {
            id: "rankAnchor",
            name: "Rank Anchor",
            icon: "fa-anchor",
            desc: "Keep a little RNG XP after each rebirth.",
            costs: [4, 7, 12, 18],
            format: (level) => `Keep ${Math.round(level * 5)}% RNG XP`
        },
        {
            id: "streakEngine",
            name: "Streak Engine",
            icon: "fa-fire",
            desc: "Permanent boost to streak luck power.",
            costs: [2, 5, 9, 14, 20],
            format: (level) => `+${Math.round(level * 8)}% streak power`
        },
        {
            id: "rareBeacon",
            name: "Rare Beacon",
            icon: "fa-tower-broadcast",
            desc: "Run best pulls count harder toward prestige.",
            costs: [4, 8, 13, 19],
            format: (level) => `+${Math.round(level * 12)}% best-pull value`
        },
        {
            id: "timePearl",
            name: "Time Pearl",
            icon: "fa-hourglass-half",
            desc: "Auto Roll starts faster after every rebirth.",
            costs: [3, 6, 11, 17],
            format: (level) => `-${level * 80}ms auto interval`
        },
        {
            id: "indexCartography",
            name: "Index Cartography",
            icon: "fa-map",
            desc: "Index milestone luck becomes stronger forever.",
            costs: [4, 8, 13, 19, 26],
            format: (level) => `+${Math.round(level * 10)}% index luck value`
        },
        {
            id: "potionCatalyst",
            name: "Potion Catalyst",
            icon: "fa-vial-circle-check",
            desc: "All used potions last longer.",
            costs: [3, 6, 10, 15, 21],
            format: (level) => `+${Math.round(level * 8)}% potion duration`
        },
        {
            id: "restockCrew",
            name: "Restock Crew",
            icon: "fa-people-carry-box",
            desc: "Abyss and Omega potion restocks tick down faster.",
            costs: [4, 7, 12, 18],
            format: (level) => `${Math.round(level * 8)}% faster restocks`
        },
        {
            id: "xpSurge",
            name: "XP Surge",
            icon: "fa-chart-line",
            desc: "Rare and better pulls grant extra RNG XP.",
            costs: [3, 6, 11, 17, 24],
            format: (level) => `+${Math.round(level * 9)}% rare-pull XP`
        },
        {
            id: "ultraDividend",
            name: "Ultra Dividend",
            icon: "fa-gem",
            desc: "Ultra rare pulls pay a permanent coin premium.",
            costs: [5, 9, 15, 22],
            format: (level) => `+${Math.round(level * 12)}% ultra coins`
        },
        {
            id: "momentumEngine",
            name: "Momentum Engine",
            icon: "fa-forward-fast",
            desc: "Long prestige runs slowly build extra luck.",
            costs: [4, 8, 14, 21],
            format: (level) => `+${Math.round(level * 4)}% luck per 250 rolls`
        }
    ];

    const UPGRADE_SHOP_DEFS = [
        { id: "luck", name: "Luck", icon: "fa-clover", levelKey: "luckLevel", listKey: "luck" },
        { id: "streak", name: "Streak Luck", icon: "fa-fire", levelKey: "streakLuckLevel", listKey: "streak" },
        { id: "coin", name: "Coin Boost", icon: "fa-coins", levelKey: "coinLevel", listKey: "coin" },
        { id: "speed", name: "Roll Speed", icon: "fa-bolt", levelKey: "rollSpeedLevel", listKey: "speed" },
        { id: "auto", name: "Auto Roll", icon: "fa-robot", levelKey: "autoRollLevel", listKey: "auto" },
        { id: "mutation", name: "Mutation Luck", icon: "fa-dna", levelKey: "mutationLevel", listKey: "mutation" },
        { id: "apex", name: "Apex Instinct", icon: "fa-crown", levelKey: "apexLevel", listKey: "apex" },
        { id: "mutationBounty", name: "Mutation Bounty", icon: "fa-sack-dollar", levelKey: "mutationBountyLevel", listKey: "mutationBounty" },
        { id: "potionRestock", name: "Potion Restock", icon: "fa-hourglass-half", levelKey: "potionRestockLevel", listKey: "potionRestock" },
        { id: "xp", name: "Research XP", icon: "fa-book-open", levelKey: "xpLevel", listKey: "xp" }
    ];

    function buildIndexRewardDefs() {
        const rewards = [
            {
                id: "index_20_luck",
                goal: 20,
                title: "First Survey",
                rewardText: "+5% permanent luck",
                effects: [{ type: "luckBonus", amount: 0.05 }]
            }
        ];

        const legacyIds = {
            300: "index_300_mutagen",
            500: "index_500_omega",
            1000: "index_1000_omega"
        };

        for (let goal = 50; goal <= 3200; goal += 50) {
            const id = legacyIds[goal] || `index_${goal}`;
            let title = "Index Grant";
            let rewardText = "";
            let effects = [];

            if (goal % 500 === 0) {
                const amount = Math.max(1, Math.floor(goal / 500));
                title = goal >= 2000 ? "Omega Treasury" : "Omega Cache";
                rewardText = `${amount} Omega Potion${amount === 1 ? "" : "s"}`;
                effects = [{ type: "potion", key: "omega", amount }];
            } else if (goal % 250 === 0) {
                const amount = Math.round((0.02 + Math.floor(goal / 500) * 0.01) * 100) / 100;
                title = "Survey Bonus";
                rewardText = `+${Math.round(amount * 100)}% permanent luck`;
                effects = [{ type: "luckBonus", amount }];
            } else if (goal % 150 === 0) {
                const amount = 1 + Math.floor(goal / 900);
                title = "Mutagen Cache";
                rewardText = `${amount} Mutagen Storm Potion${amount === 1 ? "" : "s"}`;
                effects = [{ type: "potion", key: "randomMutation", amount }];
            } else if (goal % 100 === 0) {
                const amount = 1 + Math.floor(goal / 1000);
                title = "Abyss Cache";
                rewardText = `${amount} Abyss Potion${amount === 1 ? "" : "s"}`;
                effects = [{ type: "potion", key: "ultra", amount }];
            } else {
                const amount = Math.floor(25000 * Math.pow(1.11, (goal / 50) - 1));
                title = "Coin Cache";
                rewardText = `${formatCompactCoins(amount)} coins`;
                effects = [{ type: "coins", amount }];
            }

            rewards.push({ id, goal, title, rewardText, effects });
        }

        for (let goal = 3600; goal <= 14800; goal += 400) {
            let title = "Deep Index Grant";
            let rewardText = "";
            let effects = [];

            if (goal % 2000 === 0) {
                title = "Deep Survey Bonus";
                rewardText = "+5% permanent luck";
                effects = [{ type: "luckBonus", amount: 0.05 }];
            } else if (goal % 1200 === 0) {
                const amount = Math.max(2, Math.floor(goal / 3600));
                title = "Omega Reserve";
                rewardText = `${amount} Omega Potion${amount === 1 ? "" : "s"}`;
                effects = [{ type: "potion", key: "omega", amount }];
            } else if (goal % 800 === 0) {
                const amount = Math.max(2, Math.floor(goal / 2800));
                title = "Mutagen Reserve";
                rewardText = `${amount} Mutagen Storm Potion${amount === 1 ? "" : "s"}`;
                effects = [{ type: "potion", key: "randomMutation", amount }];
            } else {
                const lateStep = Math.max(1, (goal - 3200) / 400);
                const amount = Math.floor(30000000 * Math.pow(1.18, lateStep));
                title = "Deep Coin Cache";
                rewardText = `${formatCompactCoins(amount)} coins`;
                effects = [{ type: "coins", amount }];
            }

            rewards.push({ id: `index_${goal}`, goal, title, rewardText, effects });
        }

        rewards.push({
            id: "index_complete",
            goal: 15108,
            title: "Complete Index",
            rewardText: "+25% permanent luck + 5 Omega",
            effects: [
                { type: "luckBonus", amount: 0.25 },
                { type: "potion", key: "omega", amount: 5 }
            ]
        });

        return rewards;
    }

    function getShopTierName(level) {
        const tierIndex = Math.min(Math.floor((level - 1) / 5), SHOP_TIER_NAMES.length - 1);
        const subLevel = ((level - 1) % 5) + 1;
        return `${SHOP_TIER_NAMES[tierIndex]} ${subLevel}`;
    }

    function getShopTierClass(level) {
        const tierIndex = Math.min(Math.floor((level - 1) / 5), SHOP_TIER_NAMES.length - 1);
        return `shop-tier-${tierIndex}`;
    }

    function buildLuckUpgrades() {
        const list = [];
        for (let i = 1; i <= 50; i++) {
            list.push({
                level: i,
                bonus: Math.round((0.2 + i * 0.28 + Math.floor(i / 10) * 0.8) * 100) / 100,
                cost: Math.floor(350 * Math.pow(1.19, i - 1)),
                shopTier: getShopTierName(i),
                tierClass: getShopTierClass(i)
            });
        }
        for (let i = 51; i <= 70; i++) {
            const extraLevel = i - 51;
            list.push({
                level: i,
                bonus: Math.round((8 + extraLevel * 0.45) * 100) / 100,
                cost: Math.floor(120_000_000 * Math.pow(1.37, extraLevel)),
                shopTier: getShopTierName(i),
                tierClass: getShopTierClass(i)
            });
        }
        return list;
    }

    function buildCoinUpgrades() {
        const list = [];
        for (let i = 1; i <= 40; i++) {
            list.push({
                level: i,
                bonus: Math.round((0.1 + i * 0.035) * 100) / 100,
                cost: Math.floor(500 * Math.pow(1.2, i - 1)),
                shopTier: getShopTierName(i),
                tierClass: getShopTierClass(i)
            });
        }
        for (let i = 41; i <= 60; i++) {
            const extraLevel = i - 41;
            list.push({
                level: i,
                bonus: Math.round((0.8 + extraLevel * 0.05) * 100) / 100,
                cost: Math.floor(90_000_000 * Math.pow(1.35, extraLevel)),
                shopTier: getShopTierName(i + 10),
                tierClass: getShopTierClass(i + 10)
            });
        }
        return list;
    }

    function buildRollSpeedUpgrades() {
        const reductions = [80, 90, 100, 105, 110, 115, 120, 125, 130, 135, 145, 155, 15];
        return reductions.map((reduction, index) => {
            const level = index + 1;
            const eliteLevel = level > 12;
            return {
                level,
                reduction,
                cost: eliteLevel ? 750_000_000 : Math.floor(650 * Math.pow(1.42, index)),
                shopTier: getShopTierName(eliteLevel ? 51 : level),
                tierClass: getShopTierClass(eliteLevel ? 51 : level)
            };
        });
    }

    function buildAutoRollUpgrades() {
        const intervals = [2800, 2400, 2100, 1850, 1600, 1400, 1250, 1100, 980, 880, 780, 700, 640, 600];
        const costs = [
            25000, 75000, 200000, 650000, 1800000, 5000000, 14000000, 40000000,
            250_000_000, 650_000_000, 1_500_000_000, 3_500_000_000, 8_000_000_000, 20_000_000_000
        ];

        return intervals.map((interval, index) => {
            const level = index + 1;
            const shopLevel = level <= 8 ? level : level + 42;
            return {
                level,
                interval,
                cost: costs[index],
                shopTier: getShopTierName(shopLevel),
                tierClass: getShopTierClass(shopLevel)
            };
        });
    }

    function buildXpUpgrades() {
        const list = [];
        for (let i = 1; i <= 25; i++) {
            list.push({
                level: i,
                bonus: Math.round((0.08 + i * 0.025) * 1000) / 1000,
                cost: Math.floor(2500 * Math.pow(1.24, i - 1)),
                shopTier: getShopTierName(i),
                tierClass: getShopTierClass(i)
            });
        }
        for (let i = 26; i <= 40; i++) {
            const extraLevel = i - 26;
            list.push({
                level: i,
                bonus: Math.round((0.75 + extraLevel * 0.045) * 1000) / 1000,
                cost: Math.floor(80_000_000 * Math.pow(1.34, extraLevel)),
                shopTier: getShopTierName(i + 25),
                tierClass: getShopTierClass(i + 25)
            });
        }
        return list;
    }

    function buildStreakUpgrades() {
        const list = [];
        for (let i = 1; i <= 15; i++) {
            list.push({
                level: i,
                mult: Math.round((2.5 + (i - 1) * 0.5 + Math.floor(i / 5) * 0.5) * 10) / 10,
                cost: Math.floor(6000 * Math.pow(1.28, i - 1)),
                shopTier: getShopTierName(i),
                tierClass: getShopTierClass(i)
            });
        }
        for (let i = 16; i <= 30; i++) {
            const extraLevel = i - 16;
            list.push({
                level: i,
                mult: Math.round((11.5 + extraLevel * 0.6) * 10) / 10,
                cost: Math.floor(150_000_000 * Math.pow(1.33, extraLevel)),
                shopTier: getShopTierName(i + 35),
                tierClass: getShopTierClass(i + 35)
            });
        }
        return list;
    }

    function buildMutationUpgrades() {
        const list = [];
        for (let i = 1; i <= 50; i++) {
            // Approx 1.13\u00d7 per level; Lv1 = 1 in 50 000, Lv50 = 1 in ~295
            const chanceOneIn = Math.round(50_000 / Math.pow(1.13, i - 1));
            list.push({
                level: i,
                chance: Math.max(100, chanceOneIn),
                cost: Math.floor(8000 * Math.pow(1.18, i - 1)),
                shopTier: getShopTierName(i + 14),   // mutation tier offset from luck upgrades
                tierClass: getShopTierClass(i + 14)
            });
        }
        for (let i = 51; i <= 70; i++) {
            const extraLevel = i - 51;
            const chanceOneIn = Math.round(100 / Math.pow(1.075, extraLevel + 1));
            list.push({
                level: i,
                chance: Math.max(25, chanceOneIn),
                cost: Math.floor(160_000_000 * Math.pow(1.38, extraLevel)),
                shopTier: getShopTierName(i),
                tierClass: getShopTierClass(i)
            });
        }
        return list;
    }

    const APEX_UPGRADE_BASE_ONE_IN = 4_000_000;
    const APEX_UPGRADE_MIN_ONE_IN = 60_000;
    const APEX_PRESTIGE_UNLOCK_ONE_IN = 2_500_000;
    const APEX_SURGE_POTION_ONE_IN = 5000;

    function buildApexUpgrades() {
        const list = [];
        for (let i = 1; i <= 30; i++) {
            // Apex is natural-only, so even max level keeps it rarer than normal mutations.
            const chanceOneIn = Math.round(APEX_UPGRADE_BASE_ONE_IN / Math.pow(1.15, i - 1));
            list.push({
                level: i,
                chance: Math.max(APEX_UPGRADE_MIN_ONE_IN, chanceOneIn),
                cost: Math.floor(250_000 * Math.pow(1.26, i - 1)),
                shopTier: getShopTierName(i + 20),
                tierClass: getShopTierClass(i + 20)
            });
        }
        return list;
    }

    function buildMutationBountyUpgrades() {
        const list = [];
        for (let i = 1; i <= 30; i++) {
            const extraLevel = i - 1;
            list.push({
                level: i,
                bonus: Math.round((0.12 + extraLevel * 0.035) * 1000) / 1000,
                cost: Math.floor(250_000_000 * Math.pow(1.42, extraLevel)),
                shopTier: getShopTierName(i + 45),
                tierClass: getShopTierClass(i + 45)
            });
        }
        return list;
    }

    function buildPotionRestockUpgrades() {
        const list = [];
        for (let i = 1; i <= 15; i++) {
            const progress = i / 15;
            list.push({
                level: i,
                ultraRestock: Math.max(5, Math.round(20 - (15 * progress))),
                omegaRestock: Math.max(20, Math.round(80 - (60 * progress))),
                cost: Math.floor(200_000_000 * Math.pow(1.6, i - 1)),
                shopTier: getShopTierName(i + 50),
                tierClass: getShopTierClass(i + 50)
            });
        }
        return list;
    }

    const MUTATION_UPGRADES = buildMutationUpgrades();
    const APEX_MUTATION_UPGRADES = buildApexUpgrades();

    const UPGRADE_LISTS = {
        luck: buildLuckUpgrades(),
        streak: buildStreakUpgrades(),
        coin: buildCoinUpgrades(),
        speed: buildRollSpeedUpgrades(),
        auto: buildAutoRollUpgrades(),
        mutation: MUTATION_UPGRADES,
        apex: APEX_MUTATION_UPGRADES,
        mutationBounty: buildMutationBountyUpgrades(),
        potionRestock: buildPotionRestockUpgrades(),
        xp: buildXpUpgrades()
    };

    const LUCK_UPGRADES = UPGRADE_LISTS.luck;
    const STREAK_LUCK_UPGRADES = UPGRADE_LISTS.streak;
    const COIN_UPGRADES = UPGRADE_LISTS.coin;
    const ROLL_SPEED_UPGRADES = UPGRADE_LISTS.speed;
    const AUTO_ROLL_UPGRADES = UPGRADE_LISTS.auto;
    const MUTATION_LUCK_UPGRADES = UPGRADE_LISTS.mutation;
    const APEX_LUCK_UPGRADES = UPGRADE_LISTS.apex;
    const MUTATION_BOUNTY_UPGRADES = UPGRADE_LISTS.mutationBounty;
    const POTION_RESTOCK_UPGRADES = UPGRADE_LISTS.potionRestock;
    const XP_UPGRADES = UPGRADE_LISTS.xp;

    const POTION_DEFS = {
        luckMinor: {
            name: "Minor Luck Potion",
            icon: "\u{1F343}",
            desc: "1.35\u00d7 luck for 25 rolls",
            cost: 1200,
            rolls: 25,
            luckMult: 1.35,
            category: "luck"
        },
        luck: {
            name: "Luck Potion",
            icon: "\u{1F340}",
            desc: "1.8\u00d7 luck for 15 rolls",
            cost: 2800,
            rolls: 15,
            luckMult: 1.8,
            category: "luck"
        },
        luckStrong: {
            name: "Strong Luck Potion",
            icon: "\u2728",
            desc: "2.5\u00d7 luck for 12 rolls",
            cost: 7500,
            rolls: 12,
            luckMult: 2.5,
            category: "luck"
        },
        luckMega: {
            name: "Mega Luck Potion",
            icon: "\u{1F31F}",
            desc: "4\u00d7 luck for 6 rolls",
            cost: 22000,
            rolls: 6,
            luckMult: 4,
            category: "luck"
        },
        luckVoid: {
            name: "Ultra Luck Potion",
            icon: "\u{1F300}",
            desc: "8\u00d7 luck for 3 rolls",
            cost: 85000,
            rolls: 3,
            luckMult: 8,
            category: "luck"
        },
        coin: {
            name: "Coin Potion",
            icon: "\u{1F4B0}",
            desc: "2.5\u00d7 coins for 20 rolls",
            cost: 2200,
            rolls: 20,
            coinMult: 2.5
        },
        speed: {
            name: "Speed Potion",
            icon: "\u26A1",
            desc: "50% faster roll cooldown for 25 rolls",
            cost: 2600,
            rolls: 25
        },
        ultra: {
            name: "Abyss Potion",
            icon: "\u{1F30A}",
            desc: "Guaranteed 1 in 1M+ species; restocks after 20 normal rolls",
            cost: 1000000,
            rolls: 1,
            maxOwned: 1,
            restockRolls: 20
        },
        omega: {
            name: "Omega Potion",
            icon: "\u{1F31F}",
            desc: "Guaranteed 1 in 100M+ species; restocks after 80 normal rolls",
            cost: 250000000,
            rolls: 1,
            maxOwned: 1,
            restockRolls: 80
        },
        apexSurge: {
            name: "Apex Surge Potion",
            icon: "\u{1F988}",
            desc: "Apex rolls become 1 in 5,000 for your next roll, not guaranteed",
            cost: 1000000000,
            rolls: 1,
            maxOwned: 1,
            fixedRolls: true
        },
        albino: {
            name: "Albino Potion",
            icon: "\u{1F90D}",
            desc: "Guaranteed albino mutation; reduced coin payout",
            cost: 2000000,
            rolls: 1
        },
        shiny: {
            name: "Shiny Potion",
            icon: "\u2728",
            desc: "Guaranteed shiny mutation; reduced coin payout",
            cost: 5000000,
            rolls: 1
        },
        bioluminescent: {
            name: "Bioluminescent Potion",
            icon: "\u{1F9EC}",
            desc: "Guaranteed bioluminescent mutation; reduced coin payout",
            cost: 10000000,
            rolls: 1
        },
        megatooth: {
            name: "Megatooth Potion",
            icon: "\u{1F9B7}",
            desc: "Guaranteed megatooth mutation; reduced coin payout",
            cost: 50000000,
            rolls: 1
        },
        randomMutation: {
            name: "Mutagen Storm Potion",
            icon: "\u{1F9EC}",
            desc: "Guaranteed random mutation for 50 rolls; reduced coin payout",
            cost: 100000000,
            rolls: 50
        }
    };

    // === MUTATION SYSTEM ===
    // Visual mutations can roll on any species and massively inflate its oneIn.
    // Apex is natural-only and uses its own upgrade path or temporary odds boost.
    // With no mutation Luck upgrades the base chance is essentially zero.
    const MUTATION_TYPES = {
        melanistic: {
            name: "Melanistic",
            icon: "\u26AB",
            oneInMult: 3,
            color: "#94a3b8",
            scoreBonus: 18,
            rollWeight: 50
        },
        albino: {
            name: "Albino",
            icon: "\u{1F90D}",
            oneInMult: 5,
            color: "#f1f5f9",
            scoreBonus: 30,
            rollWeight: 42
        },
        shiny: {
            name: "Shiny",
            icon: "\u2728",
            oneInMult: 7,
            color: "#fde047",
            scoreBonus: 22,
            rollWeight: 28
        },
        bioluminescent: {
            name: "Bioluminescent",
            icon: "\u{1F9EC}",
            oneInMult: 10,
            color: "#22d3ee",
            scoreBonus: 16,
            rollWeight: 22
        },
        copper: {
            name: "Copper",
            icon: "\u{1F7E0}",
            oneInMult: 14,
            color: "#fb923c",
            scoreBonus: 20,
            rollWeight: 17
        },
        golden: {
            name: "Golden",
            icon: "\u{1F3C6}",
            oneInMult: 20,
            color: "#fbbf24",
            scoreBonus: 28,
            rollWeight: 12
        },
        spectral: {
            name: "Spectral",
            icon: "\u{1F47B}",
            oneInMult: 30,
            color: "#c4b5fd",
            scoreBonus: 34,
            rollWeight: 8
        },
        abyssal: {
            name: "Abyssal",
            icon: "\u{1F311}",
            oneInMult: 40,
            color: "#818cf8",
            scoreBonus: 36,
            rollWeight: 6
        },
        megatooth: {
            name: "Megatooth",
            icon: "\u{1F9B7}",
            oneInMult: 55,
            color: "#f87171",
            scoreBonus: 38,
            rollWeight: 4
        },
        cosmic: {
            name: "Cosmic",
            icon: "\u{1F30C}",
            oneInMult: 80,
            color: "#e879f9",
            scoreBonus: 42,
            rollWeight: 2
        },
        apex: {
            name: "Apex",
            icon: "\u{1F988}",
            oneInMult: 120,  // species becomes 120\u00d7 rarer
            color: "#fb923c",
            scoreBonus: 45,
            naturalOnly: true
        }
    };

    const STANDARD_MUTATION_KEYS = Object.keys(MUTATION_TYPES)
        .filter((key) => !MUTATION_TYPES[key].naturalOnly);
    const MUTATION_CHANCE_ORDER = [
        "melanistic",
        "albino",
        "shiny",
        "bioluminescent",
        "copper",
        "golden",
        "spectral",
        "abyssal",
        "megatooth",
        "cosmic",
        "apex"
    ];

    const TIER_ORDER = TIERS.map((tier) => tier.name);
    const TIER_RANK = Object.fromEntries(TIER_ORDER.map((name, index) => [name, index]));

let rollPool = [];
     let ultraRarePool = [];
     let tierPools = {};
     let player = createDefaultPlayer();
     let autoEnabled = false;
     let autoArrowDismissed = localStorage.getItem(AUTO_ARROW_DISMISSED_KEY) === "true";
     let autoInterval = null;
     let isRolling = false;
     let rollLockedUntil = 0;
     let cooldownInterval = null;
    let potionTickTimer = null;
    let cutsceneResolve = null;
    let audioCtx = null;
    let rngLeaderboardDb = null;
    let rngLeaderboardAuth = null;
    let rngLeaderboardUser = null;
    let rngLeaderboardProfileCache = null;
    let rngLeaderboardSyncTimer = null;
    let rngLeaderboardLastSyncAt = 0;
    let rngLeaderboardLoading = false;
    let rngDevForcedMutationType = null;
    let rngAdminNextRollCommand = null;
    let rngAdminNextRollUnsubscribe = null;
    let rngCloudSaveTimer = null;
    let rngCloudSaveDirty = false;
    let rngCloudSaveInFlight = false;
    let rngCloudHydratedUid = null;
    let collectionSortRarestFirst = true;
    let collectionGridDirty = false;
    let collectionRenderTimer = null;
    let collectionRenderToken = 0;
    let collectionSearchTimer = null;
    let rngViewportSyncTimer = null;
    let localSaveTimer = null;
    let localSaveDirty = false;
    let localSaveFlushBound = false;
    let selectedPotionBuyAmount = 1;

    function isRngMobileViewport() {
        return Boolean(
            window.innerWidth <= RNG_MOBILE_BREAKPOINT_PX ||
            window.matchMedia?.(`(max-width: ${RNG_MOBILE_BREAKPOINT_PX}px)`)?.matches ||
            window.matchMedia?.("(pointer: coarse)")?.matches
        );
    }

    function isRngLowPowerMode() {
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        const saveData = navigator.connection?.saveData;
        const lowCoreDevice = (navigator.hardwareConcurrency || 8) <= 4;
        return Boolean(reducedMotion || saveData || lowCoreDevice || isRngMobileViewport());
    }

    function syncRngViewportClasses() {
        document.body?.classList.toggle("rng-mobile", isRngMobileViewport());
        document.body?.classList.toggle("rng-low-power", isRngLowPowerMode());
    }

    function bindRngViewportSync() {
        syncRngViewportClasses();
        window.addEventListener("resize", () => {
            if (rngViewportSyncTimer) clearTimeout(rngViewportSyncTimer);
            rngViewportSyncTimer = setTimeout(() => {
                syncRngViewportClasses();
                if (isCollectionModalOpen()) renderCollectionGrid({ force: true });
            }, 140);
        }, { passive: true });
    }

    function shouldSuppressLightRngFx(id = "") {
        return Boolean(autoEnabled && isRngLowPowerMode() && ["roll", "tick", "coin"].includes(id));
    }

    function getCollectionBuildBatchSize() {
        if (!isRngMobileViewport()) return INDEX_BUILD_BATCH_SIZE;
        return autoEnabled ? MOBILE_AUTO_INDEX_BUILD_BATCH_SIZE : MOBILE_INDEX_BUILD_BATCH_SIZE;
    }

    function getCollectionRenderBatchSize() {
        if (!isRngMobileViewport()) return INDEX_RENDER_BATCH_SIZE;
        return autoEnabled ? MOBILE_AUTO_INDEX_RENDER_BATCH_SIZE : MOBILE_INDEX_RENDER_BATCH_SIZE;
    }

    function getCollectionRenderDelayMs() {
        if (autoEnabled && isRngMobileViewport()) return 38;
        if (autoEnabled) return 14;
        return isRngMobileViewport() ? 8 : 0;
    }

    const GameFx = {
        initAudio() {
            if (audioCtx || !getSettings().soundEnabled) return;
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                audioCtx = null;
            }
        },

        resumeAudio() {
            if (audioCtx?.state === "suspended") audioCtx.resume();
        },

        playTone(freq, duration, type = "sine", volume = 0.08) {
            if (!getSettings().soundEnabled) return;
            this.resumeAudio();
            if (!audioCtx) this.initAudio();
            if (!audioCtx) return;

            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.value = volume;
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        },

        play(id) {
            if (shouldSuppressLightRngFx(id)) return;
            const tones = {
                roll: [[320, 0.05], [480, 0.07]],
                tick: [[520, 0.04]],
                rare: [[440, 0.06], [660, 0.08], [880, 0.1]],
                jackpot: [[220, 0.08], [330, 0.08], [440, 0.1], [660, 0.14], [880, 0.18]],
                upgrade: [[600, 0.05], [900, 0.08]],
                coin: [[740, 0.04], [980, 0.05]],
                new: [[500, 0.06], [750, 0.08]]
            };
            const seq = tones[id] || tones.tick;
            seq.forEach(([freq, dur], i) => {
                setTimeout(() => this.playTone(freq, dur, "triangle", 0.06), i * 90);
            });
        },

        shake(intensity = "light") {
            if (isRngLowPowerMode() && intensity !== "heavy") return;
            const stage = document.querySelector(".rng-game-shell");
            if (!stage) return;
            stage.classList.remove("rng-shake-light", "rng-shake-medium", "rng-shake-heavy");
            void stage.offsetWidth;
            stage.classList.add(`rng-shake-${intensity}`);
            setTimeout(() => stage.classList.remove(`rng-shake-${intensity}`), intensity === "heavy" ? 520 : 320);
        },

        floatText(text, className = "") {
            if (autoEnabled && isRngLowPowerMode() && className.includes("coin")) return;
            const layer = document.getElementById("rng-float-layer");
            if (!layer) return;
            const el = document.createElement("span");
            el.className = `rng-float-text ${className}`;
            el.textContent = text;
            layer.appendChild(el);
            requestAnimationFrame(() => el.classList.add("show"));
            setTimeout(() => el.remove(), 1100);
        },

        pulseRollButton() {
            if (autoEnabled && isRngLowPowerMode()) return;
            document.getElementById("rng-roll-btn")?.classList.add("rng-pulse");
            setTimeout(() => document.getElementById("rng-roll-btn")?.classList.remove("rng-pulse"), 220);
        }
    };

    function createDefaultPotions() {
        const potions = {};
        for (const key of Object.keys(POTION_DEFS)) {
            potions[key] = 0;
        }
        return potions;
    }

    function createDefaultPlayer() {
        return {
            coins: 0,
            rolls: 0,
            luckLevel: 0,
            streakLuckLevel: 0,
            coinLevel: 0,
            rollSpeedLevel: 0,
            autoRollLevel: 0,
            mutationLevel: 0,
            apexLevel: 0,
            mutationBountyLevel: 0,
            potionRestockLevel: 0,
            xpLevel: 0,
            collection: {},
            claimedIndexRewards: [],
            adminNextRollConsumedIds: [],
            dailyQuests: createDefaultDailyQuestState(),
            quests: createDefaultQuestState(),
            equipped: null,
            bestOneIn: 0,
            runBestOneIn: 0,
            runCollectionFinds: 0,
            potions: createDefaultPotions(),
            potionRestock: {
                ultra: 0,
                omega: 0
            },
            activeEffects: {
                luck: { remaining: 0, mult: 1, stacks: [] },
                coin: { remaining: 0, mult: 1 },
                speed: { remaining: 0 },
                ultra: { remaining: 0 },
                omega: { remaining: 0 },
                apexSurge: { remaining: 0 },
                albino: { remaining: 0 },
                shiny: { remaining: 0 },
                bioluminescent: { remaining: 0 },
                megatooth: { remaining: 0 },
                randomMutation: { remaining: 0 }
            },
            settings: {
                disableRarePopups: false,
                soundEnabled: true,
                skipCutscenes: Object.fromEntries(CUTSCENE_SKIP_TIERS.map((tier) => [tier, false])),
                seenCutscenes: Object.fromEntries(CUTSCENE_SKIP_TIERS.map((tier) => [tier, false]))
            },
            rngXp: 0,
            prestigeLevel: 0,
            prestigePoints: 0,
            totalPrestigePoints: 0,
            highestPrestigeGain: 0,
            prestigeUpgrades: {},
            prestigeHistory: []
        };
    }

    function getSettings() {
        if (!player.settings || typeof player.settings !== "object") {
            player.settings = {};
        }
        const defaults = createDefaultPlayer().settings;
        player.settings = {
            ...defaults,
            ...player.settings,
            skipCutscenes: {
                ...defaults.skipCutscenes,
                ...(player.settings.skipCutscenes || {})
            },
            seenCutscenes: {
                ...defaults.seenCutscenes,
                ...(player.settings.seenCutscenes || {})
            }
        };
        return player.settings;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function toSafeNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    function normalizeRngLookupText(value) {
        return String(value ?? "")
            .trim()
            .toLowerCase()
            .replace(/'/g, "")
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    }

    function getTimestampMs(value) {
        if (typeof value?.toMillis === "function") return value.toMillis();
        return toSafeNumber(value);
    }

    function getBestEquippableCollectionEntry() {
        let best = null;

        for (const [key, entry] of Object.entries(player.collection || {})) {
            if (!entry || typeof entry !== "object") continue;
            const oneIn = toSafeNumber(entry?.oneIn);
            if (oneIn <= 0) continue;

            const count = Math.max(0, Math.floor(Number(entry.count) || 0));
            const firstRoll = Math.max(1, toSafeNumber(entry.firstRoll) || Number.MAX_SAFE_INTEGER);
            const isBetter = !best
                || oneIn > best.oneIn
                || (oneIn === best.oneIn && count > best.count)
                || (oneIn === best.oneIn && count === best.count && firstRoll < best.firstRoll);

            if (isBetter) {
                best = {
                    key,
                    entry,
                    tier: getOddsTierName(entry),
                    oneIn,
                    count,
                    firstRoll
                };
            }
        }

        return best;
    }

    function getBestCollectionEntry() {
        const bestEquippable = getBestEquippableCollectionEntry();
        if (bestEquippable) {
            return {
                name: bestEquippable.key,
                tier: bestEquippable.tier,
                oneIn: bestEquippable.oneIn
            };
        }

        let best = null;

        if (!best && player.bestOneIn > 0) {
            best = {
                name: "Unknown species",
                tier: tierNameFromOneIn(player.bestOneIn),
                oneIn: player.bestOneIn
            };
        }

        return best;
    }

    function compareRngLeaderboardRows(a, b) {
        const bestDiff = toSafeNumber(b.bestOneIn) - toSafeNumber(a.bestOneIn);
        if (bestDiff !== 0) return bestDiff;

        const rollDiff = toSafeNumber(b.rolls) - toSafeNumber(a.rolls);
        if (rollDiff !== 0) return rollDiff;

        return getTimestampMs(b.updatedAt) - getTimestampMs(a.updatedAt);
    }

    function getEmailUsername(user) {
        return user?.email ? String(user.email).split("@")[0] : "";
    }

    function normalizeRngUsername(username) {
        return String(username || "").trim().slice(0, 32);
    }

    function isDefaultEmailUsername(username, user) {
        const normalized = normalizeRngUsername(username).toLowerCase();
        const emailName = getEmailUsername(user).toLowerCase();
        return Boolean(normalized && emailName && normalized === emailName);
    }

    function isMeaningfulRngUsername(username, user) {
        const normalized = normalizeRngUsername(username);
        return Boolean(
            normalized &&
            normalized !== "Anonymous" &&
            !isDefaultEmailUsername(normalized, user)
        );
    }

    function readStoredJson(key) {
        try {
            return JSON.parse(localStorage.getItem(key) || "{}");
        } catch (error) {
            return {};
        }
    }

    function getLocalRngUsernameCandidates(user) {
        const candidates = [];
        if (typeof window.getCurrentProfileData === "function") {
            try {
                candidates.push(window.getCurrentProfileData()?.username);
            } catch (error) {
                console.warn("Unable to read local RNG profile username:", error);
            }
        }

        if (user?.uid) {
            candidates.push(localStorage.getItem(`preferredUsername_${user.uid}`));
            candidates.push(readStoredJson(`userProfile_${user.uid}`).username);
            candidates.push(readStoredJson(`userProfileBackup_${user.uid}`).username);
        }

        for (const key of ["userProfile", "userProfileBackup"]) {
            const profile = readStoredJson(key);
            if (!profile?.uid || profile.uid === user?.uid) {
                candidates.push(profile.username);
            }
        }

        return candidates;
    }

    function pickRngUsername(user, ...candidates) {
        const flatCandidates = candidates.flat();
        for (const candidate of flatCandidates) {
            if (isMeaningfulRngUsername(candidate, user)) {
                return normalizeRngUsername(candidate);
            }
        }
        return "";
    }

    function getFallbackUsername(user) {
        return pickRngUsername(
            user,
            getLocalRngUsernameCandidates(user),
            user?.displayName
        ) || "Anonymous";
    }

    async function getLeaderboardIdentityData(collectionName, uid) {
        if (!rngLeaderboardDb || !uid) return {};
        try {
            const doc = await rngLeaderboardDb.collection(collectionName).doc(uid).get();
            return doc.exists ? doc.data() || {} : {};
        } catch (error) {
            console.warn(`Unable to load ${collectionName} identity:`, error);
            return {};
        }
    }

    function setRngLeaderboardStatus(message) {
        const status = document.getElementById("rng-leaderboard-status");
        if (status) status.textContent = message;
    }

    function getRngCurrentUser() {
        return rngLeaderboardAuth?.currentUser || rngLeaderboardUser || null;
    }

    function ensureRngLeaderboardServices() {
        if (rngLeaderboardDb && rngLeaderboardAuth) return true;
        if (typeof firebase === "undefined" || !firebase?.firestore || !firebase?.auth) {
            return false;
        }

        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(RNG_FIREBASE_CONFIG);
            }

            rngLeaderboardDb = firebase.firestore();
            rngLeaderboardAuth = firebase.auth();
            rngLeaderboardUser = rngLeaderboardAuth.currentUser || null;
            return true;
        } catch (error) {
            console.warn("Unable to prepare RNG leaderboard services:", error);
            return false;
        }
    }

    function getRngBroadcastText(value, fallback, maxLength) {
        const text = String(value ?? fallback ?? "").replace(/\s+/g, " ").trim();
        const fallbackText = String(fallback ?? "").replace(/\s+/g, " ").trim();
        return (text || fallbackText).slice(0, maxLength);
    }

    function shouldPublishRngGlobalRollBroadcast(shark) {
        if (!shark || shark.adminCommandId) return false;
        const oneIn = Math.max(0, Math.floor(Number(shark.oneIn) || 0));
        return isApexPull(shark) || oneIn >= ULTRA_ONE_IN_THRESHOLD;
    }

    async function publishRngGlobalRollBroadcast(shark, rollContext = {}) {
        if (!shouldPublishRngGlobalRollBroadcast(shark)) return;
        if (!ensureRngLeaderboardServices()) return;

        const user = getRngCurrentUser();
        if (!user?.uid || !rngLeaderboardDb) return;

        const mutationKey = typeof shark.mutation === "string" ? shark.mutation : "";
        const mutationName = mutationKey && MUTATION_TYPES[mutationKey]?.name
            ? MUTATION_TYPES[mutationKey].name
            : "";
        const oneIn = Math.max(0, Math.floor(Number(shark.oneIn) || 0));
        const rollCount = Math.max(1, Math.min(100, Math.floor(Number(rollContext?.rollCount) || 1)));

        try {
            await rngLeaderboardDb.collection(RNG_BROADCAST_COLLECTION).add({
                uid: user.uid,
                playerName: getRngBroadcastText(getFallbackUsername(user), "Anonymous", RNG_BROADCAST_PLAYER_NAME_MAX),
                speciesName: getRngBroadcastText(shark.name, "Unknown species", RNG_BROADCAST_SPECIES_NAME_MAX),
                tier: isApexPull(shark) ? "Apex" : getOddsTierName(shark),
                mutation: mutationKey.slice(0, 24),
                mutationName: mutationName.slice(0, 32),
                oneIn,
                rollCount,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.warn("Unable to publish RNG global broadcast:", error);
        }
    }

    function getRngAdminNextRollConfigId(uid) {
        return `${RNG_ADMIN_NEXT_ROLL_CONFIG_PREFIX}${String(uid || "").replace(/\//g, "_")}`;
    }

    function getRngAdminNextRollRef(uid) {
        if (!ensureRngLeaderboardServices() || !uid) return null;
        return rngLeaderboardDb.collection("globalConfig").doc(getRngAdminNextRollConfigId(uid));
    }

    function cloneRngData(value) {
        try {
            return JSON.parse(JSON.stringify(value || {}));
        } catch (error) {
            return {};
        }
    }

    function getRawLocalRngProfile() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function getRngCollectionCount(profile = {}) {
        if (profile.collection && typeof profile.collection === "object") {
            return Object.keys(profile.collection).length;
        }
        return Math.max(0, Math.floor(Number(profile.collectionCount) || Number(profile.collectionEntryCount) || 0));
    }

    function getRngProgressRank(profile = {}) {
        return [
            getRngCollectionCount(profile),
            Math.max(0, Math.floor(Number(profile.prestigeLevel) || 0)),
            Math.max(0, Math.floor(Number(profile.totalPrestigePoints) || Number(profile.prestigePoints) || 0)),
            Math.max(0, Number(profile.bestOneIn) || 0),
            Math.max(0, Math.floor(Number(profile.rngXp) || 0)),
            Math.max(0, Math.floor(Number(profile.rolls) || 0)),
            Math.max(0, Math.floor(Number(profile.coins) || 0))
        ];
    }

    function compareRngProfileProgress(left = {}, right = {}) {
        const leftRank = getRngProgressRank(left);
        const rightRank = getRngProgressRank(right);
        for (let i = 0; i < leftRank.length; i++) {
            if (leftRank[i] !== rightRank[i]) return leftRank[i] - rightRank[i];
        }
        return 0;
    }

    function mergeRngCollectionForCloud(...collections) {
        const merged = {};
        collections.forEach(collection => {
            if (!collection || typeof collection !== "object") return;
            Object.entries(collection).forEach(([key, entry]) => {
                if (!entry || typeof entry !== "object") return;
                const existing = merged[key];
                if (!existing) {
                    merged[key] = cloneRngData(entry);
                    return;
                }

                const existingFirstRoll = Math.max(0, Number(existing.firstRoll) || 0);
                const nextFirstRoll = Math.max(0, Number(entry.firstRoll) || 0);
                merged[key] = {
                    ...existing,
                    ...cloneRngData(entry),
                    count: Math.max(Number(existing.count) || 0, Number(entry.count) || 0),
                    firstRoll: existingFirstRoll && nextFirstRoll
                        ? Math.min(existingFirstRoll, nextFirstRoll)
                        : existingFirstRoll || nextFirstRoll || 0,
                    oneIn: Math.max(Number(existing.oneIn) || 0, Number(entry.oneIn) || 0)
                };
            });
        });
        return merged;
    }

    function mergeRngProfilesForHydration(localProfile = {}, remoteProfile = {}) {
        const preferRemote = compareRngProfileProgress(remoteProfile, localProfile) >= 0;
        const preferred = preferRemote ? remoteProfile : localProfile;
        const secondary = preferRemote ? localProfile : remoteProfile;
        const merged = {
            ...cloneRngData(secondary),
            ...cloneRngData(preferred)
        };

        merged.collection = mergeRngCollectionForCloud(localProfile.collection, remoteProfile.collection);
        merged.claimedIndexRewards = [...new Set([
            ...(Array.isArray(localProfile.claimedIndexRewards) ? localProfile.claimedIndexRewards : []),
            ...(Array.isArray(remoteProfile.claimedIndexRewards) ? remoteProfile.claimedIndexRewards : [])
        ])];
        merged.dailyQuests = mergeRngDailyQuestStates(
            localProfile.dailyQuests || localProfile.dailyMissions,
            remoteProfile.dailyQuests || remoteProfile.dailyMissions
        );
        merged.quests = mergeRngQuestStates(localProfile.quests, remoteProfile.quests);
        delete merged.dailyMissions;
        merged.bestOneIn = Math.max(Number(localProfile.bestOneIn) || 0, Number(remoteProfile.bestOneIn) || 0);
        merged.runBestOneIn = Math.max(Number(localProfile.runBestOneIn) || 0, Number(remoteProfile.runBestOneIn) || 0);
        merged.rngCloudUpdatedAtMs = Math.max(Number(localProfile.rngCloudUpdatedAtMs) || 0, Number(remoteProfile.rngCloudUpdatedAtMs) || 0);

        const history = [
            ...(Array.isArray(preferred.prestigeHistory) ? preferred.prestigeHistory : []),
            ...(Array.isArray(secondary.prestigeHistory) ? secondary.prestigeHistory : [])
        ];
        merged.prestigeHistory = history
            .filter((entry, index, list) => {
                const key = JSON.stringify([
                    entry?.at || entry?.timestamp || "",
                    entry?.gain || 0,
                    entry?.bestOneIn || 0,
                    entry?.rolls || 0
                ]);
                return list.findIndex(candidate => JSON.stringify([
                    candidate?.at || candidate?.timestamp || "",
                    candidate?.gain || 0,
                    candidate?.bestOneIn || 0,
                    candidate?.rolls || 0
                ]) === key) === index;
            })
            .slice(0, PRESTIGE_HISTORY_LIMIT);

        return merged;
    }

    function buildRngCloudProfilePayload() {
        const rawPlayer = cloneRngData(player);
        const collection = rawPlayer.collection && typeof rawPlayer.collection === "object"
            ? rawPlayer.collection
            : {};
        const entries = Object.entries(collection);
        delete rawPlayer.collection;

        const updatedAtMs = Date.now();
        const chunks = [];
        for (let i = 0; i < entries.length; i += RNG_PROFILE_CHUNK_SIZE) {
            chunks.push(entries.slice(i, i + RNG_PROFILE_CHUNK_SIZE).map(([key, entry]) => ({
                key,
                entry
            })));
        }

        return {
            metadata: {
                ...rawPlayer,
                schemaVersion: RNG_PROFILE_SCHEMA_VERSION,
                collectionCount: entries.length,
                collectionEntryCount: entries.length,
                chunkCount: chunks.length,
                rngCloudUpdatedAtMs: updatedAtMs,
                updatedAtMs
            },
            chunks
        };
    }

    async function getRngProfileSnapshot(ref) {
        try {
            return await ref.get({ source: "server" });
        } catch (error) {
            console.warn("Falling back to cached RNG profile snapshot:", error);
            return ref.get();
        }
    }

    async function readRngProfileFromFirebase(user) {
        if (!rngLeaderboardDb || !user?.uid) return null;
        const profileRef = rngLeaderboardDb.collection(RNG_PROFILE_COLLECTION).doc(user.uid);
        const snapshot = await getRngProfileSnapshot(profileRef);
        if (!snapshot.exists) return null;

        const metadata = snapshot.data() || {};
        const chunkCount = Math.min(200, Math.max(0, Math.floor(Number(metadata.chunkCount) || 0)));
        const chunkRefs = Array.from({ length: chunkCount }, (_, index) =>
            profileRef.collection(RNG_PROFILE_CHUNK_COLLECTION).doc(`chunk_${String(index).padStart(4, "0")}`)
        );
        const chunkSnapshots = await Promise.all(chunkRefs.map(ref => ref.get()));
        const collection = {};

        chunkSnapshots
            .map((doc, index) => ({
                index,
                entries: doc.exists && Array.isArray(doc.data()?.entries) ? doc.data().entries : []
            }))
            .sort((a, b) => a.index - b.index)
            .forEach(chunk => {
                chunk.entries.forEach(item => {
                    const key = Array.isArray(item) ? item[0] : item?.key;
                    const entry = Array.isArray(item) ? item[1] : item?.entry;
                    if (key && entry && typeof entry === "object") {
                        collection[key] = entry;
                    }
                });
            });

        const profile = cloneRngData(metadata);
        delete profile.chunkCount;
        delete profile.collectionCount;
        delete profile.collectionEntryCount;
        delete profile.schemaVersion;
        profile.collection = collection;
        profile.rngCloudUpdatedAtMs = Number(metadata.rngCloudUpdatedAtMs) || Number(metadata.updatedAtMs) || 0;
        return profile;
    }

    function applyRngProfileData(profileData, options = {}) {
        if (!profileData || typeof profileData !== "object") return false;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profileData));
        loadLocalProfile();
        if (options.saveLocal !== false) {
            saveLocalProfile();
        }
        updateAllUi({ forceCollectionGrid: true });
        updateSettingsUi();
        return true;
    }

    async function hydrateRngProfileFromFirebase(options = {}) {
        if (!ensureRngLeaderboardServices()) return false;
        const user = getRngCurrentUser();
        if (!user) return false;
        if (!options.force && rngCloudHydratedUid === user.uid) return true;

        try {
            const remoteProfile = await readRngProfileFromFirebase(user);
            const localProfile = getRawLocalRngProfile();
            rngCloudHydratedUid = user.uid;

            if (!remoteProfile) {
                if (getRngProgressRank(localProfile).some(value => value > 0)) {
                    scheduleRngCloudProfileSync(1000);
                }
                return false;
            }

            const mergedProfile = mergeRngProfilesForHydration(localProfile, remoteProfile);
            applyRngProfileData(mergedProfile);

            if (JSON.stringify(mergedProfile.collection || {}) !== JSON.stringify(remoteProfile.collection || {})
                || compareRngProfileProgress(mergedProfile, remoteProfile) > 0) {
                scheduleRngCloudProfileSync(1000);
            }

            showToast("Cloud RNG progress loaded.");
            return true;
        } catch (error) {
            console.warn("Unable to hydrate RNG profile from Firebase:", error);
            return false;
        }
    }

    async function syncRngProfileToFirebase(options = {}) {
        if (!ensureRngLeaderboardServices()) return false;
        const user = getRngCurrentUser();
        if (!user) return false;

        if (rngCloudSaveInFlight && !options.force) {
            rngCloudSaveDirty = true;
            return false;
        }

        rngCloudSaveInFlight = true;
        try {
            const profileRef = rngLeaderboardDb.collection(RNG_PROFILE_COLLECTION).doc(user.uid);
            const { metadata, chunks } = buildRngCloudProfilePayload();
            const batch = rngLeaderboardDb.batch();
            const payload = {
                ...metadata,
                uid: user.uid,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            batch.set(profileRef, payload, { merge: false });
            chunks.forEach((entries, index) => {
                batch.set(
                    profileRef.collection(RNG_PROFILE_CHUNK_COLLECTION).doc(`chunk_${String(index).padStart(4, "0")}`),
                    {
                        index,
                        entries,
                        updatedAtMs: metadata.updatedAtMs,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    },
                    { merge: false }
                );
            });

            await batch.commit();
            player.rngCloudUpdatedAtMs = metadata.rngCloudUpdatedAtMs;
            rngCloudHydratedUid = user.uid;
            rngCloudSaveDirty = false;
            return true;
        } catch (error) {
            console.warn("Unable to sync full RNG profile:", error);
            rngCloudSaveDirty = true;
            return false;
        } finally {
            rngCloudSaveInFlight = false;
            if (rngCloudSaveDirty && !rngCloudSaveTimer) {
                scheduleRngCloudProfileSync(RNG_CLOUD_SAVE_INTERVAL_MS);
            }
        }
    }

    function scheduleRngCloudProfileSync(delayMs = RNG_CLOUD_SAVE_INTERVAL_MS) {
        if (!ensureRngLeaderboardServices() || !getRngCurrentUser()) return;
        rngCloudSaveDirty = true;
        if (rngCloudSaveTimer) return;

        rngCloudSaveTimer = setTimeout(async () => {
            rngCloudSaveTimer = null;
            await syncRngProfileToFirebase();
        }, Math.max(1000, delayMs));
    }

    async function getRngLeaderboardProfile(user) {
        if (!user) {
            return {
                username: "Anonymous",
                profilePicture: "images/pfp/shark1.png"
            };
        }

        if (
            rngLeaderboardProfileCache?.uid === user.uid &&
            Date.now() - rngLeaderboardProfileCache.loadedAt < 60000
        ) {
            return rngLeaderboardProfileCache;
        }

        const fallback = {
            uid: user.uid,
            username: getFallbackUsername(user),
            profilePicture: "images/pfp/shark1.png",
            loadedAt: Date.now()
        };

        if (!rngLeaderboardDb) {
            rngLeaderboardProfileCache = fallback;
            return fallback;
        }

        try {
            const data = await getLeaderboardIdentityData("userStats", user.uid);
            const existingRngData = await getLeaderboardIdentityData(RNG_LEADERBOARD_COLLECTION, user.uid);
            const username = pickRngUsername(
                user,
                data.username,
                getLocalRngUsernameCandidates(user),
                existingRngData.username,
                user.displayName
            ) || fallback.username;

            rngLeaderboardProfileCache = {
                ...fallback,
                username,
                profilePicture: data.profilePicture || data.profilePic || existingRngData.profilePicture || fallback.profilePicture,
                equippedBadge: data.equippedBadge || existingRngData.equippedBadge || "starter",
                equippedCardTheme: data.equippedCardTheme || existingRngData.equippedCardTheme || "default"
            };
            return rngLeaderboardProfileCache;
        } catch (error) {
            console.warn("Unable to load RNG leaderboard profile:", error);
            rngLeaderboardProfileCache = fallback;
            return fallback;
        }
    }

    function buildRngLeaderboardPayload(user, profile) {
        const best = getBestCollectionEntry();
        const rankInfo = getRankInfo();
        const username = profile.username || getFallbackUsername(user);

        const payload = {
            uid: user.uid,
            profilePicture: profile.profilePicture || "images/pfp/shark1.png",
            equippedBadge: profile.equippedBadge || "starter",
            equippedCardTheme: profile.equippedCardTheme || "default",
            rolls: player.rolls || 0,
            globalRolls: player.rolls || 0,
            bestOneIn: player.bestOneIn || best?.oneIn || 0,
            bestTier: best?.tier || "",
            bestShark: best?.name || "",
            level: rankInfo.level,
            collectionCount: getCollectionCount(),
            updatedAt: Date.now()
        };

        if (isMeaningfulRngUsername(username, user)) {
            payload.username = normalizeRngUsername(username);
        }

        return payload;
    }

    function buildRngLeaderboardFallbackPayload(payload) {
        return {
            rngRolls: payload.rolls,
            rngGlobalRolls: payload.globalRolls,
            rngBestOneIn: payload.bestOneIn,
            rngBestTier: payload.bestTier,
            rngBestShark: payload.bestShark,
            rngLevel: payload.level,
            rngCollectionCount: payload.collectionCount,
            rngUpdatedAt: payload.updatedAt
        };
    }

    function normalizeRngLeaderboardRow(doc, source = "rngLeaderboard") {
        const data = doc.data() || {};
        const fallbackSource = source === "userStats";
        const bestOneIn = toSafeNumber(fallbackSource ? data.rngBestOneIn : data.bestOneIn);
        const bestTier = (fallbackSource ? data.rngBestTier : data.bestTier) || tierNameFromOneIn(bestOneIn);

        return {
            uid: data.uid || doc.id,
            username: data.username || "Anonymous",
            rolls: toSafeNumber(fallbackSource ? (data.rngGlobalRolls || data.rngRolls) : (data.globalRolls || data.rolls)),
            bestOneIn,
            bestTier,
            bestShark: (fallbackSource ? data.rngBestShark : data.bestShark) || "Unknown species",
            level: toSafeNumber(fallbackSource ? data.rngLevel : data.level),
            collectionCount: toSafeNumber(fallbackSource ? data.rngCollectionCount : data.collectionCount),
            updatedAt: (fallbackSource ? data.rngUpdatedAt : data.updatedAt) || 0
        };
    }

    function mergeRngLeaderboardRows(rows) {
        const byUid = new Map();

        for (const row of rows) {
            const key = row.uid || row.username;
            const existing = byUid.get(key);
            if (!existing || compareRngLeaderboardRows(row, existing) < 0) {
                byUid.set(key, row);
            }
        }

        return [...byUid.values()].sort(compareRngLeaderboardRows);
    }

    function renderRngLeaderboardSelf() {
        const self = document.getElementById("rng-leaderboard-self");
        if (!self) return;

        const best = getBestCollectionEntry();
        const signedIn = Boolean(rngLeaderboardUser || rngLeaderboardAuth?.currentUser);
        const bestText = best
            ? `Best: 1 in ${formatOneIn(best.oneIn)} (${best.tier})`
            : "Best: no pulls yet";
        const syncText = signedIn
            ? "Your RNG stats are being synced globally."
            : "Login to publish your RNG stats globally.";

        self.innerHTML = `
            <strong>
                <span>Your RNG Card</span>
                <span>${(player.rolls || 0).toLocaleString()} rolls</span>
            </strong>
            <span>${escapeHtml(bestText)}${best?.name ? ` - ${escapeHtml(best.name)}` : ""}</span>
            <span>${syncText}</span>
        `;
    }

    function renderRngLeaderboardRows(rows) {
        const list = document.getElementById("rng-leaderboard-list");
        if (!list) return;

        if (!rows.length) {
            list.innerHTML = `<p class="rng-empty-note">No RNG leaderboard entries yet. Be the first logged-in player to roll something nasty.</p>`;
            return;
        }

        list.innerHTML = rows.map((row, index) => {
            const rank = index + 1;
            const tier = row.bestTier || tierNameFromOneIn(row.bestOneIn);
            const tierClass = getRarityClass(tier);
            const currentUserClass = row.uid && row.uid === (rngLeaderboardUser?.uid || rngLeaderboardAuth?.currentUser?.uid)
                ? " current-user"
                : "";
            const rankClass = rank <= 3 ? ` top-${rank}` : "";

            return `
                <article class="rng-leaderboard-row${currentUserClass}">
                    <span class="rng-leaderboard-rank${rankClass}">#${rank}</span>
                    <div class="rng-leaderboard-main">
                        <div class="rng-leaderboard-name-line">
                            <strong class="rng-leaderboard-name">${escapeHtml(row.username)}</strong>
                            <span class="rng-leaderboard-tier ${tierClass}">${escapeHtml(tier)}</span>
                        </div>
                        <span class="rng-leaderboard-best">1 in ${formatOneIn(row.bestOneIn)}</span>
                        <span class="rng-leaderboard-shark">${escapeHtml(row.bestShark)}</span>
                        <div class="rng-leaderboard-metrics">
                            <span>${row.rolls.toLocaleString()} global rolls</span>
                            <span>Lv.${row.level || 1}</span>
                        </div>
                    </div>
                </article>
            `;
        }).join("");
    }

    async function syncRngLeaderboardEntry() {
        if (!ensureRngLeaderboardServices()) {
            setRngLeaderboardStatus("RNG leaderboard is unavailable right now.");
            return false;
        }

        const user = rngLeaderboardAuth.currentUser;
        rngLeaderboardUser = user || null;
        renderRngLeaderboardSelf();

        if (!user) {
            setRngLeaderboardStatus("Showing global Top 10. Login to publish your RNG card.");
            return false;
        }

        try {
            const profile = await getRngLeaderboardProfile(user);
            const payload = buildRngLeaderboardPayload(user, profile);
            let synced = false;

            try {
                await rngLeaderboardDb
                    .collection(RNG_LEADERBOARD_COLLECTION)
                    .doc(user.uid)
                    .set(payload, { merge: true });
                synced = true;
            } catch (primaryError) {
                console.warn("Dedicated RNG leaderboard sync failed; using userStats fallback:", primaryError);
            }

            try {
                await rngLeaderboardDb
                    .collection(RNG_LEADERBOARD_FALLBACK_COLLECTION)
                    .doc(user.uid)
                    .set(buildRngLeaderboardFallbackPayload(payload), { merge: true });
                synced = true;
            } catch (fallbackError) {
                console.warn("RNG leaderboard fallback sync failed:", fallbackError);
            }

            if (!synced) {
                throw new Error("No RNG leaderboard sync targets were available.");
            }

            rngLeaderboardLastSyncAt = Date.now();
            setRngLeaderboardStatus("RNG leaderboard synced.");
            return true;
        } catch (error) {
            console.warn("Unable to sync RNG leaderboard entry:", error);
            setRngLeaderboardStatus("Could not sync RNG leaderboard yet. Local RNG still works.");
            return false;
        }
    }

    function scheduleRngLeaderboardSync() {
        if (!ensureRngLeaderboardServices()) return;
        if (rngLeaderboardSyncTimer) return;

        const elapsed = Date.now() - rngLeaderboardLastSyncAt;
        const delay = rngLeaderboardLastSyncAt
            ? Math.max(1200, RNG_LEADERBOARD_SYNC_INTERVAL_MS - elapsed)
            : RNG_LEADERBOARD_SYNC_INTERVAL_MS;

        rngLeaderboardSyncTimer = setTimeout(async () => {
            rngLeaderboardSyncTimer = null;
            await syncRngLeaderboardEntry();
            if (document.getElementById("rng-tab-leaderboard")?.classList.contains("active")) {
                loadRngLeaderboard();
            }
        }, delay);
    }

    async function loadRngLeaderboard({ syncFirst = false } = {}) {
        if (!document.getElementById("rng-leaderboard-list")) return;
        if (!ensureRngLeaderboardServices()) {
            setRngLeaderboardStatus("RNG leaderboard is unavailable right now.");
            renderRngLeaderboardRows([]);
            renderRngLeaderboardSelf();
            return;
        }

        if (rngLeaderboardLoading) return;
        rngLeaderboardLoading = true;
        setRngLeaderboardStatus("Loading RNG leaderboard...");

        try {
            if (syncFirst) {
                await syncRngLeaderboardEntry();
            }

            const rows = [];

            try {
                const snapshot = await rngLeaderboardDb
                    .collection(RNG_LEADERBOARD_COLLECTION)
                    .orderBy("bestOneIn", "desc")
                    .limit(RNG_LEADERBOARD_QUERY_LIMIT)
                    .get();
                snapshot.forEach((doc) => {
                    const row = normalizeRngLeaderboardRow(doc);
                    if (row.bestOneIn > 0 || row.rolls > 0) rows.push(row);
                });
            } catch (primaryError) {
                console.warn("Dedicated RNG leaderboard load failed; trying userStats fallback:", primaryError);
            }

            try {
                const fallbackSnapshot = await rngLeaderboardDb
                    .collection(RNG_LEADERBOARD_FALLBACK_COLLECTION)
                    .orderBy("rngBestOneIn", "desc")
                    .limit(RNG_LEADERBOARD_QUERY_LIMIT)
                    .get();
                fallbackSnapshot.forEach((doc) => {
                    const row = normalizeRngLeaderboardRow(doc, "userStats");
                    if (row.bestOneIn > 0 || row.rolls > 0) rows.push(row);
                });
            } catch (fallbackError) {
                console.warn("RNG leaderboard fallback load failed:", fallbackError);
            }

            const rankedRows = mergeRngLeaderboardRows(rows);
            renderRngLeaderboardRows(rankedRows.slice(0, RNG_LEADERBOARD_LIMIT));
            renderRngLeaderboardSelf();

            const user = rngLeaderboardAuth.currentUser;
            rngLeaderboardUser = user || null;
            setRngLeaderboardStatus(user
                ? "Top 10 by best roll. Total rolls break ties."
                : "Showing global Top 10. Login to publish your RNG card.");
        } catch (error) {
            console.warn("Unable to load RNG leaderboard:", error);
            setRngLeaderboardStatus("Could not load RNG leaderboard yet.");
            renderRngLeaderboardRows([]);
        } finally {
            rngLeaderboardLoading = false;
        }
    }

    function clearRngAdminNextRollSubscription() {
        if (rngAdminNextRollUnsubscribe) {
            rngAdminNextRollUnsubscribe();
            rngAdminNextRollUnsubscribe = null;
        }
        rngAdminNextRollCommand = null;
    }

    function subscribeRngAdminNextRollCommand(user) {
        clearRngAdminNextRollSubscription();
        if (!user?.uid || !ensureRngLeaderboardServices()) return;

        const commandRef = getRngAdminNextRollRef(user.uid);
        if (!commandRef) return;

        rngAdminNextRollUnsubscribe = commandRef.onSnapshot((snapshot) => {
            rngAdminNextRollCommand = snapshot.exists ? snapshot.data() || null : null;
        }, (error) => {
            console.warn("Unable to listen for RNG admin next-roll command:", error);
            rngAdminNextRollCommand = null;
        });
    }

    function initRngLeaderboard() {
        renderRngLeaderboardSelf();

        if (!ensureRngLeaderboardServices()) {
            setRngLeaderboardStatus("RNG leaderboard is unavailable right now.");
            return;
        }

        rngLeaderboardAuth.onAuthStateChanged((user) => {
            rngLeaderboardUser = user || null;
            rngLeaderboardProfileCache = null;
            subscribeRngAdminNextRollCommand(user);
            if (!user) {
                rngCloudHydratedUid = null;
            }
            renderRngLeaderboardSelf();
            if (user) {
                hydrateRngProfileFromFirebase({ force: true }).then(() => {
                    loadRngLeaderboard();
                });
            } else {
                loadRngLeaderboard();
            }
        });

        loadRngLeaderboard();
    }

    function hashString(value) {
        let hash = 0;
        for (let i = 0; i < value.length; i++) {
            hash = ((hash << 5) - hash) + value.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    function getRngTodayKey(date = new Date()) {
        return date.toISOString().slice(0, 10);
    }

    function createDefaultDailyQuestState(dateKey = getRngTodayKey()) {
        return {
            date: dateKey,
            progress: {},
            claimed: []
        };
    }

    function createDefaultQuestState() {
        return {
            allTime: {}
        };
    }

    function normalizeRngDailyQuestState(state = {}, dateKey = getRngTodayKey()) {
        if (!state || typeof state !== "object" || state.date !== dateKey) {
            return createDefaultDailyQuestState(dateKey);
        }

        return {
            date: dateKey,
            progress: state.progress && typeof state.progress === "object"
                ? Object.fromEntries(Object.entries(state.progress).map(([key, value]) => [
                    key,
                    Math.max(0, Math.floor(Number(value) || 0))
                ]))
                : {},
            claimed: Array.isArray(state.claimed)
                ? [...new Set(state.claimed.map(String).filter(Boolean))].slice(0, RNG_DAILY_QUEST_COUNT)
                : []
        };
    }

    function mergeRngDailyQuestStates(localState = {}, remoteState = {}) {
        const dateKey = getRngTodayKey();
        const local = normalizeRngDailyQuestState(localState, dateKey);
        const remote = normalizeRngDailyQuestState(remoteState, dateKey);
        const progress = { ...local.progress };

        Object.entries(remote.progress || {}).forEach(([key, value]) => {
            progress[key] = Math.max(progress[key] || 0, Math.max(0, Math.floor(Number(value) || 0)));
        });

        return {
            date: dateKey,
            progress,
            claimed: [...new Set([...(local.claimed || []), ...(remote.claimed || [])])].slice(0, RNG_DAILY_QUEST_COUNT)
        };
    }

    function pickRngQuestOption(options, seed, offset = 0) {
        return options[Math.abs(seed + offset) % options.length];
    }

    function formatRngQuestRewardText(effects = []) {
        return effects.map((effect) => {
            if (effect.type === "coins") return formatCompactCoins(effect.amount);
            if (effect.type === "potion" && POTION_DEFS[effect.key]) {
                const amount = Math.max(1, Math.floor(Number(effect.amount) || 1));
                return `${amount} ${POTION_DEFS[effect.key].name}${amount === 1 ? "" : "s"}`;
            }
            return "Reward";
        }).join(" + ");
    }

    function buildRngDailyQuestDefs(dateKey = getRngTodayKey()) {
        const seed = hashString(`rng-daily:${dateKey}`);
        const rollGoal = pickRngQuestOption([45, 60, 75, 90], seed, 11);
        const rareQuest = pickRngQuestOption([
            { threshold: 35, goal: 5, title: "Rare Sweep", reward: [{ type: "coins", amount: 45000 }, { type: "potion", key: "luckMinor", amount: 1 }] },
            { threshold: 200, goal: 2, title: "Epic Current", reward: [{ type: "coins", amount: 85000 }, { type: "potion", key: "luck", amount: 1 }] },
            { threshold: 2500, goal: 1, title: "Legend Signal", reward: [{ type: "coins", amount: 150000 }, { type: "potion", key: "luckStrong", amount: 1 }] }
        ], seed, 29);
        const coinGoal = pickRngQuestOption([25000, 60000, 120000, 250000], seed, 47);

        const quests = [
            {
                id: `rolls_${rollGoal}`,
                icon: "fa-dice",
                title: "Daily Dive",
                desc: `Roll ${rollGoal.toLocaleString()} times.`,
                type: "rolls",
                goal: rollGoal,
                reward: [{ type: "coins", amount: rollGoal * 900 }, { type: "potion", key: "speed", amount: 1 }]
            },
            {
                id: `odds_${rareQuest.threshold}_${rareQuest.goal}`,
                icon: "fa-ranking-star",
                title: rareQuest.title,
                desc: `Pull ${rareQuest.goal.toLocaleString()} species at 1 in ${formatOneIn(rareQuest.threshold)} or rarer.`,
                type: "odds",
                threshold: rareQuest.threshold,
                goal: rareQuest.goal,
                reward: rareQuest.reward
            },
            {
                id: `coins_${coinGoal}`,
                icon: "fa-coins",
                title: "Treasure Tow",
                desc: `Earn ${formatCompactCoins(coinGoal)} coins from rolls.`,
                type: "coins",
                goal: coinGoal,
                reward: [{ type: "coins", amount: Math.round(coinGoal * 0.65) }, { type: "potion", key: "coin", amount: 1 }]
            }
        ].slice(0, RNG_DAILY_QUEST_COUNT);

        return quests.map((quest) => ({
            ...quest,
            section: "daily",
            rewardText: formatRngQuestRewardText(quest.reward)
        }));
    }

    function getRngDailyQuestState() {
        player.dailyQuests = normalizeRngDailyQuestState(player.dailyQuests || player.dailyMissions);
        if (player.dailyMissions) delete player.dailyMissions;
        return player.dailyQuests;
    }

    function getRngDailyQuestProgress(quest) {
        const state = getRngDailyQuestState();
        return Math.min(quest.goal, Math.max(0, Math.floor(Number(state.progress[quest.id]) || 0)));
    }

    function isRngDailyQuestClaimed(quest) {
        const state = getRngDailyQuestState();
        return Array.isArray(state.claimed) && state.claimed.includes(quest.id);
    }

    function addRngDailyQuestProgress(quest, amount) {
        const state = getRngDailyQuestState();
        const before = getRngDailyQuestProgress(quest);
        const next = Math.min(quest.goal, before + Math.max(0, Math.floor(Number(amount) || 0)));
        if (next === before) return false;
        state.progress[quest.id] = next;
        return true;
    }

    function updateRngDailyQuestsForRoll(rolled) {
        if (!rolled) return false;

        let changed = false;
        buildRngDailyQuestDefs().forEach((quest) => {
            if (isRngDailyQuestClaimed(quest)) return;
            if (quest.type === "rolls") {
                changed = addRngDailyQuestProgress(quest, 1) || changed;
            } else if (quest.type === "odds" && (rolled.oneIn || 0) >= quest.threshold) {
                changed = addRngDailyQuestProgress(quest, 1) || changed;
            } else if (quest.type === "coins") {
                changed = addRngDailyQuestProgress(quest, rolled.coinReward || 0) || changed;
            }
        });

        return changed;
    }

    function buildRngAllTimeQuestChains() {
        return {
            rollMilestone: {
                icon: "fa-rotate",
                title: "Roll Milestone",
                progress: () => Math.max(0, Math.floor(Number(player.rolls) || 0)),
                formatProgress: (value) => value.toLocaleString(),
                describe: (goal) => `Roll ${goal.toLocaleString()} times.`,
                steps: [
                    { goal: 500, reward: [{ type: "coins", amount: 100000 }, { type: "potion", key: "speed", amount: 1 }] },
                    { goal: 1000, reward: [{ type: "coins", amount: 220000 }, { type: "potion", key: "luck", amount: 1 }] },
                    { goal: 2500, reward: [{ type: "coins", amount: 550000 }, { type: "potion", key: "luckStrong", amount: 1 }] },
                    { goal: 5000, reward: [{ type: "coins", amount: 1250000 }, { type: "potion", key: "luckMega", amount: 1 }] },
                    { goal: 10000, reward: [{ type: "coins", amount: 3000000 }, { type: "potion", key: "coin", amount: 2 }] },
                    { goal: 25000, reward: [{ type: "coins", amount: 8500000 }, { type: "potion", key: "luckVoid", amount: 1 }] },
                    { goal: 50000, reward: [{ type: "coins", amount: 20000000 }, { type: "potion", key: "omega", amount: 1 }] },
                    { goal: 100000, reward: [{ type: "coins", amount: 50000000 }, { type: "potion", key: "apexSurge", amount: 1 }] }
                ]
            },
            collectionMilestone: {
                icon: "fa-book-open",
                title: "Index Expedition",
                progress: () => getCollectionCount(),
                formatProgress: (value) => value.toLocaleString(),
                describe: (goal) => `Discover ${goal.toLocaleString()} index entries.`,
                steps: [
                    { goal: 25, reward: [{ type: "coins", amount: 75000 }, { type: "potion", key: "luckMinor", amount: 1 }] },
                    { goal: 50, reward: [{ type: "coins", amount: 180000 }, { type: "potion", key: "luck", amount: 1 }] },
                    { goal: 100, reward: [{ type: "coins", amount: 450000 }, { type: "potion", key: "luckStrong", amount: 1 }] },
                    { goal: 250, reward: [{ type: "coins", amount: 1250000 }, { type: "potion", key: "luckMega", amount: 1 }] },
                    { goal: 500, reward: [{ type: "coins", amount: 4000000 }, { type: "potion", key: "ultra", amount: 1 }] },
                    { goal: 1000, reward: [{ type: "coins", amount: 12000000 }, { type: "potion", key: "omega", amount: 1 }] }
                ]
            },
            rarityMilestone: {
                icon: "fa-gem",
                title: "Deep Find",
                progress: () => Math.max(0, Number(player.bestOneIn) || 0),
                formatProgress: (value) => value > 0 ? `1 in ${formatOneIn(value)}` : "None yet",
                describe: (goal) => `Roll a species at 1 in ${formatOneIn(goal)} or rarer.`,
                steps: [
                    { goal: 1000, reward: [{ type: "coins", amount: 125000 }, { type: "potion", key: "luck", amount: 1 }] },
                    { goal: 10000, reward: [{ type: "coins", amount: 500000 }, { type: "potion", key: "luckStrong", amount: 1 }] },
                    { goal: 100000, reward: [{ type: "coins", amount: 1800000 }, { type: "potion", key: "luckMega", amount: 1 }] },
                    { goal: 1000000, reward: [{ type: "coins", amount: 6000000 }, { type: "potion", key: "ultra", amount: 1 }] },
                    { goal: 10000000, reward: [{ type: "coins", amount: 18000000 }, { type: "potion", key: "omega", amount: 1 }] },
                    { goal: 100000000, reward: [{ type: "coins", amount: 65000000 }, { type: "potion", key: "apexSurge", amount: 1 }] }
                ]
            }
        };
    }

    function normalizeRngQuestState(state = {}) {
        const allTime = {};
        const source = state && typeof state === "object" && state.allTime && typeof state.allTime === "object"
            ? state.allTime
            : {};
        const chains = buildRngAllTimeQuestChains();

        Object.entries(chains).forEach(([chainId, chain]) => {
            allTime[chainId] = Math.min(
                chain.steps.length,
                Math.max(0, Math.floor(Number(source[chainId]) || 0))
            );
        });

        return { allTime };
    }

    function mergeRngQuestStates(localState = {}, remoteState = {}) {
        const local = normalizeRngQuestState(localState);
        const remote = normalizeRngQuestState(remoteState);
        const allTime = {};

        Object.keys(buildRngAllTimeQuestChains()).forEach((chainId) => {
            allTime[chainId] = Math.max(local.allTime[chainId] || 0, remote.allTime[chainId] || 0);
        });

        return { allTime };
    }

    function getRngQuestState() {
        player.quests = normalizeRngQuestState(player.quests);
        return player.quests;
    }

    function buildRngAllTimeQuestDefs() {
        const state = getRngQuestState();
        return Object.entries(buildRngAllTimeQuestChains()).map(([chainId, chain]) => {
            const tierIndex = Math.min(chain.steps.length, Math.max(0, Math.floor(Number(state.allTime[chainId]) || 0)));
            if (tierIndex >= chain.steps.length) {
                return {
                    id: `all_time_${chainId}_complete`,
                    section: "allTime",
                    chainId,
                    icon: chain.icon,
                    title: `${chain.title} Complete`,
                    desc: "Every stage has been claimed.",
                    goal: 1,
                    progress: 1,
                    progressText: "Complete",
                    goalText: "Complete",
                    rewardText: "All claimed",
                    reward: [],
                    completedChain: true
                };
            }

            const step = chain.steps[tierIndex];
            const progress = Math.max(0, Number(chain.progress()) || 0);
            return {
                id: `all_time_${chainId}_${tierIndex}`,
                section: "allTime",
                chainId,
                tierIndex,
                icon: chain.icon,
                title: `${chain.title} ${tierIndex + 1}`,
                desc: chain.describe(step.goal),
                goal: step.goal,
                progress,
                progressText: chain.formatProgress(progress),
                goalText: chain.formatProgress(step.goal),
                reward: step.reward,
                rewardText: formatRngQuestRewardText(step.reward)
            };
        });
    }

    function computeRarityScore(shark) {
        let score = 0;
        const yod = Number(shark.yod) || 1900;

        if (yod >= 2018) score += 48;
        else if (yod >= 2015) score += 42;
        else if (yod >= 2010) score += 34;
        else if (yod >= 2000) score += 24;
        else if (yod >= 1990) score += 16;
        else if (yod >= 1980) score += 10;
        else if (yod >= 1970) score += 6;

        if (shark.size === "Tiny") score += 14;
        else if (shark.size === "Giant") score += 20;
        else if (shark.size === "Large") score += 8;

        if (shark.depth === "Bathypelagic") score += 18;
        else if (shark.depth === "Mesopelagic") score += 8;

        return score;
    }

    function scoreToTierName(score) {
        if (score >= 80) return "Singularity";
        if (score >= 72) return "Omega";
        if (score >= 64) return "Hyper";
        if (score >= 56) return "Ultra";
        if (score >= 52) return "Legendary";
        if (score >= 48) return "Secret";
        if (score >= 40) return "Mythical";
        if (score >= 24) return "Epic";
        if (score >= 16) return "Rare";
        if (score >= 8) return "Uncommon";
        return "Common";
    }

    function getTierOneInFloor(tierName) {
        const index = TIER_RANK[tierName] || 0;
        return TIERS[index]?.baseOneIn || 2;
    }

    function buildOneIn(shark, tierName, tierMeta) {
        const score = computeRarityScore(shark);
        const hash = hashString(shark.name);

        if (score >= 80) {
            const variants = [1_000_000_000, 750_000_000, 500_000_000];
            return variants[hash % variants.length];
        }
        if (score >= 72) {
            return 120_000_000 + (hash % 20) * 8_000_000;
        }
        if (score >= 64) {
            return 10_000_000 + (hash % 30) * 750_000;
        }
        if (score >= 56) {
            return 1_200_000 + (hash % 40) * 120_000;
        }

        const variance = 0.82 + ((hash % 36) / 100);
        return Math.max(getTierOneInFloor(tierName), Math.round(tierMeta.baseOneIn * variance));
    }

    function getStableTierCoinReward(tierName, seed) {
        const tierMeta = getTierMeta(tierName);
        const hash = hashString(seed);
        return Math.round(tierMeta.coinReward * (0.95 + ((hash >> 4) % 15) / 100));
    }

    function applyStableMutation(shark, type) {
        const mutation = MUTATION_TYPES[type];
        if (!shark || !mutation) return shark;

        const hash = hashString(`${shark.name}:${type}:mutation`);
        const variant = 0.9 + (hash % 20) / 100;
        const mutatedOneIn = Math.max(2, Math.floor(shark.oneIn * mutation.oneInMult * variant));
        const baseTier = getBaseTierName(shark);
        const oddsTier = tierNameFromOneIn(mutatedOneIn);
        const baseTierMeta = getTierMeta(baseTier);

        return {
            ...shark,
            oneIn: mutatedOneIn,
            tier: baseTier,
            baseTier,
            oddsTier,
            className: baseTierMeta.className,
            coinReward: getStableTierCoinReward(oddsTier, `${shark.name}:${type}:mutation:coins`),
            mutation: type
        };
    }

    function getRollPoolEntryByName(name) {
        return rollPool.find((shark) => shark.name === name) || null;
    }

    function getRngRollPoolMatches(name) {
        const lookup = String(name || "").trim();
        const normalized = normalizeRngLookupText(lookup);
        if (!lookup || !normalized) return [];

        const exact = rollPool.filter((shark) => shark.name.toLowerCase() === lookup.toLowerCase());
        if (exact.length) return exact;

        const normalizedExact = rollPool.filter((shark) => normalizeRngLookupText(shark.name) === normalized);
        if (normalizedExact.length) return normalizedExact;

        return rollPool.filter((shark) => normalizeRngLookupText(shark.name).includes(normalized));
    }

    function resolveRngRollPoolEntry(name) {
        const matches = getRngRollPoolMatches(name);
        if (matches.length === 1) return matches[0];
        if (matches.length > 1) {
            throw new Error(`Multiple species matched "${name}": ${matches.slice(0, 8).map(shark => shark.name).join(", ")}. Be more specific.`);
        }
        throw new Error(`No RNG species found for "${name}".`);
    }

    function getRngRollPoolEntryForCommand(name) {
        try {
            return resolveRngRollPoolEntry(name);
        } catch (error) {
            console.warn("Unable to resolve queued RNG next-roll species:", error);
            return null;
        }
    }

    function getRngMutationOptionsText() {
        return ["base", ...MUTATION_CHANCE_ORDER].join(", ");
    }

    function resolveRngMutationKey(input = "base") {
        const raw = String(input ?? "base").trim();
        const normalized = normalizeRngLookupText(raw || "base");
        if (!normalized || ["base", "none", "normal", "nomutation", "no mutation"].includes(normalized)) {
            return null;
        }

        for (const key of MUTATION_CHANCE_ORDER) {
            const mutation = MUTATION_TYPES[key];
            if (normalized === normalizeRngLookupText(key) || normalized === normalizeRngLookupText(mutation?.name)) {
                return key;
            }
        }

        throw new Error(`Unknown mutation "${input}". Use one of: ${getRngMutationOptionsText()}.`);
    }

    function getRngMutationKeyForCommand(input = "base") {
        try {
            return resolveRngMutationKey(input);
        } catch (error) {
            console.warn("Unable to resolve queued RNG next-roll mutation:", error);
            return null;
        }
    }

    function getMutationKeyFromCollectionName(name) {
        for (const [key, mutation] of Object.entries(MUTATION_TYPES)) {
            if (String(name || "").endsWith(` (${mutation.name})`)) return key;
        }
        return null;
    }

    function getBaseNameFromCollectionEntry(name, entry) {
        if (entry?.baseName) return entry.baseName;
        const mutationKey = entry?.mutation || getMutationKeyFromCollectionName(name);
        const mutationName = MUTATION_TYPES[mutationKey]?.name;
        if (mutationName && String(name || "").endsWith(` (${mutationName})`)) {
            return name.slice(0, -(` (${mutationName})`.length));
        }
        return name;
    }

    function getCanonicalCollectionEntry(name, entry) {
        const mutationKey = entry?.mutation || getMutationKeyFromCollectionName(name);
        const baseName = getBaseNameFromCollectionEntry(name, entry);
        const baseShark = getRollPoolEntryByName(baseName);
        if (!baseShark) return null;

        const canonical = mutationKey
            ? applyStableMutation(baseShark, mutationKey)
            : baseShark;
        const canonicalKey = getCollectionKey(canonical);
        const baseTier = getBaseTierName(canonical);
        const oddsTier = getOddsTierName(canonical);

        return {
            key: canonicalKey,
            entry: {
                ...entry,
                tier: baseTier,
                baseTier,
                oddsTier,
                oneIn: canonical.oneIn,
                mutation: mutationKey || undefined,
                baseName: mutationKey ? baseShark.name : undefined
            }
        };
    }

    function getTierMeta(tierName) {
        return TIERS.find((tier) => tier.name === tierName) || TIERS[0];
    }

    function isKnownTierName(tierName) {
        return TIER_RANK[tierName] !== undefined;
    }

    function getBaseTierName(entry) {
        const tier = entry?.baseTier || entry?.tier;
        if (isKnownTierName(tier)) return tier;
        return isKnownTierName(entry?.oddsTier) ? entry.oddsTier : "Common";
    }

    function getOddsTierName(entry) {
        if (isKnownTierName(entry?.oddsTier)) return entry.oddsTier;
        const oddsTier = tierNameFromOneIn(toSafeNumber(entry?.oneIn));
        return isKnownTierName(oddsTier) ? oddsTier : getBaseTierName(entry);
    }

    function getRngSourceSpecies() {
        const speciesByName = new Map();
        const sourcePools = [
            Array.isArray(window.sharks) ? window.sharks : [],
            Array.isArray(window.rays) ? window.rays : []
        ];

        sourcePools.flat().forEach((species) => {
            if (!species?.name || speciesByName.has(species.name)) return;
            speciesByName.set(species.name, species);
        });

        return Array.from(speciesByName.values());
    }

    function buildRollPool() {
        const source = getRngSourceSpecies();
        rollPool = source.map((species) => {
            const tierName = scoreToTierName(computeRarityScore(species));
            const tierMeta = getTierMeta(tierName);
            const oneIn = buildOneIn(species, tierName, tierMeta);

            return {
                name: species.name,
                family: species.family,
                order: species.order,
                size: species.size,
                depth: species.depth,
                yod: species.yod,
                tier: tierName,
                baseTier: tierName,
                oddsTier: tierName,
                oneIn,
                coinReward: Math.round(tierMeta.coinReward * (0.9 + ((hashString(species.name + "coin") % 20) / 100))),
                className: tierMeta.className
            };
        });

        ultraRarePool = rollPool.filter((entry) => entry.oneIn >= ULTRA_ONE_IN_THRESHOLD);

        tierPools = {};
        for (const tier of TIERS) {
            tierPools[tier.name] = rollPool.filter((entry) => entry.tier === tier.name);
        }

        if (!tierPools.Common.length && rollPool.length) {
            tierPools.Common = [rollPool[0]];
        }
    }

    function getStreakLuckMultiplier() {
        const prestigeMult = 1 + getPrestigeUpgradeBonus("streakEngine", 0.08);
        if (player.streakLuckLevel <= 0) return Number((STREAK_LUCK_BASE * prestigeMult).toFixed(2));
        const upgrade = STREAK_LUCK_UPGRADES.find((entry) => entry.level === player.streakLuckLevel);
        return Number(((upgrade ? upgrade.mult : STREAK_LUCK_BASE) * prestigeMult).toFixed(2));
    }

    function isStreakLuckRoll() {
        return player.rolls > 0 && player.rolls % STREAK_LUCK_INTERVAL === 0;
    }

    function getStreakRollInfo() {
        const mult = getStreakLuckMultiplier();
        if (isStreakLuckRoll()) {
            return { label: "Streak", value: `\u00d7${mult} active`, active: true };
        }
        const until = STREAK_LUCK_INTERVAL - (player.rolls % STREAK_LUCK_INTERVAL);
        return { label: "Streak", value: `${until}/10 \u2192 \u00d7${mult}`, active: false };
    }

    function getBaseLuckMultiplier() {
        const upgradeBonus = LUCK_UPGRADES
            .slice(0, player.luckLevel)
            .reduce((sum, upgrade) => sum + upgrade.bonus, 0);
        const potionMult = getLuckPotionMultiplier();
        return (1 + upgradeBonus) * getRankLuckMultiplier() * getEquippedLuckMultiplier() * getIndexLuckMultiplier() * getPrestigeLuckMultiplier() * getPrestigeRunMomentumMultiplier() * potionMult;
    }

    function getRollLuckMultiplier() {
        let mult = getBaseLuckMultiplier();
        if (isStreakLuckRoll()) {
            mult *= getStreakLuckMultiplier();
        }
        return mult;
    }

    function getLuckMultiplier() {
        return getBaseLuckMultiplier();
    }

    function getCoinMultiplier() {
        const upgradeBonus = COIN_UPGRADES
            .slice(0, player.coinLevel)
            .reduce((sum, upgrade) => sum + upgrade.bonus, 0);
        const potionMult = player.activeEffects.coin.remaining > 0
            ? player.activeEffects.coin.mult
            : 1;
        return (1 + upgradeBonus) * getPrestigeCoinMultiplier() * potionMult;
    }

    function getEquippedCollectionEntry() {
        if (!player.equipped) return null;
        return player.collection[player.equipped] || null;
    }

    function getEquippedLuckBonus() {
        const entry = getEquippedCollectionEntry();
        return entry ? (EQUIPPED_LUCK_BONUS_BY_TIER[getBaseTierName(entry)] || 0) : 0;
    }

    function getEquippedLuckMultiplier() {
        return 1 + getEquippedLuckBonus();
    }

    function getPrestigePoints() {
        return Math.max(0, Number(player.prestigePoints) || 0);
    }

    function getTotalPrestigePoints() {
        return Math.max(getPrestigePoints(), Number(player.totalPrestigePoints) || 0);
    }

    function getPrestigeUpgradeLevel(id) {
        if (!player.prestigeUpgrades || typeof player.prestigeUpgrades !== "object") {
            player.prestigeUpgrades = {};
        }
        return Math.max(0, Math.floor(Number(player.prestigeUpgrades[id]) || 0));
    }

    function getPrestigeStarterCoinsForLevel(level) {
        const starts = [0, 250, 1_000, 5_000, 25_000, 100_000];
        return starts[Math.min(Math.max(0, level), starts.length - 1)] || 0;
    }

    function getPrestigeStarterPotionTotal(level = getPrestigeUpgradeLevel("potionSatchel")) {
        const totals = [0, 1, 2, 4, 6];
        return totals[Math.min(Math.max(0, level), totals.length - 1)] || 0;
    }

    function getPrestigeStarterPotions() {
        const level = getPrestigeUpgradeLevel("potionSatchel");
        if (level <= 0) return {};
        const starterSets = [
            {},
            { luck: 1 },
            { luck: 1, coin: 1 },
            { luck: 2, coin: 1, speed: 1 },
            { luck: 2, coin: 2, speed: 1, randomMutation: 1 }
        ];
        return starterSets[Math.min(level, starterSets.length - 1)] || {};
    }

    function getPrestigeStartingCoins() {
        return getPrestigeStarterCoinsForLevel(getPrestigeUpgradeLevel("starterCache"));
    }

    function getPrestigeStartingAutoLevel() {
        return Math.min(getPrestigeUpgradeLevel("autoSpark"), AUTO_ROLL_UPGRADES.length);
    }

    function getPrestigeMultiRollCount(level = getPrestigeUpgradeLevel("multiRoll")) {
        const index = Math.min(
            PRESTIGE_MULTI_ROLL_COUNTS.length - 1,
            Math.max(0, Math.floor(Number(level) || 0))
        );
        return PRESTIGE_MULTI_ROLL_COUNTS[index] || 1;
    }

    function getPrestigeUpgradeBonus(id, perLevel) {
        return getPrestigeUpgradeLevel(id) * perLevel;
    }

    function getPrestigeCooldownReduction() {
        return getPrestigeUpgradeLevel("swiftReturn") * 60;
    }

    function getPrestigeAutoIntervalReduction() {
        return getPrestigeUpgradeLevel("timePearl") * 80;
    }

    function getPrestigeRareCoinBonus() {
        return getPrestigeUpgradeBonus("deepVault", 0.07);
    }

    function getPrestigePotionDiscount() {
        return Math.min(0.3, getPrestigeUpgradeBonus("potionContract", 0.05));
    }

    function getPrestigeRankKeepPercent() {
        return Math.min(0.2, getPrestigeUpgradeBonus("rankAnchor", 0.05));
    }

    function getPrestigeIndexLuckValueMultiplier() {
        return 1 + getPrestigeUpgradeBonus("indexCartography", 0.1);
    }

    function getPrestigePotionDurationMultiplier() {
        return 1 + getPrestigeUpgradeBonus("potionCatalyst", 0.08);
    }

    function getPrestigeRestockReduction() {
        return Math.min(0.32, getPrestigeUpgradeBonus("restockCrew", 0.08));
    }

    function getPrestigeRareXpBonus() {
        return getPrestigeUpgradeBonus("xpSurge", 0.09);
    }

    function getPrestigeUltraCoinBonus() {
        return getPrestigeUpgradeBonus("ultraDividend", 0.12);
    }

    function getPrestigeRunMomentumMultiplier() {
        const level = getPrestigeUpgradeLevel("momentumEngine");
        if (level <= 0) return 1;
        const stacks = Math.min(10, Math.floor((player.rolls || 0) / 250));
        return 1 + (stacks * level * 0.04);
    }

    function getPotionEffectRolls(def) {
        const baseRolls = Math.max(1, Math.floor(Number(def?.rolls) || 0));
        if (def?.fixedRolls) return baseRolls;
        return Math.max(1, Math.round(baseRolls * getPrestigePotionDurationMultiplier()));
    }

    function getLuckPotionStacks() {
        if (!player.activeEffects || typeof player.activeEffects !== "object") {
            player.activeEffects = createDefaultPlayer().activeEffects;
        }
        if (!player.activeEffects.luck || typeof player.activeEffects.luck !== "object") {
            player.activeEffects.luck = { ...createDefaultPlayer().activeEffects.luck };
        }
        const luck = player.activeEffects.luck;
        if (!Array.isArray(luck.stacks)) {
            luck.stacks = [];
        }
        if (luck.remaining > 0 && luck.mult > 1 && !luck.stacks.length) {
            luck.stacks.push({
                remaining: Math.floor(luck.remaining),
                mult: Number(luck.mult) || 1
            });
        }
        luck.stacks = luck.stacks
            .map((stack) => ({
                remaining: Math.max(0, Math.floor(Number(stack.remaining) || 0)),
                mult: Math.max(1, Number(stack.mult) || 1)
            }))
            .filter((stack) => stack.remaining > 0 && stack.mult > 1)
            .sort((a, b) => b.mult - a.mult);
        luck.remaining = luck.stacks.reduce((sum, stack) => sum + stack.remaining, 0);
        luck.mult = luck.stacks[0]?.mult || 1;
        return luck.stacks;
    }

    function getLuckPotionMultiplier() {
        return getLuckPotionStacks()[0]?.mult || 1;
    }

    function getLuckPotionDisplayStacks() {
        const grouped = new Map();
        getLuckPotionStacks().forEach((stack) => {
            grouped.set(stack.mult, (grouped.get(stack.mult) || 0) + stack.remaining);
        });
        return Array.from(grouped, ([mult, remaining]) => ({ mult, remaining }))
            .sort((a, b) => b.mult - a.mult);
    }

    function addLuckPotionStack(mult, remaining) {
        const stacks = getLuckPotionStacks();
        stacks.push({
            mult: Math.max(1, Number(mult) || 1),
            remaining: Math.max(1, Math.floor(Number(remaining) || 0))
        });
        getLuckPotionStacks();
    }

    function consumeLuckPotionRoll() {
        const stacks = getLuckPotionStacks();
        if (!stacks.length) return;
        stacks[0].remaining -= 1;
        getLuckPotionStacks();
    }

    function getPrestigeMutationOddsMultiplier() {
        return 1 + getPrestigeUpgradeBonus("mutagenArchive", 0.08);
    }

    function getPrestigeApexOddsMultiplier() {
        return 1 + getPrestigeUpgradeBonus("apexMemory", 0.06);
    }

    function getPrestigeMutationBountyBonus() {
        return getPrestigeUpgradeBonus("abyssBounty", 0.1);
    }

    function getPrestigeGainMultiplier() {
        return 1 + getPrestigeUpgradeBonus("legacyTide", 0.1);
    }

    function getPrestigeTitle() {
        const depth = Math.max(0, Number(player.prestigeLevel) || 0);
        if (depth >= 25) return "Abyss Sovereign";
        if (depth >= 15) return "Void Diver";
        if (depth >= 10) return "Apex Reborn";
        if (depth >= 5) return "Deep Current";
        if (depth >= 1) return "Reef Ascendant";
        return "Unawakened";
    }

    function getPrestigeUpgradePowerSummary() {
        const maxed = PRESTIGE_UPGRADE_DEFS.filter((def) => getPrestigeUpgradeLevel(def.id) >= def.costs.length).length;
        const levels = PRESTIGE_UPGRADE_DEFS.reduce((sum, def) => sum + getPrestigeUpgradeLevel(def.id), 0);
        return {
            levels,
            maxed,
            total: PRESTIGE_UPGRADE_DEFS.length
        };
    }

    function getPrestigeLuckMultiplier() {
        return 1 + (getTotalPrestigePoints() * PRESTIGE_LUCK_PER_POINT) + getPrestigeUpgradeBonus("pearlLuck", 0.06);
    }

    function getPrestigeCoinMultiplier() {
        return 1 + (getTotalPrestigePoints() * PRESTIGE_COIN_PER_POINT) + getPrestigeUpgradeBonus("treasureCurrent", 0.05);
    }

    function getPrestigeXpMultiplier() {
        return 1 + (getTotalPrestigePoints() * PRESTIGE_XP_PER_POINT) + getPrestigeUpgradeBonus("researchMemory", 0.04);
    }

    function getPrestigePotential() {
        const bestOneIn = Math.max(0, Number(player.runBestOneIn) || 0);
        const rolls = Math.max(0, Number(player.rolls) || 0);
        const collection = Math.max(0, Number(player.runCollectionFinds) || 0);
        const bestValue = bestOneIn * (1 + getPrestigeUpgradeBonus("rareBeacon", 0.12));
        const collectionValue = collection * (1 + getPrestigeUpgradeBonus("surveyCompass", 0.12));
        const bestScore = bestValue >= PRESTIGE_MIN_BEST_ONE_IN
            ? 1 + Math.floor(Math.log10(bestValue / PRESTIGE_MIN_BEST_ONE_IN) * 3)
            : 0;
        const rollScore = Math.floor(rolls / PRESTIGE_ROLL_STEP);
        const collectionScore = Math.floor(collectionValue / PRESTIGE_COLLECTION_STEP);
        const baseGain = Math.max(0, bestScore + rollScore + collectionScore);

        return baseGain > 0
            ? Math.max(baseGain, Math.floor(baseGain * getPrestigeGainMultiplier()))
            : 0;
    }

    function getPrestigeProgressInfo() {
        const bestOneIn = Math.max(0, Number(player.runBestOneIn) || 0);
        const rolls = Math.max(0, Number(player.rolls) || 0);
        const collection = Math.max(0, Number(player.runCollectionFinds) || 0);
        return [
            {
                label: "Run best",
                value: bestOneIn ? `1/${formatOneIn(bestOneIn)}` : "No rare pull yet",
                progress: Math.min(1, bestOneIn / PRESTIGE_MIN_BEST_ONE_IN),
                target: `1/${formatOneIn(PRESTIGE_MIN_BEST_ONE_IN)}`
            },
            {
                label: "Run rolls",
                value: rolls.toLocaleString(),
                progress: Math.min(1, rolls / PRESTIGE_ROLL_STEP),
                target: `${PRESTIGE_ROLL_STEP.toLocaleString()} per point`
            },
            {
                label: "New finds",
                value: collection.toLocaleString(),
                progress: Math.min(1, collection / PRESTIGE_COLLECTION_STEP),
                target: `${PRESTIGE_COLLECTION_STEP} per point`
            }
        ];
    }

    function getNextPrestigeUpgradeCost(def) {
        return def.costs[getPrestigeUpgradeLevel(def.id)] || null;
    }

    function renderPrestigeUpgradeCards() {
        return PRESTIGE_UPGRADE_DEFS.map((def) => {
            const level = getPrestigeUpgradeLevel(def.id);
            const cost = getNextPrestigeUpgradeCost(def);
            const maxed = cost === null;
            const canBuy = !maxed && getPrestigePoints() >= cost;
            const nextText = maxed ? "MAX" : `${cost} point${cost === 1 ? "" : "s"}`;
            const progress = Math.round((level / def.costs.length) * 100);
            return `
                <article class="rng-prestige-upgrade${maxed ? " maxed" : ""}${canBuy ? " can-buy" : ""}">
                    <div class="rng-prestige-upgrade-head">
                        <i class="fa-solid ${def.icon}"></i>
                        <div>
                            <strong>${def.name}</strong>
                            <span>${def.format(level)}</span>
                        </div>
                    </div>
                    <p>${def.desc}</p>
                    <div class="rng-prestige-upgrade-track"><span style="width:${progress}%"></span></div>
                    <div class="rng-prestige-upgrade-foot">
                        <span>Lv.${level}/${def.costs.length}</span>
                        <button class="rng-btn rng-prestige-upgrade-btn" type="button" data-prestige-upgrade="${def.id}" ${canBuy ? "" : "disabled"}>${maxed ? "MAX" : `Buy ${nextText}`}</button>
                    </div>
                </article>
            `;
        }).join("");
    }

    function getXpMultiplier() {
        const upgradeBonus = XP_UPGRADES
            .slice(0, player.xpLevel)
            .reduce((sum, upgrade) => sum + upgrade.bonus, 0);
        return (1 + upgradeBonus) * getPrestigeXpMultiplier();
    }

    function getMutationBountyMultiplier(rolled) {
        if (!rolled?.mutation) return 1;
        const upgradeBonus = MUTATION_BOUNTY_UPGRADES
            .slice(0, player.mutationBountyLevel || 0)
            .reduce((sum, upgrade) => sum + upgrade.bonus, 0);
        return 1 + upgradeBonus + getPrestigeMutationBountyBonus();
    }

    function markGuaranteedPotionRoll(rolled, source) {
        const rate = GUARANTEED_ROLL_REWARD_RATES[source] || 1;

        return {
            ...rolled,
            potionSource: rolled.potionSource || source,
            rewardRate: Math.min(rolled.rewardRate || 1, rate)
        };
    }

    function getRewardCoinMultiplier(rolled) {
        const mutationBountyMult = getMutationBountyMultiplier(rolled);
        const rarePullMult = isRarePull(rolled) ? 1 + getPrestigeRareCoinBonus() : 1;
        const ultraPullMult = isUltraRarePull(rolled) ? 1 + getPrestigeUltraCoinBonus() : 1;
        if (!rolled.potionSource) return getCoinMultiplier() * mutationBountyMult * rarePullMult * ultraPullMult;
        return Math.min(getCoinMultiplier(), GUARANTEED_ROLL_COIN_MULTIPLIER_CAP) * mutationBountyMult * rarePullMult * ultraPullMult;
    }

    function getRewardRate(rolled) {
        return rolled.rewardRate || 1;
    }

    function getRollCooldownMs() {
        const reduction = ROLL_SPEED_UPGRADES
            .slice(0, player.rollSpeedLevel)
            .reduce((sum, upgrade) => sum + upgrade.reduction, 0);
        const potionMult = player.activeEffects.speed.remaining > 0 ? 0.5 : 1;
        return Math.max(180, Math.round((BASE_ROLL_COOLDOWN_MS - reduction - getPrestigeCooldownReduction()) * potionMult));
    }

    function getAutoIntervalMs() {
        const upgrade = AUTO_ROLL_UPGRADES[Math.max(0, player.autoRollLevel - 1)];
        const baseInterval = upgrade?.interval || BASE_AUTO_INTERVAL_MS;
        const potionMult = player.activeEffects.speed.remaining > 0 ? 0.5 : 1;
        return Math.max(500, Math.round((baseInterval - getPrestigeAutoIntervalReduction()) * potionMult));
    }

    function getMutationChance() {
        const prestigeLevel = getPrestigeUpgradeLevel("mutagenArchive");
        const upgrade = player.mutationLevel > 0
            ? MUTATION_LUCK_UPGRADES.find((entry) => entry.level === player.mutationLevel)
            : null;
        const baseChance = upgrade?.chance || (prestigeLevel > 0 ? 80_000 : null);
        return baseChance ? Math.max(1, Math.round(baseChance / getPrestigeMutationOddsMultiplier())) : null;
    }

    function getApexMutationChance() {
        const prestigeLevel = getPrestigeUpgradeLevel("apexMemory");
        const upgrade = player.apexLevel > 0
            ? APEX_LUCK_UPGRADES.find((entry) => entry.level === player.apexLevel)
            : null;
        const baseChance = upgrade?.chance || (prestigeLevel > 0 ? APEX_PRESTIGE_UNLOCK_ONE_IN : null);
        const naturalChance = baseChance
            ? Math.max(1, Math.round(baseChance / getPrestigeApexOddsMultiplier()))
            : null;
        const potionChance = player.activeEffects.apexSurge?.remaining > 0
            ? APEX_SURGE_POTION_ONE_IN
            : null;

        if (naturalChance === null) return potionChance;
        if (potionChance === null) return naturalChance;
        return Math.min(naturalChance, potionChance);
    }

    function getActiveGuaranteedPotionKey() {
        if (player.activeEffects.omega?.remaining > 0) return "omega";
        if (player.activeEffects.ultra?.remaining > 0) return "ultra";
        return null;
    }

    function getActiveForcedMutationEffectKey() {
        const specificType = STANDARD_MUTATION_KEYS.find((key) => player.activeEffects[key]?.remaining > 0);
        if (specificType) return specificType;
        return player.activeEffects.randomMutation?.remaining > 0 ? "randomMutation" : null;
    }

    function createRollActionContext(rollCount = 1) {
        const adminForcedRoll = consumeRngAdminNextRollCommand();
        return {
            rollCount: Math.max(1, Math.floor(Number(rollCount) || 1)),
            guaranteedPotionKey: adminForcedRoll ? null : getActiveGuaranteedPotionKey(),
            forcedMutationEffectKey: adminForcedRoll ? null : getActiveForcedMutationEffectKey(),
            usedMutationEffectKey: null,
            adminForcedRoll,
            adminForcedRollConsumed: false,
            devForcedMutationType: consumeQueuedDevForcedMutationType(),
            devForcedMutationConsumed: false
        };
    }

    function getQueuedForcedMutation(actionContext = null) {
        const effectKey = actionContext
            ? actionContext.forcedMutationEffectKey
            : getActiveForcedMutationEffectKey();

        if (!effectKey) return null;
        if (effectKey !== "randomMutation") {
            return { type: effectKey, effectKey };
        }

        if (player.activeEffects.randomMutation?.remaining > 0 || actionContext?.forcedMutationEffectKey === "randomMutation") {
            const randomType = pickWeightedMutationKey(STANDARD_MUTATION_KEYS);
            if (!randomType) return null;
            return {
                type: randomType,
                effectKey: "randomMutation"
            };
        }

        return null;
    }

    function consumeActionDevForcedMutationType(actionContext = null) {
        if (!actionContext) return consumeQueuedDevForcedMutationType();
        if (actionContext.devForcedMutationConsumed) return null;
        actionContext.devForcedMutationConsumed = true;
        return MUTATION_TYPES[actionContext.devForcedMutationType] ? actionContext.devForcedMutationType : null;
    }

    function consumeQueuedDevForcedMutationType() {
        const type = rngDevForcedMutationType;
        rngDevForcedMutationType = null;
        return MUTATION_TYPES[type] ? type : null;
    }

    function getRngAdminNextRollCommandId(command) {
        const explicitId = String(command?.commandId || "").trim();
        if (explicitId) return explicitId;
        return [
            command?.targetUid || "",
            command?.createdAtMs || "",
            command?.sharkName || "",
            command?.mutation || "base"
        ].join(":");
    }

    function getRngAdminNextRollConsumedIds() {
        if (!Array.isArray(player.adminNextRollConsumedIds)) {
            player.adminNextRollConsumedIds = [];
        }

        player.adminNextRollConsumedIds = player.adminNextRollConsumedIds
            .map(String)
            .filter(Boolean)
            .slice(-RNG_ADMIN_NEXT_ROLL_CONSUMED_LIMIT);
        return player.adminNextRollConsumedIds;
    }

    function hasConsumedRngAdminNextRollCommand(command) {
        const commandId = getRngAdminNextRollCommandId(command);
        return Boolean(commandId && getRngAdminNextRollConsumedIds().includes(commandId));
    }

    function markRngAdminNextRollCommandConsumed(command) {
        const commandId = getRngAdminNextRollCommandId(command);
        if (!commandId) return;

        const consumedIds = getRngAdminNextRollConsumedIds()
            .filter((id) => id !== commandId);
        consumedIds.push(commandId);
        player.adminNextRollConsumedIds = consumedIds.slice(-RNG_ADMIN_NEXT_ROLL_CONSUMED_LIMIT);
    }

    function getRngAdminNextRollForcedShark(command) {
        if (!command || typeof command !== "object") return null;

        const currentUser = getRngCurrentUser();
        const targetUid = String(command.targetUid || "").trim();
        if (targetUid && targetUid !== currentUser?.uid) return null;
        if (hasConsumedRngAdminNextRollCommand(command)) return null;

        const expiresAtMs = toSafeNumber(command.expiresAtMs);
        if (expiresAtMs > 0 && Date.now() > expiresAtMs) return null;

        const baseShark = getRngRollPoolEntryForCommand(command.sharkName || command.shark || command.species);
        if (!baseShark) return null;

        let mutationKey = null;
        try {
            mutationKey = resolveRngMutationKey(command.mutation || "base");
        } catch (error) {
            console.warn("Queued RNG next-roll command has an invalid mutation:", error);
            return null;
        }

        return {
            ...(mutationKey ? applyStableMutation(baseShark, mutationKey) : baseShark),
            adminCommandId: getRngAdminNextRollCommandId(command)
        };
    }

    function consumeRngAdminNextRollCommand() {
        const command = rngAdminNextRollCommand;
        const forcedShark = getRngAdminNextRollForcedShark(command);
        if (!forcedShark) return null;

        markRngAdminNextRollCommandConsumed(command);
        saveLocalProfile();
        rngAdminNextRollCommand = null;
        return forcedShark;
    }

    function consumeRollActionEffects(actionContext = {}) {
        const guaranteedPotionKey = actionContext.guaranteedPotionKey || null;

        if (guaranteedPotionKey === "omega" && player.activeEffects.omega?.remaining > 0) {
            player.activeEffects.omega.remaining = Math.max(0, player.activeEffects.omega.remaining - 1);
            startPotionRestock("omega");
        } else if (guaranteedPotionKey === "ultra" && player.activeEffects.ultra?.remaining > 0) {
            player.activeEffects.ultra.remaining = Math.max(0, player.activeEffects.ultra.remaining - 1);
            startPotionRestock("ultra");
        } else {
            tickPotionRestocks();
        }

        const mutationEffectKey = actionContext.usedMutationEffectKey;
        if (mutationEffectKey && player.activeEffects[mutationEffectKey]?.remaining > 0) {
            player.activeEffects[mutationEffectKey].remaining = Math.max(
                0,
                player.activeEffects[mutationEffectKey].remaining - 1
            );
        }

        consumeEffectRolls();
    }

    function getMutationRollWeightTotal(keys = STANDARD_MUTATION_KEYS) {
        return keys.reduce((sum, key) => sum + Math.max(0, MUTATION_TYPES[key]?.rollWeight || 0), 0);
    }

    function pickWeightedMutationKey(keys = STANDARD_MUTATION_KEYS) {
        const weightedKeys = keys.filter((key) => (MUTATION_TYPES[key]?.rollWeight || 0) > 0);
        const totalWeight = getMutationRollWeightTotal(weightedKeys);
        if (!weightedKeys.length || totalWeight <= 0) return keys[0] || null;

        let rng = Math.random() * totalWeight;
        for (const key of weightedKeys) {
            rng -= MUTATION_TYPES[key].rollWeight;
            if (rng <= 0) return key;
        }
        return weightedKeys[weightedKeys.length - 1];
    }

    function getNaturalMutationChanceOneIn(key) {
        if (key === "apex") return getApexMutationChance();
        if (!STANDARD_MUTATION_KEYS.includes(key)) return null;

        const baseChance = getMutationChance();
        const weight = MUTATION_TYPES[key]?.rollWeight || 0;
        const totalWeight = getMutationRollWeightTotal();
        if (baseChance === null || weight <= 0 || totalWeight <= 0) return null;

        return Math.round(baseChance * (totalWeight / weight));
    }

    function getNextUpgrade(list, currentLevel) {
        return list[currentLevel] || null;
    }

    function formatOneIn(value) {
        const num = Number(value);
        if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(num % 1_000_000_000 === 0 ? 0 : 2)}B`;
        if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1)}M`;
        return num.toLocaleString();
    }

    function formatCompactCoins(value) {
        const num = Math.max(0, Math.floor(Number(value) || 0));
        const units = [
            { value: 1_000_000_000_000_000, suffix: "qa" },
            { value: 1_000_000_000_000, suffix: "t" },
            { value: 1_000_000_000, suffix: "b" },
            { value: 1_000_000, suffix: "m" },
            { value: 1_000, suffix: "k" }
        ];
        const unit = units.find((entry) => num >= entry.value);
        if (unit) {
            const scaled = num / unit.value;
            const precision = scaled >= 100 || Number.isInteger(scaled) ? 0 : scaled >= 10 ? 1 : 2;
            return `${scaled.toFixed(precision).replace(/\.0+$|(\.\d*[1-9])0+$/, "$1")}${unit.suffix}`;
        }
        return String(num);
    }

    function getLuckAdjustedTierOdds(tierName, luck) {
        const tierMeta = getTierMeta(tierName);
        const minOdds = MIN_LUCK_ODDS_BY_TIER[tierName] || tierMeta.baseOneIn;
        const safeLuck = Math.max(1, Number(luck) || 1);

        return Math.max(minOdds, Math.round(tierMeta.baseOneIn / safeLuck));
    }

    function getTierLuckWeightMultiplier(tierName, luck) {
        const safeLuck = Math.max(1, Number(luck) || 1);
        const target = HIGH_LUCK_TIER_WEIGHT_MULTIPLIERS[tierName] || 1;
        const pressure = Math.min(1, Math.log10(safeLuck) / Math.log10(LUCK_BALANCE_REFERENCE));
        const baseMultiplier = 1 + ((target - 1) * pressure);

        if (safeLuck <= LUCK_BALANCE_REFERENCE) {
            return baseMultiplier;
        }

        const overchargeTarget = OVERCHARGED_LUCK_TIER_WEIGHT_MULTIPLIERS[tierName] || 1;
        const overchargePressure = Math.min(
            1,
            Math.log2(safeLuck / LUCK_BALANCE_REFERENCE) / LUCK_OVERCHARGE_SPAN
        );

        return baseMultiplier * (1 + ((overchargeTarget - 1) * overchargePressure));
    }

    function pickTierForRoll(luck) {
        const weightedTiers = [];

        for (const tier of TIERS) {
            const pool = tierPools[tier.name] || [];
            if (!pool.length) continue;

            weightedTiers.push({
                tier: tier.name,
                weight: (1 / getLuckAdjustedTierOdds(tier.name, luck)) * getTierLuckWeightMultiplier(tier.name, luck)
            });
        }

        const totalWeight = weightedTiers.reduce((sum, entry) => sum + entry.weight, 0);
        if (!Number.isFinite(totalWeight) || totalWeight <= 0) return "Common";

        let rng = Math.random() * totalWeight;
        for (const entry of weightedTiers) {
            rng -= entry.weight;
            if (rng <= 0) return entry.tier;
        }

        return weightedTiers[0]?.tier || "Common";
    }

    function pickRandomFromTier(tierName) {
        const pool = tierPools[tierName] || tierPools.Common || rollPool;
        if (!pool.length) return null;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function tierNameFromOneIn(oneIn) {
        if (oneIn >= 500_000_000) return "Singularity";
        if (oneIn >= 100_000_000) return "Omega";
        if (oneIn >= 10_000_000) return "Hyper";
        if (oneIn >= 1_000_000) return "Ultra";
        if (oneIn >= 500_000) return "Secret";
        if (oneIn >= 50_000) return "Mythical";
        if (oneIn >= 2500) return "Legendary";
        if (oneIn >= 200) return "Epic";
        if (oneIn >= 35) return "Rare";
        if (oneIn >= 8) return "Uncommon";
        return "Common";
    }

    function getAbyssEligiblePool() {
        const pool = rollPool.filter((shark) => shark.oneIn >= ULTRA_ONE_IN_THRESHOLD);
        if (pool.length) return pool;

        return [...rollPool].sort((a, b) => b.oneIn - a.oneIn).slice(0, 10);
    }

    function pickGuaranteedOmegaOrBetter() {
        const candidates = rollPool.filter((shark) => shark.oneIn >= 100_000_000);
        const shark = candidates.length
            ? candidates[Math.floor(Math.random() * candidates.length)]
            : [...rollPool].sort((a, b) => b.oneIn - a.oneIn)[0];

        return {
            ...shark
        };
    }

    function pickGuaranteedUltraRare() {
        const pool = getAbyssEligiblePool();
        const picked = pool[Math.floor(Math.random() * pool.length)];
        return {
            ...picked
        };
    }

    function consumeEffectRolls() {
        consumeLuckPotionRoll();
        if (player.activeEffects.coin.remaining > 0) player.activeEffects.coin.remaining -= 1;
        if (player.activeEffects.speed.remaining > 0) player.activeEffects.speed.remaining -= 1;
        if (player.activeEffects.apexSurge?.remaining > 0) player.activeEffects.apexSurge.remaining -= 1;
    }

    function getCollectionKey(shark) {
        return shark.mutation ? `${shark.name} (${MUTATION_TYPES[shark.mutation]?.name})` : shark.name;
    }

    function getCollectionEntryForShark(shark) {
        return player.collection[getCollectionKey(shark)] || null;
    }

    function isNewCollectionRoll(shark) {
        return Boolean(shark?.isNewFind) || getCollectionEntryForShark(shark)?.count === 1;
    }

    function finalizeRoll(rolled) {
        const rewardRate = getRewardRate(rolled);
        const coinMultiplier = getRewardCoinMultiplier(rolled);
        const coinGain = Math.round(rolled.coinReward * coinMultiplier * rewardRate);
        player.coins += coinGain;
        rolled = {
            ...rolled,
            coinReward: coinGain,
            rewardRate,
            rewardCoinMultiplier: coinMultiplier
        };

        const key = getCollectionKey(rolled);
        const baseTier = getBaseTierName(rolled);
        const oddsTier = getOddsTierName(rolled);
        const isNewFind = !player.collection[key];
        if (!player.collection[key]) {
            player.runCollectionFinds = (player.runCollectionFinds || 0) + 1;
            player.collection[key] = {
                tier: baseTier,
                baseTier,
                oddsTier,
                oneIn: rolled.oneIn,
                firstRoll: player.rolls,
                count: 1,
                mutation: rolled.mutation || undefined,
                baseName: rolled.mutation ? rolled.name : undefined
            };
        } else {
            player.collection[key].count += 1;
            if (rolled.mutation && !player.collection[key].mutation) {
                player.collection[key].mutation = rolled.mutation;
                player.collection[key].baseName = rolled.name;
            }
            player.collection[key].tier = player.collection[key].baseTier || baseTier;
            player.collection[key].baseTier = player.collection[key].baseTier || baseTier;
            if (rolled.oneIn > (player.collection[key].oneIn || 0)) {
                player.collection[key].oneIn = rolled.oneIn;
                player.collection[key].oddsTier = oddsTier;
            } else if (!player.collection[key].oddsTier) {
                player.collection[key].oddsTier = oddsTier;
            }
        }

        if (rolled.oneIn > player.bestOneIn) {
            player.bestOneIn = rolled.oneIn;
        }
        if (rolled.oneIn > (player.runBestOneIn || 0)) {
            player.runBestOneIn = rolled.oneIn;
        }

        if (!player.equipped) {
            player.equipped = key;
        }

        grantRollXp(rolled);
        const finalizedRoll = {
            ...rolled,
            isNewFind
        };
        updateRngDailyQuestsForRoll(finalizedRoll);
        return finalizedRoll;
    }

    function mergeCollectionEntry(target, key, entry) {
        const existing = target[key];
        if (!existing) {
            target[key] = entry;
            return;
        }

        target[key] = {
            ...existing,
            ...entry,
            count: (existing.count || 0) + (entry.count || 0),
            firstRoll: Math.min(existing.firstRoll || entry.firstRoll || 0, entry.firstRoll || existing.firstRoll || 0)
        };
    }

    function normalizeStoredCollectionRarities() {
        if (!player.collection || typeof player.collection !== "object") {
            player.collection = {};
            player.bestOneIn = 0;
            return true;
        }

        let changed = false;
        let bestOneIn = 0;
        const normalizedCollection = {};
        const equippedBefore = player.equipped;
        const bestBefore = player.bestOneIn || 0;
        let equippedAfter = null;

        for (const [name, entry] of Object.entries(player.collection)) {
            if (!entry || typeof entry !== "object") continue;

            const canonical = getCanonicalCollectionEntry(name, entry);
            if (!canonical) {
                const preservedOneIn = toSafeNumber(entry.oneIn);
                bestOneIn = Math.max(bestOneIn, preservedOneIn);
                mergeCollectionEntry(normalizedCollection, name, entry);
                if (name === equippedBefore) equippedAfter = name;
                continue;
            }

            mergeCollectionEntry(normalizedCollection, canonical.key, canonical.entry);
            bestOneIn = Math.max(bestOneIn, canonical.entry.oneIn || 0);

            if (
                canonical.key !== name ||
                canonical.entry.oneIn !== entry.oneIn ||
                canonical.entry.tier !== entry.tier ||
                canonical.entry.baseTier !== entry.baseTier ||
                canonical.entry.oddsTier !== entry.oddsTier ||
                canonical.entry.baseName !== entry.baseName
            ) {
                changed = true;
            }

            if (name === equippedBefore) equippedAfter = canonical.key;
        }

        player.collection = normalizedCollection;
        player.bestOneIn = bestOneIn;
        player.equipped = equippedAfter || (player.equipped && normalizedCollection[player.equipped] ? player.equipped : null);

        if (equippedBefore !== player.equipped || bestOneIn !== bestBefore) {
            changed = true;
        }

        return changed;
    }

    function getXpForLevel(level) {
        if (level <= 1) return 0;

        const levelIndex = level - 1;
        const earlyCurve = 450 * Math.pow(levelIndex, 2.08);
        const lateCurve = 900 * Math.pow(Math.max(0, levelIndex - 7), 2.18);

        return Math.floor(earlyCurve + lateCurve);
    }

    function getLevelFromXp(xp) {
        let low = 1;
        let high = 2;

        while (xp >= getXpForLevel(high)) {
            high *= 2;
        }

        while (low + 1 < high) {
            const mid = Math.floor((low + high) / 2);
            if (xp >= getXpForLevel(mid)) {
                low = mid;
            } else {
                high = mid;
            }
        }

        return low;
    }

    function getRankLuckMultiplier(level = getLevelFromXp(player.rngXp || 0)) {
        return Math.min(
            RANK_LUCK_MULTIPLIER_CAP,
            1 + ((level - 1) * RANK_LUCK_PER_LEVEL)
        );
    }

    function getRankInfo() {
        const xp = player.rngXp || 0;
        const level = getLevelFromXp(xp);
        const currentXp = getXpForLevel(level);
        const nextXp = getXpForLevel(level + 1);
        const progress = Math.min(1, (xp - currentXp) / Math.max(1, nextXp - currentXp));
        const rankLuckMult = getRankLuckMultiplier(level);
        const luckBonus = rankLuckMult - 1;

        return {
            current: { name: `Level ${level}`, xp: currentXp, icon: PLAYER_RANK_ICON },
            next: { name: `Level ${level + 1}`, xp: nextXp, icon: PLAYER_RANK_ICON },
            level,
            xp,
            progress,
            rankLuckMult,
            luckBonus
        };
    }

    function grantRollXp(shark) {
        let xp = 4 + Math.floor(Math.random() * 4);
        const tierRank = TIER_RANK[getOddsTierName(shark)] || 0;

        if (tierRank >= TIER_RANK.Rare) xp += 12;
        if (tierRank >= TIER_RANK.Epic) xp += 28;
        if (tierRank >= TIER_RANK.Legendary) xp += 60;
        if (tierRank >= TIER_RANK.Mythical) xp += 120;
        if (shark.oneIn >= ULTRA_ONE_IN_THRESHOLD) xp += 250;
        if (tierRank >= TIER_RANK.Rare) xp = Math.round(xp * (1 + getPrestigeRareXpBonus()));
        xp = Math.max(1, Math.round(xp * getXpMultiplier()));

        const before = getRankInfo();
        player.rngXp = (player.rngXp || 0) + xp;
        const after = getRankInfo();

        if (after.level !== before.level) {
            showToast(`${after.current.icon} Rank up: ${after.current.name} (+${Math.round(after.luckBonus * 100)}% luck)!`);
            GameFx.play("upgrade");
        }
    }

    function updateRankUi() {
        const info = getRankInfo();
        const rankEl = document.getElementById("rng-rank-name");
        const rankIcon = document.getElementById("rng-rank-icon");
        const xpFill = document.getElementById("rng-xp-fill");
        const xpText = document.getElementById("rng-xp-text");

        if (rankEl) rankEl.textContent = `${info.current.name} \u00b7 +${Math.round(info.luckBonus * 100)}% Luck`;
        if (rankIcon) rankIcon.textContent = info.current.icon;
        if (xpFill) xpFill.style.width = `${Math.round(info.progress * 100)}%`;
        if (xpText) {
            xpText.textContent = `${info.xp.toLocaleString()} / ${info.next.xp.toLocaleString()} XP`;
        }
    }

function rollForShark(actionContext = createRollActionContext(1)) {
    player.rolls += 1;
    const streakLuckActive = isStreakLuckRoll();

    let rolled = null;
    const forcedMutation = getQueuedForcedMutation(actionContext);
    const devForcedMutationType = consumeActionDevForcedMutationType(actionContext);
    const hasForcedMutation = forcedMutation || devForcedMutationType;
    const guaranteedPotionKey = actionContext.guaranteedPotionKey || null;
    const adminForcedRoll = actionContext.adminForcedRoll && !actionContext.adminForcedRollConsumed
        ? actionContext.adminForcedRoll
        : null;

    if (adminForcedRoll) {
        actionContext.adminForcedRollConsumed = true;
        rolled = { ...adminForcedRoll };
    }

    // =========================================
    // OMEGA / ULTRA GUARANTEED POTIONS
    // =========================================

    if (!rolled && guaranteedPotionKey === "omega") {

        rolled = markGuaranteedPotionRoll(pickGuaranteedOmegaOrBetter(), "omegaPotion");

    } else if (!rolled && guaranteedPotionKey === "ultra") {

        rolled = markGuaranteedPotionRoll(pickGuaranteedUltraRare(), "ultraPotion");
    }

    // =========================================
    // RANDOM APEX MUTATION ROLL
    // =========================================

    if (!rolled && !hasForcedMutation) {

        const apexChance = getApexMutationChance();

        if (
            apexChance !== null &&
            Math.random() < (1 / apexChance)
        ) {
            const picked =
                rollPool[Math.floor(Math.random() * rollPool.length)];

            rolled = applyStableMutation(picked, "apex");
        }
    }

    // =========================================
    // RANDOM STANDARD MUTATION ROLL
    // =========================================

    if (!rolled && !hasForcedMutation) {

        const mutationChance = getMutationChance();

        if (
            mutationChance !== null &&
            Math.random() < (1 / mutationChance)
        ) {

            const mutationKey = pickWeightedMutationKey(STANDARD_MUTATION_KEYS);

            // Pick a normal shark FIRST
            const picked =
                rollPool[Math.floor(Math.random() * rollPool.length)];

            if (mutationKey) {
                rolled = applyStableMutation(picked, mutationKey);
            }
        }
    }

    // =========================================
    // NORMAL WEIGHTED RNG SYSTEM
    // =========================================

    if (!rolled) {

        const luck = getRollLuckMultiplier();
        const tier = pickTierForRoll(luck);
        rolled = pickRandomFromTier(tier);

        // fallback
        if (!rolled) {
            rolled = pickRandomFromTier("Common") || rollPool[Math.floor(Math.random() * rollPool.length)];
        }
    }

    // =========================================
    // GUARANTEED MUTATION POTIONS
    // =========================================

    function applyForcedMutation(type, effectKey = type) {
        rolled = applyStableMutation(rolled, type);

        rolled = markGuaranteedPotionRoll(rolled, "mutationPotion");
        actionContext.usedMutationEffectKey = effectKey;
    }

    if (devForcedMutationType) {
        rolled = applyStableMutation(rolled, devForcedMutationType);
    } else if (forcedMutation) {
        applyForcedMutation(forcedMutation.type, forcedMutation.effectKey);
    }

    return finalizeRoll({
        ...rolled,
        streakLuckActive
    });
}

    function saveLocalProfile() {
        if (localSaveTimer) {
            clearTimeout(localSaveTimer);
            localSaveTimer = null;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
        localSaveDirty = false;
    }

    function flushLocalProfileSave() {
        if (localSaveDirty) saveLocalProfile();
        if (rngCloudSaveDirty) {
            syncRngProfileToFirebase({ force: true }).catch(error => {
                console.warn("RNG cloud save flush failed:", error);
            });
        }
    }

    function scheduleLocalProfileSave() {
        localSaveDirty = true;
        if (localSaveTimer) return;

        localSaveTimer = setTimeout(() => {
            localSaveTimer = null;
            flushLocalProfileSave();
        }, LOCAL_SAVE_INTERVAL_MS);
    }

    function bindLocalProfileSaveFlush() {
        if (localSaveFlushBound) return;
        localSaveFlushBound = true;

        window.addEventListener("pagehide", flushLocalProfileSave);
        window.addEventListener("beforeunload", flushLocalProfileSave);
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") flushLocalProfileSave();
        });
    }

    function loadLocalProfile() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            const parsedPrestigeLevel = Math.max(0, Math.floor(Number(parsed.prestigeLevel) || 0));
            const parsedCollectionCount = parsed.collection && typeof parsed.collection === "object"
                ? Object.keys(parsed.collection).length
                : 0;
            player = {
                ...createDefaultPlayer(),
                ...parsed,
                rollSpeedLevel: Math.min(parsed.rollSpeedLevel || 0, ROLL_SPEED_UPGRADES.length),
                autoRollLevel: Math.min(
                    parsed.autoRollLevel ?? Math.min(parsed.autoSpeedLevel || 0, 1),
                    AUTO_ROLL_UPGRADES.length
                ),
                apexLevel: Math.min(parsed.apexLevel || 0, APEX_LUCK_UPGRADES.length),
                mutationBountyLevel: Math.min(parsed.mutationBountyLevel || 0, MUTATION_BOUNTY_UPGRADES.length),
                potionRestockLevel: Math.min(parsed.potionRestockLevel || 0, POTION_RESTOCK_UPGRADES.length),
                xpLevel: Math.min(parsed.xpLevel || 0, XP_UPGRADES.length),
                potions: { ...createDefaultPotions(), ...(parsed.potions || {}) },
                potionRestock: {
                    ...createDefaultPlayer().potionRestock,
                    ...(parsed.potionRestock || {})
                },
                activeEffects: {
                    ...createDefaultPlayer().activeEffects,
                    ...(parsed.activeEffects || {}),
                    luck: { ...createDefaultPlayer().activeEffects.luck, ...(parsed.activeEffects?.luck || {}) },
                    coin: { ...createDefaultPlayer().activeEffects.coin, ...(parsed.activeEffects?.coin || {}) },
                    speed: { ...createDefaultPlayer().activeEffects.speed, ...(parsed.activeEffects?.speed || {}) },
                    ultra: { ...createDefaultPlayer().activeEffects.ultra, ...(parsed.activeEffects?.ultra || {}) },
                    omega: { ...createDefaultPlayer().activeEffects.omega, ...(parsed.activeEffects?.omega || {}) },
                    apexSurge: { ...createDefaultPlayer().activeEffects.apexSurge, ...(parsed.activeEffects?.apexSurge || {}) },
                    albino: { ...createDefaultPlayer().activeEffects.albino, ...(parsed.activeEffects?.albino || {}) },
                    shiny: { ...createDefaultPlayer().activeEffects.shiny, ...(parsed.activeEffects?.shiny || {}) },
                    bioluminescent: { ...createDefaultPlayer().activeEffects.bioluminescent, ...(parsed.activeEffects?.bioluminescent || {}) },
                    megatooth: { ...createDefaultPlayer().activeEffects.megatooth, ...(parsed.activeEffects?.megatooth || {}) },
                    randomMutation: { ...createDefaultPlayer().activeEffects.randomMutation, ...(parsed.activeEffects?.randomMutation || {}) }
                },
                collection: parsed.collection && typeof parsed.collection === "object" ? parsed.collection : {},
                claimedIndexRewards: Array.isArray(parsed.claimedIndexRewards) ? parsed.claimedIndexRewards : [],
                dailyQuests: normalizeRngDailyQuestState(parsed.dailyQuests || parsed.dailyMissions),
                quests: normalizeRngQuestState(parsed.quests),
                adminNextRollConsumedIds: Array.isArray(parsed.adminNextRollConsumedIds)
                    ? parsed.adminNextRollConsumedIds.map(String).filter(Boolean).slice(-RNG_ADMIN_NEXT_ROLL_CONSUMED_LIMIT)
                    : [],
                prestigeLevel: parsedPrestigeLevel,
                prestigePoints: Math.max(0, Math.floor(Number(parsed.prestigePoints) || 0)),
                totalPrestigePoints: Math.max(0, Math.floor(Number(parsed.totalPrestigePoints) || Number(parsed.prestigePoints) || 0)),
                highestPrestigeGain: Math.max(0, Math.floor(Number(parsed.highestPrestigeGain) || 0)),
                prestigeUpgrades: parsed.prestigeUpgrades && typeof parsed.prestigeUpgrades === "object"
                    ? Object.fromEntries(PRESTIGE_UPGRADE_DEFS.map((def) => {
                        const level = Math.max(0, Math.floor(Number(parsed.prestigeUpgrades[def.id]) || 0));
                        return [def.id, Math.min(level, def.costs.length)];
                    }))
                    : {},
                runBestOneIn: parsed.runBestOneIn === undefined
                    ? (parsedPrestigeLevel > 0 ? 0 : Math.max(0, Number(parsed.bestOneIn) || 0))
                    : Math.max(0, Number(parsed.runBestOneIn) || 0),
                runCollectionFinds: parsed.runCollectionFinds === undefined
                    ? (parsedPrestigeLevel > 0 ? 0 : parsedCollectionCount)
                    : Math.max(0, Math.floor(Number(parsed.runCollectionFinds) || 0)),
                prestigeHistory: Array.isArray(parsed.prestigeHistory)
                    ? parsed.prestigeHistory.slice(0, PRESTIGE_HISTORY_LIMIT)
                    : [],
                settings: {
                    ...createDefaultPlayer().settings,
                    ...(parsed.settings || {}),
                    skipCutscenes: {
                        ...createDefaultPlayer().settings.skipCutscenes,
                        ...(parsed.settings?.skipCutscenes || {})
                    },
                    seenCutscenes: {
                        ...createDefaultPlayer().settings.seenCutscenes,
                        ...(parsed.settings?.seenCutscenes || {})
                    },
                    soundEnabled: parsed.settings?.soundEnabled !== false
                }
            };
            if (normalizeStoredCollectionRarities()) {
                saveLocalProfile();
            }
        } catch (error) {
            console.warn("Failed to load local RNG profile:", error);
            player = createDefaultPlayer();
        }
    }

    function scheduleCloudSync() {
        scheduleRngLeaderboardSync();
        scheduleRngCloudProfileSync();
    }

    function persistPlayerState(options = {}) {
        scheduleLocalProfileSave();
        scheduleCloudSync();
        updateAllUi(options);
    }

    function getCollectionCount() {
        return Object.keys(player.collection).length;
    }

    function getCollectionTargetCount() {
        return rollPool.length * (1 + Object.keys(MUTATION_TYPES).length);
    }

    function getIndexRewardGoal(reward) {
        return reward.id === "index_complete" ? getCollectionTargetCount() : reward.goal;
    }

    function getClaimedIndexRewardSet() {
        if (!Array.isArray(player.claimedIndexRewards)) {
            player.claimedIndexRewards = [];
        }
        return new Set(player.claimedIndexRewards);
    }

    function getIndexLuckBonus() {
        const claimed = getClaimedIndexRewardSet();
        return INDEX_REWARD_DEFS.reduce((sum, reward) => {
            if (!claimed.has(reward.id)) return sum;
            return sum + reward.effects
                .filter((effect) => effect.type === "luckBonus")
                .reduce((effectSum, effect) => effectSum + effect.amount, 0);
        }, 0);
    }

    function getIndexLuckMultiplier() {
        return 1 + (getIndexLuckBonus() * getPrestigeIndexLuckValueMultiplier());
    }

    function getStoredPotionCount() {
        return Object.keys(POTION_DEFS).reduce((sum, key) => sum + Math.max(0, player.potions[key] || 0), 0);
    }

    function getActivePotionChargeCount() {
        const effects = player.activeEffects || {};
        return [
            "luck", "coin", "speed", "ultra", "omega",
            "apexSurge",
            ...STANDARD_MUTATION_KEYS,
            "randomMutation"
        ].reduce((sum, key) => sum + Math.max(0, effects[key]?.remaining || 0), 0);
    }

    function getPotionTotalCount() {
        return getStoredPotionCount() + getActivePotionChargeCount();
    }

    function getRarityClass(tierName) {
        return getTierMeta(tierName).className;
    }

    function getPotionRestock(key) {
        return Math.max(0, player.potionRestock?.[key] || 0);
    }

    function getEffectivePotionRestockRolls(key) {
        const baseRestock = POTION_DEFS[key]?.restockRolls || 0;
        if (!baseRestock) return 0;

        const upgrade = (player.potionRestockLevel || 0) > 0
            ? POTION_RESTOCK_UPGRADES[Math.min(
                POTION_RESTOCK_UPGRADES.length - 1,
                player.potionRestockLevel - 1
            )]
            : null;
        let restock = baseRestock;
        if (key === "ultra") restock = upgrade?.ultraRestock || baseRestock;
        if (key === "omega") restock = upgrade?.omegaRestock || baseRestock;
        return Math.max(1, Math.round(restock * (1 - getPrestigeRestockReduction())));
    }

    function getPotionHeldCount(key) {
        return (player.potions[key] || 0) + (player.activeEffects[key]?.remaining || 0);
    }

    function getPotionCost(key) {
        const def = POTION_DEFS[key];
        if (!def) return 0;
        return Math.max(1, Math.round(def.cost * (1 - getPrestigePotionDiscount())));
    }

    function normalizePotionBuyAmount(value = selectedPotionBuyAmount) {
        const amount = Math.floor(Number(value));
        if (!Number.isFinite(amount)) return 1;
        return Math.min(POTION_BUY_AMOUNT_MAX, Math.max(1, amount));
    }

    function getSelectedPotionBuyAmount() {
        selectedPotionBuyAmount = normalizePotionBuyAmount(selectedPotionBuyAmount);
        return selectedPotionBuyAmount;
    }

    function getPotionBuyQuantity(key, requestedAmount = getSelectedPotionBuyAmount()) {
        const def = POTION_DEFS[key];
        if (!def) return 0;

        const amount = Math.max(1, Math.floor(Number(requestedAmount) || 1));
        if (!def.maxOwned) return amount;

        return Math.max(0, Math.min(amount, def.maxOwned - getPotionHeldCount(key)));
    }

    function getPotionBatchCost(key, quantity = getPotionBuyQuantity(key)) {
        return getPotionCost(key) * Math.max(0, quantity);
    }

    function getPotionMaxBuyQuantity(key) {
        const def = POTION_DEFS[key];
        if (!def || getPotionRestock(key) > 0) return 0;

        const cost = getPotionCost(key);
        const affordable = Math.max(0, Math.floor((Number(player.coins) || 0) / Math.max(1, cost)));
        if (!def.maxOwned) return affordable;

        return Math.max(0, Math.min(affordable, def.maxOwned - getPotionHeldCount(key)));
    }

    function getPotionPurchaseBlockReason(key, quantity = getPotionBuyQuantity(key)) {
        const def = POTION_DEFS[key];
        if (!def) return "Unknown potion";

        if (def.maxOwned && getPotionHeldCount(key) >= def.maxOwned) {
            return "Already stocked";
        }

        if (quantity <= 0) {
            return "Already stocked";
        }

        const restock = getPotionRestock(key);
        if (restock > 0) {
            return `Restocks after ${restock} normal roll${restock === 1 ? "" : "s"}`;
        }

        const cost = getPotionBatchCost(key, quantity);
        if (player.coins < cost) {
            return `Need ${formatCompactCoins(cost)} coins`;
        }

        return "";
    }

    function updatePotionBuyButton(button, key) {
        if (!button) return;

        const buyQuantity = getPotionBuyQuantity(key);
        const batchCost = getPotionBatchCost(key, buyQuantity);
        const blockReason = getPotionPurchaseBlockReason(key, buyQuantity);
        const restock = getPotionRestock(key);
        button.textContent = restock > 0
            ? `${restock} rolls`
            : buyQuantity > 1
                ? `x${buyQuantity.toLocaleString()} ${formatCompactCoins(batchCost)}`
                : formatCompactCoins(batchCost || getPotionCost(key));
        button.title = blockReason || `Buy ${buyQuantity.toLocaleString()} for ${batchCost.toLocaleString()} coins`;
        button.disabled = Boolean(blockReason);
    }

    function updatePotionBuyButtons() {
        document.querySelectorAll("[data-potion-buy-key]").forEach((button) => {
            updatePotionBuyButton(button, button.dataset.potionBuyKey);
        });
    }

    function updatePotionMaxBuyButton(button, key) {
        if (!button) return;

        const quantity = getPotionMaxBuyQuantity(key);
        const blockReason = quantity > 0
            ? ""
            : getPotionPurchaseBlockReason(key, getPotionBuyQuantity(key, 1)) || "Cannot buy";
        button.disabled = quantity <= 0;
        button.title = quantity > 0
            ? `Buy max (${quantity.toLocaleString()}) for ${getPotionBatchCost(key, quantity).toLocaleString()} coins`
            : blockReason;
    }

    function startPotionRestock(key) {
        const restockRolls = getEffectivePotionRestockRolls(key);
        if (!restockRolls) return;

        if (!player.potionRestock || typeof player.potionRestock !== "object") {
            player.potionRestock = { ...createDefaultPlayer().potionRestock };
        }

        player.potionRestock[key] = restockRolls;
    }

    function tickPotionRestocks() {
        if (!player.potionRestock || typeof player.potionRestock !== "object") return;

        for (const key of Object.keys(player.potionRestock)) {
            if (player.potionRestock[key] > 0) {
                player.potionRestock[key] -= 1;
            }
        }
    }

    function applyIndexRewardEffect(effect) {
        if (effect.type === "potion" && POTION_DEFS[effect.key]) {
            player.potions[effect.key] = (player.potions[effect.key] || 0) + effect.amount;
        } else if (effect.type === "coins") {
            player.coins += effect.amount;
        }
    }

    function getReadyIndexRewards(claimed = getClaimedIndexRewardSet()) {
        const collected = getCollectionCount();
        return INDEX_REWARD_DEFS.filter((reward) => (
            !claimed.has(reward.id) &&
            collected >= getIndexRewardGoal(reward)
        ));
    }

    function applyIndexRewardClaim(reward, claimed) {
        reward.effects.forEach(applyIndexRewardEffect);
        claimed.add(reward.id);
    }

    function claimIndexReward(rewardId) {
        const reward = INDEX_REWARD_DEFS.find((entry) => entry.id === rewardId);
        if (!reward) return;

        const claimed = getClaimedIndexRewardSet();
        if (claimed.has(reward.id)) return;

        if (getCollectionCount() < getIndexRewardGoal(reward)) {
            showToast("Index milestone not ready yet.", "error");
            return;
        }

        applyIndexRewardClaim(reward, claimed);
        player.claimedIndexRewards = [...claimed];
        persistPlayerState();
        showToast(`${reward.title} claimed: ${reward.rewardText}`);
        GameFx.play("upgrade");
    }

    function claimAllIndexRewards() {
        const claimed = getClaimedIndexRewardSet();
        const readyRewards = getReadyIndexRewards(claimed);
        if (!readyRewards.length) {
            showToast("No index rewards ready.", "error");
            return;
        }

        readyRewards.forEach((reward) => applyIndexRewardClaim(reward, claimed));
        player.claimedIndexRewards = [...claimed];
        persistPlayerState();
        showToast(`Claimed ${readyRewards.length.toLocaleString()} index reward${readyRewards.length === 1 ? "" : "s"}.`);
        GameFx.play("upgrade");
    }

    function applyRngQuestReward(effect) {
        if (effect.type === "coins") {
            player.coins += Math.max(0, Math.floor(Number(effect.amount) || 0));
        } else if (effect.type === "potion" && POTION_DEFS[effect.key]) {
            player.potions[effect.key] = (player.potions[effect.key] || 0) + Math.max(1, Math.floor(Number(effect.amount) || 1));
        }
    }

    function getRngQuestProgress(quest) {
        if (quest.section === "daily") return getRngDailyQuestProgress(quest);
        if (quest.section === "allTime") return Math.min(quest.goal, Math.max(0, Number(quest.progress) || 0));
        return 0;
    }

    function isRngQuestClaimed(quest) {
        if (quest.section === "daily") return isRngDailyQuestClaimed(quest);
        return Boolean(quest.completedChain);
    }

    function isRngQuestReady(quest) {
        return !isRngQuestClaimed(quest) && getRngQuestProgress(quest) >= quest.goal;
    }

    function getVisibleRngQuestDefs() {
        return [
            ...buildRngDailyQuestDefs(),
            ...buildRngAllTimeQuestDefs()
        ];
    }

    function markRngQuestClaimed(quest) {
        if (quest.section === "daily") {
            const state = getRngDailyQuestState();
            state.claimed = [...new Set([...(state.claimed || []), quest.id])].slice(0, RNG_DAILY_QUEST_COUNT);
        } else if (quest.section === "allTime" && !quest.completedChain) {
            const state = getRngQuestState();
            state.allTime[quest.chainId] = Math.max(
                Math.floor(Number(state.allTime[quest.chainId]) || 0),
                quest.tierIndex + 1
            );
        }
    }

    function claimRngQuest(questId) {
        const quest = getVisibleRngQuestDefs().find((entry) => entry.id === questId);
        if (!quest || isRngQuestClaimed(quest)) return;

        if (!isRngQuestReady(quest)) {
            showToast("Quest is not ready yet.", "error");
            return;
        }

        quest.reward.forEach(applyRngQuestReward);
        markRngQuestClaimed(quest);
        persistPlayerState();
        showToast(`${quest.title} claimed: ${quest.rewardText}`);
        GameFx.play("upgrade");
    }

    function claimAllRngQuests() {
        const ready = getVisibleRngQuestDefs().filter(isRngQuestReady);

        if (!ready.length) {
            showToast("No quests ready.", "error");
            return;
        }

        ready.forEach((quest) => {
            quest.reward.forEach(applyRngQuestReward);
            markRngQuestClaimed(quest);
        });

        persistPlayerState();
        showToast(`Claimed ${ready.length.toLocaleString()} quest${ready.length === 1 ? "" : "s"}.`);
        GameFx.play("upgrade");
    }

    function getRngDailyResetText() {
        const now = new Date();
        const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
        const ms = Math.max(0, tomorrow.getTime() - now.getTime());
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        return `${hours}h ${minutes}m`;
    }

    function renderRngQuestsPanel() {
        const panel = document.getElementById("rng-quests-panel");
        if (!panel) return;

        const dailyQuests = buildRngDailyQuestDefs();
        const allTimeQuests = buildRngAllTimeQuestDefs();
        const ready = [...dailyQuests, ...allTimeQuests].filter(isRngQuestReady);
        const claimedDaily = dailyQuests.filter(isRngQuestClaimed).length;
        const activeAllTime = allTimeQuests.filter((quest) => !quest.completedChain).length;
        const renderCard = (quest) => {
            const progress = getRngQuestProgress(quest);
            const percent = quest.goal > 0 ? Math.min(100, Math.round((progress / quest.goal) * 100)) : 0;
            const claimed = isRngQuestClaimed(quest);
            const readyToClaim = isRngQuestReady(quest);
            const stateClass = claimed ? "claimed" : readyToClaim ? "ready" : "active";
            const progressText = quest.progressText || progress.toLocaleString();
            const goalText = quest.goalText || quest.goal.toLocaleString();

            return `
                <article class="rng-quest-card ${stateClass}">
                    <div class="rng-quest-card-top">
                        <i class="fa-solid ${quest.icon}" aria-hidden="true"></i>
                        <div>
                            <strong>${quest.title}</strong>
                            <span>${quest.desc}</span>
                        </div>
                    </div>
                    <div class="rng-quest-progress">
                        <span style="width:${percent}%"></span>
                    </div>
                    <div class="rng-quest-card-bottom">
                        <span>${progressText} / ${goalText}</span>
                        <em>${quest.rewardText}</em>
                        <button class="rng-btn rng-quest-claim-btn" type="button" data-rng-quest="${quest.id}" ${readyToClaim ? "" : "disabled"}>${claimed ? "Complete" : readyToClaim ? "Claim" : "In Progress"}</button>
                    </div>
                </article>
            `;
        };

        panel.innerHTML = `
            <div class="rng-quest-head">
                <div>
                    <span>Quests</span>
                    <strong>${ready.length ? `${ready.length} ready` : "No quests ready"}</strong>
                </div>
                <button id="rng-quest-claim-all" class="rng-btn rng-btn-ghost" type="button" ${ready.length ? "" : "disabled"}>Claim Ready${ready.length ? ` (${ready.length})` : ""}</button>
            </div>
            <section class="rng-quest-section">
                <div class="rng-quest-section-head">
                    <span>Daily Quests</span>
                    <em>${claimedDaily}/${dailyQuests.length} claimed · resets in ${getRngDailyResetText()}</em>
                </div>
                ${dailyQuests.map(renderCard).join("")}
            </section>
            <section class="rng-quest-section">
                <div class="rng-quest-section-head">
                    <span>All-Time Goals</span>
                    <em>${activeAllTime} active chains</em>
                </div>
                ${allTimeQuests.map(renderCard).join("")}
            </section>
        `;

        panel.querySelector("#rng-quest-claim-all")?.addEventListener("click", claimAllRngQuests);
        panel.querySelectorAll("[data-rng-quest]").forEach((button) => {
            button.addEventListener("click", () => claimRngQuest(button.dataset.rngQuest));
        });
    }

    function isRngQuestsPanelActive() {
        return Boolean(document.getElementById("rng-tab-quests")?.classList.contains("active"));
    }

function updateActiveEffectsUi() {
         const el = document.getElementById("rng-active-effects");
         if (!el) return;

         const parts = [];
         const luckStacks = getLuckPotionDisplayStacks();
         if (luckStacks.length) {
             luckStacks.forEach((stack) => {
                 parts.push(`\u{1F340} Luck x${stack.mult} (${stack.remaining})`);
             });
         }
         if (player.activeEffects.coin.remaining > 0) {
             parts.push(`\u{1F4B0} Coin \u00d7${player.activeEffects.coin.mult} (${player.activeEffects.coin.remaining})`);
         }
         if (player.activeEffects.speed.remaining > 0) {
             parts.push(`\u26A1 Speed (${player.activeEffects.speed.remaining})`);
         }
         if (player.activeEffects.ultra.remaining > 0) {
             parts.push("\u{1F30A} Abyss ready");
         }
         if (player.activeEffects.omega.remaining > 0) {
             parts.push("\u{1F31F} Omega ready");
         }
         if (player.activeEffects.apexSurge?.remaining > 0) {
             parts.push(`\u{1F988} Apex surge (${player.activeEffects.apexSurge.remaining})`);
         }
         for (const key of STANDARD_MUTATION_KEYS) {
             if (player.activeEffects[key]?.remaining > 0) {
                 parts.push(`${MUTATION_TYPES[key].icon} ${MUTATION_TYPES[key].name} ready`);
             }
         }
         if (player.activeEffects.randomMutation?.remaining > 0) {
             parts.push(`\u{1F9EC} Random mutation (${player.activeEffects.randomMutation.remaining})`);
         }
         const mChance = getMutationChance();
         if (mChance !== null) {
             parts.push(`\u{1F9EC} Mutation: 1 in ${mChance.toLocaleString()}`);
         }
         const apexChance = getApexMutationChance();
         if (apexChance !== null) {
             parts.push(`\u{1F988} Apex: 1 in ${apexChance.toLocaleString()}`);
         }

         if (parts.length) {
             el.replaceChildren(...parts.map((part) => {
                 const item = document.createElement("span");
                 item.className = "rng-buff-item";
                 item.textContent = part;
                 return item;
             }));
             el.removeAttribute("data-empty");
         } else {
             el.replaceChildren();
             el.setAttribute("data-empty", "true");
         }
     }
 
     function showToast(message, type = "success") {
         const toast = document.getElementById("rng-toast");
         if (!toast) return;
         toast.textContent = message;
         toast.className = `rng-toast visible ${type}`;
         clearTimeout(showToast._timer);
         showToast._timer = setTimeout(() => {
             toast.className = "rng-toast hidden";
         }, 2800);
     }
 
     function updateRollButtonState() {
         const rollBtn = document.getElementById("rng-roll-btn");
         if (!rollBtn) return;
 
         const now = Date.now();
         const remaining = Math.max(0, rollLockedUntil - now);
         const isOnCooldown = remaining > 0;
         const multiRollCount = getPrestigeMultiRollCount();
         const rollText = multiRollCount > 1 ? `Roll x${multiRollCount}` : "Roll";
         if (rollBtn.dataset.rollText !== rollText) {
             rollBtn.dataset.rollText = rollText;
             rollBtn.innerHTML = `<i class="fa-solid fa-dice"></i> ${rollText}`;
         }
         rollBtn.title = multiRollCount > 1
             ? `Roll ${multiRollCount} times at once`
             : "Roll";

         rollBtn.disabled = isOnCooldown || isRolling;
         if (isOnCooldown) {
             rollBtn.classList.add("rng-btn-cooldown");
         } else {
             rollBtn.classList.remove("rng-btn-cooldown");
         }
     }
 
     function startCooldownTimer() {
         if (cooldownInterval) clearInterval(cooldownInterval);
         cooldownInterval = setInterval(() => {
             updateRollButtonState();
             if (Date.now() >= rollLockedUntil) {
                 clearInterval(cooldownInterval);
                 cooldownInterval = null;
             }
         }, 100);
     }
 
     function updateStatsUi() {
         const topCoins = document.querySelector("#rng-top-coins span");
         const topPrestige = document.querySelector("#rng-top-prestige span");
         const topLuck = document.querySelector("#rng-top-luck span");
         const topCollection = document.querySelector("#rng-top-collection span");
         const rollsEl = document.getElementById("rng-roll-text");
         const bestEl = document.getElementById("rng-best-text");
         const streakEl = document.getElementById("rng-streak-text");
         const cooldownEl = document.getElementById("rng-cooldown-text");
         const streakInfo = getStreakRollInfo();
 
         if (topCoins) {
             topCoins.textContent = `${formatCompactCoins(player.coins)} (${getCoinMultiplier().toFixed(1)}\u00d7)`;
             topCoins.title = `${player.coins.toLocaleString()} coins`;
         }
         if (topPrestige) {
             topPrestige.textContent = `${getPrestigePoints()} (${player.prestigeLevel || 0})`;
             topPrestige.title = `${getPrestigePoints().toLocaleString()} unspent prestige points \u00b7 ${getTotalPrestigePoints().toLocaleString()} earned \u00b7 ${player.prestigeLevel || 0} prestiges`;
         }
         if (topLuck) topLuck.textContent = `x${getLuckMultiplier().toFixed(2)}`;
         if (topCollection) topCollection.textContent = `${getCollectionCount()}/${getCollectionTargetCount()}`;
         if (rollsEl) rollsEl.textContent = player.rolls.toLocaleString();
         if (bestEl) {
             bestEl.textContent = player.bestOneIn
                 ? `1/${formatOneIn(player.bestOneIn)}`
                 : "\u2014";
         }
         if (streakEl) {
             streakEl.textContent = streakInfo.value;
             streakEl.closest(".rng-quick-stat")?.classList.toggle("rng-quick-stat-active", streakInfo.active);
         }
         if (cooldownEl) cooldownEl.textContent = `${(getRollCooldownMs() / 1000).toFixed(1)}s`;
         updateActiveEffectsUi();
     }
 
     function updateEquippedUi() {
        const equippedEl = document.getElementById("rng-equipped-name");
        const equippedMeta = document.getElementById("rng-equipped-meta");
        if (!equippedEl || !equippedMeta) return;

        if (!player.equipped) {
            equippedEl.textContent = "\u2014";
            equippedMeta.textContent = "Roll to get your first species";
            equippedEl.className = "rng-equipped-name common";
            return;
        }

        const entry = getEquippedCollectionEntry();
        const poolEntry = rollPool.find((shark) => shark.name === player.equipped);
        const tier = getBaseTierName(entry || poolEntry);
        const luckBonus = getEquippedLuckBonus();
        equippedEl.textContent = player.equipped;
        equippedEl.className = `rng-equipped-name ${getRarityClass(tier)}`;
        equippedMeta.textContent = entry
            ? `${tier} \u00b7 1 in ${formatOneIn(entry.oneIn)} \u00b7 +${Math.round(luckBonus * 100)}% luck`
            : tier;
    }

    function formatUpgradeDetail(def, next, currentLevel) {
        if (def.listKey === "luck") {
            return `Lv.${next.level} \u00b7 +${next.bonus} luck`;
        }
        if (def.listKey === "streak") {
            return `Lv.${next.level} \u00b7 \u00d7${next.mult} every 10 rolls`;
        }
        if (def.listKey === "coin") {
            return `Lv.${next.level} \u00b7 +${Math.round(next.bonus * 100)}% coins`;
        }
        if (def.listKey === "speed") {
            return `Lv.${next.level} \u00b7 -${next.reduction}ms cooldown`;
        }
        if (def.listKey === "auto") {
            return next.level === 1
                ? `Lv.1 \u00b7 unlock auto roll (${(next.interval / 1000).toFixed(1)}s)`
                : `Lv.${next.level} \u00b7 auto every ${(next.interval / 1000).toFixed(1)}s`;
        }
        if (def.listKey === "mutation") {
            return `Lv.${next.level} \u00b7 1 in ${next.chance.toLocaleString()} chance`;
        }
        if (def.listKey === "apex") {
            return `Lv.${next.level} \u00b7 Apex 1 in ${next.chance.toLocaleString()}`;
        }
        if (def.listKey === "mutationBounty") {
            return `Lv.${next.level} \u00b7 +${Math.round(next.bonus * 100)}% mutated roll coins`;
        }
        if (def.listKey === "potionRestock") {
            return `Lv.${next.level} \u00b7 Abyss ${next.ultraRestock} rolls \u00b7 Omega ${next.omegaRestock} rolls`;
        }
        if (def.listKey === "xp") {
            return `Lv.${next.level} \u00b7 +${Math.round(next.bonus * 100)}% XP`;
        }
        return `Lv.${next.level}`;
    }

    function getUpgradeList(def) {
        return UPGRADE_LISTS[def.listKey];
    }

    function renderPrestigePanel() {
        const panel = document.getElementById("rng-prestige-panel");
        if (!panel) return;

        const gain = getPrestigePotential();
        const points = getPrestigePoints();
        const totalPoints = getTotalPrestigePoints();
        const power = getPrestigeUpgradePowerSummary();
        const ready = gain > 0;
        const progressRows = getPrestigeProgressInfo().map((item) => `
            <div class="rng-prestige-progress-row">
                <div>
                    <span>${item.label}</span>
                    <strong>${item.value}</strong>
                </div>
                <em>${item.target}</em>
                <div class="rng-prestige-bar"><span style="width:${Math.round(item.progress * 100)}%"></span></div>
            </div>
        `).join("");
        const lastBest = Array.isArray(player.prestigeHistory) && player.prestigeHistory.length
            ? Math.max(0, Number(player.prestigeHistory[0].bestOneIn) || 0)
            : 0;
        const lastRun = lastBest
            ? `Last: +${player.prestigeHistory[0].gain} at 1/${formatOneIn(lastBest)}`
            : "First prestige keeps collection, best pull, equipped species, and index claims.";

        panel.classList.toggle("ready", ready);
        panel.innerHTML = `
            <div class="rng-prestige-shell-head">
                <span>Permanent Progression</span>
                <strong>${points.toLocaleString()} spendable point${points === 1 ? "" : "s"}</strong>
            </div>
            <div class="rng-prestige-banner">
                <div>
                    <span>Prestige Rank</span>
                    <strong>${getPrestigeTitle()}</strong>
                </div>
                <em>${power.levels} permanent level${power.levels === 1 ? "" : "s"} · ${power.maxed}/${power.total} maxed</em>
            </div>
            <div class="rng-prestige-head">
                <div class="rng-prestige-title">
                    <i class="fa-solid fa-gem"></i>
                    <div>
                        <span>Rebirth Depth</span>
                        <strong>Depth ${player.prestigeLevel || 0}</strong>
                    </div>
                </div>
                <div class="rng-prestige-gain">
                    <span>Next</span>
                    <strong>+${gain}</strong>
                </div>
            </div>
            <div class="rng-prestige-metrics">
                <div><span>Unspent</span><strong>${points.toLocaleString()}</strong></div>
                <div><span>Earned</span><strong>${totalPoints.toLocaleString()}</strong></div>
                <div><span>Luck</span><strong>+${Math.round((getPrestigeLuckMultiplier() - 1) * 100)}%</strong></div>
                <div><span>Coins</span><strong>+${Math.round((getPrestigeCoinMultiplier() - 1) * 100)}%</strong></div>
                <div><span>XP</span><strong>+${Math.round((getPrestigeXpMultiplier() - 1) * 100)}%</strong></div>
                <div><span>Mutations</span><strong>+${Math.round((getPrestigeMutationOddsMultiplier() - 1) * 100)}%</strong></div>
                <div><span>Prestige</span><strong>+${Math.round((getPrestigeGainMultiplier() - 1) * 100)}%</strong></div>
                <div><span>Start</span><strong>${formatCompactCoins(getPrestigeStartingCoins())}</strong></div>
                <div><span>Potions</span><strong>${Math.round(getPrestigePotionDiscount() * 100)}% off</strong></div>
                <div><span>Rank Keep</span><strong>${Math.round(getPrestigeRankKeepPercent() * 100)}%</strong></div>
                <div><span>Index</span><strong>+${Math.round((getPrestigeIndexLuckValueMultiplier() - 1) * 100)}%</strong></div>
                <div><span>Duration</span><strong>+${Math.round((getPrestigePotionDurationMultiplier() - 1) * 100)}%</strong></div>
                <div><span>Restock</span><strong>${Math.round(getPrestigeRestockReduction() * 100)}% faster</strong></div>
                <div><span>Momentum</span><strong>x${getPrestigeRunMomentumMultiplier().toFixed(2)}</strong></div>
                <div><span>Multi</span><strong>x${getPrestigeMultiRollCount()}</strong></div>
            </div>
            <div class="rng-prestige-upgrades">
                <div class="rng-prestige-section-head">
                    <span>Permanent Upgrades</span>
                    <strong>${PRESTIGE_UPGRADE_DEFS.length} branches · keep forever</strong>
                </div>
                <div class="rng-prestige-upgrade-grid">${renderPrestigeUpgradeCards()}</div>
            </div>
            <div class="rng-prestige-section-head">
                <span>Next Rebirth Progress</span>
                <strong>${ready ? `${gain} point${gain === 1 ? "" : "s"} ready` : "Build this run"}</strong>
            </div>
            <div class="rng-prestige-progress-list">${progressRows}</div>
            <p class="rng-prestige-note">${lastRun}</p>
        `;

        const btn = document.createElement("button");
        btn.className = "rng-btn rng-prestige-btn";
        btn.type = "button";
        btn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Prestige`;
        btn.disabled = !ready;
        btn.title = ready
            ? `Prestige for ${gain.toLocaleString()} point${gain === 1 ? "" : "s"}`
            : `Reach a 1/${formatOneIn(PRESTIGE_MIN_BEST_ONE_IN)} best pull, ${PRESTIGE_ROLL_STEP} run rolls, or more collection progress.`;
        btn.addEventListener("click", prestigeRngRun);
        panel.appendChild(btn);
        panel.querySelectorAll("[data-prestige-upgrade]").forEach((upgradeBtn) => {
            upgradeBtn.addEventListener("click", () => buyPrestigeUpgrade(upgradeBtn.dataset.prestigeUpgrade));
        });
    }

    function renderUpgradeShop() {
        const shop = document.getElementById("rng-upgrade-shop");
        if (!shop) return;

        shop.innerHTML = "";

        for (const def of UPGRADE_SHOP_DEFS) {
            const list = getUpgradeList(def);
            const currentLevel = player[def.levelKey] || 0;
            const next = getNextUpgrade(list, currentLevel);
            const maxed = !next;
            const tierClass = maxed ? getShopTierClass(currentLevel) : next.tierClass;

            const card = document.createElement("article");
            card.className = `rng-upgrade-card ${tierClass}${maxed ? " maxed" : ""}`;
            card.innerHTML = `
                <div class="rng-upgrade-head">
                    <div class="rng-upgrade-info">
                        <i class="fa-solid ${def.icon}"></i>
                        <div>
                            <h3>${def.name}</h3>
                            <span class="rng-upgrade-tier">${maxed ? getShopTierName(currentLevel) : next.shopTier}</span>
                        </div>
                    </div>
                    <span class="rng-upgrade-lv">${currentLevel}/${list.length}</span>
                </div>
                <p class="rng-upgrade-detail">${maxed ? "MAX TIER" : formatUpgradeDetail(def, next, currentLevel)}</p>
                <div class="rng-upgrade-progress"><span style="width:${Math.round((currentLevel / list.length) * 100)}%"></span></div>
            `;

            const btn = document.createElement("button");
            btn.className = "rng-btn rng-btn-buy";
            btn.type = "button";
            if (maxed) {
                btn.textContent = "MAX";
                btn.disabled = true;
            } else {
                btn.textContent = formatCompactCoins(next.cost);
                btn.title = `Buy for ${next.cost.toLocaleString()} coins`;
                btn.disabled = player.coins < next.cost;
                btn.addEventListener("click", () => buyUpgradeByDef(def));
            }
            card.appendChild(btn);
            shop.appendChild(card);
        }
    }

    function buyUpgradeByDef(def) {
        const list = getUpgradeList(def);
        const prevLevel = player[def.levelKey] || 0;
        const next = getNextUpgrade(list, prevLevel);
        if (!next || player.coins < next.cost) return;

        const prevTier = getShopTierName(prevLevel || 1);
        buyUpgrade(list, def.levelKey);
        const newTier = getShopTierName(player[def.levelKey]);
        if (newTier !== prevTier) {
            showToast(`\u2b06 Shop tier: ${newTier}`);
        }
        GameFx.play("upgrade");
    }

    function initAmbientBubbles() {
        const layer = document.getElementById("rng-ambient");
        if (!layer || layer.childElementCount > 0) return;

        const bubbleCount = isRngLowPowerMode() ? 4 : isRngMobileViewport() ? 7 : 14;
        for (let i = 0; i < bubbleCount; i++) {
            const bubble = document.createElement("span");
            bubble.className = "rng-bubble";
            bubble.style.setProperty("--left", `${(i * 13) % 100}%`);
            bubble.style.setProperty("--size", `${6 + (i % 5) * 3}px`);
            bubble.style.setProperty("--dur", `${8 + (i % 6) * 2}s`);
            bubble.style.setProperty("--delay", `${(i * 0.6).toFixed(1)}s`);
            layer.appendChild(bubble);
        }
    }

    function renderPotionShop() {
        const shop = document.getElementById("rng-potion-shop");
        if (!shop) return;

        shop.innerHTML = "";

        const summary = document.createElement("div");
        summary.className = "rng-potion-summary";
        summary.innerHTML = `
            <div class="rng-potion-summary-copy">
                <strong>${getPotionTotalCount().toLocaleString()} total potions</strong>
                <span>${getStoredPotionCount().toLocaleString()} stored \u00b7 ${getActivePotionChargeCount().toLocaleString()} active charges</span>
            </div>
        `;
        const consumeAllBtn = document.createElement("button");
        consumeAllBtn.className = "rng-btn rng-btn-ghost rng-potion-consume-all";
        consumeAllBtn.type = "button";
        consumeAllBtn.textContent = "Consume All";
        consumeAllBtn.title = "Consume all stored potions";
        consumeAllBtn.disabled = getStoredPotionCount() <= 0;
        consumeAllBtn.addEventListener("click", consumeAllPotions);

        const controls = document.createElement("div");
        controls.className = "rng-potion-summary-controls";

        const buyCustom = document.createElement("label");
        buyCustom.className = "rng-potion-buy-custom";
        buyCustom.innerHTML = `
            <span>Buy</span>
            <input type="number" inputmode="numeric" min="1" max="${POTION_BUY_AMOUNT_MAX}" step="1" aria-label="Potion buy amount">
            <span>each</span>
        `;
        const buyAmountInput = buyCustom.querySelector("input");
        buyAmountInput.value = String(getSelectedPotionBuyAmount());
        const syncBuyAmount = () => {
            selectedPotionBuyAmount = normalizePotionBuyAmount(buyAmountInput.value);
            buyAmountInput.value = String(selectedPotionBuyAmount);
            updatePotionBuyButtons();
        };
        buyAmountInput.addEventListener("input", syncBuyAmount);
        buyAmountInput.addEventListener("change", syncBuyAmount);

        controls.appendChild(buyCustom);
        controls.appendChild(consumeAllBtn);
        summary.appendChild(controls);
        shop.appendChild(summary);

        for (const [key, def] of Object.entries(POTION_DEFS)) {
            const card = document.createElement("article");
            card.className = "rng-potion-card";
            card.innerHTML = `
                <div class="rng-potion-top">
                    <span class="rng-potion-icon">${def.icon}</span>
                    <h4>${def.name}</h4>
                </div>
                <p class="rng-potion-desc">${def.desc}</p>
                <div class="rng-potion-actions">
                    <span class="rng-potion-owned">Owned: ${player.potions[key] || 0}</span>
                </div>
            `;

            const actions = card.querySelector(".rng-potion-actions");

            const buyBtn = document.createElement("button");
            buyBtn.className = "rng-btn rng-btn-buy";
            buyBtn.type = "button";
            buyBtn.dataset.potionBuyKey = key;
            updatePotionBuyButton(buyBtn, key);
            buyBtn.addEventListener("click", () => buyPotion(key));

            const maxBuyBtn = document.createElement("button");
            maxBuyBtn.className = "rng-btn rng-btn-ghost rng-potion-mini-btn";
            maxBuyBtn.type = "button";
            maxBuyBtn.textContent = "Max";
            updatePotionMaxBuyButton(maxBuyBtn, key);
            maxBuyBtn.addEventListener("click", () => buyMaxPotion(key));

            const useBtn = document.createElement("button");
            useBtn.className = "rng-btn";
            useBtn.type = "button";
            useBtn.textContent = "Use";
            useBtn.disabled = !(player.potions[key] > 0);
            useBtn.addEventListener("click", () => usePotion(key));

            const useAllBtn = document.createElement("button");
            useAllBtn.className = "rng-btn rng-btn-ghost rng-potion-mini-btn";
            useAllBtn.type = "button";
            useAllBtn.textContent = "All";
            useAllBtn.disabled = !(player.potions[key] > 1);
            useAllBtn.title = player.potions[key] > 1
                ? `Use all ${Math.floor(player.potions[key]).toLocaleString()} stored ${def.name}s`
                : "Store more than one to use all";
            useAllBtn.addEventListener("click", () => useAllPotion(key));

            actions.appendChild(buyBtn);
            actions.appendChild(maxBuyBtn);
            actions.appendChild(useBtn);
            actions.appendChild(useAllBtn);
            shop.appendChild(card);
        }
    }

function updateAllUi(options = {}) {
         updateStatsUi();
         updateRankUi();
         updateEquippedUi();
         if (options.lightUi) {
             if ((options.forceCollectionGrid || options.deferCollectionGridDuringRoll) && isCollectionModalOpen()) {
                 collectionGridDirty = true;
             }
             renderRngLeaderboardSelf();
             if (isRngQuestsPanelActive()) renderRngQuestsPanel();
             updateAutoButtonUi();
             updateRollButtonState();
             return;
         }
         renderPrestigePanel();
         renderUpgradeShop();
         if (isRngQuestsPanelActive()) renderRngQuestsPanel();
         renderPotionShop();
         renderCollectionGrid({
             deferDuringActiveRoll: options.deferCollectionGridDuringRoll !== false,
             force: Boolean(options.forceCollectionGrid)
         });
         renderTierLegend();
         renderRngLeaderboardSelf();
         updateAutoButtonUi();
         updateRollButtonState();
     }

    function renderTierLegend() {
        const legend = document.getElementById("rng-tier-legend");
        if (!legend) return;

        const examples = [
            ["Common", "1 in 2"],
            ["Uncommon", "1 in 8"],
            ["Rare", "1 in 35"],
            ["Epic", "1 in 200"],
            ["Legendary", "1 in 2.5K"],
            ["Mythical", "1 in 50K"],
            ["Secret", "1 in 500K"],
            ["Ultra", "1 in 1M+"],
            ["Hyper", "1 in 8M+"],
            ["Omega", "1 in 120M+"],
            ["Singularity", "1 in 500M+"]
        ];

        const rarityRows = examples.map(([name, odds]) => {
            const meta = getTierMeta(name);
            return `<div class="rng-tier-row ${meta.className}"><span>${name}</span><span>${odds}</span></div>`;
        });

        const mutationRows = MUTATION_CHANCE_ORDER.map((key) => {
            const mutation = MUTATION_TYPES[key];
            if (!mutation) return "";
            const chance = getNaturalMutationChanceOneIn(key);
            const standardWeightTotal = getMutationRollWeightTotal();
            const pickPercent = STANDARD_MUTATION_KEYS.includes(key) && standardWeightTotal > 0
                ? Math.round(((mutation.rollWeight || 0) / standardWeightTotal) * 100)
                : null;
            const chanceText = chance === null
                ? (key === "apex" ? "Apex Instinct locked" : `${pickPercent}% of mutation rolls`)
                : `1 in ${formatOneIn(chance)}`;
            const pickText = chance !== null && pickPercent !== null ? ` · ${pickPercent}% pick` : "";

            return `
                <div class="rng-tier-row rng-mutation-chance-row ${key}" style="border-left-color:${mutation.color}">
                    <span>${mutation.icon} ${mutation.name}</span>
                    <span>${chanceText}${pickText} · ${mutation.oneInMult}x</span>
                </div>
            `;
        });

        legend.innerHTML = [
            `<div class="rng-tier-section-title">Rarities</div>`,
            ...rarityRows,
            `<div class="rng-tier-section-title">Mutation chances</div>`,
            ...mutationRows
        ].join("");
    }

    function renderIndexSummary() {
        const summary = document.getElementById("rng-index-summary");
        if (!summary) return;

        const collected = getCollectionCount();
        const target = getCollectionTargetCount();
        const progress = target > 0 ? Math.round((collected / target) * 100) : 0;
        const luckBonus = Math.round(getIndexLuckBonus() * 100);
        const readyRewards = getReadyIndexRewards();
        summary.innerHTML = `
            <div>
                <span class="rng-index-kicker">Index Progress</span>
                <strong>${collected.toLocaleString()} / ${target.toLocaleString()}</strong>
            </div>
            <div class="rng-index-summary-track"><span style="width:${Math.min(100, progress)}%"></span></div>
            <div class="rng-index-summary-actions">
                <span class="rng-index-summary-meta">${progress}% complete \u00b7 +${luckBonus}% milestone luck</span>
                <button id="rng-index-claim-all-btn" class="rng-btn rng-index-claim-all-btn" type="button" ${readyRewards.length ? "" : "disabled"}>Claim All${readyRewards.length ? ` (${readyRewards.length})` : ""}</button>
            </div>
        `;
        summary.querySelector("#rng-index-claim-all-btn")?.addEventListener("click", claimAllIndexRewards);
    }

    function renderIndexRewards() {
        const rewardsEl = document.getElementById("rng-index-rewards");
        if (!rewardsEl) return;

        const collected = getCollectionCount();
        const claimed = getClaimedIndexRewardSet();
        rewardsEl.innerHTML = INDEX_REWARD_DEFS.map((reward) => {
            const goal = getIndexRewardGoal(reward);
            const isClaimed = claimed.has(reward.id);
            const isReady = collected >= goal && !isClaimed;
            const stateClass = isClaimed ? "claimed" : isReady ? "ready" : "locked";
            const buttonText = isClaimed ? "Claimed" : isReady ? "Claim" : `${Math.min(collected, goal)}/${goal}`;

            return `
                <article class="rng-index-reward ${stateClass}">
                    <span>${goal.toLocaleString()}</span>
                    <strong>${reward.title}</strong>
                    <em>${reward.rewardText}</em>
                    <button class="rng-btn rng-index-claim-btn" type="button" data-index-reward="${reward.id}" ${isReady ? "" : "disabled"}>${buttonText}</button>
                </article>
            `;
        }).join("");

        rewardsEl.querySelectorAll("[data-index-reward]").forEach((button) => {
            button.addEventListener("click", () => claimIndexReward(button.dataset.indexReward));
        });
    }

    function updateIndexEquipBestButton() {
        const button = document.getElementById("rng-collection-equip-best");
        if (!button) return;

        const best = getBestEquippableCollectionEntry();
        const bestEquipped = Boolean(best && player.equipped === best.key);
        button.disabled = !best || bestEquipped;
        button.innerHTML = `<i class="fa-solid fa-crown" aria-hidden="true"></i>${bestEquipped ? "Best Equipped" : "Equip Best"}`;
        button.title = best
            ? `${bestEquipped ? "Equipped" : "Equip"} ${best.key} · 1 in ${formatOneIn(best.oneIn)}`
            : "Roll a species before equipping your best index entry";
    }

    function equipBestCollectionEntry() {
        const best = getBestEquippableCollectionEntry();
        if (!best) {
            showToast("No species in your index yet.", "error");
            updateIndexEquipBestButton();
            return;
        }

        if (player.equipped === best.key) {
            showToast(`${best.key} is already your best equipped species.`);
            updateIndexEquipBestButton();
            return;
        }

        player.equipped = best.key;
        showToast(`Equipped best species: ${best.key}.`);
        persistPlayerState({ forceCollectionGrid: true });
    }

    function isCollectionModalOpen() {
        return !document.getElementById("rng-collection-modal")?.classList.contains("hidden");
    }

    function flushDeferredCollectionGridRender() {
        if (!collectionGridDirty || isRolling || autoEnabled || !isCollectionModalOpen()) return;
        renderCollectionGrid({ force: true });
    }

    function cancelCollectionGridRender() {
        collectionRenderToken += 1;
        if (collectionRenderTimer) {
            clearTimeout(collectionRenderTimer);
            collectionRenderTimer = null;
        }
        if (collectionSearchTimer) {
            clearTimeout(collectionSearchTimer);
            collectionSearchTimer = null;
        }
    }

    function scheduleCollectionRenderStep(token, callback) {
        if (collectionRenderTimer) clearTimeout(collectionRenderTimer);
        collectionRenderTimer = setTimeout(() => {
            collectionRenderTimer = null;
            if (token !== collectionRenderToken || !isCollectionModalOpen()) return;
            callback();
        }, getCollectionRenderDelayMs());
    }

    function scheduleCollectionSearchRender() {
        if (collectionSearchTimer) clearTimeout(collectionSearchTimer);
        collectionSearchTimer = setTimeout(() => {
            collectionSearchTimer = null;
            renderCollectionGrid();
        }, isRngMobileViewport() ? MOBILE_COLLECTION_SEARCH_DELAY_MS : 0);
    }

    function createIndexNote(text) {
        const note = document.createElement("p");
        note.className = "rng-empty-note";
        note.textContent = text;
        return note;
    }

    function getIndexSectionDefs(baseOnlyFilter, mutationFilter) {
        return [
            { key: "base", title: "Base Species", mutation: null },
            ...MUTATION_CHANCE_ORDER.map((key) => ({
                key,
                title: `${MUTATION_TYPES[key]?.icon || ""} ${MUTATION_TYPES[key]?.name || key}`,
                mutation: key
            }))
        ].filter((section) => {
            if (baseOnlyFilter) return section.key === "base";
            if (mutationFilter) return section.key === mutationFilter;
            return true;
        });
    }

    function getIndexOddsSearchText(...values) {
        const parts = new Set();

        values.forEach((value) => {
            const number = Math.max(0, Math.floor(Number(value) || 0));
            if (!number) return;

            const raw = String(number);
            const comma = number.toLocaleString();
            const compact = formatOneIn(number).toLowerCase();
            const shorthand = formatCompactCoins(number).toLowerCase();
            [raw, comma, compact, shorthand].forEach((odds) => {
                parts.add(odds);
                parts.add(odds.replace(/,/g, ""));
                parts.add(`1 in ${odds}`);
                parts.add(`1in${odds}`);
                parts.add(`1/${odds}`);
                parts.add(`one in ${odds}`);
            });
        });

        return [...parts].join(" ").toLowerCase();
    }

    function getIndexCandidateForSection(section, baseShark, filters) {
        const { baseOnlyFilter, mutationFilter, tierFilter, ownedOnly, searchTokens } = filters;
        const canonical = section.mutation ? applyStableMutation(baseShark, section.mutation) : baseShark;
        const key = getCollectionKey(canonical);
        const entry = player.collection[key] || null;
        const source = entry || canonical;
        const displayName = section.mutation ? baseShark.name : canonical.name;
        const baseTier = getBaseTierName(source);
        const oddsTier = getOddsTierName(source);
        const searchHaystack = [
            displayName,
            section.title,
            baseTier,
            oddsTier,
            getIndexOddsSearchText(canonical.oneIn, entry?.oneIn)
        ].join(" ").toLowerCase();

        if (!baseOnlyFilter && !mutationFilter && tierFilter !== "all" && baseTier !== tierFilter) {
            return null;
        }
        if (ownedOnly && !entry) {
            return null;
        }
        if (searchTokens.length && !searchTokens.every(token => searchHaystack.includes(token))) {
            return null;
        }

        return {
            key,
            entry,
            canonical,
            displayName,
            baseTier,
            oddsTier,
            obtained: Boolean(entry)
        };
    }

    function sortIndexCandidates(candidates) {
        candidates.sort((a, b) => {
            const oddsDiff = collectionSortRarestFirst
                ? (b.canonical.oneIn || 0) - (a.canonical.oneIn || 0)
                : (a.canonical.oneIn || 0) - (b.canonical.oneIn || 0);
            if (oddsDiff !== 0) return oddsDiff;
            const tierDiff = collectionSortRarestFirst
                ? (TIER_RANK[b.baseTier] || 0) - (TIER_RANK[a.baseTier] || 0)
                : (TIER_RANK[a.baseTier] || 0) - (TIER_RANK[b.baseTier] || 0);
            if (tierDiff !== 0) return tierDiff;
            return a.displayName.localeCompare(b.displayName);
        });
    }

    function createIndexSectionHeader(section, ownedCount, totalCount) {
        const header = document.createElement("div");
        header.className = "rng-index-section-header";

        const title = document.createElement("strong");
        title.textContent = section.title;

        const count = document.createElement("span");
        count.textContent = `${ownedCount}/${totalCount}`;

        header.append(title, count);
        return header;
    }

    function createIndexCard(candidate) {
        const { key, entry, canonical, displayName, baseTier, oddsTier, obtained } = candidate;
        const oddsNote = oddsTier !== baseTier ? ` \u00b7 ${oddsTier} odds` : "";
        const card = document.createElement("button");
        card.type = "button";
        card.disabled = !obtained;
        card.className = `rng-collection-card ${getRarityClass(baseTier)}${obtained ? " obtained" : " missing"}${player.equipped === key ? " equipped" : ""}${canonical.mutation ? ' ' + canonical.mutation : ""}`;

        const tier = document.createElement("span");
        tier.className = "rng-collection-card-tier";
        tier.textContent = `${baseTier}${canonical.mutation ? ' \u00b7 ' + MUTATION_TYPES[canonical.mutation]?.name : ''}`;

        const name = document.createElement("strong");
        name.textContent = displayName;

        const meta = document.createElement("span");
        meta.className = "rng-collection-card-meta";
        meta.textContent = obtained
            ? `1 in ${formatOneIn(entry.oneIn)}${oddsNote} \u00b7 x${entry.count}`
            : `Missing \u00b7 1 in ${formatOneIn(canonical.oneIn)}${oddsNote}`;

        const status = document.createElement("span");
        status.className = "rng-index-status";
        status.textContent = obtained ? "Obtained" : "Missing";

        card.append(tier, name, meta, status);
        if (obtained) {
            card.addEventListener("click", () => {
                player.equipped = key;
                persistPlayerState({ forceCollectionGrid: true });
            });
        }
        return card;
    }

    function renderCollectionGrid(options = {}) {
        const grid = document.getElementById("rng-collection-grid");
        const filter = document.getElementById("rng-collection-filter");
        const searchInput = document.getElementById("rng-collection-search");
        const sortButton = document.getElementById("rng-collection-sort-rarity");
        const ownedOnlyToggle = document.getElementById("rng-collection-owned-only");
        if (!grid) return;

        if (!isCollectionModalOpen()) {
            return;
        }

        renderIndexSummary();
        renderIndexRewards();
        updateIndexEquipBestButton();

        const tierFilter = filter ? filter.value : "all";
        const baseOnlyFilter = tierFilter === "base";
        const mutationFilter = MUTATION_TYPES[tierFilter] ? tierFilter : null;
        const ownedOnly = Boolean(ownedOnlyToggle?.checked);
        const searchTerm = (searchInput?.value || "").toLowerCase().trim();
        const searchTokens = searchTerm ? searchTerm.split(/\s+/).filter(Boolean) : [];
        if (sortButton) {
            sortButton.classList.toggle("active", collectionSortRarestFirst);
            sortButton.textContent = collectionSortRarestFirst ? "Rarest First" : "Common First";
            sortButton.title = collectionSortRarestFirst ? "Click to sort common first" : "Click to sort rarest first";
        }

        if (options.deferDuringActiveRoll && !options.force && (isRolling || autoEnabled)) {
            collectionGridDirty = true;
            return;
        }

        cancelCollectionGridRender();
        const token = collectionRenderToken;
        const sectionDefs = getIndexSectionDefs(baseOnlyFilter, mutationFilter);
        const filters = { baseOnlyFilter, mutationFilter, tierFilter, ownedOnly, searchTokens };
        let sectionIndex = 0;
        let sectionState = null;
        let rendered = 0;
        let clearedLoading = false;

        grid.replaceChildren(createIndexNote(autoEnabled ? "Building index while Auto Roll stays active..." : "Building index..."));
        collectionGridDirty = false;

        function appendFragment(fragment) {
            if (!fragment.childNodes.length) return;
            if (!clearedLoading) {
                grid.replaceChildren();
                clearedLoading = true;
            }
            grid.appendChild(fragment);
        }

        function finishRender() {
            if (token !== collectionRenderToken) return;
            if (!rendered) {
                grid.replaceChildren(createIndexNote("No matching index entries."));
            }
            collectionGridDirty = false;
        }

        function ensureSectionState() {
            if (sectionState || sectionIndex >= sectionDefs.length) return;
            sectionState = {
                section: sectionDefs[sectionIndex],
                scanIndex: 0,
                renderIndex: 0,
                candidates: [],
                headerAdded: false,
                sorted: false
            };
        }

        function renderStep() {
            if (token !== collectionRenderToken || !isCollectionModalOpen()) return;
            ensureSectionState();

            if (!sectionState) {
                finishRender();
                return;
            }

            let scanned = 0;
            const buildBatchSize = getCollectionBuildBatchSize();
            while (sectionState.scanIndex < rollPool.length && scanned < buildBatchSize) {
                const candidate = getIndexCandidateForSection(
                    sectionState.section,
                    rollPool[sectionState.scanIndex],
                    filters
                );
                if (candidate) sectionState.candidates.push(candidate);
                sectionState.scanIndex++;
                scanned++;
            }

            if (sectionState.scanIndex < rollPool.length) {
                scheduleCollectionRenderStep(token, renderStep);
                return;
            }

            if (!sectionState.sorted) {
                sortIndexCandidates(sectionState.candidates);
                sectionState.sorted = true;
            }

            if (!sectionState.candidates.length) {
                sectionIndex++;
                sectionState = null;
                scheduleCollectionRenderStep(token, renderStep);
                return;
            }

            const fragment = document.createDocumentFragment();

            if (!sectionState.headerAdded) {
                const ownedInSection = sectionState.candidates.filter((candidate) => candidate.obtained).length;
                fragment.appendChild(createIndexSectionHeader(
                    sectionState.section,
                    ownedInSection,
                    sectionState.candidates.length
                ));
                sectionState.headerAdded = true;
            }

            let cardsRendered = 0;
            const renderBatchSize = getCollectionRenderBatchSize();
            while (
                sectionState.renderIndex < sectionState.candidates.length &&
                cardsRendered < renderBatchSize
            ) {
                fragment.appendChild(createIndexCard(sectionState.candidates[sectionState.renderIndex]));
                sectionState.renderIndex++;
                cardsRendered++;
                rendered++;
            }

            appendFragment(fragment);

            if (sectionState.renderIndex < sectionState.candidates.length) {
                scheduleCollectionRenderStep(token, renderStep);
                return;
            }

            sectionIndex++;
            sectionState = null;
            scheduleCollectionRenderStep(token, renderStep);
        }

        scheduleCollectionRenderStep(token, renderStep);
    }

    function getBestBurstRoll(rolls) {
        const adminForcedRoll = [...(Array.isArray(rolls) ? rolls : [])]
            .find((shark) => shark?.adminCommandId);
        if (adminForcedRoll) return adminForcedRoll;

        return rolls.reduce((best, current) => {
            if (!best) return current;
            if ((current.oneIn || 0) !== (best.oneIn || 0)) {
                return (current.oneIn || 0) > (best.oneIn || 0) ? current : best;
            }
            return (current.coinReward || 0) > (best.coinReward || 0) ? current : best;
        }, null);
    }

    function isApexPull(shark) {
        return shark?.mutation === "apex";
    }

    function getRollRevealShark(rolls, fallback) {
        const adminForcedRoll = [...(Array.isArray(rolls) ? rolls : [])]
            .find((shark) => shark?.adminCommandId);
        if (adminForcedRoll) return adminForcedRoll;

        const apexRoll = [...(Array.isArray(rolls) ? rolls : [])]
            .filter(isApexPull)
            .sort((a, b) => {
                const oddsDiff = (b.oneIn || 0) - (a.oneIn || 0);
                if (oddsDiff !== 0) return oddsDiff;
                return (b.coinReward || 0) - (a.coinReward || 0);
            })[0];
        return apexRoll || fallback;
    }

    function getMultiRollResultSummary(rolls) {
        const sortedRolls = [...(Array.isArray(rolls) ? rolls : [])]
            .filter(Boolean)
            .sort((a, b) => {
                const oddsDiff = (b.oneIn || 0) - (a.oneIn || 0);
                if (oddsDiff !== 0) return oddsDiff;
                return (b.coinReward || 0) - (a.coinReward || 0);
            });
        const adminForcedRoll = sortedRolls.find((shark) => shark?.adminCommandId);
        const topRolls = adminForcedRoll
            ? [
                adminForcedRoll,
                ...sortedRolls.filter((shark) => shark !== adminForcedRoll).slice(0, 2)
            ]
            : sortedRolls.slice(0, 3);

        return topRolls.map((shark, index) => {
            const label = shark.adminCommandId ? "Queued" : index === 0 ? "Best" : `#${index + 1}`;
            const mutationIcon = shark.mutation && MUTATION_TYPES[shark.mutation]
                ? ` ${MUTATION_TYPES[shark.mutation].icon}`
                : "";
            return `${label}: ${escapeHtml(shark.name)}${mutationIcon} 1/${formatOneIn(shark.oneIn)}`;
        }).join(" \u00b7 ");
    }

    function shouldUseLeanRollAnimation(rollCount) {
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        const saveData = navigator.connection?.saveData;
        const lowCoreDevice = (navigator.hardwareConcurrency || 8) <= 4;
        return Boolean(
            reducedMotion ||
            saveData ||
            lowCoreDevice ||
            isRngMobileViewport() ||
            (autoEnabled && isCollectionModalOpen()) ||
            rollCount >= 5
        );
    }

    function getRollAnimationFrameCount(rollCount) {
        if (isRngLowPowerMode()) return rollCount <= 1 ? 5 : rollCount >= 16 ? 3 : 4;
        if (rollCount <= 1) return shouldUseLeanRollAnimation(rollCount) ? 9 : 14;
        if (rollCount >= 16) return shouldUseLeanRollAnimation(rollCount) ? 4 : 6;
        return shouldUseLeanRollAnimation(rollCount) ? 7 : 10;
    }

    function getVisibleMultiRollSlotCount(rollCount) {
        const count = Math.max(1, Math.floor(Number(rollCount) || 1));
        if (!isRngMobileViewport()) return count;
        if (count > 5) return 6;
        return count;
    }

    function getVisibleBurstRollsForSlots(rolls, finalShark, visibleCount) {
        if (!Array.isArray(rolls) || rolls.length <= visibleCount) return rolls;

        const visible = rolls.slice(0, visibleCount);
        if (finalShark && !visible.includes(finalShark) && visible.length) {
            visible[visible.length - 1] = finalShark;
        }
        return visible;
    }

    function clearMultiRollGrid(stage = document.querySelector(".rng-roll-stage")) {
        stage?.classList.remove("rng-roll-stage-multi");
        stage?.querySelector(".rng-multi-roll-grid")?.remove();
    }

    function ensureMultiRollGrid(stage, rollCount) {
        if (!stage || rollCount <= 1) {
            clearMultiRollGrid(stage);
            return null;
        }

        let grid = stage.querySelector(".rng-multi-roll-grid");
        if (!grid) {
            grid = document.createElement("div");
            grid.className = "rng-multi-roll-grid";
            const result = document.getElementById("rng-result");
            stage.insertBefore(grid, result || null);
        }

        stage.classList.add("rng-roll-stage-multi");
        const visibleSlotCount = getVisibleMultiRollSlotCount(rollCount);
        const hiddenSlotCount = Math.max(0, rollCount - visibleSlotCount);
        if (hiddenSlotCount) {
            grid.dataset.extraRolls = `+${hiddenSlotCount} more rolls resolved`;
        } else {
            delete grid.dataset.extraRolls;
        }
        grid.replaceChildren(...Array.from({ length: visibleSlotCount }, (_, index) => {
            const slot = document.createElement("div");
            slot.className = "rng-multi-roll-slot common spinning";
            slot.innerHTML = `
                <span data-slot-label>Roll ${index + 1}</span>
                <strong data-slot-name>...</strong>
                <em data-slot-meta>Rolling</em>
            `;
            return slot;
        }));
        return grid;
    }

    function setMultiRollSlotText(slot, label, name, meta) {
        let labelEl = slot.querySelector("[data-slot-label]");
        let nameEl = slot.querySelector("[data-slot-name]");
        let metaEl = slot.querySelector("[data-slot-meta]");

        if (!labelEl || !nameEl || !metaEl) {
            labelEl = document.createElement("span");
            nameEl = document.createElement("strong");
            metaEl = document.createElement("em");
            labelEl.dataset.slotLabel = "";
            nameEl.dataset.slotName = "";
            metaEl.dataset.slotMeta = "";
            slot.replaceChildren(labelEl, nameEl, metaEl);
        }

        if (labelEl.textContent !== label) labelEl.textContent = label;
        if (nameEl.textContent !== name) nameEl.textContent = name;
        if (metaEl.textContent !== meta) metaEl.textContent = meta;
    }

    function updateMultiRollSlot(slot, shark, index, options = {}) {
        if (!slot || !shark) return;

        const isFinal = Boolean(options.final);
        const isBest = Boolean(options.best);
        const nextClassName = [
            "rng-multi-roll-slot",
            getRarityClass(getOddsTierName(shark)),
            shark.mutation || "",
            isFinal ? "revealed" : "spinning",
            isBest ? "best" : ""
        ].filter(Boolean).join(" ");
        if (slot.className !== nextClassName) slot.className = nextClassName;
        setMultiRollSlotText(
            slot,
            isBest ? "Best" : `Roll ${index + 1}`,
            shark.name,
            isFinal ? `1/${formatOneIn(shark.oneIn)}` : "Rolling"
        );
    }

    async function animateRoll(finalShark, rollContext = {}) {
        const display = document.getElementById("rng-roll-display");
        const result = document.getElementById("rng-result");
        const stage = document.querySelector(".rng-roll-stage");
        if (!display) return;
        const rollCount = Math.max(1, Math.floor(Number(rollContext.rollCount) || 1));
        const totalCoinGain = Math.max(0, Math.round(Number(rollContext.totalCoinGain) || finalShark.coinReward || 0));
        const newFinds = Math.max(0, Math.floor(Number(rollContext.newFinds) || 0));
        const burstRolls = Array.isArray(rollContext.rolls) ? rollContext.rolls : [];
        const multiGrid = ensureMultiRollGrid(stage, rollCount);
        const multiSlots = multiGrid ? Array.from(multiGrid.querySelectorAll(".rng-multi-roll-slot")) : [];

        GameFx.play("roll");
        stage?.classList.add("rng-rolling");
        display.style.display = "block";
        display.style.opacity = "1";
        display.style.visibility = "visible";
        if (rollCount > 1) {
            display.dataset.multiRoll = `x${rollCount} rolls`;
            display.textContent = `Rolling x${rollCount}`;
        } else {
            delete display.dataset.multiRoll;
            clearMultiRollGrid(stage);
        }

        const flashPool = rollPool.length ? rollPool : [finalShark];
        const frameCount = getRollAnimationFrameCount(rollCount);
        const frameDelay = Math.max(32, Math.round(getRollCooldownMs() / Math.max(10, frameCount)));

        for (let i = 0; i < frameCount; i++) {
            if (multiSlots.length) {
                multiSlots.forEach((slot, index) => {
                    const randomShark = flashPool[Math.floor(Math.random() * flashPool.length)];
                    updateMultiRollSlot(slot, randomShark, index);
                });
            } else {
                const randomShark = flashPool[Math.floor(Math.random() * flashPool.length)];
                display.textContent = randomShark.name;
                display.className = `rng-roll-display ${randomShark.className}`;
            }
            await new Promise((resolve) => setTimeout(resolve, frameDelay));
        }

        display.textContent = rollCount > 1 ? `Best: ${finalShark.name}` : finalShark.name;
        display.className = `rng-roll-display ${finalShark.className}${finalShark.mutation ? ' ' + finalShark.mutation : ''}`;
        const visibleBurstRolls = getVisibleBurstRollsForSlots(burstRolls, finalShark, multiSlots.length);
        multiSlots.forEach((slot, index) => {
            const shark = visibleBurstRolls[index];
            updateMultiRollSlot(slot, shark, index, {
                final: true,
                best: shark === finalShark
            });
        });

        stage?.classList.remove("rng-rolling");

        if (result) {
            const isNew = isNewCollectionRoll(finalShark);
            const baseTier = getBaseTierName(finalShark);
            const oddsTier = getOddsTierName(finalShark);
            const oddsNote = oddsTier !== baseTier ? ` \u00b7 ${oddsTier} odds` : "";
            const streakNote = finalShark.streakLuckActive
                ? ` \u00b7 <span class="rng-streak-tag">Streak \u00d7${getStreakLuckMultiplier()}</span>`
                : "";
            const mutationNote = finalShark.mutation && MUTATION_TYPES[finalShark.mutation]
                ? ` \u00b7 <span class="rng-mutation-tag ${finalShark.mutation}">${MUTATION_TYPES[finalShark.mutation].icon} ${finalShark.mutation.toUpperCase()}</span>`
                : "";
            const payoutNote = finalShark.potionSource
                ? ` \u00b7 Potion payout ${Math.round(finalShark.rewardRate * 100)}%`
                : "";
            const burstNote = rollCount > 1 ? `Best of ${rollCount} \u00b7 ` : "";
            const coinNote = rollCount > 1
                ? `+${formatCompactCoins(totalCoinGain)} coins total`
                : `+${formatCompactCoins(finalShark.coinReward)} coins`;
            const newFindNote = newFinds > 0
                ? ` \u00b7 ${newFinds === 1 ? "NEW!" : `${newFinds} NEW!`}`
                : "";
            const multiRollSummary = rollCount > 1 ? getMultiRollResultSummary(burstRolls) : "";
            const multiRollLine = multiRollSummary
                ? `<span class="rng-result-burst">Top rolls: ${multiRollSummary}</span>`
                : "";
            result.classList.toggle("rng-result-multi", rollCount > 1);
            result.innerHTML = `
                <span class="${finalShark.className}${finalShark.mutation ? ' ' + finalShark.mutation : ''}">You rolled: ${finalShark.name}</span>
                <span class="rng-result-meta">${burstNote}${baseTier}${oddsNote} \u00b7 1 in ${formatOneIn(finalShark.oneIn)} \u00b7 ${coinNote}${newFindNote}${streakNote}${mutationNote}${payoutNote}</span>
                ${multiRollLine}
            `;
            if (isNew || newFinds > 0) result.classList.add("rng-result-pop");
            setTimeout(() => result.classList.remove("rng-result-pop"), 400);
        }
    }

    function applyRollJuice(shark, rollContext = {}) {
        const totalCoinGain = Math.max(0, Math.round(Number(rollContext.totalCoinGain) || shark.coinReward || 0));
        const newFinds = Math.max(0, Math.floor(Number(rollContext.newFinds) || 0));
        GameFx.floatText(`+${formatCompactCoins(totalCoinGain)}`, "coin");
        GameFx.play("coin");

        if (isApexPull(shark)) {
            GameFx.play("jackpot");
            GameFx.shake("heavy");
            document.querySelector(".rng-roll-stage")?.classList.add("rng-jackpot-flash");
            setTimeout(() => document.querySelector(".rng-roll-stage")?.classList.remove("rng-jackpot-flash"), 700);
        } else if (isUltraRarePull(shark)) {
            GameFx.play("jackpot");
            GameFx.shake("heavy");
            document.querySelector(".rng-roll-stage")?.classList.add("rng-jackpot-flash");
            setTimeout(() => document.querySelector(".rng-roll-stage")?.classList.remove("rng-jackpot-flash"), 600);
        } else if (isRarePull(shark)) {
            GameFx.play("rare");
            GameFx.shake("medium");
        } else {
            GameFx.play("tick");
        }

        const isNew = isNewCollectionRoll(shark);
        if (isNew || newFinds > 0) GameFx.play("new");
    }

    function isUltraRarePull(shark) {
        return shark.oneIn >= ULTRA_ONE_IN_THRESHOLD;
    }

    function isRarePull(shark) {
        return shark.oneIn >= 2500 || TIER_RANK[getOddsTierName(shark)] >= TIER_RANK.Legendary;
    }

    function closeRarePopup() {
        const overlay = document.getElementById("rng-celebration");
        if (!overlay) return;
        overlay.className = "rng-celebration";
        overlay.innerHTML = "";
    }

    function showRarePopup(shark) {
        const overlay = document.getElementById("rng-celebration");
        if (!overlay) return;
        const oddsTier = getOddsTierName(shark);

        overlay.className = `rng-celebration visible ${getRarityClass(oddsTier)}`;
        overlay.innerHTML = `
            <div class="rng-celebration-card">
                <p class="rng-celebration-tag">${oddsTier} odds!</p>
                <h2>${shark.name}</h2>
                <p>1 in ${formatOneIn(shark.oneIn)}</p>
                <button type="button" id="rng-celebration-close">Continue</button>
            </div>
        `;

        overlay.querySelector("#rng-celebration-close").addEventListener("click", closeRarePopup);
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) closeRarePopup();
        }, { once: true });
    }

    function closeUltraCutscene() {
        const cutscene = document.getElementById("rng-cutscene");
        if (!cutscene) return;
        cutscene.className = "rng-cutscene";
        cutscene.innerHTML = "";
        if (cutsceneResolve) {
            cutsceneResolve();
            cutsceneResolve = null;
        }
    }

    async function showRollReveal(shark) {
        if (isApexPull(shark)) {
            await showUltraCutscene(shark);
        } else if (shark.oneIn >= ULTRA_ONE_IN_THRESHOLD) {
            const oddsTier = getOddsTierName(shark);
            if (shouldSkipCutscene(shark)) {
                showToast(`Skipped repeat ${oddsTier} cutscene`);
                return;
            }
            await showUltraCutscene(shark);
        } else if (isRarePull(shark) && !getSettings().disableRarePopups) {
            showRarePopup(shark);
        }
    }

    function getUltraRevealConfig(shark) {
        if (isApexPull(shark)) return APEX_REVEAL_CONFIG;
        return ULTRA_REVEAL_CONFIGS[getOddsTierName(shark)] || ULTRA_REVEAL_CONFIGS.Ultra;
    }

    function shouldSkipCutscene(shark) {
        if (isApexPull(shark)) return false;
        const tier = getOddsTierName(shark);
        const settings = getSettings();
        return Boolean(settings.skipCutscenes?.[tier] && settings.seenCutscenes?.[tier]);
    }

    function markCutsceneSeen(shark) {
        if (isApexPull(shark)) return;
        const tier = getOddsTierName(shark);
        if (!CUTSCENE_SKIP_TIERS.includes(tier)) return;
        getSettings().seenCutscenes[tier] = true;
    }

    function showUltraCutscene(shark) {
        return new Promise((resolve) => {
            const cutscene = document.getElementById("rng-cutscene");
            if (!cutscene) {
                resolve();
                return;
            }

            cutsceneResolve = resolve;
            markCutsceneSeen(shark);
            const isNew = isNewCollectionRoll(shark);
            const oddsTier = getOddsTierName(shark);
            const oddsClass = getRarityClass(oddsTier);
            const reveal = getUltraRevealConfig(shark);
            const isApex = isApexPull(shark);
            const tierLabel = reveal.tierLabel || oddsTier;
            const metaLine = isApex
                ? `${shark.depth || "Unknown"} \u00b7 ${shark.size || "?"} \u00b7 Apex predator sighted \u00b7 ${isNew ? "NEW species!" : "Added to collection"}`
                : `${shark.depth || "Unknown"} \u00b7 ${shark.size || "?"} \u00b7 ${isNew ? "NEW species!" : "Added to collection"}${shark.mutation ? ' \u00b7 <span class="rng-mutation-tag ' + shark.mutation + '">' + MUTATION_TYPES[shark.mutation]?.icon + ' ' + shark.mutation.toUpperCase() + '</span>' : ''}`;
            const apexLayers = isApex ? `
                <div class="rng-cutscene-apex-sweep" aria-hidden="true"></div>
                <div class="rng-cutscene-apex-jaws" aria-hidden="true"></div>
                <div class="rng-cutscene-apex-slashes" aria-hidden="true"></div>
                <div class="rng-cutscene-apex-mark" aria-hidden="true">APEX</div>
            ` : "";

            cutscene.className = `rng-cutscene visible playing ${oddsClass}${shark.mutation ? ' ' + shark.mutation : ''}`;
            cutscene.innerHTML = `
                <div class="rng-cutscene-vignette"></div>
                <div class="rng-cutscene-aura"></div>
                <div class="rng-cutscene-tunnel"></div>
                <div class="rng-cutscene-flash"></div>
                <div class="rng-cutscene-beams" aria-hidden="true"></div>
                <div class="rng-cutscene-rings" aria-hidden="true"></div>
                <div class="rng-cutscene-particles" aria-hidden="true"></div>
                ${apexLayers}
                <div class="rng-cutscene-content">
                    <p class="rng-cutscene-eyebrow">${reveal.eyebrow}</p>
                    <p class="rng-cutscene-tier">${tierLabel}</p>
                    <h2 class="rng-cutscene-name${shark.mutation ? ' ' + shark.mutation : ''}">${shark.name}</h2>
                    <p class="rng-cutscene-odds">1 in ${formatOneIn(shark.oneIn)}</p>
                    <p class="rng-cutscene-meta">${metaLine}</p>
                    <button type="button" class="rng-cutscene-btn" id="rng-cutscene-close">Continue</button>
                </div>
            `;

            const rings = cutscene.querySelector(".rng-cutscene-rings");
            if (rings) {
                for (let i = 0; i < reveal.ringCount; i++) {
                    const ring = document.createElement("span");
                    const ringSize = isApex
                        ? 105 + (i * 54)
                        : oddsTier === "Singularity" ? 110 + (i * 62) : 140 + (i * 76);
                    ring.style.setProperty("--i", String(i));
                    ring.style.setProperty("--ring-size", `${ringSize}px`);
                    ring.style.setProperty("--delay", `${(i * 0.18).toFixed(2)}s`);
                    rings.appendChild(ring);
                }
            }

            const beams = cutscene.querySelector(".rng-cutscene-beams");
            if (beams) {
                for (let i = 0; i < reveal.beamCount; i++) {
                    const beam = document.createElement("span");
                    const angle = Math.round((360 / Math.max(1, reveal.beamCount)) * i);
                    beam.style.setProperty("--i", String(i));
                    beam.style.setProperty("--angle", `${angle}deg`);
                    beam.style.setProperty("--angle-end", `${angle + 45}deg`);
                    beam.style.setProperty("--delay", `${(i * 0.09).toFixed(2)}s`);
                    beams.appendChild(beam);
                }
            }

            const particles = cutscene.querySelector(".rng-cutscene-particles");
            if (particles) {
                const symbols = reveal.particleSymbols;
                for (let i = 0; i < reveal.particleCount; i++) {
                    const span = document.createElement("span");
                    span.textContent = symbols[i % symbols.length];
                    span.style.setProperty("--i", String(i));
                    span.style.setProperty("--x", `${(6 + (hashString(shark.name + i) % 88))}%`);
                    span.style.setProperty("--y", `${(8 + (hashString(oddsTier + shark.name + i) % 84))}%`);
                    span.style.setProperty("--delay", `${(i * 0.045).toFixed(2)}s`);
                    span.style.setProperty("--dur", `${(1.8 + (i % 6) * 0.16).toFixed(2)}s`);
                    particles.appendChild(span);
                }

                // Mutation visual flare
                if (shark.mutation && MUTATION_TYPES[shark.mutation]) {
                    const mutDef = MUTATION_TYPES[shark.mutation];
                    for (let i = 0; i < 6; i++) {
                        const ms = document.createElement("span");
                        ms.textContent = mutDef.icon;
                        ms.style.setProperty("--x", `${(5 + (hashString(shark.name + 'mut' + i) % 90))}%`);
                        ms.style.setProperty("--delay", `${(1.2 + i * 0.15).toFixed(2)}s`);
                        ms.style.fontSize = '1.5rem';
                        particles.appendChild(ms);
                    }
                }
            }

            const apexSlashes = cutscene.querySelector(".rng-cutscene-apex-slashes");
            if (apexSlashes) {
                for (let i = 0; i < 6; i++) {
                    const slash = document.createElement("span");
                    slash.style.setProperty("--top", `${18 + i * 11}%`);
                    slash.style.setProperty("--delay", `${(0.24 + i * 0.08).toFixed(2)}s`);
                    slash.style.setProperty("--rotate", `${-17 + i * 3}deg`);
                    apexSlashes.appendChild(slash);
                }
            }

            requestAnimationFrame(() => {
                requestAnimationFrame(() => cutscene.classList.add("revealed"));
            });

            cutscene.querySelector("#rng-cutscene-close")?.addEventListener("click", closeUltraCutscene);
            cutscene.addEventListener("click", (event) => {
                if (event.target === cutscene || event.target.classList.contains("rng-cutscene-vignette")) {
                    closeUltraCutscene();
                }
            }, { once: true });
        });
    }

async function performRoll() {
         if (isRolling || Date.now() < rollLockedUntil) return;
         if (document.getElementById("rng-cutscene")?.classList.contains("visible")) return;
         isRolling = true;
         GameFx.resumeAudio();
         GameFx.pulseRollButton();
         updateRollButtonState();

         const rollCount = getPrestigeMultiRollCount();
         const rollActionContext = createRollActionContext(rollCount);
         const burstRolls = Array.from({ length: rollCount }, () => rollForShark(rollActionContext));
         consumeRollActionEffects(rollActionContext);
         const finalShark = getBestBurstRoll(burstRolls);
         const rollContext = {
             rollCount: burstRolls.length,
             totalCoinGain: burstRolls.reduce((sum, shark) => sum + Math.max(0, shark.coinReward || 0), 0),
             newFinds: burstRolls.filter((shark) => Boolean(shark.isNewFind)).length,
             rolls: burstRolls
         };
         const revealShark = getRollRevealShark(burstRolls, finalShark);
         await animateRoll(finalShark, rollContext);
         applyRollJuice(revealShark, rollContext);
         publishRngGlobalRollBroadcast(revealShark, rollContext);
         await showRollReveal(revealShark);
         persistPlayerState({ deferCollectionGridDuringRoll: true, lightUi: true });

         rollLockedUntil = Date.now() + getRollCooldownMs();
         startCooldownTimer();
         isRolling = false;
         flushDeferredCollectionGridRender();
     }
 
     function restartAutoRoll() {
        if (!autoEnabled) return;
        setAutoRoll(false);
        setAutoRoll(true);
    }

    function isAutoRollUnlocked() {
        return (player.autoRollLevel || 0) > 0;
    }

    function updateAutoButtonUi() {
        const autoButton = document.getElementById("rng-auto-btn");
        const autoArrow = document.getElementById("rng-auto-arrow");
        if (!autoButton) return;

        const unlocked = isAutoRollUnlocked();
        autoButton.disabled = false;
        autoButton.classList.toggle("locked", !unlocked);
        autoButton.classList.toggle("active", autoEnabled && unlocked);
        autoButton.setAttribute("aria-pressed", autoEnabled && unlocked ? "true" : "false");
        if (autoArrow) {
            autoArrow.classList.toggle("hidden", !unlocked || autoArrowDismissed);
            autoArrow.classList.toggle("active", autoEnabled && unlocked);
        }
        autoButton.title = unlocked
            ? autoEnabled
                ? `Auto Roll ACTIVE - rolling every ${(getAutoIntervalMs() / 1000).toFixed(1)}s`
                : `Auto Roll off - rolls every ${(getAutoIntervalMs() / 1000).toFixed(1)}s when enabled`
            : "Unlock Auto Roll in the upgrade shop";
    }

    function setAutoRoll(enabled) {
        if (enabled && !isAutoRollUnlocked()) {
            if (autoInterval) {
                clearInterval(autoInterval);
                autoInterval = null;
            }
            autoEnabled = false;
            updateAutoButtonUi();
            showToast("Unlock Auto Roll in the upgrade shop first.", "error");
            return;
        }

        autoEnabled = enabled;
        updateAutoButtonUi();

        if (autoInterval) {
            clearInterval(autoInterval);
            autoInterval = null;
        }

        if (!autoEnabled) {
            flushDeferredCollectionGridRender();
        }

        if (autoEnabled) {
            autoInterval = setInterval(() => {
                if (!isRolling && Date.now() >= rollLockedUntil) performRoll();
            }, getAutoIntervalMs());
        }
    }

    function openCollectionModal() {
        document.getElementById("rng-collection-modal")?.classList.remove("hidden");
        renderCollectionGrid({ force: true });
    }

    function closeCollectionModal() {
        document.getElementById("rng-collection-modal")?.classList.add("hidden");
        cancelCollectionGridRender();
        collectionGridDirty = false;
    }

    function buyUpgrade(list, levelKey) {
        const next = getNextUpgrade(list, player[levelKey]);
        if (!next || player.coins < next.cost) return;
        player.coins -= next.cost;
        player[levelKey] = next.level;
        if (levelKey === "rollSpeedLevel" || levelKey === "autoRollLevel") restartAutoRoll();
        persistPlayerState();
    }

    function buyPotion(key, requestedQuantity = getSelectedPotionBuyAmount()) {
        const def = POTION_DEFS[key];
        const quantity = getPotionBuyQuantity(key, requestedQuantity);
        const blockReason = getPotionPurchaseBlockReason(key, quantity);
        if (!def || blockReason || quantity <= 0) {
            if (blockReason) showToast(blockReason, "error");
            return;
        }

        const cost = getPotionBatchCost(key, quantity);
        player.coins -= cost;
        player.potions[key] = (player.potions[key] || 0) + quantity;
        showToast(`Bought ${quantity.toLocaleString()} ${def.name}${quantity === 1 ? "" : "s"}.`);
        persistPlayerState();
    }

    function buyMaxPotion(key) {
        const quantity = getPotionMaxBuyQuantity(key);
        if (quantity <= 0) {
            const blockReason = getPotionPurchaseBlockReason(key, getPotionBuyQuantity(key, 1)) || "Cannot buy any right now.";
            showToast(blockReason, "error");
            return;
        }

        const def = POTION_DEFS[key];
        const cost = getPotionBatchCost(key, quantity);
        const coins = Math.max(0, Math.floor(Number(player.coins) || 0));
        const remaining = Math.max(0, coins - cost);
        const balanceWarning = cost >= coins
            ? "You are about to spend all your money."
            : `You are about to spend ${cost.toLocaleString()} coins and leave ${remaining.toLocaleString()} coins.`;

        if (!confirm(`Buy max ${def?.name || "potion"}?\n\n${balanceWarning}\n\nBuy ${quantity.toLocaleString()} for ${cost.toLocaleString()} coins?`)) {
            return;
        }

        buyPotion(key, quantity);
    }

    function usePotion(key) {
        const def = POTION_DEFS[key];
        if (!def || !(player.potions[key] > 0)) return;

        player.potions[key] -= 1;
        applyPotionEffect(key);
        persistPlayerState();
    }

    function useAllPotion(key) {
        const def = POTION_DEFS[key];
        const owned = Math.max(0, Math.floor(Number(player.potions[key]) || 0));
        if (!def || owned <= 0) return;

        const used = applyPotionEffect(key, owned);
        player.potions[key] = Math.max(0, owned - used);
        persistPlayerState();
        showToast(`Used ${used.toLocaleString()} ${def.name}${used === 1 ? "" : "s"}.`);
    }

    function applyPotionEffect(key, quantity = 1) {
        const def = POTION_DEFS[key];
        const uses = Math.max(0, Math.floor(Number(quantity) || 0));
        if (!def || uses <= 0) return 0;

        const effectRolls = getPotionEffectRolls(def) * uses;

        if (def.category === "luck" || def.luckMult) {
            addLuckPotionStack(def.luckMult, effectRolls);
        } else if (key === "coin") {
            player.activeEffects.coin.remaining += effectRolls;
            player.activeEffects.coin.mult = def.coinMult;
        } else if (key === "speed") {
            player.activeEffects.speed.remaining += effectRolls;
            restartAutoRoll();
        } else if (key === "ultra") {
            player.activeEffects.ultra.remaining += effectRolls;
        } else if (key === "omega") {
            player.activeEffects.omega.remaining += effectRolls;
        } else if (key === "apexSurge") {
            player.activeEffects.apexSurge.remaining += effectRolls;
        } else if (key === "randomMutation") {
            player.activeEffects.randomMutation.remaining += effectRolls;
        } else if (STANDARD_MUTATION_KEYS.includes(key)) {
            player.activeEffects[key].remaining += effectRolls;
        }

        return uses;
    }

    function consumeAllPotions() {
        const storedCount = getStoredPotionCount();
        if (storedCount <= 0) {
            showToast("No stored potions.", "error");
            return;
        }

        let consumed = 0;
        for (const key of Object.keys(POTION_DEFS)) {
            const owned = Math.max(0, Math.floor(Number(player.potions[key]) || 0));
            if (owned <= 0) continue;

            player.potions[key] = 0;
            consumed += applyPotionEffect(key, owned);
        }

        persistPlayerState();
        showToast(`Consumed ${consumed.toLocaleString()} potion${consumed === 1 ? "" : "s"}.`);
    }

    function switchTab(tabId) {
        document.querySelectorAll(".rng-tab").forEach((tab) => {
            tab.classList.toggle("active", tab.dataset.tab === tabId);
        });
        document.querySelectorAll(".rng-tab-panel").forEach((panel) => {
            panel.classList.toggle("active", panel.id === `rng-tab-${tabId}`);
        });
        if (tabId === "leaderboard") {
            loadRngLeaderboard({ syncFirst: true });
        } else if (tabId === "quests") {
            renderRngQuestsPanel();
        }
    }

    function buyPrestigeUpgrade(id) {
        const def = PRESTIGE_UPGRADE_DEFS.find((entry) => entry.id === id);
        if (!def) return;
        const cost = getNextPrestigeUpgradeCost(def);
        if (cost === null) {
            showToast(`${def.name} is maxed.`);
            return;
        }
        if (getPrestigePoints() < cost) {
            showToast("Need more prestige points.", "error");
            return;
        }

        if (!player.prestigeUpgrades || typeof player.prestigeUpgrades !== "object") {
            player.prestigeUpgrades = {};
        }
        player.prestigePoints = getPrestigePoints() - cost;
        player.prestigeUpgrades[id] = getPrestigeUpgradeLevel(id) + 1;
        if (id === "autoSpark" && player.autoRollLevel < getPrestigeStartingAutoLevel()) {
            player.autoRollLevel = getPrestigeStartingAutoLevel();
        }
        if (id === "swiftReturn") restartAutoRoll();
        persistPlayerState();
        showToast(`${def.name} upgraded permanently.`);
        GameFx.play("upgrade");
    }

    function prestigeRngRun() {
        const gain = getPrestigePotential();
        if (gain <= 0) {
            showToast("Build up this run before prestiging.", "error");
            return;
        }

        const message = [
            `Prestige now for ${gain.toLocaleString()} point${gain === 1 ? "" : "s"}?`,
            "",
            "This resets coins, rolls, upgrades, potions, active boosts, and RNG level.",
            "Collection, best pull, equipped species, settings, and claimed index rewards stay."
        ].join("\n");

        if (!confirm(message)) return;

        const previous = player;
        const previousHistory = Array.isArray(previous.prestigeHistory) ? previous.prestigeHistory : [];
        const historyEntry = {
            gain,
            bestOneIn: previous.runBestOneIn || 0,
            rolls: previous.rolls || 0,
            collection: previous.runCollectionFinds || 0,
            at: Date.now()
        };
        const nextPrestigeLevel = (previous.prestigeLevel || 0) + 1;
        const nextPrestigePoints = getPrestigePoints() + gain;
        const nextTotalPrestigePoints = Math.max(0, Number(previous.totalPrestigePoints) || getPrestigePoints()) + gain;
        const keptRngXp = Math.floor((previous.rngXp || 0) * getPrestigeRankKeepPercent());
        const fresh = createDefaultPlayer();

        setAutoRoll(false);
        rollLockedUntil = 0;
        isRolling = false;
        if (cooldownInterval) {
            clearInterval(cooldownInterval);
            cooldownInterval = null;
        }

        player = {
            ...fresh,
            collection: previous.collection && typeof previous.collection === "object" ? previous.collection : {},
            claimedIndexRewards: Array.isArray(previous.claimedIndexRewards) ? previous.claimedIndexRewards : [],
            equipped: previous.equipped || null,
            bestOneIn: previous.bestOneIn || 0,
            settings: previous.settings || fresh.settings,
            prestigeLevel: nextPrestigeLevel,
            prestigePoints: nextPrestigePoints,
            totalPrestigePoints: nextTotalPrestigePoints,
            highestPrestigeGain: Math.max(previous.highestPrestigeGain || 0, gain),
            prestigeUpgrades: previous.prestigeUpgrades && typeof previous.prestigeUpgrades === "object" ? previous.prestigeUpgrades : {},
            prestigeHistory: [historyEntry, ...previousHistory].slice(0, PRESTIGE_HISTORY_LIMIT)
        };
        player.coins = getPrestigeStartingCoins();
        player.rngXp = keptRngXp;
        player.autoRollLevel = getPrestigeStartingAutoLevel();
        player.potions = {
            ...player.potions,
            ...getPrestigeStarterPotions()
        };

        persistPlayerState();
        updateSettingsUi();
        showToast(`Prestiged! +${gain.toLocaleString()} permanent point${gain === 1 ? "" : "s"}.`);
        GameFx.play("upgrade");
    }

    function resetRngProgress() {
        if (!confirm("Reset all Shark RNG progress? This will clear coins, rolls, upgrades, collection, and settings.")) {
            return;
        }

        player = createDefaultPlayer();
        persistPlayerState();
        updateSettingsUi();
        closeSettingsModal();
        showToast("Progress reset.");
    }

    function updateSettingsUi() {
        const popups = document.getElementById("rng-setting-disable-popups");
        const sound = document.getElementById("rng-setting-sound");
        const settings = getSettings();
        if (popups) popups.checked = Boolean(settings.disableRarePopups);
        if (sound) sound.checked = settings.soundEnabled !== false;
        document.querySelectorAll("[data-cutscene-skip]").forEach((input) => {
            input.checked = Boolean(settings.skipCutscenes?.[input.dataset.cutsceneSkip]);
        });
    }

    function openSettingsModal() {
        updateSettingsUi();
        document.getElementById("rng-settings-modal")?.classList.remove("hidden");
    }

    function closeSettingsModal() {
        document.getElementById("rng-settings-modal")?.classList.add("hidden");
    }

    function getRngCurrentDevUser() {
        ensureRngLeaderboardServices();
        return rngLeaderboardAuth?.currentUser || rngLeaderboardUser || null;
    }

    function isRngDeveloperUser(user = getRngCurrentDevUser()) {
        return RNG_DEV_UIDS.includes(user?.uid || "");
    }

    function requireRngDevCommand(commandName) {
        const user = getRngCurrentDevUser();
        if (!user || !isRngDeveloperUser(user)) {
            console.log(`Access denied. ${commandName} is for developers only.`);
            showToast("Dev command access denied.", "error");
            return false;
        }
        return true;
    }

    function parseRngDevCoinAmount(amount, commandName, options = {}) {
        const normalized = typeof amount === "string" ? amount.replace(/,/g, "").trim() : amount;
        const parsed = Math.floor(Number(normalized));
        const min = options.allowZero ? 0 : 1;
        if (!Number.isFinite(parsed) || parsed < min) {
            const example = options.example || (options.allowZero ? "0" : "1000000");
            console.log(`Usage: ${commandName}(${example})`);
            return null;
        }
        return parsed;
    }

    function createRngAdminCommandId() {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }
        return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    }

    function getRngAdminTargetLabel(uid, data = {}) {
        const username = String(data.username || data.displayName || "").trim();
        return username || `Player ${String(uid || "").slice(0, 6)}`;
    }

    async function getRngAdminTargetFromDoc(collectionName, uid) {
        const doc = await rngLeaderboardDb.collection(collectionName).doc(uid).get();
        if (!doc.exists) return null;
        return {
            uid: doc.id,
            data: doc.data() || {},
            source: collectionName
        };
    }

    async function findRngAdminTargetsByUsername(username) {
        const collections = ["userStats", RNG_LEADERBOARD_COLLECTION, "users"];
        const byUid = new Map();

        for (const collectionName of collections) {
            const snapshot = await rngLeaderboardDb
                .collection(collectionName)
                .where("username", "==", username)
                .limit(3)
                .get();

            snapshot.docs.forEach((doc) => {
                if (!byUid.has(doc.id)) {
                    byUid.set(doc.id, {
                        uid: doc.id,
                        data: doc.data() || {},
                        source: collectionName
                    });
                }
            });
        }

        return [...byUid.values()];
    }

    async function resolveRngAdminTargetUser(target) {
        if (!ensureRngLeaderboardServices()) {
            throw new Error("Firestore is not ready yet.");
        }

        const rawLookup = typeof target === "object" && target
            ? String(target.uid || target.id || target.username || "").trim()
            : String(target || "").trim();
        const explicitUidMatch = rawLookup.match(/^uid\s*:\s*(.+)$/i);
        const explicitUid = explicitUidMatch ? explicitUidMatch[1].trim() : "";
        const lookup = explicitUid || rawLookup;

        if (!lookup) {
            throw new Error("Enter a UID or exact username.");
        }

        if (!lookup.includes("/")) {
            for (const collectionName of ["userStats", RNG_LEADERBOARD_COLLECTION, RNG_PROFILE_COLLECTION, "users"]) {
                const directTarget = await getRngAdminTargetFromDoc(collectionName, lookup);
                if (directTarget) return directTarget;
            }
        }

        const usernameTargets = await findRngAdminTargetsByUsername(lookup);
        if (usernameTargets.length > 1) {
            throw new Error("Multiple players matched that username. Use UID instead.");
        }
        if (usernameTargets.length === 1) return usernameTargets[0];

        if (explicitUid && /^[A-Za-z0-9_-]{8,}$/.test(lookup)) {
            return {
                uid: lookup,
                data: {},
                source: "uid"
            };
        }

        throw new Error("No player found for that exact username. Use their Firebase UID as uid:THEIR_UID if needed.");
    }

    function parseRngNextRollArgs(target, sharkName, mutation = "base") {
        if (sharkName === undefined && typeof target === "string") {
            const parts = target.split(/\s+-\s+/).map(part => part.trim()).filter(Boolean);
            if (parts.length >= 2) {
                return {
                    target: parts[0],
                    sharkName: parts[1],
                    mutation: parts.slice(2).join(" - ") || "base"
                };
            }
        }

        return { target, sharkName, mutation };
    }

    async function queueRngAdminNextRoll(target, sharkName, mutation = "base") {
        if (!requireRngDevCommand("nextRngRoll")) return null;
        const args = parseRngNextRollArgs(target, sharkName, mutation);
        const targetUser = await resolveRngAdminTargetUser(args.target);
        const baseShark = resolveRngRollPoolEntry(args.sharkName);
        const mutationKey = resolveRngMutationKey(args.mutation);
        const currentUser = getRngCurrentDevUser();
        const commandId = createRngAdminCommandId();
        const now = Date.now();
        const mutationLabel = mutationKey ? MUTATION_TYPES[mutationKey]?.name || mutationKey : "Base";
        const payload = {
            type: "rngNextRoll",
            commandId,
            targetUid: targetUser.uid,
            targetLabel: getRngAdminTargetLabel(targetUser.uid, targetUser.data),
            sharkName: baseShark.name,
            mutation: mutationKey || "base",
            mutationName: mutationLabel,
            createdBy: currentUser.uid,
            createdAtMs: now,
            expiresAtMs: now + RNG_ADMIN_NEXT_ROLL_EXPIRY_MS,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const commandRef = getRngAdminNextRollRef(targetUser.uid);
        if (!commandRef) throw new Error("RNG next-roll command ref is not available.");

        await commandRef.set(payload, { merge: false });
        console.log(`Queued RNG next roll for ${payload.targetLabel} (${targetUser.uid}): ${baseShark.name}${mutationKey ? ` (${mutationLabel})` : ""}.`);
        console.log(`Command ID: ${commandId}`);
        showToast(`Queued ${baseShark.name} for ${payload.targetLabel}.`);
        return payload;
    }

    async function clearRngAdminNextRoll(target) {
        if (!requireRngDevCommand("clearNextRngRoll")) return null;
        const targetUser = await resolveRngAdminTargetUser(target);
        const commandRef = getRngAdminNextRollRef(targetUser.uid);
        if (!commandRef) throw new Error("RNG next-roll command ref is not available.");

        await commandRef.delete();
        console.log(`Cleared queued RNG next roll for ${getRngAdminTargetLabel(targetUser.uid, targetUser.data)} (${targetUser.uid}).`);
        showToast("Queued RNG next roll cleared.");
        return targetUser.uid;
    }

    function installRngDevCommands() {
        function buildRngIndexUnlockEntry(shark) {
            const baseTier = getBaseTierName(shark);
            const oddsTier = getOddsTierName(shark);
            return {
                tier: baseTier,
                baseTier,
                oddsTier,
                oneIn: shark.oneIn || 0,
                firstRoll: player.rolls || 0,
                count: Math.max(1, getCollectionEntryForShark(shark)?.count || 0),
                mutation: shark.mutation || undefined,
                baseName: shark.mutation ? shark.name : undefined
            };
        }

        window.addRngCoins = function addRngCoins(amount = 1_000_000) {
            if (!requireRngDevCommand("addRngCoins")) return;
            const coinsToAdd = parseRngDevCoinAmount(amount, "addRngCoins");
            if (coinsToAdd === null) return;

            player.coins = Math.max(0, (Number(player.coins) || 0) + coinsToAdd);
            persistPlayerState();
            console.log(`Added ${coinsToAdd.toLocaleString()} RNG coins. Total: ${player.coins.toLocaleString()}`);
            showToast(`+${formatCompactCoins(coinsToAdd)} coins`);
        };

        window.setRngCoins = function setRngCoins(amount = 1_000_000) {
            if (!requireRngDevCommand("setRngCoins")) return;
            const newTotal = parseRngDevCoinAmount(amount, "setRngCoins", { allowZero: true });
            if (newTotal === null) return;

            player.coins = newTotal;
            persistPlayerState();
            console.log(`Set RNG coins to ${player.coins.toLocaleString()}.`);
            showToast(`Coins set: ${formatCompactCoins(player.coins)}`);
        };

        window.addRngLevels = function addRngLevels(amount = 1) {
            if (!requireRngDevCommand("addRngLevels")) return;
            const levelsToAdd = parseRngDevCoinAmount(amount, "addRngLevels", { example: "5" });
            if (levelsToAdd === null) return;

            const before = getRankInfo();
            const targetLevel = before.level + levelsToAdd;
            const xpIntoCurrentLevel = Math.max(0, before.xp - before.current.xp);
            player.rngXp = getXpForLevel(targetLevel) + xpIntoCurrentLevel;
            persistPlayerState();

            const after = getRankInfo();
            console.log(`Added ${levelsToAdd.toLocaleString()} RNG level${levelsToAdd === 1 ? "" : "s"}. Level: ${before.level} -> ${after.level}.`);
            showToast(`RNG level ${after.level}`);
        };

        window.setRngLevel = function setRngLevel(level = 10) {
            if (!requireRngDevCommand("setRngLevel")) return;
            const targetLevel = parseRngDevCoinAmount(level, "setRngLevel", { example: "25" });
            if (targetLevel === null) return;

            player.rngXp = getXpForLevel(targetLevel);
            persistPlayerState();
            console.log(`Set RNG level to ${targetLevel.toLocaleString()} (${player.rngXp.toLocaleString()} XP).`);
            showToast(`RNG level set: ${targetLevel.toLocaleString()}`);
        };

        window.addRngRolls = function addRngRolls(amount = 100) {
            if (!requireRngDevCommand("addRngRolls")) return;
            const rollsToAdd = parseRngDevCoinAmount(amount, "addRngRolls", { example: "100" });
            if (rollsToAdd === null) return;

            player.rolls = Math.max(0, (Number(player.rolls) || 0) + rollsToAdd);
            persistPlayerState();
            console.log(`Added ${rollsToAdd.toLocaleString()} RNG rolls. Total: ${player.rolls.toLocaleString()}`);
            showToast(`+${rollsToAdd.toLocaleString()} RNG rolls`);
        };

        window.addRngRebirthTokens = function addRngRebirthTokens(amount = 10) {
            if (!requireRngDevCommand("addRngRebirthTokens")) return;
            const tokensToAdd = parseRngDevCoinAmount(amount, "addRngRebirthTokens", { example: "10" });
            if (tokensToAdd === null) return;

            player.prestigePoints = getPrestigePoints() + tokensToAdd;
            player.totalPrestigePoints = getTotalPrestigePoints() + tokensToAdd;
            persistPlayerState();
            console.log(`Added ${tokensToAdd.toLocaleString()} rebirth token${tokensToAdd === 1 ? "" : "s"}. Unspent: ${getPrestigePoints().toLocaleString()}.`);
            showToast(`+${tokensToAdd.toLocaleString()} rebirth token${tokensToAdd === 1 ? "" : "s"}`);
        };

        window.addRngPrestigePoints = window.addRngRebirthTokens;

        window.unlockRngIndex = function unlockRngIndex() {
            if (!requireRngDevCommand("unlockRngIndex")) return;
            if (!rollPool.length) {
                console.log("RNG index unlock failed: roll pool is empty.");
                showToast("RNG roll pool not loaded.", "error");
                return;
            }

            let unlocked = 0;
            let bestOneIn = player.bestOneIn || 0;
            for (const shark of rollPool) {
                const variants = [
                    shark,
                    ...Object.keys(MUTATION_TYPES).map((mutationKey) => applyStableMutation(shark, mutationKey))
                ];

                for (const variant of variants) {
                    const key = getCollectionKey(variant);
                    if (!player.collection[key]) unlocked++;
                    player.collection[key] = buildRngIndexUnlockEntry(variant);
                    bestOneIn = Math.max(bestOneIn, variant.oneIn || 0);
                }
            }

            player.bestOneIn = bestOneIn;
            player.runBestOneIn = Math.max(player.runBestOneIn || 0, bestOneIn);
            player.runCollectionFinds = Math.max(player.runCollectionFinds || 0, getCollectionTargetCount());
            if (!player.equipped) {
                player.equipped = Object.keys(player.collection)[0] || null;
            }
            persistPlayerState();
            console.log(`Unlocked RNG index. Added ${unlocked.toLocaleString()} new entr${unlocked === 1 ? "y" : "ies"}. Collection: ${getCollectionCount().toLocaleString()} / ${getCollectionTargetCount().toLocaleString()}.`);
            showToast("RNG index unlocked.");
        };

        window.nextRollApex = function nextRollApex() {
            if (!requireRngDevCommand("nextRollApex")) return;
            rngDevForcedMutationType = "apex";
            console.log("Next RNG roll will be forced Apex.");
            showToast("Next roll: Apex");
        };

        window.nextRngRoll = function nextRngRoll(target, sharkName, mutation = "base") {
            return queueRngAdminNextRoll(target, sharkName, mutation).catch((error) => {
                console.error("Unable to queue RNG next roll:", error);
                showToast(error.message || "Unable to queue next roll.", "error");
                return null;
            });
        };

        window.nextroll = window.nextRngRoll;

        window.clearNextRngRoll = function clearNextRngRoll(target) {
            return clearRngAdminNextRoll(target).catch((error) => {
                console.error("Unable to clear RNG next roll:", error);
                showToast(error.message || "Unable to clear next roll.", "error");
                return null;
            });
        };

        window.findRngSharks = function findRngSharks(name = "") {
            if (!requireRngDevCommand("findRngSharks")) return [];
            const matches = getRngRollPoolMatches(name).slice(0, 25);
            if (!matches.length) {
                console.log(`No RNG species matched "${name}".`);
                return [];
            }

            console.table(matches.map((shark) => ({
                name: shark.name,
                tier: getBaseTierName(shark),
                oneIn: shark.oneIn
            })));
            return matches;
        };

        window.showRngStats = function showRngStats() {
            const rank = getRankInfo();
            const best = getBestCollectionEntry();
            console.log("=== CURRENT RNG STATS ===");
            console.log(`Coins: ${(Number(player.coins) || 0).toLocaleString()}`);
            console.log(`Rolls: ${(Number(player.rolls) || 0).toLocaleString()}`);
            console.log(`Level: ${rank.level.toLocaleString()} (${rank.xp.toLocaleString()} / ${rank.next.xp.toLocaleString()} XP)`);
            console.log(`Forced Next Roll: ${rngDevForcedMutationType ? MUTATION_TYPES[rngDevForcedMutationType]?.name || rngDevForcedMutationType : "None"}`);
            console.log(`Admin Queued Next Roll: ${rngAdminNextRollCommand ? `${rngAdminNextRollCommand.sharkName || "Unknown"} (${rngAdminNextRollCommand.mutationName || rngAdminNextRollCommand.mutation || "Base"})` : "None"}`);
            console.log(`Best: ${best?.tier || "None"} (${player.bestOneIn ? `1 in ${formatOneIn(player.bestOneIn)}` : "none"})`);
            console.log(`Collection: ${getCollectionCount().toLocaleString()} / ${getCollectionTargetCount().toLocaleString()}`);
            console.log(`Rebirth Tokens: ${getPrestigePoints().toLocaleString()} unspent / ${getTotalPrestigePoints().toLocaleString()} earned`);
            console.log("=========================");
        };

        window.showRngCommands = function showRngCommands() {
            console.log("=== AVAILABLE RNG COMMANDS ===");
            console.log("addRngCoins(1000000) - Add RNG coins");
            console.log("setRngCoins(1000000) - Set RNG coins directly");
            console.log("addRngLevels(5) - Add RNG levels");
            console.log("setRngLevel(25) - Set RNG level directly");
            console.log("addRngRolls(100) - Add RNG rolls");
            console.log("addRngRebirthTokens(10) - Add spendable rebirth/prestige tokens");
            console.log("addRngPrestigePoints(10) - Alias for addRngRebirthTokens");
            console.log("unlockRngIndex() - Unlock every RNG index entry");
            console.log("nextRollApex() - Force the next RNG roll to be Apex");
            console.log('nextroll("exact username or uid:firebaseUid", "Great White Shark", "apex") - Queue any species/mutation as someone\'s next RNG roll');
            console.log('nextroll("exact username - Great White Shark - apex") - Same command using dashed text');
            console.log('clearNextRngRoll("exact username or uid:firebaseUid") - Clear someone\'s queued RNG next roll');
            console.log('findRngSharks("white") - Search exact RNG species names');
            console.log("showRngStats() - Display current RNG stats");
            console.log("showRngCommands() - Show this help");
            console.log("==============================");
        };
    }

    function isRngTypingTarget(target) {
        return Boolean(target?.closest?.("input, textarea, select, button, [contenteditable='true']"));
    }

    function isAnyRngOverlayOpen() {
        return Boolean(
            document.querySelector(".rng-modal:not(.hidden)") ||
            document.getElementById("rng-cutscene")?.classList.contains("visible") ||
            document.getElementById("rng-celebration")?.classList.contains("visible")
        );
    }

    function handleRngKeyboardShortcut(event) {
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }

        const key = event.key.toLowerCase();

        if (key === "escape") {
            if (document.getElementById("rng-cutscene")?.classList.contains("visible")) {
                closeUltraCutscene();
            } else if (document.getElementById("rng-celebration")?.classList.contains("visible")) {
                closeRarePopup();
            } else if (!document.getElementById("rng-settings-modal")?.classList.contains("hidden")) {
                closeSettingsModal();
            } else if (isCollectionModalOpen()) {
                closeCollectionModal();
            }
            return;
        }

        if (isRngTypingTarget(event.target)) return;
        if (isAnyRngOverlayOpen()) return;

        if (key === "r" || event.key === " ") {
            event.preventDefault();
            performRoll();
        } else if (key === "a") {
            event.preventDefault();
            setAutoRoll(!autoEnabled);
        } else if (key === "i") {
            event.preventDefault();
            openCollectionModal();
        }
    }

    function bindUi() {
        document.getElementById("rng-roll-btn")?.addEventListener("click", performRoll);
        document.getElementById("rng-auto-btn")?.addEventListener("click", () => setAutoRoll(!autoEnabled));
        document.getElementById("rng-auto-arrow-dismiss")?.addEventListener("click", (event) => {
            event.stopPropagation();
            autoArrowDismissed = true;
            localStorage.setItem(AUTO_ARROW_DISMISSED_KEY, "true");
            updateAutoButtonUi();
        });
        document.getElementById("rng-collection-open-btn")?.addEventListener("click", openCollectionModal);
        const topCollectionChip = document.getElementById("rng-top-collection");
        if (topCollectionChip) {
            topCollectionChip.title = "Open Shark Index";
            topCollectionChip.tabIndex = 0;
            topCollectionChip.addEventListener("click", openCollectionModal);
            topCollectionChip.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openCollectionModal();
                }
            });
        }
        document.getElementById("rng-collection-close-btn")?.addEventListener("click", closeCollectionModal);
        document.getElementById("rng-collection-filter")?.addEventListener("change", renderCollectionGrid);
        document.getElementById("rng-collection-search")?.addEventListener("input", scheduleCollectionSearchRender);
        document.getElementById("rng-collection-owned-only")?.addEventListener("change", renderCollectionGrid);
        document.getElementById("rng-collection-equip-best")?.addEventListener("click", equipBestCollectionEntry);
        document.getElementById("rng-collection-sort-rarity")?.addEventListener("click", () => {
            collectionSortRarestFirst = !collectionSortRarestFirst;
            renderCollectionGrid();
        });
        document.getElementById("rng-collection-modal")?.addEventListener("click", (event) => {
            if (event.target.id === "rng-collection-modal") closeCollectionModal();
        });

        document.getElementById("rng-settings-open-btn")?.addEventListener("click", openSettingsModal);
        document.getElementById("rng-settings-close-btn")?.addEventListener("click", closeSettingsModal);
        document.getElementById("rng-settings-modal")?.addEventListener("click", (event) => {
            if (event.target.id === "rng-settings-modal") closeSettingsModal();
        });
        document.getElementById("rng-setting-disable-popups")?.addEventListener("change", (event) => {
            getSettings().disableRarePopups = event.target.checked;
            persistPlayerState();
            showToast(event.target.checked ? "Rare popups disabled" : "Rare popups enabled");
        });
        document.getElementById("rng-setting-sound")?.addEventListener("change", (event) => {
            getSettings().soundEnabled = event.target.checked;
            if (event.target.checked) GameFx.initAudio();
            persistPlayerState();
        });
        document.querySelectorAll("[data-cutscene-skip]").forEach((input) => {
            input.addEventListener("change", (event) => {
                const tier = event.target.dataset.cutsceneSkip;
                getSettings().skipCutscenes[tier] = event.target.checked;
                persistPlayerState();
                showToast(`${tier} repeat cutscenes ${event.target.checked ? "will skip" : "will play"}`);
            });
        });
        document.getElementById("rng-reset-progress-btn")?.addEventListener("click", resetRngProgress);

        document.body.addEventListener("click", () => GameFx.resumeAudio(), { once: true });

        document.querySelectorAll(".rng-tab").forEach((tab) => {
            tab.addEventListener("click", () => switchTab(tab.dataset.tab));
        });
        document.getElementById("rng-leaderboard-refresh")?.addEventListener("click", () => {
            loadRngLeaderboard({ syncFirst: true });
        });

        document.addEventListener("keydown", handleRngKeyboardShortcut);
    }

    function startPotionUiTicker() {
        if (potionTickTimer) clearInterval(potionTickTimer);
        potionTickTimer = setInterval(updateActiveEffectsUi, 500);
    }

async function initRngMode() {
         buildRollPool();
         bindRngViewportSync();
         loadLocalProfile();
         initAmbientBubbles();
         installRngDevCommands();
         bindLocalProfileSaveFlush();
         bindUi();
          updateAllUi();
          updateSettingsUi();
          initRngLeaderboard();
          await hydrateRngProfileFromFirebase();
          startPotionUiTicker();
          GameFx.initAudio();
          updateRollButtonState();
     }

    window.initRngMode = initRngMode;
})();
