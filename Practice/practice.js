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
            title: "Sharkdle - Practice",
            kicker: "Practice Mode",
            heading: "Guess the Shark",
            lead: "Think you know this shark? Make your guess below.",
            placeholder: "Enter shark name...",
            animal: "shark",
            animalTitle: "Shark",
            heroBackground: HERO_ART.sharkBg,
            heroForeground: HERO_ART.sharkFg
        },
        rays: {
            key: "rays",
            title: "Raydle - Practice",
            kicker: "Practice Rays",
            heading: "Guess the Ray",
            lead: "Think you know this ray? Make your guess below.",
            placeholder: "Enter ray name...",
            animal: "ray",
            animalTitle: "Ray",
            heroBackground: HERO_ART.manta,
            heroForeground: HERO_ART.manta
        },
        mixed: {
            key: "mixed",
            title: "Sharkdle - Mixed Practice",
            kicker: "Mixed Practice",
            heading: "Guess the Species",
            lead: "Sharks and rays share the board. Make your guess below.",
            placeholder: "Enter shark or ray name...",
            animal: "species",
            animalTitle: "Species",
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

applySpeciesModeCopy();

let lastFamily = localStorage.getItem(speciesMode.key === "sharks" ? "practiceLastFamily" : `practiceLastFamily_${speciesMode.key}`);
let targetIndex;
do {
  targetIndex = Math.floor(Math.random() * activeSpecies.length);
} while (lastFamily && activeSpecies.length > 1 && activeSpecies[targetIndex].family === lastFamily);
let targetShark = activeSpecies[targetIndex];
localStorage.setItem(speciesMode.key === "sharks" ? "practiceLastFamily" : `practiceLastFamily_${speciesMode.key}`, targetShark.family);
let guessesMade = 0;

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

function makeGuess() {
    const rawInput = document.getElementById("sharkGuess").value.trim();
    const guessInput = normalizeInput(rawInput);
    const messageDiv = document.getElementById("message");
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
    guessesMade++;
    
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
        // Disable input
        document.getElementById("sharkGuess").disabled = true;
        document.getElementById("guessBtn").disabled = true;
        
        // Display win screen - no XP or stats
        winLoseScreen.innerHTML = `
            <button onclick="document.getElementById('win-lose-screen').style.display='none'; document.getElementById('show-results-btn').style.display='block';" style="position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; background: rgba(0,0,0,0.3); border: none; border-radius: 50%; color: inherit; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; font-weight: bold;">×</button>
            <h2 style="margin-top: 0; font-size: 32px; margin-bottom: 20px;">🎉 You Found It!</h2>
            <p style="font-size: 18px; margin: 10px 0; color: inherit;">The ${speciesMode.animal} was <b>${targetShark.name}</b></p>
            <p style="font-size: 16px; margin: 10px 0; opacity: 0.9;">Discovered in ${targetShark.yod}</p>
            <p style="font-size: 16px; margin: 10px 0; opacity: 0.9;">You took ${guessesMade} guess${guessesMade !== 1 ? 'es' : ''}.</p>
            <div style="margin: 20px 0; padding: 15px; background: linear-gradient(135deg, rgba(0, 180, 216, 0.15), rgba(77, 208, 225, 0.1)); border-radius: 8px; border: 2px solid rgba(77, 208, 225, 0.3);">
                <p style="font-size: 16px; margin: 0; color: #e14d4d; font-weight: 600;">⚠️ This is practice mode - no stats recorded</p>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 25px; justify-content: center;">
                <button onclick="location.reload()" style="padding: 12px 25px; font-size: 15px; cursor: pointer; background: rgba(255,255,255,0.3); border: none; border-radius: 6px; color: inherit; font-weight: bold; transition: background 0.3s;">Play Again</button>
                <button onclick="window.location.href=resolveAppPath('index.html')" style="padding: 12px 25px; font-size: 15px; cursor: pointer; background: rgba(0,0,0,0.3); border: none; border-radius: 6px; color: inherit; font-weight: bold; transition: background 0.3s;">Back to Home</button>
            </div>
        `;
        winLoseScreen.classList.add("win");
        winLoseScreen.classList.remove("lose");
        winLoseScreen.style.display = "block";
        document.getElementById('show-results-btn').style.display = 'none';
        createBubbles();
        
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

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById("guessBtn").onclick = makeGuess;
    document.getElementById("sharkGuess").addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            makeGuess();
        }
    });
});


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

function createBubbles() {
  for (let i = 0; i < 100; i++) {
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.style.left = Math.random() * 100 + "%";
    bubble.style.width = (Math.random() * 20 + 10) + "px";
    bubble.style.height = bubble.style.width;
    bubble.style.bottom = "-10px";
    bubble.style.opacity = Math.random() * 0.5 + 0.2;
    document.body.appendChild(bubble);

    const duration = Math.random() * 3 + 2;
    bubble.animate(
      [
        { transform: "translateY(0px)", opacity: Math.random() * 0.5 + 0.2 },
        { transform: `translateY(${window.innerHeight + 10}px)`, opacity: 0 },
      ],
      {
        duration: duration * 1000,
        easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      }
    );

    setTimeout(() => bubble.remove(), duration * 1000);
  }
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
