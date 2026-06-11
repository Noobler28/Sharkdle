const STORY_STORAGE_KEY = "sharkdle_story_mode_v2";
const ACHIEVEMENT_STORAGE_KEY = "unlockedAchievements";
const STORY_IMAGE_SHARKS_PER_CHAPTER = 5;
const STORY_SPECIES_PER_AREA = 3;
const STORY_TASKS_PER_SPECIES = 3;

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
        ],
        bossMission: {
            title: "The Atlantic Signal",
            desc: "Trace the original corruption pulse and seal the breach beneath the shipping lanes.",
            story: "Dr. Finn believes the Atlantic was the first place the archive broke. The final signal is hiding in the wreckage of an old survey grid, and only a perfect restoration of the chapter can stop the corruption from spreading."
        }
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
    ],
    bossMission: {
        title: "The Pacific Undertow",
        desc: "Dive into the central current and shut down the moving fault line.",
        story: "The Pacific does not just hold the corruption. It carries it. Dr. Finn says the last fragment is drifting inside a current that turns every mistake into a new lie. Stop it here or every future chapter will inherit the damage."
    }
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
            "Bull Sharks cannot enter freshwater and are restricted to open ocean habitats.",
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
            ],
        bossMission: {
            title: "The Monsoon Vault",
            desc: "Stabilize the reef archive before the storm cycle overwrites it.",
            story: "The Indian Ocean chapter reads like a warning: if the storm season rewrites the reef records, the corruption will become permanent. Dr. Finn sends you into the Monsoon Vault to lock down the chapter before it disappears."
        }
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
            ],
        bossMission: {
            title: "The Crossroads Archive",
            desc: "Restore the sea that connects three continents and three histories.",
            story: "The Mediterranean is where old stories and new data collide. Finn thinks the corruption is feeding on the sea's connected history, so the final mission becomes a race to restore the archive before every shoreline starts telling the same false story."
        }
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
        ],
        bossMission: {
            title: "The Reef Lantern",
            desc: "Light the Great Barrier corridor and drive out the false telemetry.",
            story: "Australia's chapter is about memory, camouflage, and survival. The final mission is to relight the reef network so the hidden species beneath the currents can be seen clearly again."
        }
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
        ],
        bossMission: {
            title: "Cape of Currents",
            desc: "Close the loop where the Atlantic and Indian currents meet.",
            story: "South Africa is the turning point of the whole story. The boss mission ties the two oceans together and forces the truth back into the map before the corruption can jump the border again."
        }
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
            "Bonnethead Sharks are the smallest hammerhead species and often forage in seagrass habitats."
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
        ],
        bossMission: {
            title: "The Return Current",
            desc: "Finish the loop and reveal what started the first breach.",
            story: "The East Coast chapter is the echo of the opening disaster. Dr. Finn believes the original anomaly left a hidden trail here, and the boss mission is where you finally uncover the pattern behind the whole outbreak."
        }
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
        ],
        bossMission: {
            title: "The Ancient Deep",
            desc: "Descend to the root of the archive and restore the final lost record.",
            story: "Japan is the last chapter because it is where the oldest stories survive. The final boss mission should feel like a descent into the oldest part of the ocean, where the last corrupted record can either be restored or lost forever."
        }
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
const SHARK_VISUAL_PROFILES = {
    "White Shark": [
        "a massive pale body and a heavy tail",
        "dark gray top with a white underside",
        "a torpedo-shaped frame with a blunt snout"
    ],
    "Blue Shark": [
        "slender blue skin and a long pointed snout",
        "a narrow body built for open water",
        "a sleek shape that looks made for cruising the blue"
    ],
    "Shortfin Mako Shark": [
        "a streamlined body that seems built for ridiculous speed",
        "a short fin profile and a metallic blue back",
        "a pointed snout with a race-car silhouette"
    ],
    "Common Thresher Shark": [
        "an extra-long caudal fin that whips through the water",
        "a huge tail used like a weapon at the surface",
        "a long tail blade that looks bigger than the body itself"
    ],
    "Sandbar Shark": [
        "a sturdy body and a tall dorsal fin",
        "a bronze-gray back with a thick, coastal build",
        "a broad, muscular shape that moves more like a cruiser than a sprinter"
    ],
    "Tiger Shark": [
        "dark vertical striping along the body and a broad head",
        "a heavy striped pattern and a blunt-looking snout",
        "a large, patterned body that feels unmistakably tiger-like"
    ],
    "Whale Shark": [
        "a gigantic filter-feeding body with a wide head",
        "white spots across a massive frame",
        "a huge, slow-moving shape that dwarfs the waves"
    ],
    "Oceanic Whitetip Shark": [
        "rounded fins with white tips and a chunky open-ocean look",
        "a bronze-gray body with striking white fin edges",
        "a sturdy pelagic frame that hangs in the blue water"
    ],
    "Goblin Shark": [
        "a long flattened snout that juts out like a blade",
        "a pale deep-sea body with a strange protruding jaw",
        "an eerie pink-gray shape with a nose that looks far too long"
    ],
    "Salmon Shark": [
        "a compact, fast-looking body with a dark back",
        "a powerful mid-sized frame built for speed in cold water",
        "a torpedo shape with a predator's shoulders"
    ],
    "Bull Shark": [
        "a thick, stocky body with a blunt snout",
        "a gray back and a very solid, muscular frame",
        "a short, powerful build that looks made for coastal water"
    ],
    "Zebra Shark": [
        "a patterned body with pale spots and long ridges",
        "a bottom-dwelling shape with a spotted leopard-like look",
        "a broad body and a tail that feels built for the reef floor"
    ],
    "Nurse Shark": [
        "a broad head, whisker-like barbels, and a bottom-resting posture",
        "a heavy, slow-moving body that hugs the seabed",
        "a flattened shape with a calm, almost lazy silhouette"
    ],
    "Grey Reef Shark": [
        "a gray body with a clean reef-predator profile",
        "a streamlined reef shape and a pointed snout",
        "a quick-looking body with a confident coastal silhouette"
    ],
    "Whitetip Reef Shark": [
        "white tips on the fins and a slender reef body",
        "a narrow frame with bright fin edges",
        "a reef patrol shape with noticeable white-tipped fins"
    ],
    "Angelshark": [
        "a flattened body that lies low in the sand",
        "a ray-like shape with broad pectoral fins",
        "a camouflaged body that almost disappears on the seabed"
    ],
    "Smalltooth Sand Tiger": [
        "a sandy body with a slightly fierce, torpedo shape",
        "a pale frame and a shark face that looks built for ambush",
        "a bulky shape that hovers like a patient hunter"
    ],
    "Smooth Hammerhead": [
        "a hammer-shaped head with a smooth curve",
        "wide cephalofoil edges and a sleek gray body",
        "a broad head that cuts the water like a wing"
    ],
    "Tope Shark": [
        "a slender coastal frame with a pointed snout",
        "a smooth, streamlined body built for open coastal water",
        "a quick, narrow-bodied shark with a simple gray profile"
    ],
    "Basking Shark": [
        "an enormous filter-feeding body with a huge mouth",
        "a massive gray shape that moves like a slow giant",
        "a huge open-water silhouette with gill slits and a wide head"
    ],
    "Spotted Wobbegong": [
        "a camouflage pattern covered in spots and frills",
        "a flattened bottom-dwelling body that looks like the reef floor",
        "a carpet-like shape with ornate markings"
    ],
    "Port Jackson Shark": [
        "a short blunt snout and dark markings around the face",
        "a stout body with a ridged, catshark-like outline",
        "a bottom-resting shape with bold dark bands"
    ],
    "Epaulette Shark": [
        "a small reef body that looks ready to crawl across the bottom",
        "dark shoulder marks and a compact frame",
        "a slender reef shark that seems built for tight coral spaces"
    ],
    "Gummy Shark": [
        "a long, smooth body and a very plain gray profile",
        "a coastal shape with a flexible-looking tail",
        "a sleek body with no dramatic markings"
    ],
    "Australian Angel Shark": [
        "a sand-colored flattened body with a hiding posture",
        "a broad, ray-like silhouette camouflaged against the seabed",
        "a low body shape built for ambush in the sand"
    ],
    "White Shark": [
        "a massive pale body and a heavy tail",
        "dark gray top with a white underside",
        "a torpedo-shaped frame with a blunt snout"
    ],
    "Sand Tiger Shark": [
        "a bulky, ragged-looking body with a narrow snout",
        "a brown-gray shark that drifts like a wreck sentinel",
        "a heavy frame with a toothy, intimidating look"
    ],
    "Leopard Catshark": [
        "a small spotted body with a catlike shape",
        "a slim body covered in dark spots",
        "a small reef shark with a patterned coat"
    ],
    "Copper Shark": [
        "a bronze-gray body with a classic coastal silhouette",
        "a smooth, powerful frame with a coppery tint",
        "a sleek shark that looks built for long patrols"
    ],
    "Scalloped Hammerhead": [
        "a hammer-shaped head with a scalloped front edge",
        "a broad, multi-notched cephalofoil and a sleek body",
        "a wide head that looks gently scalloped across the front"
    ],
    "Dusky Shark": [
        "a large gray body with a long, steady frame",
        "a strong open-water shape and a plain dark back",
        "a broad coastal hunter with a confident silhouette"
    ],
    "Spinner Shark": [
        "a slim, fast-moving body built for aerial bursts",
        "a streamlined shape that looks ready to leap",
        "a narrow body with a speedster profile"
    ],
    "Blacktip Shark": [
        "dark tips on the fins and a fast coastal build",
        "a sleek body with black-edged fins",
        "a quick reef hunter with a clean fin outline"
    ],
    "Japanese Bullhead Shark": [
        "a compact horn-shark body with ridges over the eyes",
        "a small bottom-dweller with a blunt head",
        "a rugged little shark with a squat silhouette"
    ],
    "Frilled Shark": [
        "a snake-like body and a deep-water profile",
        "an eel-like shape with a long, unsettling frame",
        "a primitive body with a frilled mouth and narrow torso"
    ],
    "Megamouth Shark": [
        "a huge mouth and a dark filter-feeding body",
        "a round-headed giant with a very wide gape",
        "a rare, oversized body built around an enormous mouth"
    ],
    "Brown-banded Bamboo Shark": [
        "a small carpet shark with brown bands and a bottom-resting shape",
        "a modest reef body with striped markings",
        "a compact carpet shark that hugs the reef floor"
    ],
    "Japanese Wobbegong": [
        "a flattened, camouflaged body with a frilly outline",
        "a carpet-like reef shape with a patterned back",
        "a low body that blends into rocks and sand"
    ]
};

