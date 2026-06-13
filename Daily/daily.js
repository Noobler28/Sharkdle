// Get today's date in UTC (same puzzle for all users globally)
function getTodayInLocalTimezone() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- Share Results (Daily) ---
function generateDailyShareText() {
    const title = `Sharkdle Daily ${today} - ${gameWon ? guesses.length : 'X'}/${12}`;
    // Build grid: 6 categories per guess -> green for correct, black for incorrect
    const rows = guesses.map(g => {
        const order = ['family','order','genus','size','habitat','yod'];
        return order.map(cat => (g.feedback && g.feedback[cat]) ? '🟩' : '⬛').join('');
    });
    const body = rows.join('\n');
    const url = new URL("./", window.location.href).href;
    const tag = " #Sharkdle";
    return `${title}\n${body}\n\nPlay: ${url}\n\n${tag}`;
}

async function shareDailyResults() {
    const text = generateDailyShareText();
    try {
        if (navigator.share) {
            await navigator.share({ text });
            if (messageDiv) messageDiv.textContent = 'Shared via system share';
            return;
        }
    } catch (e) {
        console.warn('Navigator.share failed', e);
    }

    // Fallback to clipboard
    try {
        await navigator.clipboard.writeText(text);
        if (messageDiv) {
            messageDiv.textContent = 'Results copied to clipboard';
            setTimeout(() => { if (messageDiv) messageDiv.textContent = ''; }, 3000);
        } else {
            alert('Results copied to clipboard');
        }
    } catch (err) {
        console.error('Clipboard write failed', err);
        alert('Could not copy share text.');
    }
}

// Get the next midnight in the user's local timezone
function getNextMidnightTime() {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    return tomorrow.getTime();
}

const today = getTodayInLocalTimezone()

// Daily target must be fully deterministic so every player gets the same shark.
const dailySharkIndex = hashDate(today) % sharks.length
const targetShark = sharks[dailySharkIndex]

let attempts = 12
let guesses = []
let gameCompleted = false
let gameWon = false
let lastLoadedDate = today
let categoryReveal = null

const messageDiv = document.getElementById("message");

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

function normalizeCategoryRevealState(rawReveal) {
    if (!rawReveal || typeof rawReveal !== "object") return null;
    const option = getCategoryRevealOption(rawReveal.key);
    if (!option) return null;
    return {
        key: option.key,
        revealedAt: Number(rawReveal.revealedAt) || null
    };
}

