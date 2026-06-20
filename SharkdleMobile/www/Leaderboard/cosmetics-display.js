/**
 * Shared cosmetic display helpers for leaderboards and other read-only profile views.
 */
(function () {
    const LEADERBOARD_BADGES = [
        { id: "starter", name: "Starter", emoji: "🦈" },
        { id: "dev", name: "Developer", emoji: "🖥️" },
        { id: "tester", name: "Tester", emoji: "🎮" },
        { id: "anniversary", name: "Anniversary", emoji: "🎉" },
        { id: "lucky-fin", name: "Lucky Fin", emoji: "🍀" },
        { id: "reef-scout", name: "Shiver", emoji: "🐟" },
        { id: "bronze-fin", name: "Pup", emoji: "🪸" },
        { id: "night-diver", name: "Juvenile", emoji: "🌙" },
        { id: "abyss-explorer", name: "Oceanic", emoji: "💙" },
        { id: "open-water-ace", name: "Subadult", emoji: "✨" },
        { id: "storm-tracker", name: "Prime", emoji: "⚡" },
        { id: "apex-voyager", name: "Apex", emoji: "👑" },
        { id: "reef-glint", name: "Driftwood", emoji: "🪵" },
        { id: "kelp-warden", name: "Smelly Boot", emoji: "🥾" },
        { id: "trench-myth", name: "Message Bottle", emoji: "🍾" },
        { id: "aurora-fin", name: "Doubloon", emoji: "🪙" },
        { id: "Tidepool", name: "Tidepool", emoji: "🌀" },
        { id: "Ice Cream", name: "Ice Cream", emoji: "🍦" },
        { id: "Horizon", name: "Horizon", emoji: "🌅" },
        { id: "Paradise", name: "Paradise", emoji: "🌴" },
        { id: "Christmas", name: "Christmas", emoji: "🎄" },
        { id: "Present", name: "Present", emoji: "🎁" },
        { id: "Snowflake", name: "Snowflake", emoji: "❄️" },
        { id: "Santa", name: "Santa", emoji: "🎅" },
        { id: "Pumpkin", name: "Pumpkin", emoji: "🎃" },
        { id: "Bat", name: "Bat", emoji: "🦇" },
        { id: "Ghost", name: "Ghost", emoji: "👻" },
        { id: "Vampire", name: "Vampire", emoji: "🧛" }
    ];

    const BADGE_BY_ID = Object.fromEntries(LEADERBOARD_BADGES.map(badge => [badge.id, badge]));

    const BADGE_RARITY_BY_ID = {
        starter: "core",
        tester: "code",
        dev: "special",
        anniversary: "special",
        "lucky-fin": "epic",
        "reef-scout": "common",
        "bronze-fin": "common",
        "reef-glint": "common",
        Tidepool: "common",
        Christmas: "common",
        Pumpkin: "common",
        "night-diver": "rare",
        "kelp-warden": "rare",
        "Ice Cream": "rare",
        Present: "rare",
        Bat: "rare",
        "abyss-explorer": "epic",
        "open-water-ace": "epic",
        "trench-myth": "epic",
        Horizon: "epic",
        Snowflake: "epic",
        Ghost: "epic",
        "storm-tracker": "legendary",
        "apex-voyager": "legendary",
        "aurora-fin": "legendary",
        Paradise: "legendary",
        Santa: "legendary",
        Vampire: "legendary"
    };

    const BADGE_PALETTE_BY_RARITY = {
        core: { border: "#00b4d8", bg: "rgba(0,180,216,0.10)", text: "#00b4d8" },
        code: { border: "#ff8a3d", bg: "rgba(255,138,61,0.15)", text: "#ffc18d" },
        special: { border: "#FFD700", bg: "rgba(255,215,0,0.13)", text: "#FFD700" },
        common: { border: "#00b4d8", bg: "rgba(0,180,216,0.10)", text: "#00b4d8" },
        rare: { border: "#6ee7ff", bg: "rgba(77,208,225,0.14)", text: "#9cf4ff" },
        epic: { border: "#a99bff", bg: "rgba(120,119,255,0.16)", text: "#d2cbff" },
        legendary: { border: "#ffd47f", bg: "rgba(255,196,87,0.18)", text: "#ffe3ad" }
    };

    const LEADERBOARD_THEME_IDS = new Set([
        "default",
        "tidal-blue",
        "sunken-gold",
        "coral-bloom",
        "deep-abyss",
        "storm-current",
        "pearl-reef",
        "volcanic-ember",
        "kelp-canopy",
        "glacier-shine",
        "ocean-breeze",
        "horizonflare",
        "solsticeglow",
        "candycane",
        "elf",
        "north-pole",
        "pumpkin-patch",
        "haunted-abyss",
        "nightmare-reef"
    ]);

    const PFP_OBTAINMENT_MAP = {
        "images/pfp/shark1.png": "Default Profile Icon",
        "images/leaderPfp/Shark19.png": "All-Time Leaderboard Top 3 Reward",
        "images/leaderPfp/Daily/Shark1.png": "Daily Leaderboard #1 Reward — Catshark",
        "images/leaderPfp/Monthly/Shark1.png": "Monthly Leaderboard #1 Reward — Whitetip Reef Shark",
        "images/codePfp/Shark17.png": "Redeem Code Reward",
        "images/codePfp/Shark18.png": "Redeem Code Reward",
        "images/codePfp/Shark19.png": "Redeem Code Reward",
        "images/codePfp/Shark26.png": "Anniversary Code Reward — Hammerhead Shark",
        "images/loginPfp/Shark20.png": "Day 7 Login Streak Reward",
        "images/cratePfp/Shark22.png": "Cosmetic Crate Reward",
        "images/cratePfp/Shark23.png": "Cosmetic Crate Reward",
        "images/cratePfp/Shark24.png": "Cosmetic Crate Reward",
        "images/cratePfp/Shark25.png": "Cosmetic Crate Reward",
        "images/cratePfp/SummerPfp/Shark1.png": "Summer Crate Reward",
        "images/cratePfp/SummerPfp/Shark2.png": "Summer Crate Reward",
        "images/cratePfp/SummerPfp/Shark3.png": "Summer Crate Reward",
        "images/cratePfp/SummerPfp/Shark4.png": "Summer Crate Reward",
        "images/cratePfp/ChristmasPfp/Shark1.png": "Christmas Crate Reward",
        "images/cratePfp/ChristmasPfp/Shark2.png": "Christmas Crate Reward",
        "images/cratePfp/ChristmasPfp/Shark3.png": "Christmas Crate Reward",
        "images/cratePfp/ChristmasPfp/Shark4.png": "Christmas Crate Reward",
        "images/cratePfp/HalloweenPfp/Shark1.png": "Halloween Crate Reward",
        "images/cratePfp/HalloweenPfp/Shark2.png": "Halloween Crate Reward",
        "images/cratePfp/HalloweenPfp/Shark3.png": "Halloween Crate Reward",
        "images/cratePfp/HalloweenPfp/Shark4.png": "Halloween Crate Reward",
        "images/levelPfp/Shark6.png": "Shark Pass Level 2",
        "images/levelPfp/Shark7.png": "Shark Pass Level 3",
        "images/levelPfp/Shark8.png": "Shark Pass Level 4",
        "images/levelPfp/Shark9.png": "Shark Pass Level 5",
        "images/levelPfp/Shark10.png": "Shark Pass Level 6",
        "images/levelPfp/Shark11.png": "Shark Pass Level 7",
        "images/levelPfp/Shark12.png": "Shark Pass Level 8",
        "images/levelPfp/Shark13.png": "Shark Pass Level 9",
        "images/levelPfp/Shark14.png": "Shark Pass Level 10",
        "images/levelPfp/Shark15.png": "Shark Pass Level 15",
        "images/levelPfp/Shark16.png": "Shark Pass Level 20"
    };

    function resolveProfilePicturePath(storedProfilePic) {
        let profilePicPath = "images/pfp/shark1.png";
        if (storedProfilePic) {
            if (storedProfilePic.startsWith("images/")) {
                profilePicPath = storedProfilePic;
            } else if (storedProfilePic.includes("/")) {
                profilePicPath = `images/${storedProfilePic}`;
            } else {
                profilePicPath = `images/pfp/${storedProfilePic}`;
            }
        }
        return profilePicPath
            .replace(/cratePfp\/summerPfp\//i, "cratePfp/SummerPfp/")
            .replace(/cratePfp\/christmasPfp\//i, "cratePfp/ChristmasPfp/")
            .replace(/cratePfp\/halloweenPfp\//i, "cratePfp/HalloweenPfp/");
    }

    function getProfilePicBorderColor(profilePicPath, isCurrentUser) {
        let borderColor = "#3e92cc";
        if (/leaderPfp\/Shark19\.png$/i.test(profilePicPath)) {
            borderColor = "#D4AF37";
        } else if (/leaderPfp\/Daily\/Shark1\.png$/i.test(profilePicPath)) {
            borderColor = "#6ee7ff";
        } else if (/leaderPfp\/Monthly\/Shark1\.png$/i.test(profilePicPath)) {
            borderColor = "#a99bff";
        } else if (/codePfp\//i.test(profilePicPath)) {
            borderColor = "#ff6b6b";
        } else if (/spinPfp\//i.test(profilePicPath)) {
            borderColor = "#ffd47f";
        } else if (/loginPfp\//i.test(profilePicPath)) {
            borderColor = "#ffd47f";
        } else if (/levelPfp\/Shark16\.png$/i.test(profilePicPath)) {
            borderColor = "#ffc107";
        } else if (/levelPfp\/Shark1[2-5]\.png$/i.test(profilePicPath)) {
            borderColor = "#e91e63";
        } else if (/levelPfp\//i.test(profilePicPath)) {
            borderColor = "#4caf50";
        } else {
            const seasonalCrateMatch = profilePicPath.match(/cratePfp\/(?:SummerPfp|ChristmasPfp|HalloweenPfp)\/Shark([1-4])\.png$/i);
            if (seasonalCrateMatch) {
                const seasonalBorderByRarity = {
                    1: "#5adca5",
                    2: "#6ee7ff",
                    3: "#a99bff",
                    4: "#ffd47f"
                };
                borderColor = seasonalBorderByRarity[Number(seasonalCrateMatch[1])] || borderColor;
            } else if (/cratePfp\/Shark24\.png$/i.test(profilePicPath)) {
                borderColor = "#5adca5";
            } else if (/cratePfp\/Shark25\.png$/i.test(profilePicPath)) {
                borderColor = "#6ee7ff";
            } else if (/cratePfp\/Shark23\.png$/i.test(profilePicPath)) {
                borderColor = "#a99bff";
            } else if (/cratePfp\/Shark22\.png$/i.test(profilePicPath)) {
                borderColor = "#ffd47f";
            }
        }
        if (isCurrentUser) {
            borderColor = "#FFD700";
        }
        return borderColor;
    }

    function getProfilePicObtainment(profilePicPath) {
        return PFP_OBTAINMENT_MAP[profilePicPath] || "Profile Icon";
    }

    function getBadgeMeta(badgeId) {
        return BADGE_BY_ID[badgeId] || BADGE_BY_ID.starter;
    }

    function getBadgePalette(badgeId) {
        const rarity = BADGE_RARITY_BY_ID[badgeId] || "common";
        return BADGE_PALETTE_BY_RARITY[rarity] || BADGE_PALETTE_BY_RARITY.common;
    }

    function sanitizeCardTheme(themeId) {
        const normalized = String(themeId || "default").trim().toLowerCase();
        return LEADERBOARD_THEME_IDS.has(normalized) ? normalized : "default";
    }

    function mergeRowCosmetics(firestoreData, localProfileData) {
        if (!localProfileData || typeof localProfileData !== "object") {
            return { ...firestoreData };
        }
        const localPic = localProfileData.profilePicture || localProfileData.profilePic;
        const remotePic = firestoreData.profilePicture || firestoreData.profilePic;
        return {
            ...firestoreData,
            profilePicture: localPic || remotePic,
            profilePic: localPic || remotePic,
            equippedBadge: localProfileData.equippedBadge || firestoreData.equippedBadge || "starter",
            equippedCardTheme: localProfileData.equippedCardTheme || firestoreData.equippedCardTheme || "default"
        };
    }

    function buildProfilePicHtml(profilePicPath, isCurrentUser) {
        const borderColor = getProfilePicBorderColor(profilePicPath, isCurrentUser);
        const obtainment = getProfilePicObtainment(profilePicPath);
        return `<img src="${profilePicPath}" alt="Profile" title="${obtainment}" onerror="this.onerror=null;this.src='images/pfp/shark1.png';" style="width:38px;height:38px;border-radius:50%;border:2px solid ${borderColor};background:#18304a;object-fit:cover;box-shadow:0 1px 4px rgba(30,41,59,0.12);">`;
    }

    function buildBadgeHtml(badgeId) {
        const badge = getBadgeMeta(badgeId);
        const palette = getBadgePalette(badge.id);
        return `<div style='margin-top:2px; display: flex; align-items: center; justify-content: center; gap: 6px;'>
            <span style="display:inline-block;font-size:1.1em;background:${palette.bg};border-radius:7px;padding:1px 7px 1px 7px;border:1.5px solid ${palette.border};vertical-align:middle;">${badge.emoji}</span>
            <span style="font-size:0.85em;color:${palette.text};font-weight:600;">${badge.name}</span>
        </div>`;
    }

    function buildCosmeticSyncPayload(localProfileData) {
        if (!localProfileData || typeof localProfileData !== "object") return {};
        const payload = {};
        const profilePic = localProfileData.profilePicture || localProfileData.profilePic;
        if (profilePic) {
            payload.profilePicture = profilePic;
            payload.profilePic = profilePic;
        }
        if (localProfileData.equippedBadge) payload.equippedBadge = localProfileData.equippedBadge;
        if (localProfileData.equippedCardTheme) payload.equippedCardTheme = localProfileData.equippedCardTheme;
        return payload;
    }

    window.SharkdleCosmeticsDisplay = {
        LEADERBOARD_BADGES,
        LEADERBOARD_THEME_IDS,
        resolveProfilePicturePath,
        getProfilePicBorderColor,
        getProfilePicObtainment,
        getBadgeMeta,
        getBadgePalette,
        sanitizeCardTheme,
        mergeRowCosmetics,
        buildProfilePicHtml,
        buildBadgeHtml,
        buildCosmeticSyncPayload
    };
})();
