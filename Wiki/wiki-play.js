/* The playing guide: explanatory articles and complete progression references.
 * Tables below are a saved edition of the game's public reward lists.
 * This file never loads game scripts, signs in, or requests player data.
 */
(() => {
  const reference = {
  "passRewards": [
    [
      "2",
      "Zebra Bullhead Shark",
      "Portrait",
      "Common"
    ],
    [
      "3",
      "Bullhead Bloom",
      "Badge",
      "Common"
    ],
    [
      "4",
      "Brown Stingray",
      "Portrait",
      "Common"
    ],
    [
      "5",
      "Ray Drift",
      "Badge",
      "Common"
    ],
    [
      "6",
      "Common Guitarfish",
      "Portrait",
      "Rare"
    ],
    [
      "7",
      "Reef Signal",
      "Profile theme",
      "Rare"
    ],
    [
      "8",
      "Bottlenose Wedgefish",
      "Portrait",
      "Rare"
    ],
    [
      "8",
      "Guitarfish Glide",
      "Badge",
      "Rare"
    ],
    [
      "10",
      "Rusty Carpet Shark",
      "Portrait",
      "Epic"
    ],
    [
      "10",
      "Carpet Shadow",
      "Badge",
      "Epic"
    ],
    [
      "12",
      "Coffin Ray",
      "Portrait",
      "Epic"
    ],
    [
      "12",
      "Coffin Depths",
      "Badge",
      "Epic"
    ],
    [
      "15",
      "Copper Shark",
      "Portrait",
      "Epic"
    ],
    [
      "15",
      "Copper Surge",
      "Profile theme",
      "Legendary"
    ],
    [
      "18",
      "Australian Bull Ray",
      "Portrait",
      "Legendary"
    ],
    [
      "18",
      "Copper Current",
      "Badge",
      "Legendary"
    ],
    [
      "20",
      "Galapagos Shark",
      "Portrait",
      "Legendary"
    ],
    [
      "20",
      "Bull Ray Banner",
      "Badge",
      "Legendary"
    ],
    [
      "22",
      "Bluntnose Sixgill Shark",
      "Portrait",
      "Legendary"
    ],
    [
      "22",
      "Galapagos Guard",
      "Badge",
      "Epic"
    ],
    [
      "24",
      "Raylight Drift",
      "Profile theme",
      "Epic"
    ],
    [
      "26",
      "Sixgill Sovereign",
      "Badge",
      "Legendary"
    ],
    [
      "28",
      "Shark Pass 2 Crate",
      "Seasonal crate",
      "Legendary"
    ],
    [
      "30",
      "Sixgill Night",
      "Profile theme",
      "Legendary"
    ]
  ],
  "dailyQuests": [
    [
      "First Fin",
      "Play 1 Sharkdle game today.",
      "180"
    ],
    [
      "Clean Catch",
      "Win 1 daily game today.",
      "260"
    ],
    [
      "XP Splash",
      "Earn 500 XP today.",
      "320"
    ]
  ],
  "weeklyQuests": [
    [
      "Weekly Patrol",
      "Play 10 games this week.",
      "1,000"
    ],
    [
      "Win Current",
      "Win 5 games this week.",
      "1,400"
    ],
    [
      "Research Surge",
      "Earn 3,500 XP this week.",
      "1,800"
    ]
  ],
  "seasonQuests": [
    [
      "First Current",
      "Play 3 games this season.",
      "450"
    ],
    [
      "Reef Wins",
      "Win 5 games this season.",
      "900"
    ],
    [
      "Daily Scout",
      "Win 2 daily games during the season.",
      "700"
    ],
    [
      "Streak Signal",
      "Reach a 3 win streak.",
      "850"
    ],
    [
      "Deep Research",
      "Earn 7,500 XP this season.",
      "1,200"
    ],
    [
      "Crate Current",
      "Open 2 cosmetic crates this season.",
      "1,000"
    ],
    [
      "Shiver Run",
      "Play 20 games this season.",
      "1,800"
    ],
    [
      "Apex Hunt",
      "Win 15 games this season.",
      "2,400"
    ],
    [
      "Treasure Tide",
      "Open 5 cosmetic crates this season.",
      "2,100"
    ],
    [
      "Master Current",
      "Earn 25,000 XP this season.",
      "4,200"
    ]
  ],
  "achievementTables": [
    {
      "title": "Special achievements",
      "rows": [
        [
          "Lightning Fast",
          "Win in 2 guesses",
          "75",
          "Rare",
          "—"
        ],
        [
          "Comeback King",
          "Win with only 1 guess left",
          "75",
          "Rare",
          "—"
        ],
        [
          "Depths Discovered",
          "Discover the hidden Shark Rescue Command page",
          "180",
          "Epic",
          "Pearl Reef theme"
        ],
        [
          "First Unboxing",
          "Open a Cosmetic Crate",
          "40",
          "Common",
          "—"
        ],
        [
          "First Summer Unboxing",
          "Open a Summer Crate",
          "40",
          "Common",
          "—"
        ],
        [
          "First Halloween Unboxing",
          "Open a Halloween Crate",
          "40",
          "Common",
          "—"
        ],
        [
          "First Christmas Unboxing",
          "Open a Christmas Crate",
          "40",
          "Common",
          "—"
        ],
        [
          "First Renown",
          "Prestige once in Shark Rescue Command",
          "100",
          "Rare",
          "—"
        ],
        [
          "Command Veteran",
          "Complete 25 missions in Shark Rescue Command",
          "140",
          "Rare",
          "—"
        ],
        [
          "Cell Splitter",
          "Earn 10 Apex Cells in Shark Rescue Command",
          "180",
          "Epic",
          "—"
        ],
        [
          "Saviour",
          "Lose a game but have a streak shield protect your win streak",
          "100",
          "Rare",
          "—"
        ],
        [
          "Crate Collector",
          "Open 10 cosmetic crates",
          "125",
          "Rare",
          "Crate Connoisseur badge"
        ],
        [
          "Vault Breaker",
          "Open 50 cosmetic crates",
          "320",
          "Legendary",
          "Neon Reef theme"
        ]
      ]
    },
    {
      "title": "Win milestones",
      "rows": [
        [
          "Novice Observer",
          "Win 1 game",
          "10",
          "Common",
          "—"
        ],
        [
          "Rising Observer",
          "Win 3 games",
          "20",
          "Common",
          "—"
        ],
        [
          "Skilled Observer",
          "Win 5 games",
          "25",
          "Common",
          "—"
        ],
        [
          "Experienced Observer",
          "Win 10 games",
          "50",
          "Rare",
          "—"
        ],
        [
          "Legendary Observer",
          "Win 25 games",
          "100",
          "Rare",
          "—"
        ],
        [
          "Master Observer",
          "Win 50 games",
          "150",
          "Epic",
          "—"
        ],
        [
          "Mythical Observer",
          "Win 100 games",
          "250",
          "Epic",
          "—"
        ],
        [
          "Transcendant Observer",
          "Win 250 games",
          "400",
          "Legendary",
          "—"
        ],
        [
          "Abyssal Legend",
          "Win 500 games",
          "550",
          "Mythic",
          "Abyssal Legend badge"
        ],
        [
          "Eternal Fin",
          "Win 1,000 games",
          "900",
          "Mythic",
          "Lunar Current theme"
        ]
      ]
    },
    {
      "title": "Games-played milestones",
      "rows": [
        [
          "Getting Started",
          "Play 10 games",
          "15",
          "Common",
          "—"
        ],
        [
          "Committed Player",
          "Play 20 games",
          "30",
          "Common",
          "—"
        ],
        [
          "Dedicated Gamer",
          "Play 50 games",
          "75",
          "Rare",
          "—"
        ],
        [
          "Obsessed",
          "Play 100 games",
          "150",
          "Epic",
          "—"
        ],
        [
          "Cant Stop",
          "Play 250 games",
          "250",
          "Epic",
          "—"
        ],
        [
          "True Addict",
          "Play 500 games",
          "400",
          "Legendary",
          "—"
        ],
        [
          "Deep Habit",
          "Play 750 games",
          "520",
          "Mythic",
          "—"
        ],
        [
          "Marathon Fin",
          "Play 1,000 games",
          "750",
          "Mythic",
          "Marathon Fin badge"
        ]
      ]
    },
    {
      "title": "Win-streak milestones",
      "rows": [
        [
          "On a Roll",
          "Win 1 game in a row",
          "10",
          "Common",
          "—"
        ],
        [
          "On Fire",
          "Win 3 games in a row",
          "25",
          "Common",
          "—"
        ],
        [
          "Hot Streak",
          "Win 5 games in a row",
          "40",
          "Common",
          "—"
        ],
        [
          "Unbeatable",
          "Win 10 games in a row",
          "100",
          "Rare",
          "—"
        ],
        [
          "Unstoppable",
          "Win 25 games in a row",
          "200",
          "Epic",
          "—"
        ],
        [
          "Invincible",
          "Win 50 games in a row",
          "350",
          "Legendary",
          "—"
        ],
        [
          "Current Keeper",
          "Win 75 games in a row",
          "500",
          "Mythic",
          "—"
        ],
        [
          "Untouchable Tide",
          "Win 100 games in a row",
          "800",
          "Mythic",
          "Volcanic Ember theme"
        ]
      ]
    },
    {
      "title": "Efficient guessing",
      "rows": [
        [
          "One-Shot Oracle",
          "Win in 1 guess",
          "125",
          "Rare",
          "One-Shot Oracle badge"
        ],
        [
          "Sharp Mind",
          "Average 4 or fewer guesses per win",
          "100",
          "Rare",
          "—"
        ],
        [
          "Guess Master",
          "Average 3 or fewer guesses per win",
          "150",
          "Epic",
          "Deep Abyss theme"
        ]
      ]
    },
    {
      "title": "Friend duels",
      "rows": [
        [
          "First Blood",
          "Play your first friend duel",
          "40",
          "Common",
          "—"
        ],
        [
          "Apex Rival",
          "Win a friend duel",
          "75",
          "Rare",
          "Storm Current theme"
        ],
        [
          "Duel Regular",
          "Play 10 friend duels",
          "140",
          "Rare",
          "—"
        ],
        [
          "Rival Breaker",
          "Win 10 friend duels",
          "260",
          "Epic",
          "Rival Breaker badge"
        ],
        [
          "Arena Apex",
          "Win 25 friend duels",
          "420",
          "Legendary",
          "—"
        ]
      ]
    },
    {
      "title": "Story and World Map",
      "rows": [
        [
          "Atlantic Mastered",
          "Complete the World Map Atlantic Challenge",
          "150",
          "Epic",
          "—"
        ],
        [
          "Pacific Mastered",
          "Complete the World Map Pacific Challenge",
          "200",
          "Epic",
          "Coral Bloom theme"
        ],
        [
          "Indian Mastered",
          "Complete Indian Region on the world map",
          "250",
          "Epic",
          "—"
        ],
        [
          "South Africa Mastered",
          "Complete South Africa region on the world map",
          "300",
          "Legendary",
          "—"
        ],
        [
          "USA Mastered",
          "Complete USA region on the world map",
          "350",
          "Legendary",
          "—"
        ],
        [
          "Mediterranean Mastered",
          "Complete Mediterranean region on the world map",
          "300",
          "Legendary",
          "—"
        ],
        [
          "Japan Mastered",
          "Complete Japan region on the world map",
          "450",
          "Legendary",
          "Deep Cartographer badge"
        ],
        [
          "Australia Mastered",
          "Complete Australia region on the world map",
          "325",
          "Legendary",
          "—"
        ]
      ]
    },
    {
      "title": "Social milestones",
      "rows": [
        [
          "First Friend",
          "Add your first friend",
          "25",
          "Common",
          "—"
        ],
        [
          "Social Butterfly",
          "Add 3 friends",
          "50",
          "Rare",
          "—"
        ],
        [
          "Popular",
          "Add 5 friends",
          "100",
          "Rare",
          "—"
        ],
        [
          "Socialite",
          "Add 10 friends",
          "200",
          "Epic",
          "—"
        ],
        [
          "Social Current",
          "Add 25 friends",
          "420",
          "Legendary",
          "Social Current badge"
        ]
      ]
    }
  ],
  "codes": [
    [
      "SHARKDLE",
      "2,500",
      "Wobbegong Shark portrait",
      "Recognised; one claim per account."
    ],
    [
      "TIKTOK2026",
      "2,000",
      "Manta Ray portrait",
      "Recognised; one claim per account."
    ],
    [
      "INSTAGRAM2026",
      "2,000",
      "Whitespotted Eagle Ray portrait",
      "Recognised; one claim per account."
    ],
    [
      "SHARKG33K",
      "2,000",
      "SharkG33k Creator portrait",
      "Recognised; one claim per account."
    ],
    [
      "LSFSW",
      "2,000",
      "LSFSW Partner portrait; 250 pearls",
      "Recognised; one claim per account."
    ],
    [
      "SUMMER2026",
      "3,000",
      "1 summer crate",
      "Recognised code; Summer Crate component is retired. See the caveat below."
    ]
  ],
  "social": [
    [
      "YouTube",
      "Like Sharkdle Short 1",
      "50"
    ],
    [
      "YouTube",
      "Like Sharkdle Short 2",
      "50"
    ],
    [
      "YouTube",
      "Like Sharkdle Short 3",
      "50"
    ],
    [
      "YouTube",
      "Like Sharkdle Short 4",
      "50"
    ],
    [
      "YouTube",
      "Like Sharkdle Short 5",
      "50"
    ],
    [
      "YouTube",
      "Like Sharkdle Short 6",
      "50"
    ],
    [
      "YouTube",
      "Like Sharkdle Short 7",
      "50"
    ],
    [
      "YouTube",
      "Like Sharkdle Short 8",
      "50"
    ],
    [
      "YouTube",
      "Like Sharkdle Short 9",
      "50"
    ],
    [
      "YouTube",
      "Like Sharkdle Short 10",
      "50"
    ],
    [
      "YouTube",
      "Like Sharkdle Short 11",
      "50"
    ],
    [
      "YouTube",
      "Like Sharkdle Short 12",
      "50"
    ],
    [
      "YouTube",
      "Like Sharkdle Short 13",
      "50"
    ],
    [
      "YouTube",
      "Like Sharkdle Short 14",
      "50"
    ],
    [
      "YouTube",
      "Like Sharkdle Short 15",
      "50"
    ],
    [
      "YouTube",
      "Like Sharkdle Short 16",
      "50"
    ],
    [
      "Instagram",
      "Like Instagram Reel 1",
      "50"
    ],
    [
      "Instagram",
      "Like Instagram Reel 2",
      "50"
    ],
    [
      "Instagram",
      "Like Instagram Reel 3",
      "50"
    ],
    [
      "TikTok",
      "Like TikTok Video 1",
      "50"
    ],
    [
      "TikTok",
      "Like TikTok Video 2",
      "50"
    ],
    [
      "TikTok",
      "Like TikTok Video 3",
      "50"
    ],
    [
      "TikTok",
      "Like TikTok Video 4",
      "50"
    ],
    [
      "TikTok",
      "Like TikTok Video 5",
      "50"
    ],
    [
      "TikTok",
      "Like TikTok Video 6",
      "50"
    ],
    [
      "TikTok",
      "Like TikTok Video 7",
      "50"
    ],
    [
      "TikTok",
      "Like TikTok Video 8",
      "50"
    ],
    [
      "TikTok",
      "Like TikTok Video 9",
      "50"
    ],
    [
      "TikTok",
      "Like TikTok Video 10",
      "50"
    ],
    [
      "TikTok",
      "Like TikTok Video 11",
      "50"
    ],
    [
      "TikTok",
      "Like TikTok Video 12",
      "50"
    ],
    [
      "YouTube",
      "Subscribe to Connor on YouTube",
      "200"
    ],
    [
      "Instagram",
      "Follow @sharkdle.dev",
      "150"
    ],
    [
      "TikTok",
      "Follow Connor on TikTok",
      "150"
    ],
    [
      "Support",
      "Star the GitHub repo",
      "125"
    ],
    [
      "Support",
      "Join the Discord",
      "150"
    ],
    [
      "Support",
      "Share Sharkdle",
      "75"
    ],
    [
      "Support",
      "Read the updates",
      "50"
    ]
  ],
  "login": [
    [
      "1",
      "50",
      "—"
    ],
    [
      "2",
      "60",
      "—"
    ],
    [
      "3",
      "70",
      "—"
    ],
    [
      "4",
      "80",
      "—"
    ],
    [
      "5",
      "90",
      "—"
    ],
    [
      "6",
      "100",
      "—"
    ],
    [
      "7",
      "500",
      "Barndoor Skate portrait"
    ]
  ],
  "shop": [
    [
      "Streak Shield",
      "250",
      "One shield",
      "Maximum 3 held."
    ],
    [
      "2x Pearls Boost",
      "500",
      "Double eligible win pearls for 1 hour",
      "Additional purchases extend the timer."
    ],
    [
      "Cosmetic Crate",
      "500",
      "One unopened standard crate",
      "Uses Cosmetic Crate 2 rewards."
    ],
    [
      "Event Crate",
      "750",
      "One active seasonal crate",
      "Only while an eligible event is enabled."
    ],
    [
      "Message in a Bottle Pack",
      "300",
      "5 Barnacle + 3 Red Sea + 1 Seafoam + 1 Celestial Bottle",
      "Open the bottles through Lost Treasures."
    ],
    [
      "Season 2x XP",
      "3,000",
      "The current season’s XP boost",
      "One ownership per season."
    ]
  ],
  "levels": [
    [
      "1",
      "0"
    ],
    [
      "2",
      "1,000"
    ],
    [
      "3",
      "2,500"
    ],
    [
      "4",
      "4,500"
    ],
    [
      "5",
      "7,000"
    ],
    [
      "6",
      "10,000"
    ],
    [
      "7",
      "14,000"
    ],
    [
      "8",
      "18,500"
    ],
    [
      "9",
      "23,500"
    ],
    [
      "10",
      "29,000"
    ],
    [
      "11",
      "35,000"
    ],
    [
      "12",
      "41,500"
    ],
    [
      "13",
      "48,500"
    ],
    [
      "14",
      "56,000"
    ],
    [
      "15",
      "64,000"
    ],
    [
      "16",
      "72,500"
    ],
    [
      "17",
      "81,500"
    ],
    [
      "18",
      "91,000"
    ],
    [
      "19",
      "101,000"
    ],
    [
      "20",
      "111,500"
    ],
    [
      "21",
      "122,000"
    ],
    [
      "22",
      "133,000"
    ],
    [
      "23",
      "144,500"
    ],
    [
      "24",
      "156,500"
    ],
    [
      "25",
      "169,000"
    ],
    [
      "26",
      "182,000"
    ],
    [
      "27",
      "195,500"
    ],
    [
      "28",
      "209,500"
    ],
    [
      "29",
      "224,000"
    ],
    [
      "30",
      "239,000"
    ]
  ]
};
  const achievementDetails = [
  {
    "id": "speed_win",
    "name": "Lightning Fast",
    "description": "Win in 2 guesses",
    "icon": "⚡",
    "points": 75,
    "type": "special",
    "group": "special"
  },
  {
    "id": "comeback_win",
    "name": "Comeback King",
    "description": "Win with only 1 guess left",
    "icon": "👑",
    "points": 75,
    "type": "special",
    "group": "special"
  },
  {
    "id": "secret_command_found",
    "name": "Depths Discovered",
    "description": "Discover the hidden Shark Rescue Command page",
    "icon": "🦈",
    "points": 180,
    "type": "special",
    "rarity": "epic",
    "themeRewardId": "pearl-reef",
    "themeRewardName": "Pearl Reef",
    "group": "special"
  },
  {
    "id": "crate_opened",
    "name": "First Unboxing",
    "description": "Open a Cosmetic Crate",
    "icon": "📦",
    "points": 40,
    "type": "special",
    "group": "special"
  },
  {
    "id": "summer_crate_opened",
    "name": "First Summer Unboxing",
    "description": "Open a Summer Crate",
    "icon": "☀️",
    "points": 40,
    "type": "special",
    "group": "special"
  },
  {
    "id": "halloween_crate_opened",
    "name": "First Halloween Unboxing",
    "description": "Open a Halloween Crate",
    "icon": "🎃",
    "points": 40,
    "type": "special",
    "group": "special"
  },
  {
    "id": "christmas_crate_opened",
    "name": "First Christmas Unboxing",
    "description": "Open a Christmas Crate",
    "icon": "🎁",
    "points": 40,
    "type": "special",
    "group": "special"
  },
  {
    "id": "secret_prestige_1",
    "name": "First Renown",
    "description": "Prestige once in Shark Rescue Command",
    "icon": "👑",
    "points": 100,
    "type": "special",
    "hiddenUntilSecret": true,
    "group": "special"
  },
  {
    "id": "secret_missions_25",
    "name": "Command Veteran",
    "description": "Complete 25 missions in Shark Rescue Command",
    "icon": "📡",
    "points": 140,
    "type": "special",
    "hiddenUntilSecret": true,
    "group": "special"
  },
  {
    "id": "secret_apex_cells_10",
    "name": "Cell Splitter",
    "description": "Earn 10 Apex Cells in Shark Rescue Command",
    "icon": "🧬",
    "points": 180,
    "type": "special",
    "hiddenUntilSecret": true,
    "group": "special"
  },
  {
    "id": "streak_shield_used",
    "name": "Saviour",
    "description": "Lose a game but have a streak shield protect your win streak",
    "icon": "🛡️",
    "points": 100,
    "type": "special",
    "group": "special"
  },
  {
    "id": "crate_collector_10",
    "name": "Crate Collector",
    "description": "Open 10 cosmetic crates",
    "icon": "🧰",
    "points": 125,
    "type": "special",
    "milestone": 10,
    "metric": "cratesOpened",
    "rarity": "rare",
    "badgeRewardId": "crate-connoisseur",
    "badgeRewardName": "Crate Connoisseur",
    "group": "special"
  },
  {
    "id": "crate_collector_50",
    "name": "Vault Breaker",
    "description": "Open 50 cosmetic crates",
    "icon": "💎",
    "points": 320,
    "type": "special",
    "milestone": 50,
    "metric": "cratesOpened",
    "rarity": "legendary",
    "themeRewardId": "neon-reef",
    "themeRewardName": "Neon Reef",
    "group": "special"
  },
  {
    "id": "wins_1",
    "name": "Novice Observer",
    "description": "Win 1 game",
    "icon": "⭐",
    "points": 10,
    "milestone": 1,
    "group": "wins"
  },
  {
    "id": "wins_3",
    "name": "Rising Observer",
    "description": "Win 3 games",
    "icon": "⭐⭐",
    "points": 20,
    "milestone": 3,
    "group": "wins"
  },
  {
    "id": "wins_5",
    "name": "Skilled Observer",
    "description": "Win 5 games",
    "icon": "⭐⭐",
    "points": 25,
    "milestone": 5,
    "group": "wins"
  },
  {
    "id": "wins_10",
    "name": "Experienced Observer",
    "description": "Win 10 games",
    "icon": "⭐⭐⭐",
    "points": 50,
    "milestone": 10,
    "group": "wins"
  },
  {
    "id": "wins_25",
    "name": "Legendary Observer",
    "description": "Win 25 games",
    "icon": "👑",
    "points": 100,
    "milestone": 25,
    "group": "wins"
  },
  {
    "id": "wins_50",
    "name": "Master Observer",
    "description": "Win 50 games",
    "icon": "👑👑",
    "points": 150,
    "milestone": 50,
    "group": "wins"
  },
  {
    "id": "wins_100",
    "name": "Mythical Observer",
    "description": "Win 100 games",
    "icon": "🏆",
    "points": 250,
    "milestone": 100,
    "group": "wins"
  },
  {
    "id": "wins_250",
    "name": "Transcendant Observer",
    "description": "Win 250 games",
    "icon": "🏆🏆",
    "points": 400,
    "milestone": 250,
    "rarity": "legendary",
    "group": "wins"
  },
  {
    "id": "wins_500",
    "name": "Abyssal Legend",
    "description": "Win 500 games",
    "icon": "🌌",
    "points": 550,
    "milestone": 500,
    "rarity": "mythic",
    "badgeRewardId": "abyssal-legend",
    "badgeRewardName": "Abyssal Legend",
    "group": "wins"
  },
  {
    "id": "wins_1000",
    "name": "Eternal Fin",
    "description": "Win 1,000 games",
    "icon": "♾️",
    "points": 900,
    "milestone": 1000,
    "rarity": "mythic",
    "themeRewardId": "lunar-current",
    "themeRewardName": "Lunar Current",
    "group": "wins"
  },
  {
    "id": "games_10",
    "name": "Getting Started",
    "description": "Play 10 games",
    "icon": "🎮",
    "points": 15,
    "milestone": 10,
    "group": "games"
  },
  {
    "id": "games_20",
    "name": "Committed Player",
    "description": "Play 20 games",
    "icon": "🎮🎮",
    "points": 30,
    "milestone": 20,
    "group": "games"
  },
  {
    "id": "games_50",
    "name": "Dedicated Gamer",
    "description": "Play 50 games",
    "icon": "🎮🎮🎮",
    "points": 75,
    "milestone": 50,
    "group": "games"
  },
  {
    "id": "games_100",
    "name": "Obsessed",
    "description": "Play 100 games",
    "icon": "🎮🎮🎮🎮",
    "points": 150,
    "milestone": 100,
    "group": "games"
  },
  {
    "id": "games_250",
    "name": "Cant Stop",
    "description": "Play 250 games",
    "icon": "💪",
    "points": 250,
    "milestone": 250,
    "group": "games"
  },
  {
    "id": "games_500",
    "name": "True Addict",
    "description": "Play 500 games",
    "icon": "🌊",
    "points": 400,
    "milestone": 500,
    "rarity": "legendary",
    "group": "games"
  },
  {
    "id": "games_750",
    "name": "Deep Habit",
    "description": "Play 750 games",
    "icon": "📘",
    "points": 520,
    "milestone": 750,
    "rarity": "mythic",
    "group": "games"
  },
  {
    "id": "games_1000",
    "name": "Marathon Fin",
    "description": "Play 1,000 games",
    "icon": "🏁",
    "points": 750,
    "milestone": 1000,
    "rarity": "mythic",
    "badgeRewardId": "marathon-fin",
    "badgeRewardName": "Marathon Fin",
    "group": "games"
  },
  {
    "id": "streak_1",
    "name": "On a Roll",
    "description": "Win 1 game in a row",
    "icon": "🔥",
    "points": 10,
    "milestone": 1,
    "group": "streaks"
  },
  {
    "id": "streak_3",
    "name": "On Fire",
    "description": "Win 3 games in a row",
    "icon": "🔥",
    "points": 25,
    "milestone": 3,
    "group": "streaks"
  },
  {
    "id": "streak_5",
    "name": "Hot Streak",
    "description": "Win 5 games in a row",
    "icon": "🔥🔥",
    "points": 40,
    "milestone": 5,
    "group": "streaks"
  },
  {
    "id": "streak_10",
    "name": "Unbeatable",
    "description": "Win 10 games in a row",
    "icon": "🔥🔥🔥",
    "points": 100,
    "milestone": 10,
    "group": "streaks"
  },
  {
    "id": "streak_25",
    "name": "Unstoppable",
    "description": "Win 25 games in a row",
    "icon": "⚡",
    "points": 200,
    "milestone": 25,
    "group": "streaks"
  },
  {
    "id": "streak_50",
    "name": "Invincible",
    "description": "Win 50 games in a row",
    "icon": "⚡⚡",
    "points": 350,
    "milestone": 50,
    "rarity": "legendary",
    "group": "streaks"
  },
  {
    "id": "streak_75",
    "name": "Current Keeper",
    "description": "Win 75 games in a row",
    "icon": "🌊",
    "points": 500,
    "milestone": 75,
    "rarity": "mythic",
    "group": "streaks"
  },
  {
    "id": "streak_100",
    "name": "Untouchable Tide",
    "description": "Win 100 games in a row",
    "icon": "🔱",
    "points": 800,
    "milestone": 100,
    "rarity": "mythic",
    "themeRewardId": "volcanic-ember",
    "themeRewardName": "Volcanic Ember",
    "group": "streaks"
  },
  {
    "id": "perfect_win",
    "name": "One-Shot Oracle",
    "description": "Win in 1 guess",
    "icon": "🎯",
    "points": 125,
    "type": "efficiency",
    "rarity": "rare",
    "badgeRewardId": "one-shot-oracle",
    "badgeRewardName": "One-Shot Oracle",
    "group": "efficiency"
  },
  {
    "id": "avg_guesses_low",
    "name": "Sharp Mind",
    "description": "Average 4 or fewer guesses per win",
    "icon": "🧠",
    "points": 100,
    "type": "efficiency",
    "group": "efficiency"
  },
  {
    "id": "guess_master",
    "name": "Guess Master",
    "description": "Average 3 or fewer guesses per win",
    "icon": "🎯",
    "points": 150,
    "type": "efficiency",
    "rarity": "epic",
    "themeRewardId": "deep-abyss",
    "themeRewardName": "Deep Abyss",
    "group": "efficiency"
  },
  {
    "id": "duel_played",
    "name": "First Blood",
    "description": "Play your first friend duel",
    "icon": "⚔️",
    "points": 40,
    "type": "duel",
    "group": "duels"
  },
  {
    "id": "duel_won",
    "name": "Apex Rival",
    "description": "Win a friend duel",
    "icon": "🏆",
    "points": 75,
    "type": "duel",
    "rarity": "rare",
    "themeRewardId": "storm-current",
    "themeRewardName": "Storm Current",
    "group": "duels"
  },
  {
    "id": "duel_games_10",
    "name": "Duel Regular",
    "description": "Play 10 friend duels",
    "icon": "🤝",
    "points": 140,
    "type": "duel",
    "milestone": 10,
    "metric": "duelGames",
    "rarity": "rare",
    "group": "duels"
  },
  {
    "id": "duel_wins_10",
    "name": "Rival Breaker",
    "description": "Win 10 friend duels",
    "icon": "🥇",
    "points": 260,
    "type": "duel",
    "milestone": 10,
    "metric": "duelWins",
    "rarity": "epic",
    "badgeRewardId": "rival-breaker",
    "badgeRewardName": "Rival Breaker",
    "group": "duels"
  },
  {
    "id": "duel_wins_25",
    "name": "Arena Apex",
    "description": "Win 25 friend duels",
    "icon": "👑",
    "points": 420,
    "type": "duel",
    "milestone": 25,
    "metric": "duelWins",
    "rarity": "legendary",
    "group": "duels"
  },
  {
    "id": "atlantic_master",
    "name": "Atlantic Mastered",
    "description": "Complete the World Map Atlantic Challenge",
    "icon": "🧩",
    "points": 150,
    "type": "worldmap",
    "group": "worldmap",
    "region": {
      "name": "Atlantic Ocean",
      "label": "Chapter 1 - Atlantic Anomalies",
      "sharks": [
        "Blue Shark",
        "Short-fin Mako",
        "Common Thresher Shark"
      ],
      "boss": "The Atlantic Signal"
    }
  },
  {
    "id": "pacific_master",
    "name": "Pacific Mastered",
    "description": "Complete the World Map Pacific Challenge",
    "icon": "🧩",
    "points": 200,
    "type": "worldmap",
    "themeRewardId": "coral-bloom",
    "themeRewardName": "Coral Bloom",
    "group": "worldmap",
    "region": {
      "name": "Pacific Ocean",
      "label": "Chapter 2 - Pacific Problems",
      "sharks": [
        "Tiger Shark",
        "Oceanic Whitetip Shark",
        "Salmon Shark"
      ],
      "boss": "The Pacific Undertow"
    }
  },
  {
    "id": "indian_master",
    "name": "Indian Mastered",
    "description": "Complete Indian Region on the world map",
    "icon": "🧩",
    "points": 250,
    "type": "worldmap",
    "group": "worldmap",
    "region": {
      "name": "Indian Ocean",
      "label": "Chapter 3 - Indian Intricacies",
      "sharks": [
        "Bull Shark",
        "Zebra Shark",
        "Whitetip Reef Shark"
      ],
      "boss": "The Monsoon Vault"
    }
  },
  {
    "id": "sothafrica_master",
    "name": "South Africa Mastered",
    "description": "Complete South Africa region on the world map",
    "icon": "🧩",
    "points": 300,
    "type": "worldmap",
    "group": "worldmap",
    "region": {
      "name": "South Africa",
      "label": "Chapter 6 - Cape Corruption",
      "sharks": [
        "White Shark",
        "Copper Shark",
        "Leopard Catshark"
      ],
      "boss": "Cape of Currents"
    }
  },
  {
    "id": "usa_master",
    "name": "USA Mastered",
    "description": "Complete USA region on the world map",
    "icon": "🧩",
    "points": 350,
    "type": "worldmap",
    "group": "worldmap",
    "region": {
      "name": "USA (East Coast)",
      "label": "Chapter 7 - Atlantic Return",
      "sharks": [
        "Sand Tiger Shark",
        "Dusky Shark",
        "Bonnethead Shark"
      ],
      "boss": "The Return Current"
    }
  },
  {
    "id": "mediterranean_master",
    "name": "Mediterranean Mastered",
    "description": "Complete Mediterranean region on the world map",
    "icon": "🧩",
    "points": 300,
    "type": "worldmap",
    "group": "worldmap",
    "region": {
      "name": "Mediterranean Sea",
      "label": "Chapter 4 - Mediterranean Mysteries",
      "sharks": [
        "Angel Shark",
        "Small-tooth Sandtiger Shark",
        "Basking Shark"
      ],
      "boss": "The Crossroads Archive"
    }
  },
  {
    "id": "japan_master",
    "name": "Japan Mastered",
    "description": "Complete Japan region on the world map",
    "icon": "🧩",
    "points": 450,
    "type": "worldmap",
    "rarity": "legendary",
    "badgeRewardId": "deep-cartographer",
    "badgeRewardName": "Deep Cartographer",
    "group": "worldmap",
    "region": {
      "name": "Japan",
      "label": "Chapter 8 - Realm of the Ancients",
      "sharks": [
        "Japanese Bullhead Shark",
        "Frilled Shark",
        "Megamouth Shark"
      ],
      "boss": "The Ancient Deep"
    }
  },
  {
    "id": "australia_master",
    "name": "Australia Mastered",
    "description": "Complete Australia region on the world map",
    "icon": "🧩",
    "points": 325,
    "type": "worldmap",
    "group": "worldmap",
    "region": {
      "name": "Australia",
      "label": "Chapter 5 - Australian Anomalies",
      "sharks": [
        "Spotted Wobbegong",
        "Port Jackson Shark",
        "Epaulette Shark"
      ],
      "boss": "The Reef Lantern"
    }
  },
  {
    "id": "friends_1",
    "name": "First Friend",
    "description": "Add your first friend",
    "icon": "👋",
    "points": 25,
    "milestone": 1,
    "group": "milestones"
  },
  {
    "id": "friends_3",
    "name": "Social Butterfly",
    "description": "Add 3 friends",
    "icon": "🦋",
    "points": 50,
    "milestone": 3,
    "group": "milestones"
  },
  {
    "id": "friends_5",
    "name": "Popular",
    "description": "Add 5 friends",
    "icon": "⭐",
    "points": 100,
    "milestone": 5,
    "group": "milestones"
  },
  {
    "id": "friends_10",
    "name": "Socialite",
    "description": "Add 10 friends",
    "icon": "👥",
    "points": 200,
    "milestone": 10,
    "rarity": "epic",
    "group": "milestones"
  },
  {
    "id": "friends_25",
    "name": "Social Current",
    "description": "Add 25 friends",
    "icon": "🌐",
    "points": 420,
    "milestone": 25,
    "metric": "friendsCount",
    "rarity": "legendary",
    "badgeRewardId": "social-current",
    "badgeRewardName": "Social Current",
    "group": "milestones"
  }
];
  const entries = [];
  const section = (title, ...text) => ({ title, text });
  const table = (title, intro, columns, rows) => ({ title, text: [intro], table: { caption: title, columns, rows } });
  const add = (id, category, title, summary, sections, related = [], playUrl = 'index.html', guide = true) => entries.push({ id, category, title, summary, sections, related, playUrl, guide });

  add('beginner-guide', 'Getting started', 'Your first games of Sharkdle',
    'Start with a familiar species, read what the result tells you, and build a shortlist. You do not need to memorise the Sharchive before you can enjoy the game.', [
      section('Start with the guessing game', 'Sharkdle asks you to identify one mystery species. Type a name, choose a valid suggestion, and submit it. The result compares that species with the answer across order, family, genus, size, depth and discovery year. Your task is to use those comparisons to make a better guess next time.', 'I recommend starting with the Sharks pool and Practice Mode if the classifications are new to you. Practice gives you the same basic comparison exercise without adding XP or changing your statistics. You can take your time, open the Sharchive, and finish an unfamiliar answer without worrying about a twelve-guess loss.'),
      section('A useful first session', 'Choose a species whose name you recognise, then open the feedback. A matching classification is much more useful than the red answer name might suggest: the species can be wrong while its family or genus is exactly right. Keep those confirmed matches in mind rather than abandoning the whole guess.', 'After your first win, try another Practice round and deliberately use a different family for your opener. This teaches you which names belong together. Once the feedback feels familiar, try the Daily Challenge for one shared puzzle, or Infinite for a succession of fresh targets.'),
      section('Use the archive as you learn', 'The Sharchive is the species reference inside the game. Search by name or classification, compare the available entries, and use size, depth and discovery-year filters to reduce the list. Reading a few related entries after a match is more useful than trying to learn the entire catalogue at once.', 'Daily and Infinite also assemble a mystery profile from your confirmed clues. Its archive-filter button transfers the known information to the Sharchive. If a shortlist looks empty, check the selected pool and clear old filters before assuming that the answer is missing.'),
      section('When you want progression', 'Sign in before you start a session in which you care about rewards and cross-device progress. Winning Daily or Infinite can award XP, pearls, crate drops and progress towards relevant achievements. Practice is for learning and does not become a reward mode just because you are signed in.', 'There is no requirement to tackle every feature immediately. Story has a chapter structure, SharkRNG has its own collection and progression, and cosmetics give you profile goals to work towards. Learn one system at a time; the dedicated pages explain what each currency and reward actually does.')
    ], ['how-guessing-works', 'guessing-strategy', 'practice-mode', 'daily-mode', 'sharchive']);

  add('how-guessing-works', 'Getting started', 'How does guessing work?',
    'Every valid guess compares a species with the mystery answer. A wrong species can still confirm several correct clues, and those matches are the basis of the next guess.', [
      section('Submitting a species', 'Enter the species name and use the suggestion list to select a valid entry. Submitting a valid, new species uses an attempt in Daily and Infinite. An unrecognised name is not a useful test of the answer: choose an entry from the pool rather than guessing a spelling.', 'The selected pool determines which species are in the round. Sharks, Relatives and Combined are different candidate lists. A species from another pool cannot help you if the mode does not accept it. You can reopen an earlier guess card to inspect its clues again.'),
      table('The six comparisons', 'The displayed values describe your guessed species. A matching field tells you that the answer has that same value.', ['Clue', 'What it describes', 'How to use a match'], [
        ['Order', 'Broad classification group', 'Keep candidates in that order.'],
        ['Family', 'A smaller classification group within an order', 'Investigate other members of the matched family.'],
        ['Genus', 'A more specific group within a family', 'Compare species within that genus.'],
        ['Size', 'The size category assigned in Sharkdle', 'Use the same category in the Sharchive.'],
        ['Depth', 'The depth category assigned in Sharkdle', 'Filter for that exact depth category.'],
        ['Year of Discovery', 'The year recorded for the species', 'Use the arrow to move earlier or later; an exact year is a match.']
      ]),
      section('Matching is different from direction', 'Size and depth are category comparisons. A failed Small guess does not by itself say that the answer is larger, and a failed Mesopelagic guess does not say that the answer lives deeper. Use the actual feedback instead of adding a direction that the game has not supplied.', 'Discovery year does have directional feedback. An up arrow means the answer’s recorded year is later than the guessed year; a down arrow means it is earlier. These arrows concern the year in the game’s record, not the age of the individual animal or how long its lineage has existed.'),
      section('Keeping the information from a wrong guess', 'Suppose your guessed species has a matching family but a non-matching genus. The next step is to inspect that family and compare its other genera. Repeating the same genus without checking the remaining possibilities is unlikely to teach you much.', 'Daily and Infinite allow twelve attempts. The goal is the species name, not merely six matching labels: several different species can share classifications, size, depth and even a discovery year. If every clue fits and the name is still wrong, keep comparing the remaining names in that group.')
    ], ['guessing-strategy', 'clue-reveals', 'species-pools', 'sharchive']);

  add('guessing-strategy', 'Getting started', 'Guessing strategy: turning clues into an answer',
    'A useful guess either tests a plausible answer or rules out a meaningful part of the shortlist. Good rounds come from combining the clues, rather than chasing one field on its own.', [
      section('Read all six fields before guessing again', 'Start with what is confirmed. If the family matches, keep that constraint; if the genus also matches, your next search should normally stay within that genus. Size, depth and discovery-year feedback can then separate names that otherwise look similar.', 'Avoid treating the latest result as the only result. An early matching depth remains useful even if a later guess has the wrong depth. The mystery profile helps collect confirmed facts, but reopening earlier cards is still useful when you want to reconstruct your reasoning.'),
      section('Use discovery years as a range', 'An up arrow after a 1900 guess tells you to look later than 1900. A later down arrow after a 1950 guess narrows the answer to a year between them. Continue keeping the narrowest boundaries you have established; do not replace a useful bound with a weaker one.', 'A year clue works best alongside taxonomy. Searching every species discovered after one year can leave a very large list. Searching the matched family within a known date range is a much more practical next step. Do not assume the exact midpoint year belongs to a valid species.'),
      section('Choose a purpose for the next guess', 'When several candidates remain, compare which of their fields differ. If half the candidates are one genus and half another, testing a representative can settle a useful split. If only two names remain and all six fields are identical, you have reached a straightforward name choice.', 'There is no single guaranteed best opener across every pool and answer. A familiar species is a reasonable way to learn. As you improve, choose openers that help you recognise broad groups, and evaluate whether each follow-up is testing a real possibility or simply repeating information you already had.'),
      section('Use help without confusing it with a solved answer', 'The Sharchive filters and the 25-pearl category reveal can reduce uncertainty. A reveal supplies one undiscovered field at random, so it may be more or less useful depending on the current shortlist. It does not choose the answer for you or replenish attempts.', 'When a round ends, look back at the first clue that could have narrowed it. A loss can expose a classification you did not know, or a mistaken assumption about size and depth. Practising that specific group is a better follow-up than memorising only the answer you missed.')
    ], ['how-guessing-works', 'sharchive', 'clue-reveals', 'practice-mode']);

  add('daily-mode', 'Game modes', 'Daily Challenge',
    'One shared puzzle for the day in each supported species pool. You have twelve guesses to identify the target and carry the day’s clues through to a final answer.', [
      section('What makes Daily different?', 'The daily puzzle is tied to the UTC date. Players using the same pool on that date are working on the same mystery species, which makes Daily a useful round to compare with friends after you have finished. Sharks, Relatives and Combined each use their own mode configuration.', 'Daily is not a queue of new targets. Finishing the round does not create another daily puzzle in the same pool. If you want to keep practising after the result, use Infinite or Practice rather than expecting a refresh to provide a fresh Daily answer.'),
      section('The daily reset', 'The puzzle changes at midnight UTC. Your local midnight may be earlier or later, and daylight saving can change the difference between your clock and UTC. The daily puzzle clock is separate from the daily login cycle and win-wheel day, which use your local calendar day.', 'Your Daily board keeps the guesses, attempts, completion state and any category reveal for that puzzle. Returning to an unfinished round is meant to continue the same challenge. Check the date and pool when comparing your board with someone else’s.'),
      section('Attempts, clues and rewards', 'You have twelve valid guesses. Winning gives base XP according to the number of guesses: 170 minus 10 per guess, with a minimum of 50. A first-guess win is therefore 160 base XP, while a twelfth-guess win is 50. Active XP multipliers can change the awarded amount.', 'Eligible wins also use the normal pearl and random-drop systems. Sign in when collecting account rewards matters. A loss still records the result in the relevant statistics; a Streak Shield can protect an existing win streak, but it does not turn the loss into a win.'),
      section('Making the most of one puzzle', 'Because there is only one target to work on, take a moment to inspect each result. Reopen old guesses, use the mystery profile, and transfer confirmed clues to the Sharchive when the remaining group is unfamiliar. Spending a guess without a question in mind can make the final attempts much harder.', 'Share a result after finishing rather than sending the answer to someone who is still playing. Guess counts are meaningful when both players used the same pool and the same daily puzzle. Infinite is the place to continue the session once the day’s result is settled.')
    ], ['how-guessing-works', 'infinite-mode', 'pearls', 'game-clocks'], 'Daily/index.html');

  add('infinite-mode', 'Game modes', 'Infinite Mode',
    'A fresh mystery species each round, with twelve attempts and the same six-field guessing system. Infinite is the main option when you want to keep playing after the Daily.', [
      section('A sequence of separate rounds', 'Each new Infinite round chooses another target from the selected species pool. Your current board belongs to that round; a new game begins a new set of attempts and clues. The recent-family selection also helps avoid simply repeating the previous family on consecutive rounds.', 'Infinite does not mean unlimited attempts within one game. You still have twelve valid guesses to solve the current mystery. When those attempts run out, the round is a loss and the answer is revealed. Start another round when you want to try again.'),
      section('Rewards and progress', 'A win uses the same base XP formula as Daily: 170 minus 10 times the number of guesses, down to a minimum of 50. Eligible account wins can also earn pearls, random Cosmetic Crates and Lost Treasures drops. Those independent random rewards are not guaranteed by finishing a set number of rounds.', 'Infinite wins and losses contribute to the relevant profile statistics and achievements. Sign in before playing for account rewards: the game’s signed-in reward and synchronisation paths are different from simply opening a board as a guest.'),
      section('Using Infinite to learn efficiently', 'Try setting a small learning goal for a session, such as recognising a family or using discovery-year bounds properly. A string of rounds is useful only if you notice why a guess helped. After an unfamiliar answer, compare it with one species you already knew in the Sharchive.', 'When you want to experiment without recording a loss, switch to Practice. Infinite is good for a continued progression session; Practice is better for unrestricted investigation. Neither mode needs a real-world time trial: read the clues at a pace that lets you understand them.'),
      section('Pools and help features', 'Sharks, Relatives and Combined change the eligible species list. If Infinite feels dramatically harder after switching pools, check which pool is active rather than assuming familiar shark names cover every possible answer. Combined includes the wider list of shark relatives too.', 'The mystery profile, archive-filter action and one-per-round category reveal work with the current Infinite target. A reveal belongs to that round and does not buy a permanent field unlock for all later games. Recheck the actual clues when the next target begins.')
    ], ['daily-mode', 'practice-mode', 'guessing-strategy', 'clue-reveals'], 'Infinite/index.html');

  add('practice-mode', 'Game modes', 'Practice Mode',
    'The place to learn the species and feedback system without earning XP or altering your game statistics. Practice keeps counting your guesses until you find the answer.', [
      section('What Practice changes', 'Practice uses the same basic idea as the main guessing game: choose a valid species and compare it with a mystery answer. It records how many guesses you took in the current exercise, but does not impose the Daily and Infinite twelve-attempt loss condition.', 'A Practice win does not award XP or record a normal game win. Its result screen makes that distinction explicit. Practice therefore does not provide a shortcut to a win-streak achievement, pass quest, crate farming session or leaderboard position.'),
      section('Learning the classification clues', 'Use Practice to become comfortable with the difference between order, family and genus. Pick a familiar species, read its classification, then find another entry in the same family. Watch which fields match when the new guess is closer to the target.', 'It is fine to use the Sharchive throughout. The aim is to recognise relationships rather than to test how many scientific names you can recall without help. Reopening a guess and comparing two entries can be more useful than immediately submitting a third species.'),
      section('A focused practice exercise', 'Try solving a round while writing down only the confirmed constraints. For discovery years, keep the latest lower bound and earliest upper bound. For size and depth, record exact matches, rather than inventing larger/smaller or deeper/shallower arrows that are not shown.', 'Once you reach a small shortlist, explain why each species remains possible. If you cannot explain why you chose the next guess, pause and compare its fields again. This is a useful habit to carry into a Daily round where attempts are limited.'),
      section('Moving between pools', 'You can practise Sharks, Relatives or Combined. Start in one pool long enough to learn its recurring groups, then expand when you want more variety. Rays, skates, guitarfishes and chimaeras introduce classifications that will be unfamiliar if you have only studied sharks.', 'After the answer, use Play Again for a new exercise. A long Practice solve is not wasted: it shows which names or categories need attention. Move to Daily or Infinite when you want the normal attempt limit, profile statistics and eligible rewards.')
    ], ['beginner-guide', 'how-guessing-works', 'species-pools', 'sharchive'], 'Practice/index.html');

  add('species-pools', 'Game modes', 'Sharks, Relatives and Combined',
    'The pool determines which species can be the answer and which names are valid guesses. The mode determines the round structure; the pool determines its candidate list.', [
      section('Sharks', 'Sharks uses the shark catalogue. This is a useful starting pool because the familiar names often make the first few classification groups easier to recognise. It still contains many less familiar species, so a recognisable opener does not mean every eventual answer will be a famous shark.', 'The name alone can be misleading: two common names that sound similar do not necessarily share a genus, while two very different-sounding names can share a family. Read the actual fields in the Sharchive when you need a reliable comparison.'),
      section('Relatives', 'Relatives uses the companion catalogue, which includes animals such as rays, skates, sawfishes, guitarfishes, wedgefishes and chimaeras. The interface may refer to the underlying pool as Rays, but its scope is wider than only animals with “ray” in their name.', 'The same six clues apply. Learning one ray family can help with several candidates, but it does not automatically cover skates or chimaeras. Start by recognising orders and families before trying to remember a large number of similar common names.'),
      section('Combined', 'Combined, also labelled Mixed in some mode screens, combines the two eligible catalogues. It increases the range of possible targets and lets the same broad classification reasoning work across sharks and their relatives.', 'A Combined round is not a separate scoring system or a cosmetic collection. It is the regular game using the broader pool. The Daily, Infinite and Practice rules still come from the mode you chose, including their attempt limit and reward behaviour.'),
      section('Avoiding pool mistakes', 'Check the pool whenever a name you expected is not accepted or an archive shortlist looks unusually small. A shark-only board does not accept every relative name just because that animal is present elsewhere in Sharkdle. The same principle applies when transferring clues into the archive.', 'When comparing results with another player, name both the mode and the pool. “I solved today’s Daily in four” is only a direct comparison if you were solving the same pool’s puzzle. Use the full species references when you want to study the boundaries between the catalogues.')
    ], ['daily-mode', 'infinite-mode', 'practice-mode', 'sharchive']);

  add('sharchive', 'Species', 'Using the Sharchive',
    'The Sharchive is the in-game species library. Search, filters and personal collection tools turn it into a practical companion for a guessing round.', [
      section('Finding a species', 'Search accepts several kinds of information. A name fragment can find a species; a genus, family or order can find a group; a recorded discovery year can find matching records. Species numbers can also identify an archive entry. Several search words are combined, so each word needs to match something relevant.', 'You do not need to type an entire scientific name from memory. Start with a field you have confirmed, then inspect the result list. Pay attention to the pool and the active filter controls: an old filter can exclude a species even when its name matches your search.'),
      section('Turning feedback into a shortlist', 'Use the size and depth filters for exact category matches. Discovery-year bounds can narrow the list to a known interval. A matching family or genus is a powerful extra constraint, especially when several species have similar common names.', 'Daily and Infinite provide an action to open the current mystery profile’s clues in the Sharchive. It transfers the confirmed classifications and categories, together with the available year bounds. As the board changes, using the action again updates the shortlist in its archive window.'),
      section('Personal ways to browse', 'The library includes favourites, a Needs Practice view and recently viewed entries, along with sorting choices. These let you build a study list around the species you actually encounter. Favouriting a species is a personal browsing action, not an additional crate reward or a way to change the target.', 'A useful study list is small enough to revisit. Add species you repeatedly confuse, compare their families and genera, and then try a Practice round in the relevant pool. Browsing is most valuable when it answers a specific question about a clue.'),
      section('When the result list is empty', 'First clear the current filters, then check that the correct pool is selected. Reapply only confirmed information. An unmatched size or depth is not evidence for a particular different category, so guessing a replacement filter can accidentally remove the true answer.', 'The wiki’s species references describe the values used by Sharkdle. Classification and category values in a game reference should not be silently replaced by an assumption from a similar name. Use the recorded fields consistently when solving the puzzle.')
    ], ['how-guessing-works', 'guessing-strategy', 'species-pools', 'species-mastery'], 'Library/index.html');

  add('species-mastery', 'Species', 'Species mastery and the Mistake Tracker',
    'The Sharchive can show your history against individual target species. Five tracked wins complete that species’ mastery progress, while the Mistake Tracker helps you choose what to review next.', [
      section('What a species history records', 'Signed-in Daily and Infinite results can build a history for the target species. The record includes attempts, wins, losses, win rate, total guesses and your best winning guess count. These figures describe rounds in which that species was the answer, rather than every time you typed its name as a wrong guess.', 'A completed species result is recorded once for its round. Returning to the same finished Daily board does not create another mastery win. Practice is deliberately separate from normal result statistics and does not use this tracked-win route.'),
      section('The five-win mastery target', 'Species mastery completes when you have five tracked wins against that species. The progress display is capped at five for the mastery bar, while the underlying history can continue to grow beyond that milestone.', 'A mastery win does not have to be a first-guess solve. It is a successful tracked round, so a careful solve late in the attempt limit can still contribute. Opening a species card, favouriting it or owning its portrait is not a mastery win; those are separate collection and browsing actions.'),
      section('Understanding the Mistake Tracker', 'The tracker keeps wrong species guesses made while a particular target was being solved. Its Common mix-up gives you a practical comparison to study: open the two records and find the classifications or categories that distinguish them.', 'Weak category summarises the field with the most recorded mismatches in that species history. It is a review prompt, not a judgement of your real-world biology knowledge. A deliberate exploratory guess can produce several mismatches even when it was a sensible tactical choice.'),
      section('Using Needs Practice', 'Needs Practice shows tracked species that have not reached five wins. It is not the entire unseen catalogue: an animal with no recorded attempts does not meet the same history filter. Clear it when you want to browse everything again.', 'A useful review session starts with one repeated mix-up rather than a large random list. Compare the two records, identify an actual difference and practise applying that clue. The best-guesses and win-rate fields then provide context for how your results change over time.'),
      section('Finding a review record again', 'The archive can focus and open a requested review species, helping you return to the answer from a completed round. Recently Viewed and favourites provide other ways to revisit an entry without changing its mastery count.', 'Species history belongs to the signed-in account. If another device has not loaded the same history yet, let the account and archive finish synchronising. Missing history for an untracked or guest round is a different issue from a cosmetic unlock being absent from the Locker.')
    ], ['sharchive', 'guessing-strategy', 'accounts-and-saving', 'species-directory'], 'Library/index.html');

  add('clue-reveals', 'Getting started', 'Mystery profiles and category reveals',
    'The mystery profile gathers what you have learned. A category reveal is an optional 25-pearl purchase that fills one still-undiscovered field for the current round.', [
      section('What the mystery profile knows', 'Matching feedback adds confirmed information to the mystery profile. Once you have matched the family, for example, that family is known even if the guessed species was wrong. The profile is a summary of the answer’s confirmed fields, not a copy of the latest guessed animal.', 'Discovery-year arrows can also narrow a range before the exact year is known. The profile can display that range and carry it into an archive search. A range is weaker than an exact match, but still useful when combined with taxonomy.'),
      section('Buying a reveal', 'A category reveal costs 25 pearls and requires sign-in. It chooses randomly from the fields you have not already discovered. You cannot buy a chosen genus or a guaranteed answer, and there is no point buying a field that is already confirmed.', 'Only one category reveal is allowed per Daily or Infinite round. It is unavailable after the round ends, and it is unavailable when every field is already known. The revealed field belongs to the current target rather than unlocking that field for future rounds.'),
      section('When a reveal is useful', 'A reveal can help when you have several broad mismatches but little positive information. It can also separate candidates that differ in an unknown family, size or year. Its value depends on the shortlist: learning another field shared by every remaining candidate will not choose the correct name for you.', 'Before spending, compare the remaining candidates in the Sharchive. You may already have enough information to make a sensible guess. The reveal is a help option, not a requirement for solving or a replacement for reading the earlier cards.'),
      section('After a reveal', 'Combine the new field with the confirmed clues you already had. The archive-filter button is useful here because it transfers the updated mystery profile. A correct field still allows several names, and the species itself must be guessed to win.', 'The purchase uses your pearl balance. It does not restore an attempt, protect a streak or improve crate odds. Those are different systems with different effects; check the Pearl Shop and Streak Shield pages when that is the help you actually need.')
    ], ['pearls', 'pearl-shop', 'sharchive', 'guessing-strategy']);

  add('account-progression', 'Progression', 'XP, levels and the different progression tracks',
    'Sharkdle has more than one kind of progress. Account XP, seasonal Shark Pass progress and SharkRNG progression answer different questions and should not be treated as a single level.', [
      section('Account XP', 'Account XP is the long-term total attached to your normal profile. Eligible wins and a number of claimed rewards add to it. Account level is calculated from that cumulative total; buying a crate or equipping a portrait does not spend the XP you have already earned.', 'A Daily or Infinite win gives base XP of 170 minus 10 per guess, with a floor of 50. This makes the base range 160 XP for a first-guess solve through 50 XP for a twelve-guess solve. This is a win reward, not an amount earned for every guess.'),
      section('Season XP', 'Shark Pass 2 has its own seasonal XP and reward track. The new season begins with fresh pass progress rather than converting your entire historical account XP into a completed season. The account total remains separate, so an experienced account can still have an early seasonal pass level.', 'Reward paths that grant season XP add the eligible gain to that track. Claimed pass quests are a substantial source, and regular eligible XP rewards can also contribute. Check the pass screen for your current season position rather than reading an account-level portrait requirement as a season requirement.'),
      section('Other sources of XP', 'Daily login rewards, claimed achievements, reward codes, claimed pass quests and cosmetic duplicates can award XP. Where the game applies its XP multipliers, an active event and the purchased season boost can increase the result. The amount on a reward table is a base amount unless it explicitly says otherwise.', 'Achievement points and the XP granted on claiming an achievement are related but not identical counters: achievement points describe your claimed achievement collection, while XP contributes to level progression. A claim can also award a badge or theme alongside its points.'),
      section('Progress that stays separate', 'SharkRNG has its own coins, rank, upgrades, collection and prestige progression. Its rank is not your normal account level, and an RNG rarity label is not the rarity of a profile cosmetic. Rescue Command also uses its own rescue economy and resets.', 'Practice awards no XP or normal game statistics. When choosing an activity, decide which track you are trying to advance. This avoids spending a session expecting Practice to fill a pass quest, or assuming a profile level buys an RNG upgrade.'),
      table('Cumulative XP thresholds through level 30', 'These are the XP totals needed to reach the start of each level. The seasonal track uses the level curve while keeping its own XP total.', ['Level', 'Total XP to reach it'], reference.levels)
    ], ['shark-pass', 'pass-quests', 'achievements', 'daily-login']);

  add('shark-pass', 'Progression', 'Shark Pass 2: Reef Rush',
    'The seasonal reward track combines XP progress with daily, weekly and season-long quests. Shark Pass 2 is configured for 1 September through 31 December 2026.', [
      section('What the pass contains', 'The track reaches level 30 and includes portraits, badges, profile themes and a level-28 crate reward. Rewards appear at specific levels; not every level has a separate cosmetic. Reaching a level can unlock more than one reward when the track lists two at that milestone.', 'Shark Pass 2 is a different collection from the older Shark Pass 1 portraits, badges and themes. Matching a historical level number does not award every old item from that number. Use the reward list and the cosmetic catalogue to identify the particular season and artwork.'),
      section('Account level is not season level', 'Season progress is tracked independently from your lifetime account XP. Starting a new pass therefore does not remove your account history, but it also does not hand out the entire season because your account was already a high level.', 'The pass screen is the right place to check progress towards a seasonal portrait. Older account-level portraits can appear elsewhere in the Locker with Shark Pass 1 labels. Keep those legacy requirements separate when planning a cosmetic target.'),
      section('Quests are part of the track', 'Daily quests reset on UTC dates, weekly quests use a UTC week, and season quests run across the season. Completing the requirement makes a quest ready; claim it to receive the XP. Leaving a ready quest unclaimed does not put its listed award into your balance.', 'You can work on several compatible goals together. An eligible win can contribute to games played, wins and XP targets. A crate-opening quest requires an opening, not just earning or buying the crate. Read the action in the objective rather than assuming every activity counts.'),
      section('Season timing and the crate milestone', 'The configured season window is 1 September 2026 at 00:00 UTC to 31 December 2026 at 23:59:59 UTC. Check the live pass screen when a season changes; archived dates describe that collection rather than promising its rewards forever.', 'The level-28 reward is one active seasonal crate. If no eligible seasonal crate is enabled, the reward waits for an eligible event rather than becoming a standard crate. It is a crate to open, not a fourth kind of equippable cosmetic.')
    ], ['pass-rewards', 'pass-quests', 'account-progression', 'all-cosmetics'], 'Sharkpass/index.html');

  add('pass-rewards', 'Progression', 'Shark Pass 2 reward list',
    'Every reward on the Reef Rush track, with its level, type and rarity. Use this list to choose the next milestone you want to work towards.', [
      section('Reading the list', 'A level is a seasonal Shark Pass 2 requirement. A reward’s rarity describes the listed cosmetic or crate milestone; it is not an extra amount of XP required beyond the level. Two rewards on the same level are separate unlocks.', 'Portraits become choices in the Portraits collection, badges go to Badges and themes go to Themes. You can equip them independently. Unlocking Copper Shark, for example, does not force you to use Copper Surge or replace a favourite badge.'),
      table('Complete Shark Pass 2 track', 'This is the complete level reward sequence, including the crate milestone and the level-30 theme.', ['Level', 'Reward', 'Type', 'Rarity'], reference.passRewards),
      section('How to plan a target', 'Pick the item first, then check the level. If your goal is an early portrait, the next few quest claims may be more relevant than the level-30 capstone. Looking at the full track helps you avoid treating every level as an identical cosmetic reward.', 'Use current season XP when estimating your remaining progress. A high account level or an old Shark Pass 1 unlock is not a substitute for the new season’s total. The cumulative level table explains the shape of the XP curve.'),
      section('Artwork and older rewards', 'The full portrait and theme catalogues show the actual artwork and previews. They also keep historical collections alongside current ones so that a species name appearing more than once is not mistaken for a duplicate record.', 'The level-28 seasonal crate follows event eligibility, as described in the pass guide. If that reward has not appeared while no seasonal crate is enabled, do not assume the milestone awards a guaranteed portrait instead.')
    ], ['shark-pass', 'pass-quests', 'cosmetic-portraits', 'cosmetic-badges', 'cosmetic-themes'], 'Sharkpass/index.html', false);

  add('pass-quests', 'Quests', 'Shark Pass quests: requirements and rewards',
    'All three daily quests, all three weekly quests and all ten season quests for Shark Pass 2, together with the claim and reset rules.', [
      section('Complete first, claim second', 'A quest has a requirement, a progress counter and an XP award. When progress reaches its goal, it becomes claimable. Press Claim to add that award; completion and claiming are separate states.', 'The daily and weekly groups are tied to their own periods. Their progress is measured against the relevant period’s starting point for the tracked activity, rather than letting an old lifetime total repeatedly complete every new period. Some specific objectives use their stated absolute statistic, so read the displayed counter.'),
      table('Daily quests', 'Daily quest periods use UTC dates. These base awards can be affected by the applicable XP multiplier.', ['Quest', 'Requirement', 'Base XP'], reference.dailyQuests),
      table('Weekly quests', 'Weekly quest periods use a UTC calendar week. A long session near a week boundary can therefore cross two periods.', ['Quest', 'Requirement', 'Base XP'], reference.weeklyQuests),
      table('Season quests', 'These ten goals belong to the Reef Rush season. “Shiver Run” is a quest title for playing games, not a requirement to use a Shivers mode.', ['Quest', 'Requirement', 'Base XP'], reference.seasonQuests),
      section('Combining goals sensibly', 'Start a session by checking which goals are ready and which are close. A Daily win can be relevant to a daily-win goal while also contributing games, wins and eligible XP. Opening a cosmetic crate can contribute to a crate-opening goal and a crate achievement at the same time.', 'Do not buy something only because its name appears near a quest. A quest to open crates counts openings; owning a crate is not the same event. Practice does not award the normal game statistics needed for these goals, and a friend duel has its own duel statistics.'),
      section('What happens when the reward is claimed', 'Claimed quest XP adds to the account XP total and to the active season’s pass progress through the quest reward path. The notification can show a boosted amount when an applicable XP multiplier is active.', 'Claim each ready quest while its period is relevant. When a new period begins, check the refreshed objectives instead of assuming the old ready-state belongs to the new day or week. The pass screen is the source for what can currently be claimed.')
    ], ['shark-pass', 'account-progression', 'daily-mode', 'crates'], 'Sharkpass/index.html');

  add('achievements', 'Achievements', 'Achievements: unlocking, claiming and displaying them',
    'Achievements recognise particular accomplishments. Reaching the requirement unlocks the achievement; claiming it awards its points, XP and any listed cosmetic.', [
      section('Unlocked and claimed are different', 'An achievement can be unlocked without its reward having been claimed. Open Achievements after a milestone and look for ready rewards. Claiming adds it to your claimed collection and applies the award, which can include a badge or profile theme.', 'The points listed on an achievement contribute to your claimed achievement score. Claiming also grants the corresponding base XP amount through the achievement reward path. An active multiplier can change the XP award without changing the catalogue’s base point value.'),
      section('The categories', 'The collection is organised into World Map, Special, Duels, Wins, Games, Streaks, Efficiency and Social categories. Different categories use different actions: finishing a story region is not the same as winning a normal guessing round, and a duel win is tracked as a duel result.', 'Some achievements concern one exact result, such as a first-guess solve or winning while one attempt remains. Others are cumulative totals. Read the full description before planning a target; a high number in an unrelated statistic will not satisfy a specific action.'),
      section('Rarity, points and cosmetic rarity', 'Achievement rarity uses Common, Rare, Epic, Legendary and Mythic labels. Where an achievement has no explicit rarity, its point value determines the displayed tier. The complete catalogue gives the tier used for each entry.', 'The badge or theme awarded by an achievement can have its own cosmetic rarity. A Mythic achievement does not automatically make its badge Mythic. The cosmetic catalogues document those rewards separately, so use the relevant rarity for the thing you are comparing.'),
      section('Choosing a useful goal', 'A good early goal is one that teaches a part of the game: completing a story chapter, winning a friend duel or making a more efficient solve. Cumulative milestones will develop as you play, while one-round achievements may need you to notice a particular opportunity.', 'Do not deliberately erase good progress because a badge has an unusual unlock. Loss-related badges exist, but a protected streak and a completed achievement are different outcomes. The catalogue records the requirement without making every achievement a compulsory objective.'),
      section('Showing an accomplishment', 'The profile includes an achievement showcase alongside its ordinary cosmetics. Choose an accomplishment you want visitors to see; equipping a portrait or badge is a separate action in the Locker.', 'If a milestone appears to be missing, first check the correct category and the unlocked/claimed state. After cross-device play, allow the account to finish synchronising before comparing totals. A local-only activity or an unfinished round is not necessarily a completed account achievement.')
    ], ['achievement-catalogue', 'account-progression', 'cosmetic-badges', 'cosmetic-themes'], 'Achievements/index.html');

  add('achievement-catalogue', 'Achievements', 'Complete achievement catalogue',
    'Every achievement definition, grouped by category, with its requirement, points, displayed rarity and named cosmetic rewards.', [
      section('How to use this reference', 'Use the description to identify the action, the points to compare its base score, and the reward column to see whether claiming also unlocks a cosmetic. A dash means no named cosmetic is listed, rather than an unannounced random prize.', 'These are achievement requirements, not a second way to submit a guess or a promise that an inactive activity is available. Older labels such as World Map refer to the corresponding story challenges. A named special achievement may remain hidden in the game until its discovery condition is met.'),
      ...reference.achievementTables.map(group => table(group.title, 'Complete the requirement, then claim the achievement to receive its award.', ['Achievement', 'Requirement', 'Points / base XP', 'Rarity', 'Cosmetic reward'], group.rows)),
      section('Progress and exceptions', 'Cumulative categories use their relevant statistics; one-round and discovery achievements depend on their particular trigger. A trophy name alone should not be read as a species, mode or item that you need to buy.', 'The cosmetic rewards remain separate Locker entries after they are unlocked. If you are working towards a particular appearance, use the badge or theme catalogue for its preview and any alternative obtainment, then return here for the achievement requirement.')
    ], ['achievements', 'cosmetic-badges', 'cosmetic-themes'], 'Achievements/index.html', false);

  add('pearls', 'Progression', 'Pearls: earning and spending',
    'Pearls are the normal profile currency used for the Pearl Shop and optional category reveals. They are separate from XP and SharkRNG coins.', [
      section('Earning pearls', 'An eligible Daily or Infinite win awards 50 base pearls. An active 2x Pearls Boost changes that win award to 100 while its timer is running. The boost is a pearl multiplier, not an XP multiplier or a way to improve the species chosen for a round.', 'Pearls also appear in listed social tasks, certain reward codes and Lost Treasures completion rewards. The exact amount depends on the source. A reward table elsewhere in the wiki should be read as that source’s award, not an amount granted for every visit to its page.'),
      section('Where the balance is used', 'The Pearl Shop offers Streak Shields, a timed pearl boost, standard and eligible event crates, a Lost Treasures bottle pack, and the current season’s XP boost. Category reveals on Daily and Infinite use the same pearl balance and cost 25 each.', 'Spending pearls does not spend account XP, and earning XP does not automatically add pearls. A cosmetic crate opens into its own reward pool; buying one is not a direct purchase of whichever portrait you wanted from its drop list.'),
      section('Choosing a purchase', 'For a predictable effect, compare items with fixed benefits: a shield protects one existing streak loss, a bottle pack supplies a specified bundle, and a category reveal gives one undiscovered field for the current round. Random crates have a different role because the individual reward is not selected by the buyer.', 'The one-hour pearl boost costs 500 pearls. At 50 additional pearls per boosted eligible win, ten wins during the timer recover the purchase cost in extra pearls; only wins beyond that point create a net increase from the boost itself. This comparison ignores any other reward sources because the boost applies to the win award.'),
      section('Keeping currencies straight', 'Use the normal pearl balance for profile purchases. SharkRNG coins and its prestige resources are a separate economy, while Rescue Command tracks rescued sharks and its own upgrades. Similar sea-themed names do not make the balances interchangeable.', 'Sign in for account purchases and rewards, and wait for a purchase to confirm before expecting its inventory item. If something looks out of date after moving between devices, check the account and synchronisation state before assuming the currency was lost.')
    ], ['pearl-shop', 'clue-reveals', 'social-rewards', 'lost-treasures-rewards']);

  add('pearl-shop', 'Progression', 'Pearl Shop: complete item guide',
    'Every item in the Pearl Shop, its price, what it does and the limits that matter before buying it.', [
      table('Shop inventory', 'Prices are in pearls. Seasonal availability and ownership caps still apply even when you can afford an item.', ['Item', 'Price', 'What you receive', 'Limit / condition'], reference.shop),
      section('Standard and event crates', 'A standard Cosmetic Crate costs 500 pearls and opens the current standard reward pool. An Event Crate costs 750 pearls and becomes the eligible active seasonal crate. If no event crate is active, that purchase is unavailable rather than silently giving a standard crate.', 'Check the crate reward list before spending. Buying a crate supplies an unopened crate, not a chosen cosmetic. Duplicate cosmetic outcomes follow the ordinary XP conversion rules, and the shared Legendary guarantee controls rarity rather than guaranteeing a new item.'),
      section('Timed boosts', 'The 2x Pearls Boost lasts one hour. Buying another while it is active extends the timer by another hour rather than making the multiplier four times. The timer is real elapsed time, so buy it when you intend to play eligible winning rounds.', 'Season 2x XP is attached to the current season and can only be owned once for that season. It is different from a one-hour pearl boost. Applicable XP rewards use it together with any active event multiplier; it is not a permanent promise of boosted XP in every future season.'),
      section('Fixed utility and collection purchases', 'A Streak Shield costs 250 pearls, and you can hold at most three. It activates automatically when a Daily or Infinite loss would break an existing win streak. Buying a shield at the cap is not another cosmetic unlock.', 'The 300-pearl bottle pack contains five Barnacle, three Red Sea, one Seafoam and one Celestial Bottle. Opening those bottles is a separate step in Lost Treasures. The pack supplies opportunities to draw collection cards, rather than choosing ten missing cards for you.'),
      section('Before pressing Buy', 'Check your balance, the item’s remaining timer or ownership state, and the relevant event availability. A shop label such as Maxed, Owned or Inactive explains why a button may be unavailable even when the price is affordable.', 'The shop requires sign-in so purchases can be associated with the account. Let a purchase finish, then inspect the relevant inventory or timer. The crate guide, Lost Treasures guide and shield page explain how to use what you have bought.')
    ], ['pearls', 'crates', 'streak-shields', 'lost-treasures-bottles']);

  add('daily-login', 'Progression', 'Daily login rewards and login streaks',
    'A repeating seven-day reward cycle for signed-in players. Consecutive local calendar days advance the cycle; missing a day starts the login sequence again.', [
      section('How the cycle advances', 'The daily login system checks your local calendar date when you sign in and initialise the home experience. Returning on the next calendar day advances the login day. Returning after missing days resets it to day one.', 'This clock is separate from the Daily puzzle’s midnight-UTC reset. Depending on your time zone, a new Daily puzzle and a new login reward may become available at different times. Do not assume that solving a new UTC puzzle has automatically advanced the local login date.'),
      table('Seven-day reward cycle', 'These are base XP awards. The cycle repeats; the current day-seven portrait is Barndoor Skate.', ['Cycle day', 'Base XP', 'Additional reward'], reference.login),
      section('The day-seven portrait', 'Barndoor Skate is the Rare portrait in the current login reward cycle. It is a separate unlock from a crate portrait, and completing another seven-day cycle does not create a second equippable copy of the same artwork.', 'Bull Shark is the older Login Reward 1 portrait. It remains documented for players who own it, but the current day-seven reward is Barndoor Skate. The presence of the old image in a collection is not a second selectable login track.'),
      section('Login streak and win streak', 'A login streak counts consecutive visiting days. A win streak counts game outcomes. You can advance one without advancing the other: logging in is not itself a guessing win, and several wins in one day do not count as several login days.', 'Streak Shields protect the game win streak when their loss condition applies. They do not protect a missed login day or shift the local calendar. If a login sequence has restarted, check which streak you were watching before expecting a shield to have saved it.'),
      section('Reward amounts and account progress', 'Login XP goes through the applicable XP reward path and contributes to the account total and active pass progress. A multiplier can make the notification larger than the base amount shown in the table.', 'Sign in with the same account when moving devices, and allow the profile to finish loading. A login reward is a once-per-day action, not a reason to repeatedly refresh the page hoping for another award on the same local date.')
    ], ['account-progression', 'game-clocks', 'streak-shields', 'cosmetic-portraits']);

  add('streak-shields', 'Progression', 'Streak Shields',
    'A consumable that automatically protects an existing win streak from one Daily or Infinite loss. It preserves the streak; the round itself remains a loss.', [
      section('When a shield activates', 'A shield is used when you lose a supported guessing round while your current win streak is above zero. It is automatic: you do not need to press a shield button during the final attempt. The inventory count goes down by one when it protects that loss.', 'If you have no existing win streak, there is nothing for the shield to preserve. It does not replay the round, change the answer, restore guesses or turn the loss into a win. Wins, losses and streak protection describe different parts of the result.'),
      section('Obtaining and storing shields', 'Streak Shields can appear as an Epic utility drop from Cosmetic Crate 2, can be won on the daily win wheel, and cost 250 pearls each in the Pearl Shop. They are inventory items rather than portraits, badges or themes.', 'You can hold at most three. A shield purchase is unavailable at that cap. A crate shield drop is not handled as a duplicate cosmetic: it does not use the portrait/badge/theme duplicate XP conversion just because the item cannot increase the capped count.'),
      section('Achievements and badges', 'Using a shield can satisfy the Saviour achievement. Because a protected loss does not break the existing streak, it also does not fulfil the same situation as an unprotected streak-breaking loss for the Arrow to the Knee badge.', 'Loss-related progress is not identical to streak protection. The result still counts as a loss, so read an achievement’s exact wording instead of treating “shield used” as equivalent to “game won.” The achievement catalogue and badge descriptions give the separate requirements.'),
      section('Planning around a streak', 'A shield is most useful when you already have a streak you care about. It can reduce the cost of one bad round, but it does not make an uncertain final guess more informative. Continue using the clues and the Sharchive rather than relying on a stockpile to solve difficult answers.', 'Shield protection belongs to the normal win-streak system. It does not preserve the daily login cycle, an RNG streak or a timer in another game. Check the relevant progression page before assuming a similarly named counter is protected.')
    ], ['pearls', 'pearl-shop', 'achievements', 'cosmetic-badges']);

  add('codes', 'Codes', 'Reward codes and how to redeem them',
    'Active reward codes, their rewards, and a separate record of inactive and historical promotions. UPDATE1, UPDATE2 and SORRY are inactive and cannot be redeemed.', [
      section('Redeeming a code', 'Sign in, open the code entry in the profile or home interface, and submit the code as written. Codes are checked without case differences, but the spelling still matters. A code can only be claimed once per account.', 'Wait for the confirmation before expecting the reward. A code can award XP, a portrait, pearls, crates or a combination of those. XP is a base award in the reference; applicable multipliers can change the amount shown when the code is redeemed.'),
      table('Active reward codes', 'These are the remaining listed codes. A code does not override the availability rules of a retired reward, so SUMMER2026 is called out separately.', ['Code', 'Base XP', 'Other rewards', 'Status / note'], reference.codes),
      table('Inactive codes', 'These codes are no longer active and cannot be used. Their original rewards are kept here for reference, not as current obtainments.', ['Code', 'Original base XP', 'Original other rewards', 'Current status'], [['UPDATE1', '1,000', 'Greenland Shark portrait', 'Inactive — cannot be redeemed.'], ['UPDATE2', '1,500', 'Goblin Shark portrait', 'Inactive — cannot be redeemed.'], ['SORRY', '5,000', '—', 'Inactive — cannot be redeemed.']]),
      table('Historical badge and portrait codes', 'These rewards remain useful for identifying an old profile, but their codes are not in the current redeemable list.', ['Code', 'Original cosmetic reward', 'Current status'], [['TESTER', 'Tester badge', 'Removed from the current code list.'], ['ANNIVERSARY2026', 'Anniversary badge and anniversary Hammerhead Shark portrait', 'Historical promotion; not in the current code list.']]),
      section('The Summer code caveat', 'SUMMER2026 remains a recognised code with 3,000 base XP and a Summer Crate reward listed. Summer Crates are retired and use the game’s retirement handling, so the old code description should not be treated as a reliable route to opening today’s Summer reward pool.', 'The complete crate guide records the Summer collection and its conversion rules. If you are choosing a code for a specific cosmetic, use a listed portrait reward rather than assuming an old seasonal crate description guarantees an obtainable seasonal item.'),
      section('Already claimed and invalid codes', 'An already-claimed code is not a repeatable XP farm. Owning the reward portrait can also be relevant when the game checks an old claim. Keep the full reward message in mind rather than expecting the same code to supply another copy of a cosmetic.', 'An inactive code cannot be used even if your account never claimed it. UPDATE1, UPDATE2 and SORRY are no longer active. New codes may be announced with later updates; use the active list above and treat the inactive and historical tables as an archive.')
    ], ['cosmetic-portraits', 'cosmetic-badges', 'account-progression', 'crates']);

  add('friends', 'Community', 'Friends and friend codes',
    'Use a friend code to send a request, accept an incoming request, compare profiles and start a friend duel.', [
      section('Adding another player', 'Open the Friends area and find your own friend code. Share that code with someone who wants to connect, or enter their code to find their account. A request must be accepted before the two players become friends.', 'Use the account you intend to play on. A display name and a friend code serve different purposes: the code identifies the connection route, while the name is how the player appears on profile views. Do not assume a familiar-looking name alone identifies the correct account.'),
      section('Requests and the friend list', 'Incoming requests can be accepted or declined through the Friends interface. Once accepted, the player appears in the friend list, where profile and duel actions are available. Removing a friend is a separate list action rather than a reset of your normal game history.', 'If a request is still pending, wait for the other person to respond instead of repeatedly submitting it. A shared code is an invitation to connect, not an automatic acceptance or a way to take over another player’s progress.'),
      section('Playing together', 'A friend duel gives both participants the same shark target with separate guess histories. It is useful when you want a direct comparison rather than comparing unrelated Infinite rounds. The duel page explains invitations, scoring and draws.', 'You can also compare a Daily result if both players used the same pool and UTC date. Keep answer spoilers out of a message to someone who is still playing. Sharing a guess count and discussing the clue path after both players finish preserves the puzzle.'),
      section('Related rewards', 'Accepted friend connections are involved in the referral reward system, which grants a standard crate for an eligible unclaimed pair reward. Repeatedly reconnecting the same pair is not a new unique referral every time.', 'Friend-count achievements are separate milestones with their own requirements and claims. Adding enough friends can make an achievement ready, but claiming that achievement is still the step that applies its listed reward. Check the Social category after reaching a new friend-count milestone.')
    ], ['duels', 'share-and-referrals', 'achievements']);

  add('duels', 'Community', 'Friend duels: rules and results',
    'Two friends solve the same shark with twelve attempts each. The winner is decided by solving the target and, when both solve it, using fewer guesses.', [
      section('Starting a duel', 'Choose the duel action for a friend. The challenge begins pending, and the opponent must accept before the shared board becomes active. A declined invitation is not a completed game. If an existing live duel with that person is already present, the interface opens it instead of creating another parallel challenge.', 'The duel uses a shark from the shark roster. It is not automatically a Relatives or Combined round just because one participant last played those pools elsewhere. Each player has their own twelve-attempt board for the same target.'),
      section('Playing the shared target', 'Submit a valid shark name and read the six comparisons. The feedback includes taxonomy, size, depth and discovery year, with the year arrow pointing earlier or later as appropriate. A shark already guessed on your duel board cannot be submitted again.', 'The live interface can show how many guesses each player has used. It does not make the opponent’s progress into a reason to rush a weak guess: the final comparison is based on solved status and guess count, rather than simply who clicks a name first.'),
      table('How the winner is decided', 'The duel is finalised after both participants finish their runs.', ['Result', 'Outcome'], [['One player solves; the other does not', 'The player who solved wins.'], ['Both solve with different guess counts', 'The lower guess count wins.'], ['Both solve in the same number of guesses', 'Draw.'], ['Neither player solves the shark', 'Draw.']]),
      section('Duel statistics and achievements', 'Completed duels contribute to the dedicated duel-game and duel-win counters. First Blood recognises playing a friend duel; Apex Rival recognises a win. Longer duel milestones have their own requirements and cosmetic rewards.', 'A duel is not a method of changing the Daily target or replaying a finished Daily round. Its statistics are separate from simply completing normal guessing games. Check the achievement’s category before assuming an ordinary Infinite win satisfies a friend-duel goal.'),
      section('Finishing and returning', 'After your own run is locked, the other player may still need to finish. The board can therefore show your completed side while the final duel result remains pending. Return when both sides are done to see the resolved result.', 'If the interface appears behind the other player’s screen, allow the account and live board to update. The meaningful outcome is the final shared duel record. A temporarily displayed guess count is not a reason to start a second challenge before the current one is settled.')
    ], ['friends', 'how-guessing-works', 'achievement-catalogue']);

  add('accounts-and-saving', 'Community', 'Accounts, profiles and saving progress',
    'Sign-in connects eligible rewards and profile progress to your account. Local browser progress and account synchronisation work together, but they are not interchangeable copies of every activity.', [
      section('Why sign in?', 'Use a signed-in account when you want profile rewards, friend connections, purchases and progress shared between devices. The profile brings together statistics, the Locker, achievements and related account information.', 'Opening a playable page as a guest is not the same as having every signed-in reward route available. In particular, account-dependent purchases and social actions require an account. Sign in before a session in which XP, pearls or cross-device collection progress matters.'),
      section('Local progress and account progress', 'The browser keeps local information so screens can restore state and respond promptly. Eligible account progress is also synchronised with the online profile. A local value appearing immediately does not mean another device has already finished loading that change.', 'Different activities have their own progress systems. Daily keeps a dated board; the normal profile keeps account statistics and cosmetics; SharkRNG has its own collection and save handling. Do not assume a successful save message for one of these means every other activity was just exported too.'),
      section('Moving between devices', 'Finish the action and allow its confirmation before closing the page. On the next device, sign in to the same account and wait for its profile to load. If a balance or unlock looks old, check the account identity and use the profile’s synchronisation controls before replaying a purchase.', 'Clearing site data can remove local browser progress. Private browsing and different browsers also keep separate local storage. An account-backed save is the route for eligible cross-device information, while a local-only activity still depends on that browser’s retained data.'),
      section('Using the profile', 'The Locker contains owned portraits, badges, themes, crates and supported utility items. Equipping a cosmetic changes how your profile looks; earning an achievement or increasing XP is a different action. The profile also exposes statistics and account controls.', 'Avoid treating an admin-only control, a developer role reward or an old screenshot as a normal account feature. The public wiki describes the player routes and labels restricted cosmetics. It does not require sharing account credentials or manually editing saved values to obtain a reward.'),
      section('When progress looks wrong', 'Check whether the round actually finished, whether the reward needed a separate Claim action, and whether you were signed in when it was earned. Then check whether you are looking at account level, season level, a login streak or another mode’s progress.', 'These checks resolve several apparent missing-reward cases without changing the underlying save. If the issue remains, report the relevant mode, account-visible result and time to the developer; do not erase your browser data as the first troubleshooting step.')
    ], ['account-progression', 'friends', 'all-cosmetics', 'game-clocks']);

  add('share-and-referrals', 'Community', 'Sharing Sharkdle and referral rewards',
    'The friend-code sharing system includes a one-time sharing crate and eligible rewards for accepted friend connections.', [
      section('The sharing reward', 'The built-in friend-code share action can grant one standard Cosmetic Crate to a signed-in account. It is a one-time reward for that sharing action, not a daily crate generated whenever the Share button is pressed.', 'The crate goes into unopened inventory. It does not immediately choose or equip a cosmetic. Open it through Crates to receive a reward from the current standard collection, with the same duplicate and Legendary-guarantee rules as other standard crates.'),
      section('Accepted friend connections', 'Eligible accepted friend connections grant one standard crate per unclaimed pair reward. The pair is tracked so the same connection cannot be repeatedly harvested by removing and re-adding the person.', 'An outgoing request on its own is not the same as an accepted connection. The other player needs to respond. Some eligible rewards can be delivered as pending account rewards and appear when the account next loads, rather than both screens updating at exactly the same instant.'),
      section('What this system does not promise', 'A friend-code reward is not a real-money commission or an unlimited supply of crates. The exact eligible action matters: sharing a result screenshot and using the built-in friend-code share reward are not necessarily the same event.', 'Do not send unwanted requests just to chase a reward. Use friend codes with players who actually want the connection. The ordinary friend list, duel system and social achievements provide reasons to stay connected after the one-time reward has been claimed.'),
      section('Related social tasks', 'The Social Rewards panel has a separate set of listed actions that grant pearls. Those actions have their own one-time claim records and should not be confused with the friend-code crate reward.', 'The complete Social Rewards table lists each task and its pearl amount. When checking an apparent missing reward, identify whether you expected pearls from a task, a crate from sharing, or a crate from an accepted referral pair; they are separate awards.')
    ], ['friends', 'duels', 'social-rewards', 'crates']);

  add('social-rewards', 'Community', 'Social Rewards task list',
    'The optional Social Rewards panel lists ways to follow the project and support its community. Each task has a specific pearl award and can be claimed once.', [
      section('Using the panel', 'Open Social Rewards while signed in and choose a task you want to complete. The panel groups actions by platform, including YouTube, Instagram, TikTok and Support. Follow the task’s own instructions, then use its claim flow.', 'The task reward is not an automatic award for browsing any social page. The listed action and its claim record matter. Reopening a completed action is not another opportunity to claim the same pearls on the same account.'),
      table('Every listed task', 'These are the task names and base pearl amounts in this edition. Numbered posts are separate listed tasks, not repeated claims on one post.', ['Platform', 'Action', 'Pearls'], reference.social),
      section('Pearls and other rewards', 'Social task pearls use the normal profile pearl balance. They can be spent in the Pearl Shop or on a category reveal. They are separate from a one-time friend-code sharing crate and from a reward code that happens to mention the same platform.', 'A 2x Pearls Boost modifies the eligible win pearl award; do not assume that it doubles the amount displayed on every Social Rewards task. Read the fixed task amount rather than treating every source of pearls as a boosted game win.'),
      section('Choosing tasks', 'These are optional ways to support Sharkdle, not prerequisites for completing a Daily puzzle or identifying a species. Choose the platforms and community activities you actually use.', 'If a task is already marked claimed, check that state before expecting another award. The wiki records the available list so you can compare amounts and see what a named task refers to, while the in-game panel provides the current action and claim controls.')
    ], ['pearls', 'share-and-referrals', 'codes']);

  add('leaderboards', 'Community', 'Leaderboards and placement rewards',
    'Leaderboards compare eligible account progress over different time ranges. Daily, monthly and all-time standings answer different questions.', [
      section('Read the selected range', 'A daily board measures its current daily period, a monthly board measures its current month, and an all-time board uses the long-term statistic. A player leading one range does not automatically lead the others.', 'The normal win ranges use UTC date and month keys. A displayed reset timer can therefore differ from your local calendar boundary. Check both the metric and the selected range before comparing two positions or expecting a period reward.'),
      section('Ranking and eligibility', 'The normal leaderboard ranks eligible accounts by their win total for the selected period, highest first. A current-period board needs wins in that period; historical wins alone do not create a positive daily or monthly score.', 'Scores are subject to the game’s account and fair-play rules. Accounts excluded from the leaderboard do not receive an ordinary ranked position, and the profile can show a notice explaining that exclusion. A locally displayed result is not an unconditional guarantee of a public leaderboard entry. SharkRNG has its own ranking and progression, rather than adding its rolls to this normal win total.'),
      section('Profile appearance on a board', 'The leaderboard can show profile cosmetics beside a player’s identity. Portraits, badges and themes describe the equipped appearance; their rarity does not add extra wins to the displayed statistic.', 'A leaderboard portrait is an unlock with a placement requirement, not a multiplier that helps retain the position. The cosmetic catalogue records the relevant appearances so a visiting player can identify an unusual portrait without assuming it came from a crate.'),
      table('Named placement portraits', 'These are the portrait obtainments used by the profile collection.', ['Portrait', 'Requirement', 'Cosmetic rarity'], [['Port Jackson Shark', 'All-time leaderboard top 3 reward', 'Legendary'], ['Catshark', 'Daily leaderboard #1 reward', 'Rare'], ['Whitetip Reef Shark', 'Monthly leaderboard #1 reward', 'Rare']]),
      section('Rewards and a changing board', 'Standings can change as eligible players finish games and their accounts synchronise. A temporary position is a snapshot of that board, not a reason to assume every placement reward has already been permanently granted.', 'Practice does not record normal wins or XP and is not a route to raising these standings. Friend-duel counters and SharkRNG rankings also describe separate activities; check the mode rather than assuming every “win” label belongs to the same leaderboard.'),
      section('If a position looks unfamiliar', 'Confirm the range, the metric, the account name and the period before comparing it with a screenshot. Then allow the board to refresh after new results. A high lifetime total can coexist with a quiet current day.', 'For a fair comparison between ordinary puzzle results, compare the same mode and pool. The leaderboards measure their stated statistic, while the Daily result itself remains the twelve-attempt puzzle you completed.')
    ], ['daily-mode', 'game-clocks', 'cosmetic-portraits', 'accounts-and-saving'], 'Leaderboard/index.html');

  add('game-clocks', 'Getting started', 'Daily resets, timers and the different game clocks',
    'Several features use the word “daily,” but they do not all share the same reset. Use the clock belonging to the reward or puzzle you are checking.', [
      table('Which clock applies?', 'A UTC boundary and a local calendar boundary can occur at different times for the same player.', ['Feature', 'Clock / boundary', 'What changes'], [['Daily puzzle', 'Midnight UTC', 'The shared daily target for each pool.'], ['Daily Shark Pass quests', 'UTC date', 'The daily quest period.'], ['Weekly Shark Pass quests', 'UTC week', 'The weekly quest period.'], ['Daily win leaderboard', 'UTC date', 'The current daily-win period.'], ['Monthly win leaderboard', 'UTC month', 'The current monthly-win period.'], ['Login reward cycle', 'Local calendar day', 'Eligibility for the next login day.'], ['Normal daily win-wheel spin', 'Local calendar day', 'The day for unlocking and using the normal spin.'], ['2x Pearls Boost', 'One hour of elapsed time per purchase', 'The remaining boost duration.']]),
      section('Why two daily features can disagree', 'A new UTC day can arrive before or after your local midnight. You may therefore see a new Daily puzzle while the login system still recognises the same local day, or advance a login day before the UTC puzzle changes.', 'Daylight saving can alter the time shown on your own clock for a UTC reset. The puzzle still uses UTC; it does not move its reset to match your local midnight. Check the timer or the stated boundary instead of comparing only the calendar date on a screenshot.'),
      section('Timers are different from calendar days', 'A one-hour boost counts elapsed time from its activation or extension. It does not run until the next UTC reset or give one hour of actual game-playing time spread across multiple visits. Opening another page does not turn it into an unlimited session.', 'Season dates are a longer configured window. A seasonal name is not enough to prove a feature is enabled: global event controls can determine whether a seasonal crate is available, and RNG seasonal mutation availability uses its own settings.'),
      section('Checking a missing daily reward', 'Identify the feature first, then its clock, then whether you completed and claimed the required action. Logging in, winning a game, finishing a quest and pressing Claim are different events.', 'If the date is correct but progress still looks old, check the signed-in account and allow it to synchronise. Repeatedly refreshing a page within one period does not create a new daily reward. The feature’s own guide gives the exact action and limits.')
    ], ['daily-mode', 'daily-login', 'pass-quests', 'leaderboards']);

  // Infoboxes keep the rules and requirements visible above the walkthrough.
  const facts = {
    'beginner-guide': [['Main objective', 'Identify the mystery species'], ['Starting point', 'Practice Mode, then Daily or Infinite'], ['Core feedback', 'Order, family, genus, size, depth, discovery year'], ['Reference tool', 'Sharchive'], ['Progression', 'Sign in for eligible account rewards']],
    'how-guessing-works': [['Daily / Infinite limit', '12 valid guesses per round'], ['Practice limit', 'No twelve-attempt loss limit'], ['Comparison fields', '6'], ['Directional clue', 'Discovery year only'], ['Matching a field', 'Exact equality with the target’s recorded value']],
    'guessing-strategy': [['Main method', 'Combine confirmed clues into a shortlist'], ['Year bounds', 'Later than an up-arrow guess; earlier than a down-arrow guess'], ['Size / depth', 'Exact category matches, not direction arrows'], ['Optional help', 'Sharchive filters; one 25-pearl category reveal']],
    'daily-mode': [['Round type', 'Shared daily target within each pool'], ['Attempts', '12'], ['Puzzle reset', 'Midnight UTC'], ['Pools', 'Sharks, Relatives, Combined'], ['Base win XP', '160 down to 50, depending on guesses'], ['Base eligible win pearls', '50']],
    'infinite-mode': [['Round type', 'New target on a new round'], ['Attempts', '12 per round'], ['Pools', 'Sharks, Relatives, Combined'], ['Base win XP', 'max(50, 170 − 10 × guesses)'], ['Base eligible win pearls', '50'], ['Normal results', 'Wins, losses and relevant account statistics']],
    'practice-mode': [['Round type', 'Unrestricted learning exercise'], ['Attempt counter', 'Counts guesses; no twelve-attempt loss limit'], ['Normal XP', 'None'], ['Normal game statistics', 'Not recorded'], ['Pools', 'Sharks, Relatives, Combined']],
    'species-pools': [['Sharks', 'The shark catalogue'], ['Relatives', 'Rays, skates, guitarfishes, chimaeras and other relatives'], ['Combined / Mixed', 'Both catalogues together'], ['Applies to', 'Daily, Infinite and Practice']],
    sharchive: [['Purpose', 'In-game species library and clue filtering'], ['Search', 'Names, taxonomy, discovery year and archive number'], ['Filters', 'Pool, size, depth, year bounds and personal views'], ['Personal views', 'Favourites, Recently Viewed and Needs Practice'], ['Clue transfer', 'Available from the Daily / Infinite mystery profile']],
    'species-mastery': [['Mastery requirement', '5 tracked wins against the target species'], ['Tracked modes', 'Signed-in Daily and Infinite results'], ['Practice wins', 'Not part of normal mastery tracking'], ['History', 'Attempts, wins, losses, total guesses and best win'], ['Review tools', 'Common mix-up, weak category and Needs Practice']],
    'clue-reveals': [['Price', '25 pearls'], ['Limit', 'Once per Daily / Infinite round'], ['Selection', 'Random undiscovered field'], ['Sign-in', 'Required'], ['After the round ends', 'Unavailable'], ['Permanent unlock', 'No; the clue belongs to that round']],
    'account-progression': [['Account XP', 'Lifetime normal profile progression'], ['Season XP', 'Separate Shark Pass season progression'], ['RNG XP', 'Separate SharkRNG rank progression'], ['Account start', 'Level 1 at 0 account XP'], ['Season start', 'Fresh pass progress at 0 season XP']],
    'shark-pass': [['Track', 'Shark Pass 2: Reef Rush'], ['Configured start', '1 September 2026, 00:00 UTC'], ['Configured end', '31 December 2026, 23:59:59 UTC'], ['Reward capstone', 'Level 30: Sixgill Night theme'], ['Listed level rewards', '24'], ['Quest groups', 'Daily, weekly and season']],
    'pass-rewards': [['Collection', 'Shark Pass 2: Reef Rush'], ['Reward entries', '24'], ['Portraits', '10'], ['Badges', '9'], ['Themes', '4'], ['Crate milestone', 'Level 28: active seasonal crate']],
    'pass-quests': [['Daily quests', '3'], ['Weekly quests', '3'], ['Season quests', '10'], ['Daily / weekly clock', 'UTC periods'], ['Reward step', 'Complete, then Claim'], ['Award type', 'Base XP; applicable multipliers may increase it']],
    achievements: [['Catalogue size', '60 achievements'], ['Groups', '8'], ['Claimed points', 'Achievement score; not a spendable currency'], ['Claim reward', 'Listed XP and any named cosmetic'], ['State flow', 'Locked → unlocked → claimed']],
    'achievement-catalogue': [['Achievement definitions', '60'], ['Categories', '8'], ['Rarity scale', 'Common, Rare, Epic, Legendary, Mythic'], ['Cosmetic rewards', 'Only where explicitly named'], ['Claim required', 'Yes']],
    pearls: [['Currency', 'Normal profile pearls'], ['Base eligible win award', '50'], ['Boosted eligible win award', '100 while 2x Pearls is active'], ['Primary uses', 'Pearl Shop and category reveals'], ['Interchangeable with RNG coins', 'No']],
    'pearl-shop': [['Currency', 'Pearls'], ['Listed items', '6'], ['Sign-in', 'Required'], ['Shield cap', '3 held'], ['Event Crate', 'Requires an active eligible seasonal event']],
    'daily-login': [['Cycle', '7 days, repeating'], ['Clock', 'Local calendar day'], ['Consecutive days', 'Advance the login cycle'], ['Missed day', 'Resets the sequence to day 1'], ['Current day 7 portrait', 'Barndoor Skate — Rare']],
    'streak-shields': [['Type', 'Consumable utility item'], ['Pearl Shop price', '250 pearls'], ['Holding cap', '3'], ['Activation', 'Automatic on a supported loss with an existing win streak'], ['Effect', 'Preserves the streak; the result is still a loss']],
    codes: [['Active listed codes', '6'], ['Inactive codes', 'UPDATE1 · UPDATE2 · SORRY'], ['Claim limit', 'Once per active code per account'], ['Sign-in', 'Required'], ['Letter case', 'Not significant'], ['Historical cosmetic codes', 'TESTER and ANNIVERSARY2026 are not currently redeemable']],
    friends: [['Connection method', 'Friend code and accepted request'], ['Account', 'Signed-in player'], ['Play together', 'Friend duels'], ['Related progress', 'Friend-count achievements and eligible referral pair rewards']],
    duels: [['Participants', '2 friends'], ['Target pool', 'Sharks'], ['Attempts', '12 each'], ['Winner', 'Solve the target; fewer guesses if both solve'], ['Draws', 'Same successful guess count, or neither solves'], ['Finalisation', 'After both players finish']],
    'accounts-and-saving': [['Account role', 'Connect eligible rewards and cross-device profile progress'], ['Local browser data', 'Used alongside account synchronisation'], ['Separate activities', 'Normal profile, dated Daily board and individual mode saves'], ['First check for a missing reward', 'Account, completed action and Claim state']],
    'share-and-referrals': [['Sharing crate', '1 standard crate for the eligible one-time share action'], ['Referral reward', '1 standard crate per eligible unclaimed friend pair'], ['Repeated share presses', 'Do not create repeated claims'], ['Reward location', 'Unopened crate inventory']],
    'social-rewards': [['Listed tasks', '38'], ['Platforms', 'YouTube, Instagram, TikTok and Support'], ['Reward', 'Task-specific pearls'], ['Claim limit', 'Once per task per account'], ['Optional', 'Not required to solve a puzzle']],
    leaderboards: [['Normal ranking metric', 'Eligible wins in the selected range'], ['Ranges', 'Daily, monthly and all time'], ['Daily / monthly boundaries', 'UTC'], ['Practice', 'Does not supply normal ranked wins'], ['RNG ranking', 'Separate from the normal win board']],
    'game-clocks': [['UTC features', 'Daily puzzle, pass quest periods and period win boards'], ['Local-day features', 'Daily login and normal win-wheel spin'], ['Elapsed-time feature', 'One-hour 2x Pearls Boost'], ['Seasonal availability', 'Feature-specific; a calendar name alone does not enable an event']]
  };
  for (const entry of entries) entry.facts = facts[entry.id] || [];

  const find = id => entries.find(entry => entry.id === id);
  const append = (id, ...sections) => find(id).sections.push(...sections);
  append('daily-mode',
    { title: 'Round flow, step by step', bullets: ['Choose Sharks, Relatives or Combined and check the UTC puzzle date.', 'Submit a valid species from that pool. A repeated or invalid name must be corrected before it can become another guess.', 'Read the six comparisons; reopen an earlier card whenever you need to check a clue.', 'Use the mystery profile or Sharchive shortlist to choose a candidate that fits the confirmed information.', 'Solve within twelve attempts, or finish with a loss when no attempts remain.', 'Inspect the result, then check any ready quest or achievement claims. Daily does not immediately generate a second target for the same pool and date.'] },
    section('Worked reward example', 'A signed-in player solves in four guesses. The base XP calculation is 170 − (4 × 10) = 130 XP, and the base eligible win pearl award is 50 pearls. If the player has an active 2x Pearls Boost, that pearl award is 100 instead; the pearl boost does not change the 130-XP calculation.', 'If an applicable 2x XP multiplier is also active, the 130 base XP becomes 260 awarded XP. A normal crate roll or Lost Treasures bottle roll is a separate random reward check. Neither the four-guess result nor a pearl multiplier guarantees that a crate or bottle appears.'),
    section('Common Daily questions', 'Can I try the answer again after losing? The finished Daily board is the result for that pool and date; use another mode for a new learning round. Can I compare with a friend in another time zone? Yes, provided you are both solving the same UTC date and pool.', 'Why do the login day and Daily puzzle disagree? Login uses your local calendar day while Daily uses UTC. Why did the reward look smaller than a screenshot? Compare guess count and active multipliers, and check whether the screenshot included separate claims or drops.'));
  append('infinite-mode',
    { title: 'Round flow, step by step', bullets: ['Select the species pool for the session.', 'Start a new round and treat its target as independent of the previous board.', 'Submit valid guesses, keeping confirmed classifications and year bounds together.', 'Finish by solving within twelve guesses or using the remaining attempts without a solve.', 'Review the result and the target species before starting the next round.', 'Continue with another Infinite target, or switch to Practice when you want to experiment without normal losses.'] },
    section('A session is more than a reward total', 'Suppose you win three signed-in rounds in 3, 6 and 9 guesses. Their base XP awards are 140, 110 and 80, totalling 330 base XP. The base eligible pearl total is 150, regardless of those different winning guess counts. This example assumes no XP or pearl boosts and no separate claims.', 'A fourth round that ends in a loss is not another 50-pearl win. It can affect the loss and streak statistics even if a Streak Shield preserves the existing win streak. Keep the account result separate from any cosmetic or collection drop you happened to see.'),
    section('Avoiding unhelpful habits', 'A fresh target means an old round’s confirmed family is not a clue for the new round. Repeating the same follow-up because it worked last game can waste attempts. The new board must earn its own constraints.', 'Infinite has no calendar wait for another target, but that does not make every action a completed game. Finish a round when working towards a games-played objective, and read the relevant quest counter instead of assuming a page refresh or pool switch supplies a completed result.'));
  append('practice-mode',
    section('A three-part learning routine', 'First, solve a round while keeping only confirmed fields and year bounds. Second, review the answer in the Sharchive beside one incorrect species you considered. Third, write down one useful difference you can recognise next time, such as a genus, depth category or recorded year.', 'The improvement you are looking for is a repeatable clue-reading habit. A shorter second solve is encouraging, but it is not necessary to rush through a new species before you understand why it fits. Practice can take as many valid new guesses as the exercise requires.'),
    section('Practice questions', 'Does signing in turn Practice into an XP mode? No. Does the final guess count become a normal win statistic? No. Can I use the library? Yes; the point of the mode is to learn the records and how their fields compare.', 'If you need eligible normal game results for a pass quest, win achievement or mastery record, move to the supported normal mode. Practice completion and a tracked Daily or Infinite win are different events.'));
  append('clue-reveals',
    section('Example: why a reveal may not select the species', 'Imagine a shortlist in which three candidates already share the same unknown depth category. Revealing Depth confirms that field but leaves all three names possible. A different undiscovered field might divide the shortlist more sharply, but the purchase does not let you choose which field is selected.', 'That is why the reveal is priced as one clue rather than sold as an answer. At 25 pearls it costs half of one base eligible win’s 50-pearl award. Saving it for a round where any new confirmed information would help can make more sense than buying it automatically on every first guess.'));

  add('win-rewards', 'Progression', 'Normal win rewards: exact XP and pearl examples',
    'The normal win reward depends on guess count for XP, while the base eligible pearl award stays fixed. Boosts and random drops are separate parts of the result.', [
      table('Base rewards for every successful guess count', 'Daily and Infinite use the same base XP curve. Pearl values assume an eligible signed-in win.', ['Guesses used', 'Base XP', 'Base pearls', 'Pearls during 2x Pearls'], Array.from({ length: 12 }, (_, i) => [String(i + 1), String(Math.max(50, 170 - (i + 1) * 10)), '50', '100'])),
      section('Separate the base from the multiplier', 'A six-guess solve is 110 base XP. A 2x XP multiplier makes that 220 awarded XP; an applicable total multiplier of 4x makes it 440. The base does not change just because the notification includes a larger award.', 'The 2x Pearls Boost is a different multiplier. It changes the normal eligible win pearl award from 50 to 100 during its one-hour timer, without changing the XP curve. A reward code, a quest claim or a duplicate crate outcome is also a separate award from the round’s win XP.'),
      section('Drops are additional checks', 'Signed-in normal wins can roll for a standard Cosmetic Crate, and the Lost Treasures system has its own bottle-drop logic. A random drop can appear alongside the fixed win reward, but seeing one does not mean the displayed pearl total was the crate’s purchase price.', 'Do not treat a percentage as a countdown. A 50% normal crate chance means a chance on each eligible check; it does not promise exactly one crate for every pair of wins. The crate Legendary guarantee applies when opening crates, not when a win is deciding whether to drop one.'),
      section('Comparing two result screens', 'Compare the mode, guess count, sign-in state and multipliers first. Then distinguish the round award from any additional drop or claim. Two players can solve the same species in the same number of guesses and still see different extra rewards from independent random checks.', 'A loss is not a win award even if a shield keeps the win streak intact. Practice deliberately omits normal XP and statistics. A friend duel belongs to its dedicated result system rather than becoming an extra normal Daily solve.')
    ], ['account-progression', 'pearls', 'pearl-boost', 'daily-mode', 'infinite-mode', 'crates']);
  find('win-rewards').facts = [['Applies to', 'Daily and Infinite wins'], ['XP formula', 'max(50, 170 − 10 × guesses)'], ['First-guess base XP', '160'], ['Twelfth-guess base XP', '50'], ['Base eligible pearls', '50'], ['During 2x Pearls', '100 pearls per eligible win']];

  add('worked-guessing-examples', 'Getting started', 'Worked guessing examples',
    'Follow real Sharkdle records through a complete clue-reading example. The target is stated here so you can see why each comparison is correct.', [
      section('Example target: Bull Shark', 'This example uses Bull Shark as its stated target. It is a teaching board, not a hint about the current Daily answer. Its Sharkdle record is Carcharhiniformes, Carcharhinidae, Carcharhinus, Medium, Epipelagic and discovery year 1839.', 'The aim is to follow the information, rather than pretend these are the only sensible guesses. You could use a different valid opener or a more direct follow-up. Every comparison below uses the actual values of the named records.'),
      table('The relevant records', 'Compare the six fields across these species before following the example board.', ['Species', 'Order', 'Family', 'Genus', 'Size', 'Depth', 'Discovery year'], [
        ['Blue Shark', 'Carcharhiniformes', 'Carcharhinidae', 'Prionace', 'Large', 'Epipelagic', '1758'],
        ['Blacktip Reef Shark', 'Carcharhiniformes', 'Carcharhinidae', 'Carcharhinus', 'Medium', 'Epipelagic', '1824'],
        ['Grey Reef Shark', 'Carcharhiniformes', 'Carcharhinidae', 'Carcharhinus', 'Medium', 'Epipelagic', '1856'],
        ['Bull Shark', 'Carcharhiniformes', 'Carcharhinidae', 'Carcharhinus', 'Medium', 'Epipelagic', '1839']
      ]),
      section('Guess 1: Blue Shark', 'Order, family and depth match the Bull Shark target. Genus and size do not. Because 1758 is earlier than the target’s 1839, the year arrow points up. This tells you to investigate later recorded years, while retaining the confirmed order, family and Epipelagic depth.', 'The failed Large field does not itself produce a “go smaller” instruction. It only establishes that Large is not the target’s category. The next guess should use the confirmed information, not a direction invented for a field that has no direction arrow.'),
      section('Guess 2: Blacktip Reef Shark', 'This guess now matches order, family, genus, Medium size and Epipelagic depth. The name is still wrong. The discovery year 1824 is too early, so its year arrow points up. Your lower bound is now stronger: the target was recorded later than 1824.', 'A species outside Carcharhinus is no longer a good candidate once that genus is confirmed. For example, Whitetip Reef Shark has a similar common name and a close year, but its Triaenodon genus would not fit the confirmed genus. Names alone are not enough.'),
      section('Guess 3: Grey Reef Shark; guess 4: Bull Shark', 'Grey Reef Shark shares the five confirmed non-year fields, but its year 1856 is later than 1839. Its arrow points down. Combining this with the Blacktip Reef result leaves a recorded year later than 1824 and earlier than 1856, while keeping the same genus, size and depth.', 'Bull Shark fits those constraints and is the exact stated target, so the fourth guess wins. With no XP boost, that four-guess normal win has a base award of 130 XP. The example does not promise that the random crate or bottle check will produce a drop.'),
      section('A second lesson: two frilled sharks', 'Frilled Shark and Southern African Frilled Shark share order Hexanchiformes, family Chlamydoselachidae, genus Chlamydoselachus, Small size and Bathypelagic depth in the game. Their recorded years are 1884 and 2009. If the target is the Southern African Frilled Shark, guessing Frilled Shark matches five fields but still has the wrong species name and an up arrow for the year.', 'This is why a nearly complete-looking feedback card is useful information rather than an automatic win. You must still choose the correct named record. Use the year and remaining names to finish the shortlist instead of assuming a shared genus means there is only one possible species.')
    ], ['how-guessing-works', 'guessing-strategy', 'sharchive', 'win-rewards']);
  find('worked-guessing-examples').facts = [['Example 1 target', 'Bull Shark'], ['Example 1 final guess', '4'], ['Example 1 year bounds', 'Later than 1824 and earlier than 1856'], ['Example 2 comparison', 'Frilled Shark / Southern African Frilled Shark'], ['Purpose', 'Explain real record comparisons, not the live Daily answer']];

  add('player-faq', 'Getting started', 'Player questions and troubleshooting',
    'Quick answers to the questions that most often make a correct system look confusing: attempts, rewards, claims, clocks, collections and separate progression tracks.', [
      section('Why was my species wrong when most fields matched?', 'Several named species can share a family, genus, size, depth or year. Matching those fields narrows the target; it does not turn a different name into the answer. Bull Shark, Blacktip Reef Shark and Grey Reef Shark are a useful example of records with several shared values.', 'Check which field is still different and compare the remaining names in the Sharchive. A red name and several matching clue fields are not contradictory: they mean the name was wrong but some information was right.'),
      section('Why is there no larger/smaller or deeper/shallower arrow?', 'Those fields compare the recorded category. An unmatched Medium result rules out Medium for that guess; it does not tell you whether the target is Tiny, Small, Large or Giant. Depth works the same way.', 'The discovery-year field supplies the earlier/later direction. Keep the year arrows separate from the exact-match categories when building a shortlist.'),
      section('Why did my Practice win not award XP?', 'Practice is a learning exercise. It does not award normal XP or update normal game statistics, even when you are signed in. Its displayed guess count belongs to that exercise.', 'Use Daily or Infinite for the normal twelve-attempt result and eligible account rewards. For a quest or achievement, also check that the objective tracks the specific kind of game you played.'),
      section('Why are account level and Shark Pass level different?', 'Lifetime account XP and seasonal pass XP are tracked separately. A new pass begins fresh season progress while preserving your account history.', 'Check the pass screen for a current seasonal reward. An old account-level portrait or Shark Pass 1 item is not proof that the same level has been reached in Shark Pass 2.'),
      section('Why did a finished quest or achievement not give its reward?', 'Completing a requirement can make the reward ready without claiming it. Open the relevant screen and use Claim. An unlocked state and a claimed state are deliberately different.', 'Then inspect the right balance or Locker category. A badge unlock is not a pearl award, and achievement points are not a currency to spend in the Pearl Shop.'),
      section('Why did two players receive different amounts?', 'Guess count changes base normal win XP. Applicable XP and pearl multipliers can change the award, and random crates or bottles are separate checks. A screenshot can therefore include more than the ordinary fixed win reward.', 'Compare the base calculation, sign-in state, active boosts and additional claims before assuming a reward is missing. The win-reward table gives every successful normal guess count.'),
      section('Why did a shield not fix the result?', 'A Streak Shield preserves an existing win streak when its supported loss condition applies. The board still ended in a loss, and the shield does not provide another attempt.', 'It does not protect a missed login day, an RNG counter or another mode’s timer. Check which streak you were trying to preserve.'),
      section('Why is an event crate not available?', 'Halloween and Christmas crate availability depends on the eligible event being enabled. The month on your calendar or a local visual theme is not enough to activate the recipe or shop purchase.', 'An old Summer Crate description is also not a current standard crate drop list. The crate guide separates the current pool, seasonal collections and retired collections.'),
      section('Why does Needs Practice not show every unseen species?', 'That view uses tracked species history and the five-win mastery target. A species with no tracked attempts is not the same as a tracked species that has not reached five wins.', 'Clear the filter to browse the full catalogue. Use a review target, a common mix-up or a favourite when you want a smaller study list.'),
      section('Why is the new Daily puzzle available but the login day unchanged?', 'Daily resets at midnight UTC. Daily login uses your local calendar day. Those boundaries can occur hours apart, and daylight saving can change the difference on your clock.', 'The normal win-wheel day also uses the local calendar day. Always identify the feature before deciding that its “daily” reward should have reset.'),
      section('Why can I not redeem an old cosmetic code?', 'UPDATE1 and UPDATE2 are inactive, so their Greenland Shark and Goblin Shark portraits are no longer obtainable through those codes. SORRY is also inactive. TESTER and ANNIVERSARY2026 are historical promotions outside the current redeemable list.', 'Previously earned rewards can remain on a profile without an old code becoming usable again. Active codes are also once per account; repeated submissions do not produce repeated copies of a portrait or another claim of the same XP award.'),
      section('What should I check before reporting missing progress?', 'Confirm the signed-in account, the mode and pool, whether the round finished, and whether a reward needed a separate Claim action. Then allow the profile to finish loading on the device you are checking.', 'If it still looks wrong, report the feature, the visible result and the approximate time. Clearing site data first can remove useful local progress, so it is not the first troubleshooting step.')
    ], ['beginner-guide', 'game-clocks', 'accounts-and-saving', 'win-rewards', 'codes']);
  find('player-faq').facts = [['Covers', 'Gameplay, rewards, claims, timers and account progress'], ['First checks', 'Account, mode, pool, finished result and Claim state'], ['Further help', 'Relevant feature guide and developer report']];

  append('streak-shields',
    table('Where a shield can come from', 'These routes award the same consumable rather than different shield cosmetics.', ['Source', 'Cost / condition', 'What is awarded'], [['Pearl Shop', '250 pearls', '1 shield, if below the cap of 3'], ['Cosmetic Crate 2', 'Epic item result', '1 shield, subject to the holding cap'], ['Daily win wheel', 'Shield prize', 'A shield inventory reward']]),
    section('Example of a protected loss', 'You enter a normal round with a current win streak of seven and one shield. The round ends in a loss. The shield is consumed, the loss still exists in the result history, and the seven-win streak is preserved rather than reset.', 'Now compare a loss when your current win streak is zero. There is no existing streak to preserve, so the same protection condition does not apply. A shield is not a saved extra attempt that can be activated after you see the answer.'),
    section('Purchase checklist', 'Before buying another shield, look at the held count and the activity you intend to play. Three held is the cap. A shield bought for a normal win streak will not fix a missed login day or add a shield mechanic to a different progression mode.', 'If your purpose is a more informative current guess rather than protection from a loss, the category reveal is a different purchase with a different effect. Spend for the effect you need; the shared use of pearls does not make these items interchangeable.'));

  add('pearl-boost', 'Progression', '2x Pearls Boost',
    'A timed Pearl Shop item that doubles eligible normal win pearls for one hour. It costs 500 pearls and additional purchases extend the timer.', [
      section('Effect and timing', 'During the active timer, the normal eligible win pearl award increases from 50 to 100. The added 50 pearls is the benefit of the boost on that win. It does not change the target species, attempts, matching feedback or base win XP.', 'The timer counts elapsed time. If you buy the boost and leave the game for an hour, that hour is not saved as future playing time. When already active, another purchase extends the expiry by one hour from the current expiry rather than increasing the multiplier to 4x.'),
      section('Cost and break-even example', 'The purchase price is 500 pearls. Ten eligible boosted wins earn 500 additional pearls compared with those same ten unboosted wins, recovering the boost’s price through its extra win income. Eleven such wins give 550 extra pearls, which is 50 more than the purchase cost.', 'This is a comparison of the boost’s extra income, not the entire result screen. Ordinary base win pearls, random drops, code rewards and unrelated task claims are separate. A session with fewer than ten boosted eligible wins can still have other rewards, but the boost alone has not recovered its 500-pearl price.'),
      section('What it does not double', 'The boost is a win-pearl multiplier. It is not the season XP boost, does not improve crate rarity or eliminate duplicate outcomes, and should not be assumed to double a fixed Social Rewards task or a code’s listed pearl amount.', 'Practice does not become a reward mode while the timer runs. A protected loss is still a loss rather than a 100-pearl win. The useful question before buying is whether you expect to play eligible winning rounds during that actual hour.'),
      section('Buying and checking it', 'Sign in, open the Pearl Shop and choose 2x Pearls Boost. Check the confirmation and timer before starting a session. An active item can be extended through the same purchase route if you choose to spend another 500 pearls.', 'If a win shows 50 pearls when you expected 100, check whether the timer was still active when the win was awarded and whether it was an eligible normal win. An XP notification or a random crate drop is not a display of the pearl multiplier.')
    ], ['pearls', 'pearl-shop', 'win-rewards', 'game-clocks']);
  find('pearl-boost').facts = [['Item type', 'Timed normal win-pearl boost'], ['Price', '500 pearls'], ['Duration', '1 hour per purchase'], ['Multiplier', '2x eligible win pearls'], ['Normal / boosted award', '50 / 100 pearls'], ['Repeat purchase', 'Extends the timer; does not make 4x pearls']];

  add('shop-cosmetic-crate', 'Progression', 'Cosmetic Crate: Pearl Shop purchase',
    'The 500-pearl shop purchase supplies one standard Cosmetic Crate. Opening it uses the current Cosmetic Crate 2 collection.', [
      section('What the purchase gives you', 'A purchase adds one unopened standard crate to inventory. The reward is not selected at the moment you compare the shop price with a portrait. You must open the crate to roll one reward from the current standard collection.', 'The standard crate currently contains portraits, badges, profile themes and a Streak Shield utility item. Cosmetic Crate 1 is the retired older pool; a newly purchased standard crate is not a choice between both generations.'),
      section('Buying versus earning', 'The fixed shop price is 500 pearls. Eligible normal wins also have a 50% chance of a standard crate drop, and standard crates can appear in other listed rewards such as the win wheel or eligible sharing and referral claims.', 'A random drop route cannot promise a particular next crate, while the shop purchase supplies one immediately after the purchase is confirmed. Decide whether you want to spend pearls for that unopened crate or continue earning opportunities through ordinary play.'),
      section('The reward is still random', 'Buying with pearls does not give different opening odds from another standard crate. The ordinary rarity chances are 58% Common, 28% Rare, 10% Epic and 4% Legendary, before a shared Legendary guarantee applies. The crate guide lists the individual reward chances within each tier.', 'A Legendary result can be a cosmetic you already own. Duplicate portraits, badges and themes award their rarity’s base duplicate XP rather than a new item of your choice. Neither the 500-pearl price nor the guarantee makes the opening a direct purchase of a particular portrait.'),
      section('Using standard crates for crafting', 'When an eligible seasonal event is enabled, two standard crates can be exchanged for one matching seasonal crate. That spends the two unopened crates instead of opening them into two standard rewards.', 'If buying crates expressly for that recipe, two 500-pearl purchases total 1,000 pearls, while an active Event Crate is directly priced at 750. Already-earned crates involve a different decision: compare the two standard openings you give up with the seasonal pool you want. Check the live crafting availability before planning the exchange.')
    ], ['pearl-shop', 'crates', 'shop-event-crate', 'all-cosmetics']);
  find('shop-cosmetic-crate').facts = [['Price', '500 pearls'], ['Quantity', '1 unopened standard crate'], ['Current pool', 'Cosmetic Crate 2'], ['Opening selection', 'One random pool reward'], ['Alternative source', 'Eligible wins and listed crate rewards'], ['Seasonal recipe', '2 standard crates → 1 active seasonal crate']];

  add('shop-event-crate', 'Progression', 'Event Crate: Pearl Shop purchase',
    'A 750-pearl purchase of one eligible active seasonal crate. The event determines which crate you receive; the shop does not offer every seasonal pool at once.', [
      section('What “Event Crate” means', 'The label refers to the currently eligible seasonal crate. In the current seasonal crafting and shop system, Halloween and Christmas are the supported eligible event crates. The button follows the globally enabled event rather than a player-selected cosmetic theme.', 'If no eligible event crate is active, the shop purchase is unavailable. It does not become a standard crate purchase or allow you to select a retired Summer Crate. Calendar month and event availability are separate facts.'),
      section('Price and alternative crafting route', 'The direct shop price is 750 pearls for one unopened event crate. During the same eligible event, the crafting tab can exchange two standard Cosmetic Crates for one matching event crate.', 'That alternative spends two possible standard openings. If both standard crates were purchased for 500 pearls each solely to craft, their combined price would be 1,000 pearls. If you earned them through play, compare which reward pool you prefer rather than pretending earned inventory has no other use.'),
      section('Opening the crate', 'The crate is added to its own inventory count, and opening it rolls from that seasonal collection. A seasonal portrait is not part of the current standard reward pool simply because the standard crate can be used in a recipe.', 'The normal rarity weights and shared Legendary guarantee apply as described in the crate guide. A guaranteed Legendary still chooses a Legendary reward from that crate and can be a duplicate. It is not a promise of the particular seasonal portrait you wanted.'),
      section('After the event changes', 'Previously owned Halloween and Christmas Crates can be opened outside their acquisition event. That is different from buying or crafting new ones: new acquisition depends on the matching event being active.', 'Before spending, inspect the displayed crate name and its drop list. If you wanted a Christmas reward but the active purchase is Halloween, changing your own visual theme is not a recipe selector. Wait for the correct event availability rather than buying a different collection by mistake.')
    ], ['pearl-shop', 'crates', 'shop-cosmetic-crate', 'cosmetic-portraits']);
  find('shop-event-crate').facts = [['Price', '750 pearls'], ['Quantity', '1 active seasonal crate'], ['Current supported event types', 'Halloween and Christmas'], ['Availability', 'Matching eligible event must be enabled'], ['Alternative', 'Craft from 2 standard Cosmetic Crates'], ['Reward choice', 'Random within that seasonal pool']];

  add('message-bottle-pack', 'Progression', 'Message in a Bottle Pack',
    'A 300-pearl Lost Treasures bundle containing ten unopened bottles: five Barnacle, three Red Sea, one Seafoam and one Celestial.', [
      table('Bundle contents', 'These are bottle quantities, not guaranteed new unique cards.', ['Bottle', 'Quantity in pack', 'Draws per bottle', 'Listed draws from that part'], [['Barnacle Bottle', '5', '3', '15'], ['Red Sea Bottle', '3', '5', '15'], ['Seafoam Bottle', '1', '7', '7'], ['Celestial Bottle', '1', '1', '1']]),
      section('What you receive', 'The shop purchase adds the listed bottles to Lost Treasures inventory. Opening the bottles is a separate action. Their listed draw counts total 38 card draws across the complete ten-bottle pack, not 38 automatically missing cards.', 'The mix matters because bottle types have different rare-card rules. The Celestial Bottle is rare-only, while the other types use their own rare chances and caps. Read the bottle reference for the exact rules rather than treating all ten bottles as equivalent.'),
      section('Duplicates and completion progress', 'A card draw can be a duplicate of an entry already in your Lost Treasures collection. Buying the pack does not bypass the collection’s duplicate handling, choose a favourite scroll, or guarantee completion of a nearly finished category.', 'Duplicates have their own value in the exchange system. That provides another route towards bottles, but it still does not mean that every purchased draw is a new unlock. The useful comparison is the whole bundle of bottle opportunities against the other uses of your pearls.'),
      section('Who the pack is useful for', 'The pack is a direct way to add bottle inventory when Lost Treasures is the collection you are actively pursuing. If your immediate goal is a profile portrait from a Cosmetic Crate, this is a different collection path rather than a cheaper version of that crate.', 'At 300 pearls, the pack costs six base eligible normal win awards of 50 pearls, ignoring other income and boosts. It can also be bought with pearls earned elsewhere. The price comparison does not promise how many wins will supply a random bottle drop along the way.'),
      section('Buying and opening', 'Sign in, buy Message in a Bottle Pack from the Pearl Shop and check the Lost Treasures bottle counts after confirmation. Open the bottle type you want to use; the card results then update the collection through its normal rules.', 'The grand collection rewards depend on completing and claiming the full Lost Treasures objective. Owning the unopened pack is not itself the grand reward, and completing one scroll is not the same as completing every scroll.')
    ], ['pearls', 'pearl-shop', 'lost-treasures-bottles', 'lost-treasures-scrolls', 'lost-treasures-rewards']);
  find('message-bottle-pack').facts = [['Price', '300 pearls'], ['Bottles', '10 total'], ['Barnacle / Red Sea', '5 / 3'], ['Seafoam / Celestial', '1 / 1'], ['Listed total draws', '38 when all bottles are opened'], ['Guaranteed unique cards', 'No']];

  add('season-xp-boost', 'Progression', 'Season 2x XP',
    'The 3,000-pearl XP boost attached to the current Shark Pass season. It multiplies eligible normal XP awards and is separate from the timed pearl boost.', [
      section('What the boost changes', 'Eligible rewards that use the normal XP multiplier path receive a 2x season multiplier while the boost is owned for that season. A 130-base-XP normal win can therefore award 260 XP through that path.', 'This changes eligible XP awards, not the number of attempts, the target species, a crate’s rarity weights or the price of a shop item. It should not be read as a promise to double every counter and currency in every mode.'),
      section('Combining with an XP event', 'The season XP multiplier combines multiplicatively with an applicable global XP event. A 2x event together with the owned 2x season boost gives a total multiplier of 4x on eligible XP using that reward path. For a 130-base-XP award, that is 520 XP.', 'A 2x Pearls Boost is separate and does not supply that XP multiplier. It doubles eligible win pearls during its one-hour timer. An account can therefore have a boosted pearl award, boosted XP, both or neither, depending on which effects apply.'),
      section('Season ownership and progression', 'The purchase costs 3,000 pearls and is owned once for the current season. Buying it again for that same season is unavailable rather than stacking an additional XP multiplier. It is not sold as permanent ownership of a boost for every future pass.', 'Account XP and season XP remain different totals. An eligible reward can contribute through its reward path to both normal profile progress and the active pass, but the boost does not convert old lifetime account XP into newly earned season XP.'),
      section('Choosing when to buy', 'Consider the season you are playing, how much eligible XP you still want to earn and the other purchases you value. A player aiming for a late pass reward may value the boost differently from a player who mainly wants a fixed bottle bundle or a specific shop utility effect.', 'Check the current pass, the shop’s Owned state and the reward confirmation. The configured pass dates describe the track; do not interpret an old season’s boost name as proof of permanent benefits in a new season.')
    ], ['shark-pass', 'account-progression', 'pass-quests', 'pearl-shop', 'win-rewards']);
  find('season-xp-boost').facts = [['Price', '3,000 pearls'], ['Effect', '2x eligible normal XP awards'], ['Ownership', 'Once for the current season'], ['Duration category', 'Season-associated; not the one-hour pearl timer'], ['With a 2x XP event', '4x total eligible XP multiplier'], ['Does not affect', 'Pearl income or crate rarity odds']];

  const achievementId = id => 'achievement-' + id.replace(/_/g, '-');
  const achievementGroupNames = { special: 'Special', wins: 'Wins', games: 'Games', streaks: 'Streaks', efficiency: 'Efficiency', duels: 'Duels', worldmap: 'World Map', milestones: 'Social' };
  const achievementRarity = item => item.rarity || (item.points >= 500 ? 'mythic' : item.points >= 300 ? 'legendary' : item.points >= 150 ? 'epic' : item.points >= 50 ? 'rare' : 'common');
  const specialAchievements = {
    speed_win: {
      condition: 'Win a supported normal guessing round in exactly 2 guesses.',
      approach: ['Lightning Fast is about the number of guesses, not a stopwatch. A two-guess solve meets the named condition; simply entering two wrong guesses does not.', 'Use the first feedback card to choose a plausible second species. The first guess still has to reveal useful information, and a two-guess solve depends on the actual target and candidates. Do not confuse a quick click with a well-supported answer.'],
      note: 'A one-guess win is the separate One-Shot Oracle condition. A slower successful round still awards its normal result even if it does not unlock Lightning Fast.',
      links: ['guessing-strategy', 'achievement-perfect-win', 'win-rewards']
    },
    comeback_win: {
      condition: 'Win a supported normal guessing round on guess 11, with 1 of the 12 attempts remaining.',
      approach: ['Comeback King checks an eleventh-guess win. Its “only 1 guess left” wording refers to the attempt still remaining after that successful guess. A twelfth-guess win is a different result and does not meet this particular check.', 'If you are late in a round, keep all confirmed clues together and compare the final candidates carefully. Deliberately throwing away ten useful attempts is not a reliable way to make the correct name appear on guess eleven.'],
      note: 'A shield is not another guess and does not change the successful guess count. The achievement concerns a win, not a protected loss.',
      links: ['how-guessing-works', 'worked-guessing-examples', 'streak-shields']
    },
    secret_command_found: {
      condition: 'Discover the hidden Shark Rescue Command page.',
      approach: ['Depths Discovered is a discovery achievement rather than a normal guessing milestone. Open Shark Rescue Command through its discovery route, then check the Special achievement category for the ready reward.', 'The reward includes Pearl Reef, a profile theme. Unlocking or equipping that theme does not add rescue production or normal pearls: the sea-themed name describes the appearance, while Rescue Command has its own economy.'],
      note: 'Discovering the page is separate from making a rescue prestige or finishing its missions. Those activities have their own achievements.',
      links: ['rescue-command', 'cosmetic-themes', 'achievement-secret-prestige-1']
    },
    crate_opened: {
      condition: 'Open a standard Cosmetic Crate.',
      approach: ['First Unboxing requires an opening. Buying, earning or holding a standard crate is not the same action. Use Crates to open the crate and receive its one reward.', 'A duplicate is still a crate result rather than evidence that the opening did not happen. Read the normal duplicate-XP rule separately from this opening milestone.'],
      note: 'The current standard crate opens Cosmetic Crate 2. The First Unboxing achievement does not choose a particular rarity or cosmetic.',
      links: ['crates', 'shop-cosmetic-crate', 'achievement-crate-collector-10']
    },
    summer_crate_opened: {
      condition: 'Historically: open a Summer Crate.',
      approach: ['First Summer Unboxing belongs to the Summer Crate opening route. Summer Crates are retired in the current edition, so this is recorded as a historical achievement rather than a promised current acquisition route.', 'A standard crate does not count as a Summer opening because its artwork or reward happens to feel summery. The retired Summer collection and the current standard pool are separate reward lists.'],
      note: 'An old code description or an owned Summer cosmetic is not proof that a new Summer Crate can currently be obtained and opened.',
      links: ['crates', 'codes', 'achievement-crate-opened'], availability: 'Historical Summer Crate route'
    },
    halloween_crate_opened: {
      condition: 'Open a Halloween Crate.',
      approach: ['First Halloween Unboxing concerns that specific seasonal crate. Obtain an eligible Halloween Crate during its acquisition event, or open one already retained in your inventory.', 'A global event controls new shop and crafting availability. An owned Halloween Crate can still be opened outside the acquisition event, while changing your local visual theme does not create a new crate.'],
      note: 'A Pumpkin or other Halloween-themed name elsewhere is not an alternative trigger. The relevant action is opening the Halloween Crate.',
      links: ['crates', 'shop-event-crate', 'achievement-christmas-crate-opened']
    },
    christmas_crate_opened: {
      condition: 'Open a Christmas Crate.',
      approach: ['First Christmas Unboxing is the Christmas collection’s opening achievement. The event shop or crafting recipe only supplies new crates while the matching eligible event is enabled.', 'Previously retained Christmas Crates can be opened outside the acquisition event. Inspect your inventory rather than assuming the calendar month alone enables a new purchase or recipe.'],
      note: 'The achievement does not require rolling Santa or North Pole specifically. Any result from the eligible Christmas opening is a crate outcome.',
      links: ['crates', 'shop-event-crate', 'achievement-halloween-crate-opened']
    },
    secret_prestige_1: {
      condition: 'Prestige once in Shark Rescue Command.',
      approach: ['First Renown belongs to Rescue Command’s prestige system. Reach that mode’s prestige requirements, inspect the reset and permanent gain, and complete the prestige when you are ready.', 'A SharkRNG prestige is a different system and does not replace a Rescue Command prestige. Similar words across modes describe different resources and resets.'],
      note: 'This achievement is hidden until the secret activity is discovered. Discovery and prestige are separate accomplishments.',
      links: ['rescue-command', 'achievement-secret-command-found', 'achievement-secret-missions-25']
    },
    secret_missions_25: {
      condition: 'Complete 25 missions in Shark Rescue Command.',
      approach: ['Command Veteran measures completed rescue missions. A mission sitting on the board, a reroll, or an ordinary guessing win is not a completed rescue mission.', 'Use objectives that fit the current rescue run and inspect their completion progress. Building steady production and choosing relevant purchases can help with the board’s requirements more reliably than repeatedly replacing missions without finishing them.'],
      note: 'This is a rescue-mode statistic, not a count of Shark Pass quests. The achievement is hidden until the secret activity is discovered.',
      links: ['rescue-command', 'achievement-secret-prestige-1', 'pass-quests']
    },
    secret_apex_cells_10: {
      condition: 'Reach a held balance of 10 Apex Cells in Shark Rescue Command when the achievement is checked.',
      approach: ['Cell Splitter is listed as earning ten Apex Cells, but the current achievement check reads the held Apex Cell balance. Reaching ten held before spending is therefore the relevant state to check.', 'Apex Cells are a rescue prestige resource. They are separate from normal pearls, SharkRNG prestige points and an RNG tier that happens to have an Apex-related name. Use the Rescue Command guide for its gain and spending rules.'],
      note: 'A lifetime sum of cells earned and immediately spent is not the same as holding ten. This achievement is hidden until the secret activity is discovered.',
      links: ['rescue-command', 'achievement-secret-prestige-1', 'achievement-secret-command-found']
    },
    streak_shield_used: {
      condition: 'Lose a supported normal game while a Streak Shield protects an existing win streak.',
      approach: ['Saviour is triggered by actual shield use, not by purchasing or merely holding a shield. There must be an existing win streak to protect and an available shield when the supported loss happens.', 'The shield preserves the streak automatically. The round remains a loss, and the held count falls by one. The achievement recognises the protection event rather than changing that result into a successful solve.'],
      note: 'A missed login day is not a normal game loss, and a shield does not protect the login cycle. This condition is also distinct from losing an unprotected streak for Arrow to the Knee.',
      links: ['streak-shields', 'pearl-shop', 'cosmetic-badges']
    },
    crate_collector_10: {
      condition: 'Reach 10 tracked cosmetic crate openings.',
      approach: ['Crate Collector uses the opening count. Ten unopened crates in inventory, ten purchased crates or ten owned portraits do not establish ten openings.', 'It is an early milestone on the same tracked opening progression as Vault Breaker. Open crates for their actual collection rewards rather than expecting the tenth opening to be a special guaranteed rarity from this achievement.'],
      note: 'Claiming awards the Crate Connoisseur badge. That badge is an achievement reward, not an extra item inserted into the tenth crate’s random roll.',
      links: ['crates', 'achievement-crate-collector-50', 'cosmetic-badges']
    },
    crate_collector_50: {
      condition: 'Reach 50 tracked cosmetic crate openings.',
      approach: ['Vault Breaker extends the opening milestone beyond the ten-opening Crate Collector achievement. It counts the tracked openings rather than the number of unique cosmetics obtained, so duplicate results still belong to the opening history.', 'Neon Reef is also in Cosmetic Crate 2 as an Epic theme reward. The fifty-opening achievement is a separate named unlock route: it does not make opening number fifty itself an Epic or guarantee that its random prize is new.'],
      note: 'If you already own Neon Reef, claiming this achievement does not create another independently equippable copy of the same theme.',
      links: ['crates', 'achievement-crate-collector-10', 'cosmetic-themes']
    }
  };
  for (const item of achievementDetails) {
    const id = achievementId(item.id);
    const peers = achievementDetails.filter(peer => peer.group === item.group);
    const index = peers.findIndex(peer => peer.id === item.id);
    const previous = peers[index - 1];
    const next = peers[index + 1];
    let condition = item.description + '.';
    let approach = [];
    let note = '';
    let links = [];
    const cosmetic = [item.badgeRewardName && item.badgeRewardName + ' badge', item.themeRewardName && item.themeRewardName + ' profile theme', item.cosmetic && item.cosmetic.name + ' portrait'].filter(Boolean).join(' and ');
    if (specialAchievements[item.id]) {
      ({ condition, approach, note, links } = specialAchievements[item.id]);
    } else if (item.group === 'wins') {
      condition = `Reach ${item.milestone.toLocaleString('en-GB')} recorded normal win${item.milestone === 1 ? '' : 's'}.`;
      approach = [
        `${item.name} is a cumulative win milestone. The ${item.milestone.toLocaleString('en-GB')} wins do not have to form one unbroken streak. A loss can affect a streak without erasing the normal wins already recorded for this total.`,
        previous ? `The preceding win milestone is ${previous.name} at ${previous.milestone.toLocaleString('en-GB')}. Moving from that threshold to this one adds ${(item.milestone - previous.milestone).toLocaleString('en-GB')} more recorded wins. Use eligible Daily or Infinite results; Practice exercises do not provide normal wins.` : 'This is the first normal win milestone. Finish a supported guessing round successfully while playing for account progress, then inspect the Wins category for its ready claim.'
      ];
      note = next ? `The next win milestone is ${next.name} at ${next.milestone.toLocaleString('en-GB')} wins. Claiming this achievement does not spend or reset your win total.` : 'This is the highest listed win-count milestone in this edition. Its reward does not reset your accumulated win history.';
      links = ['daily-mode', 'infinite-mode', 'win-rewards'];
    } else if (item.group === 'games') {
      condition = `Complete ${item.milestone.toLocaleString('en-GB')} recorded normal games.`;
      approach = [
        `${item.name} concerns games played rather than only successful solves. Completed normal wins and losses contribute to that statistic, while opening a page or changing a pool is not itself a completed result.`,
        previous ? `The previous listed game-count milestone is ${previous.name} at ${previous.milestone.toLocaleString('en-GB')} games. This target is ${(item.milestone - previous.milestone).toLocaleString('en-GB')} completed games beyond that threshold. Check the profile’s Games Played value rather than the win total.` : 'This is the first listed games-played milestone. A sequence of finished Daily and Infinite rounds is the relevant kind of progress. Practice is intentionally excluded from normal game statistics.'
      ];
      note = next ? `The next listed target is ${next.name} at ${next.milestone.toLocaleString('en-GB')} games. Game-count progress is separate from friend-duel counters and SharkRNG rolls.` : 'This is the highest listed games-played milestone in this edition. Marathon Fin is its cosmetic badge reward, not a required portrait to equip before playing.';
      links = ['infinite-mode', 'practice-mode', 'accounts-and-saving'];
    } else if (item.group === 'streaks') {
      condition = `Reach a current normal win streak of ${item.milestone.toLocaleString('en-GB')}.`;
      approach = [
        `${item.name} checks the consecutive normal win streak, not the lifetime win count or a login-day streak. ${item.milestone.toLocaleString('en-GB')} wins spread across several broken streaks are not the same condition.`,
        previous ? `The preceding streak milestone is ${previous.name} at ${previous.milestone.toLocaleString('en-GB')}. From that point, ${(item.milestone - previous.milestone).toLocaleString('en-GB')} additional wins on the maintained streak reach this threshold. Continue reading each new board’s clues rather than carrying assumptions from an earlier target.` : 'A first supported normal win begins a win streak. Start with a sound solve rather than treating the flame icon as a separate game mode. The achievement can become ready alongside an initial win-count milestone.'
      ];
      note = 'A Streak Shield can preserve an existing streak on a supported loss, but it does not add another win. An achievement already unlocked is a separate stored accomplishment from the current streak shown on a later round.';
      links = ['streak-shields', 'guessing-strategy', 'game-clocks'];
    } else if (item.group === 'milestones') {
      condition = `Have ${item.milestone} accepted friend${item.milestone === 1 ? '' : 's'} for the friend-count milestone.`;
      approach = [
        `${item.name} uses the accepted friend count. Pending outgoing requests and people who have merely received your shared code are not the same as established friends.`,
        previous ? `The earlier social milestone is ${previous.name} at ${previous.milestone} friends. This target is ${item.milestone - previous.milestone} accepted connections beyond that threshold. Connect with players who want the request, and check the actual list rather than counting messages sent.` : 'Exchange a friend code with another player, send the request and let them accept it. Check the Social achievement category after the accepted connection is visible.'
      ];
      note = 'Referral crates use their own eligible pair claims. An achievement point award is not the same as a referral crate, and removing and re-adding a pair is not a repeatable unique-referral farm.';
      links = ['friends', 'share-and-referrals', 'duels'];
    } else if (item.group === 'worldmap') {
      condition = `Complete the ${item.region.name} chapter / World Map challenge.`;
      approach = [
        `This is the achievement for ${item.region.label}. Work through the chapter’s three species dossiers, complete each species’ three tasks and finish its boss mission, ${item.region.boss}.`,
        `The chapter’s featured species are ${item.region.sharks.join(', ')}. Open each dossier and clear First Sighting, Crossing Currents and Final Verdict by answering its Yes/No sighting questions. Once all nine species missions are complete, clear the boss phases and select Resolve the breach to finish the chapter.`
      ];
      note = 'The achievement collection uses World Map wording for these story-region completions. The chapter’s completion state and the separate achievement Claim action are different steps.';
      links = ['story-overview', 'achievements'];
    } else if (item.group === 'duels') {
      const isWin = item.id.includes('won') || item.id.includes('wins');
      const count = item.milestone || 1;
      condition = isWin ? `Win ${count} completed friend duel${count === 1 ? '' : 's'}.` : `Finish ${count} friend duel${count === 1 ? '' : 's'}.`;
      approach = [
        isWin ? `This target uses the dedicated friend-duel win count. Solve the shared shark when your opponent does not, or use fewer guesses when both players solve. The same successful guess count is a draw rather than a duel win.` : 'This target uses completed friend-duel games. Sending or accepting a challenge starts the process, but the shared result is finalised after both participants finish their runs.',
        `${item.name} belongs to the Duels category. Ordinary Daily or Infinite wins, a pending challenge and unrelated RNG progress are not substitutes for the dedicated duel result. Use the friend list to return to the live board and wait for the other player if your run is already locked.`
      ];
      note = isWin ? 'A draw may be a completed duel, but it does not add the required duel win. Check the final result rather than assuming that solving first means winning.' : 'Both players use the same shark with separate twelve-attempt boards. Finishing a normal Daily puzzle alongside a friend is a different activity from a friend duel.';
      links = ['duels', 'friends'];
    } else if (item.id === 'perfect_win') {
      condition = 'Win a supported normal guessing round on the first guess.';
      approach = ['One-Shot Oracle requires the exact answer as the first valid guess of the round. A later guess that matches every field is still a later guess; it does not become a first-guess result.', 'A first-guess solve depends on the chosen target and your opener. There is no clue-reading sequence before the first guess that can guarantee it. Keep playing useful normal rounds rather than interpreting the achievement as a promise that one opener always works.'];
      note = 'The One-Shot Oracle badge is awarded through this achievement’s claim, not as a crate rarity. A Practice exercise does not supply the normal achievement result.';
      links = ['guessing-strategy', 'achievement-speed-win', 'cosmetic-badges'];
    } else {
      const target = item.id === 'avg_guesses_low' ? 4 : 3;
      condition = `Have at least 1 recorded win and a stored total-guesses-to-wins ratio of ${target} or lower.`;
      approach = [
        `${item.name} is an average-efficiency check, not a demand that every individual round uses ${target} guesses. The calculation divides the stored total guesses by recorded wins. For example, 6 wins with a stored total of ${target * 6} guesses give a ratio of exactly ${target}.`,
        'Use the achievement’s denominator when comparing progress. A profile display averaged across all games can differ from this wins-based check. Improving the result means accumulating efficient supported wins and understanding which recorded statistic you are viewing, rather than buying a cosmetic rarity.'
      ];
      note = item.id === 'guess_master' ? 'Guess Master awards Deep Abyss when claimed. The theme is cosmetic; equipping it does not lower the next round’s guess count.' : 'Sharp Mind has no named cosmetic reward in the achievement definition. The tighter three-or-fewer target is the separate Guess Master achievement.';
      links = ['guessing-strategy', 'worked-guessing-examples', item.id === 'guess_master' ? 'achievement-avg-guesses-low' : 'achievement-guess-master'];
    }
    const name = item.name;
    const group = achievementGroupNames[item.group];
    const rarity = achievementRarity(item);
    const pageSections = [
      section('Unlock requirement', condition, `${name} is in the ${group} category. Reaching its condition makes it an unlocked achievement; using Claim is the separate step that awards its listed score and reward.`),
      section(item.group === 'worldmap' ? 'Completing the chapter' : 'How to work towards it', ...approach),
      section('Claim and rewards', `The listed award is ${item.points.toLocaleString('en-GB')} achievement points. The current claim also grants ${item.points.toLocaleString('en-GB')} base normal XP through the achievement reward path; an applicable XP multiplier can increase the XP without changing the achievement’s point value.`, cosmetic ? `The named cosmetic reward is ${cosmetic}. It becomes an owned Locker option after the claim; equipping it is a separate choice.` : 'No additional named cosmetic is listed for this achievement. The absence of a badge or theme entry does not mean that a random crate reward is being withheld.'),
      section('Notes', note)
    ];
    if (item.milestone && ['wins', 'games', 'streaks', 'milestones', 'duels'].includes(item.group)) {
      const neighbours = peers.slice(Math.max(0, index - 1), Math.min(peers.length, index + 2));
      pageSections.push(table('Nearby milestones', 'These achievements belong to the same category. Each has its own unlock and claim.', ['Achievement', 'Requirement', 'Points'], neighbours.map(peer => [{ text: peer.name, article: achievementId(peer.id) }, peer.description, String(peer.points)])));
    }
    add(id, 'Achievements', name + ' (achievement)', `${condition} ${cosmetic ? 'Claiming also unlocks ' + cosmetic + '.' : 'A ' + item.points + '-point achievement in the ' + group + ' category.'}`, pageSections, ['achievements', 'achievement-catalogue', ...links, ...(item.badgeRewardName ? ['cosmetic-badges'] : []), ...(item.themeRewardName ? ['cosmetic-themes'] : [])], 'Achievements/index.html', false);
    const entry = find(id);
    entry.kind = 'reference';
    entry.shortTitle = name;
    entry.facts = [['Type', 'Achievement'], ['Category', group], ['Rarity', rarity[0].toUpperCase() + rarity.slice(1)], ['Requirement', condition], ['Achievement points', String(item.points)], ['Base claim XP', String(item.points)], ['Named cosmetic', cosmetic || 'None listed'], ['Claim required', 'Yes'], ...(specialAchievements[item.id]?.availability ? [['Availability', specialAchievements[item.id].availability]] : [])];
  }
  const achievementByName = new Map(achievementDetails.map(item => [item.name, item]));
  for (const group of find('achievement-catalogue').sections) if (group.table) {
    for (const row of group.table.rows) {
      const item = achievementByName.get(row[0]);
      if (item) row[0] = { text: item.name, article: achievementId(item.id) };
    }
  }

  // The expanded explanation replaces the short introduction-era article.
  const replaced = new Set(entries.map(entry => entry.id));
  window.SHARKDLE_WIKI.entries = window.SHARKDLE_WIKI.entries.filter(entry => !replaced.has(entry.id));
  window.SHARKDLE_WIKI.entries.push(...entries);
})();