function getDiscoveredCategoryKeys() {
    const discovered = new Set();

    guesses.forEach(guess => {
        const feedback = guess && guess.feedback;
        if (!feedback || typeof feedback !== "object") return;

        CATEGORY_REVEAL_OPTIONS.forEach(option => {
            if (feedback[option.key]) {
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
    return typeof window.getSharkTaxonomyCommonName === "function"
        ? window.getSharkTaxonomyCommonName(value)
        : "";
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
                    mode: "daily",
                    gameKey: today,
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

    if (gameCompleted) {
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
    if (gameCompleted) {
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
    await saveGameState();
    updateCategoryRevealPanel();
    setCategoryRevealMessage(`${formatCategoryRevealText(option)} revealed.`, "success");
}




// Load game state from localStorage and Firestore
async function loadGameState() {
    // First, check localStorage for today's game
    const stored = localStorage.getItem(`daily_${today}`)
    if (stored) {
        const state = JSON.parse(stored)
        // Validate that stored state is actually for today (not from device date manipulation)
        if (state.date === today) {
            guesses = state.guesses || []
            attempts = state.attempts || 12
            gameCompleted = state.completed || false
            gameWon = state.won || false
            categoryReveal = normalizeCategoryRevealState(state.categoryReveal)
            lastLoadedDate = today
        } else {
            // Date mismatch in localStorage - device date was likely changed. Start fresh.
            console.warn("localStorage date mismatch. Resetting game.");
            localStorage.removeItem(`daily_${today}`);
        }
    }

    // If user is logged in, also load from Firestore for cross-device persistence
    const currentUser = firebase.auth().currentUser;
    if (currentUser && typeof db !== 'undefined') {
        try {
            const dailyRef = db.collection("userDaily").doc(currentUser.uid);
            const doc = await dailyRef.get();
            
            if (doc.exists) {
                const firebaseData = doc.data();
                
                // Check server timestamp to prevent device date manipulation
                if (firebaseData.lastUpdated) {
                    const lastPlayDate = firebaseData.lastUpdated.toDate();
                    const lastPlayUTC = lastPlayDate.getUTCFullYear() + '-' + 
                                       String(lastPlayDate.getUTCMonth() + 1).padStart(2, '0') + '-' +
                                       String(lastPlayDate.getUTCDate()).padStart(2, '0');
                    
                    // If they played today (according to server time), load their game
                    // regardless of what their client date says
                    if (lastPlayUTC === today) {
                        guesses = firebaseData.guesses || []
                        attempts = firebaseData.attempts || 12
                        gameCompleted = firebaseData.completed || false
                        gameWon = firebaseData.won || false
                        categoryReveal = normalizeCategoryRevealState(firebaseData.categoryReveal)
                        lastLoadedDate = today
                        return; // Don't allow resetting if already played today
                    } else if (lastPlayUTC !== today && firebaseData.date === today) {
                        // Server says they played a different day, but stored date says today
                        // This means device date was manipulated. Use server truth.
                        console.warn("Device date manipulation detected. Resetting game.");
                        guesses = []
                        attempts = 12
                        gameCompleted = false
                        gameWon = false
                        categoryReveal = null
                        lastLoadedDate = today
                        return;
                    }
                }
                
                // Fallback: validate the saved date against stored date field
                if (firebaseData.date === today) {
                    guesses = firebaseData.guesses || []
                    attempts = firebaseData.attempts || 12
                    gameCompleted = firebaseData.completed || false
                    gameWon = firebaseData.won || false
                    categoryReveal = normalizeCategoryRevealState(firebaseData.categoryReveal)
                    lastLoadedDate = today
                } else if (firebaseData.date && firebaseData.date !== today) {
                    // Date mismatch: likely device date was changed. Reset the game
                    console.warn("Date mismatch detected. Device date may have been manipulated.");
                    guesses = []
                    attempts = 12
                    gameCompleted = false
                    gameWon = false
                    categoryReveal = null
                    lastLoadedDate = today
                }
            }
        } catch (error) {
            console.warn("Error loading daily game from Firestore:", error);
        }
    }
}

// Save game state to localStorage and Firestore
async function saveGameState() {
    const state = {
        guesses: guesses,
        attempts: attempts,
        completed: gameCompleted,
        won: gameWon,
        categoryReveal: categoryReveal,
        date: today
    }
    
    // Save to localStorage
    localStorage.setItem(`daily_${today}`, JSON.stringify(state))
    
    // Save to Firestore if user is logged in
    // Use firebase.auth().currentUser for more reliable auth check
    const currentUser = firebase.auth().currentUser;
    if (currentUser && typeof db !== 'undefined') {
        try {
            const dailyRef = db.collection("userDaily").doc(currentUser.uid);
            await dailyRef.set({
                ...state,
                // Use server timestamp so device time manipulation can't affect recorded state
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (error) {
            console.warn("Error saving daily game to Firestore:", error);
        }
    }
}

// Initialize game
async function initializeGame() {
    await loadGameState()
    
    // Set attempts display if game not completed
    if (!gameCompleted) {
        document.getElementById("attempts-left").textContent = "Attempts left: " + attempts;
    }

    // If game already completed, show the result
    if (gameCompleted) {
        if (gameWon) {
            showWin(0, guesses.length, true) // XP already gained, alreadyCompleted = true
        } else {
            showLose(true) // alreadyCompleted = true
        }
        // Disable input
        document.getElementById("sharkGuess").disabled = true
        document.getElementById("guessBtn").disabled = true
        document.getElementById("attempts-left").textContent = "Game completed for today"
    }

    // Render existing guesses
    guesses.forEach(guess => {
        renderGuess(guess.shark, guess.feedback)
    })

    // Close guesses with no correct information
    const cards = document.querySelectorAll('#guesses .guess-card');
    cards.forEach(card => {
        const feedbackDiv = card.querySelector('.feedback');
        const correctCount = feedbackDiv.querySelectorAll('.correct').length;
        if (correctCount === 0) {
            feedbackDiv.style.display = 'none';
        }
    });

    updateCategoryRevealPanel();
}

// Start the initialization when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
} else {
    initializeGame();
}

// Countdown timer for next puzzle
function updateCountdown() {
    const countdownDiv = document.getElementById("countdown-timer");
    const winCountdown = document.getElementById("win-countdown");

    const now = new Date();
    // Calculate next UTC midnight
    const nextMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
    
    const timeUntil = nextMidnight - now;
    
    let timeStr;
    if (timeUntil <= 0) {
        timeStr = "00:00:00";
    } else {
        const hours = Math.floor(timeUntil / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeUntil % (1000 * 60)) / 1000);
        
        timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    
    if (countdownDiv) {
        countdownDiv.textContent = `Next puzzle: ${timeStr}`;
    }
    
    if (winCountdown) {
        winCountdown.textContent = timeStr;
    }
}

// Update countdown every second
updateCountdown();
setInterval(updateCountdown, 1000);

function hashDate(date){

let hash=0

for(let i=0;i<date.length;i++){

hash=(hash<<5)-hash+date.charCodeAt(i)
hash|=0

}

return Math.abs(hash)

}


document.getElementById("guessBtn").onclick = makeGuess
document.getElementById("category-reveal-btn")?.addEventListener("click", buyCategoryReveal)

if (typeof firebase !== "undefined" && firebase.auth) {
    firebase.auth().onAuthStateChanged(() => updateCategoryRevealPanel());
}

// Allow Enter key to submit guess
document.getElementById("sharkGuess").addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        makeGuess();
    }
});

const sharkGuessInput = document.getElementById("sharkGuess");
const suggestionsDiv = document.getElementById("suggestions");

sharkGuessInput.addEventListener("input", function() {
    const input = this.value.toLowerCase().trim();
    
    if (input.length === 0) {
        suggestionsDiv.classList.remove("active");
        return;
    }
    
    // Filter sharks that match the input
    const matches = sharks.filter(shark => 
        shark.name.toLowerCase().includes(input)
    );
    
    if (matches.length === 0) {
        suggestionsDiv.classList.remove("active");
        return;
    }
    
    // Build suggestions HTML
    suggestionsDiv.innerHTML = matches.map(shark => {
        const isGuessed = guesses.some(g => g.shark.name === shark.name);
        const guessedClass = isGuessed ? 'guessed' : '';
        return `<div class="suggestion-item ${guessedClass}" onclick="${isGuessed ? '' : `selectShark('${shark.name}')`}">${shark.name}</div>`;
    }).join("");
    
    suggestionsDiv.classList.add("active");
});

// Close suggestions when clicking outside
document.addEventListener("click", function(event) {
    if (event.target !== sharkGuessInput && !event.target.closest(".suggestions-dropdown")) {
        suggestionsDiv.classList.remove("active");
    }
});

function selectShark(sharkName) {
    document.getElementById("sharkGuess").value = sharkName;
    document.getElementById("suggestions").classList.remove("active");
}


function makeGuess(){

if (gameCompleted) return

const input = document.getElementById("sharkGuess")
const guess = input.value.trim().toLowerCase()

// Clear previous message
if (messageDiv) messageDiv.textContent = "";

if (!guess) {
    if (messageDiv) messageDiv.textContent = "Enter a shark name.";
    return;
}

const shark = sharks.find(s => s.name.toLowerCase() === guess)

if(!shark) {
    if (messageDiv) messageDiv.textContent = "Shark not found in the list.";
    return;
}

// Check if already guessed
if (guesses.some(g => g.shark.name === shark.name)) {
    if (messageDiv) messageDiv.textContent = "You already guessed this shark.";
    return;
}

attempts--

document.getElementById("attempts-left").textContent="Attempts left: "+attempts

const feedback = {
    family: shark.family === targetShark.family,
    order: shark.order === targetShark.order,
    genus: shark.genus === targetShark.genus,
    size: shark.size === targetShark.size,
    habitat: shark.habitat === targetShark.habitat,
    yod: shark.yod === targetShark.yod
}

guesses.push({ shark: shark, feedback: feedback })
// Save game state to both localStorage and Firestore (fire and forget for better UX)
saveGameState()

renderGuess(shark, feedback)

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

if(shark.name === targetShark.name){

    // Track total guesses for this game
    const guessesTaken = 12 - attempts;

    // Calculate XP gain (170 - 10 per guess, minimum 50)
    const baseXpGain = Math.max(50, 170 - guessesTaken * 10);
    const xpAward = typeof window.applyLimitedTimeXpBonus === 'function'
        ? window.applyLimitedTimeXpBonus(baseXpGain)
        : { totalXp: baseXpGain };
    const xpGain = xpAward.totalXp;

    // Save stats to localStorage
    let profileData = typeof getBestLocalProfile === 'function'
        ? getBestLocalProfile()
        : JSON.parse(localStorage.getItem("userProfile") || "{}");

    // Track total guesses accumulated
    profileData.totalGuesses = (profileData.totalGuesses || 0) + guessesTaken;

    // Update stats
    profileData.gamesPlayed = (profileData.gamesPlayed || 0) + 1;
    profileData.wins = (profileData.wins || 0) + 1;
    profileData.currentStreak = (profileData.currentStreak || 0) + 1;
    profileData.highestStreak = Math.max(profileData.highestStreak || 0, profileData.currentStreak);
    if (typeof incrementProfilePeriodWins === 'function') {
        incrementProfilePeriodWins(profileData);
    }
    
    // Update best game (fewest guesses)
    if (!profileData.bestGame || profileData.bestGame === 'N/A' || guessesTaken < parseInt(profileData.bestGame)) {
        profileData.bestGame = guessesTaken;
    }
    
    // Calculate and save average guesses
    if (profileData.gamesPlayed > 0) {
        profileData.averageGuesses = (profileData.totalGuesses / profileData.gamesPlayed).toFixed(2);
    }

    // Gain XP and Pearls, then save for Shark Pass/profile progress.
    profileData.totalXP = (profileData.totalXP || 0) + xpGain;
    const pearlsEarned = typeof window.awardPearlsForWin === 'function'
        ? window.awardPearlsForWin(profileData, { deferSave: true, deferUiUpdate: true })
        : 0;
    profileData.lastUpdated = Date.now();

    if (typeof saveUserProfileLocally === 'function') {
        saveUserProfileLocally({
            ...profileData,
            uid: window.currentUser?.uid || firebase.auth().currentUser?.uid || profileData.uid
        });
    } else {
        localStorage.setItem("userProfile", JSON.stringify(profileData));
    }

    // Add to recent games (for profile modal)
    const recentGames = JSON.parse(localStorage.getItem('recentGames') || '[]');
    const now = new Date();
    recentGames.unshift({
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        result: 'Win',
        guesses: guessesTaken,
        sharkName: targetShark.name,
        mode: 'Daily'
    });
    localStorage.setItem('recentGames', JSON.stringify(recentGames.slice(0, 20)));

    // Sync to Firebase
    if (typeof syncStatsToFirebase !== 'undefined') {
        syncStatsToFirebase();
    }

    gameCompleted = true
    gameWon = true
    saveGameState()
    updateCategoryRevealPanel()

    // Update display
    if (typeof window.updateIndexStats !== 'undefined') {
        window.updateIndexStats();
    }

    if (typeof window.maybeAwardCrateDrop === 'function') {
        window.maybeAwardCrateDrop('daily win');
    }

    if (typeof window.contributeCommunityBossWin === 'function') {
        window.contributeCommunityBossWin('daily', { contributionKey: today });
    }

    showWin(xpGain, guessesTaken, false, pearlsEarned);

}

if(attempts===0){

    if (window.currentUser) {
        let profileData = typeof getBestLocalProfile === 'function'
            ? getBestLocalProfile()
            : JSON.parse(localStorage.getItem("userProfile") || "{}");

        // Track total guesses for this game (all 12 attempts used)
        const guessesTaken = 12;
        profileData.totalGuesses = (profileData.totalGuesses || 0) + guessesTaken;

        // Update stats
        profileData.gamesPlayed = (profileData.gamesPlayed || 0) + 1;
        profileData.losses = (profileData.losses || 0) + 1;
        const streakShieldUsed = typeof window.applyStreakShieldOnLoss === 'function'
            ? window.applyStreakShieldOnLoss(profileData, { mode: "Daily" })
            : false;
        if (!streakShieldUsed) {
            profileData.currentStreak = 0; // Reset streak on loss when no shield is available
        }
        
        // Calculate and save average guesses
        if (profileData.gamesPlayed > 0) {
            profileData.averageGuesses = (profileData.totalGuesses / profileData.gamesPlayed).toFixed(2);
        }
        profileData.lastUpdated = Date.now();

        if (typeof saveUserProfileLocally === 'function') {
            saveUserProfileLocally({
                ...profileData,
                uid: window.currentUser?.uid || firebase.auth().currentUser?.uid || profileData.uid
            });
        } else {
            localStorage.setItem("userProfile", JSON.stringify(profileData));
        }

        // Add to recent games (for profile modal)
        const recentGames = JSON.parse(localStorage.getItem('recentGames') || '[]');
        const now = new Date();
        recentGames.unshift({
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString(),
            result: 'Loss',
            guesses: 'X',
            sharkName: targetShark.name,
            mode: 'Daily'
        });
        localStorage.setItem('recentGames', JSON.stringify(recentGames.slice(0, 20)));

        // Sync to Firebase
        if (typeof syncStatsToFirebase !== 'undefined') {
            syncStatsToFirebase();
        }
    }

    gameCompleted = true
    gameWon = false
    saveGameState()
    updateCategoryRevealPanel()

    // Update display
    if (typeof window.updateIndexStats !== 'undefined') {
        window.updateIndexStats();
    }

    showLose()

}

input.value=""
document.getElementById("suggestions").classList.remove("active")

}


function renderGuess(shark, feedback){

const card = document.createElement("div")
card.className="guess-card"

const nameColor = shark.name === targetShark.name ? "#00ff00" : "#ff0000"
card.innerHTML = `<b style="color: ${nameColor};">${shark.name}</b> (click)`


const feedbackDiv = document.createElement("div")
feedbackDiv.className="feedback"

feedbackDiv.appendChild(createCategory("Family", shark.family, feedback.family))
feedbackDiv.appendChild(createCategory("Order", shark.order, feedback.order))
feedbackDiv.appendChild(createCategory("Genus", shark.genus, feedback.genus))
feedbackDiv.appendChild(createCategory("Size", getSizeWithThreshold(shark.size), feedback.size))
feedbackDiv.appendChild(createCategory("Habitat", shark.habitat, feedback.habitat))

// Calculate arrow for year of discovery
let yodArrow = ""
if (shark.yod !== targetShark.yod) {
    yodArrow = shark.yod < targetShark.yod ? "⬆️" : "⬇️"
}
feedbackDiv.appendChild(createCategory("Year of Discovery", shark.yod, feedback.yod, yodArrow))


card.appendChild(feedbackDiv)


card.onclick = ()=>{

feedbackDiv.style.display = feedbackDiv.style.display==="flex"?"none":"flex"

}


document.getElementById("guesses").prepend(card)

}


function createCategory(name, value, correct, arrow = ""){

const div = document.createElement("div")

div.className="category"

if(correct) div.classList.add("correct")

const displayText = arrow ? `${name}: ${value} ${arrow}` : `${name}: ${value}`
const shouldShowCommonName = name === "Family" || name === "Order" || name === "Genus"
const commonName = shouldShowCommonName && typeof window.getSharkTaxonomyCommonName === "function"
    ? window.getSharkTaxonomyCommonName(value)
    : ""

if(commonName) {
    const tooltip = document.createElement("span")
    tooltip.className = "tooltip"
    tooltip.textContent = displayText

    const tooltipText = document.createElement("span")
    tooltipText.className = "tooltiptext"
    tooltipText.textContent = commonName

    tooltip.appendChild(tooltipText)
    div.appendChild(tooltip)
} else {
    div.textContent = displayText
}

return div

}


function createBubbles(container) {
    for (let i = 0; i < 10; i++) {
        const bubble = document.createElement("div");
        bubble.className = "bubble";
        bubble.style.width = `${Math.random() * 20 + 10}px`;
        bubble.style.height = bubble.style.width;
        bubble.style.left = `${Math.random() * 100}%`;
        bubble.style.animationDelay = `${Math.random() * 2}s`;
        bubble.style.bottom = '0';  
        container.appendChild(bubble);
    }
}

function showWin(xpGained, guessesTaken, alreadyCompleted = false, pearlsGained = 0){

// Check achievements for win conditions (only on first completion)
if (!alreadyCompleted && window.checkAchievements) {
    window.checkAchievements(true, guessesTaken, true);
}

const win = document.getElementById("win-screen")

let headerText = alreadyCompleted ? "✓ Already Discovered" : "🎉 You Guessed It!";

win.innerHTML = `
<button onclick="document.getElementById('win-screen').style.display='none'; document.getElementById('show-results-btn').style.display='block';" style="position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; background: rgba(0,0,0,0.3); border: none; border-radius: 50%; color: inherit; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; font-weight: bold;">×</button>
<h2 style="margin-top: 0; font-size: 32px; margin-bottom: 20px;">${headerText}</h2>
<p style="font-size: 18px; margin: 10px 0; color: inherit;">The shark was <b>${targetShark.name}</b></p>
<p style="font-size: 16px; margin: 10px 0; opacity: 0.9;">Discovered in ${targetShark.yod}</p>
<p style="font-size: 16px; margin: 10px 0; opacity: 0.9;">You took ${guessesTaken} guess${guessesTaken !== 1 ? 'es' : ''}.</p>
${!alreadyCompleted ? `<div style="margin: 20px 0; padding: 15px; background: rgba(255,255,255,0.2); border-radius: 8px;"><p style="font-size: 28px; font-weight: bold; margin: 0; color: inherit;">+${xpGained} XP</p>${pearlsGained ? `<p style="font-size: 20px; font-weight: bold; margin: 8px 0 0; color: #8ff5ef;">+${pearlsGained} Pearls</p>` : ''}</div>` : ''}
<div style="margin: 20px 0; padding: 12px; background: rgba(255,0,0,0.1); border-radius: 6px; font-size: 14px; text-align: center; color: #ff4444; font-weight: 600;">Next puzzle: <span id="win-countdown">--:--:--</span></div>
<div style="display: flex; gap: 10px; margin-top: 25px; justify-content: center;">
    <button onclick="shareDailyResults()" style="padding: 12px 18px; font-size: 15px; cursor: pointer; background: #0097a7; border: none; border-radius: 6px; color: white; font-weight: bold; transition: filter 0.2s;">🦈 Share Results</button>
    <button onclick="window.location.href=resolveAppPath('infinite.html')" style="padding: 12px 25px; font-size: 15px; cursor: pointer; background: rgba(255,255,255,0.3); border: none; border-radius: 6px; color: inherit; font-weight: bold; transition: background 0.3s;">Play Infinite</button>
    <button onclick="window.location.href=resolveAppPath('index.html')" style="padding: 12px 25px; font-size: 15px; cursor: pointer; background: rgba(0,0,0,0.3); border: none; border-radius: 6px; color: inherit; font-weight: bold; transition: background 0.3s;">Back to Home</button>
</div>
`

win.style.display="block"
win.classList.add("win")
win.classList.remove("lose")

createBubbles(win);

}


function showLose(alreadyCompleted = false){

// Check achievements for loss conditions (only on first completion)
if (!alreadyCompleted && window.checkAchievements) {
    window.checkAchievements(false, 12, false);
}

const win = document.getElementById("win-screen")

let headerText = alreadyCompleted ? "✗ You could not discover today's Daily Shark" : "😢 You Lost";

win.innerHTML = `
<button onclick="document.getElementById('win-screen').style.display='none'; document.getElementById('show-results-btn').style.display='block';" style="position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; background: rgba(0,0,0,0.3); border: none; border-radius: 50%; color: inherit; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; font-weight: bold;">×</button>
<h2 style="margin-top: 0; font-size: 32px; margin-bottom: 20px;">${headerText}</h2>
<p style="font-size: 18px; margin: 10px 0; color: inherit;">The shark was <b>${targetShark.name}</b></p>
<p style="font-size: 16px; margin: 10px 0; opacity: 0.9;">Discovered in ${targetShark.yod}</p>
<div style="margin: 20px 0; padding: 12px; background: rgba(255,0,0,0.1); border-radius: 6px; font-size: 14px; text-align: center; color: #ff4444; font-weight: 600;">Next puzzle: <span id="win-countdown">--:--:--</span></div>
<div style="display: flex; gap: 10px; margin-top: 25px; justify-content: center;">
    <button onclick="shareDailyResults()" style="padding: 12px 18px; font-size: 15px; cursor: pointer; background: #0097a7; border: none; border-radius: 6px; color: white; font-weight: bold; transition: filter 0.2s;">🦈 Share Results</button>
    <button onclick="window.location.href=resolveAppPath('infinite.html')" style="padding: 12px 25px; font-size: 15px; cursor: pointer; background: rgba(255,255,255,0.3); border: none; border-radius: 6px; color: inherit; font-weight: bold; transition: background 0.3s;">Play Infinite</button>
    <button onclick="window.location.href=resolveAppPath('index.html')" style="padding: 12px 25px; font-size: 15px; cursor: pointer; background: rgba(0,0,0,0.3); border: none; border-radius: 6px; color: inherit; font-weight: bold; transition: background 0.3s;">Back to Home</button>
</div>
`

win.style.display="block"
win.classList.add("lose")
win.classList.remove("win")
}

// Console command for testing: revealShark() - Dev only
window.revealShark = function() {
    const DEV_UIDS = ['ETPtQC0VA2NiSnX67rS2P2ma2tC2', 'gOcPqOuyPJRWisE4dxvFkGTOl5g2'];
    if (!firebase.auth().currentUser || !DEV_UIDS.includes(firebase.auth().currentUser.uid)) {
        console.log("Access denied. This command is for developers only.");
        return;
    }
    console.log("TESTING ONLY: The target shark is: " + targetShark.name);
};

async function submitStatsToLeaderboard(won, guesses) {
    try {
        // Only submit if user is authenticated
        if (!firebase.auth().currentUser) {
            console.log("User not authenticated, skipping leaderboard submission");
            return;
        }

        const username = firebase.auth().currentUser.displayName || firebase.auth().currentUser.email || "Anonymous";
        const docRef = db.collection("leaderboard").doc();
        await docRef.set({
            username: username,
            won: won,
            guesses: guesses,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            mode: "daily",
            userId: firebase.auth().currentUser.uid  // optional: track user ID
        });
        console.log("Stats submitted successfully");
    } catch (error) {
        console.error("Error submitting stats:", error);
    }
}

// Hint functionality
const common_names = [
    {"scientific": "Carcharhiniformes", "Common": "Ground Sharks"},
    {"scientific": "Orectolobiformes", "Common": "Carpet Sharks"},
    {"scientific": "Lamniformes", "Common": "Mackerel Sharks"},
    {"scientific": "Heterodontiformes", "Common": "Bullhead Sharks"},
    {"scientific": "Squatiniformes", "Common": "Angel Sharks"},
    {"scientific": "Pristiophoriformes", "Common": "Saw Sharks"},
    {"scientific": "Squaliformes", "Common": "Dog Sharks"},
    {"scientific": "Hexanchiformes", "Common": "Cow and Frilled Sharks"},
    {"scientific": "Sphyrnidae", "Common": "Hammerhead Sharks"},
    {"scientific": "Carcharhinidae", "Common": "Requiem Sharks"},
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
];

async function submitStatsToLeaderboard(won, guesses) {
    try {
        // Only submit if user is authenticated
        if (!firebase.auth().currentUser) {
            console.log("User not authenticated, skipping leaderboard submission");
            return;
        }

        const username = firebase.auth().currentUser.displayName || firebase.auth().currentUser.email || "Anonymous";
        const docRef = db.collection("leaderboard").doc();
        await docRef.set({
            username: username,
            won: won,
            guesses: guesses,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            mode: "daily",
            userId: firebase.auth().currentUser.uid
        });
        console.log("Stats submitted successfully");
    } catch (error) {
        console.error("Error submitting stats:", error);
    }
}
