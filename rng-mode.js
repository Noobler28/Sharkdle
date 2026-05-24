(function () {
    "use strict";

    const STORAGE_KEY = "sharkRngProfile";
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
    const RNG_LEADERBOARD_FALLBACK_COLLECTION = "userStats";
    const RNG_LEADERBOARD_LIMIT = 10;
    const RNG_LEADERBOARD_QUERY_LIMIT = 30;
    const RNG_LEADERBOARD_SYNC_INTERVAL_MS = 6000;
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

    const STREAK_LUCK_INTERVAL = 10;
    const STREAK_LUCK_BASE = 2;
    const CUTSCENE_SKIP_TIERS = ["Ultra", "Hyper", "Omega", "Singularity"];

    const SHOP_TIER_NAMES = [
        "Bronze", "Silver", "Gold", "Platinum", "Diamond",
        "Mythic", "Abyssal", "Celestial", "Void", "Singularity"
    ];

    const PLAYER_RANK_ICON = "\u{1F988}";
    const RANK_LUCK_PER_LEVEL = 0.025;
    const RANK_LUCK_MULTIPLIER_CAP = 3;

    const UPGRADE_SHOP_DEFS = [
        { id: "luck", name: "Luck", icon: "fa-clover", levelKey: "luckLevel", listKey: "luck" },
        { id: "streak", name: "Streak Luck", icon: "fa-fire", levelKey: "streakLuckLevel", listKey: "streak" },
        { id: "coin", name: "Coin Boost", icon: "fa-coins", levelKey: "coinLevel", listKey: "coin" },
        { id: "speed", name: "Roll Speed", icon: "fa-bolt", levelKey: "rollSpeedLevel", listKey: "speed" },
        { id: "auto", name: "Auto Roll", icon: "fa-robot", levelKey: "autoRollLevel", listKey: "auto" },
        { id: "mutation", name: "Mutation Luck", icon: "fa-dna", levelKey: "mutationLevel", listKey: "mutation" },
        { id: "xp", name: "Research XP", icon: "fa-book-open", levelKey: "xpLevel", listKey: "xp" }
    ];

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
        return list;
    }

    function buildRollSpeedUpgrades() {
        const reductions = [80, 90, 100, 105, 110, 115, 120, 125, 130, 135, 145, 155];
        return reductions.map((reduction, index) => {
            const level = index + 1;
            return {
                level,
                reduction,
                cost: Math.floor(650 * Math.pow(1.42, index)),
                shopTier: getShopTierName(level),
                tierClass: getShopTierClass(level)
            };
        });
    }

    function buildAutoRollUpgrades() {
        const intervals = [2800, 2400, 2100, 1850, 1600, 1400, 1250, 1100];
        const costs = [25000, 75000, 200000, 650000, 1800000, 5000000, 14000000, 40000000];

        return intervals.map((interval, index) => {
            const level = index + 1;
            return {
                level,
                interval,
                cost: costs[index],
                shopTier: getShopTierName(level),
                tierClass: getShopTierClass(level)
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
        return list;
    }

    const MUTATION_UPGRADES = buildMutationUpgrades();

    const UPGRADE_LISTS = {
        luck: buildLuckUpgrades(),
        streak: buildStreakUpgrades(),
        coin: buildCoinUpgrades(),
        speed: buildRollSpeedUpgrades(),
        auto: buildAutoRollUpgrades(),
        mutation: MUTATION_UPGRADES,
        xp: buildXpUpgrades()
    };

    const LUCK_UPGRADES = UPGRADE_LISTS.luck;
    const STREAK_LUCK_UPGRADES = UPGRADE_LISTS.streak;
    const COIN_UPGRADES = UPGRADE_LISTS.coin;
    const ROLL_SPEED_UPGRADES = UPGRADE_LISTS.speed;
    const AUTO_ROLL_UPGRADES = UPGRADE_LISTS.auto;
    const MUTATION_LUCK_UPGRADES = UPGRADE_LISTS.mutation;
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
        }
    };

    // === MUTATION SYSTEM ===
    // Three visual mutations that can roll on any shark and massively inflate its oneIn.
    // With no mutation Luck upgrades the base chance is essentially zero.
    const MUTATION_TYPES = {
        albino: {
            name: "Albino",
            icon: "\u{1F90D}",
            oneInMult: 5,    // shark becomes 5\u00d7 rarer
            color: "#f1f5f9",
            scoreBonus: 30
        },
        shiny: {
            name: "Shiny",
            icon: "\u2728",
            oneInMult: 7,    // shark becomes 7\u00d7 rarer
            color: "#fde047",
            scoreBonus: 22
        },
        bioluminescent: {
            name: "Bioluminescent",
            icon: "\u{1F9EC}",
            oneInMult: 10,   // shark becomes 10\u00d7 rarer
            color: "#22d3ee",
            scoreBonus: 16
        }
    };

    const TIER_ORDER = TIERS.map((tier) => tier.name);
    const TIER_RANK = Object.fromEntries(TIER_ORDER.map((name, index) => [name, index]));

    let rollPool = [];
    let ultraRarePool = [];
    let tierPools = {};
    let player = createDefaultPlayer();
    let autoEnabled = false;
    let hideEnabled = false;
    let autoInterval = null;
    let isRolling = false;
    let rollLockedUntil = 0;
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
            const stage = document.querySelector(".rng-game-shell");
            if (!stage) return;
            stage.classList.remove("rng-shake-light", "rng-shake-medium", "rng-shake-heavy");
            void stage.offsetWidth;
            stage.classList.add(`rng-shake-${intensity}`);
            setTimeout(() => stage.classList.remove(`rng-shake-${intensity}`), intensity === "heavy" ? 520 : 320);
        },

        floatText(text, className = "") {
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
            xpLevel: 0,
            collection: {},
            equipped: null,
            bestOneIn: 0,
            potions: createDefaultPotions(),
            potionRestock: {
                ultra: 0,
                omega: 0
            },
            activeEffects: {
                luck: { remaining: 0, mult: 1 },
                coin: { remaining: 0, mult: 1 },
                speed: { remaining: 0 },
                ultra: { remaining: 0 },
                omega: { remaining: 0 },
                albino: { remaining: 0 },
                shiny: { remaining: 0 },
                bioluminescent: { remaining: 0 }
            },
            settings: {
                disableRarePopups: false,
                soundEnabled: true,
                skipCutscenes: Object.fromEntries(CUTSCENE_SKIP_TIERS.map((tier) => [tier, false])),
                seenCutscenes: Object.fromEntries(CUTSCENE_SKIP_TIERS.map((tier) => [tier, false]))
            },
            rngXp: 0
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

    function getTimestampMs(value) {
        if (typeof value?.toMillis === "function") return value.toMillis();
        return toSafeNumber(value);
    }

    function getBestCollectionEntry() {
        let best = null;

        for (const [name, entry] of Object.entries(player.collection || {})) {
            const oneIn = toSafeNumber(entry?.oneIn);
            if (!best || oneIn > best.oneIn) {
                best = {
                    name,
                    tier: entry?.tier || tierNameFromOneIn(oneIn),
                    oneIn
                };
            }
        }

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

    function getFallbackUsername(user) {
        const emailName = user?.email ? user.email.split("@")[0] : "";
        return user?.displayName || emailName || "Anonymous";
    }

    function setRngLeaderboardStatus(message) {
        const status = document.getElementById("rng-leaderboard-status");
        if (status) status.textContent = message;
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
            const profileDoc = await rngLeaderboardDb.collection("userStats").doc(user.uid).get();
            const data = profileDoc.exists ? profileDoc.data() || {} : {};
            rngLeaderboardProfileCache = {
                ...fallback,
                username: String(data.username || fallback.username).slice(0, 32),
                profilePicture: data.profilePicture || data.profilePic || fallback.profilePicture,
                equippedBadge: data.equippedBadge || "starter",
                equippedCardTheme: data.equippedCardTheme || "default"
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

        return {
            uid: user.uid,
            username: profile.username || getFallbackUsername(user),
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
        const delay = Math.max(1200, RNG_LEADERBOARD_SYNC_INTERVAL_MS - elapsed);

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

    function initRngLeaderboard() {
        renderRngLeaderboardSelf();

        if (!ensureRngLeaderboardServices()) {
            setRngLeaderboardStatus("RNG leaderboard is unavailable right now.");
            return;
        }

        rngLeaderboardAuth.onAuthStateChanged((user) => {
            rngLeaderboardUser = user || null;
            rngLeaderboardProfileCache = null;
            renderRngLeaderboardSelf();
            if (user) scheduleRngLeaderboardSync();
            loadRngLeaderboard();
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

        if (shark.habitat === "Bathypelagic") score += 18;
        else if (shark.habitat === "Mesopelagic") score += 8;

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
            return 8_000_000 + (hash % 30) * 750_000;
        }
        if (score >= 56) {
            return 1_200_000 + (hash % 40) * 120_000;
        }

        const variance = 0.82 + ((hash % 36) / 100);
        return Math.max(2, Math.round(tierMeta.baseOneIn * variance));
    }

    function getTierMeta(tierName) {
        return TIERS.find((tier) => tier.name === tierName) || TIERS[0];
    }

    function buildRollPool() {
        const source = Array.isArray(window.sharks) ? window.sharks : [];
        rollPool = source.map((shark) => {
            const tierName = scoreToTierName(computeRarityScore(shark));
            const tierMeta = getTierMeta(tierName);
            const oneIn = buildOneIn(shark, tierName, tierMeta);

            return {
                name: shark.name,
                family: shark.family,
                order: shark.order,
                size: shark.size,
                habitat: shark.habitat,
                yod: shark.yod,
                tier: tierName,
                oneIn,
                coinReward: Math.round(tierMeta.coinReward * (0.9 + ((hashString(shark.name + "coin") % 20) / 100))),
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
        if (player.streakLuckLevel <= 0) return STREAK_LUCK_BASE;
        const upgrade = STREAK_LUCK_UPGRADES.find((entry) => entry.level === player.streakLuckLevel);
        return upgrade ? upgrade.mult : STREAK_LUCK_BASE;
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
        const potionMult = player.activeEffects.luck.remaining > 0
            ? player.activeEffects.luck.mult
            : 1;
        return (1 + upgradeBonus) * getRankLuckMultiplier() * getEquippedLuckMultiplier() * potionMult;
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
        return (1 + upgradeBonus) * potionMult;
    }

    function getEquippedCollectionEntry() {
        if (!player.equipped) return null;
        return player.collection[player.equipped] || null;
    }

    function getEquippedLuckBonus() {
        const entry = getEquippedCollectionEntry();
        return entry ? (EQUIPPED_LUCK_BONUS_BY_TIER[entry.tier] || 0) : 0;
    }

    function getEquippedLuckMultiplier() {
        return 1 + getEquippedLuckBonus();
    }

    function getXpMultiplier() {
        const upgradeBonus = XP_UPGRADES
            .slice(0, player.xpLevel)
            .reduce((sum, upgrade) => sum + upgrade.bonus, 0);
        return 1 + upgradeBonus;
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
        if (!rolled.potionSource) return getCoinMultiplier();
        return Math.min(getCoinMultiplier(), GUARANTEED_ROLL_COIN_MULTIPLIER_CAP);
    }

    function getRewardRate(rolled) {
        return rolled.rewardRate || 1;
    }

    function getRollCooldownMs() {
        const reduction = ROLL_SPEED_UPGRADES
            .slice(0, player.rollSpeedLevel)
            .reduce((sum, upgrade) => sum + upgrade.reduction, 0);
        const potionMult = player.activeEffects.speed.remaining > 0 ? 0.5 : 1;
        return Math.max(180, Math.round((BASE_ROLL_COOLDOWN_MS - reduction) * potionMult));
    }

    function getAutoIntervalMs() {
        const upgrade = AUTO_ROLL_UPGRADES[Math.max(0, player.autoRollLevel - 1)];
        const baseInterval = upgrade?.interval || BASE_AUTO_INTERVAL_MS;
        const potionMult = player.activeEffects.speed.remaining > 0 ? 0.5 : 1;
        return Math.max(500, Math.round(baseInterval * potionMult));
    }

    function getMutationChance() {
        if (player.mutationLevel <= 0) return null;
        const upgrade = MUTATION_LUCK_UPGRADES.find((entry) => entry.level === player.mutationLevel);
        return upgrade ? upgrade.chance : null;
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
        const seen = new Set();
        const pool = [];

        const add = (shark) => {
            if (shark && !seen.has(shark.name)) {
                seen.add(shark.name);
                pool.push(shark);
            }
        };

        for (const entry of ultraRarePool) add(entry);

        for (const tierName of ["Singularity", "Omega", "Hyper", "Ultra", "Secret", "Mythical", "Legendary"]) {
            for (const entry of tierPools[tierName] || []) add(entry);
        }

        const highScore = rollPool.filter((shark) => computeRarityScore(shark) >= 70);
        for (const entry of highScore) add(entry);

        if (!pool.length) {
            return [...rollPool].sort((a, b) => b.oneIn - a.oneIn).slice(0, 40);
        }

        return pool;
    }

    function applyAbyssRollBoost(shark) {
        const rollSalt = hashString(`${shark.name}:${player.rolls}:${Date.now()}`);
        const forcedOneIn = Math.max(
            shark.oneIn,
            ULTRA_ONE_IN_THRESHOLD + (rollSalt % 49_000_000)
        );
        const tier = tierNameFromOneIn(forcedOneIn);
        const tierMeta = getTierMeta(tier);

        return {
            ...shark,
            oneIn: forcedOneIn,
            tier,
            className: tierMeta.className,
            coinReward: Math.round(tierMeta.coinReward * (0.95 + ((rollSalt >> 4) % 15) / 100))
        };
    }

    function pickGuaranteedOmegaOrBetter() {
        const candidates = [...(tierPools.Singularity || []), ...(tierPools.Omega || [])];
        const shark = candidates.length
            ? candidates[Math.floor(Math.random() * candidates.length)]
            : rollPool[Math.floor(Math.random() * rollPool.length)];

        const rollSalt = hashString(`${shark.name}:${player.rolls}:${Date.now()}`);
        const forcedOneIn = 100_000_000 + (rollSalt % 900_000_000);
        const tier = tierNameFromOneIn(forcedOneIn);
        const tierMeta = getTierMeta(tier);

        return {
            ...shark,
            oneIn: forcedOneIn,
            tier,
            className: tierMeta.className,
            coinReward: Math.round(tierMeta.coinReward * (0.95 + ((rollSalt >> 4) % 15) / 100))
        };
    }

    function pickGuaranteedUltraRare() {
        const pool = getAbyssEligiblePool();
        const picked = pool[Math.floor(Math.random() * pool.length)];
        return applyAbyssRollBoost(picked);
    }

    function consumeEffectRolls() {
        if (player.activeEffects.luck.remaining > 0) {
            player.activeEffects.luck.remaining -= 1;
            if (player.activeEffects.luck.remaining <= 0) {
                player.activeEffects.luck.mult = 1;
            }
        }
        if (player.activeEffects.coin.remaining > 0) player.activeEffects.coin.remaining -= 1;
        if (player.activeEffects.speed.remaining > 0) player.activeEffects.speed.remaining -= 1;
    }

    function getCollectionKey(shark) {
        return shark.mutation ? `${shark.name} (${MUTATION_TYPES[shark.mutation]?.name})` : shark.name;
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
        if (!player.collection[key]) {
            player.collection[key] = {
                tier: rolled.tier,
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
            if (rolled.oneIn > (player.collection[key].oneIn || 0)) {
                player.collection[key].oneIn = rolled.oneIn;
                player.collection[key].tier = rolled.tier;
            }
        }

        if (rolled.oneIn > player.bestOneIn) {
            player.bestOneIn = rolled.oneIn;
        }

        if (!player.equipped) {
            player.equipped = key;
        }

        grantRollXp(rolled);
        return rolled;
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
        const tierRank = TIER_RANK[shark.tier] || 0;

        if (tierRank >= TIER_RANK.Rare) xp += 12;
        if (tierRank >= TIER_RANK.Epic) xp += 28;
        if (tierRank >= TIER_RANK.Legendary) xp += 60;
        if (tierRank >= TIER_RANK.Mythical) xp += 120;
        if (shark.oneIn >= ULTRA_ONE_IN_THRESHOLD) xp += 250;
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

function rollForShark() {
    player.rolls += 1;

    let rolled = null;

    // =========================================
    // OMEGA / ULTRA GUARANTEED POTIONS
    // =========================================

    if (player.activeEffects.omega?.remaining > 0) {

        rolled = markGuaranteedPotionRoll(pickGuaranteedOmegaOrBetter(), "omegaPotion");

        player.activeEffects.omega.remaining = Math.max(
            0,
            player.activeEffects.omega.remaining - 1
        );
        startPotionRestock("omega");

    } else if (player.activeEffects.ultra?.remaining > 0) {

        rolled = markGuaranteedPotionRoll(pickGuaranteedUltraRare(), "ultraPotion");

        player.activeEffects.ultra.remaining = Math.max(
            0,
            player.activeEffects.ultra.remaining - 1
        );
        startPotionRestock("ultra");
    }

    // =========================================
    // RANDOM MUTATION ROLL
    // =========================================

    if (!rolled) {

        const mutationChance = getMutationChance();

        if (
            mutationChance !== null &&
            Math.random() < (1 / mutationChance)
        ) {

            const mutationKeys = Object.keys(MUTATION_TYPES);

            const mutationKey =
                mutationKeys[
                    Math.floor(Math.random() * mutationKeys.length)
                ];

            const mutation = MUTATION_TYPES[mutationKey];

            // Pick a normal shark FIRST
            const picked =
                rollPool[Math.floor(Math.random() * rollPool.length)];

            const salt = hashString(
                `${picked.name}:${player.rolls}:${Date.now()}`
            );

            const variant = 0.9 + (salt % 20) / 100;

            const mutatedOneIn = Math.floor(
                picked.oneIn *
                mutation.oneInMult *
                variant
            );

            const tier = tierNameFromOneIn(mutatedOneIn);

            rolled = {
                ...picked,
                oneIn: mutatedOneIn,
                tier,
                className: getTierMeta(tier).className,
                coinReward: Math.round(
                    getTierMeta(tier).coinReward *
                    (0.95 + ((salt >> 4) % 15) / 100)
                ),
                mutation: mutationKey
            };
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

    function applyForcedMutation(type) {

        const mutation = MUTATION_TYPES[type];

        const salt = hashString(
            `${rolled.name}:${player.rolls}:${Date.now()}`
        );

        const variant = 0.9 + (salt % 20) / 100;

        const mutatedOneIn = Math.floor(
            rolled.oneIn *
            mutation.oneInMult *
            variant
        );

        const tier = tierNameFromOneIn(mutatedOneIn);

        rolled = {
            ...rolled,
            oneIn: mutatedOneIn,
            tier,
            className: getTierMeta(tier).className,
            coinReward: Math.round(
                getTierMeta(tier).coinReward *
                (0.95 + ((salt >> 4) % 15) / 100)
            ),
            mutation: type
        };

        rolled = markGuaranteedPotionRoll(rolled, "mutationPotion");

        player.activeEffects[type].remaining = Math.max(
            0,
            player.activeEffects[type].remaining - 1
        );
    }

    if (player.activeEffects.albino?.remaining > 0) {

        applyForcedMutation("albino");

    } else if (player.activeEffects.shiny?.remaining > 0) {

        applyForcedMutation("shiny");

    } else if (player.activeEffects.bioluminescent?.remaining > 0) {

        applyForcedMutation("bioluminescent");
    }

    // =========================================
    // CLEANUP
    // =========================================

    if (!rolled.potionSource) {
        tickPotionRestocks();
    }

    consumeEffectRolls();

    return finalizeRoll(rolled);
}

    function saveLocalProfile() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
    }

    function loadLocalProfile() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            player = {
                ...createDefaultPlayer(),
                ...parsed,
                rollSpeedLevel: Math.min(parsed.rollSpeedLevel || 0, ROLL_SPEED_UPGRADES.length),
                autoRollLevel: Math.min(
                    parsed.autoRollLevel ?? Math.min(parsed.autoSpeedLevel || 0, 1),
                    AUTO_ROLL_UPGRADES.length
                ),
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
                    albino: { ...createDefaultPlayer().activeEffects.albino, ...(parsed.activeEffects?.albino || {}) },
                    shiny: { ...createDefaultPlayer().activeEffects.shiny, ...(parsed.activeEffects?.shiny || {}) },
                    bioluminescent: { ...createDefaultPlayer().activeEffects.bioluminescent, ...(parsed.activeEffects?.bioluminescent || {}) }
                },
                collection: parsed.collection && typeof parsed.collection === "object" ? parsed.collection : {},
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
        } catch (error) {
            console.warn("Failed to load local RNG profile:", error);
            player = createDefaultPlayer();
        }
    }

    function scheduleCloudSync() {
        scheduleRngLeaderboardSync();
    }

    function syncRngProfileToFirebase() {
        return syncRngLeaderboardEntry();
    }

    function hydrateRngProfileFromFirebase() {
        return loadRngLeaderboard();
    }

    function persistPlayerState() {
        saveLocalProfile();
        scheduleCloudSync();
        updateAllUi();
    }

    function getCollectionCount() {
        return Object.keys(player.collection).length;
    }

    function getRarityClass(tierName) {
        return getTierMeta(tierName).className;
    }

    function getPotionRestock(key) {
        return Math.max(0, player.potionRestock?.[key] || 0);
    }

    function getPotionHeldCount(key) {
        return (player.potions[key] || 0) + (player.activeEffects[key]?.remaining || 0);
    }

    function getPotionPurchaseBlockReason(key) {
        const def = POTION_DEFS[key];
        if (!def) return "Unknown potion";

        if (def.maxOwned && getPotionHeldCount(key) >= def.maxOwned) {
            return "Already stocked";
        }

        const restock = getPotionRestock(key);
        if (restock > 0) {
            return `Restocks after ${restock} normal roll${restock === 1 ? "" : "s"}`;
        }

        if (player.coins < def.cost) {
            return `Need ${def.cost.toLocaleString()} coins`;
        }

        return "";
    }

    function startPotionRestock(key) {
        const restockRolls = POTION_DEFS[key]?.restockRolls || 0;
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

    function updateActiveEffectsUi() {
        const el = document.getElementById("rng-active-effects");
        if (!el) return;

        const parts = [];
        if (player.activeEffects.luck.remaining > 0) {
            parts.push(`\u{1F340} Luck \u00d7${player.activeEffects.luck.mult} (${player.activeEffects.luck.remaining})`);
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
            if (player.activeEffects.albino?.remaining > 0) {
                parts.push("\u{1F90D} Albino ready");
            }
            if (player.activeEffects.shiny?.remaining > 0) {
                parts.push("\u2728 Shiny ready");
            }
            if (player.activeEffects.bioluminescent?.remaining > 0) {
                parts.push("\u{1F9EC} Bioluminescent ready");
            }
        const mChance = getMutationChance();
        if (mChance !== null) {
            parts.push(`\u{1F9EC} Mutation: 1 in ${mChance.toLocaleString()}`);
        }

        if (parts.length) {
            el.textContent = parts.join(" \u00b7 ");
            el.removeAttribute("data-empty");
        } else {
            el.textContent = "";
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

    function updateStatsUi() {
        const topCoins = document.querySelector("#rng-top-coins span");
        const topLuck = document.querySelector("#rng-top-luck span");
        const topCollection = document.querySelector("#rng-top-collection span");
        const rollsEl = document.getElementById("rng-roll-text");
        const bestEl = document.getElementById("rng-best-text");
        const streakEl = document.getElementById("rng-streak-text");
        const cooldownEl = document.getElementById("rng-cooldown-text");
        const streakInfo = getStreakRollInfo();

        if (topCoins) topCoins.textContent = `${player.coins.toLocaleString()} (${getCoinMultiplier().toFixed(1)}\u00d7)`;
        if (topLuck) topLuck.textContent = `x${getLuckMultiplier().toFixed(2)}`;
        if (topCollection) topCollection.textContent = `${getCollectionCount()}/${rollPool.length}`;
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
        const tier = entry?.tier || poolEntry?.tier || "Common";
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
        if (def.listKey === "xp") {
            return `Lv.${next.level} \u00b7 +${Math.round(next.bonus * 100)}% XP`;
        }
        return `Lv.${next.level}`;
    }

    function getUpgradeList(def) {
        return UPGRADE_LISTS[def.listKey];
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
                btn.textContent = next.cost >= 1_000_000
                    ? `${(next.cost / 1_000_000).toFixed(1)}M`
                    : next.cost >= 1000
                        ? `${Math.round(next.cost / 1000)}K`
                        : String(next.cost);
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

        for (let i = 0; i < 14; i++) {
            const bubble = document.createElement("span");
            bubble.className = "rng-bubble";
            bubble.style.setProperty("--left", `${(i * 7) % 100}%`);
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
            const blockReason = getPotionPurchaseBlockReason(key);
            const restock = getPotionRestock(key);
            buyBtn.textContent = restock > 0
                ? `${restock} rolls`
                : def.cost >= 1_000_000
                ? `${(def.cost / 1_000_000).toFixed(0)}M`
                : def.cost >= 1000
                    ? `${Math.round(def.cost / 1000)}K`
                    : String(def.cost);
            buyBtn.title = blockReason || `Buy for ${def.cost.toLocaleString()} coins`;
            buyBtn.disabled = Boolean(blockReason);
            buyBtn.addEventListener("click", () => buyPotion(key));

            const useBtn = document.createElement("button");
            useBtn.className = "rng-btn";
            useBtn.type = "button";
            useBtn.textContent = "Use";
            useBtn.disabled = !(player.potions[key] > 0);
            useBtn.addEventListener("click", () => usePotion(key));

            actions.appendChild(buyBtn);
            actions.appendChild(useBtn);
            shop.appendChild(card);
        }
    }

    function updateAllUi() {
        updateStatsUi();
        updateRankUi();
        updateEquippedUi();
        renderUpgradeShop();
        renderPotionShop();
        renderCollectionGrid();
        renderTierLegend();
        renderRngLeaderboardSelf();
        updateAutoButtonUi();
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

        legend.innerHTML = examples.map(([name, odds]) => {
            const meta = getTierMeta(name);
            return `<div class="rng-tier-row ${meta.className}"><span>${name}</span><span>${odds}</span></div>`;
        }).join("");
    }

    function renderCollectionGrid() {
        const grid = document.getElementById("rng-collection-grid");
        const filter = document.getElementById("rng-collection-filter");
        const searchInput = document.getElementById("rng-collection-search");
        if (!grid) return;

        const tierFilter = filter ? filter.value : "all";
        const mutationFilter = tierFilter === "albino" || tierFilter === "shiny" || tierFilter === "bioluminescent"
            ? tierFilter : null;
        const searchTerm = (searchInput?.value || "").toLowerCase().trim();
        const searchTokens = searchTerm ? searchTerm.split(/\s+/).filter(Boolean) : [];

        const ownedNames = Object.keys(player.collection).sort((a, b) => {
            const tierDiff = (TIER_RANK[player.collection[b].tier] || 0) - (TIER_RANK[player.collection[a].tier] || 0);
            if (tierDiff !== 0) return tierDiff;
            return (player.collection[b].oneIn || 0) - (player.collection[a].oneIn || 0);
        });

        grid.innerHTML = "";

        if (!ownedNames.length) {
            grid.innerHTML = `<p class="rng-empty-note">No species yet. Hit Roll to start your collection.</p>`;
            return;
        }

        let rendered = 0;
        for (const name of ownedNames) {
            const entry = player.collection[name];
            if (mutationFilter) {
                if (entry.mutation !== mutationFilter) continue;
            } else if (tierFilter !== "all" && entry.tier !== tierFilter) {
                continue;
            }

            if (searchTokens.length) {
                const displayName = entry.mutation ? entry.baseName : name;
                if (!searchTokens.every(token => displayName.toLowerCase().includes(token))) continue;
            }

            const displayName = entry.mutation ? entry.baseName : name;
            const card = document.createElement("button");
            card.type = "button";
            card.className = `rng-collection-card ${getRarityClass(entry.tier)}${player.equipped === name ? " equipped" : ""}${entry.mutation ? ' ' + entry.mutation : ""}`;
            card.innerHTML = `
                <span class="rng-collection-card-tier">${entry.tier}${entry.mutation ? ' \u00b7 ' + MUTATION_TYPES[entry.mutation]?.name : ''}</span>
                <strong>${displayName}</strong>
                <span class="rng-collection-card-meta">1 in ${formatOneIn(entry.oneIn)} \u00b7 x${entry.count}</span>
            `;
            card.addEventListener("click", () => {
                player.equipped = name;
                persistPlayerState();
            });
            grid.appendChild(card);
            rendered++;
        }

        if (!rendered) {
            grid.innerHTML = `<p class="rng-empty-note">No matching species.</p>`;
        }
    }

    async function animateRoll(finalShark) {
        const display = document.getElementById("rng-roll-display");
        const result = document.getElementById("rng-result");
        const stage = document.querySelector(".rng-roll-stage");
        if (!display) return;

        GameFx.play("roll");
        stage?.classList.add("rng-rolling");
        if (!hideEnabled) display.style.display = "block";

        const flashPool = rollPool.length ? rollPool : [finalShark];
        const frameDelay = Math.max(35, Math.round(getRollCooldownMs() / 16));

        for (let i = 0; i < 14; i++) {
            const randomShark = flashPool[Math.floor(Math.random() * flashPool.length)];
            if (!hideEnabled) {
                display.textContent = randomShark.name;
                display.className = `rng-roll-display ${randomShark.className}`;
            }
            await new Promise((resolve) => setTimeout(resolve, frameDelay));
        }

        if (!hideEnabled) {
            display.textContent = finalShark.name;
            display.className = `rng-roll-display ${finalShark.className}${finalShark.mutation ? ' ' + finalShark.mutation : ''}`;
        }

        stage?.classList.remove("rng-rolling");

        if (result) {
            const isNew = player.collection[finalShark.name]?.count === 1;
            const streakNote = isStreakLuckRoll()
                ? ` \u00b7 <span class="rng-streak-tag">Streak \u00d7${getStreakLuckMultiplier()}</span>`
                : "";
            const mutationNote = finalShark.mutation && MUTATION_TYPES[finalShark.mutation]
                ? ` \u00b7 <span class="rng-mutation-tag ${finalShark.mutation}">${MUTATION_TYPES[finalShark.mutation].icon} ${finalShark.mutation.toUpperCase()}</span>`
                : "";
            const payoutNote = finalShark.potionSource
                ? ` \u00b7 Potion payout ${Math.round(finalShark.rewardRate * 100)}%`
                : "";
            result.innerHTML = `
                <span class="${finalShark.className}${finalShark.mutation ? ' ' + finalShark.mutation : ''}">You rolled: ${finalShark.name}</span>
                <span class="rng-result-meta">${finalShark.tier} \u00b7 1 in ${formatOneIn(finalShark.oneIn)} \u00b7 +${finalShark.coinReward.toLocaleString()} coins${isNew ? " \u00b7 NEW!" : ""}${streakNote}${mutationNote}${payoutNote}</span>
            `;
            if (isNew) result.classList.add("rng-result-pop");
            setTimeout(() => result.classList.remove("rng-result-pop"), 400);
        }
    }

    function applyRollJuice(shark) {
        GameFx.floatText(`+${shark.coinReward.toLocaleString()}`, "coin");
        GameFx.play("coin");

        if (isUltraRarePull(shark)) {
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

        const isNew = player.collection[shark.name]?.count === 1;
        if (isNew) GameFx.play("new");
    }

    function isUltraRarePull(shark) {
        return shark.oneIn >= ULTRA_ONE_IN_THRESHOLD;
    }

    function isRarePull(shark) {
        return shark.oneIn >= 2500 || TIER_RANK[shark.tier] >= TIER_RANK.Legendary;
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

        overlay.className = `rng-celebration visible ${shark.className}`;
        overlay.innerHTML = `
            <div class="rng-celebration-card">
                <p class="rng-celebration-tag">${shark.tier}!</p>
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
        if (shark.oneIn >= ULTRA_ONE_IN_THRESHOLD) {
            if (shouldSkipCutscene(shark)) {
                showToast(`Skipped repeat ${shark.tier} cutscene`);
                return;
            }
            await showUltraCutscene(shark);
        } else if (isRarePull(shark) && !getSettings().disableRarePopups) {
            showRarePopup(shark);
        }
    }

    function getUltraRevealConfig(shark) {
        return ULTRA_REVEAL_CONFIGS[shark.tier] || ULTRA_REVEAL_CONFIGS.Ultra;
    }

    function shouldSkipCutscene(shark) {
        const tier = shark.tier;
        const settings = getSettings();
        return Boolean(settings.skipCutscenes?.[tier] && settings.seenCutscenes?.[tier]);
    }

    function markCutsceneSeen(shark) {
        const tier = shark.tier;
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
            const isNew = player.collection[shark.name]?.count === 1;
            const reveal = getUltraRevealConfig(shark);

            cutscene.className = `rng-cutscene visible playing ${shark.className}${shark.mutation ? ' ' + shark.mutation : ''}`;
            cutscene.innerHTML = `
                <div class="rng-cutscene-vignette"></div>
                <div class="rng-cutscene-aura"></div>
                <div class="rng-cutscene-tunnel"></div>
                <div class="rng-cutscene-flash"></div>
                <div class="rng-cutscene-beams" aria-hidden="true"></div>
                <div class="rng-cutscene-rings" aria-hidden="true"></div>
                <div class="rng-cutscene-particles" aria-hidden="true"></div>
                <div class="rng-cutscene-content">
                    <p class="rng-cutscene-eyebrow">${reveal.eyebrow}</p>
                    <p class="rng-cutscene-tier">${shark.tier}</p>
                    <h2 class="rng-cutscene-name${shark.mutation ? ' ' + shark.mutation : ''}">${shark.name}</h2>
                    <p class="rng-cutscene-odds">1 in ${formatOneIn(shark.oneIn)}</p>
                    <p class="rng-cutscene-meta">${shark.habitat || "Unknown"} \u00b7 ${shark.size || "?"} \u00b7 ${isNew ? "NEW species!" : "Added to collection"}${shark.mutation ? ' \u00b7 <span class="rng-mutation-tag ' + shark.mutation + '">' + MUTATION_TYPES[shark.mutation]?.icon + ' ' + shark.mutation.toUpperCase() + '</span>' : ''}</p>
                    <button type="button" class="rng-cutscene-btn" id="rng-cutscene-close">Continue</button>
                </div>
            `;

            const rings = cutscene.querySelector(".rng-cutscene-rings");
            if (rings) {
                for (let i = 0; i < reveal.ringCount; i++) {
                    const ring = document.createElement("span");
                    const ringSize = shark.tier === "Singularity" ? 110 + (i * 62) : 140 + (i * 76);
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
                    span.style.setProperty("--y", `${(8 + (hashString(shark.tier + shark.name + i) % 84))}%`);
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

        const finalShark = rollForShark();
        await animateRoll(finalShark);
        applyRollJuice(finalShark);
        await showRollReveal(finalShark);
        persistPlayerState();

        rollLockedUntil = Date.now() + getRollCooldownMs();
        isRolling = false;
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
        if (!autoButton) return;

        const unlocked = isAutoRollUnlocked();
        autoButton.classList.toggle("locked", !unlocked);
        autoButton.classList.toggle("active", autoEnabled && unlocked);
        autoButton.title = unlocked
            ? `Auto roll every ${(getAutoIntervalMs() / 1000).toFixed(1)}s`
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

        if (autoEnabled) {
            autoInterval = setInterval(() => {
                if (!isRolling && Date.now() >= rollLockedUntil) performRoll();
            }, getAutoIntervalMs());
        }
    }

    function setHideRoll(enabled) {
        hideEnabled = enabled;
        const hideButton = document.getElementById("rng-hide-btn");
        const display = document.getElementById("rng-roll-display");
        if (hideButton) hideButton.classList.toggle("active", hideEnabled);
        if (display) {
            display.style.opacity = hideEnabled ? "0" : "1";
            display.style.visibility = hideEnabled ? "hidden" : "visible";
        }
    }

    function openCollectionModal() {
        document.getElementById("rng-collection-modal")?.classList.remove("hidden");
        renderCollectionGrid();
    }

    function closeCollectionModal() {
        document.getElementById("rng-collection-modal")?.classList.add("hidden");
    }

    function buyUpgrade(list, levelKey) {
        const next = getNextUpgrade(list, player[levelKey]);
        if (!next || player.coins < next.cost) return;
        player.coins -= next.cost;
        player[levelKey] = next.level;
        if (levelKey === "rollSpeedLevel" || levelKey === "autoRollLevel") restartAutoRoll();
        persistPlayerState();
    }

    function buyPotion(key) {
        const def = POTION_DEFS[key];
        const blockReason = getPotionPurchaseBlockReason(key);
        if (!def || blockReason) {
            if (blockReason) showToast(blockReason, "error");
            return;
        }
        player.coins -= def.cost;
        player.potions[key] = (player.potions[key] || 0) + 1;
        persistPlayerState();
    }

    function usePotion(key) {
        const def = POTION_DEFS[key];
        if (!def || !(player.potions[key] > 0)) return;

        player.potions[key] -= 1;

        if (def.category === "luck" || def.luckMult) {
            const wasActive = player.activeEffects.luck.remaining > 0;
            player.activeEffects.luck.remaining += def.rolls;
            player.activeEffects.luck.mult = wasActive
                ? Math.max(player.activeEffects.luck.mult, def.luckMult)
                : def.luckMult;
        } else if (key === "coin") {
            player.activeEffects.coin.remaining += def.rolls;
            player.activeEffects.coin.mult = def.coinMult;
        } else if (key === "speed") {
            player.activeEffects.speed.remaining += def.rolls;
            restartAutoRoll();
        } else if (key === "ultra") {
            player.activeEffects.ultra.remaining += def.rolls;
        } else if (key === "omega") {
            player.activeEffects.omega.remaining += def.rolls;
        } else if (key === "albino") {
            player.activeEffects.albino.remaining += def.rolls;
        } else if (key === "shiny") {
            player.activeEffects.shiny.remaining += def.rolls;
        } else if (key === "bioluminescent") {
            player.activeEffects.bioluminescent.remaining += def.rolls;
        }

        persistPlayerState();
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
        }
    }

    function parseAmount(raw) {
        const value = String(raw || "").trim().toLowerCase().replace(/,/g, "");
        if (!value) return NaN;
        const match = value.match(/^([\d.]+)\s*([kmb])?$/i);
        if (!match) return NaN;
        let num = parseFloat(match[1]);
        const suffix = (match[2] || "").toLowerCase();
        if (suffix === "k") num *= 1_000;
        if (suffix === "m") num *= 1_000_000;
        if (suffix === "b") num *= 1_000_000_000;
        return Math.floor(num);
    }

    function devLog(message) {
        const log = document.getElementById("rng-dev-log");
        if (!log) return;
        const line = `> ${message}`;
        log.textContent = log.textContent ? `${log.textContent}\n${line}` : line;
        log.scrollTop = log.scrollHeight;
    }

    function runDevCommand(input) {
        const raw = String(input || "").trim();
        if (!raw) return;

        const parts = raw.split(/\s+/);
        const cmd = parts[0].toLowerCase().replace(/^\//, "");
        const arg = parts.slice(1).join(" ");

        if (cmd === "help" || cmd === "commands") {
            devLog("givecoins <n> | maxcoins | givepotion <type> <n> | reset");
            devLog("potions: luckMinor, luck, luckStrong, luckMega, luckVoid, coin, speed, ultra, omega, albino, shiny, bioluminescent");
            return;
        }
        // Command to give all shark species INCLUDING mutations
if (cmd === "giveall") {

    // normal sharks
    for (const shark of rollPool) {
        player.collection[shark.name] = {
            tier: shark.tier,
            oneIn: shark.oneIn,
            firstRoll: player.rolls,
            count: 1
        };

        // mutated versions
        for (const mutationKey of Object.keys(MUTATION_TYPES)) {
            const mutation = MUTATION_TYPES[mutationKey];

            const mutatedOneIn = Math.floor(shark.oneIn * mutation.oneInMult);

            const mutatedKey = `${shark.name} (${mutation.name})`;

            player.collection[mutatedKey] = {
                tier: tierNameFromOneIn(mutatedOneIn),
                oneIn: mutatedOneIn,
                firstRoll: player.rolls,
                count: 1,
                mutation: mutationKey,
                baseName: shark.name
            };
        }
    }

    persistPlayerState();
    renderCollectionGrid();

    devLog("Gave all shark species + mutations");
    showToast("All sharks and mutations granted");

    return;
}
        if (cmd === "givecoins" || cmd === "coins" || cmd === "addcoins") {
            const amount = parseAmount(arg);
            if (!Number.isFinite(amount) || amount <= 0) {
                devLog("Usage: givecoins 50000  (supports 1k, 1m, 1b)");
                showToast("Invalid amount", "error");
                return;
            }
            player.coins += amount;
            persistPlayerState();
            devLog(`Added ${amount.toLocaleString()} coins`);
            showToast(`+${amount.toLocaleString()} coins`);
            return;
        }

        if (cmd === "maxcoins" || cmd === "rich") {
            player.coins = 999_999_999;
            persistPlayerState();
            devLog("Coins set to 999,999,999");
            showToast("Max coins granted");
            return;
        }

        if (cmd === "setcoins") {
            const amount = parseAmount(arg);
            if (!Number.isFinite(amount) || amount < 0) {
                devLog("Usage: setcoins 100000");
                showToast("Invalid amount", "error");
                return;
            }
            player.coins = amount;
            persistPlayerState();
            devLog(`Coins set to ${amount.toLocaleString()}`);
            showToast(`Coins set to ${amount.toLocaleString()}`);
            return;
        }

        if (cmd === "givepotion" || cmd === "potion") {
            const potionParts = arg.split(/\s+/);
            const type = potionParts[0]?.toLowerCase();
            const count = parseAmount(potionParts[1] || "1") || 1;
            if (!POTION_DEFS[type]) {
                devLog(`Types: ${Object.keys(POTION_DEFS).join(", ")}`);
                showToast("Unknown potion type", "error");
                return;
            }
            player.potions[type] = (player.potions[type] || 0) + count;
            persistPlayerState();
            devLog(`Gave ${count}\u00d7 ${type} potion(s)`);
            showToast(`+${count} ${POTION_DEFS[type].name}`);
            return;
        }

        if (cmd === "reset" || cmd === "resetrng") {
            player = createDefaultPlayer();
            rollLockedUntil = 0;
            setAutoRoll(false);
            persistPlayerState();
            devLog("RNG profile reset");
            showToast("Profile reset");
            return;
        }

        devLog(`Unknown: ${cmd} \u2014 type 'help'`);
        showToast("Unknown command", "error");
    }

    function toggleDevPanel(forceOpen) {
        const panel = document.getElementById("rng-dev-panel");
        if (!panel) return;
        const open = forceOpen !== undefined ? forceOpen : panel.classList.contains("hidden");
        panel.classList.toggle("hidden", !open);
        if (open) document.getElementById("rng-dev-input")?.focus();
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

    function bindUi() {
        document.getElementById("rng-roll-btn")?.addEventListener("click", performRoll);
        document.getElementById("rng-auto-btn")?.addEventListener("click", () => setAutoRoll(!autoEnabled));
        document.getElementById("rng-hide-btn")?.addEventListener("click", () => setHideRoll(!hideEnabled));
        document.getElementById("rng-collection-open-btn")?.addEventListener("click", openCollectionModal);
        document.getElementById("rng-collection-close-btn")?.addEventListener("click", closeCollectionModal);
        document.getElementById("rng-collection-filter")?.addEventListener("change", renderCollectionGrid);
        document.getElementById("rng-collection-search")?.addEventListener("input", renderCollectionGrid);
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

        document.getElementById("rng-dev-toggle")?.addEventListener("click", () => toggleDevPanel());
        document.getElementById("rng-dev-close")?.addEventListener("click", () => toggleDevPanel(false));
        document.getElementById("rng-dev-run")?.addEventListener("click", () => {
            const input = document.getElementById("rng-dev-input");
            if (input?.value) {
                runDevCommand(input.value);
                input.value = "";
            }
        });
        document.getElementById("rng-dev-input")?.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                runDevCommand(event.target.value);
                event.target.value = "";
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "`" && !event.target.matches("input, textarea")) {
                event.preventDefault();
                toggleDevPanel();
            }
            if (event.key === "Escape") {
                if (document.getElementById("rng-cutscene")?.classList.contains("visible")) {
                    closeUltraCutscene();
                } else if (!document.getElementById("rng-settings-modal")?.classList.contains("hidden")) {
                    closeSettingsModal();
                }
            }
        });
    }

    function startPotionUiTicker() {
        if (potionTickTimer) clearInterval(potionTickTimer);
        potionTickTimer = setInterval(updateActiveEffectsUi, 500);
    }

    async function initRngMode() {
        buildRollPool();
        loadLocalProfile();
        initAmbientBubbles();
        bindUi();
        updateAllUi();
        updateSettingsUi();
        initRngLeaderboard();
        startPotionUiTicker();
        GameFx.initAudio();
    }

    window.initRngMode = initRngMode;
})();
