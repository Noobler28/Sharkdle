const STORY_STORAGE_KEY = "sharkdle_story_mode_v2";
const ACHIEVEMENT_STORAGE_KEY = "unlockedAchievements";
const STORY_IMAGE_SHARKS_PER_CHAPTER = 5;

const areaDefinitions = [
        {
            id: "atlantic",
            name: "Atlantic Ocean",
            label: "Chapter 1 - Atlantic Anomalies",
            left: 36,
            top: 48,
        sharks: ["White Shark", "Blue Shark", "Shortfin Mako Shark", "Common Thresher Shark", "Sandbar Shark"],
        nonSharks: [
            "Epaulette Shark",
            "Port Jackson Shark",
            "Japanese Bullhead Shark",
            "Japanese Wobbegong",
            "Spotted Wobbegong",
            "Ornate Wobbegong",
            "Brown-banded Bamboo Shark",
            "Salmon Shark"
        ],
        narrative: "The Atlantic database is bleeding. Tags are going dark, species are mislabeled in the logs, and migration corridors are corrupted beyond recognition. You must rebuild the Atlantic database.",
        completionNarrative: "Dr. Finn's acknowledgment comes through the secure line: 'Good job, {playerUsername}! Atlantic records are restored. But the Pacific has gone dark. Head there immediately and figure out what's happening.'",
        facts: [
            "White Sharks are partially endothermic, able to maintain body heat above surrounding water temperature to hunt in colder waters.",
            "Blue Sharks are highly migratory, traveling thousands of miles across ocean basins following prevailing currents.",
            "Common Thresher Sharks use their elongated upper tail lobes to stun schools of fish before feeding.",
            "Shortfin Mako Sharks are the fastest sharks in the ocean, capable of bursts exceeding 60 mph during hunts.",
            "White Sharks are known to exit completely out of the water when hunting seals, a behavior called 'breaching.'",
        ],
        falseFacts: [
            "Sandbar Sharks are the fastest sharks in the ocean, capable of bursts exceeding 60 mph during hunts.",
            "The Thresher Shark uses its long tail to dig into the sand and ambush prey from below.",
            "The Blue Shark is a bottom-dwelling species that rarely ventures into open water, preferring to hide among rocks and reefs.",
            "The White Shark is a filter feeder that consumes only plankton.",
            "Shortfin Mako Sharks are known for their unusually slow swimming speeds, often drifting with currents.",
            "The Blue Shark can survive in both freshwater and saltwater environments.",
        ],
        challenges: [
            { name: "Species Identification", desc: "Select the sharks that belong to the Atlantic Ocean." },
            { name: "Image Mix Up", desc: "Match pictures to their Names." },
            { name: "Region Report", desc: "Sort true and false Atlantic field reports." }
        ]
    },
    {
    id: "pacific",
    name: "Pacific Ocean",
    label: "Chapter 2 - Pacific Problems",
    left: 13,
    top: 52,
    sharks: ["Tiger Shark", "Whale Shark", "Oceanic Whitetip Shark", "Goblin Shark", "Salmon Shark"],
    nonSharks: [
        "Atlantic Sharpnose Shark",
        "Caribbean Reef Shark",
        "Smalltail Shark",
        "Atlantic Angel Shark",
        "Porbeagle Shark",
        "Bonnethead Shark",
        "Leopard Catshark"
    ],
    narrative: "You arrive at the central Pacific hub. Dr. Finn reroutes you: '{playerUsername} whatever corrupted the Atlantic has spread. The Pacific dataset is fragmenting Stabilize the region before the damage cascades.'",
    completionNarrative: "A secure ping hits your console. Dr. Finn again: 'Excellent work, {playerUsername}. The Pacific records are back online, something’s wrong in the Indian Ocean. The corruption is accelerating. Get there immediately.'",
    facts: [
        "Tiger Sharks have one of the broadest diets of any shark, consuming fish, turtles, birds, and even inedible debris.",
        "Goblin Sharks possess protrusible jaws that can snap forward to capture prey in deep waters.",
        "Whale Sharks are the largest fish in the world and feed primarily on plankton.",
        "Salmon Sharks can regulate their body temperature, allowing them to hunt in cold North Pacific waters.",
        "Oceanic Whitetip Sharks are known for following shipwrecks and debris fields across the open ocean."
    ],
    falseFacts: [
        "Tiger Sharks only live in freshwater rivers and never enter the open ocean.",
        "Goblin Sharks are shallow-water reef hunters commonly seen by snorkelers.",
        "Whale Sharks are apex predators that actively hunt dolphins and seals.",
        "Salmon Sharks migrate annually to the Atlantic Ocean to breed.",
        "Oceanic Whitetip Sharks spend their entire lives resting on the seafloor."
    ],
    challenges: [
        { name: "Species Identification", desc: "Select the sharks that belong to the Pacific Ocean." },
        { name: "Image Mix Up", desc: "Match pictures to their names." },
        { name: "Region Report", desc: "Sort true and false Pacific field reports." }
    ]
    },
    {
        id: "indian",
        name: "Indian Ocean",
        label: "Chapter 3 - Indian Intricacies",
        left: 64,
        top: 65,
        sharks: ["Bull Shark", "Zebra Shark", "Nurse Shark", "Grey Reef Shark", "Whitetip Reef Shark"],
        nonSharks: [
            "Atlantic Sharpnose Shark",
            "Caribbean Reef Shark",
            "Porbeagle Shark",
            "Port Jackson Shark",
            "Japanese Bullhead Shark",
            "Japanese Wobbegong",
            "Salmon Shark",
            "Epaulette Shark"
        ],
        narrative: "The corruption has reached the Indian Ocean. Reef survey beacons are broadcasting the wrong species, and migration corridors through the Red Sea and Bay of Bengal are scrambled. Dr. Finn patches in: '{playerUsername}, the Indian dataset is collapsing. Rebuild it before the Mediterranean grid goes dark.'",
        completionNarrative: "Dr. Finn exhales over the comms: 'Indian records stabilized, {playerUsername}. Beautiful work. The Mediterranean hub is already flickering move west and contain the breach before it spreads through European waters.'",
        facts: [
            "Bull Sharks can tolerate both saltwater and freshwater, and have been recorded far up major rivers.",
            "Zebra Sharks are also called leopard sharks in some regions because adults lose their striped pattern.",
            "Nurse Sharks are nocturnal bottom-dwellers that often rest together in caves and ledges during the day.",
            "Grey Reef Sharks perform threat displays, including an arched back posture, when defending reef territories.",
            "Whitetip Reef Sharks are highly site-attached and commonly patrol the same reef sections each night."
        ],
        falseFacts: [
            "Bull Sharks cannot enter freshwater and are restricted to open ocean depth zones.",
            "Zebra Sharks are filter feeders that consume only microscopic plankton.",
            "Nurse Sharks are the fastest pelagic hunters in the Indian Ocean.",
            "Grey Reef Sharks are strictly deep-sea species never found on coral reefs.",
            "Whitetip Reef Sharks migrate annually to the Arctic to breed.",
            "Bull Sharks lack the ability to osmoregulate in changing salinity."
        ],
            challenges: [
                { name: "Species Identification", desc: "Select the sharks that belong to the Indian Ocean." },
                { name: "Image Mix Up", desc: "Match pictures to their names." },
                { name: "Region Report", desc: "Sort true and false Indian Ocean field reports." }
            ]
    },
    {
        id: "mediterranean",
        name: "Mediterranean Sea",
        label: "Chapter 4 - Mediterranean Mysteries",
        left: 54,
        top: 41,
        sharks: ["Angelshark", "Smalltooth Sand Tiger", "Smooth Hammerhead", "Tope Shark", "Basking Shark"],
        nonSharks: [
            "Epaulette Shark",
            "Port Jackson Shark",
            "Japanese Bullhead Shark",
            "Japanese Wobbegong",
            "Spotted Wobbegong",
            "Ornate Wobbegong",
            "Brown-banded Bamboo Shark",
            "Salmon Shark"
        ],
        narrative: "You reach the Mediterranean monitoring station at dusk. Historical logs are overwriting live telemetry, and centuries of expedition notes are blending into one corrupted archive. Dr. Finn warns: '{playerUsername}, this sea connects three continents. Fix the Mediterranean records before the error propagates to every linked database.'",
        completionNarrative: "The Mediterranean grid steadies. Dr. Finn: 'Excellent, {playerUsername}. The western records hold for now. Australian telemetry just flatlined. Cross the map and restore the South Pacific sector next.'",
        facts: [
            "Blue Sharks are highly migratory and often travel in sexually segregated groups across ocean basins.",
            "Shortfin Mako Sharks are among the fastest sharks and can maintain elevated body temperatures.",
            "Smooth Hammerheads have a broadly curved head with no central indentation compared with scalloped species.",
            "Tope Sharks are slender coastal predators also known as school sharks in several regions.",
            "Basking Sharks are enormous filter feeders that strain plankton through modified gill rakers."
        ],
        falseFacts: [
            "Blue Sharks are strictly freshwater fish confined to river deltas.",
            "Shortfin Mako Sharks are unable to swim faster than 5 mph.",
            "Smooth Hammerheads use bioluminescent lures on their head to attract prey in darkness.",
            "Tope Sharks are herbivorous grazers that feed on seagrass meadows.",
            "Basking Sharks actively hunt seals near Mediterranean beaches.",
            "Blue Sharks never cross ocean basins and remain in one bay for life."
        ],
            challenges: [
                { name: "Species Identification", desc: "Select the sharks that belong to the Mediterranean Sea." },
                { name: "Image Mix Up", desc: "Match pictures to their names." },
                { name: "Region Report", desc: "Sort true and false Mediterranean field reports." }
            ]
    },
    {
        id: "australia",
        name: "Australia",
        label: "Chapter 5 - Australian Anomalies",
        left: 85,
        top: 80,
        sharks: ["Spotted Wobbegong", "Port Jackson Shark", "Epaulette Shark", "Gummy Shark", "Australian Angel Shark"],
        nonSharks: [
            "Atlantic Sharpnose Shark",
            "Caribbean Reef Shark",
            "Porbeagle Shark",
            "Smalltail Shark",
            "Salmon Shark",
            "Japanese Bullhead Shark",
            "Leopard Catshark",
            "Bonnethead Shark"
        ],
        narrative: "Australian reef nodes are reporting impossible species pairings desert sharks, polar threshers, and deep-sea species logged in ankle-deep tide pools. '{playerUsername}, the Great Barrier telemetry mesh is failing,' Dr. Finn says. 'Clean the Australian records before the southern hemisphere grid collapses.'",
        completionNarrative: "Australian archives re-sync. Dr. Finn: 'The reef data is back, {playerUsername}. But South African stations are screaming errors. Head to the Cape sector the corruption is circling the globe.'",
        facts: [
            "Spotted Wobbegongs use ornate camouflage patterns to ambush prey on rocky and reef bottoms.",
            "Port Jackson Sharks lay distinctive spiral-shaped egg cases often called mermaid purses.",
            "Epaulette Sharks can survive low oxygen by slowing movement and using fins to walk across reef flats.",
            "Gummy Sharks are slender coastal species common around southern Australia.",
            "Australian Angel Sharks bury themselves in sand and strike small fish passing overhead."
        ],
        falseFacts: [
            "Spotted Wobbegongs are open-ocean filter feeders that never rest on the seafloor.",
            "Port Jackson Sharks give live birth to hundreds of pups in midwater.",
            "Epaulette Sharks can only survive in freezing Antarctic waters.",
            "Gummy Sharks are giant plankton feeders exceeding 12 meters in length.",
            "Australian Angel Sharks hunt exclusively at the surface using jumping breaches.",
            "Epaulette Sharks are unable to move when oxygen levels drop."
        ],
        challenges: [
            { name: "Species Identification", desc: "Select the sharks that belong to Australia." },
            { name: "Image Mix Up", desc: "Match pictures to their names." },
            { name: "Region Report", desc: "Sort true and false Australian field reports." }
        ]
    },
    {
        id: "south_africa",
        name: "South Africa",
        label: "Chapter 6 - Cape Corruption",
        left: 55,
        top: 76,
        sharks: ["White Shark", "Sand Tiger Shark", "Leopard Catshark", "Copper Shark", "Scalloped Hammerhead"],
        nonSharks: [
            "Port Jackson Shark",
            "Japanese Bullhead Shark",
            "Japanese Wobbegong",
            "Epaulette Shark",
            "Spotted Wobbegong",
            "Atlantic Sharpnose Shark",
            "Caribbean Reef Shark",
            "Bonnethead Shark"
        ],
        narrative: "Cape tracking stations are merging Atlantic and Indian species lists into a single corrupted file. Seal colony cameras are tagging dolphins as threshers. Dr. Finn: '{playerUsername}, South Africa is a biodiversity crossroads. Restore the Cape database before the error jumps the Atlantic again.'",
        completionNarrative: "South African telemetry clears. Dr. Finn: 'Cape records secured, {playerUsername}. The corruption just resurfaced on the US East Coast, same signature as the original Atlantic breach. Finish the loop back where this started.'",
        facts: [
            "White Sharks patrol the waters around South Africa and are famous for hunting near seal colonies.",
            "Sand Tiger Sharks hover in groups above wrecks and reefs despite their fierce appearance.",
            "Leopard Catsharks are small nocturnal species with distinctive spotted patterns along the Cape coast.",
            "Copper Sharks, also called bronze whalers, form seasonal aggregations in cooler temperate waters.",
            "Scalloped Hammerheads gather in large schools around seamounts and continental shelf edges."
        ],
        falseFacts: [
            "White Sharks are strictly freshwater predators found only in rivers.",
            "Sand Tiger Sharks are herbivorous and feed on kelp forests.",
            "Leopard Catsharks are open-ocean giants exceeding 8 meters in length.",
            "Copper Sharks cannot tolerate temperate water and live only in the Arctic.",
            "Scalloped Hammerheads never form groups and are strictly solitary.",
            "White Sharks lack the ability to detect prey using electroreception."
        ],
        challenges: [
            { name: "Species Identification", desc: "Identify species from South African waters." },
            { name: "Image Mix Up", desc: "Match pictures to their names." },
            { name: "Region Report", desc: "Sort true and false South African field reports." }
        ]
    },
    {
        id: "usa_east",
        name: "USA (East Coast)",
        label: "Chapter 7 - Atlantic Return",
        left: 28,
        top: 38,
        sharks: ["Sand Tiger Shark", "Dusky Shark", "Spinner Shark", "Blacktip Shark", "Bonnethead Shark"],
        nonSharks: [
            "Port Jackson Shark",
            "Japanese Bullhead Shark",
            "Japanese Wobbegong",
            "Epaulette Shark",
            "Spotted Wobbegong",
            "Zebra Shark",
            "Gummy Shark",
            "Leopard Catshark"
        ],
        narrative: "The corruption has come full circle. East Coast receivers are replaying the same Atlantic glitch that started this crisis, but amplified, duplicate species tags, inverted migration paths, and ghost sightings in the Chesapeake. '{playerUsername}, close the loop,' Dr. Finn urges. 'Rebuild the US East Coast archive.'",
        completionNarrative: "East Coast data stabilizes. Dr. Finn: 'Almost there, {playerUsername}. One last hotspot remains, Japan. Ancient species records and deep trench nodes are still corrupt. Finish this in the Pacific Rim sector.'",
        facts: [
            "Sand Tiger Sharks are common along the US East Coast and often seen hovering near wrecks.",
            "Dusky Sharks are large coastal carcharhinids with long-distance seasonal migrations.",
            "Spinner Sharks are named for leaping and spinning out of the water while feeding on fish schools.",
            "Blacktip Sharks are fast reef and coastal predators with dark fin margins.",
            "Bonnethead Sharks are the smallest hammerhead species and often forage in seagrass depth zones."
        ],
        falseFacts: [
            "Sand Tiger Sharks are freshwater catfish unrelated to true sharks.",
            "Dusky Sharks cannot swim and remain buried in sand year-round.",
            "Spinner Sharks are incapable of jumping and only crawl along the seabed.",
            "Blacktip Sharks are filter feeders that consume only krill.",
            "Bonnethead Sharks lack a hammer-shaped head and have a pointed snout like a swordfish.",
            "Spinner Sharks live exclusively in the Mediterranean Sea."
        ],
        challenges: [
            { name: "Species Identification", desc: "Identify sharks tied to the USA East Coast." },
            { name: "Image Mix Up", desc: "Match pictures to their names." },
            { name: "Region Report", desc: "Sort true and false USA East Coast field reports." }
        ]
    },
    {
        id: "japan",
        name: "Japan",
        label: "Chapter 8 - Realm of the Ancients",
        left: 87,
        top: 36,
        sharks: ["Japanese Bullhead Shark", "Frilled Shark", "Megamouth Shark", "Brown-banded Bamboo Shark", "Japanese Wobbegong"],
        nonSharks: [
            "Atlantic Sharpnose Shark",
            "Caribbean Reef Shark",
            "Smalltail Shark",
            "Atlantic Angel Shark",
            "Port Jackson Shark",
            "Epaulette Shark",
            "Spotted Wobbegong",
            "Bonnethead Shark"
        ],
        narrative: "The final corrupted node sits beneath the Pacific Ring of Fire, a deep archive of living fossils and abyssal species. Frilled shark telemetry is timestamped from the surface, and megamouth records are duplicating across every ocean. Dr. Finn: '{playerUsername}, this is the root cluster. Restore Japan's records and we can rebuild the global shark database.'",
        completionNarrative: "Every map sector flashes green. Dr. Finn laughs, exhausted: 'You did it, {playerUsername}. The global shark database is whole again. Take a break, you've earned it. The oceans are back online because of you.'",
        facts: [
            "Japanese Bullhead Sharks are small horn sharks with distinctive ridges above the eyes.",
            "Frilled Sharks are primitive deep-water species with serpentine bodies and needle-like teeth.",
            "Megamouth Sharks are rare filter feeders discovered in the late twentieth century.",
            "Brown-banded Bamboo Sharks are nocturnal carpet sharks often kept in public aquariums.",
            "Japanese Wobbegongs rely on camouflage to ambush prey on rocky reef bottoms."
        ],
        falseFacts: [
            "Japanese Bullhead Sharks are giant pelagic hunters exceeding 6 meters in length.",
            "Frilled Sharks live exclusively in shallow tropical tide pools.",
            "Megamouth Sharks actively hunt large marine mammals with serrated teeth.",
            "Brown-banded Bamboo Sharks are open-ocean speed specialists reaching 70 mph.",
            "Japanese Wobbegongs are filter feeders that strain plankton with baleen plates.",
            "Frilled Sharks are closely related to modern great white sharks and share the same hunting style."
        ],
        challenges: [
            { name: "Species Identification", desc: "Identify sharks uniquely tied to Japan." },
            { name: "Image Mix Up", desc: "Match pictures to their names." },
            { name: "Region Report", desc: "Sort true and false Japanese field reports." }
        ]
    }
];

