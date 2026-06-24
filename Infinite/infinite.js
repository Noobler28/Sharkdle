const common_names = [
    // Orders
    {"scientific": "Carcharhiniformes", "Common": "Ground Sharks"},
    {"scientific": "Orectolobiformes", "Common": "Carpet Sharks"},
    {"scientific": "Lamniformes", "Common": "Mackerel Sharks"},
    {"scientific": "Heterodontiformes", "Common": "Bullhead Sharks"},
    {"scientific": "Squantiniformes", "Common": "Angel Sharks"},
    {"scientific": "Pristiophoriformes", "Common": "Saw Sharks"},
    {"scientific": "Squaliformes", "Common": "Dog Fish"},
    {"scientific": "Hexanchiformes", "Common": "Cow and Frilled Sharks"},
    // Families
    {"scientific": "Sphyrnidae", "Common": "Hammerhead Sharks"},
    {"scientific": "Carcharhinidae", "Common": "Requiem Sharks"},
    {"scientific": "Stegostinatidae", "Common": "Zebra Sharks"},
    {"scientific": "Rhincodontidae", "Common": "Whale Sharks"},
    {"scientific": "Orectolobidae", "Common": "Wobbegong Sharks"},
    {"scientific": "Hemiscylliidae", "Common": "Bamboo Sharks"},
    {"scientific": "Ginglymostomatidae", "Common": "Nurse Sharks"},
    {"scientific": "Dalatiidae", "Common": "Kitefin Sharks"},
    {"scientific": "Etmopteridae", "Common": "Lantern Sharks"},
    {"scientific": "Echinorhinidae", "Common": "Bramble Sharks"},
    {"scientific": "Odontaspididae", "Common": "Sand Tiger Sharks"},
    {"scientific": "Megachasmidae", "Common": "Megamouth Sharks"},
    {"scientific": "Lamnidae", "Common": "Mackerel Sharks"},
    {"scientific": "Hexanchidae", "Common": "Cow Sharks"},
    {"scientific": "Centrophoridae", "Common": "Gulper Sharks"},
    {"scientific": "Pristiophoridae", "Common": "Saw Sharks"},
    {"scientific": "Squatinidae", "Common": "Angel Sharks"},
    {"scientific": "Heterodontidae", "Common": "Bullhead Sharks"},
    {"scientific": "Alopiidae", "Common": "Thresher Sharks"},
    {"scientific": "Cetorhinidae", "Common": "Basking Sharks"},
    {"scientific": "Mitsukurinidae", "Common": "Goblin Sharks"},
    {"scientific": "Brachaeluridae", "Common": "Blind Sharks"},
    {"scientific": "Chlamydoselachidae", "Common": "Frilled Sharks"},
    {"scientific": "Pseudocarchariidae", "Common": "Crocodile Sharks"},
    {"scientific": "Somniosidae", "Common": "Sleeper Sharks"},
    {"scientific": "Pentachidae", "Common": "Deep-Sea CatSharks"},
    {"scientific": "Glyphis", "Common": "River Sharks"},
    {"scientific": "Haploblepharus", "Common": "ShySharks"},
];

function getRequestedSpeciesMode() {
    const requestedMode = new URLSearchParams(window.location.search).get("pool") || "sharks";
    const normalizedMode = requestedMode.toLowerCase();
    if (["ray", "rays"].includes(normalizedMode)) return "rays";
    if (["mixed", "all", "elasmobranch", "elasmobranchs"].includes(normalizedMode)) return "mixed";
    return "sharks";
}

const HERO_ART = {
    sharkBg: "images/home-v3/shark-bg.png",
    sharkFg: "images/home-v3/shark-fg.png",
    manta: "images/home-v3/manta-ray.png"
};

function getSpeciesModeConfig(modeKey) {
    const configs = {
        sharks: {
            key: "sharks",
            title: "Sharkdle - Infinite",
            kicker: "Infinite Mode",
            heading: "Guess the Shark",
            lead: "Think you know this shark? Make your guess below.",
            placeholder: "Enter shark name...",
            animal: "shark",
            animalTitle: "Shark",
            shareTitle: "Sharkdle Infinite",
            recentMode: "Infinite",
            heroBackground: HERO_ART.sharkBg,
            heroForeground: HERO_ART.sharkFg
        },
        rays: {
            key: "rays",
            title: "Raydle - Infinite",
            kicker: "Infinite Rays",
            heading: "Guess the Ray",
            lead: "Think you know this ray? Make your guess below.",
            placeholder: "Enter ray name...",
            animal: "ray",
            animalTitle: "Ray",
            shareTitle: "Raydle Infinite",
            recentMode: "Infinite Rays",
            heroBackground: HERO_ART.manta,
            heroForeground: HERO_ART.manta
        },
        mixed: {
            key: "mixed",
            title: "Sharkdle - Mixed Infinite",
            kicker: "Mixed Infinite",
            heading: "Guess the Species",
            lead: "Sharks and rays share the board. Make your guess below.",
            placeholder: "Enter shark or ray name...",
            animal: "species",
            animalTitle: "Species",
            shareTitle: "Sharkdle Mixed Infinite",
            recentMode: "Infinite Mixed",
            heroBackground: HERO_ART.sharkBg,
            heroForeground: HERO_ART.manta
        }
    };

    return configs[modeKey] || configs.sharks;
}