const SHARK_EVIDENCE_LINES = {
    "Common Thresher Shark": [
        "its caudal fin is larger than the rest of the body and keeps whipping the water at the surface",
        "you can clearly see a long tail blade trailing behind it like a weapon",
        "the tail is so long it looks like the shark is dragging a second body behind it"
    ],
    "Shortfin Mako Shark": [
        "it flashes past so fast you barely catch the outline before it vanishes into spray",
        "the body is a blur and the speed is the only thing you can read clearly",
        "it moves with a ridiculous burst of speed, too quick to study for long"
    ],
    "Whale Shark": [
        "it is enormous, with white spots across a giant frame that dwarfs the wake",
        "the body is massive and slow, and the spotted pattern is impossible to miss",
        "it is so large that the boat suddenly feels small beside it"
    ],
    "Tiger Shark": [
        "the body has bold striping and a heavy, broad-headed profile",
        "you can see the striped pattern cutting across a thick gray body",
        "its markings are dark and banded, with a powerful frame underneath"
    ],
    "Blue Shark": [
        "the skin has a blue sheen and the body is long and narrow",
        "it looks built for open water, with a slim blue profile",
        "the shark has a sleek blue body that cuts cleanly through the surface"
    ],
    "Lemon Shark": [
        "the skin has a yellow tinge that stands out against the water",
        "its body is stout and yellow-olive, almost sand-lit in color",
        "the coloring is pale yellow and the silhouette is broad and calm"
    ],
    "White Shark": [
        "the back is dark gray but the underside is bright white and heavy-looking",
        "it has a massive pale underside and a blunt, powerful profile",
        "the shape is unmistakably large, with a white belly and dark top"
    ],
    "Bull Shark": [
        "the body is stocky and blunt, built like a tank in the water",
        "it looks compact and powerful, with a broad snout",
        "the silhouette is thick and aggressive rather than streamlined"
    ],
    "Mako Shark": [
        "the body is built for speed and the fin line is razor clean",
        "it cuts through the water like a racing blade",
        "the frame is narrow, fast, and unmistakably athletic"
    ],
    "Thresher Shark": [
        "the tail is absurdly long and rises behind the body like a whip",
        "you can see the shark using its tail to slap at fish near the surface",
        "the caudal fin dominates the scene and lashes through the water"
    ]
};

const SHARK_OBSERVATION_FRAGMENTS = [
    "from the deck",
    "through the glass of a viewport",
    "with your field scope",
    "from the port side of the boat",
    "just off the wake",
    "as the swell rolls past"
];

const SHARK_OBSERVATION_OPENERS = [
    "A shark was spotted",
    "You catch sight of a shark",
    "A shadow breaks the surface",
    "A shark cuts across the water",
    "A shape moves beneath the swell"
];

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

function getStorySpeciesLineup(area) {
    return (area?.sharks || [])
        .slice(0, STORY_SPECIES_PER_AREA)
        .map((name, index) => ({ id: `${area.id}_species_${index}`, name, order: index + 1 }));
}