const areaOrder = areaDefinitions.map(area => area.id);

const STORY_CHAPTER_FOLDER_ALIASES = {
    atlantic: ["chapter1", "chapterOne"],
    pacific: ["chapter2", "chapterTwo"],
    indian: ["chapter3", "chapterThree"],
    mediterranean: ["chapter4", "chapterFour"],
    australia: ["chapter5", "chapterFive"],
    south_africa: ["chapter6", "chapterSix"],
    usa_east: ["chapter7", "chapterSeven"],
    japan: ["chapter8", "chapterEight"]
};

const STORY_SHARK_NUMBER_WORDS = ["One", "Two", "Three", "Four", "Five"];

function getStoryChapterFolders(areaId) {
    return STORY_CHAPTER_FOLDER_ALIASES[areaId] || [`chapter${getAreaIndex(areaId) + 1}`];
}

function getStorySharkFileNames(sharkIndex) {
    const sharkNumber = sharkIndex + 1;
    const word = STORY_SHARK_NUMBER_WORDS[sharkIndex] || String(sharkNumber);
    return [
        `shark${sharkNumber}.png`,
        `Shark${sharkNumber}.png`,
        `Shark${word}.png`
    ];
}

function getStorySharkImageCandidates(areaId, sharkIndex) {
    const folders = getStoryChapterFolders(areaId);
    const fileNames = getStorySharkFileNames(sharkIndex);
    const candidates = [];

    folders.forEach(folder => {
        fileNames.forEach(fileName => {
            candidates.push(`images/storyMode/${folder}/${fileName}`);
        });
    });

    return [...new Set(candidates)];
}