function getActiveSpeciesPool(modeKey) {
    const sharkPool = Array.isArray(window.sharks) ? window.sharks : [];
    const rayPool = Array.isArray(window.rays) ? window.rays : [];
    if (modeKey === "rays") return rayPool.length ? rayPool : sharkPool;
    if (modeKey === "mixed") return [...sharkPool, ...rayPool];
    return sharkPool;
}

function applySpeciesModeCopy() {
    document.title = speciesMode.title;
    document.body.classList.remove("species-mode-sharks", "species-mode-rays", "species-mode-mixed");
    document.body.classList.add(`species-mode-${speciesMode.key}`);

    document.querySelectorAll("[data-pool-mode]").forEach(link => {
        link.classList.toggle("active", link.dataset.poolMode === speciesMode.key);
    });

    const title = document.getElementById("mode-title");
    const kicker = document.getElementById("mode-kicker");
    const heading = document.getElementById("guess-heading");
    const lead = document.getElementById("mode-lead");
    const input = document.getElementById("sharkGuess");
    const heroBackground = document.querySelector(".guess-hero-bg");
    const heroForeground = document.querySelector(".guess-hero-fg");

    if (title) title.textContent = speciesMode.title;
    if (kicker) kicker.textContent = speciesMode.kicker;
    if (heading) heading.textContent = speciesMode.heading;
    if (lead) lead.textContent = speciesMode.lead;
    if (input) input.placeholder = speciesMode.placeholder;
    if (heroBackground) heroBackground.src = speciesMode.heroBackground;
    if (heroForeground) heroForeground.src = speciesMode.heroForeground;
}

const speciesMode = getSpeciesModeConfig(getRequestedSpeciesMode());
const activeSpecies = getActiveSpeciesPool(speciesMode.key).map(species => ({ ...species, guessed: false }));
const infiniteLastFamilyKey = speciesMode.key === "sharks" ? "infiniteLastFamily" : `infiniteLastFamily_${speciesMode.key}`;

applySpeciesModeCopy();