function getSpeciesTaskTitle(species, taskIndex) {
    const titles = ["Signal Scan", "Archive Match", "Field Truth"];
    return `${species.name} - ${titles[taskIndex] || `Task ${taskIndex + 1}`}`;
}

function getSpeciesTaskDescription(taskIndex) {
    const descriptions = [
        "Confirm the shark belongs in this chapter.",
        "Match the chapter image to the shark's name.",
        "Sort true and false field reports."
    ];
    return descriptions[taskIndex] || "Complete the assigned task.";
}

function getAreaProgressCount(areaState) {
    const speciesProgress = (areaState?.species || []).flat().filter(Boolean).length;
    return speciesProgress + (areaState?.bossCompleted ? 1 : 0);
}

function isBossUnlocked(areaState) {
    return (areaState?.species || []).length === STORY_SPECIES_PER_AREA
        && areaState.species.every(tasks => Array.isArray(tasks) && tasks.every(Boolean));
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
let currentOpenMission = null;

function defaultStoryState() {
    const areas = {};
    areaDefinitions.forEach((area, index) => {
        areas[area.id] = {
            unlocked: index === 0,
            completed: false,
            species: Array.from({ length: STORY_SPECIES_PER_AREA }, () => [false, false, false]),
            bossCompleted: false
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
                    const species = Array.from({ length: STORY_SPECIES_PER_AREA }, (_, speciesIndex) => {
                        const savedTasks = savedArea.species?.[speciesIndex];
                        return Array.from({ length: STORY_TASKS_PER_SPECIES }, (_, taskIndex) => Boolean(savedTasks?.[taskIndex]));
                    });
                    base.areas[area.id] = {
                        unlocked: Boolean(savedArea.unlocked),
                        completed: Boolean(savedArea.completed),
                        species,
                        bossCompleted: Boolean(savedArea.bossCompleted)
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
        state.areas.atlantic.species = Array.from({ length: STORY_SPECIES_PER_AREA }, () => [true, true, true]);
        state.areas.atlantic.bossCompleted = true;
        if (state.areas.pacific) state.areas.pacific.unlocked = true;
    }

    if (localStorage.getItem("pacificWordsearchComplete") === "true" || localStorage.getItem("pacificUnlocked") === "true") {
        state.areas.pacific.unlocked = true;
        if (localStorage.getItem("pacificWordsearchComplete") === "true") {
            state.areas.pacific.completed = true;
            state.areas.pacific.species = Array.from({ length: STORY_SPECIES_PER_AREA }, () => [true, true, true]);
            state.areas.pacific.bossCompleted = true;
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
    const speciesIndex = Math.floor(challengeIndex / STORY_TASKS_PER_SPECIES);
    const taskIndex = challengeIndex % STORY_TASKS_PER_SPECIES;

    if (speciesIndex >= STORY_SPECIES_PER_AREA) {
        areaState.bossCompleted = true;
        completeArea(areaId);
    } else if (areaState.species?.[speciesIndex]) {
        areaState.species[speciesIndex][taskIndex] = true;
    }

    saveStoryState();
    renderMap();
}

function completeArea(areaId) {
    const areaState = getAreaState(areaId);
    areaState.completed = true;
    areaState.bossCompleted = true;
    awardStoryAchievement(areaAchievementMap[areaId]);

    const currentIndex = getAreaIndex(areaId);
    const nextArea = areaDefinitions[currentIndex + 1];
    if (nextArea) {
        storyState.areas[nextArea.id].unlocked = true;
    }

    const completedAreas = areaDefinitions.filter(area => storyState.areas[area.id]?.completed).length;
    const isFinalArea = getAreaIndex(areaId) === areaDefinitions.length - 1;
    if (isFinalArea && completedAreas === areaDefinitions.length) {
        triggerStoryCelebration({
            variant: "campaign",
            title: "Campaign Complete",
            subtitle: "You cleared every area, every dossier, and every boss."
        });
    } else {
        triggerStoryCelebration({
            variant: "area",
            title: `${areaDefinitions.find(area => area.id === areaId)?.name || "Area"} Cleared`,
            subtitle: "The breach has been resolved and the next waters are unlocked."
        });
    }
}

function renderMapLegacyUnused() {
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

async function openAreaModalLegacyUnused(areaId) {
    const area = areaDefinitions.find(entry => entry.id === areaId);
    const areaState = getAreaState(areaId);
    const modal = document.getElementById("area-modal");
    const closeBtn = document.getElementById("close-modal");
    const title = document.getElementById("modal-title");
    const speciesContainer = document.getElementById("area-species-container");
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

function startPairsChallenge(areaId, speciesIndex = 0) {
    const area = areaDefinitions.find(entry => entry.id === areaId);
    const sharkNames = getStorySpeciesLineup(area);
    const speciesName = sharkNames[speciesIndex]?.name || area.sharks[0];

    const pairs = [{ id: speciesIndex, name: speciesName, image: getStorySharkImagePath(areaId, speciesIndex) }];

    showChallengeView(container => {
        const status = document.createElement("div");
        status.className = "pairs-moves";
        status.textContent = `Match the chapter image to ${speciesName}`;
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
                            completeChallenge(areaId, (speciesIndex * STORY_TASKS_PER_SPECIES) + 1);
                            renderChallengeComplete(container, areaId, `${speciesName} archive match complete.`, "You correctly matched the chapter record.");
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

function startSpeciesQuiz(areaId, speciesIndex = 0) {
    const area = areaDefinitions.find(entry => entry.id === areaId);
    const speciesName = getStorySpeciesLineup(area)[speciesIndex]?.name || area.sharks[0];
    const targets = [speciesName, speciesName, speciesName];
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
                completeChallenge(areaId, (speciesIndex * STORY_TASKS_PER_SPECIES) + 0);
                renderChallengeComplete(container, areaId, `${speciesName} signal scan complete.`, "You correctly identified the species and restored its record.");
                return;
            }

            status.textContent = `Question ${round + 1} of ${targets.length}`;
            prompt.textContent = `Which shark is at the center of ${speciesName}'s chapter arc?`;
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

function startUnscrambleChallenge(areaId, speciesIndex = 0) {
    const area = areaDefinitions.find(entry => entry.id === areaId);
    const speciesName = getStorySpeciesLineup(area)[speciesIndex]?.name || area.sharks[0];
    const words = [speciesName];
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
                completeChallenge(areaId, (speciesIndex * STORY_TASKS_PER_SPECIES) + 1);
                renderChallengeComplete(container, areaId, `${speciesName} name repair complete.`, "The species records are clean again.");
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

function startTrueFalseChallenge(areaId, speciesIndex = 0) {
    const area = areaDefinitions.find(entry => entry.id === areaId);
    const speciesName = getStorySpeciesLineup(area)[speciesIndex]?.name || area.sharks[0];
    
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
                text: `${shark} is a key species in ${speciesName}'s chapter.`,
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
                completeChallenge(areaId, (speciesIndex * STORY_TASKS_PER_SPECIES) + 2);
                renderChallengeComplete(container, areaId, `${speciesName} report complete.`, "You sorted the field notes correctly.");
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

function startBossMission(areaId) {
    const area = areaDefinitions.find(entry => entry.id === areaId);
    const areaState = getAreaState(areaId);
    if (!area || !areaState || !isBossUnlocked(areaState) || areaState.bossCompleted) return;

    const modalId = `boss-modal-${areaId}`;
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement("div");
        modal.id = modalId;
        modal.className = "modal hidden story-boss-modal";
        modal.innerHTML = `
            <div class="modal-content story-modal-modern story-boss-modal-content">
                <span class="close">&times;</span>
                <div class="story-modal-header">
                    <div class="story-modal-title-group">
                        <div class="story-modal-kicker">Final Encounter</div>
                        <h2 class="boss-modal-title"></h2>
                        <div class="story-modal-brief"><p class="boss-modal-story"></p></div>
                    </div>
                </div>
                <div class="boss-modal-body"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const closeBtn = modal.querySelector(".close");
    const title = modal.querySelector(".boss-modal-title");
    const story = modal.querySelector(".boss-modal-story");
    const body = modal.querySelector(".boss-modal-body");
    if (!closeBtn || !title || !story || !body) return;

    title.textContent = area.bossMission?.title || "Boss Mission";
    story.textContent = area.bossMission?.story || "A final disturbance rises from the chapter's deepest water.";
    body.className = "boss-modal-body";
    body.innerHTML = "";

    const speciesList = getStorySpeciesLineup(area);
    const bossClues = shuffle([
        speciesList[0]?.name,
        speciesList[1]?.name,
        speciesList[2]?.name,
        ...getOtherAreaSharks(areaId)
    ]).filter(Boolean);

    const phases = [
        {
            title: "Phase 1: The Wake",
            desc: `A dark shape cuts across the swell ${getObservationRangeText()}. Through the binoculars you catch ${getSharkVisualClue(speciesList[0]?.name || speciesList[1]?.name)}. Is this one of the chapter sharks?`,
            answer: "Yes"
        },
        {
            title: "Phase 2: The Decoy",
            desc: `A second shadow follows the first, but the fins look wrong. Through the glass you see ${getSharkVisualClue(bossClues[3] || speciesList[0]?.name)}. Is this one of the chapter sharks?`,
            answer: "No"
        },
        {
            title: "Phase 3: The Reveal",
            desc: `The final silhouette circles beneath the boat ${getObservationRangeText()}. You see ${getSharkVisualClue(speciesList[2]?.name || speciesList[0]?.name)}. Is this one of the chapter sharks?`,
            answer: "Yes"
        }
    ];

    const intro = document.createElement("div");
    intro.className = "mission-boss-note";
    intro.innerHTML = `
        <strong>Boss objective:</strong> Track the final corruption signature using everything you learned in this chapter.
    `;
    body.appendChild(intro);

    phases.forEach((phase, index) => {
        const card = document.createElement("div");
        card.className = "story-boss-phase";
        const stateKey = `bossPhase_${index}`;
        const cleared = Boolean(areaState[stateKey]);
        card.innerHTML = `
            <div class="story-boss-phase-head">
                <div class="story-boss-phase-index">${index + 1}</div>
                <div>
                    <strong>${phase.title}</strong>
                    <div class="story-boss-phase-desc">${phase.desc}</div>
                </div>
            </div>
        `;

        const controls = document.createElement("div");
        controls.className = "story-boss-phase-controls";
        ["Yes", "No"].forEach(choice => {
            const btn = document.createElement("button");
            btn.className = "challenge-btn";
            btn.textContent = choice;
            btn.disabled = cleared;
            if (cleared) btn.classList.add("challenge-complete");
            btn.onclick = () => {
                if (choice !== phase.answer) {
                    btn.textContent = "Wrong call";
                    setTimeout(() => { if (!btn.disabled) btn.textContent = choice; }, 600);
                    return;
                }
                areaState[stateKey] = true;
                saveStoryState();
                renderMap();
                refreshAreaModal(areaId);
                renderBossModal(areaId);
            };
            controls.appendChild(btn);
        });
        card.appendChild(controls);

        const phaseStatus = document.createElement("div");
        phaseStatus.className = "mission-boss-note";
        phaseStatus.textContent = cleared ? "Phase cleared" : "Awaiting your call";
        card.appendChild(phaseStatus);
        body.appendChild(card);
    });

    const finishBtn = document.createElement("button");
    finishBtn.className = "challenge-btn";
    finishBtn.id = `boss-finish-btn-${areaId}`;
    finishBtn.textContent = areaState.bossCompleted ? "Boss cleared" : "Resolve the breach";
    finishBtn.disabled = !phases.every((_, index) => areaState[`bossPhase_${index}`]) || areaState.bossCompleted;
    finishBtn.onclick = () => {
        const currentState = getAreaState(areaId);
        const readyToFinish = phases.every((_, index) => currentState[`bossPhase_${index}`]) && !currentState.bossCompleted;
        if (!readyToFinish) {
            finishBtn.disabled = !phases.every((_, index) => currentState[`bossPhase_${index}`]) || currentState.bossCompleted;
            return;
        }
        finishBtn.disabled = true;
        currentState.bossCompleted = true;
        completeArea(areaId);
        saveStoryState();
        renderMap();
        refreshAreaModal(areaId);
        closeBossModal(modalId);
        openAreaModal(areaId);
    };
    body.appendChild(finishBtn);

    closeBtn.onclick = () => closeBossModal(modalId);
    modal.onclick = event => {
        if (event.target === modal) closeBossModal(modalId);
    };

    modal.classList.remove("hidden");
    modal.style.display = "flex";
}

function openMissionModal(areaId, speciesIndex) {
    const area = areaDefinitions.find(entry => entry.id === areaId);
    const areaState = getAreaState(areaId);
    if (!area || !areaState) return;

    const species = getStorySpeciesLineup(area)[speciesIndex];
    if (!species) return;

    const areaModal = document.getElementById("area-modal");
    if (areaModal) {
        areaModal.classList.remove("hidden");
        areaModal.style.display = "flex";
    }

    const board = document.getElementById("mission-modal");
    if (board) {
        board.classList.remove("hidden");
        board.style.display = "flex";
    }
    renderMissionBoard(areaId, speciesIndex);
}

function renderMissionBoard(areaId, speciesIndex) {
    const area = areaDefinitions.find(entry => entry.id === areaId);
    const areaState = getAreaState(areaId);
    const board = document.getElementById("mission-modal");
    const closeBtn = document.getElementById("close-mission-modal");
    const title = document.getElementById("mission-modal-title");
    const story = document.getElementById("mission-modal-story");
    const body = document.getElementById("mission-modal-body");
    const species = getStorySpeciesLineup(area)[speciesIndex];
    if (!area || !areaState || !board || !title || !story || !body || !species) return;

    currentOpenMission = { areaId, speciesIndex, missionIndex: null };
    title.textContent = `${species.order}. ${species.name}`;
    story.textContent = `Choose a mission dossier for ${species.name}. Each one opens in its own modal.`;
    body.className = "story-mission-board";
    body.innerHTML = "";

    const speciesState = areaState.species?.[speciesIndex] || [false, false, false];
    const cards = [
        {
            title: "Mission 1: First Sighting",
            subtitle: "A clean identification from the boat.",
            stateText: speciesState[0] ? "Completed" : "Open"
        },
        {
            title: "Mission 2: Crossing Currents",
            subtitle: "A lookalike passes through the foam.",
            stateText: speciesState[1] ? "Completed" : "Open"
        },
        {
            title: "Mission 3: Final Verdict",
            subtitle: "The decisive sighting that seals the dossier.",
            stateText: speciesState[2] ? "Completed" : "Open"
        }
    ];

    cards.forEach((card, missionIndex) => {
        const missionCard = document.createElement("button");
        missionCard.type = "button";
        missionCard.className = "story-board-card";
        if (speciesState[missionIndex]) missionCard.classList.add("complete");
        missionCard.innerHTML = `
            <span class="story-board-kicker">Mission ${missionIndex + 1}</span>
            <strong>${card.title}</strong>
            <p>${card.subtitle}</p>
            <span class="story-board-state">${card.stateText}</span>
        `;
        missionCard.onclick = () => openSingleMissionModal(areaId, speciesIndex, missionIndex);
        body.appendChild(missionCard);
    });

    const bossNote = document.createElement("div");
    bossNote.className = "mission-boss-note";
    bossNote.textContent = isBossUnlocked(areaState)
        ? "All three species are complete. Return to the area board to start the boss mission."
        : "Finish all three species dossiers to unlock the boss mission.";
    body.appendChild(bossNote);

    closeBtn.onclick = closeMissionModal;
    board.onclick = event => {
        if (event.target === board) closeMissionModal();
    };
}

function renderBossModal(areaId) {
    const modal = document.querySelector(`.story-boss-modal`);
    if (!modal) return;
    const area = areaDefinitions.find(entry => entry.id === areaId);
    const body = modal.querySelector(".boss-modal-body");
    const title = modal.querySelector(".boss-modal-title");
    const story = modal.querySelector(".boss-modal-story");
    const areaState = getAreaState(areaId);
    if (!area || !body || !title || !story || !areaState) return;
    title.textContent = area.bossMission?.title || "Boss Mission";
    story.textContent = area.bossMission?.story || "";
    body.querySelectorAll(".story-boss-phase").forEach((card, index) => {
        const phaseStatus = card.querySelector(".mission-boss-note:last-of-type");
        if (phaseStatus) phaseStatus.textContent = areaState[`bossPhase_${index}`] ? "Phase cleared" : "Awaiting your call";
            const buttons = card.querySelectorAll("button.challenge-btn");
            buttons.forEach(btn => {
                btn.disabled = Boolean(areaState[`bossPhase_${index}`]);
                if (areaState[`bossPhase_${index}`]) btn.classList.add("challenge-complete");
            });
        });
    const finishBtn = body.querySelector(`#boss-finish-btn-${areaId}`);
    if (finishBtn) {
        finishBtn.disabled = ![0,1,2].every(index => areaState[`bossPhase_${index}`]) || areaState.bossCompleted;
        finishBtn.textContent = areaState.bossCompleted ? "Boss cleared" : "Resolve the breach";
    }
}

function closeBossModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add("hidden");
    modal.style.display = "";
}

function buildMissionDetails(areaId, speciesIndex, missionIndex) {
    const area = areaDefinitions.find(entry => entry.id === areaId);
    const species = getStorySpeciesLineup(area)[speciesIndex];
    const areaState = getAreaState(areaId);
    const speciesState = areaState?.species?.[speciesIndex] || [false, false, false];
    if (!area || !species) return null;

    const missionPack = buildSpeciesMissionPool(areaId, speciesIndex);
    const lookalikes = shuffle([
        ...missionPack.regionalChoices,
        ...missionPack.distractors
    ]).filter(name => name !== species.name);
    const lookalike = lookalikes[missionIndex] || lookalikes[0] || species.name;
    const targetCount = shuffle([1, 2, 2, 3])[0];
    const correctPattern = shuffle([
        ...Array(targetCount).fill(true),
        ...Array(3 - targetCount).fill(false)
    ]);
    const isTarget = correctPattern[missionIndex];
    const sightingName = isTarget ? species.name : lookalike;

    const missionDefs = [
        {
            title: "Mission 1: First Sighting",
            desc: buildSightingPrompt(species.name, sightingName, isTarget),
            answer: isTarget ? "Yes" : "No",
            reward: "Field badge earned"
        },
        {
            title: "Mission 2: Crossing Currents",
            desc: buildSightingPrompt(species.name, sightingName, isTarget),
            answer: isTarget ? "Yes" : "No",
            reward: "Archive restored"
        },
        {
            title: "Mission 3: Final Verdict",
            desc: buildSightingPrompt(species.name, sightingName, isTarget),
            answer: isTarget ? "Yes" : "No",
            reward: "Species mastered"
        }
    ];

    return { area, species, speciesState, mission: missionDefs[missionIndex], missionIndex };
}

function openSingleMissionModal(areaId, speciesIndex, missionIndex) {
    const details = buildMissionDetails(areaId, speciesIndex, missionIndex);
    if (!details) return;

    const modalId = `mission-modal-${areaId}-${speciesIndex}-${missionIndex}`;
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement("div");
        modal.id = modalId;
        modal.className = "modal hidden story-single-mission-modal";
        modal.innerHTML = `
            <div class="modal-content story-modal-modern story-mission-modal">
                <span class="close">&times;</span>
                <div class="story-modal-header">
                    <div class="story-modal-title-group">
                        <div class="story-modal-kicker">Mission Dossier</div>
                        <h2 class="single-mission-title"></h2>
                        <div class="story-modal-brief"><p class="single-mission-story"></p></div>
                    </div>
                </div>
                <div class="single-mission-body"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const closeBtn = modal.querySelector(".close");
    const title = modal.querySelector(".single-mission-title");
    const story = modal.querySelector(".single-mission-story");
    const body = modal.querySelector(".single-mission-body");
    const mission = details.mission;
    if (!closeBtn || !title || !story || !body || !mission) return;

    currentOpenMission = { areaId, speciesIndex, missionIndex };
    title.textContent = `${details.species.order}. ${details.species.name} - ${mission.title}`;
    story.textContent = details.speciesState[missionIndex]
        ? "This mission is already cleared. You can review the clues or close the dossier."
        : "Read the sighting carefully and make your call.";
    body.innerHTML = "";

    const prompt = document.createElement("div");
    prompt.className = "mission-boss-note";
    prompt.textContent = mission.desc;
    body.appendChild(prompt);

    const choiceWrap = document.createElement("div");
    choiceWrap.className = "story-mission-choices";
    ["Yes", "No"].forEach(choice => {
        const btn = document.createElement("button");
        btn.className = "challenge-btn";
        btn.textContent = choice;
        btn.disabled = Boolean(details.speciesState[missionIndex]);
        if (details.speciesState[missionIndex]) btn.classList.add("challenge-complete");
        btn.onclick = () => {
            if (choice !== mission.answer) {
                btn.textContent = "Not quite";
                setTimeout(() => {
                    if (!btn.disabled) btn.textContent = choice;
                }, 600);
                return;
            }
            if (!getAreaState(areaId).species[speciesIndex][missionIndex]) {
                getAreaState(areaId).species[speciesIndex][missionIndex] = true;
                saveStoryState();
            }
            btn.textContent = "Confirmed";
            btn.disabled = true;
            btn.classList.add("challenge-complete");
            renderMap();
            refreshAreaModal(areaId);
            const status = modal.querySelector(".single-mission-status");
            if (status) status.textContent = `${mission.reward} - mission cleared`;
            setTimeout(() => {
                const areaStateAfterSave = getAreaState(areaId);
                const speciesComplete = Boolean(areaStateAfterSave?.species?.[speciesIndex]?.every(Boolean));
                if (speciesComplete) {
                    closeSpeciesMissionRoom(modalId, areaId, speciesIndex);
                } else {
                    closeSingleMissionModal(modalId, areaId, speciesIndex);
                }
            }, 500);
        };
        choiceWrap.appendChild(btn);
    });
    body.appendChild(choiceWrap);

    const status = document.createElement("div");
    status.className = "mission-boss-note single-mission-status";
    status.textContent = details.speciesState[missionIndex] ? `${mission.reward} - mission cleared` : mission.reward;
    body.appendChild(status);

    closeBtn.onclick = () => closeSingleMissionModal(modalId, areaId, speciesIndex);
    modal.onclick = event => {
        if (event.target === modal) closeBtn.click();
    };

    modal.classList.remove("hidden");
    modal.style.display = "flex";
}

function closeSingleMissionModal(modalId, areaId, speciesIndex) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add("hidden");
        modal.style.display = "";
    }
    const areaState = getAreaState(areaId);
    const speciesComplete = Boolean(areaState?.species?.[speciesIndex]?.every(Boolean));
    if (speciesComplete) {
        closeSpeciesMissionRoom(modalId, areaId, speciesIndex);
        return;
    }
    const areaModal = document.getElementById("area-modal");
    if (areaModal && currentOpenAreaId) {
        areaModal.classList.remove("hidden");
        areaModal.style.display = "flex";
    }
    openMissionModal(areaId, speciesIndex);
}

function closeSpeciesMissionRoom(modalId, areaId, speciesIndex) {
    const singleMissionModal = document.getElementById(modalId);
    if (singleMissionModal) {
        singleMissionModal.classList.add("hidden");
        singleMissionModal.style.display = "";
    }
    const missionModal = document.getElementById("mission-modal");
    if (missionModal) {
        missionModal.classList.add("hidden");
        missionModal.style.display = "";
    }
    const areaModal = document.getElementById("area-modal");
    if (areaModal && currentOpenAreaId) {
        areaModal.classList.remove("hidden");
        areaModal.style.display = "flex";
    }
    currentOpenMission = null;
    refreshAreaModal(areaId);
    const areaState = getAreaState(areaId);
    const speciesComplete = Boolean(areaState?.species?.[speciesIndex]?.every(Boolean));
    if (speciesComplete) {
        const area = areaDefinitions.find(entry => entry.id === areaId);
        triggerStoryCelebration({
            variant: "species",
            title: `${area?.name || "Species"} Dossier Complete`,
            subtitle: "All three sightings are confirmed. The species record is locked in."
        });
    }
}

function closeMissionModal() {
    const modal = document.getElementById("mission-modal");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.display = "";
    }
    const areaModal = document.getElementById("area-modal");
    if (areaModal && currentOpenAreaId) {
        areaModal.classList.remove("hidden");
        areaModal.style.display = "flex";
    }
    currentOpenMission = null;
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

function completeOpenMapSectionLegacyUnused() {
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

    areaState.species = Array.from({ length: STORY_SPECIES_PER_AREA }, () => [true, true, true]);
    areaState.bossCompleted = true;
    completeArea(currentOpenAreaId);
    saveStoryState();
    renderMap();
    openAreaModal(currentOpenAreaId);

    console.log(`✅ Completed map section: ${area.name}`);
    return true;
}

function triggerStoryCelebration({ variant = "species", title, subtitle }) {
    const existing = document.querySelector(".story-celebration-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = `story-celebration-overlay story-celebration-${variant}`;
    const sparks = Array.from({ length: variant === "campaign" ? 24 : variant === "area" ? 18 : 12 }, (_, index) => {
        const angle = (360 / (variant === "campaign" ? 24 : variant === "area" ? 18 : 12)) * index;
        const distance = variant === "campaign" ? 340 : variant === "area" ? 260 : 180;
        return `<span class="story-celebration-spark" style="--spark-angle:${angle}deg; --spark-distance:${distance}px;"></span>`;
    }).join("");
    overlay.innerHTML = `
        <div class="story-celebration-glow"></div>
        <div class="story-celebration-burst">${sparks}</div>
        <div class="story-celebration-card">
            <div class="story-celebration-kicker">
                ${variant === "species" ? "Species Cleared" : variant === "area" ? "Area Cleared" : "Campaign Cleared"}
            </div>
            <h2>${title || "Victory"}</h2>
            <p>${subtitle || ""}</p>
        </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("visible"));
    setTimeout(() => {
        overlay.classList.remove("visible");
        setTimeout(() => overlay.remove(), 500);
    }, variant === "campaign" ? 2600 : variant === "area" ? 2000 : 1400);
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

function uncompleteOpenMapSectionLegacyUnused() {
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

    areaState.species = Array.from({ length: STORY_SPECIES_PER_AREA }, () => [false, false, false]);
    areaState.completed = false;
    areaState.bossCompleted = false;

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

function closeAreaModal() {
    const modal = document.getElementById("area-modal");
    const missionModal = document.getElementById("mission-modal");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.display = "";
    }
    if (missionModal) {
        missionModal.classList.add("hidden");
        missionModal.style.display = "";
    }
    currentOpenAreaId = null;
    currentOpenMission = null;
}

function refreshAreaModal(areaId = currentOpenAreaId) {
    if (!areaId) return;
    const modal = document.getElementById("area-modal");
    if (!modal || modal.classList.contains("hidden")) return;
    openAreaModal(areaId);
}

function buildSpeciesMissionPool(areaId, speciesIndex) {
    const area = areaDefinitions.find(entry => entry.id === areaId);
    const speciesName = getStorySpeciesLineup(area)[speciesIndex]?.name || area?.sharks?.[0] || "Unknown Shark";
    const regionalChoices = shuffle([
        ...new Set((area?.sharks || []).filter(name => name !== speciesName))
    ]).slice(0, 3);
    const distractors = shuffle([
        ...new Set(getOtherAreaSharks(areaId).filter(name => name !== speciesName && !regionalChoices.includes(name)))
    ]).slice(0, 6);
    return { area, speciesName, regionalChoices, distractors };
}

function getSharkDescriptor(sharkName) {
    const shark = window.sharks?.find?.(entry => entry.name === sharkName) || {};
    const sizeText = {
        Tiny: "small and quick to vanish under the swell",
        Small: "compact and streamlined",
        Medium: "a mid-sized hunter with a powerful silhouette",
        Large: "broad-bodied and unmistakably heavy through the water",
        Giant: "massive, almost impossible to mistake"
    }[shark.size] || "distinctive in the water";

    const habitatText = shark.habitat
        ? `${shark.habitat.toLowerCase()} waters`
        : "open water";
    const genusText = shark.genus ? `genus ${shark.genus}` : "a familiar shark lineage";
    return `${sizeText}, built for ${habitatText}, with ${genusText} traits`;
}

function getSharkVisualClue(sharkName) {
    const shark = window.sharks?.find?.(entry => entry.name === sharkName) || {};
    const profile = SHARK_VISUAL_PROFILES[sharkName];
    if (profile && profile.length) {
        return shuffle(profile)[0];
    }

    const sizeText = shark.size
        ? {
            Tiny: "very small and quick to disappear",
            Small: "small and nimble",
            Medium: "mid-sized and balanced",
            Large: "large and heavy-bodied",
            Giant: "gigantic and impossible to ignore"
        }[shark.size] || `${shark.size.toLowerCase()} in build`
        : "hard to judge in size";

    const habitatText = shark.habitat
        ? `it seems adapted to ${shark.habitat.toLowerCase()} waters`
        : "it is hard to place by habitat alone";
    const fallbackClues = [
        `It looks ${sizeText}.`,
        `From the hull, you can tell that ${habitatText}.`
    ];
    return shuffle(fallbackClues).join(" ");
}

function getSharkEvidence(sharkName) {
    const evidence = SHARK_EVIDENCE_LINES[sharkName];
    if (evidence && evidence.length) {
        return shuffle(evidence)[0];
    }
    const shark = window.sharks?.find?.(entry => entry.name === sharkName) || {};
    const sizeText = shark.size ? shark.size.toLowerCase() : "hard to judge in size";
    const habitatText = shark.habitat ? `it seems suited to ${shark.habitat.toLowerCase()} waters` : "it blends into the water";
    return `the shark looks ${sizeText} and ${habitatText}`;
}

function getObservationIntro() {
    return shuffle(SHARK_OBSERVATION_OPENERS)[0];
}

function getObservationContext() {
    return shuffle(SHARK_OBSERVATION_FRAGMENTS)[0];
}

function getConfidenceLevel() {
    return shuffle([1, 1, 2, 2, 3])[0];
}

function formatConfidenceClues(speciesName, confidenceLevel) {
    const lines = [
        `${getSharkEvidence(speciesName)}.`,
        `${getSharkVisualClue(speciesName)}.`,
        `The outline and markings match the species profile.`
    ];
    return lines.slice(0, Math.max(1, Math.min(confidenceLevel, 3))).join(" ");
}

function buildSightingPrompt(speciesName, focusName, isTarget) {
    const confidenceLevel = getConfidenceLevel();
    const opener = getObservationIntro();
    const context = getObservationContext();
    const targetName = speciesName;
    const subjectName = focusName || speciesName;
    const clueText = isTarget
        ? formatConfidenceClues(targetName, confidenceLevel)
        : formatConfidenceClues(subjectName, confidenceLevel);

    const question = `Is this species a ${targetName}?`;
    return `${opener} ${context}, and you can see ${clueText} ${question}`;
}

function getObservationRangeText() {
    const ranges = [
        "about 40 meters away",
        "roughly 75 meters off the starboard side",
        "nearly 120 meters from the boat",
        "just beyond the wake at 90 meters",
        "around 60 meters through the chop"
    ];
    return shuffle(ranges)[0];
}

function getSpeciesConfidenceQuestion(speciesName) {
    return `Is this species a ${speciesName}?`;
}

function renderMap() {
    const pins = document.getElementById("map-pins");
    const summary = document.getElementById("map-summary");
    if (!pins || !storyState) return;

    pins.innerHTML = "";
    if (summary) summary.innerHTML = "";

    const areaRows = [];
    areaDefinitions.forEach((area, index) => {
        const areaState = getAreaState(area.id);
        const pin = document.createElement("div");
        pin.className = "map-pin";
        pin.classList.toggle("completed", Boolean(areaState.completed));
        pin.classList.toggle("locked", !areaState.unlocked);
        pin.style.left = `${area.left}%`;
        pin.style.top = `${area.top}%`;

        const btn = document.createElement("button");
        btn.className = "map-pin-btn";
        btn.type = "button";
        btn.disabled = !areaState.unlocked;
        btn.title = areaState.unlocked ? `Open ${area.name}` : `${area.name} is locked`;
        btn.setAttribute("aria-label", btn.title);
        btn.innerHTML = areaState.completed
            ? '<i class="fa-solid fa-check" aria-hidden="true"></i>'
            : areaState.unlocked
                ? '<i class="fa-solid fa-location-dot" aria-hidden="true"></i>'
                : '<i class="fa-solid fa-lock" aria-hidden="true"></i>';
        btn.onclick = () => {
            if (areaState.unlocked) openAreaModal(area.id);
        };

        const label = document.createElement("div");
        label.className = "map-pin-label";
        label.textContent = area.name;

        pin.appendChild(btn);
        pin.appendChild(label);
        pins.appendChild(pin);

        if (summary) {
            const speciesProgress = (areaState.species || []).flat().filter(Boolean).length;
            const bossReady = isBossUnlocked(areaState);
            const row = document.createElement("button");
            row.type = "button";
            row.className = "map-summary-card";
            row.disabled = !areaState.unlocked;
            row.innerHTML = `
                <div class="map-summary-top">
                    <span class="map-summary-index">0${index + 1}</span>
                    <span class="map-summary-state ${areaState.completed ? "done" : areaState.unlocked ? "live" : "locked"}">${areaState.completed ? "Complete" : areaState.unlocked ? "Open" : "Locked"}</span>
                </div>
                <strong>${area.name}</strong>
                <p>${speciesProgress}/9 species tasks complete${bossReady ? " - boss unlocked" : ""}</p>
            `;
            row.onclick = () => openAreaModal(area.id);
            areaRows.push(row);
        }
    });

    if (summary) {
        const headline = document.createElement("div");
        headline.className = "map-summary-headline";
        headline.innerHTML = `
            <div class="map-summary-big">${areaDefinitions.filter(area => getAreaState(area.id).completed).length}</div>
            <div>
                <strong>Chapters cleared</strong>
                <p>${areaDefinitions.length} regions on the campaign board</p>
            </div>
        `;
        summary.appendChild(headline);
        areaRows.forEach(row => summary.appendChild(row));
    }
}

async function openAreaModal(areaId) {
    const area = areaDefinitions.find(entry => entry.id === areaId);
    const areaState = area ? getAreaState(areaId) : null;
    const modal = document.getElementById("area-modal");
    if (!area || !areaState || !modal || !areaState.unlocked) return;

    const closeBtn = document.getElementById("close-modal");
    const title = document.getElementById("modal-title");
    const speciesContainer = document.getElementById("area-species-container");
    const label = document.querySelector(".story-modal-area-label");
    const narrative = document.getElementById("story-modal-narrative");
    const progressBar = document.getElementById("story-modal-progress-bar");
    const progressLabel = document.getElementById("story-modal-progress-label");

    currentOpenAreaId = areaId;

    if (title) title.textContent = area.name;
    if (label) {
        label.innerHTML = `<span class="area-icon"><i class="fa-solid fa-water" aria-hidden="true"></i></span> ${area.label}`;
    }

    if (typeof currentUser !== "undefined" && currentUser && typeof loadUserProfile === "function") {
        const profile = typeof getCurrentProfileData === "function" ? getCurrentProfileData() : null;
        if (!profile || !profile.username) {
            try {
                await loadUserProfile();
            } catch (error) {
                console.warn("Failed to load user profile for narrative:", error);
            }
        }
    }

    if (narrative) {
        narrative.textContent = areaState.completed
            ? interpolateNarrative(area.completionNarrative)
            : interpolateNarrative(area.narrative);
    }

    const completeCount = getAreaProgressCount(areaState);
    const totalTasks = (STORY_SPECIES_PER_AREA * STORY_TASKS_PER_SPECIES) + 1;
    if (progressBar) progressBar.style.width = `${(completeCount / totalTasks) * 100}%`;
    if (progressLabel) progressLabel.textContent = `${completeCount}/${totalTasks} Missions Complete`;

    if (speciesContainer) speciesContainer.innerHTML = "";

    const speciesLineup = getStorySpeciesLineup(area);
    const dashboard = document.createElement("div");
    dashboard.className = "story-area-dashboard";
    speciesLineup.forEach((species, speciesIndex) => {
        const card = document.createElement("div");
        card.className = "story-species-card";
        const speciesState = areaState.species?.[speciesIndex] || [false, false, false];
        const completedTasks = speciesState.filter(Boolean).length;
        card.innerHTML = `
            <div class="story-species-card-top">
                <div>
                    <div class="story-species-index">${species.order}</div>
                    <b>${species.name}</b>
                </div>
                <div class="story-species-progress">${completedTasks}/3</div>
            </div>
            <div class="story-species-desc">Open the dossier to complete three sightings and unlock the chapter boss.</div>
        `;

        const openBtn = document.createElement("button");
        openBtn.className = "challenge-btn";
        openBtn.style.marginTop = "14px";
        openBtn.textContent = speciesState.every(Boolean) ? "Reopen dossier" : "Open dossier";
        if (speciesState.every(Boolean)) openBtn.classList.add("dossier-complete");
        openBtn.onclick = () => openMissionModal(areaId, speciesIndex);
        card.appendChild(openBtn);
        dashboard.appendChild(card);
    });
    speciesContainer?.appendChild(dashboard);

    if (isBossUnlocked(areaState)) {
        const bossCard = document.createElement("div");
        bossCard.className = "story-boss-card";
        bossCard.innerHTML = `
            <div class="story-species-card-top">
                <div>
                    <div class="story-species-index boss">Boss</div>
                    <b>${area.bossMission?.title || "Boss Mission"}</b>
                </div>
                <div class="story-species-progress ready">Ready</div>
            </div>
            <div class="story-species-desc">${area.bossMission?.desc || "The final chapter mission awaits."}</div>
        `;
        const bossBtn = document.createElement("button");
        bossBtn.className = "challenge-btn";
        bossBtn.style.marginTop = "14px";
        bossBtn.textContent = areaState.completed ? "Boss complete" : "Start boss mission";
        bossBtn.disabled = areaState.completed;
        bossBtn.onclick = () => startBossMission(areaId);
        bossCard.appendChild(bossBtn);
        speciesContainer?.appendChild(bossCard);
    }

    if (closeBtn) closeBtn.onclick = closeAreaModal;
    modal.onclick = event => {
        if (event.target === modal) closeAreaModal();
    };

    modal.classList.remove("hidden");
    modal.style.display = "";
}

function completeOpenMapSection() {
    const modal = document.getElementById("area-modal");
    if (!modal || modal.classList.contains("hidden") || !currentOpenAreaId) {
        console.log("Open a map section modal first, then run completeOpenMapSection().");
        return false;
    }

    const area = areaDefinitions.find(entry => entry.id === currentOpenAreaId);
    const areaState = getAreaState(currentOpenAreaId);
    if (!area || !areaState) {
        console.log("Could not resolve the currently open map section.");
        return false;
    }

    areaState.challenges = [true, true, true];
    completeArea(currentOpenAreaId);
    saveStoryState();
    renderMap();
    openAreaModal(currentOpenAreaId);

    console.log(`Completed map section: ${area.name}`);
    return true;
}

function uncompleteOpenMapSection() {
    const modal = document.getElementById("area-modal");
    if (!modal || modal.classList.contains("hidden") || !currentOpenAreaId) {
        console.log("Open a map section modal first, then run uncompleteOpenMapSection().");
        return false;
    }

    const area = areaDefinitions.find(entry => entry.id === currentOpenAreaId);
    const areaState = getAreaState(currentOpenAreaId);
    if (!area || !areaState) {
        console.log("Could not resolve the currently open map section.");
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

    console.log(`Uncompleted map section: ${area.name}`);
    return true;
}

document.addEventListener("DOMContentLoaded", () => {
    loadStoryState();
    renderMap();
});