function getStorySharkImagePath(areaId, sharkIndex) {
    return getStorySharkImageCandidates(areaId, sharkIndex)[0];
}

function applyStorySharkImage(img, areaId, sharkIndex) {
    const candidates = getStorySharkImageCandidates(areaId, sharkIndex);
    let candidateIndex = 0;

    img.onerror = () => {
        candidateIndex += 1;
        if (candidateIndex < candidates.length) {
            img.src = candidates[candidateIndex];
            return;
        }
        img.onerror = null;
        img.src = "images/pfp/shark1.png";
    };

    img.src = candidates[0];
}

function getStoryFeaturedSharks(area) {
    return (area?.sharks || []).slice(0, STORY_IMAGE_SHARKS_PER_CHAPTER);
}

const areaAchievementMap = {
    atlantic: "atlantic_master",
    pacific: "pacific_master",
    indian: "indian_master",
    mediterranean: "mediterranean_master",
    australia: "australia_master",
    south_africa: "sothafrica_master",
    usa_east: "usa_master",
    japan: "japan_master"
};

let storyState = null;
let currentOpenAreaId = null;

function defaultStoryState() {
    const areas = {};
    areaDefinitions.forEach((area, index) => {
        areas[area.id] = {
            unlocked: index === 0,
            completed: false,
            challenges: [false, false, false]
        };
    });

    return { areas };
}