let lastFamily = localStorage.getItem(infiniteLastFamilyKey);
let targetIndex;
do {
  targetIndex = Math.floor(Math.random() * activeSpecies.length);
} while (lastFamily && activeSpecies.length > 1 && activeSpecies[targetIndex].family === lastFamily);
let targetShark = activeSpecies[targetIndex];
localStorage.setItem(infiniteLastFamilyKey, targetShark.family);
let attempts = 12;
let categoryReveal = null;
let categoryRevealGameCompleted = false;
let speciesTrackerGuesses = [];
const infiniteSpeciesTrackerRoundId = window.SharkdleSpeciesTracker
    ? window.SharkdleSpeciesTracker.createRoundId(`infinite-${speciesMode.key}`)
    : `infinite-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function recordInfiniteSpeciesHistory(won) {
    if (!window.SharkdleSpeciesTracker) return;
    void window.SharkdleSpeciesTracker.recordRound({
        mode: `infinite-${speciesMode.key}`,
        roundId: infiniteSpeciesTrackerRoundId,
        targetSpecies: targetShark,
        guesses: speciesTrackerGuesses.map(entry => entry.species),
        categoryResults: speciesTrackerGuesses.map(entry => entry.feedback),
        guessesTaken: 12 - attempts,
        won
    });
}

function getSharchiveReviewHref() {
    const path = typeof resolveAppPath === "function" ? resolveAppPath("Library/index.html") : "Library/index.html";
    return `${path}?species=${encodeURIComponent(targetShark.name)}`;
}
// practice mode removed; always count down and store stats

const sizeThresholds = {
    "Tiny": "0-3ft",
    "Small": "3-6ft",
    "Medium": "6-10ft",
    "Large": "10-20ft",
    "Giant": "20ft+"
};

function getSizeWithThreshold(size) {
    const threshold = sizeThresholds[size];
    return threshold ? `${size} (${threshold})` : size;
}

const CATEGORY_REVEAL_PRICE = 25;
const CATEGORY_REVEAL_OPTIONS = [
    { key: "family", label: "Family", getValue: shark => shark.family },
    { key: "order", label: "Order", getValue: shark => shark.order },
    { key: "genus", label: "Genus", getValue: shark => shark.genus },
    { key: "size", label: "Size", getValue: shark => getSizeWithThreshold(shark.size) },
    { key: "habitat", label: "Habitat", getValue: shark => shark.habitat },
    { key: "yod", label: "Year of Discovery", getValue: shark => shark.yod }
];

function getCategoryRevealOption(key) {
    return CATEGORY_REVEAL_OPTIONS.find(option => option.key === key) || null;
}

function getDiscoveredCategoryKeys() {
    const discovered = new Set();

    activeSpecies.forEach(shark => {
        if (!shark.guessed) return;
        CATEGORY_REVEAL_OPTIONS.forEach(option => {
            if (option.getValue(shark) === option.getValue(targetShark)) {
                discovered.add(option.key);
            }
        });
    });

    if (categoryReveal?.key) {
        discovered.add(categoryReveal.key);
    }

    return discovered;
}

function getAvailableCategoryRevealOptions() {
    const discovered = getDiscoveredCategoryKeys();
    return CATEGORY_REVEAL_OPTIONS.filter(option => !discovered.has(option.key));
}

function getCategoryRevealCommonName(option) {
    if (!["family", "order", "genus"].includes(option.key)) return "";
    const value = option.getValue(targetShark);
    return (typeof window.getSharkTaxonomyCommonName === "function"
        ? window.getSharkTaxonomyCommonName(value)
        : "") || common_names.find(commonName => commonName.scientific === value)?.Common || "";
}

function formatCategoryRevealText(option) {
    const value = option.getValue(targetShark);
    const commonName = getCategoryRevealCommonName(option);
    return commonName ? `${option.label}: ${value} (${commonName})` : `${option.label}: ${value}`;
}

function getCategoryRevealProfile() {
    if (typeof window.getBestLocalProfile === "function") {
        return window.getBestLocalProfile();
    }

    try {
        return JSON.parse(localStorage.getItem("userProfile") || "{}");
    } catch (error) {
        return {};
    }
}

function getCategoryRevealPearls(profileData) {
    if (typeof window.getPearlCount === "function") {
        return window.getPearlCount(profileData);
    }

    return Math.max(0, Math.floor(Number(profileData?.pearls ?? profileData?.tidePearls) || 0));
}

function spendCategoryRevealPearls(profileData, amount) {
    const currentPearls = getCategoryRevealPearls(profileData);
    const nextPearls = currentPearls - amount;

    if (typeof window.setPearlCount === "function") {
        window.setPearlCount(profileData, nextPearls);
    } else {
        profileData.pearls = Math.max(0, nextPearls);
    }

    return Math.max(0, nextPearls);
}

async function persistCategoryRevealProfile(profileData, authUser) {
    const nextProfile = {
        ...profileData,
        uid: window.currentUser?.uid || authUser?.uid || profileData.uid
    };

    if (typeof window.saveUserProfileLocally === "function") {
        window.saveUserProfileLocally(nextProfile, { skipRemoteSync: true });
    } else {
        localStorage.setItem("userProfile", JSON.stringify(nextProfile));
    }

    if (authUser && typeof db !== "undefined") {
        try {
            await db.collection("userStats").doc(authUser.uid).set({
                pearls: getCategoryRevealPearls(nextProfile),
                lastCategoryRevealPurchase: {
                    mode: speciesMode.recentMode,
                    targetShark: targetShark.name,
                    category: categoryReveal?.key || "",
                    price: CATEGORY_REVEAL_PRICE,
                    purchasedAt: new Date()
                },
                lastUpdated: new Date()
            }, { merge: true });
        } catch (error) {
            console.warn("Error saving category reveal pearl spend:", error);
        }
    }

    if (typeof updateHomeV3Sidebar === "function") {
        updateHomeV3Sidebar(nextProfile);
    }
    if (typeof renderPearlShop === "function") {
        renderPearlShop(nextProfile);
    }
}

function setCategoryRevealMessage(text, type = "info") {
    const messageDiv = document.getElementById("message");
    if (messageDiv) messageDiv.textContent = text;
    if (typeof showNotification === "function") {
        showNotification(text, type, 3000);
    }
}

function updateCategoryRevealPanel() {
    const panel = document.getElementById("category-reveal-panel");
    if (!panel) return;

    const result = document.getElementById("category-reveal-result");
    const balance = document.getElementById("category-reveal-balance");
    const button = document.getElementById("category-reveal-btn");
    const authUser = firebase.auth().currentUser;
    const profileData = getCategoryRevealProfile();
    const pearls = getCategoryRevealPearls(profileData);
    const revealedOption = categoryReveal?.key ? getCategoryRevealOption(categoryReveal.key) : null;
    const availableOptions = getAvailableCategoryRevealOptions();

    panel.classList.toggle("revealed", Boolean(revealedOption));

    if (balance) {
        balance.textContent = authUser ? `${pearls.toLocaleString()} pearls available` : "Login required to spend pearls";
    }

    if (revealedOption) {
        if (result) result.textContent = `Revealed: ${formatCategoryRevealText(revealedOption)}`;
        if (button) {
            button.disabled = true;
            button.textContent = "Category Revealed";
        }
        return;
    }

    if (!availableOptions.length) {
        if (result) result.textContent = "Every category has already been discovered.";
        if (button) {
            button.disabled = true;
            button.textContent = "All Categories Found";
        }
        return;
    }

    if (categoryRevealGameCompleted) {
        if (result) result.textContent = "Category reveal is unavailable after the game ends.";
        if (button) {
            button.disabled = true;
            button.textContent = "Game Complete";
        }
        return;
    }

    if (!authUser) {
        if (result) result.textContent = `Reveal one undiscovered category for ${CATEGORY_REVEAL_PRICE} pearls.`;
        if (button) {
            button.disabled = true;
            button.textContent = "Login Required";
        }
        return;
    }

    if (pearls < CATEGORY_REVEAL_PRICE) {
        if (result) result.textContent = `Reveal one undiscovered category for ${CATEGORY_REVEAL_PRICE} pearls.`;
        if (button) {
            button.disabled = true;
            button.textContent = `Need ${CATEGORY_REVEAL_PRICE - pearls} More`;
        }
        return;
    }

    if (result) result.textContent = "Reveal one random category you have not discovered yet.";
    if (button) {
        button.disabled = false;
        button.textContent = `Reveal Category - ${CATEGORY_REVEAL_PRICE}p`;
    }
}

async function buyCategoryReveal() {
    if (categoryRevealGameCompleted) {
        setCategoryRevealMessage("Category reveal is unavailable after the game ends.", "error");
        updateCategoryRevealPanel();
        return;
    }

    if (categoryReveal?.key) {
        setCategoryRevealMessage("You already revealed a category this game.", "error");
        updateCategoryRevealPanel();
        return;
    }

    const availableOptions = getAvailableCategoryRevealOptions();
    if (!availableOptions.length) {
        setCategoryRevealMessage("You already discovered every category.", "info");
        updateCategoryRevealPanel();
        return;
    }

    const authUser = firebase.auth().currentUser;
    if (!authUser) {
        setCategoryRevealMessage("Login to spend pearls on a category reveal.", "error");
        updateCategoryRevealPanel();
        return;
    }

    const profileData = getCategoryRevealProfile();
    const pearls = getCategoryRevealPearls(profileData);
    if (pearls < CATEGORY_REVEAL_PRICE) {
        setCategoryRevealMessage(`You need ${CATEGORY_REVEAL_PRICE - pearls} more pearls.`, "error");
        updateCategoryRevealPanel();
        return;
    }

    const option = availableOptions[Math.floor(Math.random() * availableOptions.length)];
    categoryReveal = {
        key: option.key,
        revealedAt: Date.now()
    };

    spendCategoryRevealPearls(profileData, CATEGORY_REVEAL_PRICE);
    await persistCategoryRevealProfile(profileData, authUser);
    updateCategoryRevealPanel();
    setCategoryRevealMessage(`${formatCategoryRevealText(option)} revealed.`, "success");
}




function getLessSpecificName(sharkName) {
    const words = sharkName.split(' ');
    if (words.length > 1) {
        return words.slice(0, -1).join(' ');
    }
    return sharkName;
}

function normalizeInput(input) {
    return String(input || "").replace(/\s+/g, "").toLowerCase();
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function updateStats(isWin, guessesTaken = 0) {
    if (!firebase.auth().currentUser) return;

    // Load current profileData
    let profileData = typeof getBestLocalProfile === 'function'
        ? getBestLocalProfile()
        : JSON.parse(localStorage.getItem("userProfile") || "{}");

    profileData.gamesPlayed = (profileData.gamesPlayed || 0) + 1;
    if (isWin) {
        profileData.wins = (profileData.wins || 0) + 1;
        profileData.totalGuesses = (profileData.totalGuesses || 0) + guessesTaken;
        profileData.currentStreak = (profileData.currentStreak || 0) + 1;
        profileData.highestStreak = Math.max(profileData.highestStreak || 0, profileData.currentStreak);
        if (typeof incrementProfilePeriodWins === 'function') {
            incrementProfilePeriodWins(profileData);
        }
        // Update best game (fewest guesses)
        if (!profileData.bestGame || profileData.bestGame === 'N/A' || guessesTaken < parseInt(profileData.bestGame)) {
            profileData.bestGame = guessesTaken;
        }
    } else {
        profileData.losses = (profileData.losses || 0) + 1;
        const streakShieldUsed = typeof window.applyStreakShieldOnLoss === 'function'
            ? window.applyStreakShieldOnLoss(profileData, { mode: speciesMode.recentMode })
            : false;
        if (!streakShieldUsed) {
            profileData.currentStreak = 0;
        }
    }

    // Calculate and save average guesses
    if (profileData.gamesPlayed > 0) {
        profileData.averageGuesses = (profileData.totalGuesses / profileData.gamesPlayed).toFixed(2);
    }
    profileData.lastUpdated = Date.now();

    // Save to localStorage
    if (typeof saveUserProfileLocally === 'function') {
        saveUserProfileLocally({
            ...profileData,
            uid: window.currentUser?.uid || firebase.auth().currentUser?.uid || profileData.uid
        });
    } else {
        localStorage.setItem("userProfile", JSON.stringify(profileData));
    }

    // Add to recent games
    const recentGames = JSON.parse(localStorage.getItem('recentGames') || '[]');
    const now = new Date();
    recentGames.unshift({
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        result: isWin ? 'Win' : 'Loss',
        guesses: isWin ? guessesTaken : 'X',
        sharkName: targetShark.name,
        mode: speciesMode.recentMode
    });
    // Only keep the 20 most recent games
    localStorage.setItem('recentGames', JSON.stringify(recentGames.slice(0, 20)));

    // Update display
    if (typeof window.updateIndexStats !== 'undefined') {
        window.updateIndexStats();
    }

    // Sync stats to Firebase if user is logged in
    if (typeof syncStatsToFirebase !== 'undefined') {
        syncStatsToFirebase();

    }
}

function makeGuess() {
    const rawInput = document.getElementById("sharkGuess").value.trim();
    const guessInput = normalizeInput(rawInput);
    const messageDiv = document.getElementById("message");
    const attemptsLeftDiv = document.getElementById("attempts-left");
    const winLoseScreen = document.getElementById("win-lose-screen");

    if (!guessInput) {
        messageDiv.textContent = `Enter a ${speciesMode.animal} name.`;
        return;
    }

    const guessedShark = activeSpecies.find(s => normalizeInput(s.name) === guessInput);
    if (!guessedShark) {
        messageDiv.textContent = `${speciesMode.animalTitle} not found in the list.`;
        return;
    }

    if (guessedShark.guessed) {
        messageDiv.textContent = `You already guessed this ${speciesMode.animal}.`;
        return;
    }

    guessedShark.guessed = true;

    // decrement attempts and update display
    attempts--;
    attemptsLeftDiv.textContent = `Attempts left: ${attempts}`;
    
    const feedback = [
        { category: "Family", value: guessedShark.family, correct: guessedShark.family === targetShark.family },
        { category: "Order", value: guessedShark.order, correct: guessedShark.order === targetShark.order },
        { category: "Genus", value: guessedShark.genus, correct: guessedShark.genus === targetShark.genus },
        { category: "Size", value: guessedShark.size, correct: guessedShark.size === targetShark.size },
        { category: "Habitat", value: guessedShark.habitat, correct: guessedShark.habitat === targetShark.habitat },
        { category: "Year of Discovery", value: guessedShark.yod, correct: guessedShark.yod === targetShark.yod }
    ];
    speciesTrackerGuesses.push({ species: guessedShark, feedback });
    
    renderGuess(guessedShark, feedback);
    
    // Close guesses with no correct information, then open the newest
    const cards = document.querySelectorAll('#guesses .guess-card');
    cards.forEach(card => {
        const feedbackDiv = card.querySelector('.feedback');
        const correctCount = feedbackDiv.querySelectorAll('.correct').length;
        if (correctCount === 0) {
            feedbackDiv.style.display = 'none';
        }
    });
    // Open the newest (first) guess
    if (cards.length > 0) {
        const newestFeedback = cards[0].querySelector('.feedback');
        newestFeedback.style.display = 'flex';
    }

    updateCategoryRevealPanel();
    
    if (normalizeInput(guessedShark.name) === normalizeInput(targetShark.name)) {
        const guessesTaken = 12 - attempts;
        const baseXpGain = Math.max(50, 170 - guessesTaken * 10);
        const xpAward = typeof window.applyLimitedTimeXpBonus === 'function'
            ? window.applyLimitedTimeXpBonus(baseXpGain)
            : { totalXp: baseXpGain };
        const xpGain = xpAward.totalXp;
        
        let pearlsEarned = 0;

        if (firebase.auth().currentUser) {
            let profileData = typeof getBestLocalProfile === 'function'
                ? getBestLocalProfile()
                : JSON.parse(localStorage.getItem("userProfile") || "{}");
            profileData.totalXP = (profileData.totalXP || 0) + xpGain;
            pearlsEarned = typeof window.awardPearlsForWin === 'function'
                ? window.awardPearlsForWin(profileData, { deferSave: true, deferUiUpdate: true })
                : 0;
            if (typeof saveUserProfileLocally === 'function') {
                saveUserProfileLocally({
                    ...profileData,
                    uid: window.currentUser?.uid || firebase.auth().currentUser?.uid || profileData.uid
                });
            } else {
                localStorage.setItem("userProfile", JSON.stringify(profileData));
            }
        }

        updateStats(true, guessesTaken);
        recordInfiniteSpeciesHistory(true);

        if (typeof window.maybeAwardCrateDrop === 'function') {
            window.maybeAwardCrateDrop(`${speciesMode.recentMode.toLowerCase()} win`);
        }

        if (typeof window.contributeCommunityBossWin === 'function') {
            window.contributeCommunityBossWin('infinite');
        }
        
        // Check achievements for win conditions
        if (window.checkAchievements) {
            window.checkAchievements(true, guessesTaken, true);
        }
        
        // Disable input
        categoryRevealGameCompleted = true;
        document.getElementById("sharkGuess").disabled = true;
        document.getElementById("guessBtn").disabled = true;
        updateCategoryRevealPanel();
        
        // Display win screen
        winLoseScreen.innerHTML = `
            <button onclick="document.getElementById('win-lose-screen').style.display='none'; document.getElementById('show-results-btn').style.display='block';" style="position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; background: rgba(0,0,0,0.3); border: none; border-radius: 50%; color: inherit; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; font-weight: bold;">×</button>
            <h2 style="margin-top: 0; font-size: 32px; margin-bottom: 20px;">🎉 You Found It!</h2>
            <p style="font-size: 18px; margin: 10px 0; color: inherit;">The ${speciesMode.animal} was <b>${targetShark.name}</b></p>
            <p style="font-size: 16px; margin: 10px 0; opacity: 0.9;">Discovered in ${targetShark.yod}</p>
            <p style="font-size: 16px; margin: 10px 0; opacity: 0.9;">You took ${guessesTaken} guess${guessesTaken !== 1 ? 'es' : ''}.</p>
            <div style="margin: 20px 0; padding: 15px; background: rgba(255,255,255,0.2); border-radius: 8px;">
                <p style="font-size: 28px; font-weight: bold; margin: 0; color: inherit;">+${xpGain} XP</p>
                ${pearlsEarned ? `<p style="font-size: 20px; font-weight: bold; margin: 8px 0 0; color: #8ff5ef;">+${pearlsEarned} Pearls</p>` : ''}
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 25px; justify-content: center;">
                <button onclick="shareInfiniteResults()" style="padding: 12px 18px; font-size: 15px; cursor: pointer; background: #0097a7; border: none; border-radius: 6px; color: white; font-weight: bold; transition: filter 0.2s;">🦈 Share Results</button>
                <button onclick="location.reload()" style="padding: 12px 25px; font-size: 15px; cursor: pointer; background: rgba(255,255,255,0.3); border: none; border-radius: 6px; color: inherit; font-weight: bold; transition: background 0.3s;">Play Again</button>
                <button onclick="window.location.href=resolveAppPath('index.html')" style="padding: 12px 25px; font-size: 15px; cursor: pointer; background: rgba(0,0,0,0.3); border: none; border-radius: 6px; color: inherit; font-weight: bold; transition: background 0.3s;">Back to Home</button>
            </div>
        `;
        winLoseScreen.classList.add("win");
        winLoseScreen.classList.remove("lose");
        winLoseScreen.style.display = "block";
        document.getElementById('show-results-btn').style.display = 'none';
        createBubbles();
        
    } else if (attempts === 0) {
        updateStats(false);
        recordInfiniteSpeciesHistory(false);
        
        // Check achievements for loss conditions
        if (window.checkAchievements) {
            window.checkAchievements(false, 12, false);
        }
        
        // Disable input
        categoryRevealGameCompleted = true;
        document.getElementById("sharkGuess").disabled = true;
        document.getElementById("guessBtn").disabled = true;
        updateCategoryRevealPanel();
        
        // Display lose screen
        winLoseScreen.innerHTML = `
            <button onclick="document.getElementById('win-lose-screen').style.display='none'; document.getElementById('show-results-btn').style.display='block';" style="position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; background: rgba(0,0,0,0.3); border: none; border-radius: 50%; color: inherit; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; font-weight: bold;">×</button>
            <h2 style="margin-top: 0; font-size: 32px; margin-bottom: 20px;">😢 You Lost</h2>
            <p style="font-size: 18px; margin: 10px 0; color: inherit;">The ${speciesMode.animal} was <b>${targetShark.name}</b></p>
            <p style="font-size: 16px; margin: 10px 0; opacity: 0.9;">Discovered in ${targetShark.yod}</p>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 25px; justify-content: center;">
                <button onclick="shareInfiniteResults()" style="padding: 12px 18px; font-size: 15px; cursor: pointer; background: #0097a7; border: none; border-radius: 6px; color: white; font-weight: bold; transition: filter 0.2s;">🦈 Share Results</button>
                <button onclick="window.location.href='${getSharchiveReviewHref()}'" style="padding: 12px 18px; font-size: 15px; cursor: pointer; background: rgba(70,229,139,0.18); border: 1px solid rgba(70,229,139,0.5); border-radius: 6px; color: #b8ffd2; font-weight: bold;">Review in Sharchive</button>
                <button onclick="location.reload()" style="padding: 12px 25px; font-size: 15px; cursor: pointer; background: rgba(255,255,255,0.3); border: none; border-radius: 6px; color: inherit; font-weight: bold; transition: background 0.3s;">Try Again</button>
                <button onclick="window.location.href=resolveAppPath('index.html')" style="padding: 12px 25px; font-size: 15px; cursor: pointer; background: rgba(0,0,0,0.3); border: none; border-radius: 6px; color: inherit; font-weight: bold; transition: background 0.3s;">Back to Home</button>
            </div>
        `;
        winLoseScreen.classList.add("lose");
        winLoseScreen.classList.remove("win");
        winLoseScreen.style.display = "block";
        document.getElementById('show-results-btn').style.display = 'none';

    } else {
        messageDiv.textContent = "";
    }

    document.getElementById("sharkGuess").value = "";
    document.getElementById("suggestions").classList.remove("active");
}

function renderGuess(shark, feedback){

const card = document.createElement("div")
card.className="guess-card"

const nameColor = normalizeInput(shark.name) === normalizeInput(targetShark.name) ? "#00ff00" : "#ff0000"
card.innerHTML = `<b style="color: ${nameColor};">${shark.name}</b> (click)`

const feedbackDiv = document.createElement("div")
feedbackDiv.className="feedback"

feedback.forEach(item => {
    const div = document.createElement("div");
    div.className = "category";
    if (item.correct) div.classList.add("correct");

    let scientificValue = "";
    if (item.category === "Family") {
        scientificValue = shark.family;
    } else if (item.category === "Order") {
        scientificValue = shark.order;
    } else if (item.category === "Genus") {
        scientificValue = shark.genus;
    }
    const commonName = scientificValue
        ? (typeof window.getSharkTaxonomyCommonName === "function"
            ? window.getSharkTaxonomyCommonName(scientificValue)
            : "") || common_names.find(cn => cn.scientific === scientificValue)?.Common || ""
        : "";

    // Calculate arrow for year of discovery
    let arrow = "";
    if (item.category === "Year of Discovery" && !item.correct) {
        arrow = item.value < targetShark.yod ? " ⬆️" : " ⬇️";
    }

    // Add size threshold info for Size category
    let displayValue = item.value;
    if (item.category === "Size") {
        const threshold = sizeThresholds[item.value];
        displayValue = threshold ? `${item.value} (${threshold})` : item.value;
    }

    if (commonName) {
        const tooltip = document.createElement("span");
        tooltip.className = "tooltip";
        tooltip.textContent = `${item.category}: ${displayValue}${arrow}`;

        const tooltipText = document.createElement("span");
        tooltipText.className = "tooltiptext";
        tooltipText.textContent = commonName;

        tooltip.appendChild(tooltipText);
        div.appendChild(tooltip);
    } else {
        div.textContent = `${item.category}: ${displayValue}${arrow}`;
    }

    feedbackDiv.appendChild(div);
});

card.appendChild(feedbackDiv)

card.onclick = ()=>{

feedbackDiv.style.display = feedbackDiv.style.display==="flex"?"none":"flex"

}

document.getElementById("guesses").prepend(card)

}

function createBubbles() {
    const winLoseScreen = document.getElementById("win-lose-screen");
    for (let i = 0; i < 10; i++) {
        const bubble = document.createElement("div");
        bubble.className = "bubble";
        bubble.style.width = `${Math.random() * 20 + 10}px`;
        bubble.style.height = bubble.style.width;
        bubble.style.left = `${Math.random() * 100}%`;
        bubble.style.animationDelay = `${Math.random() * 2}s`;
        bubble.style.bottom = '0';  
        winLoseScreen.appendChild(bubble);
    }
}

document.getElementById("sharkGuess").addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        makeGuess();
    }
});

document.getElementById("guessBtn").addEventListener("click", makeGuess);
document.getElementById("category-reveal-btn")?.addEventListener("click", buyCategoryReveal);

if (typeof firebase !== "undefined" && firebase.auth) {
    firebase.auth().onAuthStateChanged(() => updateCategoryRevealPanel());
}

updateCategoryRevealPanel();

const sharkGuessInput = document.getElementById("sharkGuess");
const suggestionsDiv = document.getElementById("suggestions");

sharkGuessInput.addEventListener("input", function() {
    const input = normalizeInput(this.value);

    if (input.length === 0) {
        suggestionsDiv.classList.remove("active");
        return;
    }

    // Filter species that match the input
    const matches = activeSpecies.filter(shark =>
        normalizeInput(shark.name).includes(input)
    );

    if (matches.length === 0) {
        suggestionsDiv.classList.remove("active");
        return;
    }
    
    // Build suggestions HTML
    suggestionsDiv.innerHTML = matches.map(shark => {
        const isGuessed = shark.guessed === true;
        const guessedClass = isGuessed ? 'guessed' : '';
        const speciesName = encodeURIComponent(shark.name);
        const disabledAttr = isGuessed ? 'aria-disabled="true"' : `data-species-name="${speciesName}"`;
        return `<div class="suggestion-item ${guessedClass}" ${disabledAttr}>${escapeHtml(shark.name)}</div>`;
    }).join("");
    
    suggestionsDiv.classList.add("active");
});

// Close suggestions when clicking outside
document.addEventListener("click", function(event) {
    if (event.target !== sharkGuessInput && !event.target.closest(".suggestions-dropdown")) {
        suggestionsDiv.classList.remove("active");
    }
});

suggestionsDiv.addEventListener("click", function(event) {
    const item = event.target.closest(".suggestion-item[data-species-name]");
    if (!item) return;
    selectShark(decodeURIComponent(item.dataset.speciesName));
});

function selectShark(sharkName) {
    document.getElementById("sharkGuess").value = sharkName;
    document.getElementById("suggestions").classList.remove("active");
}

// Console command for testing: revealShark() - Dev only
window.revealShark = function() {
    const DEV_UIDS = ['ETPtQC0VA2NiSnX67rS2P2ma2tC2', 'gOcPqOuyPJRWisE4dxvFkGTOl5g2'];
    if (!firebase.auth().currentUser || !DEV_UIDS.includes(firebase.auth().currentUser.uid)) {
        console.log("Access denied. This command is for developers only.");
        return;
    }
    console.log(`TESTING ONLY: The target ${speciesMode.animal} is: ${targetShark.name}`);
};

// --- Share Results (Infinite) ---
function generateInfiniteShareText(isWin) {
    const dateStr = new Date().toLocaleDateString();
    const title = `${speciesMode.shareTitle} ${dateStr} - ${isWin ? (12 - attempts) + '/12' : 'X/12'}`;
    // Build rows from guesses DOM: each guess-card -> .feedback .category.correct
    const guessCards = Array.from(document.querySelectorAll('#guesses .guess-card'));
    const rows = guessCards.map(card => {
        const feedbackDiv = card.querySelector('.feedback');
        if (!feedbackDiv) return '⬛⬛⬛⬛⬛⬛';
        const cats = Array.from(feedbackDiv.querySelectorAll('.category'));
        // Map categories order to green/black squares
        return cats.map(c => c.classList.contains('correct') ? '🟩' : '⬛').join('');
    });
    const body = rows.join('\n');
    const url = window.location.href.split("#")[0];
    const tag = " #Sharkdle";
    return `${title}\n${body}\n\nPlay: ${url}\n\n${tag}`;
}

async function shareInfiniteResults() {
    const isWin = document.getElementById('win-lose-screen')?.classList.contains('win');
    const text = generateInfiniteShareText(isWin);
    try {
        if (navigator.share) {
            await navigator.share({ text });
            const msg = document.getElementById('message');
            if (msg) { msg.textContent = 'Shared via system share'; }
            return;
        }
    } catch (e) {
        console.warn('Navigator.share failed', e);
    }

    try {
        await navigator.clipboard.writeText(text);
        const msg = document.getElementById('message');
        if (msg) {
            msg.textContent = 'Results copied to clipboard';
            setTimeout(() => { if (msg) msg.textContent = ''; }, 3000);
        } else {
            alert('Results copied to clipboard');
        }
    } catch (err) {
        console.error('Clipboard write failed', err);
        alert('Could not copy share text.');
    }
}
