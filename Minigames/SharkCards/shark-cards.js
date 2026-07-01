(function () {
    "use strict";

    const SAVE_KEY = "sharkCardsProfileV1";
    const IMAGE_CACHE_KEY = "sharkCardsSpeciesImageCacheV4";
    const WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php";
    const BASE_DECK_MAX = 12;
    const BASE_HAND_SIZE = 4;
    const BASE_ENERGY = 3;
    const BASE_PLAYER_HULL = 190;
    const BASE_ENEMY_HAND_SIZE = 3;
    const IMAGE_CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 30;

    const FALLBACK_SHARKS = [
        { name: "Blacktip Shark", family: "Carcharhinidae", order: "Carcharhiniformes", genus: "Carcharhinus", size: "Medium", depth: "Epipelagic", yod: 1839, OneIn: 87 },
        { name: "White Shark", family: "Lamnidae", order: "Lamniformes", genus: "Carcharodon", size: "Large", depth: "Epipelagic", yod: 1758, OneIn: 6000 },
        { name: "Whale Shark", family: "Rhincodontidae", order: "Orectolobiformes", genus: "Rhincodon", size: "Giant", depth: "Epipelagic", yod: 1828, OneIn: 82 },
        { name: "Goblin Shark", family: "Mitsukurinidae", order: "Lamniformes", genus: "Mitsukurina", size: "Large", depth: "Bathypelagic", yod: 1898, OneIn: 56 }
    ];

    const STARTER_NAMES = [
        "Blacktip Shark",
        "Grey Reef Shark",
        "Whitetip Reef Shark",
        "Short-fin Mako",
        "Lemon Shark",
        "White Shark",
        "Tiger Shark",
        "Whale Shark"
    ];

    const RARITIES = [
        { name: "Common", className: "rarity-common", maxOneIn: 150, packWeight: 46 },
        { name: "Uncommon", className: "rarity-uncommon", maxOneIn: 1000, packWeight: 25 },
        { name: "Rare", className: "rarity-rare", maxOneIn: 10000, packWeight: 14 },
        { name: "Epic", className: "rarity-epic", maxOneIn: 100000, packWeight: 7.5 },
        { name: "Legendary", className: "rarity-legendary", maxOneIn: 1000000, packWeight: 3.8 },
        { name: "Mythic", className: "rarity-mythic", maxOneIn: 10000000, packWeight: 2 },
        { name: "Ancient", className: "rarity-ancient", maxOneIn: 100000000, packWeight: 1.1 },
        { name: "Apex", className: "rarity-apex", maxOneIn: Infinity, packWeight: 0.6 }
    ];

    const SIZE_POWER = {
        Tiny: 2,
        Small: 4,
        Medium: 6,
        Large: 8,
        Giant: 11
    };

    const FALLBACK_ART_COLORS = {
        Carcharhiniformes: ["#35d7ff", "#0b5470"],
        Lamniformes: ["#ff6f61", "#62243a"],
        Orectolobiformes: ["#77e14d", "#245631"],
        Squaliformes: ["#b579ff", "#2f1f57"],
        Hexanchiformes: ["#ffc83d", "#61421a"],
        Heterodontiformes: ["#8fd4ff", "#243d60"],
        Pristiophoriformes: ["#ff5ec4", "#5b2049"],
        Squatiniformes: ["#ffffff", "#29434f"]
    };

    const WIKI_TITLE_ALIASES = {
        "White Shark": ["Great white shark"],
        "Short-fin Mako": ["Shortfin mako shark"],
        "Long-fin Mako": ["Longfin mako shark"],
        "Sharp Nose Seven Gill Shark": ["Sharpnose sevengill shark"],
        "Blunt Nose Six Gill Shark": ["Bluntnose sixgill shark"],
        "Big Eyed Six Gill Shark": ["Bigeye sixgill shark"],
        "Atlantic Big Eye Six Gill Shark": ["Atlantic sixgill shark"],
        "Broad Nose Seven Gill Shark": ["Broadnose sevengill shark"],
        "Smooth Tooth Blacktip Shark": ["Smoothtooth blacktip shark"],
        "Short-fin Smooth Lanternshark": ["Shortfin smooth lanternshark"],
        "Long-nose Pygmy Shark": ["Longnose pygmy shark"],
        "Small-eye Pygmy Shark": ["Smalleye pygmy shark"],
        "Small-eye Lanternshark": ["Smalleye lanternshark"],
        "Big-eye Sand Tiger Shark": ["Bigeye sand tiger shark"],
        "Smalleye Hammerhead": ["Smalleye hammerhead shark"]
    };

    const BOSSES = [
        { name: "Coral Bruiser", kicker: "Reef Rival", image: "images/home-v3/great-white.png", weakOrder: "Carcharhiniformes", color: "cyan" },
        { name: "Kelp Baron", kicker: "Tide Warden", image: "images/home-v3/whale.png", weakOrder: "Orectolobiformes", color: "lime" },
        { name: "Abyss Sprinter", kicker: "Deep Rival", image: "images/home-v3/mako.png", weakOrder: "Lamniformes", color: "violet" },
        { name: "Hammer Reef", kicker: "Boss Tide", image: "images/home-v3/hammerhead.png", weakOrder: "Squaliformes", color: "gold" },
        { name: "Storm Fin", kicker: "Apex Gate", image: "images/home-v3/tiger.png", weakOrder: "Hexanchiformes", color: "coral" }
    ];

    const UPGRADE_NODES = [
        { id: "reefContract", name: "Reef Contract", icon: "fa-anchor", branch: "Core", desc: "+12% card damage", costs: [75, 190, 420], x: 50, y: 80, color: "#35d7ff" },
        { id: "cardSmith", name: "Card Smith", icon: "fa-hammer", branch: "Deck", desc: "+7% card damage", costs: [120, 280, 620], prereq: ["reefContract"], x: 30, y: 220, color: "#b579ff" },
        { id: "baitBank", name: "Bait Bank", icon: "fa-coins", branch: "Loot", desc: "+15% fins", costs: [120, 300, 680, 1300], prereq: ["reefContract"], x: 50, y: 220, color: "#ffc83d" },
        { id: "deepScanner", name: "Deep Scanner", icon: "fa-satellite-dish", branch: "Luck", desc: "+10% pack luck", costs: [120, 290, 640], prereq: ["reefContract"], x: 70, y: 220, color: "#77e14d" },
        { id: "handSize", name: "Wide Hand", icon: "fa-hand", branch: "Deck", desc: "+1 hand card per level", costs: [260, 640], prereq: ["cardSmith"], x: 16, y: 360, color: "#b579ff" },
        { id: "deckHarbor", name: "Deck Harbor", icon: "fa-box-archive", branch: "Deck", desc: "+2 deck slots", costs: [230, 540, 1100], prereq: ["cardSmith"], x: 30, y: 360, color: "#b579ff" },
        { id: "biteTraining", name: "Bite Training", icon: "fa-burst", branch: "Battle", desc: "+10% card damage", costs: [230, 560, 1180, 2300], prereq: ["cardSmith", "baitBank"], x: 44, y: 360, color: "#ff6f61" },
        { id: "pearlDiver", name: "Pearl Diver", icon: "fa-gem", branch: "Loot", desc: "+1 boss pearl chance", costs: [520, 980, 1700], prereq: ["baitBank"], x: 58, y: 360, color: "#ffc83d" },
        { id: "rarityRadar", name: "Rarity Radar", icon: "fa-clover", branch: "Luck", desc: "+16% pack luck", costs: [260, 620, 1250, 2500], prereq: ["deepScanner"], x: 72, y: 360, color: "#77e14d" },
        { id: "energyCore", name: "Energy Core", icon: "fa-bolt", branch: "Utility", desc: "+1 energy", costs: [300, 840], prereq: ["deepScanner"], x: 86, y: 360, color: "#35d7ff" },
        { id: "quickDraw", name: "Quick Draw", icon: "fa-shuffle", branch: "Deck", desc: "+1 hand at level 2", costs: [720, 1400, 2600], prereq: ["handSize"], x: 14, y: 520, color: "#b579ff" },
        { id: "packFurnace", name: "Pack Furnace", icon: "fa-box-open", branch: "Deck", desc: "+1 pack card", costs: [650, 1350, 2900], prereq: ["deckHarbor"], x: 28, y: 520, color: "#b579ff" },
        { id: "comboChain", name: "Combo Chain", icon: "fa-link", branch: "Battle", desc: "Stronger order combos", costs: [720, 1500, 3200], prereq: ["biteTraining"], x: 42, y: 520, color: "#ff6f61" },
        { id: "treasureWake", name: "Treasure Wake", icon: "fa-sack-dollar", branch: "Loot", desc: "+18% fins", costs: [780, 1600, 3400], prereq: ["pearlDiver"], x: 56, y: 520, color: "#ffc83d" },
        { id: "deepLure", name: "Deep Lure", icon: "fa-magnet", branch: "Luck", desc: "+22% pack luck", costs: [840, 1720, 3600], prereq: ["rarityRadar"], x: 70, y: 520, color: "#77e14d" },
        { id: "tideBattery", name: "Tide Battery", icon: "fa-car-battery", branch: "Utility", desc: "+1 energy", costs: [920, 1900], prereq: ["energyCore"], x: 84, y: 520, color: "#35d7ff" },
        { id: "captainCrew", name: "Captain Crew", icon: "fa-users", branch: "Deck", desc: "+3 deck slots", costs: [1800, 3600, 7200], prereq: ["quickDraw", "packFurnace"], x: 20, y: 680, color: "#b579ff" },
        { id: "frenzyDraw", name: "Frenzy Draw", icon: "fa-forward-fast", branch: "Battle", desc: "+8% damage and hand", costs: [2100, 4300], prereq: ["comboChain", "quickDraw"], x: 38, y: 680, color: "#ff6f61" },
        { id: "marketSurge", name: "Market Surge", icon: "fa-chart-line", branch: "Loot", desc: "+24% fins", costs: [2200, 4600, 9000], prereq: ["treasureWake"], x: 56, y: 680, color: "#ffc83d" },
        { id: "abyssGate", name: "Abyss Gate", icon: "fa-door-open", branch: "Luck", desc: "+35% pack luck", costs: [2400, 5000, 9800], prereq: ["deepLure", "tideBattery"], x: 74, y: 680, color: "#77e14d" },
        { id: "bossTracker", name: "Boss Tracker", icon: "fa-crosshairs", branch: "Utility", desc: "+20% tide rewards", costs: [2600, 5400], prereq: ["tideBattery"], x: 88, y: 680, color: "#35d7ff" },
        { id: "legendaryBait", name: "Legendary Bait", icon: "fa-crown", branch: "Deck", desc: "Rarer packs", costs: [2, 4, 7], currency: "pearls", prereq: ["captainCrew", "frenzyDraw"], x: 29, y: 840, color: "#ff5ec4" },
        { id: "stormSurge", name: "Storm Surge", icon: "fa-cloud-bolt", branch: "Battle", desc: "+18% card damage", costs: [2, 5, 9], currency: "pearls", prereq: ["frenzyDraw", "marketSurge"], x: 50, y: 840, color: "#ff6f61" },
        { id: "apexCompass", name: "Apex Compass", icon: "fa-compass", branch: "Luck", desc: "+55% pack luck", costs: [3, 6, 10], currency: "pearls", prereq: ["marketSurge", "abyssGate"], x: 71, y: 840, color: "#77e14d" },
        { id: "megamouthVault", name: "Megamouth Vault", icon: "fa-vault", branch: "Loot", desc: "+40% fins and pearls", costs: [7, 12], currency: "pearls", prereq: ["legendaryBait", "stormSurge"], x: 39, y: 1000, color: "#ffc83d" },
        { id: "megalodonDream", name: "Megalodon Dream", icon: "fa-star", branch: "Apex", desc: "Huge damage and luck", costs: [9, 16, 28], currency: "pearls", prereq: ["stormSurge", "apexCompass"], x: 61, y: 1000, color: "#ffffff" }
    ];

    const rawSharks = (typeof sharks !== "undefined" && Array.isArray(sharks)) ? sharks : FALLBACK_SHARKS;
    const SHARK_POOL = rawSharks
        .filter((shark) => shark && shark.name)
        .map((shark, index) => ({
            ...shark,
            id: slugify(shark.name) || `shark-${index}`
        }));

    const SHARK_BY_ID = new Map(SHARK_POOL.map((shark) => [shark.id, shark]));
    const SHARK_BY_NAME = new Map(SHARK_POOL.map((shark) => [shark.name.toLowerCase(), shark]));
    const UPGRADE_BY_ID = new Map(UPGRADE_NODES.map((node) => [node.id, node]));

    let profile = null;
    let battle = null;
    let activeView = "battle";
    let toastTimer = 0;
    let speciesArtCache = {};
    const pendingArtFetches = new Map();
    const sessionArtMisses = new Set();

    function initSharkCards() {
        speciesArtCache = loadSpeciesArtCache();
        profile = loadProfile();
        battle = createBattle();
        bindEvents();
        renderAll();
        hydrateVisibleSpeciesArt();
        addLog("Apex Deck online. Tide " + profile.tide + " is waiting.");
    }

    function bindEvents() {
        document.querySelectorAll("[data-sc-view]").forEach((button) => {
            button.addEventListener("click", () => showView(button.dataset.scView));
        });

        byId("sc-draw-btn")?.addEventListener("click", drawNewHand);
        byId("sc-pack-btn")?.addEventListener("click", openPack);
        byId("sc-next-btn")?.addEventListener("click", nextTide);
        byId("sc-clear-log-btn")?.addEventListener("click", () => {
            profile.log = [];
            saveProfile();
            renderLog();
        });
        byId("sc-pack-close-btn")?.addEventListener("click", closePackModal);
        byId("sc-pack-modal")?.addEventListener("click", (event) => {
            if (event.target.id === "sc-pack-modal") closePackModal();
        });
        byId("sc-settings-btn")?.addEventListener("click", () => byId("sc-settings-modal")?.classList.remove("hidden"));
        byId("sc-settings-close-btn")?.addEventListener("click", () => byId("sc-settings-modal")?.classList.add("hidden"));
        byId("sc-settings-modal")?.addEventListener("click", (event) => {
            if (event.target.id === "sc-settings-modal") byId("sc-settings-modal")?.classList.add("hidden");
        });
        byId("sc-reset-btn")?.addEventListener("click", resetProgress);
        byId("sc-collection-filter")?.addEventListener("change", renderDeckView);
        byId("sc-collection-search")?.addEventListener("input", renderDeckView);
        byId("sc-upgrade-tree")?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-upgrade-id]");
            if (button) buyUpgrade(button.dataset.upgradeId);
        });
        byId("sc-hand")?.addEventListener("click", (event) => {
            const card = event.target.closest("[data-card-id]");
            if (card) playCard(card.dataset.cardId);
        });
        byId("sc-active-deck")?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-remove-card]");
            if (button) removeFromDeck(button.dataset.removeCard);
        });
        byId("sc-collection-grid")?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-toggle-card]");
            if (button) toggleDeckCard(button.dataset.toggleCard);
        });
    }

    function loadProfile() {
        try {
            const stored = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
            return normalizeProfile(stored);
        } catch (error) {
            return normalizeProfile(null);
        }
    }

    function normalizeProfile(stored) {
        const fresh = !stored || typeof stored !== "object";
        const next = {
            fins: fresh ? 280 : Math.max(0, Number(stored.fins) || 0),
            pearls: fresh ? 0 : Math.max(0, Number(stored.pearls) || 0),
            xp: fresh ? 0 : Math.max(0, Number(stored.xp) || 0),
            tide: fresh ? 1 : Math.max(1, Number(stored.tide) || 1),
            streak: fresh ? 0 : Math.max(0, Number(stored.streak) || 0),
            bestTide: fresh ? 1 : Math.max(1, Number(stored.bestTide) || 1),
            collection: stored && typeof stored.collection === "object" ? stored.collection : {},
            deck: Array.isArray(stored?.deck) ? stored.deck.filter((id) => SHARK_BY_ID.has(id)) : [],
            upgrades: stored && typeof stored.upgrades === "object" ? stored.upgrades : {},
            log: Array.isArray(stored?.log) ? stored.log.slice(0, 18) : []
        };

        next.upgrades = Object.fromEntries(Object.entries(next.upgrades)
            .filter(([id]) => UPGRADE_BY_ID.has(id))
            .map(([id, level]) => [id, clamp(Number(level) || 0, 0, UPGRADE_BY_ID.get(id).costs.length)]));

        if (Object.keys(next.collection).length === 0 || next.deck.length < 4) {
            STARTER_NAMES.forEach((name) => {
                const shark = SHARK_BY_NAME.get(name.toLowerCase());
                if (shark) grantCard(next, shark.id, 1, true);
            });
        }

        if (next.deck.length < 4) {
            SHARK_POOL.slice(0, 8).forEach((shark) => grantCard(next, shark.id, 1, true));
        }

        next.deck = [...new Set(next.deck)].filter((id) => next.collection[id] && SHARK_BY_ID.has(id)).slice(0, getDeckMax(next));
        saveProfile(next);
        return next;
    }

    function saveProfile(source = profile) {
        if (!source) return;
        localStorage.setItem(SAVE_KEY, JSON.stringify(source));
    }

    function createBattle() {
        const boss = BOSSES[(profile.tide - 1) % BOSSES.length];
        const scale = Math.pow(profile.tide, 1.12);
        const maxHp = Math.round(62 + profile.tide * 16 + scale * 7);
        const enemyDeck = createEnemyDeck(boss);
        const enemyLeaderId = enemyDeck[0] || SHARK_POOL[0].id;
        const maxHull = getPlayerMaxHull();
        return {
            boss,
            enemyDeck,
            enemyLeaderId,
            enemyHand: drawFromSource(enemyDeck, getEnemyHandSize()),
            maxHp,
            hp: maxHp,
            maxHull,
            hull: maxHull,
            maxEnergy: getMaxEnergy(),
            energy: getMaxEnergy(),
            hand: drawCards(getHandSize()),
            comboKey: "",
            comboCount: 0,
            won: false,
            lost: false,
            busy: false,
            lastCard: null,
            lastEnemyCard: null,
            turnMessage: "Your move"
        };
    }

    function showView(view) {
        activeView = view;
        document.querySelectorAll("[data-sc-view]").forEach((button) => {
            button.classList.toggle("active", button.dataset.scView === view);
        });
        document.querySelectorAll("[data-sc-panel]").forEach((panel) => {
            const active = panel.dataset.scPanel === view;
            panel.classList.toggle("active", active);
            panel.hidden = !active;
        });
        if (view === "upgrades") renderUpgradeTree();
        if (view === "deck") renderDeckView();
    }

    async function playCard(cardId) {
        if (battle.busy) return;
        if (battle.won) {
            showToast("The tide is already cleared.");
            return;
        }
        if (battle.lost) {
            showToast("Rally to retry this tide.");
            return;
        }
        if (battle.energy <= 0) {
            showToast("Draw a fresh hand to refill energy.");
            return;
        }
        if (!battle.hand.includes(cardId)) return;

        const shark = SHARK_BY_ID.get(cardId);
        if (!shark) return;

        const card = buildCard(cardId);
        const comboKey = card.order || card.depth || card.rarity.name;
        battle.comboCount = battle.comboKey === comboKey ? battle.comboCount + 1 : 1;
        battle.comboKey = comboKey;

        const weakness = battle.boss.weakOrder === card.order ? 1.28 : 1;
        const comboBonus = 1 + Math.max(0, battle.comboCount - 1) * (0.12 + upgradeLevel("comboChain") * 0.04);
        const damage = Math.max(1, Math.round(card.power * getDamageMultiplier() * comboBonus * weakness));
        const fins = Math.max(2, Math.round((damage * 1.15 + card.reward) * getCoinMultiplier()));

        battle.busy = true;
        battle.energy -= 1;
        battle.hand = battle.hand.filter((id) => id !== cardId);
        battle.hp = Math.max(0, battle.hp - damage);
        battle.lastCard = { cardId, damage, fins, weakness: weakness > 1, combo: battle.comboCount };
        battle.lastEnemyCard = null;
        battle.turnMessage = `${card.name} strikes`;

        profile.fins += fins;
        profile.xp += Math.ceil(damage * 0.38);
        addLog(`<strong>${escapeHtml(card.name)}</strong> hit for ${formatNumber(damage)} and found ${formatNumber(fins)} fins.`);
        renderAll();
        await animateCardStrike("player", card, damage);
        if (battle.hp <= 0) {
            winTide();
        } else {
            await enemyCounterattack();
        }

        battle.busy = false;
        saveProfile();
        renderAll();
    }

    function drawNewHand() {
        if (battle.busy) return;
        if (battle.lost) {
            battle = createBattle();
            profile.streak = 0;
            addLog("Crew rallied. The tide has restarted.");
            saveProfile();
            renderAll();
            return;
        }
        if (battle.won) {
            showToast("Advance to the next tide.");
            return;
        }
        battle.hand = drawCards(getHandSize());
        battle.energy = battle.maxEnergy;
        battle.comboKey = "";
        battle.comboCount = 0;
        battle.lastCard = null;
        battle.lastEnemyCard = null;
        battle.turnMessage = "Fresh hand";
        addLog("Fresh hand drawn.");
        renderAll();
    }

    function winTide() {
        battle.won = true;
        battle.turnMessage = "Tide cleared";
        const reward = Math.round((120 + profile.tide * 34 + upgradeLevel("bossTracker") * 42) * getCoinMultiplier() * (1 + upgradeLevel("bossTracker") * 0.1));
        const pearlReward = getPearlRewardForTide(profile.tide);
        profile.fins += reward;
        profile.pearls += pearlReward;
        profile.streak += 1;
        profile.bestTide = Math.max(profile.bestTide, profile.tide);
        profile.xp += 90 + profile.tide * 14;

        const pearlText = pearlReward ? ` and ${pearlReward} pearl${pearlReward === 1 ? "" : "s"}` : "";
        addLog(`<strong>Tide ${profile.tide} cleared.</strong> Reward: ${formatNumber(reward)} fins${pearlText}.`);
        showToast("Tide cleared. Rewards added.");
    }

    function nextTide() {
        if (battle.busy) return;
        if (!battle.won) {
            showToast("Clear the rival guard first.");
            return;
        }
        profile.tide += 1;
        saveProfile();
        battle = createBattle();
        addLog("Tide " + profile.tide + " opened.");
        renderAll();
    }

    async function openPack() {
        if (battle?.busy) return;
        const cost = getPackCost();
        if (profile.fins < cost) {
            showToast("Need " + formatNumber(cost) + " fins for a pack.");
            return;
        }

        profile.fins -= cost;
        const count = getPackCardCount();
        const results = [];
        for (let index = 0; index < count; index += 1) {
            const shark = rollPackShark();
            grantCard(profile, shark.id, 1, true);
            results.push(shark.id);
        }
        profile.xp += 35 * count;
        addLog("Pack opened with " + count + " shark cards.");
        saveProfile();
        renderAll();
        showPackResults(results);
        await animatePackOpen();
    }

    function buyUpgrade(id) {
        const node = UPGRADE_BY_ID.get(id);
        if (!node) return;
        const level = upgradeLevel(id);
        if (level >= node.costs.length) {
            showToast(node.name + " is maxed.");
            return;
        }
        if (!isUnlocked(node)) {
            showToast("Unlock the connected branch first.");
            return;
        }

        const cost = getUpgradeCost(node, level);
        if (!canAfford(cost)) {
            showToast("Need " + formatCost(cost) + ".");
            return;
        }

        spendCost(cost);
        profile.upgrades[id] = level + 1;
        battle.maxEnergy = getMaxEnergy();
        battle.energy = Math.min(battle.maxEnergy, battle.energy + 1);
        addLog(`<strong>${escapeHtml(node.name)}</strong> upgraded to level ${level + 1}.`);
        saveProfile();
        renderAll();
        showToast(node.name + " upgraded.");
    }

    function toggleDeckCard(cardId) {
        if (profile.deck.includes(cardId)) {
            removeFromDeck(cardId);
            return;
        }
        if (profile.deck.length >= getDeckMax()) {
            showToast("Deck slots are full.");
            return;
        }
        if (!profile.collection[cardId]) return;
        profile.deck.push(cardId);
        saveProfile();
        renderDeckView();
        renderHud();
    }

    function removeFromDeck(cardId) {
        if (profile.deck.length <= 4) {
            showToast("Keep at least four cards in the deck.");
            return;
        }
        profile.deck = profile.deck.filter((id) => id !== cardId);
        battle.hand = battle.hand.filter((id) => id !== cardId);
        if (battle.hand.length < Math.min(2, getHandSize())) {
            battle.hand = drawCards(getHandSize());
        }
        saveProfile();
        renderDeckView();
        renderBattle();
        renderHud();
    }

    function resetProgress() {
        if (!confirm("Reset Shark Cards progress?")) return;
        localStorage.removeItem(SAVE_KEY);
        profile = loadProfile();
        battle = createBattle();
        byId("sc-settings-modal")?.classList.add("hidden");
        renderAll();
        showToast("Shark Cards reset.");
    }

    function drawCards(count) {
        const deck = profile.deck.filter((id) => SHARK_BY_ID.has(id));
        const source = deck.length ? deck : SHARK_POOL.slice(0, 8).map((shark) => shark.id);
        return drawFromSource(source, count);
    }

    function drawFromSource(source, count) {
        const picked = [];
        const pool = shuffle(source);
        while (picked.length < count && (pool.length || source.length)) {
            if (!pool.length) pool.push(...shuffle(source));
            const id = pool.shift();
            if (source.length >= count && picked.includes(id)) continue;
            picked.push(id);
        }
        return picked.slice(0, count);
    }

    function createEnemyDeck(boss) {
        const desiredRarityIndex = Math.min(RARITIES.length - 1, Math.floor((profile.tide - 1) / 5));
        const weakOrderCards = SHARK_POOL
            .filter((shark) => shark.order === boss.weakOrder)
            .sort((a, b) => Math.abs(RARITIES.findIndex((entry) => entry.name === getRarity(a).name) - desiredRarityIndex)
                - Math.abs(RARITIES.findIndex((entry) => entry.name === getRarity(b).name) - desiredRarityIndex));
        const widerPool = SHARK_POOL
            .filter((shark) => RARITIES.findIndex((entry) => entry.name === getRarity(shark).name) <= desiredRarityIndex + 1)
            .sort((a, b) => (Number(a.OneIn) || 0) - (Number(b.OneIn) || 0));
        return [...new Set([...weakOrderCards.slice(0, 8), ...shuffle(widerPool).slice(0, 10)])]
            .map((shark) => shark.id)
            .slice(0, 14);
    }

    async function enemyCounterattack() {
        if (battle.lost || battle.won) return;
        if (!battle.enemyHand.length) {
            battle.enemyHand = drawFromSource(battle.enemyDeck, getEnemyHandSize());
        }

        const enemyCardId = chooseEnemyCard();
        if (!enemyCardId) return;
        const enemyCard = buildCard(enemyCardId);
        battle.enemyHand = battle.enemyHand.filter((id) => id !== enemyCardId);
        if (battle.enemyHand.length < getEnemyHandSize()) {
            const replacement = drawFromSource(battle.enemyDeck, 1)[0];
            if (replacement) battle.enemyHand.push(replacement);
        }

        const tidePressure = 0.58 + Math.min(1.05, profile.tide * 0.025);
        const weakness = enemyCard.order === battle.boss.weakOrder ? 1.18 : 1;
        const guardBonus = Math.max(0, getHandSize() - battle.hand.length) * 0.04;
        const damage = Math.max(2, Math.round(enemyCard.power * tidePressure * weakness * (1 + guardBonus)));

        battle.hull = Math.max(0, battle.hull - damage);
        battle.lastEnemyCard = { cardId: enemyCardId, damage };
        battle.turnMessage = `${enemyCard.name} counters`;
        addLog(`<strong>${escapeHtml(enemyCard.name)}</strong> countered for ${formatNumber(damage)} hull damage.`);
        renderAll();
        await animateCardStrike("enemy", enemyCard, damage);

        if (battle.hull <= 0) {
            loseTide();
        } else if (battle.energy <= 0 || battle.hand.length === 0) {
            battle.turnMessage = "Draw to continue";
        } else {
            battle.turnMessage = "Your move";
        }
    }

    function chooseEnemyCard() {
        return battle.enemyHand
            .map((id) => buildCard(id))
            .sort((a, b) => b.power - a.power)[0]?.id;
    }

    function loseTide() {
        battle.lost = true;
        battle.turnMessage = "Hull broken";
        profile.streak = 0;
        addLog("<strong>Hull broken.</strong> Rally your crew and retry the tide.");
        showToast("Hull broken. Rally to retry.");
    }

    function rollPackShark() {
        const luck = getLuckMultiplier() + upgradeLevel("legendaryBait") * 0.18;
        const weightedRarities = RARITIES.map((rarity, index) => {
            const rareBoost = index <= 1 ? 1 : Math.pow(luck, 0.35 + index * 0.08);
            return { rarity, weight: rarity.packWeight * rareBoost };
        });
        const selectedRarity = weightedPick(weightedRarities).rarity;
        const matching = SHARK_POOL.filter((shark) => getRarity(shark).name === selectedRarity.name);
        return matching[Math.floor(Math.random() * matching.length)] || SHARK_POOL[Math.floor(Math.random() * SHARK_POOL.length)];
    }

    function grantCard(targetProfile, cardId, amount = 1, addToDeck = false) {
        if (!SHARK_BY_ID.has(cardId)) return;
        const current = targetProfile.collection[cardId] || { owned: 0 };
        current.owned = Math.max(0, Number(current.owned) || 0) + amount;
        current.level = getCollectionLevel(current);
        targetProfile.collection[cardId] = current;
        if (addToDeck && !targetProfile.deck.includes(cardId) && targetProfile.deck.length < getDeckMax(targetProfile)) {
            targetProfile.deck.push(cardId);
        }
    }

    function renderAll() {
        renderHud();
        renderBattle();
        renderLog();
        renderUpgradeTree();
        renderDeckView();
    }

    function renderHud() {
        setText("sc-fins", formatNumber(profile.fins));
        setText("sc-pearls", formatNumber(profile.pearls));
        setText("sc-tree-fins", formatNumber(profile.fins));
        setText("sc-tree-pearls", formatNumber(profile.pearls));
        setText("sc-collection-count", `${Object.keys(profile.collection).length}/${SHARK_POOL.length}`);
        setText("sc-rank", "R" + getRank());
    }

    function renderBattle() {
        if (!battle) return;
        setText("sc-tide-label", profile.tide);
        setText("sc-streak", profile.streak);
        setText("sc-boss-kicker", battle.boss.kicker);
        setText("sc-boss-name", battle.boss.name);
        setText("sc-boss-health", `${formatNumber(battle.hp)} / ${formatNumber(battle.maxHp)} Guard`);
        setText("sc-boss-reward", formatNumber(Math.round((120 + profile.tide * 34) * getCoinMultiplier())));
        setText("sc-player-hull", `${formatNumber(battle.hull)} / ${formatNumber(battle.maxHull)}`);
        setText("sc-damage-mult", "x" + getDamageMultiplier().toFixed(2));
        setText("sc-luck-mult", "x" + getLuckMultiplier().toFixed(2));
        setText("sc-coin-mult", "x" + getCoinMultiplier().toFixed(2));
        setText("sc-hand-size", getHandSize());
        setText("sc-run-name", getRunName());
        setText("sc-turn-banner", battle.turnMessage || "Your move");

        const enemyLeader = buildCard(battle.enemyLeaderId);
        const bossImage = byId("sc-boss-img");
        if (bossImage) {
            bossImage.setAttribute("src", enemyLeader.art);
            bossImage.setAttribute("data-species-image", enemyLeader.id);
            bossImage.setAttribute("alt", enemyLeader.name);
        }

        const healthFill = byId("sc-boss-health-fill");
        if (healthFill) healthFill.style.width = `${Math.max(0, (battle.hp / battle.maxHp) * 100)}%`;
        const hullFill = byId("sc-player-hull-fill");
        if (hullFill) hullFill.style.width = `${Math.max(0, (battle.hull / battle.maxHull) * 100)}%`;

        const energy = byId("sc-energy");
        if (energy) {
            energy.innerHTML = Array.from({ length: battle.maxEnergy }, (_, index) =>
                `<span class="sc-energy-pip${index < battle.energy ? " active" : ""}"></span>`
            ).join("");
        }

        const hand = byId("sc-hand");
        if (hand) {
            hand.innerHTML = battle.hand.map((cardId) => renderCard(buildCard(cardId), {
                tag: "button",
                interactive: true,
                disabled: battle.energy <= 0 || battle.won || battle.lost || battle.busy
            })).join("");
        }

        const enemyHand = byId("sc-enemy-hand");
        if (enemyHand) {
            enemyHand.innerHTML = battle.enemyHand.map((cardId) => renderEnemyCard(buildCard(cardId))).join("");
        }

        const playZone = byId("sc-play-zone");
        if (playZone) {
            if (battle.lastEnemyCard) {
                const enemyCard = buildCard(battle.lastEnemyCard.cardId);
                playZone.innerHTML = `
                    <div class="sc-play-placeholder">
                        <i class="fa-solid fa-shield-halved"></i>
                        <span>${escapeHtml(enemyCard.name)} countered for ${formatNumber(battle.lastEnemyCard.damage)}</span>
                    </div>
                `;
            } else if (battle.lastCard) {
                const card = buildCard(battle.lastCard.cardId);
                playZone.innerHTML = `
                    <div class="sc-play-placeholder">
                        <i class="fa-solid fa-burst"></i>
                        <span>${escapeHtml(card.name)}: ${formatNumber(battle.lastCard.damage)} damage ${battle.lastCard.combo > 1 ? "x" + battle.lastCard.combo + " combo" : ""}</span>
                    </div>
                `;
            } else {
                playZone.innerHTML = `
                    <div class="sc-play-placeholder">
                        <i class="fa-solid fa-burst"></i>
                        <span id="sc-combo-label">${battle.comboCount > 1 ? "x" + battle.comboCount + " combo" : "No combo"}</span>
                    </div>
                `;
            }
        }

        const nextButton = byId("sc-next-btn");
        if (nextButton) nextButton.disabled = !battle.won || battle.busy;
        const drawButton = byId("sc-draw-btn");
        if (drawButton) {
            drawButton.disabled = battle.won || battle.busy;
            const label = drawButton.querySelector("span");
            if (label) label.textContent = battle.lost ? "Rally" : "Draw";
        }
        const packButton = byId("sc-pack-btn");
        if (packButton) {
            packButton.querySelector("span").textContent = "Pack " + formatNumber(getPackCost());
            packButton.disabled = battle.busy;
        }
        hydrateVisibleSpeciesArt();
    }

    function renderLog() {
        const log = byId("sc-log");
        if (!log) return;
        log.innerHTML = (profile.log || []).map((entry) => `<div class="sc-log-entry">${entry}</div>`).join("");
        log.scrollTop = 0;
    }

    function renderUpgradeTree() {
        const tree = byId("sc-upgrade-tree");
        const links = byId("sc-tree-links");
        if (!tree || !links) return;

        const activeCount = Object.values(profile.upgrades).reduce((sum, level) => sum + (Number(level) || 0), 0);
        setText("sc-tree-summary", `${activeCount} branches active`);

        links.setAttribute("viewBox", "0 0 1000 1160");
        links.innerHTML = UPGRADE_NODES.flatMap((node) => {
            return (node.prereq || []).map((parentId) => {
                const parent = UPGRADE_BY_ID.get(parentId);
                if (!parent) return "";
                const active = upgradeLevel(parentId) > 0;
                return `<line class="${active ? "active" : ""}" style="--line-color:${node.color}" x1="${parent.x * 10}" y1="${parent.y}" x2="${node.x * 10}" y2="${node.y}"></line>`;
            });
        }).join("");

        tree.innerHTML = UPGRADE_NODES.map((node) => {
            const level = upgradeLevel(node.id);
            const maxed = level >= node.costs.length;
            const unlocked = isUnlocked(node);
            const cost = maxed ? null : getUpgradeCost(node, level);
            const affordable = cost ? canAfford(cost) : false;
            const className = [
                "sc-upgrade-node",
                maxed ? "maxed" : "",
                !unlocked ? "locked" : "",
                affordable ? "affordable" : ""
            ].filter(Boolean).join(" ");
            const progress = Math.round((level / node.costs.length) * 100);
            const costLabel = maxed ? "MAX" : unlocked ? formatCost(cost) : "LOCKED";
            return `
                <button class="${className}" type="button" data-upgrade-id="${node.id}" style="--x:${node.x}%; --y:${node.y}px; --node:${node.color}" title="${escapeAttr(node.desc)}">
                    <span class="sc-upgrade-inner">
                        <span class="sc-upgrade-icon"><i class="fa-solid ${node.icon}"></i></span>
                        <span class="sc-upgrade-copy">
                            <strong>${escapeHtml(node.name)}</strong>
                            <span>${escapeHtml(node.branch)} ${level}/${node.costs.length}</span>
                        </span>
                        <span class="sc-upgrade-track"><span style="width:${progress}%"></span></span>
                        <span class="sc-upgrade-cost"><span>${escapeHtml(node.desc)}</span><b>${costLabel}</b></span>
                    </span>
                </button>
            `;
        }).join("");
    }

    function renderDeckView() {
        const deck = byId("sc-active-deck");
        const collection = byId("sc-collection-grid");
        setText("sc-deck-count", `${profile.deck.length}/${getDeckMax()}`);

        if (deck) {
            deck.innerHTML = profile.deck.map((cardId) => {
                const card = buildCard(cardId);
                return `
                    <article class="sc-deck-row">
                        <img src="${card.art}" data-species-image="${card.id}" alt="${escapeAttr(card.name)}">
                        <div>
                            <strong>${escapeHtml(card.name)}</strong>
                            <span>${card.rarity.name} Lv.${card.level} P${card.power}</span>
                        </div>
                        <button type="button" data-remove-card="${card.id}" title="Remove ${escapeAttr(card.name)}" aria-label="Remove ${escapeAttr(card.name)}">
                            <i class="fa-solid fa-minus"></i>
                        </button>
                    </article>
                `;
            }).join("");
        }

        if (collection) {
            const filter = byId("sc-collection-filter")?.value || "all";
            const search = (byId("sc-collection-search")?.value || "").trim().toLowerCase();
            const cards = Object.keys(profile.collection)
                .filter((id) => SHARK_BY_ID.has(id))
                .map((id) => buildCard(id))
                .filter((card) => filter === "all" || card.rarity.name === filter)
                .filter((card) => !search || card.name.toLowerCase().includes(search))
                .sort((a, b) => b.power - a.power || a.name.localeCompare(b.name));

            collection.innerHTML = cards.map((card) => {
                const inDeck = profile.deck.includes(card.id);
                const disabled = !inDeck && profile.deck.length >= getDeckMax();
                return `
                    <article class="sc-collection-card ${card.rarity.className}" style="--rarity:${card.rarityColor}">
                        <h3>${escapeHtml(card.name)}</h3>
                        <img src="${card.art}" data-species-image="${card.id}" alt="${escapeAttr(card.name)}">
                        <p>${card.rarity.name} / ${escapeHtml(card.order)} / Lv.${card.level}</p>
                        <button type="button" data-toggle-card="${card.id}" ${disabled ? "disabled" : ""}>
                            ${inDeck ? "Remove" : "Add"}
                        </button>
                    </article>
                `;
            }).join("");
        }
        hydrateVisibleSpeciesArt();
    }

    function showPackResults(cardIds) {
        const results = byId("sc-pack-results");
        if (results) {
            results.innerHTML = cardIds.map((id, index) => renderCard(buildCard(id), {
                tag: "article",
                interactive: false,
                revealDelay: index * 95
            })).join("");
        }
        byId("sc-pack-modal")?.classList.remove("hidden");
        hydrateVisibleSpeciesArt();
    }

    function closePackModal() {
        byId("sc-pack-modal")?.classList.add("hidden");
    }

    function buildCard(cardId) {
        const shark = SHARK_BY_ID.get(cardId) || SHARK_POOL[0];
        const rarity = getRarity(shark);
        const collection = profile?.collection?.[cardId] || { owned: 1 };
        const level = getCollectionLevel(collection);
        const oneIn = Math.max(1, Number(shark.OneIn) || 1);
        const rarityPower = Math.min(18, Math.floor(Math.log10(oneIn + 10) * 2.2));
        const yearPower = shark.yod && shark.yod < 1850 ? 2 : 0;
        const power = Math.max(1, Math.round((SIZE_POWER[shark.size] || 5) + rarityPower + yearPower + (level - 1) * 2));
        return {
            id: cardId,
            name: shark.name,
            family: shark.family || "Unknown",
            order: shark.order || "Unknown",
            genus: shark.genus || "Unknown",
            depth: shark.depth || "Open Ocean",
            size: shark.size || "Medium",
            yod: shark.yod || "",
            oneIn,
            rarity,
            rarityColor: getRarityColor(rarity.name),
            level,
            power,
            reward: Math.max(2, Math.round(power * (1 + RARITIES.findIndex((entry) => entry.name === rarity.name) * 0.18))),
            art: getSpeciesArt(shark)
        };
    }

    function renderCard(card, options = {}) {
        const tag = options.tag || "article";
        const disabled = options.disabled ? " disabled" : "";
        const disabledAttr = options.disabled ? "disabled" : "";
        const data = options.interactive ? ` data-card-id="${card.id}"` : "";
        const style = `--rarity:${card.rarityColor}${Number.isFinite(options.revealDelay) ? `; --reveal-delay:${options.revealDelay}ms` : ""}`;
        return `
            <${tag} class="sc-shark-card ${card.rarity.className}${disabled}" style="${style}"${data} ${disabledAttr}>
                <span class="sc-card-head">
                    <span class="sc-card-name">
                        <span class="sc-card-kicker">${card.rarity.name} / Lv.${card.level}</span>
                        <strong>${escapeHtml(card.name)}</strong>
                    </span>
                    <span class="sc-card-power">${card.power}</span>
                </span>
                <span class="sc-card-art"><img src="${card.art}" data-species-image="${card.id}" alt="${escapeAttr(card.name)}"></span>
                <span class="sc-card-foot">
                    <span>${escapeHtml(card.size)}</span>
                    <span>${escapeHtml(card.depth)}</span>
                    <span>1/${formatNumber(card.oneIn)}</span>
                </span>
            </${tag}>
        `;
    }

    function renderEnemyCard(card) {
        return `
            <article class="sc-enemy-card ${card.rarity.className}" style="--rarity:${card.rarityColor}">
                <img src="${card.art}" data-species-image="${card.id}" alt="${escapeAttr(card.name)}">
                <div>
                    <strong>${escapeHtml(card.name)}</strong>
                    <span>${card.rarity.name}</span>
                </div>
                <b>${card.power}</b>
            </article>
        `;
    }

    function getSpeciesArt(shark) {
        const entry = speciesArtCache[shark.id];
        if (entry?.url && Date.now() - (entry.checkedAt || 0) < IMAGE_CACHE_MAX_AGE) {
            return entry.url;
        }
        return createFallbackSpeciesArt(shark);
    }

    function hydrateVisibleSpeciesArt() {
        window.requestAnimationFrame(() => {
            const visibleImages = [...document.querySelectorAll("[data-species-image]")]
                .filter((img) => img.getClientRects().length > 0)
                .slice(0, 36);
            visibleImages.forEach((img) => requestSpeciesArt(img.dataset.speciesImage));
        });
    }

    function requestSpeciesArt(cardId) {
        if (!cardId || pendingArtFetches.has(cardId)) return;
        const shark = SHARK_BY_ID.get(cardId);
        if (!shark) return;
        const cached = speciesArtCache[cardId];
        if (cached?.url) {
            applySpeciesArt(cardId, cached);
            return;
        }
        if (sessionArtMisses.has(cardId)) return;

        const request = fetchSpeciesArt(shark)
            .then((entry) => {
                if (entry?.url) {
                    speciesArtCache[cardId] = entry;
                    saveSpeciesArtCache();
                    applySpeciesArt(cardId, entry);
                } else {
                    sessionArtMisses.add(cardId);
                }
            })
            .catch(() => {
                sessionArtMisses.add(cardId);
            })
            .finally(() => pendingArtFetches.delete(cardId));
        pendingArtFetches.set(cardId, request);
    }

    async function fetchSpeciesArt(shark) {
        const url = new URL(WIKIPEDIA_API_URL);
        url.searchParams.set("action", "query");
        url.searchParams.set("titles", getWikiTitleCandidates(shark).join("|"));
        url.searchParams.set("redirects", "1");
        url.searchParams.set("prop", "pageimages|info");
        url.searchParams.set("piprop", "thumbnail|original");
        url.searchParams.set("pithumbsize", "520");
        url.searchParams.set("inprop", "url");
        url.searchParams.set("format", "json");

        const data = await loadJsonp(url);
        const pages = Object.values(data?.query?.pages || {})
            .filter((page) => !page.missing && (page?.thumbnail?.source || page?.original?.source))
            .filter((page) => isLikelySpeciesPage(page.title, shark));
        if (!pages.length) return null;
        const page = pages[0];
        const imageUrl = page.thumbnail?.source || page.original?.source;
        if (!imageUrl) return null;
        return {
            url: imageUrl,
            pageTitle: page.title,
            source: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`,
            checkedAt: Date.now()
        };
    }

    function loadJsonp(url) {
        return new Promise((resolve, reject) => {
            const callbackName = `__sharkCardsWiki${Date.now()}${Math.floor(Math.random() * 100000)}`;
            const script = document.createElement("script");
            const timeout = window.setTimeout(() => {
                cleanup();
                reject(new Error("Wikimedia image lookup timed out"));
            }, 10000);

            function cleanup() {
                window.clearTimeout(timeout);
                delete window[callbackName];
                script.remove();
            }

            window[callbackName] = (data) => {
                cleanup();
                resolve(data);
            };

            url.searchParams.set("callback", callbackName);
            script.src = url.toString();
            script.async = true;
            script.onerror = () => {
                cleanup();
                reject(new Error("Wikimedia image lookup failed"));
            };
            document.head.appendChild(script);
        });
    }

    function getWikiTitleCandidates(shark) {
        const aliases = WIKI_TITLE_ALIASES[shark.name] || [];
        const genericLower = lowerGenericSpeciesWords(shark.name);
        const articleCase = toCommonNameArticleCase(shark.name);
        return [...new Set([
            ...aliases,
            shark.name,
            genericLower,
            articleCase
        ].filter(Boolean))];
    }

    function lowerGenericSpeciesWords(name) {
        const genericWords = [
            "Shark", "Dogfish", "Catshark", "Lanternshark", "Hammerhead", "Sawshark",
            "Tope", "Roughshark", "Wobbegong", "Nursehound", "Angelshark", "Gulper",
            "Swellshark", "Houndshark", "Smoothhound", "Smooth-hound", "Sleeper",
            "Skate", "Ray"
        ];
        return genericWords.reduce((title, word) => {
            const pattern = new RegExp(`\\b${word}\\b`, "g");
            return title.replace(pattern, word.toLowerCase());
        }, name);
    }

    function toCommonNameArticleCase(name) {
        const keepCapitalized = new Set([
            "African", "American", "Arabian", "Atlantic", "Australian", "Bahamas", "Bali",
            "Borneo", "Brazilian", "California", "Caribbean", "Chinese", "Galapagos",
            "Greenland", "Hawaiian", "Indian", "Indonesian", "Japanese", "Java",
            "Madagascar", "Mediterranean", "Mexican", "New", "Pacific", "Papuan",
            "Philippine", "Seychelles", "Southern", "Tasmanian", "West", "Western",
            "Zealand"
        ]);
        return name.split(" ").map((word, index) => {
            if (index === 0 || keepCapitalized.has(word.replace(/[^A-Za-z-]/g, ""))) return word;
            return word.toLowerCase();
        }).join(" ");
    }

    function isLikelySpeciesPage(title, shark) {
        const normalizedTitle = normalizeWikiTitle(title);
        return getWikiTitleCandidates(shark).some((candidate) => normalizeWikiTitle(candidate) === normalizedTitle);
    }

    function normalizeWikiTitle(title) {
        return String(title || "")
            .replace(/_/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    }

    function applySpeciesArt(cardId, entry) {
        document.querySelectorAll(`[data-species-image="${cardId}"]`).forEach((img) => {
            if (img.getAttribute("src") !== entry.url) {
                img.classList.add("loaded");
                img.setAttribute("src", entry.url);
            }
            if (entry.source) img.setAttribute("title", `Image from ${entry.source}`);
        });
    }

    function loadSpeciesArtCache() {
        try {
            const parsed = JSON.parse(localStorage.getItem(IMAGE_CACHE_KEY) || "{}");
            if (!parsed || typeof parsed !== "object") return {};
            return Object.fromEntries(Object.entries(parsed).filter(([, entry]) => {
                return entry?.url && Date.now() - (entry.checkedAt || 0) < IMAGE_CACHE_MAX_AGE;
            }));
        } catch (error) {
            return {};
        }
    }

    function saveSpeciesArtCache() {
        const entries = Object.entries(speciesArtCache).slice(-600);
        localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
    }

    function createFallbackSpeciesArt(shark) {
        const [start, end] = FALLBACK_ART_COLORS[shark.order] || ["#35d7ff", "#0b5470"];
        const initial = escapeHtml(String(shark.name || "?").trim().charAt(0).toUpperCase() || "?");
        const label = escapeHtml(shark.name || "Shark");
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 260">
                <defs>
                    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
                        <stop stop-color="${start}" offset="0"/>
                        <stop stop-color="${end}" offset="1"/>
                    </linearGradient>
                </defs>
                <rect width="420" height="260" fill="url(#g)"/>
                <path d="M62 150c72-72 188-77 290-18-52 58-190 75-290 18z" fill="rgba(255,255,255,.28)"/>
                <path d="M278 120l76-58-20 78 20 74-78-52z" fill="rgba(255,255,255,.34)"/>
                <circle cx="126" cy="131" r="8" fill="#061017"/>
                <text x="32" y="62" fill="rgba(255,255,255,.9)" font-family="Arial, sans-serif" font-size="28" font-weight="800">${label}</text>
                <text x="210" y="182" fill="rgba(255,255,255,.9)" font-family="Arial, sans-serif" font-size="76" font-weight="900" text-anchor="middle">${initial}</text>
            </svg>`;
        return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
    }

    function getRarity(shark) {
        const oneIn = Math.max(1, Number(shark.OneIn) || 1);
        return RARITIES.find((rarity) => oneIn <= rarity.maxOneIn) || RARITIES[RARITIES.length - 1];
    }

    function getRarityColor(name) {
        return {
            Common: "#8fd4ff",
            Uncommon: "#77e14d",
            Rare: "#35d7ff",
            Epic: "#b579ff",
            Legendary: "#ffc83d",
            Mythic: "#ff5ec4",
            Ancient: "#ff6f61",
            Apex: "#ffffff"
        }[name] || "#35d7ff";
    }

    function getCollectionLevel(collectionEntry) {
        const owned = Math.max(1, Number(collectionEntry?.owned) || 1);
        return Math.min(12, 1 + Math.floor((owned - 1) / 2));
    }

    function getDamageMultiplier() {
        return 1
            + upgradeLevel("reefContract") * 0.12
            + upgradeLevel("cardSmith") * 0.07
            + upgradeLevel("biteTraining") * 0.1
            + upgradeLevel("comboChain") * 0.05
            + upgradeLevel("frenzyDraw") * 0.08
            + upgradeLevel("stormSurge") * 0.18
            + upgradeLevel("megalodonDream") * 0.3;
    }

    function getCoinMultiplier() {
        return 1
            + upgradeLevel("baitBank") * 0.15
            + upgradeLevel("treasureWake") * 0.18
            + upgradeLevel("marketSurge") * 0.24
            + upgradeLevel("bossTracker") * 0.05
            + upgradeLevel("megamouthVault") * 0.4;
    }

    function getLuckMultiplier() {
        return 1
            + upgradeLevel("deepScanner") * 0.1
            + upgradeLevel("rarityRadar") * 0.16
            + upgradeLevel("deepLure") * 0.22
            + upgradeLevel("abyssGate") * 0.35
            + upgradeLevel("apexCompass") * 0.55
            + upgradeLevel("megalodonDream") * 0.7;
    }

    function getMaxEnergy() {
        return BASE_ENERGY + Math.floor((upgradeLevel("energyCore") + 1) / 2) + upgradeLevel("tideBattery");
    }

    function getPlayerMaxHull() {
        return Math.round(BASE_PLAYER_HULL + getRank() * 10 + upgradeLevel("energyCore") * 22 + upgradeLevel("tideBattery") * 28);
    }

    function getEnemyHandSize() {
        return BASE_ENEMY_HAND_SIZE + Math.min(2, Math.floor(profile.tide / 8));
    }

    function getHandSize() {
        return Math.min(9, BASE_HAND_SIZE + upgradeLevel("handSize") + Math.floor(upgradeLevel("quickDraw") / 2) + upgradeLevel("frenzyDraw"));
    }

    function getDeckMax(source = profile) {
        const upgrades = source?.upgrades || {};
        const level = (id) => Math.max(0, Number(upgrades[id]) || 0);
        return BASE_DECK_MAX + level("deckHarbor") * 2 + level("captainCrew") * 3;
    }

    function getPackCardCount() {
        return 3 + Math.floor((upgradeLevel("packFurnace") + 1) / 2) + (upgradeLevel("legendaryBait") >= 3 ? 1 : 0);
    }

    function getPackCost() {
        const discount = upgradeLevel("packFurnace") * 8 + upgradeLevel("legendaryBait") * 12;
        return Math.max(110, Math.round(160 + profile.tide * 9 - discount));
    }

    function getPearlRewardForTide(tide) {
        if (tide % 3 !== 0 && tide % 5 !== 0) return 0;
        let pearls = tide % 5 === 0 ? 2 : 1;
        pearls += upgradeLevel("pearlDiver") >= 2 && tide % 5 === 0 ? 1 : 0;
        pearls += upgradeLevel("megamouthVault");
        return pearls;
    }

    function getRunName() {
        if (profile.tide >= 30) return "Apex Circuit";
        if (profile.tide >= 18) return "Abyss Circuit";
        if (profile.tide >= 10) return "Storm Circuit";
        return "Reef Circuit";
    }

    function getRank() {
        return Math.max(1, Math.floor(profile.xp / 550) + 1);
    }

    function upgradeLevel(id) {
        return Math.max(0, Number(profile?.upgrades?.[id]) || 0);
    }

    function isUnlocked(node) {
        return !node.prereq || node.prereq.every((id) => upgradeLevel(id) > 0);
    }

    function getUpgradeCost(node, level) {
        const raw = node.costs[level];
        if (typeof raw === "number") {
            return { [node.currency || "fins"]: raw };
        }
        return raw || {};
    }

    function canAfford(cost) {
        return Object.entries(cost).every(([currency, amount]) => (profile[currency] || 0) >= amount);
    }

    function spendCost(cost) {
        Object.entries(cost).forEach(([currency, amount]) => {
            profile[currency] = Math.max(0, (profile[currency] || 0) - amount);
        });
    }

    function formatCost(cost) {
        return Object.entries(cost)
            .map(([currency, amount]) => `${formatNumber(amount)} ${currency}`)
            .join(" + ");
    }

    function addLog(message) {
        if (!profile) return;
        profile.log = [message, ...(profile.log || [])].slice(0, 18);
        saveProfile();
        renderLog();
    }

    function showToast(message) {
        const toast = byId("sc-toast");
        if (!toast) return;
        toast.textContent = message;
        toast.classList.remove("hidden");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.add("hidden"), 2400);
    }

    function animateCardStrike(side, card, damage) {
        const layer = byId("sc-effect-layer");
        if (!layer) return Promise.resolve();

        const attack = document.createElement("div");
        attack.className = `sc-attack-card ${side} ${card.rarity.className}`;
        attack.style.setProperty("--rarity", card.rarityColor);
        attack.innerHTML = `
            <img src="${card.art}" data-species-image="${card.id}" alt="">
            <div>
                <strong>${escapeHtml(card.name)}</strong>
                <span>${side === "player" ? "Player strike" : "Enemy counter"} / ${formatNumber(damage)}</span>
            </div>
        `;

        const impact = document.createElement("div");
        impact.className = "sc-impact-number";
        impact.textContent = "-" + formatNumber(damage);
        impact.style.color = side === "player" ? "var(--sc-gold)" : "var(--sc-coral)";

        layer.append(attack, impact);
        hydrateVisibleSpeciesArt();

        const hitTarget = side === "player" ? document.querySelector(".sc-boss-panel") : document.querySelector(".sc-hull-badge");
        window.setTimeout(() => hitTarget?.classList.add("hit"), 360);
        window.setTimeout(() => hitTarget?.classList.remove("hit"), 780);

        return new Promise((resolve) => {
            window.setTimeout(() => {
                attack.remove();
                impact.remove();
                resolve();
            }, 780);
        });
    }

    function animatePackOpen() {
        const modal = document.querySelector(".sc-pack-modal-card");
        if (!modal) return Promise.resolve();
        modal.classList.remove("unpacking");
        void modal.offsetWidth;
        modal.classList.add("unpacking");
        return new Promise((resolve) => window.setTimeout(resolve, 680));
    }

    function weightedPick(items) {
        const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
        let roll = Math.random() * total;
        for (const item of items) {
            roll -= Math.max(0, item.weight);
            if (roll <= 0) return item;
        }
        return items[items.length - 1];
    }

    function shuffle(items) {
        const copy = [...items];
        for (let index = copy.length - 1; index > 0; index -= 1) {
            const swap = Math.floor(Math.random() * (index + 1));
            [copy[index], copy[swap]] = [copy[swap], copy[index]];
        }
        return copy;
    }

    function slugify(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function formatNumber(value) {
        const number = Number(value) || 0;
        if (number >= 1000000000) return (number / 1000000000).toFixed(1).replace(/\.0$/, "") + "B";
        if (number >= 1000000) return (number / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
        if (number >= 10000) return (number / 1000).toFixed(1).replace(/\.0$/, "") + "K";
        return Math.round(number).toLocaleString();
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, "&#096;");
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function setText(id, value) {
        const element = byId(id);
        if (element) element.textContent = value;
    }

    window.initSharkCards = initSharkCards;
})();