function loadStoryState() {
    const base = defaultStoryState();
    try {
        const raw = localStorage.getItem(STORY_STORAGE_KEY);
        if (raw) {
            const saved = JSON.parse(raw);
            areaDefinitions.forEach(area => {
                const savedArea = saved?.areas?.[area.id];
                if (savedArea) {
                    base.areas[area.id] = {
                        unlocked: Boolean(savedArea.unlocked),
                        completed: Boolean(savedArea.completed),
                        challenges: [0, 1, 2].map(index => Boolean(savedArea.challenges?.[index]))
                    };
                }
            });
        }
    } catch (error) {
        console.warn("Failed to parse story state:", error);
    }

    applyLegacyUnlocks(base);
    storyState = base;
    syncLegacyProgress();
}

function applyLegacyUnlocks(state) {
    const legacyProgress = parseInt(localStorage.getItem("storyProgress") || "0", 10);
    if (Number.isFinite(legacyProgress) && legacyProgress > 0) {
        for (let i = 0; i <= Math.min(legacyProgress, areaDefinitions.length - 1); i++) {
            state.areas[areaDefinitions[i].id].unlocked = true;
        }
    }

    if (localStorage.getItem("atlanticCrosswordComplete") === "true") {
        state.areas.atlantic.unlocked = true;
        state.areas.atlantic.completed = true;
        state.areas.atlantic.challenges = [true, true, true];
        if (state.areas.pacific) state.areas.pacific.unlocked = true;
    }

    if (localStorage.getItem("pacificWordsearchComplete") === "true" || localStorage.getItem("pacificUnlocked") === "true") {
        state.areas.pacific.unlocked = true;
        if (localStorage.getItem("pacificWordsearchComplete") === "true") {
            state.areas.pacific.completed = true;
            state.areas.pacific.challenges = [true, true, true];
            if (state.areas.indian) state.areas.indian.unlocked = true;
        }
    }

    if (localStorage.getItem("indianUnlocked") === "true" && state.areas.indian) {
        state.areas.indian.unlocked = true;
    }
}

