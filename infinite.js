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

let lastFamily = localStorage.getItem('infiniteLastFamily');
let targetIndex;
do {
  targetIndex = Math.floor(Math.random() * sharks.length);
} while (lastFamily && sharks[targetIndex].family === lastFamily);
let targetShark = sharks[targetIndex];
localStorage.setItem('infiniteLastFamily', targetShark.family);
let attempts = 12;
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




function getLessSpecificName(sharkName) {
    const words = sharkName.split(' ');
    if (words.length > 1) {
        return words.slice(0, -1).join(' ');
    }
    return sharkName;
}

function normalizeInput(input) {
    return input.replace(/\s+/g, '').toLowerCase();
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
        // Update best game (fewest guesses)
        if (!profileData.bestGame || profileData.bestGame === 'N/A' || guessesTaken < parseInt(profileData.bestGame)) {
            profileData.bestGame = guessesTaken;
        }
    } else {
        profileData.losses = (profileData.losses || 0) + 1;
        profileData.currentStreak = 0;
    }

    // Calculate and save average guesses
    if (profileData.gamesPlayed > 0) {
        profileData.averageGuesses = (profileData.totalGuesses / profileData.gamesPlayed).toFixed(2);
    }

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
        mode: 'Infinite'
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
        messageDiv.textContent = "Enter a shark name.";
        return;
    }

    const guessedShark = sharks.find(s => normalizeInput(s.name) === guessInput);
    if (!guessedShark) {
        messageDiv.textContent = "Shark not found in the list.";
        return;
    }

    if (guessedShark.guessed) {
        messageDiv.textContent = "You already guessed this shark.";
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
    
    if (normalizeInput(guessedShark.name) === normalizeInput(targetShark.name)) {
        const guessesTaken = 12 - attempts;
        const baseXpGain = Math.max(50, 170 - guessesTaken * 10);
        const xpAward = typeof window.applyLimitedTimeXpBonus === 'function'
            ? window.applyLimitedTimeXpBonus(baseXpGain)
            : { totalXp: baseXpGain };
        const xpGain = xpAward.totalXp;
        
        if (firebase.auth().currentUser) {
            let profileData = typeof getBestLocalProfile === 'function'
                ? getBestLocalProfile()
                : JSON.parse(localStorage.getItem("userProfile") || "{}");
            profileData.totalXP = (profileData.totalXP || 0) + xpGain;
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

        if (typeof window.maybeAwardCrateDrop === 'function') {
            window.maybeAwardCrateDrop('infinite win');
        }
        
        // Check achievements for win conditions
        if (window.checkAchievements) {
            window.checkAchievements(true, guessesTaken, true);
        }
        
        // Disable input
        document.getElementById("sharkGuess").disabled = true;
        document.getElementById("guessBtn").disabled = true;
        
        // Display win screen
        winLoseScreen.innerHTML = `
            <button onclick="document.getElementById('win-lose-screen').style.display='none'; document.getElementById('show-results-btn').style.display='block';" style="position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; background: rgba(0,0,0,0.3); border: none; border-radius: 50%; color: inherit; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; font-weight: bold;">×</button>
            <h2 style="margin-top: 0; font-size: 32px; margin-bottom: 20px;">🎉 You Found It!</h2>
            <p style="font-size: 18px; margin: 10px 0; color: inherit;">The shark was <b>${targetShark.name}</b></p>
            <p style="font-size: 16px; margin: 10px 0; opacity: 0.9;">Discovered in ${targetShark.yod}</p>
            <p style="font-size: 16px; margin: 10px 0; opacity: 0.9;">You took ${guessesTaken} guess${guessesTaken !== 1 ? 'es' : ''}.</p>
            <div style="margin: 20px 0; padding: 15px; background: rgba(255,255,255,0.2); border-radius: 8px;">
                <p style="font-size: 28px; font-weight: bold; margin: 0; color: inherit;">+${xpGain} XP</p>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 25px; justify-content: center;">
                <button onclick="location.reload()" style="padding: 12px 25px; font-size: 15px; cursor: pointer; background: rgba(255,255,255,0.3); border: none; border-radius: 6px; color: inherit; font-weight: bold; transition: background 0.3s;">Play Again</button>
                <button onclick="window.location.href='index.html'" style="padding: 12px 25px; font-size: 15px; cursor: pointer; background: rgba(0,0,0,0.3); border: none; border-radius: 6px; color: inherit; font-weight: bold; transition: background 0.3s;">Back to Home</button>
            </div>
        `;
        winLoseScreen.classList.add("win");
        winLoseScreen.classList.remove("lose");
        winLoseScreen.style.display = "block";
        document.getElementById('show-results-btn').style.display = 'none';
        createBubbles();
        
    } else if (attempts === 0) {
        updateStats(false);
        
        // Check achievements for loss conditions
        if (window.checkAchievements) {
            window.checkAchievements(false, 12, false);
        }
        
        // Disable input
        document.getElementById("sharkGuess").disabled = true;
        document.getElementById("guessBtn").disabled = true;
        
        // Display lose screen
        winLoseScreen.innerHTML = `
            <button onclick="document.getElementById('win-lose-screen').style.display='none'; document.getElementById('show-results-btn').style.display='block';" style="position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; background: rgba(0,0,0,0.3); border: none; border-radius: 50%; color: inherit; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; font-weight: bold;">×</button>
            <h2 style="margin-top: 0; font-size: 32px; margin-bottom: 20px;">😢 You Lost</h2>
            <p style="font-size: 18px; margin: 10px 0; color: inherit;">The shark was <b>${targetShark.name}</b></p>
            <p style="font-size: 16px; margin: 10px 0; opacity: 0.9;">Discovered in ${targetShark.yod}</p>
            <div style="display: flex; gap: 10px; margin-top: 25px; justify-content: center;">
                <button onclick="location.reload()" style="padding: 12px 25px; font-size: 15px; cursor: pointer; background: rgba(255,255,255,0.3); border: none; border-radius: 6px; color: inherit; font-weight: bold; transition: background 0.3s;">Try Again</button>
                <button onclick="window.location.href='index.html'" style="padding: 12px 25px; font-size: 15px; cursor: pointer; background: rgba(0,0,0,0.3); border: none; border-radius: 6px; color: inherit; font-weight: bold; transition: background 0.3s;">Back to Home</button>
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

    let commonName;
    if (item.category === "Family") {
        commonName = common_names.find(cn => cn.scientific === shark.family);
    } else if (item.category === "Order") {
        commonName = common_names.find(cn => cn.scientific === shark.order);
    } else if (item.category === "Genus") {
        commonName = common_names.find(cn => cn.scientific === shark.genus);
    }

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
        const tooltip = document.createElement("div");
        tooltip.className = "tooltip";
        tooltip.textContent = `${item.category}: ${displayValue}${arrow}`;

        const tooltipText = document.createElement("span");
        tooltipText.className = "tooltiptext";
        tooltipText.textContent = commonName.Common;

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
    ).slice(0, 10); // Limit to 10 suggestions
    
    if (matches.length === 0) {
        suggestionsDiv.classList.remove("active");
        return;
    }
    
    // Build suggestions HTML
    suggestionsDiv.innerHTML = matches.map(shark => {
        const isGuessed = shark.guessed === true;
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

// Console command for testing: revealShark() - Dev only
window.revealShark = function() {
    const DEV_UIDS = ['ETPtQC0VA2NiSnX67rS2P2ma2tC2', 'gOcPqOuyPJRWisE4dxvFkGTOl5g2'];
    if (!firebase.auth().currentUser || !DEV_UIDS.includes(firebase.auth().currentUser.uid)) {
        console.log("Access denied. This command is for developers only.");
        return;
    }
    console.log("TESTING ONLY: The target shark is: " + targetShark.name);
};