function saveStoryState() {
    localStorage.setItem(STORY_STORAGE_KEY, JSON.stringify(storyState));
    syncLegacyProgress();
}

function syncLegacyProgress() {
    let highestUnlocked = 0;
    areaDefinitions.forEach((area, index) => {
        const areaState = storyState.areas[area.id];
        if (areaState.unlocked || areaState.completed) highestUnlocked = index;
        if (areaState.completed) {
            localStorage.setItem(`storyAreaCompleted_${area.id}`, "true");
        }
    });

    localStorage.setItem("storyProgress", String(highestUnlocked));
    if (storyState.areas.atlantic.completed) {
        localStorage.setItem("atlanticCrosswordComplete", "true");
        localStorage.setItem("pacificUnlocked", "true");
    }
    if (storyState.areas.pacific.unlocked || storyState.areas.pacific.completed) {
        localStorage.setItem("pacificUnlocked", "true");
    }
    if (storyState.areas.pacific.completed || storyState.areas.indian.unlocked || storyState.areas.indian.completed) {
        localStorage.setItem("indianUnlocked", "true");
        localStorage.setItem("pacificWordsearchComplete", "true");
    }
}

function awardStoryAchievement(achievementId) {
    if (!achievementId) return;
    if (typeof window.unlockAchievement === "function") {
        window.unlockAchievement(achievementId);
        return;
    }
    const unlocked = JSON.parse(localStorage.getItem(ACHIEVEMENT_STORAGE_KEY) || "[]");
    if (!unlocked.includes(achievementId)) {
        unlocked.push(achievementId);
        localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(unlocked));
    }
}

function getAreaState(areaId) {
    return storyState.areas[areaId];
}

function getAreaIndex(areaId) {
    return areaOrder.indexOf(areaId);
}

function completeChallenge(areaId, challengeIndex) {
    const areaState = getAreaState(areaId);
    areaState.challenges[challengeIndex] = true;

    if (areaState.challenges.every(Boolean)) {
        completeArea(areaId);
    }

    saveStoryState();
    renderMap();
}

function completeArea(areaId) {
    const areaState = getAreaState(areaId);
    areaState.completed = true;
    awardStoryAchievement(areaAchievementMap[areaId]);

    const currentIndex = getAreaIndex(areaId);
    const nextArea = areaDefinitions[currentIndex + 1];
    if (nextArea) {
        storyState.areas[nextArea.id].unlocked = true;
    }
}

function renderMap() {
    const pins = document.getElementById("map-pins");
    pins.innerHTML = "";

    areaDefinitions.forEach(area => {
        const areaState = getAreaState(area.id);
        const pin = document.createElement("div");
        pin.className = "map-pin";
        pin.style.left = `${area.left}%`;
        pin.style.top = `${area.top}%`;

        const btn = document.createElement("button");
        btn.className = "map-pin-btn";
        btn.disabled = !areaState.unlocked;
        btn.title = area.name;
        btn.textContent = areaState.completed ? "✓" : areaState.unlocked ? "🦈" : "🔒";
        btn.onclick = () => openAreaModal(area.id);

        const label = document.createElement("div");
        label.className = "map-pin-label";
        label.textContent = area.name;

        pin.appendChild(btn);
        pin.appendChild(label);
        pins.appendChild(pin);
    });
}

async function openAreaModal(areaId) {
    const area = areaDefinitions.find(entry => entry.id === areaId);
    const areaState = getAreaState(areaId);
    const modal = document.getElementById("area-modal");
    const closeBtn = document.getElementById("close-modal");
    const title = document.getElementById("modal-title");
    const challengesContainer = document.getElementById("challenges-container");
    const challengeView = document.getElementById("pairs-game-container");
    const label = document.querySelector(".story-modal-area-label");
    const narrative = document.getElementById("story-modal-narrative");
    const progressBar = document.getElementById("story-modal-progress-bar");
    const progressLabel = document.getElementById("story-modal-progress-label");

    currentOpenAreaId = areaId;

    title.textContent = `🌊 ${area.name}`;
    if (label) label.innerHTML = `<span class="area-icon"></span> ${area.label}`;

    // Ensure user profile is loaded so the correct username is available in narrative
    if (typeof currentUser !== 'undefined' && currentUser && typeof loadUserProfile === 'function') {
        const profile = typeof getCurrentProfileData === 'function' ? getCurrentProfileData() : null;
        if (!profile || !profile.username) {
            try {
                await loadUserProfile();
            } catch (e) {
                console.warn("Failed to load user profile for narrative:", e);
            }
        }
    }

    if (narrative) {
        narrative.textContent = areaState.completed
            ? interpolateNarrative(area.completionNarrative)
            : interpolateNarrative(area.narrative);
    }

    const completeCount = areaState.challenges.filter(Boolean).length;
    progressBar.style.width = `${(completeCount / 3) * 100}%`;
    progressLabel.textContent = `${completeCount}/3 Challenges Complete`;

    challengeView.style.display = "none";
    challengeView.innerHTML = "";
    challengesContainer.innerHTML = "";

    const challengeDefinitions = [
        { ...(area.challenges?.[0] || { name: "Signal Scan", desc: "Pick the sharks that belong to this region." }), start: () => startSpeciesQuiz(areaId) },
            { ...(area.challenges?.[1] || { name: "Image Mix Up", desc: "Match pictures to their Names." }), start: () => {
                const challengeName = area.challenges?.[1]?.name || "Image Mix Up";
                if (challengeName === "Image Mix Up") {
                    startPairsChallenge(areaId);
                } else {
                    startUnscrambleChallenge(areaId);
                }
            }},
        { ...(area.challenges?.[2] || { name: "Region Report", desc: "Sort true and false field reports." }), start: () => startTrueFalseChallenge(areaId) }
    ];

    challengeDefinitions.forEach((challenge, index) => {
        const btn = document.createElement("button");
        btn.className = "challenge-btn";
        btn.style.marginBottom = "12px";
        btn.innerHTML = `<b>${challenge.name}</b><br><span style="font-size:13px;opacity:0.9;">${challenge.desc}</span>`;
        btn.disabled = index > 0 && !areaState.challenges[index - 1];
        if (areaState.challenges[index]) {
            btn.style.background = "linear-gradient(90deg, #4caf50, #81c784)";
        }
        btn.onclick = challenge.start;
        challengesContainer.appendChild(btn);
    });

    closeBtn.onclick = () => {
        modal.style.display = "none";
        challengeView.style.display = "none";
        currentOpenAreaId = null;
    };

    modal.onclick = event => {
        if (event.target === modal) {
            modal.style.display = "none";
            currentOpenAreaId = null;
        }
    };

    modal.style.display = "flex";
}

function getOtherAreaSharks(areaId) {
    return areaDefinitions
        .filter(area => area.id !== areaId)
        .flatMap(area => area.sharks)
        .filter(Boolean);
}

function showChallengeView(renderFn) {
    const challengeView = document.getElementById("pairs-game-container");
    challengeView.style.display = "block";
    challengeView.innerHTML = "";
    renderFn(challengeView);
}

function renderChallengeComplete(container, areaId, title, text) {
    container.innerHTML = "";
    const heading = document.createElement("h3");
    heading.textContent = title;
    container.appendChild(heading);

    const body = document.createElement("p");
    body.textContent = text;
    container.appendChild(body);

    const backBtn = document.createElement("button");
    backBtn.className = "challenge-btn";
    backBtn.style.width = "auto";
    backBtn.textContent = "Back to Challenges";
    backBtn.onclick = () => openAreaModal(areaId);
    container.appendChild(backBtn);
}

function startPairsChallenge(areaId) {
    const area = areaDefinitions.find(entry => entry.id === areaId);
    const sharkNames = getStoryFeaturedSharks(area);

    const pairs = sharkNames.map((name, index) => ({
        id: index,
        name,
        image: getStorySharkImagePath(areaId, index)
    }));
    const shuffledPairs = shuffle(pairs);

    showChallengeView(container => {
        const status = document.createElement("div");
        status.className = "pairs-moves";
        status.textContent = `Match each shark to its name`;
        container.appendChild(status);

        const gameArea = document.createElement("div");
        gameArea.style.display = "flex";
        gameArea.style.flexDirection = "column";
        gameArea.style.gap = "20px";
        gameArea.style.marginTop = "20px";
        gameArea.style.alignItems = "center";
        container.appendChild(gameArea);

        let selectedImg = null;
        let matchedCount = 0;
        const matchedPairs = new Set();
        const connections = [];

        const names = shuffle([...pairs]);

        const svgContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgContainer.style.position = "absolute";
        svgContainer.style.top = "0";
        svgContainer.style.left = "0";
        svgContainer.style.width = "100%";
        svgContainer.style.height = "100%";
        svgContainer.style.pointerEvents = "none";
        svgContainer.style.zIndex = "1";
        gameArea.style.position = "relative";
        gameArea.appendChild(svgContainer);

        pairs.forEach((pair, i) => {
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.flexDirection = "row";
            row.style.alignItems = "center";
            row.style.gap = "80px";
            row.style.width = "100%";
            row.style.maxWidth = "500px";
            row.style.justifyContent = "space-between";

            const imgWrapper = document.createElement("div");
            imgWrapper.className = "pairs-item";
            imgWrapper.style.padding = "8px";
            imgWrapper.style.border = "2px dashed transparent";
            imgWrapper.style.borderRadius = "12px";
            imgWrapper.style.cursor = "pointer";
            imgWrapper.style.background = "rgba(11, 34, 51, 0.6)";
            imgWrapper.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.2)";
            imgWrapper.dataset.pairId = pair.id;

            const img = document.createElement("img");
            img.alt = pair.name;
            img.loading = "lazy";
            applyStorySharkImage(img, areaId, pair.id);
            img.style.width = "80px";
            img.style.height = "80px";
            img.style.objectFit = "cover";
            img.style.borderRadius = "8px";
            img.style.display = "block";
            imgWrapper.appendChild(img);
            row.appendChild(imgWrapper);

            const nameBtn = document.createElement("button");
            nameBtn.className = "challenge-btn";
            nameBtn.style.width = "auto";
            nameBtn.style.padding = "12px 24px";
            nameBtn.style.fontSize = "14px";
            nameBtn.textContent = names[i].name;
            nameBtn.dataset.pairId = names[i].id;
            row.appendChild(nameBtn);

            gameArea.appendChild(row);
        });

        const feedback = document.createElement("div");
        feedback.style.marginTop = "16px";
        feedback.style.fontWeight = "700";
        container.appendChild(feedback);

        function resetSelection() {
            if (selectedImg) {
                selectedImg.style.border = "2px dashed transparent";
                selectedImg = null;
            }
        }

        container.querySelectorAll(".pairs-item").forEach(item => {
            item.addEventListener("click", () => {
                if (matchedPairs.has(item.dataset.pairId)) return;
                resetSelection();
                selectedImg = item;
                item.style.border = "2px dashed #ffd700";
            });
        });

        container.querySelectorAll("button.challenge-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                if (matchedPairs.has(btn.dataset.pairId)) return;

                if (!selectedImg) {
                    feedback.textContent = "Select an image first!";
                    feedback.style.color = "#ff6b6b";
                    return;
                }

                if (selectedImg.dataset.pairId === btn.dataset.pairId) {
                    matchedPairs.add(btn.dataset.pairId);
                    selectedImg.style.border = "2px solid #4caf50";
                    selectedImg.style.opacity = "0.5";
                    btn.style.background = "linear-gradient(90deg, #4caf50, #81c784)";
                    btn.disabled = true;
                    matchedCount++;
                    feedback.textContent = "Correct!";
                    feedback.style.color = "#4caf50";
                    selectedImg = null;

                    if (matchedCount === pairs.length) {
                        setTimeout(() => {
                            completeChallenge(areaId, 1);
                            renderChallengeComplete(container, areaId, `${area.name} matches complete.`, "You correctly matched all the sharks.");
                        }, 500);
                    }
                } else {
                    feedback.textContent = "Not a match. Try again.";
                    feedback.style.color = "#ff6b6b";
                    selectedImg.style.border = "2px dashed transparent";
                    selectedImg = null;
                }
            });
        });
    });
}

function startSpeciesQuiz(areaId) {
    const area = areaDefinitions.find(entry => entry.id === areaId);
    const targets = shuffle(area.sharks.slice()).slice(0, 4);
    let round = 0;

    showChallengeView(container => {
        const status = document.createElement("div");
        status.className = "pairs-moves";
        container.appendChild(status);

        const prompt = document.createElement("div");
        prompt.style.fontSize = "1.15em";
        prompt.style.margin = "14px 0";
        container.appendChild(prompt);

        const optionsWrap = document.createElement("div");
        optionsWrap.style.display = "grid";
        optionsWrap.style.gridTemplateColumns = "repeat(auto-fit, minmax(180px, 1fr))";
        optionsWrap.style.gap = "12px";
        container.appendChild(optionsWrap);

        const feedback = document.createElement("div");
        feedback.style.marginTop = "12px";
        feedback.style.fontWeight = "700";
        container.appendChild(feedback);

        function renderRound() {
            if (round >= targets.length) {
                completeChallenge(areaId, 0);
                renderChallengeComplete(container, areaId, `${area.name} signal scan complete.`, "You correctly identified the regional species.");
                return;
            }

            status.textContent = `Question ${round + 1} of ${targets.length}`;
            prompt.textContent = `Which shark can be found in the ${area.name}?`;
            feedback.textContent = "";
            optionsWrap.innerHTML = "";

            const correct = targets[round];
            const distractors = shuffle((area.nonSharks || []).slice())
                .filter(name => name !== correct)
                .slice(0, 3);
            if (distractors.length < 3) {
                feedback.textContent = "This region needs more out-of-area species configured.";
                feedback.style.color = "#ff6b6b";
                return;
            }
            shuffle([correct, ...distractors]).forEach(option => {
                const button = document.createElement("button");
                button.className = "challenge-btn";
                button.textContent = option;
                button.onclick = () => {
                    if (option === correct) {
                        feedback.textContent = "Correct!";
                        feedback.style.color = "#4caf50";
                        round += 1;
                        setTimeout(renderRound, 500);
                    } else {
                        feedback.textContent = "Not quite. Try again.";
                        feedback.style.color = "#ff6b6b";
                    }
                };
                optionsWrap.appendChild(button);
            });
        }

        renderRound();
    });
}

function startUnscrambleChallenge(areaId) {
    const area = areaDefinitions.find(entry => entry.id === areaId);
    const words = shuffle(area.sharks.slice()).slice(0, 4);
    let round = 0;

    showChallengeView(container => {
        const status = document.createElement("div");
        status.className = "pairs-moves";
        container.appendChild(status);

        const scrambled = document.createElement("div");
        scrambled.style.fontSize = "1.35em";
        scrambled.style.margin = "18px 0 12px 0";
        scrambled.style.color = "#ffd700";
        scrambled.style.letterSpacing = "2px";
        container.appendChild(scrambled);

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Type the shark name...";
        input.style.fontSize = "1.1em";
        input.style.padding = "10px 14px";
        input.style.borderRadius = "10px";
        input.style.border = "2px solid #00b4d8";
        input.style.width = "90%";
        container.appendChild(input);

        const submit = document.createElement("button");
        submit.className = "challenge-btn";
        submit.style.width = "auto";
        submit.textContent = "Submit";
        container.appendChild(submit);

        const feedback = document.createElement("div");
        feedback.style.marginTop = "12px";
        feedback.style.fontWeight = "700";
        container.appendChild(feedback);

        function renderRound() {
            if (round >= words.length) {
                completeChallenge(areaId, 1);
                renderChallengeComplete(container, areaId, `${area.name} name repair complete.`, "The species records are clean again.");
                return;
            }

            status.textContent = `Word ${round + 1} of ${words.length}`;
            scrambled.textContent = shuffleString(words[round].replace(/\s+/g, ""));
            input.value = "";
            feedback.textContent = "";
            input.focus();
        }

        submit.onclick = () => {
            if (input.value.trim().toLowerCase() === words[round].toLowerCase()) {
                feedback.textContent = "Correct!";
                feedback.style.color = "#4caf50";
                round += 1;
                setTimeout(renderRound, 500);
            } else {
                feedback.textContent = "Incorrect, try again.";
                feedback.style.color = "#ff6b6b";
            }
        };

        input.addEventListener("keydown", event => {
            if (event.key === "Enter") submit.click();
        });

        renderRound();
    });
}

function startTrueFalseChallenge(areaId) {
    const area = areaDefinitions.find(entry => entry.id === areaId);
    
    // Use provided facts (now biologically focused)
    const trueStatements = (area.facts || [])
        .filter(text => typeof text === "string" && text.trim())
        .map(text => ({ text, answer: true }));

    const falseStatements = (area.falseFacts || [])
        .filter(text => typeof text === "string" && text.trim())
        .map(text => ({ text, answer: false }));
    
    // Mix true and false, ensure we have at least 5 rounds
    let rounds = shuffle([...trueStatements, ...falseStatements]);
    if (rounds.length < 5) {
        // Pad with additional false statements from other sharks if needed
        const extraFalse = getOtherAreaSharks(areaId)
            .filter(name => !area.sharks.includes(name))
            .slice(0, 5 - rounds.length)
            .map(shark => ({
                text: `${shark} is a key species in ${area.name}.`,
                answer: false
            }));
        rounds = shuffle([...rounds, ...extraFalse]);
    }
    rounds = rounds.slice(0, 5);
    
    let round = 0;

    showChallengeView(container => {
        const status = document.createElement("div");
        status.className = "pairs-moves";
        container.appendChild(status);

        const statement = document.createElement("div");
        statement.style.fontSize = "1.15em";
        statement.style.margin = "16px 0";
        statement.style.lineHeight = "1.6";
        container.appendChild(statement);

        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.gap = "14px";
        row.style.justifyContent = "center";
        container.appendChild(row);

        const trueBtn = document.createElement("button");
        trueBtn.className = "challenge-btn";
        trueBtn.textContent = "True";
        row.appendChild(trueBtn);

        const falseBtn = document.createElement("button");
        falseBtn.className = "challenge-btn";
        falseBtn.textContent = "False";
        row.appendChild(falseBtn);

        const feedback = document.createElement("div");
        feedback.style.marginTop = "12px";
        feedback.style.fontWeight = "700";
        container.appendChild(feedback);

        function renderRound() {
            if (round >= rounds.length) {
                completeChallenge(areaId, 2);
                renderChallengeComplete(container, areaId, `${area.name} report complete.`, "You sorted the field notes correctly.");
                return;
            }

            status.textContent = `Statement ${round + 1} of ${rounds.length}`;
            statement.textContent = rounds[round].text;
            feedback.textContent = "";
        }

        function answer(value) {
            if (value === rounds[round].answer) {
                feedback.textContent = "Correct!";
                feedback.style.color = "#4caf50";
                round += 1;
                setTimeout(renderRound, 450);
            } else {
                feedback.textContent = "Incorrect, try again.";
                feedback.style.color = "#ff6b6b";
            }
        }

        trueBtn.onclick = () => answer(true);
        falseBtn.onclick = () => answer(false);
        renderRound();
    });
}

function shuffleString(text) {
    const chars = text.split("");
    for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const shuffled = chars.join("");
    if (shuffled === text && new Set(chars).size > 1) return shuffleString(text);
    return shuffled;
}

function shuffle(array) {
    const clone = array.slice();
    for (let i = clone.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [clone[i], clone[j]] = [clone[j], clone[i]];
    }
    return clone;
}

function completeOpenMapSection() {
    const modal = document.getElementById("area-modal");
    if (!modal || modal.style.display === "none" || !currentOpenAreaId) {
        console.log("❌ Open a map section modal first, then run completeOpenMapSection().");
        return false;
    }

    const area = areaDefinitions.find(entry => entry.id === currentOpenAreaId);
    const areaState = getAreaState(currentOpenAreaId);
    if (!area || !areaState) {
        console.log("❌ Could not resolve the currently open map section.");
        return false;
    }

    areaState.challenges = [true, true, true];
    completeArea(currentOpenAreaId);
    saveStoryState();
    renderMap();
    openAreaModal(currentOpenAreaId);

    console.log(`✅ Completed map section: ${area.name}`);
    return true;
}

function getPlayerUsername() {
    if (typeof window.getCurrentProfileData === "function") {
        const profile = window.getCurrentProfileData();
        if (profile?.username) return profile.username;
    }
    return "Agent";
}

function interpolateNarrative(text) {
    return text.replace(/{playerUsername}/g, getPlayerUsername());
}

function uncompleteOpenMapSection() {
    const modal = document.getElementById("area-modal");
    if (!modal || modal.style.display === "none" || !currentOpenAreaId) {
        console.log("❌ Open a map section modal first, then run uncompleteOpenMapSection().");
        return false;
    }

    const area = areaDefinitions.find(entry => entry.id === currentOpenAreaId);
    const areaState = getAreaState(currentOpenAreaId);
    if (!area || !areaState) {
        console.log("❌ Could not resolve the currently open map section.");
        return false;
    }

    areaState.challenges = [false, false, false];
    areaState.completed = false;

    const prevAreaId = areaDefinitions[getAreaIndex(currentOpenAreaId) - 1]?.id;
    if (prevAreaId) {
        storyState.areas[prevAreaId].completed = false;
    }

    saveStoryState();
    renderMap();
    openAreaModal(currentOpenAreaId);

    console.log(`↩️  Uncompleted map section: ${area.name}`);
    return true;
}

document.addEventListener("DOMContentLoaded", () => {
    loadStoryState();
    renderMap();
});
