const FRIENDS_COLLECTION = 'friendNetwork';
const FRIEND_CODES_COLLECTION = 'friendCodes';
let friendDocumentUnsubscribe = null;
let activeDuelsCache = [];
let currentOpenDuelId = null;
let duelSharkOptionsReady = false;
let duelSharkOptionNames = [];
let duelSuggestionIndex = -1;
let duelVisibleSuggestions = [];
const PROCESSED_DUELS_KEY = 'processedFriendDuels';

const duelSizeThresholds = {
    Tiny: '0-3ft',
    Small: '3-6ft',
    Medium: '6-10ft',
    Large: '10-20ft',
    Giant: '20ft+'
};

function getFriendDocumentRef(uid) {
    if (!db || !uid) return null;
    return db.collection(FRIENDS_COLLECTION).doc(uid);
}

function normalizeDuelsList(value) {
    return Array.isArray(value) ? value : [];
}

function upsertDuelRecord(duels, duel) {
    const list = normalizeDuelsList(duels).filter(entry => entry?.id !== duel.id);
    list.push(duel);
    return list;
}

function removeDuelRecord(duels, duelId) {
    return normalizeDuelsList(duels).filter(entry => entry?.id !== duelId);
}

async function getFriendNetworkData(uid) {
    const ref = getFriendDocumentRef(uid);
    if (!ref) return { friends: [], friendRequests: [], duels: [] };
    const doc = await ref.get();
    if (!doc.exists) return { friends: [], friendRequests: [], duels: [] };
    const data = doc.data() || {};
    return {
        friends: Array.isArray(data.friends) ? data.friends : [],
        friendRequests: Array.isArray(data.friendRequests) ? data.friendRequests : [],
        duels: normalizeDuelsList(data.duels)
    };
}

async function saveDuelForParticipants(duel) {
    const participants = duel.participants || [];
    await Promise.all(participants.map(async uid => {
        const ref = getFriendDocumentRef(uid);
        if (!ref) return;
        const data = await getFriendNetworkData(uid);
        const nextDuels = upsertDuelRecord(data.duels, duel);
        await ref.set({ duels: nextDuels }, { merge: true });
    }));
}

function getFriendCodeDocumentRef(code) {
    if (!db || !code) return null;
    return db.collection(FRIEND_CODES_COLLECTION).doc(code);
}

async function ensureFriendDocument(uid) {
    if (!db || !uid) return { friends: [], friendRequests: [] };
    const ref = getFriendDocumentRef(uid);
    const doc = await ref.get();
    if (!doc.exists) {
        await ref.set({ friends: [], friendRequests: [] }, { merge: true });
        return { friends: [], friendRequests: [] };
    }
    return doc.data() || { friends: [], friendRequests: [] };
}

async function ensureFriendCodeDocument(uid) {
    if (!db || !uid) return null;
    const code = generateFriendCode(uid);
    const ref = getFriendCodeDocumentRef(code);
    const doc = await ref.get();
    if (!doc.exists) {
        await ref.set({ uid }, { merge: true });
    } else if (doc.data().uid !== uid) {
        console.warn(`Friend code collision: ${code} already assigned to ${doc.data().uid}`);
    }
    return ref;
}

async function resolveUidFromFriendCode(code) {
    if (!db || !code) return null;
    const ref = getFriendCodeDocumentRef(code);
    const doc = await ref.get();
    return doc.exists ? doc.data().uid : null;
}

window.openFriendsTab = async function() {
    if (!currentUser) {
        openLoginModal();
        return;
        if (duelsList) duelsList.innerHTML = '<li class="empty-state"><div class="empty-icon">🔒</div><div class="empty-text">Login to see duels</div></li>';
        if (duelsList) duelsList.innerHTML = '<li class="empty-state"><div class="empty-icon">🔒</div><div class="empty-text">Login to see duels</div></li>';
        return;
    }
    await openProfileModal();
    showProfileTab('friends');
};

async function populateFriendsTab() {
    const uidSpan = document.getElementById('user-uid');
    const codeSpan = document.getElementById('user-friend-code');
    const friendsCountEl = document.getElementById('friends-count');
    const requestsCountEl = document.getElementById('requests-count');
    const duelsCountEl = document.getElementById('duels-count');
    const friendsCardCountEl = document.getElementById('friends-card-count');
    const requestsCardCountEl = document.getElementById('requests-card-count');
    const duelsCardCountEl = document.getElementById('duels-card-count');

    if (!currentUser) {
        if (uidSpan) uidSpan.textContent = '(login required)';
        if (codeSpan) codeSpan.textContent = '(login required)';
        if (friendsCountEl) friendsCountEl.textContent = '0';
        if (requestsCountEl) requestsCountEl.textContent = '0';
        if (duelsCountEl) duelsCountEl.textContent = '0';
        if (friendsCardCountEl) friendsCardCountEl.textContent = '0';
        if (requestsCardCountEl) requestsCardCountEl.textContent = '0';
        if (duelsCardCountEl) duelsCardCountEl.textContent = '0';
        const friendsList = document.getElementById('friends-list');
        const requestsList = document.getElementById('requests-list');
        const duelsList = document.getElementById('duels-list');
        if (duelsList) duelsList.innerHTML = '<li class="empty-state"><div class="empty-icon">🔒</div><div class="empty-text">Login to see duels</div></li>';
        if (friendsList) friendsList.innerHTML = '<li class="empty-state"><div class="empty-icon">🔒</div><div class="empty-text">Login to see friends</div></li>';
        if (requestsList) requestsList.innerHTML = '<li class="empty-state"><div class="empty-icon">🔒</div><div class="empty-text">Login to see requests</div></li>';
        return;
    }

    if (uidSpan) uidSpan.textContent = currentUser.uid;
    if (codeSpan) codeSpan.textContent = generateFriendCode(currentUser.uid);

    await Promise.all([
        ensureFriendDocument(currentUser.uid),
        ensureFriendCodeDocument(currentUser.uid)
    ]);

    const data = await getFriendNetworkData(currentUser.uid);
    const friends = Array.isArray(data.friends) ? data.friends : [];
    const requests = Array.isArray(data.friendRequests) ? data.friendRequests : [];
    activeDuelsCache = normalizeDuelsList(data.duels);
    await reconcileCompletedDuelStats(activeDuelsCache);

    // Update counts
    if (friendsCountEl) friendsCountEl.textContent = friends.length;
    if (requestsCountEl) requestsCountEl.textContent = requests.length;
    if (duelsCountEl) duelsCountEl.textContent = activeDuelsCache.length;
    if (friendsCardCountEl) friendsCardCountEl.textContent = friends.length;
    if (requestsCardCountEl) requestsCardCountEl.textContent = requests.length;
    if (duelsCardCountEl) duelsCardCountEl.textContent = activeDuelsCache.length;

    ensureDuelSharkOptions();
    await renderFriendsList(friends);
    await renderDuelsList(activeDuelsCache);
    await renderRequestsList(requests);
}

async function getUsernameForUid(uid) {
    if (!db || !uid) return uid;
    try {
        const doc = await db.collection('userStats').doc(uid).get();
        if (!doc.exists) return uid;
        const data = doc.data() || {};
        return data.username || uid;
    } catch (error) {
        console.warn('Unable to resolve username for', uid, error);
        return uid;
    }
}

async function getUserProfileForUid(uid) {
    if (!db || !uid) return null;
    try {
        const doc = await db.collection('userStats').doc(uid).get();
        if (!doc.exists) return null;
        return doc.data() || {};
    } catch (error) {
        console.warn('Unable to fetch profile for', uid, error);
        return null;
    }
}

function normalizeSharkInput(input) {
    return String(input || '').replace(/\s+/g, '').toLowerCase();
}

function getDuelPlayerState(duelData, uid) {
    return duelData?.players?.[uid] || {
        accepted: false,
        guesses: [],
        attemptsLeft: 12,
        completed: false,
        won: false
    };
}

function getFriendPresence(profile) {
    const lastActive = profile?.lastActive;
    const millis = typeof lastActive?.toMillis === 'function'
        ? lastActive.toMillis()
        : typeof lastActive === 'number'
            ? lastActive
            : null;
    const isOnline = millis ? (Date.now() - millis) < 5 * 60 * 1000 : false;
    return {
        isOnline,
        label: isOnline ? 'Online' : 'Offline'
    };
}

async function updatePresenceHeartbeat() {
    if (!db || !currentUser) return;
    try {
        await db.collection('userStats').doc(currentUser.uid).set({
            lastActive: Date.now()
        }, { merge: true });
    } catch (error) {
        console.warn('Presence heartbeat failed:', error);
    }
}

function getProcessedDuels() {
    try {
        return JSON.parse(localStorage.getItem(PROCESSED_DUELS_KEY) || '[]');
    } catch (error) {
        return [];
    }
}

function setProcessedDuels(duelIds) {
    localStorage.setItem(PROCESSED_DUELS_KEY, JSON.stringify(duelIds));
}

async function reconcileCompletedDuelStats(duels) {
    if (!currentUser) return;
    const processed = getProcessedDuels();
    const completed = normalizeDuelsList(duels).filter(duel => duel?.status === 'completed' && duel?.id && !processed.includes(duel.id));
    if (!completed.length) return;

    let profileData = JSON.parse(localStorage.getItem('userProfile') || '{}');
    let changed = false;

    completed.forEach(duel => {
        profileData.duelGames = (profileData.duelGames || 0) + 1;
        const result = getLocalizedDuelResult(duel);
        if (result.startsWith('You won')) {
            profileData.duelWins = (profileData.duelWins || 0) + 1;
            unlockDuelAchievement('duel_won');
        }
        unlockDuelAchievement('duel_played');
        processed.push(duel.id);
        changed = true;
    });

    if (changed) {
        localStorage.setItem('userProfile', JSON.stringify(profileData));
        setProcessedDuels(processed);
        if (typeof syncStatsToFirebase === 'function') {
            syncStatsToFirebase().catch(error => console.warn('Duel stat sync failed:', error));
        }
    }
}

function unlockDuelAchievement(achievementId) {
    if (window.unlockAchievement) {
        window.unlockAchievement(achievementId);
        return;
    }
    const unlocked = JSON.parse(localStorage.getItem('unlockedAchievements') || '[]');
    if (!unlocked.includes(achievementId)) {
        unlocked.push(achievementId);
        localStorage.setItem('unlockedAchievements', JSON.stringify(unlocked));
        syncUnlockedAchievementToFirebase(achievementId, unlocked);
    }
}

function getDuelOpponentUid(duelData, uid) {
    return (duelData?.participants || []).find(participant => participant !== uid) || null;
}

function formatDuelStatus(status) {
    switch (status) {
        case 'pending':
            return 'Pending';
        case 'active':
            return 'Active';
        case 'completed':
            return 'Completed';
        case 'declined':
            return 'Declined';
        default:
            return 'Unknown';
    }
}

async function persistCrateProfileUpdate(profileData) {
    profileData.lastUpdated = Date.now();
    saveUserProfileLocally(profileData, { skipRemoteSync: true });

    if (!currentUser || !db) return;
    await db.collection("userStats").doc(currentUser.uid).set({
        crateInventory: normalizeCrateInventory(profileData.crateInventory),
        cratesOpened: Math.max(0, Number(profileData.cratesOpened) || 0),
        cratesSinceLegendary: getCratesSinceLegendary(profileData),
        streakShields: getStreakShieldCount(profileData),
        instantCrateOpen: getCrateInstantOpenEnabled(profileData),
        pearls: getPearlCount(profileData),
        pearlBoostExpiresAt: getPearlBoostExpiresAt(profileData),
        seasonXpBoosts: getSeasonXpBoosts(profileData),
        totalXP: Math.max(0, Number(profileData.totalXP) || 0),
        earnedCosmetics: Array.isArray(profileData.earnedCosmetics) ? profileData.earnedCosmetics : [],
        unlockedBadges: Array.isArray(profileData.unlockedBadges) ? profileData.unlockedBadges : ["starter"],
        unlockedCardThemes: Array.isArray(profileData.unlockedCardThemes) ? profileData.unlockedCardThemes : ["default"],
        lastUpdated: profileData.lastUpdated,
        ...buildCosmeticSyncPayload(profileData)
    }, { merge: true });
}

const SUMMER_CRATE_CRAFT_COST = 2;
let summerCrateCraftingInProgress = false;

function shouldShowSummerCratePanel(profileData = getCurrentProfileData()) {
    const body = document.body;
    if (body?.classList.contains("global-ui-theme-summer")) return true;
    return getCrateInventory(profileData).summer > 0;
}

function shouldShowSeasonalCratePanel(crateId, profileData = getCurrentProfileData()) {
    const body = document.body;
    if (body?.classList.contains(`global-ui-theme-${crateId}`)) return true;
    return (getCrateInventory(profileData)[crateId] || 0) > 0;
}

function updateSeasonalCratePanels(profileData = getCurrentProfileData()) {
    const summerPanel = document.getElementById("summer-crate-panel");
    if (summerPanel) {
        summerPanel.style.display = shouldShowSummerCratePanel(profileData) ? "" : "none";
    }

    const christmasPanel = document.getElementById("christmas-crate-panel");
    if (christmasPanel) {
        christmasPanel.style.display = shouldShowSeasonalCratePanel("christmas", profileData) ? "" : "none";
    }

    const halloweenPanel = document.getElementById("halloween-crate-panel");
    if (halloweenPanel) {
        halloweenPanel.style.display = shouldShowSeasonalCratePanel("halloween", profileData) ? "" : "none";
    }

    const cratesLayout = document.querySelector("#cratesModal .crates-layout");
    if (cratesLayout) {
        const visiblePanels = [...cratesLayout.querySelectorAll(".crate-inventory-panel")]
            .filter(panel => getComputedStyle(panel).display !== "none");
        cratesLayout.classList.toggle("single-crate-layout", visiblePanels.length === 1);
    }
}

function setCratesModalTab(tabId = "inventory") {
    const inventoryTab = document.getElementById("inventory-tab");
    const craftingTab = document.getElementById("crafting-tab");
    const inventoryPanel = document.getElementById("inventory-panel");
    const craftingPanel = document.getElementById("crafting-panel");
    const showCrafting = tabId === "crafting";

    inventoryTab?.classList.toggle("active", !showCrafting);
    craftingTab?.classList.toggle("active", showCrafting);
    inventoryPanel?.classList.toggle("active", !showCrafting);
    craftingPanel?.classList.toggle("active", showCrafting);
}

function initCratesModalTabs() {
    const inventoryTab = document.getElementById("inventory-tab");
    const craftingTab = document.getElementById("crafting-tab");
    if (!inventoryTab || !craftingTab || inventoryTab.dataset.crateTabsReady === "true") return;

    inventoryTab.addEventListener("click", () => setCratesModalTab("inventory"));
    craftingTab.addEventListener("click", () => setCratesModalTab("crafting"));
    inventoryTab.dataset.crateTabsReady = "true";
}

function updateSummerCrateCraftingUI(profileData = getCurrentProfileData()) {
    const inventory = getCrateInventory(profileData);
    const reefOwned = inventory.reef || 0;
    const summerOwned = inventory.summer || 0;
    const canCraft = reefOwned >= SUMMER_CRATE_CRAFT_COST && !summerCrateCraftingInProgress;
    const canOpenReef = reefOwned > 0 && !crateOpeningInProgress;
    const canOpenSummer = summerOwned > 0 && !crateOpeningInProgress;

    const reefOwnedEl = document.getElementById("craft-reef-owned");
    if (reefOwnedEl) reefOwnedEl.textContent = reefOwned;

    const summerOwnedEl = document.getElementById("craft-summer-owned");
    if (summerOwnedEl) summerOwnedEl.textContent = summerOwned;

    const craftBtn = document.getElementById("craft-summer-crate-btn");
    if (craftBtn) {
        craftBtn.disabled = !canCraft;
        craftBtn.style.opacity = canCraft ? "1" : "0.5";
        craftBtn.textContent = canCraft
            ? "Craft Crate"
            : `Need ${SUMMER_CRATE_CRAFT_COST} Cosmetic Crates`;
    }

    const openReefBtn = document.getElementById("open-crate-btn");
    if (openReefBtn) {
        openReefBtn.disabled = !canOpenReef;
        openReefBtn.style.opacity = canOpenReef ? "1" : "0.5";
    }

    const openSummerBtn = document.getElementById("open-summer-crate-btn");
    if (openSummerBtn) {
        openSummerBtn.disabled = !canOpenSummer;
        openSummerBtn.style.opacity = canOpenSummer ? "1" : "0.5";
    }
}

window.craftSummerCrate = async function() {
    if (!currentUser) {
        openLoginModal();
        return;
    }
    if (summerCrateCraftingInProgress) return;

    const profileData = getCurrentProfileData();
    const inventory = getCrateInventory(profileData);

    if ((inventory.reef || 0) < SUMMER_CRATE_CRAFT_COST) {
        showNotification(`You need ${SUMMER_CRATE_CRAFT_COST} Cosmetic Crates to craft 1 Summer Crate.`, "error", 3000);
        return;
    }

    summerCrateCraftingInProgress = true;
    updateSummerCrateCraftingUI(profileData);

    inventory.reef -= SUMMER_CRATE_CRAFT_COST;
    inventory.summer = (inventory.summer || 0) + 1;
    profileData.crateInventory = normalizeCrateInventory(inventory);

    try {
        await persistCrateProfileUpdate(profileData);
        renderCratesModal();
        showNotification("Crafted 1 Summer Crate from 2 Cosmetic Crates!", "success", 2500);
    } catch (error) {
        console.warn("Crafting sync failed:", error);
        showNotification("Crafting saved locally but sync failed. Try again later.", "error", 3500);
        renderCratesModal();
    } finally {
        summerCrateCraftingInProgress = false;
        updateSummerCrateCraftingUI(getCurrentProfileData());
    }
};

function getDuelStatusClass(status) {
    if (status === 'active' || status === 'completed' || status === 'declined') return status;
    return 'pending';
}

function ensureDuelSharkOptions() {
    if (duelSharkOptionsReady) return;
    if (!Array.isArray(window.sharks)) return;
    duelSharkOptionNames = window.sharks.map(shark => shark.name).sort((a, b) => a.localeCompare(b));
    duelSharkOptionsReady = true;
}

function hideDuelSuggestions() {
    const panel = document.getElementById('duel-suggestions');
    if (!panel) return;
    panel.classList.add('hidden');
    panel.innerHTML = '';
    duelSuggestionIndex = -1;
    duelVisibleSuggestions = [];
}

function applyDuelSuggestion(value) {
    const input = document.getElementById('duel-guess-input');
    if (!input) return;
    input.value = value;
    hideDuelSuggestions();
    input.focus();
}

function renderDuelSuggestions(query = '') {
    const panel = document.getElementById('duel-suggestions');
    const input = document.getElementById('duel-guess-input');
    if (!panel || !input) return;

    const normalizedQuery = normalizeSharkInput(query);
    const suggestions = duelSharkOptionNames
        .filter(name => !normalizedQuery || normalizeSharkInput(name).includes(normalizedQuery))
        .slice(0, 8);

    duelVisibleSuggestions = suggestions;
    duelSuggestionIndex = suggestions.length ? 0 : -1;

    if (!suggestions.length) {
        panel.innerHTML = '<div class="duel-suggestion-empty">No matching sharks found.</div>';
        panel.classList.remove('hidden');
        return;
    }

    panel.innerHTML = suggestions.map((name, index) => `
        <button type="button" class="duel-suggestion-item ${index === duelSuggestionIndex ? 'active' : ''}" data-duel-suggestion="${name}">
            ${name}
        </button>
    `).join('');

    panel.querySelectorAll('[data-duel-suggestion]').forEach(button => {
        button.addEventListener('mousedown', event => {
            event.preventDefault();
            applyDuelSuggestion(button.getAttribute('data-duel-suggestion') || '');
        });
    });

    panel.classList.remove('hidden');
}

function moveDuelSuggestionSelection(direction) {
    const panel = document.getElementById('duel-suggestions');
    if (!panel || panel.classList.contains('hidden') || !duelVisibleSuggestions.length) return;

    duelSuggestionIndex = (duelSuggestionIndex + direction + duelVisibleSuggestions.length) % duelVisibleSuggestions.length;
    panel.querySelectorAll('.duel-suggestion-item').forEach((item, index) => {
        item.classList.toggle('active', index === duelSuggestionIndex);
    });
}

function buildDuelFeedback(guessedShark, targetShark) {
    return [
        { category: 'Family', value: guessedShark.family, correct: guessedShark.family === targetShark.family },
        { category: 'Order', value: guessedShark.order, correct: guessedShark.order === targetShark.order },
        { category: 'Genus', value: guessedShark.genus, correct: guessedShark.genus === targetShark.genus },
        { category: 'Size', value: guessedShark.size, correct: guessedShark.size === targetShark.size },
        { category: 'Habitat', value: guessedShark.habitat, correct: guessedShark.habitat === targetShark.habitat },
        { category: 'Year of Discovery', value: guessedShark.yod, correct: guessedShark.yod === targetShark.yod }
    ];
}

async function renderFriendsList(friends) {
    const list = document.getElementById('friends-list');
    if (!list) return;
    if (!friends.length) {
        list.innerHTML = '<li class="empty-state"><div class="empty-icon">🐠</div><div class="empty-text">No friends yet</div><div class="empty-subtext">Add some friends to start dueling!</div></li>';
        return;
    }
    list.innerHTML = '';
    const profiles = await Promise.all(friends.map(uid => getUserProfileForUid(uid)));
    friends.forEach((uid, index) => {
        const profile = profiles[index] || {};
        const displayName = profile.username || uid;
        const profilePic = profile.profilePicture || "images/pfp/shark1.png";
        const gamesPlayed = profile.gamesPlayed || 0;
        const bestGame = profile.bestGame || 0;
        const presence = getFriendPresence(profile);

        const item = document.createElement('li');
        item.className = 'friend-item';
        item.onclick = () => openUserProfileModal(uid);
        item.innerHTML = `
            <div class="friend-avatar">
                <img src="${profilePic}" alt="${displayName}">
                <div class="friend-status ${presence.isOnline ? 'online' : 'offline'}"></div>
            </div>
            <div class="friend-info">
                <div class="friend-meta">
                    <div class="friend-name">${displayName}</div>
                    <span class="friend-badge">${presence.label}</span>
                </div>
                <div class="friend-stats">
                    <span class="stat">${gamesPlayed} games</span>
                    <span class="stat">Best: ${bestGame}</span>
                </div>
            </div>
            <div class="friend-actions">
                <button onclick="event.stopPropagation(); challengeFriendToDuel('${uid}')" class="action-btn duel-btn">
                    <span class="btn-icon">⚔</span>
                    Duel
                </button>
                <button onclick="event.stopPropagation(); openUserProfileModal('${uid}')" class="action-btn view-btn">
                    <span class="btn-icon">👁</span>
                    View
                </button>
                <button onclick="event.stopPropagation(); removeFriend('${uid}')" class="action-btn remove-btn" title="Remove friend">
                    <span class="btn-icon">❌</span>
                    Remove
                </button>
            </div>
        `;
        list.appendChild(item);
    });
}

async function renderDuelsList(duels) {
    const list = document.getElementById('duels-list');
    if (!list) return;

    if (!currentUser || !duels.length) {
        list.innerHTML = '<li class="empty-state"><div class="empty-icon">🦈</div><div class="empty-text">No duels yet</div><div class="empty-subtext">Use the Duel button on a friend card to start a shark guessing battle.</div></li>';
        return;
    }

    list.innerHTML = '';
    const sortedDuels = [...duels].sort((a, b) => {
        const aTime = a.createdAtMs || a.createdAt?.seconds || 0;
        const bTime = b.createdAtMs || b.createdAt?.seconds || 0;
        return bTime - aTime;
    });

    const opponentIds = [...new Set(sortedDuels.map(duel => getDuelOpponentUid(duel, currentUser.uid)).filter(Boolean))];
    const opponentProfiles = await Promise.all(opponentIds.map(uid => getUserProfileForUid(uid)));
    const profileMap = new Map(opponentIds.map((uid, index) => [uid, opponentProfiles[index] || {}]));

    sortedDuels.forEach(duel => {
        const opponentUid = getDuelOpponentUid(duel, currentUser.uid);
        const opponentProfile = profileMap.get(opponentUid) || {};
        const opponentName = opponentProfile.username || opponentUid || 'Unknown Rival';
        const opponentPic = opponentProfile.profilePicture || 'images/pfp/shark1.png';
        const selfState = getDuelPlayerState(duel, currentUser.uid);
        const isIncoming = duel.status === 'pending' && duel.opponentUid === currentUser.uid;
        const subtitle = getDuelListSubtitle(duel, selfState, opponentName);

        const item = document.createElement('li');
        item.className = 'friend-item duel-item';
        item.onclick = () => openFriendDuelModal(duel.id);
        item.innerHTML = `
            <div class="friend-avatar">
                <img src="${opponentPic}" alt="${opponentName}">
                <div class="friend-status ${duel.status === 'pending' ? 'pending' : 'online'}"></div>
            </div>
            <div class="friend-info">
                <div class="friend-meta">
                    <div class="friend-name">${opponentName}</div>
                    <span class="duel-status-pill ${getDuelStatusClass(duel.status)}">${formatDuelStatus(duel.status)}</span>
                </div>
                <div class="duel-subtext">${subtitle}</div>
            </div>
            <div class="friend-actions">
                <button onclick="event.stopPropagation(); openFriendDuelModal('${duel.id}')" class="action-btn view-btn">Open</button>
                ${isIncoming ? `<button onclick="event.stopPropagation(); acceptFriendDuel('${duel.id}')" class="action-btn accept-btn">Accept</button>` : ''}
                ${isIncoming ? `<button onclick="event.stopPropagation(); declineFriendDuel('${duel.id}')" class="action-btn decline-btn">Decline</button>` : ''}
                ${duel.status === 'completed' ? `<button onclick="event.stopPropagation(); removeCompletedDuelFromMyList('${duel.id}')" class="action-btn remove-btn">Remove</button>` : ''}
            </div>
        `;
        list.appendChild(item);
    });
}

function getDuelListSubtitle(duel, selfState, opponentName) {
    if (duel.status === 'pending') {
        return duel.opponentUid === currentUser.uid
            ? `${opponentName} challenged you. Accept to start the head-to-head battle.`
            : `Challenge sent. Waiting for ${opponentName} to accept.`;
    }
    if (duel.status === 'active') {
        if (selfState.completed) {
            return `You finished your run. Waiting for ${opponentName} to finish.`;
        }
        return `The duel is live. You have ${selfState.attemptsLeft ?? 12} attempts left.`;
    }
    if (duel.status === 'declined') {
        return 'This duel request was declined.';
    }
    return duel.resultLabel || 'This duel has been resolved.';
}


async function renderRequestsList(requests) {
    const list = document.getElementById('requests-list');
    if (!list) return;
    if (!requests.length) {
        list.innerHTML = '<li class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No requests</div><div class="empty-subtext">Share your friend code to get requests!</div></li>';
        return;
    }
    list.innerHTML = '';
    const profiles = await Promise.all(requests.map(uid => getUserProfileForUid(uid)));
    requests.forEach((uid, index) => {
        const profile = profiles[index] || {};
        const displayName = profile.username || uid;
        const profilePic = profile.profilePicture || "images/pfp/shark1.png";
        const gamesPlayed = profile.gamesPlayed || 0;

        const item = document.createElement('li');
        item.className = 'friend-item request-item';
        item.onclick = () => openUserProfileModal(uid);
        item.innerHTML = `
            <div class="friend-avatar">
                <img src="${profilePic}" alt="${displayName}">
                <div class="friend-status pending"></div>
            </div>
            <div class="friend-info">
                <div class="friend-name">${displayName}</div>
                <div class="friend-stats">
                    <span class="stat">${gamesPlayed} games</span>
                    <span class="request-label">Wants to be friends</span>
                </div>
            </div>
            <div class="friend-actions">
                <button onclick="event.stopPropagation(); acceptFriendRequest('${uid}')" class="action-btn accept-btn">
                    <span class="btn-icon">✅</span>
                    Accept
                </button>
                <button onclick="event.stopPropagation(); declineFriendRequest('${uid}')" class="action-btn decline-btn">
                    <span class="btn-icon">❌</span>
                </button>
            </div>
        `;
        list.appendChild(item);
    });
}

function generateFriendCode(uid) {
    return uid ? uid.slice(-8).toUpperCase() : '';
}

function getChatThreadId(uid1, uid2) {
    if (!uid1 || !uid2) return null;
    return [uid1, uid2].sort().join('_');
}





window.addFriend = async function() {
    const input = document.getElementById('add-friend-uid');
    const status = document.getElementById('add-friend-status');
    if (!status) return;
    if (!currentUser) {
        status.textContent = 'Login required.';
        return;
    }
    const val = (input && input.value.trim()) || '';
    if (!val) {
        status.textContent = 'Enter a UID or friend code.';
        return;
    }
    status.textContent = 'Searching...';

    try {
        let targetUid = val;
        if (val.length <= 8) {
            if (!/^[A-Z0-9]{4,8}$/i.test(val)) {
                status.textContent = 'Invalid friend code.';
                return;
            }
            const upperCode = val.toUpperCase();
            targetUid = await resolveUidFromFriendCode(upperCode);
            if (!targetUid) {
                status.textContent = 'No user found with that code.';
                return;
            }
        }
        const resultMessage = await sendFriendRequest(targetUid);
        status.textContent = resultMessage;
        if (resultMessage === 'Request sent!' && input) {
            input.value = '';
        }
    } catch (error) {
        console.error('Friend request failed:', error);
        status.textContent = `Error sending request. ${error.message || 'Try again.'}`;
    }
};

async function sendFriendRequest(targetUid) {
    if (targetUid === currentUser.uid) {
        return 'You cannot add yourself.';
    }
    const targetRef = getFriendDocumentRef(targetUid);
    if (!targetRef) {
        throw new Error('Unable to access friend storage.');
    }
    const targetDoc = await targetRef.get();
    const targetData = targetDoc.exists ? targetDoc.data() : { friends: [], friendRequests: [] };
    const requests = Array.isArray(targetData.friendRequests) ? targetData.friendRequests : [];
    const friends = Array.isArray(targetData.friends) ? targetData.friends : [];
    if (requests.includes(currentUser.uid)) {
        return 'Request already sent.';
    }
    if (friends.includes(currentUser.uid)) {
        return 'Already friends.';
    }
    requests.push(currentUser.uid);
    await targetRef.set({ friendRequests: requests, friends }, { merge: true });
    return 'Request sent!';
}

window.acceptFriendRequest = async function(uid) {
    if (!currentUser) return;
    const userRef = db.collection(FRIENDS_COLLECTION).doc(currentUser.uid);
    const otherRef = db.collection(FRIENDS_COLLECTION).doc(uid);
    const [userDoc, otherDoc] = await Promise.all([userRef.get(), otherRef.get()]);
    const userData = userDoc.exists ? userDoc.data() : { friends: [], friendRequests: [] };
    const otherData = otherDoc.exists ? otherDoc.data() : { friends: [], friendRequests: [] };
    let requests = Array.isArray(userData.friendRequests) ? userData.friendRequests : [];
    const friends = Array.isArray(userData.friends) ? userData.friends : [];
    requests = requests.filter(u => u !== uid);
    if (!friends.includes(uid)) friends.push(uid);
    const otherFriends = Array.isArray(otherData.friends) ? otherData.friends : [];
    if (!otherFriends.includes(currentUser.uid)) otherFriends.push(currentUser.uid);
    await Promise.all([
        userRef.set({ friendRequests: requests, friends }, { merge: true }),
        otherRef.set({ friends: otherFriends }, { merge: true })
    ]);
    populateFriendsTab();
};

window.declineFriendRequest = async function(uid) {
    if (!currentUser) return;
    const userRef = db.collection(FRIENDS_COLLECTION).doc(currentUser.uid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : { friendRequests: [] };
    let requests = Array.isArray(userData.friendRequests) ? userData.friendRequests : [];
    requests = requests.filter(u => u !== uid);
    await userRef.set({ friendRequests: requests }, { merge: true });
    populateFriendsTab();
};

window.removeFriend = async function(uid) {
    if (!currentUser) return;
    const userRef = db.collection(FRIENDS_COLLECTION).doc(currentUser.uid);
    const otherRef = db.collection(FRIENDS_COLLECTION).doc(uid);
    const [userDoc, otherDoc] = await Promise.all([userRef.get(), otherRef.get()]);
    const userData = userDoc.exists ? userDoc.data() : { friends: [] };
    const otherData = otherDoc.exists ? otherDoc.data() : { friends: [] };
    let friends = Array.isArray(userData.friends) ? userData.friends : [];
    friends = friends.filter(u => u !== uid);
    let otherFriends = Array.isArray(otherData.friends) ? otherData.friends : [];
    otherFriends = otherFriends.filter(u => u !== currentUser.uid);
    await Promise.all([
        userRef.set({ friends }, { merge: true }),
        otherRef.set({ friends: otherFriends }, { merge: true })
    ]);
    populateFriendsTab();
};

async function getExistingDuelWithUser(opponentUid) {
    const duelDocs = activeDuelsCache || [];
    return duelDocs.find(duel => {
        const participants = duel.participants || [];
        return participants.includes(currentUser.uid)
            && participants.includes(opponentUid)
            && (duel.status === 'pending' || duel.status === 'active');
    }) || null;
}

window.challengeFriendToDuel = async function(opponentUid) {
    if (!currentUser || !db) return;
    if (!Array.isArray(window.sharks) || !window.sharks.length) {
        showNotification('Shark roster failed to load for duel mode.', 'error', 3500);
        return;
    }
    try {
        const existingDuel = await getExistingDuelWithUser(opponentUid);
        if (existingDuel) {
            openFriendDuelModal(existingDuel.id);
            showNotification('You already have a live duel with this friend.', 'info', 3200);
            return;
        }

        const targetShark = window.sharks[Math.floor(Math.random() * window.sharks.length)];
        const duelId = `duel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const duel = {
            id: duelId,
            participants: [currentUser.uid, opponentUid],
            challengerUid: currentUser.uid,
            opponentUid,
            sharkName: targetShark.name,
            status: 'pending',
            resultLabel: 'Challenge sent. Waiting for acceptance.',
            createdAtMs: Date.now(),
            updatedAtMs: Date.now(),
            players: {
                [currentUser.uid]: {
                    accepted: true,
                    guesses: [],
                    attemptsLeft: 12,
                    completed: false,
                    won: false
                },
                [opponentUid]: {
                    accepted: false,
                    guesses: [],
                    attemptsLeft: 12,
                    completed: false,
                    won: false
                }
            }
        };

        await saveDuelForParticipants(duel);
        showNotification('Duel challenge sent!', 'success', 3200);
    } catch (error) {
        console.error('Failed to send duel challenge:', error);
        showNotification(`Could not send duel challenge. ${error.message || 'Try again.'}`, 'error', 3800);
    }
};

window.acceptFriendDuel = async function(duelId) {
    if (!currentUser || !db) return;
    try {
        const duelData = activeDuelsCache.find(duel => duel.id === duelId);
        if (!duelData) return;
        const updatedDuel = {
            ...duelData,
            status: 'active',
            resultLabel: 'Both players accepted. Duel in progress.',
            updatedAtMs: Date.now(),
            players: {
                ...duelData.players,
                [currentUser.uid]: {
                    ...getDuelPlayerState(duelData, currentUser.uid),
                    accepted: true
                }
            }
        };
        await saveDuelForParticipants(updatedDuel);
        openFriendDuelModal(duelId);
        showNotification('Duel accepted. Good luck!', 'success', 3200);
    } catch (error) {
        console.error('Failed to accept duel:', error);
        showNotification('Could not accept duel right now.', 'error', 3500);
    }
};

window.declineFriendDuel = async function(duelId) {
    if (!currentUser || !db) return;
    try {
        const duelData = activeDuelsCache.find(duel => duel.id === duelId);
        if (!duelData) return;
        const updatedDuel = {
            ...duelData,
            status: 'declined',
            resultLabel: 'Duel declined.',
            declinedBy: currentUser.uid,
            updatedAtMs: Date.now()
        };
        await saveDuelForParticipants(updatedDuel);
        showNotification('Duel declined.', 'info', 2800);
    } catch (error) {
        console.error('Failed to decline duel:', error);
        showNotification('Could not decline duel right now.', 'error', 3500);
    }
};

window.removeCompletedDuelFromMyList = async function(duelId) {
    if (!currentUser || !db || !duelId) return;
    try {
        const data = await getFriendNetworkData(currentUser.uid);
        const duels = normalizeDuelsList(data.duels);
        const duel = duels.find(entry => entry?.id === duelId);

        if (!duel) {
            if (currentOpenDuelId === duelId) {
                closeFriendDuelModal();
            }
            showNotification('This duel is already removed from your list.', 'info', 2600);
            return;
        }

        if (duel.status !== 'completed') {
            showNotification('You can only remove completed duels.', 'info', 3000);
            return;
        }

        const ref = getFriendDocumentRef(currentUser.uid);
        if (!ref) return;

        const nextDuels = removeDuelRecord(duels, duelId);
        await ref.set({ duels: nextDuels }, { merge: true });
        activeDuelsCache = nextDuels;

        if (currentOpenDuelId === duelId) {
            closeFriendDuelModal();
        }

        const duelsCountEl = document.getElementById('duels-count');
        const duelsCardCountEl = document.getElementById('duels-card-count');
        if (duelsCountEl) duelsCountEl.textContent = String(activeDuelsCache.length);
        if (duelsCardCountEl) duelsCardCountEl.textContent = String(activeDuelsCache.length);

        await renderDuelsList(activeDuelsCache);
        showNotification('Duel removed from your list.', 'success', 2600);
    } catch (error) {
        console.error('Failed to remove duel from personal list:', error);
        showNotification('Could not remove duel right now.', 'error', 3400);
    }
};

function buildDuelOutcomeLabel(duelData) {
    const challengerState = getDuelPlayerState(duelData, duelData.challengerUid);
    const opponentState = getDuelPlayerState(duelData, duelData.opponentUid);
    const challengerAttempts = 12 - (challengerState.attemptsLeft ?? 12);
    const opponentAttempts = 12 - (opponentState.attemptsLeft ?? 12);

    if (challengerState.won && !opponentState.won) {
        return 'Challenger won the duel.';
    }
    if (!challengerState.won && opponentState.won) {
        return 'Opponent won the duel.';
    }
    if (challengerState.won && opponentState.won) {
        if (challengerAttempts < opponentAttempts) return 'Challenger won by using fewer guesses.';
        if (opponentAttempts < challengerAttempts) return 'Opponent won by using fewer guesses.';
        return 'Draw. Both players solved it in the same number of guesses.';
    }
    return 'Draw. Neither player found the shark.';
}

function getLocalizedDuelResult(duelData) {
    const challengerState = getDuelPlayerState(duelData, duelData.challengerUid);
    const opponentState = getDuelPlayerState(duelData, duelData.opponentUid);
    const selfState = getDuelPlayerState(duelData, currentUser.uid);
    const opponentUid = getDuelOpponentUid(duelData, currentUser.uid);
    const rivalState = getDuelPlayerState(duelData, opponentUid);
    const selfAttempts = 12 - (selfState.attemptsLeft ?? 12);
    const rivalAttempts = 12 - (rivalState.attemptsLeft ?? 12);

    if (challengerState.won && !opponentState.won) {
        return duelData.challengerUid === currentUser.uid ? 'You won the duel.' : 'You lost the duel.';
    }
    if (!challengerState.won && opponentState.won) {
        return duelData.opponentUid === currentUser.uid ? 'You won the duel.' : 'You lost the duel.';
    }
    if (challengerState.won && opponentState.won) {
        if (selfAttempts < rivalAttempts) return 'You won by using fewer guesses.';
        if (rivalAttempts < selfAttempts) return 'You lost. Your rival solved it faster.';
        return 'Draw. Both of you solved it in the same number of guesses.';
    }
    return 'Draw. Neither player found the shark.';
}

function shouldFinalizeDuel(duelData) {
    const challengerState = getDuelPlayerState(duelData, duelData.challengerUid);
    const opponentState = getDuelPlayerState(duelData, duelData.opponentUid);
    return challengerState.completed && opponentState.completed;
}

window.openFriendDuelModal = async function(duelId) {
    if (!currentUser || !db) return;
    currentOpenDuelId = duelId;
    ensureDuelSharkOptions();
    const duel = activeDuelsCache.find(entry => entry.id === duelId);
    if (duel) {
        await renderFriendDuelModal(duel);
    }
    document.getElementById('friendDuelModal')?.classList.remove('hidden');
};

window.closeFriendDuelModal = function() {
    currentOpenDuelId = null;
    hideDuelSuggestions();
    document.getElementById('friendDuelModal')?.classList.add('hidden');
};

async function renderFriendDuelModal(duelData) {
    if (!duelData || !currentUser) return;
    const opponentUid = getDuelOpponentUid(duelData, currentUser.uid);
    const [selfProfile, opponentProfile] = await Promise.all([
        getUserProfileForUid(currentUser.uid),
        getUserProfileForUid(opponentUid)
    ]);
    const selfState = getDuelPlayerState(duelData, currentUser.uid);
    const opponentState = getDuelPlayerState(duelData, opponentUid);
    const title = document.getElementById('duel-title');
    const subtitle = document.getElementById('duel-subtitle');
    const selfPic = document.getElementById('duel-self-pic');
    const opponentPic = document.getElementById('duel-opponent-pic');
    const selfCard = document.getElementById('duel-self-card');
    const opponentCard = document.getElementById('duel-opponent-card');
    const selfName = document.getElementById('duel-self-name');
    const opponentName = document.getElementById('duel-opponent-name');
    const selfStatus = document.getElementById('duel-self-status');
    const opponentStatus = document.getElementById('duel-opponent-status');
    const attemptsLeft = document.getElementById('duel-attempts-left');
    const selfGuessCount = document.getElementById('duel-self-guess-count');
    const opponentGuessCount = document.getElementById('duel-opponent-guess-count');
    const result = document.getElementById('duel-result');
    const message = document.getElementById('duel-message');
    const liveNote = document.getElementById('duel-live-note');
    const inputArea = document.getElementById('duel-input-area');
    const guessesBoard = document.getElementById('duel-guesses');
    const input = document.getElementById('duel-guess-input');

    if (title) title.textContent = `${(opponentProfile?.username || 'Rival')} Showdown`;
    if (subtitle) subtitle.textContent = duelData.status === 'pending'
        ? 'Waiting on one accept before the board opens.'
        : 'You are both hunting the exact same shark.';
    if (selfPic) selfPic.src = selfProfile?.profilePicture || 'images/pfp/shark1.png';
    if (opponentPic) opponentPic.src = opponentProfile?.profilePicture || 'images/pfp/shark1.png';
    if (selfCard) applyDuelPlayerTheme('duel-self-card', selfProfile?.equippedCardTheme || 'default');
    if (opponentCard) applyDuelPlayerTheme('duel-opponent-card', opponentProfile?.equippedCardTheme || 'default');
    if (selfName) selfName.textContent = selfProfile?.username || 'You';
    if (opponentName) opponentName.textContent = opponentProfile?.username || opponentUid || 'Rival';
    if (selfStatus) selfStatus.textContent = duelPlayerStatusText(selfState, duelData.status, true);
    if (opponentStatus) opponentStatus.textContent = duelPlayerStatusText(opponentState, duelData.status, false);
    if (attemptsLeft) attemptsLeft.textContent = String(selfState.attemptsLeft ?? 12);
    if (selfGuessCount) selfGuessCount.textContent = String((selfState.guesses || []).length);
    if (opponentGuessCount) opponentGuessCount.textContent = String((opponentState.guesses || []).length);
    if (result) result.textContent = duelData.status === 'completed' ? getLocalizedDuelResult(duelData) : (duelData.resultLabel || 'Live');
    if (message) message.textContent = duelModalMessage(duelData, selfState, opponentState);
    if (liveNote) liveNote.textContent = duelLiveNoteText(duelData, selfState, opponentState);
    if (inputArea) inputArea.style.display = duelData.status === 'active' && !selfState.completed ? 'flex' : 'none';
    if (input) {
        input.oninput = () => {
            const value = input.value.trim();
            if (!value) {
                hideDuelSuggestions();
                return;
            }
            renderDuelSuggestions(value);
        };
        input.onfocus = () => {
            const value = input.value.trim();
            if (value) renderDuelSuggestions(value);
        };
        input.onblur = () => {
            setTimeout(() => hideDuelSuggestions(), 120);
        };
        input.onkeydown = event => {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (document.getElementById('duel-suggestions')?.classList.contains('hidden')) {
                    renderDuelSuggestions(input.value.trim());
                } else {
                    moveDuelSuggestionSelection(1);
                }
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                moveDuelSuggestionSelection(-1);
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                if (duelVisibleSuggestions.length && duelSuggestionIndex >= 0 && !document.getElementById('duel-suggestions')?.classList.contains('hidden')) {
                    applyDuelSuggestion(duelVisibleSuggestions[duelSuggestionIndex]);
                    return;
                }
                submitDuelGuess();
            }
            if (event.key === 'Escape') {
                hideDuelSuggestions();
            }
        };
    }

    guessesBoard.innerHTML = '';
    const targetShark = Array.isArray(window.sharks) ? window.sharks.find(shark => shark.name === duelData.sharkName) : null;
    (selfState.guesses || []).forEach((guessName, index) => {
        const guessedShark = window.sharks.find(shark => shark.name === guessName);
        if (!guessedShark || !targetShark) return;
        const feedback = buildDuelFeedback(guessedShark, targetShark);
        guessesBoard.appendChild(createDuelGuessCard(guessedShark, feedback, targetShark, index + 1));
    });
}

function duelPlayerStatusText(playerState, duelStatus, isSelf) {
    if (duelStatus === 'pending') {
        return isSelf ? 'Ready' : (playerState.accepted ? 'Ready' : 'Waiting');
    }
    if (playerState.completed && playerState.won) return 'Solved';
    if (playerState.completed && !playerState.won) return 'Locked';
    return `${12 - (playerState.attemptsLeft ?? 12)} guesses used`;
}

function duelModalMessage(duelData, selfState, opponentState) {
    if (duelData.status === 'pending') {
        return duelData.opponentUid === currentUser.uid
            ? 'Accept the duel to open the shared shark board.'
            : 'Challenge sent. The board opens as soon as your rival accepts.';
    }
    if (duelData.status === 'declined') {
        return 'This challenge was declined.';
    }
    if (duelData.status === 'completed') {
        return duelData.resultLabel || 'Final result locked.';
    }
    if (selfState.completed && !opponentState.completed) {
        return "Your run is locked. Now it is your rival's turn to finish.";
    }
    return 'Read the feedback, narrow the shark, and solve in fewer guesses than your rival.';
}

function duelLiveNoteText(duelData, selfState, opponentState) {
    if (duelData.status === 'pending') {
        return 'This screen updates automatically the moment the other player responds.';
    }
    if (duelData.status === 'completed') {
        return `Final board: you finished in ${(selfState.guesses || []).length}, your rival finished in ${(opponentState.guesses || []).length}.`;
    }
    return `Live board: you are on ${(selfState.guesses || []).length} guesses, your rival is on ${(opponentState.guesses || []).length}.`;
}

// Override with clean copy so the showdown UI stays concise and readable.
function duelModalMessage(duelData, selfState, opponentState) {
    if (duelData.status === 'pending') {
        return duelData.opponentUid === currentUser.uid
            ? 'Accept the duel to open the shared shark board.'
            : 'Challenge sent. The board opens as soon as your rival accepts.';
    }
    if (duelData.status === 'declined') {
        return 'This challenge was declined.';
    }
    if (duelData.status === 'completed') {
        return duelData.resultLabel || 'Final result locked.';
    }
    if (selfState.completed && !opponentState.completed) {
        return 'Your run is locked. Now it is your rival\'s turn to finish.';
    }
    return 'Read the feedback, narrow the shark, and solve in fewer guesses than your rival.';
}

function createDuelGuessCard(guessedShark, feedback, targetShark, guessNumber) {
    const card = document.createElement('div');
    card.className = 'duel-guess-card';
    const isCorrect = normalizeSharkInput(guessedShark.name) === normalizeSharkInput(targetShark.name);
    const feedbackHtml = feedback.map(item => {
        let extra = '';
        if (item.category === 'Year of Discovery' && !item.correct) {
            extra = item.value < targetShark.yod ? ' ↑' : ' ↓';
        }
        if (item.category === 'Size' && duelSizeThresholds[item.value]) {
            extra = ` (${duelSizeThresholds[item.value]})`;
        }
        return `<div class="duel-feedback-chip ${item.correct ? 'correct' : ''}"><strong>${item.category}:</strong> ${item.value}${extra}</div>`;
    }).join('');

    card.innerHTML = `
        <div class="duel-guess-header">
            <div class="duel-guess-name ${isCorrect ? 'correct' : 'incorrect'}">${guessedShark.name}</div>
            <div class="duel-guess-index">Guess ${guessNumber}</div>
        </div>
        <div class="duel-feedback-grid">${feedbackHtml}</div>
    `;
    return card;
}

window.submitDuelGuess = async function() {
    if (!currentUser || !db || !currentOpenDuelId) return;
    const duel = activeDuelsCache.find(entry => entry.id === currentOpenDuelId);
    if (!duel) return;

    const input = document.getElementById('duel-guess-input');
    const message = document.getElementById('duel-message');
    const rawGuess = input?.value.trim() || '';
    const guessInput = normalizeSharkInput(rawGuess);
    const selfState = getDuelPlayerState(duel, currentUser.uid);

    if (duel.status !== 'active' || selfState.completed) return;

    if (!guessInput) {
        if (message) message.textContent = 'Enter a shark name.';
        return;
    }

    const guessedShark = window.sharks.find(shark => normalizeSharkInput(shark.name) === guessInput);
    if (!guessedShark) {
        if (message) message.textContent = 'That shark is not in the roster.';
        return;
    }
    if ((selfState.guesses || []).includes(guessedShark.name)) {
        if (message) message.textContent = 'You already guessed that shark in this duel.';
        return;
    }

    hideDuelSuggestions();

    const targetShark = window.sharks.find(shark => shark.name === duel.sharkName);
    if (!targetShark) return;

    const updatedGuesses = [...(selfState.guesses || []), guessedShark.name];
    const nextAttemptsLeft = Math.max((selfState.attemptsLeft ?? 12) - 1, 0);
    const won = normalizeSharkInput(guessedShark.name) === normalizeSharkInput(targetShark.name);
    const completed = won || nextAttemptsLeft === 0;

    const mergedDuel = {
        ...duel,
        updatedAtMs: Date.now(),
        players: {
            ...duel.players,
            [currentUser.uid]: {
                ...selfState,
                guesses: updatedGuesses,
                attemptsLeft: nextAttemptsLeft,
                completed,
                won,
                accepted: true
            }
        }
    };

    if (shouldFinalizeDuel(mergedDuel)) {
        mergedDuel.status = 'completed';
        mergedDuel.resultLabel = buildDuelOutcomeLabel(mergedDuel);
    }

    await saveDuelForParticipants(mergedDuel);

    if (message) {
        message.textContent = won
            ? 'Direct hit. Your shark is locked in for scoring.'
            : nextAttemptsLeft === 0
                ? 'No attempts left. Your duel run is locked in.'
                : 'Guess logged. Keep hunting.';
    }
    if (input) input.value = '';
};

function getRevealableDuel(duelId = null) {
    if (duelId) {
        return activeDuelsCache.find(entry => entry.id === duelId) || null;
    }
    if (currentOpenDuelId) {
        return activeDuelsCache.find(entry => entry.id === currentOpenDuelId) || null;
    }
    return activeDuelsCache.find(entry =>
        entry?.status === 'active'
        && (entry?.participants || []).includes(currentUser?.uid)
    ) || null;
}

// Console command for testing: revealShark() - Dev only
window.revealShark = function(duelId = null) {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("Access denied. This command is for developers only.");
        return;
    }

    const duel = getRevealableDuel(duelId);
    if (!duel?.sharkName) {
        console.log("No active duel shark found. Open a duel first or pass a duel id to revealShark('duel_id').");
        return;
    }

    console.log(`TESTING ONLY: The duel target shark is: ${duel.sharkName}`);
};

window.reset = async function(uid) {
    try {
        if (!currentUser || !isDeveloperUid(currentUser.uid)) {
            showNotification('Dev command: Access denied.', 'error', 4000);
            return;
        }
        if (!uid) {
            showNotification('No UID provided.', 'error', 4000);
            return;
        }
        if (!confirm('Are you sure you want to reset ALL data for UID: ' + uid + '? This cannot be undone.')) return;
        // Wipe userStats in Firestore
        await db.collection('userStats').doc(uid).set({}, { merge: false });
        // Attempt to wipe localStorage if the user is currently logged in on this device
        let localProfile = {};
        try { localProfile = JSON.parse(localStorage.getItem('userProfile') || '{}'); } catch {}
        if (localProfile && localProfile.uid === uid) {
            localStorage.removeItem('userProfile');
            localStorage.removeItem('totalXP');
            localStorage.removeItem('redeemedCodes');
            localStorage.removeItem('loginStreak');
            localStorage.removeItem('lastLoginDate');
            localStorage.removeItem('currentLoginDay');
            localStorage.removeItem('claimedAchievements');
            localStorage.removeItem('unlockedAchievements');
        }
        // Also clear if the current logged in user matches
        if (uid === currentUser.uid) {
            localStorage.removeItem('userProfile');
            localStorage.removeItem('totalXP');
            localStorage.removeItem('redeemedCodes');
            localStorage.removeItem('loginStreak');
            localStorage.removeItem('lastLoginDate');
            localStorage.removeItem('currentLoginDay');
            localStorage.removeItem('claimedAchievements');
            localStorage.removeItem('unlockedAchievements');
        }
        showNotification('Account data reset for UID: ' + uid, 'success', 4000);
    } catch (err) {
        showNotification('Error resetting account: ' + (err.message || err), 'error', 5000);
        console.error('Dev reset error:', err);
    }
}

// Dev-only: Apply summer theme locally (does not affect global theme)
window.applySummerTheme = function() {
    if (!currentUser || !isDeveloperUid(currentUser.uid)) {
        showNotification('Dev command: Access denied.', 'error', 4000);
        return;
    }
    applyIndexTheme('summer', true);
    updateSeasonalCratePanels();
    showNotification('Summer theme applied (local only)', 'success', 2500);
};

// Dev-only: Toggle summer theme on/off
window.toggleSummerTheme = function() {
    if (!currentUser || !isDeveloperUid(currentUser.uid)) {
        showNotification('Dev command: Access denied.', 'error', 4000);
        return;
    }
    const body = document.body;
    const isSummer = body.classList.contains('global-ui-theme-summer');
    applyIndexTheme(isSummer ? 'default' : 'summer', true);
    updateSeasonalCratePanels();
    showNotification(isSummer ? 'Summer theme disabled' : 'Summer theme enabled (local only)', 'success', 2500);
};

// Dev-only: Unlock all profile card themes for the current account
window.giveProfileThemes = async function() {
    if (!currentUser || !isDeveloperUid(currentUser.uid)) {
        showNotification('Dev command: Access denied.', 'error', 4000);
        return;
    }
    const profileData = getCurrentProfileData();
    if (!profileData || typeof profileData !== 'object') {
        showNotification('Unable to access profile data.', 'error', 4000);
        return;
    }

    profileData.unlockedCardThemes = [...new Set(["default", ...sharkPassCardThemes.map(theme => theme.id)])];
    saveUserProfileLocally(profileData, { skipRemoteSync: true });

    if (db && currentUser) {
        try {
            await db.collection('userStats').doc(currentUser.uid).set({
                unlockedCardThemes: profileData.unlockedCardThemes
            }, { merge: true });
        } catch (err) {
            console.warn('Unable to sync theme grants:', err);
        }
    }

    if (typeof renderThemeSelection === 'function') {
        renderThemeSelection();
    }
    showNotification(`Unlocked ${profileData.unlockedCardThemes.length} profile themes`, 'success', 3500);
};

// Dev-only keyboard shortcut: Ctrl+Shift+S toggles summer theme locally
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        if (currentUser && isDeveloperUid(currentUser.uid)) {
            window.toggleSummerTheme();
        } else {
            console.log('Summer theme toggle: Developer access required.');
        }
    }
});

// ----- BADGE SYSTEM -----
const DEV_UID = 'ETPtQC0VA2NiSnX67rS2P2ma2tC2'; // Primary dev UID kept for backwards compatibility
const DEV_UIDS = ['ETPtQC0VA2NiSnX67rS2P2ma2tC2', 'gOcPqOuyPJRWisE4dxvFkGTOl5g2'];

function isDeveloperUid(uid) {
    return DEV_UIDS.includes(uid || "");
}
const sharkPassCardThemes = [
    { id: "default", name: "Starter Blue", level: 0, preview: "linear-gradient(135deg, rgba(0,180,216,0.16), rgba(11,34,51,0.94))" },
    { id: "tidal-blue", name: "Tidal Blue", level: 7, preview: "linear-gradient(135deg, rgba(67, 170, 255, 0.24), rgba(8, 23, 48, 0.98))" },
    { id: "sunken-gold", name: "Sunken Gold", level: 15, preview: "linear-gradient(135deg, rgba(255, 196, 87, 0.22), rgba(20, 27, 56, 0.98))" },
    { id: "reef-rush", name: "Reef Rush", level: 24, preview: "linear-gradient(135deg, rgba(118, 244, 184, 0.22), rgba(15, 92, 112, 0.96) 44%, rgba(6, 24, 42, 1))" },
    { id: "abyssal-current", name: "Abyssal Current", level: 30, preview: "linear-gradient(135deg, rgba(117, 202, 255, 0.24), rgba(33, 55, 120, 0.28) 42%, rgba(4, 12, 27, 1))" },
    { id: "coral-bloom", name: "Coral Bloom", unlockAchievement: "pacific_master", preview: "linear-gradient(135deg, rgba(255, 122, 156, 0.28), rgba(255, 176, 109, 0.2) 38%, rgba(15, 92, 112, 0.96))" },
    { id: "deep-abyss", name: "Deep Abyss", unlockAchievement: "guess_master", preview: "linear-gradient(135deg, rgba(17, 255, 203, 0.14), rgba(5, 18, 34, 0.94) 42%, rgba(1, 6, 15, 0.99))" },
    { id: "storm-current", name: "Storm Current", unlockAchievement: "duel_won", preview: "linear-gradient(135deg, rgba(117, 202, 255, 0.26), rgba(67, 126, 255, 0.2) 34%, rgba(9, 20, 47, 0.98))" },
    { id: "pearl-reef", name: "Pearl Reef", unlockAchievement: "secret_command_found", preview: "linear-gradient(135deg, rgba(250, 240, 214, 0.3), rgba(164, 244, 231, 0.18) 42%, rgba(24, 72, 92, 0.96))" },
    { id: "volcanic-ember", name: "Volcanic Ember", preview: "linear-gradient(135deg, rgba(255, 120, 70, 0.3), rgba(255, 66, 66, 0.18) 34%, rgba(44, 10, 24, 0.98) 72%, rgba(16, 5, 14, 1))" },
    { id: "kelp-canopy", name: "Kelp Canopy", preview: "linear-gradient(135deg, rgba(166, 223, 110, 0.18), rgba(65, 121, 70, 0.22) 34%, rgba(12, 49, 43, 0.98) 70%, rgba(6, 24, 21, 1))" },
    { id: "glacier-shine", name: "Glacier Shine", preview: "linear-gradient(135deg, rgba(232, 247, 255, 0.34), rgba(132, 214, 255, 0.18) 36%, rgba(35, 80, 118, 0.92) 72%, rgba(10, 31, 52, 1))" },
    { id: "ocean-breeze", name: "Ocean Breeze", preview: "linear-gradient(135deg, rgba(100, 200, 255, 0.3), rgba(50, 150, 200, 0.2) 42%, rgba(10, 50, 80, 0.96))" },
    { id: "horizonflare", name: "Horizon", preview: "radial-gradient(circle at 50% 10%, rgba(255,255,255,0.06), transparent 30%), linear-gradient(to top, rgba(255,145,70,0.9) 0%, rgba(255,95,160,0.8) 55%, rgba(140,90,180,0.85) 100%)" },
    { id: "solsticeglow", name: "Summer Glow", preview: "linear-gradient(135deg, rgba(255, 220, 100, 0.4), rgba(255, 180, 50, 0.25) 42%, rgba(40, 30, 10, 0.98))" },
    { id: "candycane", name: "Candy Cane", preview: "repeating-linear-gradient(135deg, #fff5f5 0 11px, #ff6b6b 11px 22px)" },
    { id: "elf", name: "Elf", preview: "linear-gradient(135deg, #228b22 0%, #32cd32 50%, #228b22 100%)" },
    { id: "north-pole", name: "North Pole", preview: "linear-gradient(135deg, #e6f7ff 0%, #b3e0ff 50%, #80d0ff 100%)" },
    { id: "pumpkin-patch", name: "Goo", preview: "radial-gradient(34px 22px at 8% 4px, rgba(138, 255, 112, 0.88) 0 68%, transparent 72%), radial-gradient(30px 40px at 23% -9px, rgba(122, 242, 96, 0.88) 0 66%, transparent 70%), radial-gradient(36px 26px at 41% 6px, rgba(144, 255, 120, 0.86) 0 68%, transparent 72%), radial-gradient(28px 38px at 58% -8px, rgba(113, 233, 89, 0.86) 0 66%, transparent 70%), radial-gradient(34px 24px at 74% 5px, rgba(132, 250, 108, 0.86) 0 68%, transparent 72%), radial-gradient(30px 42px at 90% -10px, rgba(120, 236, 94, 0.86) 0 66%, transparent 70%), linear-gradient(180deg, rgba(142, 255, 113, 0.34) 0 16%, transparent 29%), linear-gradient(180deg, rgba(154, 88, 228, 0.64), rgba(58, 24, 94, 0.98) 62%, rgba(20, 9, 38, 1))" },
    { id: "haunted-abyss", name: "Witchlight", preview: "radial-gradient(circle at 18% 22%, rgba(250, 128, 114, 0.24), transparent 26%), radial-gradient(circle at 82% 18%, rgba(199, 121, 255, 0.26), transparent 28%), linear-gradient(145deg, rgba(97, 40, 154, 0.4), rgba(45, 22, 78, 0.98) 58%, rgba(18, 8, 34, 1))" },
    { id: "nightmare-reef", name: "Phantom Fog", preview: "radial-gradient(circle at 20% 18%, rgba(170, 255, 230, 0.16), transparent 24%), radial-gradient(circle at 80% 24%, rgba(141, 224, 255, 0.14), transparent 26%), linear-gradient(150deg, rgba(41, 112, 120, 0.28), rgba(18, 42, 56, 0.98) 52%, rgba(9, 18, 31, 1))" }
];

const CRATE_DROP_CHANCE = 0.5;
const GLOBAL_XP_EVENT_CONFIG_PATH = {
    collection: "globalConfig",
    doc: "xpEvent"
};
const GLOBAL_INDEX_THEME_CONFIG_PATH = {
    collection: "globalConfig",
    doc: "indexTheme"
};
const GLOBAL_MESSAGE_CONFIG_PATH = {
    collection: "globalConfig",
    doc: "globalMessage"
};
const COMMUNITY_BOSS_EVENTS = [
    {
        id: "summer-megaladon-2026",
        season: "summer",
        seasonLabel: "Limited Summer Boss Event",
        bossName: "Megalodon",
        title: "Defeat the Megalodon",
        targetWins: 150,
        // Event counter only: leaderboard/profile wins remain +1 in the mode scripts.
        contributionMultiplier: 2,
        startMs: new Date("2026-05-25T00:00:00Z").getTime(),
        endMs: new Date("2026-06-15T00:00:00Z").getTime(),
        crateId: "summer",
        rewardBadgeId: "extinction",
        rewardBadgeName: "Extinction",
        rewards: createCommunityBossRewards("summer")
    },
    {
        id: "summer-cladoselache-2026",
        season: "summer",
        seasonLabel: "Limited Summer Boss Event",
        bossName: "Cladoselache",
        title: "Defeat the Cladoselache",
        targetWins: 150,
        // Event counter only: leaderboard/profile wins remain +1 in the mode scripts.
        contributionMultiplier: 1,
        startMs: new Date("2026-06-20T00:00:00Z").getTime(),
        endMs: new Date("2026-07-05T00:00:00Z").getTime(),
        crateId: "summer",
        rewardBadgeId: "extinction",
        rewardBadgeName: "Extinction",
        rewardMode: "milestone",
        rewards: createCommunityBossMilestoneRewards("summer")
    },
    {
        id: "halloween-helicoprion-2026",
        season: "halloween",
        seasonLabel: "Limited Halloween Boss Event",
        bossName: "Helicoprion",
        title: "Defeat the Helicoprion",
        targetWins: 150,
        startMs: new Date("2026-10-18T00:00:00Z").getTime(),
        endMs: new Date("2026-11-01T00:00:00Z").getTime(),
        crateId: "halloween",
        rewardBadgeId: "spiral-hunter",
        rewardBadgeName: "Spiral Hunter",
        rewards: createCommunityBossRewards("halloween")
    },
    {
        id: "christmas-stethacanthus-2026",
        season: "christmas",
        seasonLabel: "Limited Christmas Boss Event",
        bossName: "Stethacanthus",
        title: "Defeat the Stethacanthus",
        targetWins: 150,
        startMs: new Date("2026-12-12T00:00:00Z").getTime(),
        endMs: new Date("2026-12-26T00:00:00Z").getTime(),
        crateId: "christmas",
        rewardBadgeId: "frost-anvil",
        rewardBadgeName: "Frost Anvil",
        rewards: createCommunityBossRewards("christmas")
    }
];
const COMMUNITY_BOSS_EVENT = getCurrentCommunityBossEvent();
const SEASONAL_THEME_DISABLED_KEY = "disableSeasonalTheme";
const INDEX_THEME_OPTIONS = [
    { id: "default", name: "Default Ocean" },
    { id: "summer", name: "Summer Splash" },
    { id: "birthday", name: "Birthday Bash" },
    { id: "christmas", name: "Christmas Reef" },
    { id: "halloween", name: "Halloween Depths" },
    { id: "northpole", name: "North Pole" }
];
const limitedTimeXpEvent = {
    id: "june-2026-double-xp",
    label: "2x XP Event",
    multiplier: 2,
    startMs: new Date("2026-06-26T17:00:00+01:00").getTime(),
    endMs: new Date("2026-06-29T17:00:00+01:00").getTime()
};
const crateDefinitions = {
    reef: {
        id: "reef",
        name: "Cosmetic Crate",
        icon: "fa-box-open"
    },
    summer: {
        id: "summer",
        name: "Summer Crate",
        icon: "fa-umbrella-beach"
    },
    christmas: {
        id: "christmas",
        name: "Christmas Crate",
        icon: "fa-gift"
    },
    halloween: {
        id: "halloween",
        name: "Halloween Crate",
        icon: "fa-ghost"
    }
};

const crateAchievementIds = {
    reef: "crate_opened",
    summer: "summer_crate_opened",
    christmas: "christmas_crate_opened",
    halloween: "halloween_crate_opened"
};

const crateRarityWeights = {
    common: 58,
    rare: 28,
    epic: 10,
    legendary: 4
};
const CRATE_LEGENDARY_PITY_THRESHOLD = 25;
const SHARK_TAXONOMY_COMMON_NAMES = [
    { scientific: "Carcharhiniformes", Common: "Ground Sharks" },
    { scientific: "Orectolobiformes", Common: "Carpet Sharks" },
    { scientific: "Lamniformes", Common: "Mackerel Sharks" },
    { scientific: "Heterodontiformes", Common: "Bullhead Sharks" },
    { scientific: "Squantiniformes", Common: "Angel Sharks" },
    { scientific: "Pristiophoriformes", Common: "Saw Sharks" },
    { scientific: "Squaliformes", Common: "Dog Fish" },
    { scientific: "Hexanchiformes", Common: "Cow and Frilled Sharks" },
    { scientific: "Sphyrnidae", Common: "Hammerhead Sharks" },
    { scientific: "Carcharhinidae", Common: "Requiem Sharks" },
    { scientific: "Stegostinatidae", Common: "Zebra Sharks" },
    { scientific: "Rhincodontidae", Common: "Whale Sharks" },
    { scientific: "Orectolobidae", Common: "Wobbegong Sharks" },
    { scientific: "Hemiscylliidae", Common: "Bamboo Sharks" },
    { scientific: "Ginglymostomatidae", Common: "Nurse Sharks" },
    { scientific: "Dalatiidae", Common: "Kitefin Sharks" },
    { scientific: "Etmopteridae", Common: "Lantern Sharks" },
    { scientific: "Echinorhinidae", Common: "Bramble Sharks" },
    { scientific: "Odontaspididae", Common: "Sand Tiger Sharks" },
    { scientific: "Megachasmidae", Common: "Megamouth Sharks" },
    { scientific: "Lamnidae", Common: "Mackerel Sharks" },
    { scientific: "Hexanchidae", Common: "Cow Sharks" },
    { scientific: "Centrophoridae", Common: "Gulper Sharks" },
    { scientific: "Pristiophoridae", Common: "Saw Sharks" },
    { scientific: "Squatinidae", Common: "Angel Sharks" },
    { scientific: "Heterodontidae", Common: "Bullhead Sharks" },
    { scientific: "Alopiidae", Common: "Thresher Sharks" },
    { scientific: "Cetorhinidae", Common: "Basking Sharks" },
    { scientific: "Mitsukurinidae", Common: "Goblin Sharks" },
    { scientific: "Brachaeluridae", Common: "Blind Sharks" },
    { scientific: "Chlamydoselachidae", Common: "Frilled Sharks" },
    { scientific: "Pseudocarchariidae", Common: "Crocodile Sharks" },
    { scientific: "Somniosidae", Common: "Sleeper Sharks" },
    { scientific: "Pentachidae", Common: "Deep-Sea CatSharks" },
    { scientific: "Glyphis", Common: "River Sharks" },
    { scientific: "Haploblepharus", Common: "ShySharks" }
];

function getSharkTaxonomyCommonName(scientificName = "") {
    const value = String(scientificName || "").trim();
    if (!value) return "";
    return SHARK_TAXONOMY_COMMON_NAMES.find(entry => entry.scientific === value)?.Common || "";
}

window.SHARK_TAXONOMY_COMMON_NAMES = SHARK_TAXONOMY_COMMON_NAMES;
window.getSharkTaxonomyCommonName = getSharkTaxonomyCommonName;

const crateDuplicateXpRewards = {
    common: 40,
    rare: 85,
    epic: 160,
    legendary: 320
};
const STREAK_SHIELD_ITEM_ID = "streak-shield";

const crateRewardPool = [
    { id: "crate-pfp-pyjama", type: "pfp", name: "Pyjama Shark", imagePath: "images/cratePfp/Shark24.png", rarity: "common", blurb: "Unlock the Pyjama Shark profile picture." },
    { id: "crate-badge-reef-glint", type: "badge", badgeId: "reef-glint", name: "Driftwood", rarity: "common", blurb: "Unlock the Driftwood badge." },
    { id: "crate-pfp-japanese-bullhead", type: "pfp", name: "Japanese Bullhead Shark", imagePath: "images/cratePfp/Shark25.png", rarity: "rare", blurb: "Unlock the Japanese Bullhead Shark profile picture." },
    { id: "crate-badge-kelp-warden", type: "badge", badgeId: "kelp-warden", name: "Smelly Boot", rarity: "rare", blurb: "Unlock the Smelly Boot badge." },
    { id: "crate-theme-volcanic-ember", type: "theme", themeId: "volcanic-ember", name: "Volcanic Ember", rarity: "rare", blurb: "Unlock the Volcanic Ember theme." },
    { id: "crate-pfp-frilled", type: "pfp", name: "Frilled Shark", imagePath: "images/cratePfp/Shark23.png", rarity: "epic", blurb: "Unlock the Frilled Shark profile picture." },
    { id: "crate-badge-trench-myth", type: "badge", badgeId: "trench-myth", name: "Message Bottle", rarity: "epic", blurb: "Unlock the Message Bottle badge." },
    { id: "crate-item-streak-shield", type: "item", itemId: STREAK_SHIELD_ITEM_ID, quantity: 1, emoji: "🛡️", name: "Streak Shield", rarity: "epic", blurb: "Protects your win streak from one loss. Auto-activates when needed." },
    { id: "crate-theme-kelp-canopy", type: "theme", themeId: "kelp-canopy", name: "Kelp Canopy", rarity: "epic", blurb: "Unlock the Kelp Canopy theme." },
    { id: "crate-pfp-megamouth", type: "pfp", name: "Megamouth Shark", imagePath: "images/cratePfp/Shark22.png", rarity: "legendary", blurb: "Unlock the Megamouth Shark profile picture." },
    { id: "crate-badge-aurora-fin", type: "badge", badgeId: "aurora-fin", name: "Doubloon", rarity: "legendary", blurb: "Unlock the Doubloon badge." },
    { id: "crate-theme-glacier-shine", type: "theme", themeId: "glacier-shine", name: "Glacier Shine", rarity: "legendary", blurb: "Unlock the Glacier Shine theme." }
];

const summerCrateRewardPool = [
    { id: "crate-pfp-leopard", type: "pfp", name: "Leopard Shark", imagePath: "images/cratePfp/SummerPfp/Shark1.png", rarity: "common", blurb: "Unlock the Leopard Shark profile picture." },
    { id: "crate-badge-tidepool", type: "badge", badgeId: "Tidepool", name: "Tidepool", rarity: "common", blurb: "Unlock the Tidepool badge from the summer crate." },
    { id: "crate-pfp-whale", type: "pfp", name: "Whale Shark", imagePath: "images/cratePfp/SummerPfp/Shark2.png", rarity: "rare", blurb: "Unlock the Whale Shark profile picture." },
    { id: "crate-badge-ice-cream", type: "badge", badgeId: "Ice Cream", name: "Ice Cream", rarity: "rare", blurb: "Unlock the Ice Cream badge from the summer crate." },
    { id: "crate-theme-ocean-breeze", type: "theme", themeId: "ocean-breeze", name: "Ocean Breeze", rarity: "rare", blurb: "Unlock the Ocean Breeze theme." },
    { id: "crate-pfp-sandTiger", type: "pfp", name: "Sand Tiger Shark", imagePath: "images/cratePfp/SummerPfp/Shark3.png", rarity: "epic", blurb: "Unlock the Sand Tiger Shark profile picture." },
    { id: "crate-badge-horizon", type: "badge", badgeId: "Horizon", name: "Horizon", rarity: "epic", blurb: "Unlock the Horizon badge from the summer crate." },
    { id: "crate-theme-horizonflare", type: "theme", themeId: "horizonflare", name: "Horizon Flare", rarity: "epic", blurb: "Unlock the Horizon Flare theme." },
    { id: "crate-pfp-sandbar", type: "pfp", name: "Sandbar Shark", imagePath: "images/cratePfp/SummerPfp/Shark4.png", rarity: "legendary", blurb: "Unlock the Sandbar Shark profile picture." },
    { id: "crate-badge-paradise", type: "badge", badgeId: "Paradise", name: "Paradise", rarity: "legendary", blurb: "Unlock the Paradise badge from the summer crate." },
    { id: "crate-theme-solsticeglow", type: "theme", themeId: "solsticeglow", name: "Solstice Glow", rarity: "legendary", blurb: "Unlock the Solstice Glow theme." }
];

const christmasCrateRewardPool = [
    { id: "crate-pfp-wobbegong", type: "pfp", name: "Wobbegong Shark", imagePath: "images/cratePfp/ChristmasPfp/Shark1.png", rarity: "common", blurb: "Unlock the Wobbegong Shark profile picture." },
    { id: "crate-badge-christmas", type: "badge", badgeId: "Christmas", name: "Christmas", rarity: "common", blurb: "Unlock the Christmas badge from the christmas crate." },
    { id: "crate-pfp-blind", type: "pfp", name: "Blind Shark", imagePath: "images/cratePfp/ChristmasPfp/Shark2.png", rarity: "rare", blurb: "Unlock the Blind Shark profile picture." },
    { id: "crate-badge-present", type: "badge", badgeId: "Present", name: "Present", rarity: "rare", blurb: "Unlock the Present badge from the christmas crate." },
    { id: "crate-theme-elf", type: "theme", themeId: "elf", name: "Elf", rarity: "rare", blurb: "Unlock the Elf Profile theme." },
    { id: "crate-pfp-carribbean", type: "pfp", name: "Carribbean Reef Shark", imagePath: "images/cratePfp/ChristmasPfp/Shark3.png", rarity: "epic", blurb: "Unlock the Carribbean Reef Shark profile picture." },
    { id: "crate-badge-snowflake", type: "badge", badgeId: "Snowflake", name: "Snowflake", rarity: "epic", blurb: "Unlock the Snowflake badge from the christmas crate." },
    { id: "crate-theme-candycane", type: "theme", themeId: "candycane", name: "Candy Cane", rarity: "epic", blurb: "Unlock the Candy Cane Profile theme." },
    { id: "crate-pfp-rough", type: "pfp", name: "Carribbean Rough Shark", imagePath: "images/cratePfp/ChristmasPfp/Shark4.png", rarity: "legendary", blurb: "Unlock the Carribbean Rough Shark profile picture." },
    { id: "crate-badge-santa", type: "badge", badgeId: "Santa", name: "Santa", rarity: "legendary", blurb: "Unlock the Santa badge from the christmas crate." },
    { id: "crate-theme-north-pole", type: "theme", themeId: "north-pole", name: "North Pole", rarity: "legendary", blurb: "Unlock the North Pole theme." }
];

const halloweenCrateRewardPool = [
    { id: "crate-pfp-chain-cat", type: "pfp", name: "Chain Catshark", imagePath: "images/cratePfp/HalloweenPfp/Shark1.png", rarity: "common", blurb: "Unlock the Chain Catshark profile picture." },
    { id: "crate-badge-pumpkin", type: "badge", badgeId: "Pumpkin", name: "Pumpkin", rarity: "common", blurb: "Unlock the Pumpkin badge from the halloween crate." },
    { id: "crate-pfp-bamboo", type: "pfp", name: "Bamboo Shark", imagePath: "images/cratePfp/HalloweenPfp/Shark2.png", rarity: "rare", blurb: "Unlock the Bamboo Shark profile picture." },
    { id: "crate-badge-bat", type: "badge", badgeId: "Bat", name: "Bat", rarity: "rare", blurb: "Unlock the Bat badge from the halloween crate." },
    { id: "crate-theme-pumpkin-patch", type: "theme", themeId: "pumpkin-patch", name: "Goo", rarity: "rare", blurb: "Unlock the Goo profile theme." },
    { id: "crate-pfp-white", type: "pfp", name: "White Shark", imagePath: "images/cratePfp/HalloweenPfp/Shark3.png", rarity: "epic", blurb: "Unlock the White Shark profile picture." },
    { id: "crate-badge-ghost", type: "badge", badgeId: "Ghost", name: "Ghost", rarity: "epic", blurb: "Unlock the Ghost badge from the halloween crate." },
    { id: "crate-theme-haunted-abyss", type: "theme", themeId: "haunted-abyss", name: "Witchlight", rarity: "epic", blurb: "Unlock the Witchlight profile theme." },
    { id: "crate-pfp-cookie", type: "pfp", name: "Cookie Cutter Shark", imagePath: "images/cratePfp/HalloweenPfp/Shark4.png", rarity: "legendary", blurb: "Unlock the Cookie Cutter Shark profile picture." },
    { id: "crate-badge-vampire", type: "badge", badgeId: "Vampire", name: "Vampire", rarity: "legendary", blurb: "Unlock the Vampire badge from the halloween crate." },
    { id: "crate-theme-nightmare-reef", type: "theme", themeId: "nightmare-reef", name: "Phantom Fog", rarity: "legendary", blurb: "Unlock the Phantom Fog profile theme." }
];

let crateOpeningInProgress = false;
let pendingProfileSyncTimeout = null;
let pendingAuthStateClearTimeout = null;
let globalXpEventOverride = null;
let globalXpEventUnsubscribe = null;
let globalIndexThemeUnsubscribe = null;
let communityBossUnsubscribe = null;
let communityBossState = null;
let communityBossUiTimer = null;
let cloudProfileReloadTimeouts = [];
let lastServerHydratedProfileUid = null;
const CLOUD_PROFILE_RELOAD_DELAYS_MS = [1200, 4000, 9000];

const sharkPassRewards = [
    { level: 2, type: "pfp", name: "Angel Shark", imagePath: "images/levelPfp/Shark6.png", rarity: "common", blurb: "A fresh portrait reward for early progress." },
    { level: 3, type: "badge", name: "Shiver", badgeId: "reef-scout", rarity: "common", blurb: "Your first Shark Pass badge unlock." },
    { level: 4, type: "pfp", name: "Blacktip Reef Shark", imagePath: "images/levelPfp/Shark8.png", rarity: "common", blurb: "A sharper reef-side profile picture." },
    { level: 5, type: "badge", name: "Pup", badgeId: "bronze-fin", rarity: "common", blurb: "A calm early-pass badge for steady progress." },
    { level: 6, type: "pfp", name: "Thresher Shark", imagePath: "images/levelPfp/Shark10.png", rarity: "rare", blurb: "A sleeker PFP for your collection." },
    { level: 7, type: "theme", name: "Tidal Blue", themeId: "tidal-blue", rarity: "rare", blurb: "Unlock a new profile card theme." },
    { level: 8, type: "pfp", name: "Epaulette Shark", imagePath: "images/levelPfp/Shark12.png", rarity: "rare", blurb: "One of the standout Shark Pass portraits." },
    { level: 8, type: "badge", name: "Juvenile", badgeId: "night-diver", rarity: "rare", blurb: "A moonlit shark badge for deeper runs." },
    { level: 10, type: "pfp", name: "Nurse Shark", imagePath: "images/levelPfp/Shark14.png", rarity: "epic", blurb: "A milestone portrait with more weight to it." },
    { level: 10, type: "badge", name: "Oceanic", badgeId: "abyss-explorer", rarity: "epic", blurb: "A standout badge for committed players." },
    { level: 12, type: "badge", name: "Subadult", badgeId: "open-water-ace", rarity: "epic", blurb: "A strong mid-pass badge unlock." },
    { level: 15, type: "pfp", name: "Oceanic Whitetip", imagePath: "images/levelPfp/Shark15.png", rarity: "legendary", blurb: "A premium-feeling portrait without premium nonsense." },
    { level: 15, type: "theme", name: "Sunken Gold", themeId: "sunken-gold", rarity: "legendary", blurb: "A warmer, trophy-like profile treatment." },
    { level: 18, type: "badge", name: "Prime", badgeId: "storm-tracker", rarity: "legendary", blurb: "For players who stuck with the grind." },
    { level: 20, type: "pfp", name: "Mako Shark", imagePath: "images/levelPfp/Shark16.png", rarity: "legendary", blurb: "The capstone Shark Pass portrait." },
    { level: 20, type: "badge", name: "Apex", badgeId: "apex-voyager", rarity: "legendary", blurb: "The final Shark Pass badge." },
    { level: 22, type: "badge", name: "Current Rider", badgeId: "current-rider", rarity: "epic", blurb: "A seasonal Shark Pass badge for pushing past the old track." },
    { level: 24, type: "theme", name: "Reef Rush", themeId: "reef-rush", rarity: "epic", blurb: "A bright profile card theme from the active season." },
    { level: 26, type: "badge", name: "Tidebreaker", badgeId: "tidebreaker", rarity: "legendary", blurb: "A late-season badge for serious XP runs." },
    { level: 28, type: "crate", name: "Summer Crate", crateId: "summer", crateCount: 1, rarity: "legendary", blurb: "A bonus summer cosmetic crate milestone." },
    { level: 30, type: "theme", name: "Abyssal Current", themeId: "abyssal-current", rarity: "legendary", blurb: "The season capstone profile theme." }
];

const SHARK_PASS_ACTIVE_SEASON_ID = "reef-rush-2026";

const sharkPassSeasons = [
    {
        id: SHARK_PASS_ACTIVE_SEASON_ID,
        name: "Reef Rush",
        subtitle: "Season 1",
        startsAt: "2026-06-01T00:00:00Z",
        endsAt: "2026-08-31T23:59:59Z",
        theme: "Reef Rush",
        dailyQuests: [
            { id: "daily-first-fin", title: "First Fin", description: "Play 1 Sharkdle game today.", metric: "gamesPlayed", goal: 1, xp: 180, icon: "fa-gamepad" },
            { id: "daily-clean-catch", title: "Clean Catch", description: "Win 1 daily game today.", metric: "dailyWins", goal: 1, xp: 260, icon: "fa-calendar-check", progressMode: "absolute" },
            { id: "daily-xp-splash", title: "XP Splash", description: "Earn 500 XP today.", metric: "totalXP", goal: 500, xp: 320, icon: "fa-bolt" }
        ],
        weeklyQuests: [
            { id: "weekly-patrol", title: "Weekly Patrol", description: "Play 10 games this week.", metric: "gamesPlayed", goal: 10, xp: 1000, icon: "fa-compass" },
            { id: "weekly-win-current", title: "Win Current", description: "Win 5 games this week.", metric: "wins", goal: 5, xp: 1400, icon: "fa-trophy" },
            { id: "weekly-research-surge", title: "Research Surge", description: "Earn 3,500 XP this week.", metric: "totalXP", goal: 3500, xp: 1800, icon: "fa-book-open" }
        ],
        seasonQuests: [
            { id: "season-first-current", title: "First Current", description: "Play 3 games this season.", metric: "gamesPlayed", goal: 3, xp: 450, icon: "fa-gamepad" },
            { id: "season-reef-wins", title: "Reef Wins", description: "Win 5 games this season.", metric: "wins", goal: 5, xp: 900, icon: "fa-trophy" },
            { id: "season-daily-scout", title: "Daily Scout", description: "Win 2 daily games during the season.", metric: "dailyWins", goal: 2, xp: 700, icon: "fa-calendar-check", progressMode: "absolute" },
            { id: "season-streak-signal", title: "Streak Signal", description: "Reach a 3 win streak.", metric: "highestStreak", goal: 3, xp: 850, icon: "fa-fire", progressMode: "absolute" },
            { id: "season-deep-research", title: "Deep Research", description: "Earn 7,500 XP this season.", metric: "totalXP", goal: 7500, xp: 1200, icon: "fa-book-open" },
            { id: "season-crate-current", title: "Crate Current", description: "Open 2 cosmetic crates this season.", metric: "cratesOpened", goal: 2, xp: 1000, icon: "fa-box-open" },
            { id: "season-shiver-run", title: "Shiver Run", description: "Play 20 games this season.", metric: "gamesPlayed", goal: 20, xp: 1800, icon: "fa-water" },
            { id: "season-apex-hunt", title: "Apex Hunt", description: "Win 15 games this season.", metric: "wins", goal: 15, xp: 2400, icon: "fa-crown" },
            { id: "season-treasure-tide", title: "Treasure Tide", description: "Open 5 cosmetic crates this season.", metric: "cratesOpened", goal: 5, xp: 2100, icon: "fa-box-open" },
            { id: "season-master-current", title: "Master Current", description: "Earn 25,000 XP this season.", metric: "totalXP", goal: 25000, xp: 4200, icon: "fa-star" }
        ]
    }
];

const sharkPassBadgeMeta = {
    "reef-scout": { emoji: "\u{1F988}" },
    "bronze-fin": { emoji: "\u{1FA78}" },
    "night-diver": { emoji: "\u{1F319}" },
    "abyss-explorer": { emoji: "\u{1F499}" },
    "open-water-ace": { emoji: "\u{2728}" },
    "storm-tracker": { emoji: "\u{26A1}" },
    "apex-voyager": { emoji: "\u{1F451}" },
    "reef-glint": { emoji: "🐚" },
    "kelp-warden": { emoji: "🌿" },
    "trench-myth": { emoji: "⚓" },
    "aurora-fin": { emoji: "🌊" },
    "Tidepool": { emoji: "🌀" },
    "Ice Cream": { emoji: "🍦" },
    "Horizon": { emoji: "🌅" },
    "Summer": { emoji: "🌴" },
    "Christmas": { emoji: "🎄" },
    "Present": { emoji: "🎁" },
    "Snowflake": { emoji: "❄️" },
    "Santa": { emoji: "🎅" },
};

const badgeRarityMeta = {
    core: { label: "Core", className: "core" },
    code: { label: "Code", className: "code" },
    special: { label: "Special", className: "special" },
    event: { label: "Event", className: "event" },
    common: { label: "Common", className: "common" },
    rare: { label: "Rare", className: "rare" },
    epic: { label: "Epic", className: "epic" },
    legendary: { label: "Legendary", className: "legendary" }
};

const sharkPassBadgeTiers = {
    "reef-scout": 1,
    "bronze-fin": 2,
    "night-diver": 2,
    "abyss-explorer": 3,
    "open-water-ace": 3,
    "storm-tracker": 4,
    "apex-voyager": 5,
    "current-rider": 4,
    "tidebreaker": 5,
    "reef-glint": 1,
    "kelp-warden": 2,
    "trench-myth": 4,
    "aurora-fin": 5
};

Object.assign(sharkPassBadgeMeta, {
    "reef-scout": { emoji: "\u{1F988}" },
    "bronze-fin": { emoji: "\u{1FA78}" },
    "night-diver": { emoji: "\u{1F319}" },
    "abyss-explorer": { emoji: "\u{1F499}" },
    "open-water-ace": { emoji: "\u{2728}" },
    "storm-tracker": { emoji: "\u{26A1}" },
    "apex-voyager": { emoji: "\u{1F451}" },
    "current-rider": { emoji: "\u{1F30A}" },
    "tidebreaker": { emoji: "\u{1F4AB}" },
    "reef-glint": { emoji: "🐚" },
    "kelp-warden": { emoji: "🌿" },
    "trench-myth": { emoji: "⚓" },
    "aurora-fin": { emoji: "🌊" },
    "Beachball": { emoji: "🏖️" },
    "SunHat": { emoji: "👒" },
    "Pineapple": { emoji: "🍍" },
    "Coconut": { emoji: "🥥" }
});

function getCurrentProfileData() {
    if (typeof getBestLocalProfile === "function") {
        return getBestLocalProfile();
    }
    return JSON.parse(localStorage.getItem("userProfile") || "{}");
}

window.getCurrentProfileData = getCurrentProfileData;

function getCurrentPlayerLevel(profileData = getCurrentProfileData()) {
    return getLevelFromXP(profileData.totalXP || 0);
}

function getUnlockedPassRewards(profileData = getCurrentProfileData()) {
    const level = getCurrentPlayerLevel(profileData);
    return sharkPassRewards.filter(reward => level >= reward.level);
}

function getActiveSharkPassSeason(now = Date.now()) {
    return sharkPassSeasons.find(season => {
        const startMs = Date.parse(season.startsAt);
        const endMs = Date.parse(season.endsAt);
        return Number.isFinite(startMs) && Number.isFinite(endMs) && now >= startMs && now <= endMs;
    }) || sharkPassSeasons[0];
}

function getSharkPassMissionClaims(profileData = getCurrentProfileData(), seasonId = getActiveSharkPassSeason()?.id) {
    const seasonClaims = profileData.sharkPassMissionClaims;
    if (!seasonClaims || typeof seasonClaims !== "object" || !seasonId) return [];
    return Array.isArray(seasonClaims[seasonId]) ? seasonClaims[seasonId] : [];
}

function getSharkPassWeeklyKey(now = Date.now()) {
    const date = new Date(now);
    const utcDay = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - utcDay);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function getSharkPassQuestPeriodKey(group, season = getActiveSharkPassSeason(), now = Date.now()) {
    if (group === "daily") {
        return typeof getUtcDateKey === "function" ? getUtcDateKey() : new Date(now).toISOString().slice(0, 10);
    }
    if (group === "weekly") {
        return getSharkPassWeeklyKey(now);
    }
    return season?.id || SHARK_PASS_ACTIVE_SEASON_ID;
}

function getSharkPassQuestGroups(season = getActiveSharkPassSeason()) {
    return [
        {
            id: "daily",
            label: "Daily",
            cadence: "Resets daily",
            quests: Array.isArray(season.dailyQuests) ? season.dailyQuests : []
        },
        {
            id: "weekly",
            label: "Weekly",
            cadence: "Resets weekly",
            quests: Array.isArray(season.weeklyQuests) ? season.weeklyQuests : []
        },
        {
            id: "season",
            label: "Season",
            cadence: "Runs all season",
            quests: Array.isArray(season.seasonQuests) ? season.seasonQuests : (Array.isArray(season.missions) ? season.missions : [])
        }
    ];
}

function getSharkPassQuestClaimKey(quest) {
    return `${quest.group}:${quest.periodKey}:${quest.id}`;
}

function getSharkPassSeasonQuestList(season = getActiveSharkPassSeason()) {
    return getSharkPassQuestGroups(season).flatMap(group => {
        const periodKey = getSharkPassQuestPeriodKey(group.id, season);
        return group.quests.map(quest => ({
            ...quest,
            group: group.id,
            groupLabel: group.label,
            cadence: group.cadence,
            periodKey
        }));
    });
}

function ensureSharkPassSeasonBaseline(profileData = getCurrentProfileData(), season = getActiveSharkPassSeason()) {
    if (!season?.id) return {};
    const baselines = profileData.sharkPassSeasonBaselines && typeof profileData.sharkPassSeasonBaselines === "object"
        ? { ...profileData.sharkPassSeasonBaselines }
        : {};
    const quests = getSharkPassSeasonQuestList(season);
    let changed = false;

    quests.forEach(quest => {
        if (quest.progressMode === "absolute") return;
        const baselineKey = `${quest.group}:${quest.periodKey}`;
        if (!baselines[baselineKey] || typeof baselines[baselineKey] !== "object") {
            baselines[baselineKey] = {};
        }
        if (baselines[baselineKey][quest.metric] === undefined) {
            baselines[baselineKey][quest.metric] = Number(profileData?.[quest.metric]) || 0;
            changed = true;
        }
    });

    if (changed) {
        profileData.sharkPassSeasonBaselines = baselines;
        profileData.sharkPassSeasonId = season.id;
        saveUserProfileLocally(profileData);
    }

    return baselines;
}

function getSharkPassMissionProgress(profileData, mission) {
    if (!mission) return 0;
    const season = getActiveSharkPassSeason();
    const baseline = mission.progressMode === "absolute"
        ? 0
        : Number(ensureSharkPassSeasonBaseline(profileData, season)?.[`${mission.group}:${mission.periodKey}`]?.[mission.metric]) || 0;
    const value = Math.max(0, (Number(profileData?.[mission.metric]) || 0) - baseline);
    return Math.max(0, Math.min(value, mission.goal));
}

function getSharkPassSeasonState(profileData = getCurrentProfileData()) {
    const season = getActiveSharkPassSeason();
    const claimedMissionIds = getSharkPassMissionClaims(profileData, season.id);
    const missions = getSharkPassSeasonQuestList(season).map(mission => {
        const progress = getSharkPassMissionProgress(profileData, mission);
        const claimKey = getSharkPassQuestClaimKey(mission);
        return {
            ...mission,
            claimKey,
            progress,
            complete: progress >= mission.goal,
            claimed: claimedMissionIds.includes(claimKey) || claimedMissionIds.includes(mission.id)
        };
    });
    const groups = getSharkPassQuestGroups(season).map(group => {
        const groupMissions = missions.filter(mission => mission.group === group.id);
        return {
            ...group,
            periodKey: getSharkPassQuestPeriodKey(group.id, season),
            missions: groupMissions,
            completedCount: groupMissions.filter(mission => mission.complete).length,
            claimedCount: groupMissions.filter(mission => mission.claimed).length,
            claimableXp: groupMissions
                .filter(mission => mission.complete && !mission.claimed)
                .reduce((sum, mission) => sum + (Number(mission.xp) || 0), 0)
        };
    });
    return {
        season,
        missions,
        groups,
        claimedMissionIds,
        completedCount: missions.filter(mission => mission.complete).length,
        claimedCount: missions.filter(mission => mission.claimed).length,
        totalMissionXp: missions.reduce((sum, mission) => sum + (Number(mission.xp) || 0), 0),
        claimableXp: missions
            .filter(mission => mission.complete && !mission.claimed)
            .reduce((sum, mission) => sum + (Number(mission.xp) || 0), 0)
    };
}

async function claimSharkPassMission(missionId) {
    const profileData = getCurrentProfileData();
    const passState = getSharkPassSeasonState(profileData);
    const mission = passState.missions.find(item => item.id === missionId || item.claimKey === missionId);

    if (!mission) {
        showNotification("Quest not found for this season.", "error", 3000);
        return false;
    }
    if (!mission.complete) {
        showNotification("Finish the quest first, then claim the XP.", "info", 3000);
        return false;
    }
    if (mission.claimed) {
        showNotification("You already claimed this quest.", "info", 3000);
        return false;
    }

    const seasonId = passState.season.id;
    const claims = profileData.sharkPassMissionClaims && typeof profileData.sharkPassMissionClaims === "object"
        ? { ...profileData.sharkPassMissionClaims }
        : {};
    const seasonClaims = Array.isArray(claims[seasonId]) ? [...claims[seasonId]] : [];
    seasonClaims.push(mission.claimKey || getSharkPassQuestClaimKey(mission));
    claims[seasonId] = [...new Set(seasonClaims)];

    const xpAward = typeof window.applyLimitedTimeXpBonus === "function"
        ? window.applyLimitedTimeXpBonus(mission.xp)
        : { totalXp: mission.xp, multiplier: 1, baseXp: mission.xp };

    profileData.totalXP = (Number(profileData.totalXP) || 0) + xpAward.totalXp;
    profileData.sharkPassMissionClaims = claims;
    profileData.sharkPassSeasonId = seasonId;
    saveUserProfileLocally(profileData, { skipRemoteSync: true });

    if (currentUser && db) {
        await db.collection("userStats").doc(currentUser.uid).set({
            totalXP: profileData.totalXP,
            sharkPassMissionClaims: claims,
            sharkPassSeasonBaselines: profileData.sharkPassSeasonBaselines || {},
            sharkPassSeasonId: seasonId,
            lastUpdated: Date.now()
        }, { merge: true });
    }

    await syncSharkPassLevelRewards(profileData);

    if (typeof syncEarnedCosmetics === "function" && currentUser) {
        syncEarnedCosmetics().catch(error => console.warn("Unable to sync Shark Pass rewards after mission claim:", error));
    }
    updateProfileDisplay(profileData);
    showNotification(`Quest claimed: +${xpAward.totalXp} XP${xpAward.multiplier > 1 ? ` (${xpAward.multiplier}x)` : ""}`, "success", 3600);
    return true;
}

window.getActiveSharkPassSeason = getActiveSharkPassSeason;
window.getSharkPassSeasonState = getSharkPassSeasonState;
window.claimSharkPassMission = claimSharkPassMission;

async function syncSharkPassLevelRewards(profileData = getCurrentProfileData()) {
    const playerLevel = getCurrentPlayerLevel(profileData);
    const claimableLevelRewards = sharkPassRewards.filter(reward =>
        reward.type === "crate" && reward.level <= playerLevel
    );
    if (!claimableLevelRewards.length) return { changed: false, profileData };

    const claimedRewards = Array.isArray(profileData.sharkPassLevelRewardClaims)
        ? [...profileData.sharkPassLevelRewardClaims]
        : [];
    let changed = false;
    const inventory = getCrateInventory(profileData);

    claimableLevelRewards.forEach(reward => {
        const rewardClaimId = `${reward.level}:${reward.type}:${reward.crateId || reward.name}`;
        if (claimedRewards.includes(rewardClaimId)) return;
        const crateId = reward.crateId || "reef";
        const crateCount = Math.max(1, Number(reward.crateCount) || 1);
        inventory[crateId] = (inventory[crateId] || 0) + crateCount;
        claimedRewards.push(rewardClaimId);
        changed = true;
    });

    if (!changed) return { changed: false, profileData };

    profileData.crateInventory = normalizeCrateInventory(inventory);
    profileData.sharkPassLevelRewardClaims = claimedRewards;
    saveUserProfileLocally(profileData, { skipRemoteSync: true });

    if (currentUser && db) {
        await db.collection("userStats").doc(currentUser.uid).set({
            crateInventory: profileData.crateInventory,
            sharkPassLevelRewardClaims: claimedRewards,
            lastUpdated: Date.now()
        }, { merge: true });
    }

    if (typeof renderCratesButton === "function") {
        renderCratesButton();
    }
    return { changed: true, profileData };
}

window.syncSharkPassLevelRewards = syncSharkPassLevelRewards;

function getClaimedAchievementIds() {
    return JSON.parse(localStorage.getItem("claimedAchievements") || "[]");
}

async function syncUnlockedAchievementToFirebase(achievementId, fallbackUnlockedAchievements = []) {
    if (!currentUser || !db || !achievementId) return;
    try {
        const fieldValue = typeof firebase !== "undefined"
            && firebase.firestore
            && firebase.firestore.FieldValue
            ? firebase.firestore.FieldValue
            : null;
        const payload = fieldValue?.arrayUnion
            ? { unlockedAchievements: fieldValue.arrayUnion(achievementId) }
            : { unlockedAchievements: fallbackUnlockedAchievements };
        await db.collection("userStats").doc(currentUser.uid).set(payload, { merge: true });
    } catch (error) {
        console.warn("Unable to sync achievement unlock:", error);
    }
}

window.syncUnlockedAchievementToFirebase = syncUnlockedAchievementToFirebase;

function getAchievementUnlockedThemeIds(claimedAchievements = getClaimedAchievementIds()) {
    return sharkPassCardThemes
        .filter(theme => theme.unlockAchievement && claimedAchievements.includes(theme.unlockAchievement))
        .map(theme => theme.id);
}

function syncAchievementThemeUnlocks(profileData = getCurrentProfileData()) {
    const claimedAchievements = getClaimedAchievementIds();
    const achievementThemeIds = getAchievementUnlockedThemeIds(claimedAchievements);
    const storedThemeIds = Array.isArray(profileData.unlockedCardThemes) ? profileData.unlockedCardThemes : [];
    const mergedThemeIds = [...new Set(["default", ...storedThemeIds, ...achievementThemeIds])];
    const hadAllThemes = mergedThemeIds.length === storedThemeIds.length
        && mergedThemeIds.every(themeId => storedThemeIds.includes(themeId));

    if (!hadAllThemes) {
        profileData.unlockedCardThemes = mergedThemeIds;
        saveUserProfileLocally(profileData, { skipRemoteSync: true });
    }

    return {
        profileData,
        changed: !hadAllThemes,
        unlockedThemeIds: mergedThemeIds
    };
}

window.syncAchievementThemeUnlocks = syncAchievementThemeUnlocks;

function getUnlockedCardThemes(profileData = getCurrentProfileData()) {
    const normalizedProfile = syncAchievementThemeUnlocks(profileData).profileData;
    const level = getCurrentPlayerLevel(normalizedProfile);
    const storedThemeIds = Array.isArray(normalizedProfile.unlockedCardThemes) ? normalizedProfile.unlockedCardThemes : [];
    const claimedAchievementThemeIds = getAchievementUnlockedThemeIds();

    const unlockedThemeIds = new Set(["default", ...storedThemeIds, ...claimedAchievementThemeIds]);
    sharkPassCardThemes.forEach(theme => {
        if (typeof theme.level === "number" && level >= theme.level) {
            unlockedThemeIds.add(theme.id);
        }
    });

    return sharkPassCardThemes.filter(theme => unlockedThemeIds.has(theme.id));
}

function getStoredUnlockedBadgeIds(profileData = getCurrentProfileData()) {
    return Array.isArray(profileData.unlockedBadges) ? profileData.unlockedBadges : [];
}

function normalizeCrateInventory(rawInventory) {
    return {
        reef: Math.max(0, Number(rawInventory?.reef) || 0),
        summer: Math.max(0, Number(rawInventory?.summer) || 0),
        christmas: Math.max(0, Number(rawInventory?.christmas) || 0),
        halloween: Math.max(0, Number(rawInventory?.halloween) || 0)
    };
}

function mergeCrateInventory(localInventory, remoteInventory) {
    const local = normalizeCrateInventory(localInventory);
    const remote = normalizeCrateInventory(remoteInventory);
    return {
        reef: Math.max(local.reef, remote.reef),
        summer: Math.max(local.summer, remote.summer),
        christmas: Math.max(local.christmas, remote.christmas),
        halloween: Math.max(local.halloween, remote.halloween)
    };
}

function getCrateInventory(profileData = getCurrentProfileData()) {
    return normalizeCrateInventory(profileData.crateInventory || {});
}

function getStreakShieldCount(profileData = getCurrentProfileData()) {
    return Math.min(3, Math.max(0, Math.floor(Number(profileData?.streakShields) || 0)));
}

const PEARLS_PER_WIN = 50;
const PEARL_BOOST_DURATION_MS = 60 * 60 * 1000;
const PEARL_SHOP_ITEMS = {
    "streak-shield": { price: 250, label: "Streak Shield" },
    "pearl-boost": { price: 500, label: "2x Pearls Boost" },
    "cosmetic-crate": { price: 500, label: "Cosmetic Crate" },
    "event-crate": { price: 750, label: "Event Crate" },
    "season-xp": { price: 3000, label: "Season 2x XP" }
};

function getPearlCount(profileData = getCurrentProfileData()) {
    return Math.max(0, Math.floor(Number(profileData?.pearls ?? profileData?.tidePearls) || 0));
}

function setPearlCount(profileData, nextAmount) {
    if (!profileData || typeof profileData !== "object") return 0;
    const normalizedAmount = Math.max(0, Math.floor(Number(nextAmount) || 0));
    profileData.pearls = normalizedAmount;
    if (Object.prototype.hasOwnProperty.call(profileData, "tidePearls")) {
        delete profileData.tidePearls;
    }
    return normalizedAmount;
}

function addPearls(amount, profileData = getCurrentProfileData(), options = {}) {
    const nextAmount = setPearlCount(profileData, getPearlCount(profileData) + amount);
    if (!options.deferSave && typeof saveUserProfileLocally === "function") {
        saveUserProfileLocally(profileData);
    }
    if (!options.deferUiUpdate && typeof updateHomeV3Sidebar === "function") {
        updateHomeV3Sidebar(profileData);
    }
    return nextAmount;
}

function getPearlBoostExpiresAt(profileData = getCurrentProfileData()) {
    return Math.max(0, Number(profileData?.pearlBoostExpiresAt) || 0);
}

function isPearlBoostActive(profileData = getCurrentProfileData(), nowMs = Date.now()) {
    return getPearlBoostExpiresAt(profileData) > nowMs;
}

function getPearlWinMultiplier(profileData = getCurrentProfileData()) {
    return isPearlBoostActive(profileData) ? 2 : 1;
}

function getSeasonXpBoosts(profileData = getCurrentProfileData()) {
    return profileData?.seasonXpBoosts && typeof profileData.seasonXpBoosts === "object"
        ? profileData.seasonXpBoosts
        : {};
}

function hasSeasonXpBoost(profileData = getCurrentProfileData(), seasonId = SHARK_PASS_ACTIVE_SEASON_ID) {
    return Boolean(getSeasonXpBoosts(profileData)[seasonId]);
}

function setSeasonXpBoost(profileData, seasonId = SHARK_PASS_ACTIVE_SEASON_ID) {
    if (!profileData || typeof profileData !== "object") return;
    profileData.seasonXpBoosts = {
        ...getSeasonXpBoosts(profileData),
        [seasonId]: true
    };
    profileData.sharkPassSeasonId = seasonId;
}

function awardPearlsForWin(profileData = getCurrentProfileData(), options = {}) {
    const baseAmount = Math.max(0, Math.floor(Number(options.amount ?? PEARLS_PER_WIN) || 0));
    const amount = baseAmount * getPearlWinMultiplier(profileData);
    if (!amount) return 0;
    addPearls(amount, profileData, options);
    return amount;
}

window.PEARLS_PER_WIN = PEARLS_PER_WIN;
window.getPearlCount = getPearlCount;
window.setPearlCount = setPearlCount;
window.addPearls = addPearls;
window.awardPearlsForWin = awardPearlsForWin;
window.isPearlBoostActive = isPearlBoostActive;
window.hasSeasonXpBoost = hasSeasonXpBoost;

function setStreakShieldCount(profileData, nextCount) {
    if (!profileData || typeof profileData !== "object") return 0;
    const normalizedCount = Math.min(3, Math.max(0, Math.floor(Number(nextCount) || 0)));
    profileData.streakShields = normalizedCount;
    return normalizedCount;
}

function applyStreakShieldOnLoss(profileData, options = {}) {
    if (!profileData || typeof profileData !== "object") return false;
    const currentStreak = Math.max(0, Number(profileData.currentStreak) || 0);
    if (currentStreak <= 0) return false;

    const availableShields = getStreakShieldCount(profileData);
    if (availableShields <= 0) return false;

    const remainingShields = setStreakShieldCount(profileData, availableShields - 1);
    if (!options.silent && typeof showNotification === "function") {
        const modeLabel = options.mode ? ` in ${options.mode}` : "";
        showNotification(`🛡️ Streak Shield activated${modeLabel}. Streak protected! (${remainingShields} left)`, "success", 4200);
    }
    if (typeof window.unlockAchievement === "function") {
        window.unlockAchievement("streak_shield_used");
    }
    return true;
}

function getCrateInstantOpenEnabled(profileData = getCurrentProfileData()) {
    return Boolean(profileData?.instantCrateOpen);
}

function getCratesSinceLegendary(profileData = getCurrentProfileData()) {
    return Math.max(0, Number(profileData?.cratesSinceLegendary) || 0);
}

function isLegendaryPityReady(profileData = getCurrentProfileData()) {
    return getCratesSinceLegendary(profileData) >= CRATE_LEGENDARY_PITY_THRESHOLD - 1;
}

function getCratesUntilLegendaryPity(profileData = getCurrentProfileData()) {
    return Math.max(0, CRATE_LEGENDARY_PITY_THRESHOLD - getCratesSinceLegendary(profileData));
}

function getOwnedCratePfpPaths(profileData = getCurrentProfileData()) {
    const ownedPaths = new Set();
    const level = getCurrentPlayerLevel(profileData);

    if (profileData.profilePicture) ownedPaths.add(profileData.profilePicture);
    (Array.isArray(profileData.earnedCosmetics) ? profileData.earnedCosmetics : []).forEach(cosmetic => {
        if (cosmetic?.imagePath) ownedPaths.add(cosmetic.imagePath);
    });
    if (Array.isArray(levelRewards)) {
        levelRewards
            .filter(reward => reward.level <= level && reward.imagePath)
            .forEach(reward => ownedPaths.add(reward.imagePath));
    }
    if (Array.isArray(sharkPassRewards)) {
        sharkPassRewards
            .filter(reward => reward.type === "pfp" && reward.level <= level && reward.imagePath)
            .forEach(reward => ownedPaths.add(reward.imagePath));
    }

    return ownedPaths;
}

function isCrateRewardOwned(profileData, reward) {
    if (reward.type === "pfp") {
        return getOwnedCratePfpPaths(profileData).has(reward.imagePath);
    }
    if (reward.type === "theme") {
        return getUnlockedCardThemes(profileData).some(theme => theme.id === reward.themeId);
    }
    if (reward.type === "badge") {
        return getUnlockedBadges(profileData.uid || currentUser?.uid || "").some(badge => badge.id === reward.badgeId);
    }
    return false;
}

function getAvailableCrateRewards(profileData = getCurrentProfileData()) {
    return crateRewardPool.filter(reward => !isCrateRewardOwned(profileData, reward));
}

function getCrateRewardsByRarity(rarity, crateId = "reef") {
    const pool = getCratePoolById(crateId);
    return pool.filter(reward => reward.rarity === rarity);
}

function getCratePoolById(crateId) {
    switch (crateId) {
        case "summer":
            return summerCrateRewardPool;
        case "christmas":
            return christmasCrateRewardPool;
        case "halloween":
            return halloweenCrateRewardPool;
        default:
            return crateRewardPool;
    }
}

const SPIN_WHEEL_LEGENDARY_PFP = {
    name: "Wheel Shark",
    imagePath: "images/pfp/shark5.png",
    spinReward: true,
    rarity: "legendary"
};

const spinWheelRewards = [
    { id: "spin_xp_250", type: "xp", amount: 250, weight: 14, label: "250 XP", wheelLabel: "250 XP", rarity: "common", color: "#5adca5", icon: "✨" },
    { id: "spin_xp_500", type: "xp", amount: 500, weight: 13, label: "500 XP", wheelLabel: "500 XP", rarity: "common", color: "#78f0c5", icon: "✨" },
    { id: "spin_xp_1000", type: "xp", amount: 1000, weight: 12, label: "1000 XP", wheelLabel: "1000 XP", rarity: "uncommon", color: "#6ee7ff", icon: "💫" },
    { id: "spin_reef_crate", type: "crate", crateId: "reef", amount: 1, weight: 14, label: "Cosmetic Crate", wheelLabel: "Crate", rarity: "uncommon", color: "#ffb74d", icon: "📦" },
    { id: "spin_summer_crate", type: "crate", crateId: "summer", amount: 1, weight: 10, label: "Summer Crate", wheelLabel: "Summer", rarity: "rare", color: "#ff8a65", icon: "☀️" },
    { id: "spin_shield", type: "item", itemId: STREAK_SHIELD_ITEM_ID, quantity: 1, weight: 10, label: "Streak Shield", wheelLabel: "Shield", rarity: "rare", color: "#a99bff", icon: "🛡️" },
    { id: "spin_pass_level", type: "pass_level", amount: 1, weight: 8, label: "Free Shark Pass Level", wheelLabel: "Pass +1", rarity: "epic", color: "#ffd47f", icon: "⬆️" },
    { id: "spin_badge", type: "badge", badgeId: "lucky-fin", name: "Lucky Fin", weight: 7, label: "Lucky Fin Badge", wheelLabel: "Badge", rarity: "epic", color: "#c9a7ff", icon: "🍀" },
    { id: "spin_theme", type: "theme", themeId: "volcanic-ember", weight: 7, label: "Volcanic Ember Theme", wheelLabel: "Theme", rarity: "epic", color: "#ff7b54", icon: "🎨" },
    { id: "spin_pfp", type: "pfp", name: SPIN_WHEEL_LEGENDARY_PFP.name, imagePath: SPIN_WHEEL_LEGENDARY_PFP.imagePath, weight: 5, label: "Wheel Shark PFP", wheelLabel: "PFP", rarity: "legendary", color: "#ffe28a", icon: "🦈" }
];

let spinWheelRotation = 0;
let spinWheelSpinning = false;

function getLastSpinWheelDateStorageKey(uid = currentUser?.uid) {
    return uid ? `lastSpinWheelDate_${uid}` : "lastSpinWheelDate";
}

function getStoredLastSpinWheelDate(uid = currentUser?.uid) {
    const profileData = getCurrentProfileData();
    return normalizeStoredDateValue(
        localStorage.getItem(getLastSpinWheelDateStorageKey(uid)) ||
        profileData.lastSpinWheelDate
    );
}

function canUseDailySpin(profileData = getCurrentProfileData()) {
    if (!currentUser) return false;
    return getStoredLastSpinWheelDate(currentUser.uid) !== getLocalDateKey();
}

function markDailySpinUsed(profileData = getCurrentProfileData()) {
    const today = getLocalDateKey();
    profileData.lastSpinWheelDate = today;
    localStorage.setItem(getLastSpinWheelDateStorageKey(currentUser?.uid), today);
    return profileData;
}

function pickSpinWheelReward() {
    const totalWeight = spinWheelRewards.reduce((sum, reward) => sum + Math.max(0, Number(reward.weight) || 0), 0);
    let roll = Math.random() * totalWeight;
    for (const reward of spinWheelRewards) {
        roll -= Math.max(0, Number(reward.weight) || 0);
        if (roll <= 0) return reward;
    }
    return spinWheelRewards[0];
}

function grantSpinWheelReward(profileData, reward) {
    let message = reward.label || "Reward";
    let duplicate = false;

    if (reward.type === "xp") {
        const baseXp = Math.max(0, Number(reward.amount) || 0);
        const xpAward = typeof window.applyLimitedTimeXpBonus === "function"
            ? window.applyLimitedTimeXpBonus(baseXp)
            : { totalXp: baseXp };
        profileData.totalXP = (Number(profileData.totalXP) || 0) + xpAward.totalXp;
        message = `${xpAward.totalXp} XP`;
    } else if (reward.type === "crate") {
        const inventory = getCrateInventory(profileData);
        const crateId = reward.crateId || "reef";
        const amount = Math.max(1, Math.floor(Number(reward.amount) || 1));
        inventory[crateId] = (inventory[crateId] || 0) + amount;
        profileData.crateInventory = normalizeCrateInventory(inventory);
        message = `${amount} ${getCrateDefinition(crateId).name}${amount === 1 ? "" : "s"}`;
    } else if (reward.type === "pass_level") {
        const currentLevel = getLevelFromXP(profileData.totalXP || 0);
        const targetXp = getXPForLevel(currentLevel + 1);
        if ((profileData.totalXP || 0) < targetXp) {
            profileData.totalXP = targetXp;
            message = `Free Shark Pass level up! (Level ${currentLevel + 1})`;
        } else {
            profileData.totalXP = (profileData.totalXP || 0) + 1500;
            message = "Max level reached — 1500 XP instead";
        }
    } else if (reward.type === "item" || reward.type === "badge" || reward.type === "theme" || reward.type === "pfp") {
        const result = grantCrateReward(profileData, {
            type: reward.type,
            itemId: reward.itemId,
            quantity: reward.quantity,
            badgeId: reward.badgeId,
            themeId: reward.themeId,
            name: reward.name,
            imagePath: reward.imagePath,
            rarity: reward.rarity
        });
        duplicate = result.duplicateReward;
        if (duplicate && reward.type === "item") {
            message = "Streak Shield (already at max)";
        } else if (duplicate) {
            profileData.totalXP = (profileData.totalXP || 0) + 750;
            message = `${reward.label} (owned) — 750 XP instead`;
        }
    }

    return { profileData, message, duplicate };
}

function getSpinWheelSliceGeometry() {
    const totalWeight = spinWheelRewards.reduce((sum, reward) => sum + Math.max(0, Number(reward.weight) || 0), 0);
    let cursor = 0;
    return spinWheelRewards.map(reward => {
        const slice = (Math.max(0, Number(reward.weight) || 0) / totalWeight) * 360;
        const start = cursor;
        const mid = cursor + (slice / 2);
        cursor += slice;
        return { reward, start, end: cursor, mid, slice };
    });
}

function buildSpinWheelGradient() {
    const slices = getSpinWheelSliceGeometry();
    const stops = slices.map(entry => {
        const separator = Math.min(entry.end, entry.start + 0.65);
        return `rgba(7, 28, 44, 0.78) ${entry.start}deg ${separator}deg, ${entry.reward.color} ${separator}deg ${entry.end}deg`;
    });
    return `conic-gradient(from -90deg, ${stops.join(", ")})`;
}

function getSpinWheelChancePercent(reward) {
    const totalWeight = spinWheelRewards.reduce((sum, entry) => sum + Math.max(0, Number(entry.weight) || 0), 0);
    if (!totalWeight) return "0%";
    const percent = (Math.max(0, Number(reward.weight) || 0) / totalWeight) * 100;
    return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
}

function getSpinWheelLabelRadius(reward) {
    return ({
        spin_pass_level: 27,
        spin_badge: 38,
        spin_theme: 38,
        spin_pfp: 24,
        spin_reef_crate: 31
    })[reward.id] || 33;
}

function renderSpinWheelSliceLabels() {
    const disk = document.getElementById("spin-wheel-disk");
    if (!disk) return;
    const slices = getSpinWheelSliceGeometry();
    disk.innerHTML = slices.map(entry => {
        const angleRadians = entry.mid * Math.PI / 180;
        const labelRadius = getSpinWheelLabelRadius(entry.reward);
        const labelX = 50 + Math.sin(angleRadians) * labelRadius;
        const labelY = 50 - Math.cos(angleRadians) * labelRadius;
        let labelAngle = entry.mid - 90;
        if (labelAngle > 90) labelAngle -= 180;
        if (labelAngle < -90) labelAngle += 180;
        return `
        <div class="spin-wheel-slice-label rarity-${entry.reward.rarity}" style="--slice-x:${labelX.toFixed(2)}%; --slice-y:${labelY.toFixed(2)}%; --label-angle:${labelAngle.toFixed(2)}deg;">
            <span class="slice-icon">${entry.reward.icon}</span>
            <span class="slice-copy">
                <strong>${entry.reward.wheelLabel || entry.reward.label}</strong>
                <small>${getSpinWheelChancePercent(entry.reward)}</small>
            </span>
        </div>
    `;
    }).join("");
}

function renderSpinWheelLegend() {
    const legend = document.getElementById("spin-wheel-legend");
    if (!legend) return;
    legend.innerHTML = spinWheelRewards.map(reward => `
        <li class="spin-wheel-legend-item rarity-${reward.rarity}">
            <span class="legend-swatch" style="background:${reward.color};"></span>
            <span class="legend-icon">${reward.icon}</span>
            <span class="legend-copy">
                <strong>${reward.label}</strong>
                <small>${reward.rarity}</small>
            </span>
        </li>
    `).join("");
}

function updateSpinWheelUI() {
    const btn = document.getElementById("spin-wheel-btn");
    const statusEl = document.getElementById("spin-wheel-status");
    const actionBtn = document.getElementById("spin-wheel-action-btn");
    const subtitle = document.getElementById("spin-wheel-subtitle");
    const canSpin = canUseDailySpin();

    if (btn) {
        if (currentUser) {
            btn.classList.remove("hidden");
            btn.disabled = false;
            btn.classList.toggle("spin-used", !canSpin);
        } else {
            btn.classList.add("hidden");
        }
    }
    if (statusEl) {
        statusEl.textContent = canSpin ? "Ready!" : "Used";
    }
    if (actionBtn) {
        actionBtn.disabled = !canSpin || spinWheelSpinning;
        actionBtn.textContent = canSpin ? "Spin the Wheel" : "Come Back Tomorrow";
    }
    if (subtitle) {
        subtitle.textContent = canSpin
            ? "You have 1 free spin today. Land the legendary slice for the exclusive Wheel Shark profile icon!"
            : "You already used today's spin. Come back after midnight for another free spin.";
    }
}

function openSpinWheelModal() {
    if (!currentUser) {
        openLoginModal();
        return;
    }
    const modal = document.getElementById("spinWheelModal");
    const disk = document.getElementById("spin-wheel-disk");
    const result = document.getElementById("spin-wheel-result");
    if (!modal || !disk) return;

    disk.style.background = buildSpinWheelGradient();
    renderSpinWheelSliceLabels();
    disk.style.transform = `rotate(${spinWheelRotation}deg)`;
    if (result) {
        result.classList.add("hidden");
        result.textContent = "";
    }
    renderSpinWheelLegend();
    updateSpinWheelUI();
    modal.classList.remove("hidden");
}

function closeSpinWheelModal() {
    const modal = document.getElementById("spinWheelModal");
    if (modal) modal.classList.add("hidden");
}

async function spinDailyWheel() {
    if (!currentUser || spinWheelSpinning || !canUseDailySpin()) {
        updateSpinWheelUI();
        return;
    }

    const disk = document.getElementById("spin-wheel-disk");
    const result = document.getElementById("spin-wheel-result");
    const actionBtn = document.getElementById("spin-wheel-action-btn");
    if (!disk) return;

    spinWheelSpinning = true;
    if (actionBtn) actionBtn.disabled = true;

    const reward = pickSpinWheelReward();
    const rewardIndex = Math.max(0, spinWheelRewards.findIndex(entry => entry.id === reward.id));
    const slices = getSpinWheelSliceGeometry();
    const winningSlice = slices[rewardIndex] || slices[0];
    const extraTurns = 5 + Math.floor(Math.random() * 3);
    const targetRotation = (extraTurns * 360) + (360 - winningSlice.mid);
    spinWheelRotation += targetRotation;
    disk.style.transform = `rotate(${spinWheelRotation}deg)`;

    await new Promise(resolve => setTimeout(resolve, 4200));

    let profileData = getCurrentProfileData();
    const grantResult = grantSpinWheelReward(profileData, reward);
    profileData = markDailySpinUsed(grantResult.profileData);
    saveUserProfileLocally(profileData);

    if (currentUser && db) {
        try {
            await db.collection("userStats").doc(currentUser.uid).set({
                totalXP: profileData.totalXP,
                earnedCosmetics: profileData.earnedCosmetics,
                unlockedBadges: profileData.unlockedBadges,
                unlockedCardThemes: profileData.unlockedCardThemes,
                crateInventory: normalizeCrateInventory(profileData.crateInventory),
                streakShields: getStreakShieldCount(profileData),
                lastSpinWheelDate: profileData.lastSpinWheelDate
            }, { merge: true });
        } catch (error) {
            console.warn("Spin wheel sync failed:", error);
        }
    }

    if (result) {
        result.classList.remove("hidden");
        result.innerHTML = `🎉 You won <strong>${grantResult.message}</strong>!`;
    }

    if (reward.type === "pfp" && !grantResult.duplicate && typeof showCosmeticUnlockToast === "function") {
        showCosmeticUnlockToast({
            name: reward.name,
            imagePath: reward.imagePath
        }, {
            title: "Legendary Spin Reward!",
            subtitle: reward.name,
            accent: "#ffd47f",
            background: "linear-gradient(135deg, rgba(255, 212, 127, 0.96), rgba(91, 58, 9, 0.96))",
            icon: "🎡"
        });
    } else {
        showNotification(`Spin reward: ${grantResult.message}`, "success", 4200);
    }

    renderCratesButton();
    renderCratesModal();
    updateSeasonalCratePanels();
    if (typeof loadAvailablePFPs === "function") loadAvailablePFPs();
    if (typeof loadEarnedCosmetics === "function") loadEarnedCosmetics();
    if (typeof renderThemeSelection === "function") renderThemeSelection();
    if (typeof renderBadgeSelection === "function") renderBadgeSelection();
    if (typeof updateProfileBadgeUI === "function") updateProfileBadgeUI();
    updateIndexStats();
    updateSpinWheelUI();
    spinWheelSpinning = false;
}

function collectAllUnlockablePfps() {
    const entries = [];
    const seen = new Set();
    const addEntry = (name, imagePath, extra = {}) => {
        if (!imagePath || seen.has(imagePath)) return;
        seen.add(imagePath);
        entries.push({ name: name || "Shark", imagePath, ...extra });
    };

    levelRewards.forEach(reward => addEntry(reward.name, reward.imagePath, { level: reward.level }));
    getAllCrateRewardPools().flat()
        .filter(reward => reward.type === "pfp")
        .forEach(reward => addEntry(reward.name, reward.imagePath, { crateReward: true, rarity: reward.rarity }));
    Object.values(redeemCodes).forEach(code => {
        (code.cosmetics || []).forEach(cosmetic => addEntry(cosmetic.name, cosmetic.imagePath, { codeReward: true }));
    });
    addEntry(DAY_7_LOGIN_PFP.name, DAY_7_LOGIN_PFP.imagePath, { loginReward: true });
    addEntry(SPIN_WHEEL_LEGENDARY_PFP.name, SPIN_WHEEL_LEGENDARY_PFP.imagePath, { spinReward: true, rarity: "legendary" });
    addEntry("Port Jackson Shark", "images/leaderPfp/Shark19.png", { leaderReward: true });
    addEntry("Catshark", "images/leaderPfp/Daily/Shark1.png", { leaderReward: true });
    addEntry("Whitetip Reef Shark", "images/leaderPfp/Monthly/Shark1.png", { leaderReward: true });
    addEntry("Hammerhead Shark", "images/codePfp/Shark26.png", { codeReward: true });

    return entries;
}

function collectAllUnlockableBadgeIds(uid = currentUser?.uid) {
    return allBadges
        .filter(badge => !badge.devOnly || isDeveloperUid(uid))
        .map(badge => badge.id);
}

window.unlockAllCosmetics = async function() {
    if (!currentUser || !isDeveloperUid(currentUser.uid)) {
        console.log("❌ Access denied. unlockAllCosmetics() is for developers only.");
        showNotification("Dev command: Access denied.", "error", 4000);
        return;
    }

    const profileData = getCurrentProfileData();
    const allPfps = collectAllUnlockablePfps();
    const allBadgeIds = collectAllUnlockableBadgeIds(currentUser.uid);
    const allThemeIds = [...new Set(["default", ...sharkPassCardThemes.map(theme => theme.id)])];

    profileData.earnedCosmetics = getUnifiedCosmeticList(profileData.earnedCosmetics, allPfps, "imagePath");
    profileData.unlockedBadges = [...new Set(["starter", ...allBadgeIds])];
    profileData.unlockedCardThemes = allThemeIds;
    if (allBadgeIds.includes("tester")) {
        profileData.testerBadgeUnlocked = true;
    }

    saveUserProfileLocally(profileData);

    if (db) {
        await db.collection("userStats").doc(currentUser.uid).set({
            earnedCosmetics: profileData.earnedCosmetics,
            unlockedBadges: profileData.unlockedBadges,
            unlockedCardThemes: profileData.unlockedCardThemes,
            testerBadgeUnlocked: profileData.testerBadgeUnlocked === true
        }, { merge: true });
    }

    if (typeof renderThemeSelection === "function") renderThemeSelection();
    if (typeof renderBadgeSelection === "function") renderBadgeSelection();
    if (typeof loadAvailablePFPs === "function") loadAvailablePFPs();
    if (typeof loadEarnedCosmetics === "function") loadEarnedCosmetics();
    if (typeof updateProfileBadgeUI === "function") updateProfileBadgeUI();

    console.log(`✅ Unlocked ${profileData.earnedCosmetics.length} profile icons, ${profileData.unlockedBadges.length} badges, and ${profileData.unlockedCardThemes.length} themes.`);
    showNotification("Unlocked all profile icons, badges, and themes.", "success", 4200);
};

window.resetDailySpin = function() {
    if (!currentUser || !isDeveloperUid(currentUser.uid)) {
        console.log("❌ Access denied. resetDailySpin() is for developers only.");
        return;
    }
    const profileData = getCurrentProfileData();
    delete profileData.lastSpinWheelDate;
    localStorage.removeItem(getLastSpinWheelDateStorageKey(currentUser.uid));
    saveUserProfileLocally(profileData);
    if (db) {
        db.collection("userStats").doc(currentUser.uid).set({ lastSpinWheelDate: "" }, { merge: true }).catch(() => {});
    }
    updateSpinWheelUI();
    console.log("✅ Daily spin reset. You can spin again.");
};

window.openSpinWheelModal = function() {};
window.closeSpinWheelModal = function() {};
window.spinDailyWheel = function() {};

function getAllCrateRewardPools() {
    return [crateRewardPool, summerCrateRewardPool, christmasCrateRewardPool, halloweenCrateRewardPool];
}

function getAllCrateBadgeRewards() {
    return getAllCrateRewardPools()
        .flat()
        .filter(reward => reward.type === "badge");
}

function getOpenedCrateCount(profileData = getCurrentProfileData(), crateId = null) {
    const storedCount = Math.max(0, Number(profileData?.cratesOpened) || 0);
    if (storedCount > 0) {
        if (crateId === null) return storedCount;
        const inventory = normalizeCrateInventory(profileData.crateInventory || {});
        return inventory[crateId] || 0;
    }
    
    if (crateId === null) {
        return crateRewardPool.filter(reward => isCrateRewardOwned(profileData, reward)).length;
    }
    
    const pool = getCratePoolById(crateId);
    return pool.filter(reward => isCrateRewardOwned(profileData, reward)).length;
}

function normalizeGlobalXpEventConfig(rawConfig) {
    if (!rawConfig || rawConfig.enabled !== true) return null;
    const startMs = Number(rawConfig.startMs);
    const endMs = Number(rawConfig.endMs);
    const multiplier = Math.max(1, Number(rawConfig.multiplier) || 2);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
        return null;
    }
    return {
        id: rawConfig.id || "global-double-xp",
        label: rawConfig.label || `${multiplier}x XP Event`,
        multiplier,
        startMs,
        endMs
    };
}

function getActiveLimitedTimeXpEvent(nowMs = Date.now()) {
    const forcePreview = localStorage.getItem("forceXpEventPreview") === "true";
    if (forcePreview) {
        return {
            ...limitedTimeXpEvent,
            previewMode: true,
            endMs: nowMs + (47 * 60 * 60 * 1000) + (12 * 60 * 1000) + (9 * 1000)
        };
    }
    const activeGlobalEvent = normalizeGlobalXpEventConfig(globalXpEventOverride);
    if (activeGlobalEvent && nowMs >= activeGlobalEvent.startMs && nowMs < activeGlobalEvent.endMs) {
        return activeGlobalEvent;
    }
    if (nowMs >= limitedTimeXpEvent.startMs && nowMs < limitedTimeXpEvent.endMs) {
        return limitedTimeXpEvent;
    }
    return null;
}

function applyLimitedTimeXpBonus(baseXp) {
    const safeBaseXp = Math.max(0, Math.round(Number(baseXp) || 0));
    const activeEvent = getActiveLimitedTimeXpEvent();
    const eventMultiplier = activeEvent ? activeEvent.multiplier : 1;
    const profileData = typeof getCurrentProfileData === "function" ? getCurrentProfileData() : {};
    const seasonBoostActive = hasSeasonXpBoost(profileData);
    const seasonMultiplier = seasonBoostActive ? 2 : 1;
    const totalMultiplier = eventMultiplier * seasonMultiplier;

    if (totalMultiplier <= 1) {
        return {
            baseXp: safeBaseXp,
            totalXp: safeBaseXp,
            bonusXp: 0,
            multiplier: 1,
            event: null
        };
    }

    const seasonEvent = seasonBoostActive
        ? {
            id: `season-xp-${SHARK_PASS_ACTIVE_SEASON_ID}`,
            label: "Season 2x XP",
            multiplier: 2,
            seasonId: SHARK_PASS_ACTIVE_SEASON_ID
        }
        : null;
    const totalXp = Math.round(safeBaseXp * totalMultiplier);
    return {
        baseXp: safeBaseXp,
        totalXp,
        bonusXp: totalXp - safeBaseXp,
        multiplier: totalMultiplier,
        event: activeEvent && seasonEvent
            ? {
                ...activeEvent,
                label: `${activeEvent.label} + Season 2x XP`,
                multiplier: totalMultiplier,
                stacked: true,
                seasonBoost: seasonEvent
            }
            : activeEvent || seasonEvent
    };
}

let xpEventBannerInterval = null;

function formatEventTimeRemaining(msRemaining) {
    const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
        return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
    }
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateXpEventBanner() {
    const banner = document.getElementById("xp-event-banner");
    const timer = document.getElementById("xp-event-timer");
    if (!banner || !timer) return;

    const activeEvent = getActiveLimitedTimeXpEvent();
    if (!activeEvent) {
        banner.classList.add("hidden");
        timer.textContent = "Event inactive";
        if (xpEventBannerInterval) {
            clearInterval(xpEventBannerInterval);
            xpEventBannerInterval = null;
        }
        return;
    }

    const titleEl = banner.querySelector(".xp-event-title");
    if (titleEl) titleEl.textContent = `${activeEvent.multiplier}x XP gain active`;
    timer.textContent = `${activeEvent.previewMode ? "Preview ends in" : "Ends in"} ${formatEventTimeRemaining(activeEvent.endMs - Date.now())}`;

    banner.classList.remove("hidden");
}

function ensureXpEventBannerTimer() {
    updateXpEventBanner();
    if (xpEventBannerInterval) {
        clearInterval(xpEventBannerInterval);
        xpEventBannerInterval = null;
    }
    if (getActiveLimitedTimeXpEvent()) {
        xpEventBannerInterval = setInterval(updateXpEventBanner, 1000);
    }
}

function createCommunityBossRewards(crateId) {
    return {
        first: { label: "#1 contributor", xp: 25000, crateId, crateCount: 10, rank: 1 },
        second: { label: "#2 contributor", xp: 15000, crateId, crateCount: 5, rank: 2 },
        default: { label: "Everybody else", xp: 10000, crateId, crateCount: 2, rank: null }
    };
}

function createCommunityBossMilestoneRewards(crateId) {
    return [
        { id: "tier-50", label: "50-win reward", goal: 50, xp: 10000, crateId, crateCount: 2, rank: null },
        { id: "tier-100", label: "100-win reward", goal: 100, xp: 15000, crateId, crateCount: 5, rank: null },
        { id: "tier-150", label: "150-win final reward", goal: 150, xp: 25000, crateId, crateCount: 10, rank: null }
    ];
}

function getCurrentCommunityBossEvent(nowMs = Date.now()) {
    const startedEvents = COMMUNITY_BOSS_EVENTS
        .filter(event => nowMs >= event.startMs)
        .sort((a, b) => a.startMs - b.startMs);

    return startedEvents[startedEvents.length - 1]
        || COMMUNITY_BOSS_EVENTS.find(event => nowMs < event.startMs)
        || COMMUNITY_BOSS_EVENTS[COMMUNITY_BOSS_EVENTS.length - 1];
}

function getCommunityBossPageKind() {
    const path = window.location.pathname.toLowerCase();
    if (document.body?.classList.contains("home-page")) return "home";
    return "";
}

function getCommunityBossWins() {
    return Math.max(0, Number(communityBossState?.wins) || 0);
}

function isCommunityBossStarted(nowMs = Date.now()) {
    return nowMs >= COMMUNITY_BOSS_EVENT.startMs;
}

function isCommunityBossExpired(nowMs = Date.now()) {
    return nowMs >= COMMUNITY_BOSS_EVENT.endMs;
}

function isCommunityBossComplete(wins = getCommunityBossWins()) {
    return wins >= COMMUNITY_BOSS_EVENT.targetWins;
}

function isCommunityBossMilestoneEvent(event = COMMUNITY_BOSS_EVENT) {
    return event?.rewardMode === "milestone" || Array.isArray(event?.rewards);
}

function getCommunityBossContributionMultiplier() {
    return Math.max(1, Math.floor(Number(COMMUNITY_BOSS_EVENT.contributionMultiplier) || 1));
}

function isCommunityBossContributionOpen(nowMs = Date.now()) {
    return isCommunityBossStarted(nowMs) && !isCommunityBossExpired(nowMs) && !isCommunityBossComplete();
}

function getCommunityBossRewardClaim(profileData = getCurrentProfileData()) {
    return profileData?.communityBossRewards?.[COMMUNITY_BOSS_EVENT.id] || null;
}

function getClaimedCommunityBossRewardIds(profileData = getCurrentProfileData()) {
    const claim = getCommunityBossRewardClaim(profileData);
    if (!claim || typeof claim !== "object") return new Set();
    if (Array.isArray(claim.claimedRewardIds)) return new Set(claim.claimedRewardIds.map(String));
    if (claim.rewardId) return new Set([String(claim.rewardId)]);
    return new Set();
}

function getCommunityBossRewardTiers() {
    if (isCommunityBossMilestoneEvent()) {
        return [...(Array.isArray(COMMUNITY_BOSS_EVENT.rewards) ? COMMUNITY_BOSS_EVENT.rewards : [])]
            .sort((a, b) => (Number(a.goal) || 0) - (Number(b.goal) || 0));
    }

    return [
        COMMUNITY_BOSS_EVENT.rewards.first,
        COMMUNITY_BOSS_EVENT.rewards.second,
        COMMUNITY_BOSS_EVENT.rewards.default
    ].filter(Boolean);
}

function getUnlockedCommunityBossRewards(wins = getCommunityBossWins()) {
    if (!isCommunityBossMilestoneEvent()) return [];
    return getCommunityBossRewardTiers().filter(reward => wins >= (Number(reward.goal) || 0));
}

function getPendingCommunityBossRewards(wins = getCommunityBossWins(), profileData = getCurrentProfileData()) {
    if (!isCommunityBossMilestoneEvent()) return [];
    const claimedRewardIds = getClaimedCommunityBossRewardIds(profileData);
    return getUnlockedCommunityBossRewards(wins).filter(reward => !claimedRewardIds.has(String(reward.id)));
}

function hasClaimedCommunityBossReward(profileData = getCurrentProfileData(), wins = getCommunityBossWins()) {
    if (isCommunityBossMilestoneEvent()) {
        const unlockedRewards = getUnlockedCommunityBossRewards(wins);
        return unlockedRewards.length > 0 && getPendingCommunityBossRewards(wins, profileData).length === 0;
    }

    return Boolean(getCommunityBossRewardClaim(profileData));
}

function getCommunityBossDocRef() {
    return db?.collection("communityEvents").doc(COMMUNITY_BOSS_EVENT.id) || null;
}

function getCommunityBossContributorRef(uid = currentUser?.uid) {
    const eventRef = getCommunityBossDocRef();
    return eventRef && uid ? eventRef.collection("contributors").doc(uid) : null;
}

function getCommunityBossRewardForRank(rank) {
    if (rank === 1) return COMMUNITY_BOSS_EVENT.rewards.first;
    if (rank === 2) return COMMUNITY_BOSS_EVENT.rewards.second;
    return COMMUNITY_BOSS_EVENT.rewards.default;
}

function getCommunityBossCrateName(crateId = COMMUNITY_BOSS_EVENT.crateId) {
    return crateDefinitions[crateId]?.name || "Event Crate";
}

function formatCommunityBossCrateReward(reward) {
    const crateCount = Math.max(0, Number(reward.crateCount) || 0);
    const crateName = getCommunityBossCrateName(reward.crateId);
    return `${crateCount.toLocaleString()} ${crateName}${crateCount === 1 ? "" : "s"}`;
}

function formatCommunityBossCrateAwards(crateAwards) {
    return Object.entries(crateAwards || {})
        .filter(([, count]) => Number(count) > 0)
        .map(([crateId, count]) => {
            const crateCount = Math.max(0, Number(count) || 0);
            const crateName = getCommunityBossCrateName(crateId);
            return `${crateCount.toLocaleString()} ${crateName}${crateCount === 1 ? "" : "s"}`;
        })
        .join(", ");
}

function getCommunityBossRewardDescription(reward) {
    return `${formatCommunityBossCrateReward(reward)}, ${reward.xp.toLocaleString()} XP, ${COMMUNITY_BOSS_EVENT.rewardBadgeName} profile badge`;
}

function getCommunityBossDescription() {
    const multiplier = getCommunityBossContributionMultiplier();
    const multiplierCopy = multiplier > 1 ? ` Each win counts as ${multiplier}.` : "";
    if (isCommunityBossMilestoneEvent()) {
        const goals = getCommunityBossRewardTiers()
            .map(reward => (Number(reward.goal) || 0).toLocaleString())
            .join(", ");
        return `Daily and Infinite wins from every logged-in player count together.${multiplierCopy} Unlock shared rewards at ${goals} community wins before the deadline to bring down the ${COMMUNITY_BOSS_EVENT.bossName}.`;
    }
    return `Daily and Infinite wins from every logged-in player count together.${multiplierCopy} Reach ${COMMUNITY_BOSS_EVENT.targetWins.toLocaleString()} community wins by the event deadline to bring down the ${COMMUNITY_BOSS_EVENT.bossName}.`;
}

function resolveCommunityBossProfilePicturePath(path) {
    const storedPath = String(path || "").trim();
    if (!storedPath) return "images/pfp/shark1.png";
    if (/^https?:\/\//i.test(storedPath) || storedPath.startsWith("images/")) return storedPath;
    if (storedPath.includes("/")) return `images/${storedPath.replace(/^\/+/, "")}`;
    return `images/pfp/${storedPath}`;
}

function getCommunityBossRewardsMarkup(wins = getCommunityBossWins(), profileData = getCurrentProfileData()) {
    const rewardRows = getCommunityBossRewardTiers();
    const claimedRewardIds = getClaimedCommunityBossRewardIds(profileData);
    const heading = isCommunityBossMilestoneEvent() ? "Community Milestones" : "Rewards";

    return `
        <strong>${heading}</strong>
        <ul class="community-boss-rewards-list">
            ${rewardRows.map(reward => {
                const goal = Number(reward.goal) || 0;
                const claimed = claimedRewardIds.has(String(reward.id));
                const unlocked = !isCommunityBossMilestoneEvent() || wins >= goal;
                const status = isCommunityBossMilestoneEvent()
                    ? claimed
                        ? "Claimed"
                        : unlocked
                        ? "Unlocked"
                        : `${Math.max(0, goal - wins).toLocaleString()} wins to unlock`
                    : "";
                const statusMarkup = status ? `<em>${status}</em>` : "";
                return `<li class="${claimed ? "claimed" : unlocked ? "unlocked" : "locked"}"><b>${reward.label}</b><span>${getCommunityBossRewardDescription(reward)}${statusMarkup}</span></li>`;
            }).join("")}
        </ul>
    `;
}

async function getCommunityBossTopContributors(limit = 2) {
    const eventRef = getCommunityBossDocRef();
    if (!eventRef) return [];

    try {
        const snapshot = await eventRef
            .collection("contributors")
            .orderBy("wins", "desc")
            .limit(limit)
            .get();
        const rows = snapshot.docs.map((doc, index) => ({
            uid: doc.id,
            rank: index + 1,
            ...(doc.data() || {})
        }));

        return Promise.all(rows.map(async row => {
            if (row.profilePicture || row.profilePic || !db) return row;
            try {
                const profileDoc = await db.collection("userStats").doc(row.uid).get();
                const profileData = profileDoc.exists ? (profileDoc.data() || {}) : {};
                return {
                    ...row,
                    profilePicture: profileData.profilePicture || profileData.profilePic || ""
                };
            } catch (error) {
                return row;
            }
        }));
    } catch (error) {
        console.warn("Unable to load community boss contributor ranks:", error);
        return [];
    }
}

function ensureCommunityBossRanksModal() {
    let modal = document.getElementById("community-boss-ranks-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "community-boss-ranks-modal";
    modal.className = "community-boss-ranks-modal hidden";
    modal.innerHTML = `
        <div class="community-boss-ranks-card">
            <button class="community-boss-ranks-close" type="button" onclick="closeCommunityBossRanksModal()" aria-label="Close ranks">×</button>
            <span class="community-boss-kicker">${COMMUNITY_BOSS_EVENT.bossName} Leaderboard</span>
            <h3>Top Contributors</h3>
            <div id="community-boss-ranks-list" class="community-boss-ranks-list">
                <p class="community-boss-ranks-empty">Loading ranks...</p>
            </div>
        </div>
    `;
    modal.addEventListener("click", (event) => {
        if (event.target === modal) closeCommunityBossRanksModal();
    });
    document.body.appendChild(modal);
    return modal;
}

function escapeCommunityBossHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function renderCommunityBossRanks(rows) {
    const list = document.getElementById("community-boss-ranks-list");
    if (!list) return;

    if (!rows.length) {
        list.innerHTML = `<p class="community-boss-ranks-empty">No contributions yet.</p>`;
        return;
    }

    list.innerHTML = rows.map((row, index) => {
        const rank = index + 1;
        const rankClass = !isCommunityBossMilestoneEvent() && rank <= 2 ? ` top-${rank}` : "";
        const username = escapeCommunityBossHtml(row.username || "Anonymous");
        const profilePic = escapeCommunityBossHtml(resolveCommunityBossProfilePicturePath(row.profilePicture || row.profilePic));
        const wins = Math.max(0, Number(row.wins) || 0);
        const reward = isCommunityBossMilestoneEvent() ? null : getCommunityBossRewardForRank(rank);
        const rewardCopy = reward ? ` - ${reward.label}` : "";
        return `
            <article class="community-boss-rank-row${rankClass}">
                <span class="community-boss-rank-number">#${rank}</span>
                <img class="community-boss-rank-avatar" src="${profilePic}" alt="${username}" onerror="this.onerror=null;this.src='images/pfp/shark1.png';">
                <div>
                    <strong>${username}</strong>
                    <span>${wins.toLocaleString()} contribution${wins === 1 ? "" : "s"}${rewardCopy}</span>
                </div>
            </article>
        `;
    }).join("");
}

async function openCommunityBossRanksModal() {
    const modal = ensureCommunityBossRanksModal();
    modal.classList.remove("hidden");
    renderCommunityBossRanks([]);
    const list = document.getElementById("community-boss-ranks-list");
    if (list) list.innerHTML = `<p class="community-boss-ranks-empty">Loading ranks...</p>`;
    const rows = await getCommunityBossTopContributors(10);
    renderCommunityBossRanks(rows);
}

function closeCommunityBossRanksModal() {
    document.getElementById("community-boss-ranks-modal")?.classList.add("hidden");
}

function getCommunityBossDisplayState() {
    const wins = Math.min(getCommunityBossWins(), COMMUNITY_BOSS_EVENT.targetWins);
    const target = COMMUNITY_BOSS_EVENT.targetWins;
    const progressPercent = Math.max(0, Math.min(100, (wins / target) * 100));
    const nowMs = Date.now();
    const complete = isCommunityBossComplete(wins);
    const profileData = getCurrentProfileData();
    const pendingRewards = getPendingCommunityBossRewards(wins, profileData);
    const canClaim = isCommunityBossMilestoneEvent()
        ? pendingRewards.length > 0
        : complete && !hasClaimedCommunityBossReward(profileData, wins);
    const claimed = isCommunityBossMilestoneEvent()
        ? getUnlockedCommunityBossRewards(wins).length > 0 && pendingRewards.length === 0
        : hasClaimedCommunityBossReward(profileData, wins);
    const started = isCommunityBossStarted(nowMs);
    const expired = isCommunityBossExpired(nowMs);
    const contributionOpen = isCommunityBossContributionOpen(nowMs);

    let timerText = "";
    if (!started) {
        timerText = `Starts in ${formatEventTimeRemaining(COMMUNITY_BOSS_EVENT.startMs - nowMs)}`;
    } else if (complete) {
        timerText = "Boss defeated. Rewards are unlocked.";
    } else if (canClaim) {
        timerText = `${pendingRewards.length} reward${pendingRewards.length === 1 ? "" : "s"} unlocked.`;
    } else if (expired) {
        timerText = "Event ended.";
    } else {
        timerText = `Ends in ${formatEventTimeRemaining(COMMUNITY_BOSS_EVENT.endMs - nowMs)}`;
    }

    const claimLabel = !currentUser
        ? "Login to Claim"
        : claimed
        ? "Rewards Claimed"
        : canClaim
        ? pendingRewards.length > 1 ? "Claim Rewards" : "Claim Reward"
        : "Locked";

    const contributionCopy = contributionOpen
        ? canClaim
            ? "A shared reward is unlocked. Claim it now, and keep winning for the next milestone."
            : `Your next Daily or Infinite win will add ${getCommunityBossContributionMultiplier()} to the global total.`
        : complete
        ? "The community did it. Claim every unlocked reward while logged in."
        : "Wins are no longer being counted for this event.";

    return {
        wins,
        target,
        progressPercent,
        complete,
        claimed,
        canClaim,
        claimLabel,
        pendingRewardCount: pendingRewards.length,
        timerText,
        contributionCopy
    };
}

function ensureCommunityBossEventModal() {
    let modal = document.getElementById("community-boss-event-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "community-boss-event-modal";
    modal.className = "community-boss-event-modal hidden";
    modal.innerHTML = `
        <div class="community-boss-event-card" role="dialog" aria-modal="true" aria-labelledby="community-boss-modal-title">
            <button class="community-boss-event-close" type="button" onclick="closeCommunityBossEventModal()" aria-label="Close event">×</button>
            <div id="community-boss-event-modal-body"></div>
        </div>
    `;
    modal.addEventListener("click", (event) => {
        if (event.target === modal) closeCommunityBossEventModal();
    });
    document.body.appendChild(modal);
    return modal;
}

function renderCommunityBossEventModal() {
    const body = document.getElementById("community-boss-event-modal-body");
    if (!body) return;

    const state = getCommunityBossDisplayState();
    body.innerHTML = `
        <section class="community-boss-event community-boss-modal-event community-boss-season-${COMMUNITY_BOSS_EVENT.season}" aria-live="polite">
            <div class="community-boss-modal-heading">
                <span class="community-boss-kicker">${COMMUNITY_BOSS_EVENT.seasonLabel}</span>
                <h2 id="community-boss-modal-title">${COMMUNITY_BOSS_EVENT.title}</h2>
                <p>${getCommunityBossDescription()}</p>
            </div>
            <div class="community-boss-progress-shell community-boss-modal-progress">
                <div class="community-boss-progress-meta">
                    <span>${state.wins.toLocaleString()} / ${state.target.toLocaleString()} global wins</span>
                    <span>${Math.floor(state.progressPercent)}%</span>
                </div>
                <div class="community-boss-progress" aria-label="Global ${COMMUNITY_BOSS_EVENT.bossName} progress">
                    <div class="community-boss-progress-fill" style="width:${state.progressPercent}%"></div>
                </div>
                <div class="community-boss-status">${state.timerText}</div>
            </div>
            <div class="community-boss-modal-lower">
                <div class="community-boss-reward">
                    ${getCommunityBossRewardsMarkup(state.wins)}
                </div>
                <div class="community-boss-modal-actions">
                    <p>${state.contributionCopy}</p>
                    <div class="community-boss-actions">
                        <button class="primary" type="button" onclick="navigate('infinite.html')">Play Infinite</button>
                        <button type="button" onclick="navigate('Daily/index.html')">Daily Challenge</button>
                        ${isCommunityBossMilestoneEvent() ? "" : `<button type="button" onclick="openCommunityBossRanksModal()">Ranks</button>`}
                        <button id="community-boss-modal-claim-btn" type="button">${state.claimLabel}</button>
                    </div>
                </div>
            </div>
        </section>
    `;

    const claimBtn = document.getElementById("community-boss-modal-claim-btn");
    if (claimBtn) {
        claimBtn.onclick = claimCommunityBossReward;
        claimBtn.classList.toggle("primary", state.canClaim);
        claimBtn.disabled = Boolean(currentUser && !state.canClaim);
    }
}

function openCommunityBossEventModal() {
    ensureCommunityBossStyles();
    const modal = ensureCommunityBossEventModal();
    renderCommunityBossEventModal();
    modal.classList.remove("hidden");
}

function closeCommunityBossEventModal() {
    document.getElementById("community-boss-event-modal")?.classList.add("hidden");
}

async function getCurrentCommunityBossReward() {
    const topContributors = await getCommunityBossTopContributors(2);
    const currentRank = topContributors.find(row => row.uid === currentUser?.uid)?.rank || null;
    return getCommunityBossRewardForRank(currentRank);
}

function ensureCommunityBossStyles() {
    if (document.getElementById("community-boss-event-styles")) return;
    const style = document.createElement("style");
    style.id = "community-boss-event-styles";
    style.textContent = `
        .community-boss-event {
            width: min(1120px, calc(100% - 32px));
            margin: 18px auto;
            padding: 18px;
            border: 1px solid rgba(255, 202, 123, 0.34);
            border-radius: 20px;
            background:
                radial-gradient(circle at top left, rgba(255, 220, 134, 0.18), transparent 36%),
                radial-gradient(circle at 88% 18%, rgba(255, 118, 92, 0.14), transparent 28%),
                linear-gradient(135deg, rgba(5, 38, 54, 0.94), rgba(12, 70, 84, 0.9));
            color: #f4fdff;
            box-shadow: 0 18px 42px rgba(0, 0, 0, 0.28);
            box-sizing: border-box;
        }
        body.home-page .community-boss-event {
            margin-top: 0;
            margin-bottom: 10px;
            padding: 10px 12px;
            width: min(980px, calc(100% - 36px));
            border-radius: 16px;
            box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
        }
        body.home-page .community-boss-grid {
            grid-template-columns: minmax(0, 1fr) minmax(240px, 0.88fr);
            gap: 12px;
        }
        body.home-page .community-boss-kicker {
            padding: 4px 8px;
            font-size: 10px;
        }
        body.home-page .community-boss-event h2 {
            margin: 6px 0 4px;
            font-size: clamp(19px, 2.1vw, 25px);
        }
        body.home-page .community-boss-event p {
            font-size: 12px;
            line-height: 1.35;
        }
        body.home-page .community-boss-progress-shell {
            gap: 6px;
        }
        body.home-page .community-boss-progress {
            height: 11px;
        }
        body.home-page .community-boss-progress-meta,
        body.home-page .community-boss-status {
            font-size: 11px;
        }
        body.home-page .community-boss-reward {
            padding: 8px 10px;
        }
        body.home-page .community-boss-reward strong {
            margin-bottom: 2px;
        }
        body.home-page .community-boss-rewards-list {
            gap: 2px;
        }
        body.home-page .community-boss-rewards-list li {
            grid-template-columns: 96px minmax(0, 1fr);
            gap: 8px;
            align-items: baseline;
            padding: 3px 0;
        }
        body.home-page .community-boss-rewards-list b,
        body.home-page .community-boss-rewards-list span {
            font-size: 11px;
            line-height: 1.2;
        }
        body.home-page .community-boss-actions {
            gap: 7px;
            margin-top: 8px;
        }
        body.home-page .community-boss-actions button {
            min-height: 32px;
            padding: 7px 10px;
            border-radius: 10px;
            font-size: 12px;
        }
        body.home-page .community-boss-status {
            margin-top: 5px;
            min-height: 14px;
        }
        .community-boss-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.85fr);
            gap: 18px;
            align-items: center;
        }
        .community-boss-kicker {
            display: inline-flex;
            align-items: center;
            width: fit-content;
            padding: 5px 9px;
            border-radius: 999px;
            background: rgba(255, 202, 123, 0.14);
            color: #ffd78c;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }
        .community-boss-event h2 {
            margin: 9px 0 7px;
            font-size: clamp(24px, 3vw, 36px);
            line-height: 1.05;
            letter-spacing: 0;
        }
        .community-boss-event p {
            margin: 0;
            color: rgba(244, 253, 255, 0.82);
            line-height: 1.5;
            font-size: 14px;
        }
        .community-boss-progress-shell {
            display: grid;
            gap: 10px;
        }
        .community-boss-progress-meta {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            color: #dff9ff;
            font-size: 13px;
            font-weight: 800;
        }
        .community-boss-progress {
            position: relative;
            height: 16px;
            overflow: hidden;
            border-radius: 999px;
            background: rgba(1, 18, 29, 0.72);
            border: 1px solid rgba(255, 255, 255, 0.14);
        }
        .community-boss-progress-fill {
            width: 0%;
            height: 100%;
            border-radius: inherit;
            background: linear-gradient(90deg, #57e5d4, #ffd36f, #ff8f70);
            transition: width 0.4s ease;
        }
        .community-boss-reward {
            padding: 13px;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            background: rgba(255, 255, 255, 0.07);
        }
        .community-boss-reward strong {
            display: block;
            color: #ffd78c;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.07em;
            margin-bottom: 5px;
        }
        .community-boss-rewards-list {
            display: grid;
            gap: 8px;
            margin: 0;
            padding: 0;
            list-style: none;
        }
        .community-boss-rewards-list li {
            display: grid;
            gap: 2px;
            padding: 8px 0;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .community-boss-rewards-list li:first-child {
            border-top: 0;
            padding-top: 0;
        }
        .community-boss-rewards-list b {
            color: #fff4c7;
            font-size: 13px;
        }
        .community-boss-rewards-list span {
            color: rgba(244, 253, 255, 0.82);
            font-size: 12px;
            line-height: 1.35;
        }
        .community-boss-rewards-list em {
            display: block;
            margin-top: 3px;
            color: #a7edf7;
            font-style: normal;
            font-weight: 900;
        }
        .community-boss-rewards-list li.claimed em {
            color: #9df7bc;
        }
        .community-boss-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 14px;
        }
        .community-boss-actions button {
            min-height: 42px;
            border: 0;
            border-radius: 12px;
            padding: 10px 14px;
            font-weight: 900;
            cursor: pointer;
            background: rgba(255, 255, 255, 0.13);
            color: #f8fdff;
        }
        .community-boss-actions button.primary {
            background: linear-gradient(135deg, #ffd36f, #ff8f70);
            color: #122634;
        }
        .community-boss-actions button:disabled {
            cursor: default;
            opacity: 0.62;
        }
        .community-boss-status {
            margin-top: 9px;
            min-height: 18px;
            color: #a7edf7;
            font-size: 12px;
            font-weight: 800;
        }
        .community-boss-ranks-modal {
            position: fixed;
            inset: 0;
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 18px;
            background: rgba(1, 14, 24, 0.72);
            backdrop-filter: blur(8px);
        }
        .community-boss-ranks-modal.hidden {
            display: none;
        }
        .community-boss-ranks-card {
            position: relative;
            width: min(420px, 100%);
            max-height: min(72vh, 560px);
            overflow-y: auto;
            padding: 18px;
            border-radius: 18px;
            border: 1px solid rgba(255, 211, 111, 0.28);
            background:
                radial-gradient(circle at top left, rgba(255, 211, 111, 0.16), transparent 42%),
                linear-gradient(145deg, rgba(5, 38, 54, 0.98), rgba(9, 28, 45, 0.98));
            color: #f4fdff;
            box-shadow: 0 22px 55px rgba(0, 0, 0, 0.38);
        }
        .community-boss-ranks-close {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 32px;
            height: 32px;
            border: 0;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.1);
            color: #f4fdff;
            cursor: pointer;
            font-size: 22px;
            line-height: 1;
        }
        .community-boss-ranks-card h3 {
            margin: 10px 0 14px;
            font-size: 24px;
            letter-spacing: 0;
        }
        .community-boss-ranks-list {
            display: grid;
            gap: 9px;
        }
        .community-boss-rank-row {
            display: grid;
            grid-template-columns: 46px 42px 1fr;
            gap: 10px;
            align-items: center;
            padding: 11px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.075);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .community-boss-rank-row.top-1 {
            border-color: rgba(255, 211, 111, 0.5);
            background: rgba(255, 211, 111, 0.12);
        }
        .community-boss-rank-row.top-2 {
            border-color: rgba(172, 221, 255, 0.42);
            background: rgba(172, 221, 255, 0.1);
        }
        .community-boss-rank-number {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 34px;
            border-radius: 10px;
            background: rgba(0, 0, 0, 0.22);
            color: #ffd78c;
            font-weight: 900;
        }
        .community-boss-rank-avatar {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid rgba(255, 211, 111, 0.32);
            background: rgba(0, 0, 0, 0.24);
        }
        .community-boss-rank-row.top-1 .community-boss-rank-avatar {
            border-color: rgba(255, 211, 111, 0.75);
        }
        .community-boss-rank-row.top-2 .community-boss-rank-avatar {
            border-color: rgba(172, 221, 255, 0.64);
        }
        .community-boss-rank-row strong,
        .community-boss-rank-row span {
            display: block;
        }
        .community-boss-rank-row strong {
            font-size: 14px;
        }
        .community-boss-rank-row span,
        .community-boss-ranks-empty {
            color: rgba(244, 253, 255, 0.78);
            font-size: 12px;
            line-height: 1.35;
        }
        @media (max-width: 760px) {
            .community-boss-grid {
                grid-template-columns: 1fr;
            }
            .community-boss-event {
                width: min(100% - 20px, 560px);
                padding: 15px;
            }
            body.home-page .community-boss-grid {
                grid-template-columns: 1fr;
            }
            body.home-page .community-boss-rewards-list li {
                grid-template-columns: 1fr;
                gap: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

function ensureCommunityBossPanel() {
    const pageKind = getCommunityBossPageKind();
    if (!pageKind || document.getElementById("community-boss-event")) return;

    ensureCommunityBossStyles();
    const panel = document.createElement("section");
    panel.id = "community-boss-event";
    panel.className = `community-boss-event community-boss-${pageKind} community-boss-season-${COMMUNITY_BOSS_EVENT.season}`;
    panel.setAttribute("aria-live", "polite");

    if (pageKind === "home") {
        const homeSection = document.querySelector(".home-section");
        if (homeSection?.parentNode) {
            homeSection.parentNode.insertBefore(panel, homeSection);
        }
    } else {
        const gameContainer = document.querySelector(".game-container");
        if (gameContainer?.parentNode) {
            gameContainer.parentNode.insertBefore(panel, gameContainer);
        }
    }

    renderCommunityBossPanel();
}

function renderCommunityBossPanel() {
    const panel = document.getElementById("community-boss-event");
    if (!panel) {
        if (!document.getElementById("community-boss-event-modal")?.classList.contains("hidden")) {
            renderCommunityBossEventModal();
        }
        return;
    }

    const state = getCommunityBossDisplayState();

    panel.innerHTML = `
        <div class="community-boss-grid">
            <div>
                <span class="community-boss-kicker">${COMMUNITY_BOSS_EVENT.seasonLabel}</span>
                <h2>${COMMUNITY_BOSS_EVENT.title}</h2>
                <p>${getCommunityBossDescription()}</p>
                <div class="community-boss-actions">
                    <button class="primary" type="button" onclick="navigate('infinite.html')">Play Infinite</button>
                    <button type="button" onclick="navigate('Daily/index.html')">Daily Challenge</button>
                    ${isCommunityBossMilestoneEvent() ? "" : `<button type="button" onclick="openCommunityBossRanksModal()">Ranks</button>`}
                    <button id="community-boss-claim-btn" type="button">${state.claimLabel}</button>
                </div>
                <div class="community-boss-status" id="community-boss-status">${state.timerText}</div>
            </div>
            <div class="community-boss-progress-shell">
                <div class="community-boss-progress-meta">
                    <span>${state.wins.toLocaleString()} / ${state.target.toLocaleString()} wins</span>
                    <span>${Math.floor(state.progressPercent)}%</span>
                </div>
                <div class="community-boss-progress" aria-label="Community boss progress">
                    <div class="community-boss-progress-fill" style="width:${state.progressPercent}%"></div>
                </div>
                <div class="community-boss-reward">
                    ${getCommunityBossRewardsMarkup(state.wins)}
                </div>
                <p>${state.contributionCopy}</p>
            </div>
        </div>
    `;

    const claimBtn = document.getElementById("community-boss-claim-btn");
    if (claimBtn) {
        claimBtn.onclick = claimCommunityBossReward;
        claimBtn.classList.toggle("primary", state.canClaim);
        claimBtn.disabled = Boolean(currentUser && !state.canClaim);
    }

    if (!document.getElementById("community-boss-event-modal")?.classList.contains("hidden")) {
        renderCommunityBossEventModal();
    }
}

function ensureCommunityBossUiTimer() {
    ensureCommunityBossPanel();
    if (communityBossUiTimer) return;
    if (!getCommunityBossPageKind()) return;
    communityBossUiTimer = setInterval(() => {
        if (!getCommunityBossPageKind()) {
            clearInterval(communityBossUiTimer);
            communityBossUiTimer = null;
            return;
        }
        renderCommunityBossPanel();
    }, 1000);
}

function setupCommunityBossEventListener() {
    const start = () => {
        ensureCommunityBossUiTimer();
        const eventRef = getCommunityBossDocRef();
        if (!eventRef || communityBossUnsubscribe) return;

        communityBossUnsubscribe = eventRef.onSnapshot(snapshot => {
            communityBossState = snapshot.exists ? (snapshot.data() || {}) : { wins: 0 };
            renderCommunityBossPanel();
        }, error => {
            console.warn("Community boss event listener failed:", error);
            communityBossState = communityBossState || { wins: 0 };
            renderCommunityBossPanel();
        });
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
}

function getCommunityBossContributionStorageKey(mode, options = {}) {
    if (!currentUser?.uid) return "";
    if (mode !== "daily") return "";
    const contributionKey = options.contributionKey || getUtcDateKey();
    return `communityBossContribution_${COMMUNITY_BOSS_EVENT.id}_${currentUser.uid}_${mode}_${contributionKey}`;
}

async function contributeCommunityBossWin(mode = "infinite", options = {}) {
    const normalizedMode = mode === "daily" ? "daily" : "infinite";
    if (!isCommunityBossContributionOpen()) return { contributed: false, reason: "inactive" };
    if (!currentUser || !db || typeof firebase === "undefined") {
        return { contributed: false, reason: "login-required" };
    }

    const storageKey = getCommunityBossContributionStorageKey(normalizedMode, options);
    if (storageKey && localStorage.getItem(storageKey) === "true") {
        return { contributed: false, reason: "already-counted" };
    }

    const eventRef = getCommunityBossDocRef();
    const contributorRef = getCommunityBossContributorRef();
    if (!eventRef) return { contributed: false, reason: "unavailable" };
    if (!contributorRef) return { contributed: false, reason: "contributor-unavailable" };

    try {
        let didIncrement = false;
        const contributionValue = getCommunityBossContributionMultiplier();
        await db.runTransaction(async transaction => {
            const snapshot = await transaction.get(eventRef);
            const contributorSnapshot = await transaction.get(contributorRef);
            const currentWins = Math.max(0, Number(snapshot.data()?.wins) || 0);
            if (currentWins >= COMMUNITY_BOSS_EVENT.targetWins || isCommunityBossExpired()) return;
            const profileData = getCurrentProfileData();
            const contributorUsername = String(profileData.username || currentUser.email?.split("@")[0] || "Anonymous").slice(0, 32);
            const contributorProfilePicture = resolveCommunityBossProfilePicturePath(
                profileData.profilePicture || profileData.profilePic
            );

            const payload = {
                wins: firebase.firestore.FieldValue.increment(contributionValue),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastContributionMode: normalizedMode,
                lastContributionUid: currentUser.uid
            };

            if (snapshot.exists) {
                transaction.update(eventRef, payload);
            } else {
                transaction.set(eventRef, {
                    wins: contributionValue,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastContributionMode: normalizedMode,
                    lastContributionUid: currentUser.uid
                });
            }

            if (contributorSnapshot.exists) {
                transaction.update(contributorRef, {
                    wins: firebase.firestore.FieldValue.increment(contributionValue),
                    username: contributorUsername,
                    profilePicture: contributorProfilePicture,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastContributionMode: normalizedMode
                });
            } else {
                transaction.set(contributorRef, {
                    uid: currentUser.uid,
                    username: contributorUsername,
                    profilePicture: contributorProfilePicture,
                    wins: contributionValue,
                    firstContributionAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastContributionMode: normalizedMode
                });
            }
            didIncrement = true;
        });

        if (didIncrement) {
            if (storageKey) localStorage.setItem(storageKey, "true");
            showNotification(`Community boss progress +${contributionValue}`, "success", 2600);
            renderCommunityBossPanel();
            return { contributed: true };
        }
        return { contributed: false, reason: "complete" };
    } catch (error) {
        console.warn("Unable to contribute community boss win:", error);
        return { contributed: false, reason: "error" };
    }
}

async function claimCommunityBossReward() {
    if (!currentUser) {
        openLoginModal();
        return;
    }
    if (!db) {
        showNotification("Community event is unavailable right now.", "error", 3200);
        return;
    }

    const eventRef = getCommunityBossDocRef();
    const snapshot = eventRef ? await eventRef.get().catch(() => null) : null;
    const serverWins = snapshot?.exists ? Math.max(0, Number(snapshot.data()?.wins) || 0) : 0;
    const wins = Math.max(serverWins, getCommunityBossWins());
    const profileData = getCurrentProfileData();

    if (isCommunityBossMilestoneEvent()) {
        const pendingRewards = getPendingCommunityBossRewards(wins, profileData);
        if (!pendingRewards.length) {
            const nextReward = getCommunityBossRewardTiers().find(reward => wins < (Number(reward.goal) || 0));
            const message = getUnlockedCommunityBossRewards(wins).length
                ? "You already claimed every unlocked community reward."
                : nextReward
                ? `Reach ${Number(nextReward.goal).toLocaleString()} community wins to unlock the first reward.`
                : "No community rewards are unlocked right now.";
            showNotification(message, "info", 3200);
            renderCommunityBossPanel();
            return;
        }

        const claimTime = Date.now();
        const rewardBadgeId = COMMUNITY_BOSS_EVENT.rewardBadgeId;
        const unlockedBadgesBefore = getUnlockedBadgeIds(profileData);
        const shouldGrantBadge = pendingRewards.some(reward => reward.badge !== false);
        const grantsNewBadge = shouldGrantBadge && !unlockedBadgesBefore.includes(rewardBadgeId);
        const claimedRewardIds = getClaimedCommunityBossRewardIds(profileData);
        const existingClaim = getCommunityBossRewardClaim(profileData) || {};
        const existingClaims = existingClaim.claims && typeof existingClaim.claims === "object" ? existingClaim.claims : {};
        const existingCrates = existingClaim.crates && typeof existingClaim.crates === "object" ? existingClaim.crates : {};
        const existingMilestones = Array.isArray(existingClaim.claimedMilestones) ? existingClaim.claimedMilestones : [];
        const claimedMilestones = new Set(existingMilestones.map(goal => Number(goal)).filter(Boolean));
        const nextClaims = { ...existingClaims };
        const totalCrates = { ...existingCrates };
        const cratesAwarded = {};
        let totalXpAwarded = 0;

        pendingRewards.forEach(reward => {
            const rewardId = String(reward.id);
            const rewardCrateId = reward.crateId || COMMUNITY_BOSS_EVENT.crateId;
            const rewardCrateCount = Math.max(0, Number(reward.crateCount) || 0);
            const rewardXp = Math.max(0, Number(reward.xp) || 0);
            const rewardGoal = Number(reward.goal) || 0;

            claimedRewardIds.add(rewardId);
            if (rewardGoal) claimedMilestones.add(rewardGoal);
            totalXpAwarded += rewardXp;
            cratesAwarded[rewardCrateId] = (cratesAwarded[rewardCrateId] || 0) + rewardCrateCount;
            totalCrates[rewardCrateId] = (Number(totalCrates[rewardCrateId]) || 0) + rewardCrateCount;
            nextClaims[rewardId] = {
                claimedAt: claimTime,
                goal: rewardGoal,
                xp: rewardXp,
                crates: { [rewardCrateId]: rewardCrateCount },
                crateId: rewardCrateId,
                crateCount: rewardCrateCount,
                badgeId: shouldGrantBadge ? rewardBadgeId : null
            };
        });

        profileData.totalXP = (Number(profileData.totalXP) || 0) + totalXpAwarded;
        const inventory = getCrateInventory(profileData);
        Object.entries(cratesAwarded).forEach(([crateId, count]) => {
            inventory[crateId] = (inventory[crateId] || 0) + count;
        });
        profileData.crateInventory = normalizeCrateInventory(inventory);

        if (shouldGrantBadge) {
            profileData.unlockedBadges = [
                ...new Set([
                    ...unlockedBadgesBefore,
                    rewardBadgeId
                ])
            ];
            profileData.equippedBadge = rewardBadgeId;
        }

        profileData.communityBossRewards = {
            ...(profileData.communityBossRewards && typeof profileData.communityBossRewards === "object" ? profileData.communityBossRewards : {}),
            [COMMUNITY_BOSS_EVENT.id]: {
                claimedAt: Number(existingClaim.claimedAt) || claimTime,
                updatedAt: claimTime,
                rewardMode: "milestone",
                claimedRewardIds: [...claimedRewardIds],
                claimedMilestones: [...claimedMilestones].sort((a, b) => a - b),
                xp: (Number(existingClaim.xp) || 0) + totalXpAwarded,
                crates: totalCrates,
                claims: nextClaims,
                badgeId: shouldGrantBadge ? rewardBadgeId : existingClaim.badgeId || null
            }
        };
        profileData.lastUpdated = Date.now();

        saveUserProfileLocally(profileData);
        await db.collection("userStats").doc(currentUser.uid).set({
            totalXP: profileData.totalXP,
            crateInventory: profileData.crateInventory,
            unlockedBadges: getUnlockedBadgeIds(profileData),
            equippedBadge: getEquippedBadge(),
            communityBossRewards: profileData.communityBossRewards,
            lastUpdated: new Date()
        }, { merge: true });

        updateProfileDisplay(profileData);
        updateProfileBadgeUI();
        renderCratesButton();
        renderCommunityBossPanel();

        const badgeText = grantsNewBadge ? `, and the ${COMMUNITY_BOSS_EVENT.rewardBadgeName} badge` : "";
        showNotification(`Community rewards claimed: ${totalXpAwarded.toLocaleString()} XP, ${formatCommunityBossCrateAwards(cratesAwarded)}${badgeText}.`, "success", 5600);
        return;
    }

    if (!isCommunityBossComplete(wins)) {
        showNotification(`The ${COMMUNITY_BOSS_EVENT.bossName} is not defeated yet.`, "info", 3000);
        return;
    }

    if (hasClaimedCommunityBossReward(profileData)) {
        showNotification("You already claimed this community reward.", "info", 3000);
        renderCommunityBossPanel();
        return;
    }

    const reward = await getCurrentCommunityBossReward();
    const rewardBadgeId = COMMUNITY_BOSS_EVENT.rewardBadgeId;
    const rewardCrateId = reward.crateId || COMMUNITY_BOSS_EVENT.crateId;
    const rewardCrateCount = Math.max(0, Number(reward.crateCount) || 0);

    profileData.totalXP = (Number(profileData.totalXP) || 0) + reward.xp;
    const inventory = getCrateInventory(profileData);
    inventory[rewardCrateId] = (inventory[rewardCrateId] || 0) + rewardCrateCount;
    profileData.crateInventory = normalizeCrateInventory(inventory);
    profileData.unlockedBadges = [
        ...new Set([
            ...(Array.isArray(profileData.unlockedBadges) ? profileData.unlockedBadges : ["starter"]),
            rewardBadgeId
        ])
    ];
    profileData.equippedBadge = rewardBadgeId;
    profileData.communityBossRewards = {
        ...(profileData.communityBossRewards && typeof profileData.communityBossRewards === "object" ? profileData.communityBossRewards : {}),
        [COMMUNITY_BOSS_EVENT.id]: {
            claimedAt: Date.now(),
            rank: reward.rank,
            xp: reward.xp,
            crates: { [rewardCrateId]: rewardCrateCount },
            crateId: rewardCrateId,
            crateCount: rewardCrateCount,
            badgeId: rewardBadgeId
        }
    };
    profileData.lastUpdated = Date.now();

    saveUserProfileLocally(profileData);
    await db.collection("userStats").doc(currentUser.uid).set({
        totalXP: profileData.totalXP,
        crateInventory: profileData.crateInventory,
        unlockedBadges: getUnlockedBadgeIds(profileData),
        equippedBadge: getEquippedBadge(),
        communityBossRewards: profileData.communityBossRewards,
        lastUpdated: new Date()
    }, { merge: true });

    updateProfileDisplay(profileData);
    updateProfileBadgeUI();
    renderCratesButton();
    renderCommunityBossPanel();
    showNotification(`${reward.label} reward claimed: ${reward.xp.toLocaleString()} XP, ${formatCommunityBossCrateReward(reward)}, and the ${COMMUNITY_BOSS_EVENT.rewardBadgeName} badge.`, "success", 5600);
}

window.contributeCommunityBossWin = contributeCommunityBossWin;
window.claimCommunityBossReward = claimCommunityBossReward;
window.openCommunityBossRanksModal = openCommunityBossRanksModal;
window.closeCommunityBossRanksModal = closeCommunityBossRanksModal;
window.openCommunityBossEventModal = openCommunityBossEventModal;
window.closeCommunityBossEventModal = closeCommunityBossEventModal;

const SHARKDLE_SETTINGS_KEY = "sharkdle_qol_settings_v2";
const SHARKDLE_SETTINGS_DEFAULTS = {
    funMode: false,
    sfx: true,
    reducedMotion: false,
    compactUi: false,
    highContrast: false,
    animatedOcean: true,
    ambientAudio: false
};

let sharkdleSettingsAudioContext = null;
let sharkdleAmbientAudioNodes = null;
let sharkdleCursorAnimationStarted = false;
let sharkdleCursorX = window.innerWidth / 2;
let sharkdleCursorY = window.innerHeight / 2;
let sharkdleCursorSmoothX = sharkdleCursorX;
let sharkdleCursorSmoothY = sharkdleCursorY;
let sharkdleLastBubbleAt = 0;

function readSharkdleSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(SHARKDLE_SETTINGS_KEY) || "{}");
        return { ...SHARKDLE_SETTINGS_DEFAULTS, ...(saved && typeof saved === "object" ? saved : {}) };
    } catch (error) {
        return { ...SHARKDLE_SETTINGS_DEFAULTS };
    }
}

function writeSharkdleSettings(settings) {
    localStorage.setItem(SHARKDLE_SETTINGS_KEY, JSON.stringify({ ...SHARKDLE_SETTINGS_DEFAULTS, ...settings }));
}

function getSharkdleAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharkdleSettingsAudioContext) sharkdleSettingsAudioContext = new AudioContextClass();
    if (sharkdleSettingsAudioContext.state === "suspended") {
        sharkdleSettingsAudioContext.resume().catch(() => {});
    }
    return sharkdleSettingsAudioContext;
}

function isSharkdleSfxEnabled() {
    return Boolean(readSharkdleSettings().sfx);
}

function playSfx(name = "click") {
    if (!isSharkdleSfxEnabled()) return;
    const ctx = getSharkdleAudioContext();
    if (!ctx) return;

    const playTone = (frequency, duration, type = "triangle", gainValue = 0.025, slideTo = null, delay = 0) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startAt = ctx.currentTime + delay;
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, startAt);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, startAt + duration);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startAt);
        osc.stop(startAt + duration + 0.03);
    };

    if (name === "success") {
        playTone(523, 0.08, "sine", 0.04);
        playTone(659, 0.09, "sine", 0.04, null, 0.075);
        playTone(784, 0.1, "sine", 0.04, null, 0.15);
        return;
    }

    if (name === "toggle") {
        playTone(330, 0.06, "triangle", 0.03, 440);
        return;
    }

    if (name === "crate") {
        playTone(150, 0.12, "triangle", 0.055, 90);
        playTone(760, 0.13, "sine", 0.04, 980, 0.12);
        return;
    }

    playTone(420, 0.045, "triangle", 0.025);
}

function startAmbientAudio() {
    const ctx = getSharkdleAudioContext();
    if (!ctx || sharkdleAmbientAudioNodes) return;

    const lowOsc = ctx.createOscillator();
    const highOsc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    lowOsc.type = "sine";
    highOsc.type = "triangle";
    lowOsc.frequency.value = 84;
    highOsc.frequency.value = 166;
    filter.type = "lowpass";
    filter.frequency.value = 420;
    gain.gain.value = 0.018;

    lowOsc.connect(filter);
    highOsc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    lowOsc.start();
    highOsc.start();

    sharkdleAmbientAudioNodes = { lowOsc, highOsc, gain, filter };
}

function stopAmbientAudio() {
    if (!sharkdleAmbientAudioNodes) return;
    Object.values(sharkdleAmbientAudioNodes).forEach(node => {
        if (typeof node.stop === "function") {
            try { node.stop(); } catch (error) {}
        }
        if (typeof node.disconnect === "function") {
            try { node.disconnect(); } catch (error) {}
        }
    });
    sharkdleAmbientAudioNodes = null;
}

function createCursorBubble(x, y) {
    if (!document.body.classList.contains("fun-mode") || document.body.classList.contains("reduced-motion")) return;
    const now = Date.now();
    if (now - sharkdleLastBubbleAt < 95) return;
    sharkdleLastBubbleAt = now;

    const bubble = document.createElement("span");
    const size = 8 + Math.random() * 12;
    bubble.className = "cursor-bubble";
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${x + 8}px`;
    bubble.style.top = `${y + 16}px`;
    bubble.style.setProperty("--drift", Math.random().toFixed(2));
    document.body.appendChild(bubble);
    setTimeout(() => bubble.remove(), 1900);
}

function createBitePop(x, y) {
    if (!document.body.classList.contains("fun-mode") || document.body.classList.contains("reduced-motion")) return;
    const bite = document.createElement("span");
    bite.className = "bite-pop";
    bite.style.left = `${x}px`;
    bite.style.top = `${y}px`;
    document.body.appendChild(bite);
    setTimeout(() => bite.remove(), 500);
}

function ensureSharkCursorAnimation() {
    if (sharkdleCursorAnimationStarted) return;
    sharkdleCursorAnimationStarted = true;

    const animate = () => {
        const cursor = document.getElementById("cursor-shark");
        if (cursor && document.body.classList.contains("fun-mode")) {
            sharkdleCursorSmoothX += (sharkdleCursorX - sharkdleCursorSmoothX) * 0.28;
            sharkdleCursorSmoothY += (sharkdleCursorY - sharkdleCursorSmoothY) * 0.28;
            cursor.style.transform = `translate3d(${sharkdleCursorSmoothX - 12}px, ${sharkdleCursorSmoothY - 12}px, 0) rotate(8deg)`;
        }
        requestAnimationFrame(animate);
    };

    document.addEventListener("mousemove", (event) => {
        sharkdleCursorX = event.clientX;
        sharkdleCursorY = event.clientY;
        const cursor = document.getElementById("cursor-shark");
        if (document.body.classList.contains("fun-mode")) {
            cursor?.classList.add("cursor-visible");
            createCursorBubble(event.clientX, event.clientY);
        }
    });

    document.addEventListener("mousedown", (event) => {
        if (!document.body.classList.contains("fun-mode")) return;
        document.getElementById("cursor-shark")?.classList.add("cursor-bite");
        createBitePop(event.clientX, event.clientY);
        playSfx("click");
    });

    document.addEventListener("mouseup", () => {
        document.getElementById("cursor-shark")?.classList.remove("cursor-bite");
    });

    document.addEventListener("mouseleave", () => {
        document.getElementById("cursor-shark")?.classList.remove("cursor-visible");
    });

    document.addEventListener("mouseover", (event) => {
        const interactive = event.target?.closest?.("button, a, input, select, textarea, [role='button'], .profile-inventory-card, .theme-option, .home-v3-event");
        document.getElementById("cursor-shark")?.classList.toggle("cursor-hover", Boolean(interactive));
    });

    animate();
}

function applySharkdleSettings() {
    const settings = readSharkdleSettings();
    document.body.classList.toggle("fun-mode", Boolean(settings.funMode));
    document.body.classList.toggle("reduced-motion", Boolean(settings.reducedMotion));
    document.body.classList.toggle("compact-ui", Boolean(settings.compactUi));
    document.body.classList.toggle("high-contrast", Boolean(settings.highContrast));
    document.body.classList.toggle("ocean-static", !settings.animatedOcean);
    document.body.classList.toggle("ambient-audio-on", Boolean(settings.ambientAudio));

    const pairs = {
        "fun-mode-toggle": settings.funMode,
        "sfx-toggle": settings.sfx,
        "reduced-motion-toggle": settings.reducedMotion,
        "compact-ui-toggle": settings.compactUi,
        "high-contrast-toggle": settings.highContrast,
        "animated-ocean-toggle": settings.animatedOcean,
        "ambient-audio-toggle": settings.ambientAudio
    };

    Object.entries(pairs).forEach(([id, value]) => {
        const input = document.getElementById(id);
        if (input) input.checked = Boolean(value);
    });

    if (settings.ambientAudio) {
        startAmbientAudio();
    } else {
        stopAmbientAudio();
    }

    if (!settings.funMode) {
        document.getElementById("cursor-shark")?.classList.remove("cursor-visible", "cursor-hover", "cursor-bite");
    }

    localStorage.setItem("sharkdle_fun_mode_enabled", String(Boolean(settings.funMode)));
}

function setSharkdleSetting(key, value) {
    const settings = readSharkdleSettings();
    settings[key] = Boolean(value);
    writeSharkdleSettings(settings);
    applySharkdleSettings();
    playSfx("toggle");
}

function resetSharkdleSettings() {
    writeSharkdleSettings({ ...SHARKDLE_SETTINGS_DEFAULTS });
    applySharkdleSettings();
    playSfx("success");
    showNotification("Settings reset.", "success", 2500);
}

function testSharkdleSound() {
    const settings = readSharkdleSettings();
    settings.sfx = true;
    writeSharkdleSettings(settings);
    applySharkdleSettings();
    playSfx("success");
    showNotification("Sound test played.", "success", 2200);
}

function bindSharkdleSettings() {
    ensureSharkCursorAnimation();

    const bindings = [
        ["fun-mode-toggle", "funMode"],
        ["sfx-toggle", "sfx"],
        ["reduced-motion-toggle", "reducedMotion"],
        ["compact-ui-toggle", "compactUi"],
        ["high-contrast-toggle", "highContrast"],
        ["animated-ocean-toggle", "animatedOcean"],
        ["ambient-audio-toggle", "ambientAudio"]
    ];

    bindings.forEach(([id, key]) => {
        const input = document.getElementById(id);
        if (!input || input.dataset.settingsBound === "true") return;
        input.dataset.settingsBound = "true";
        input.addEventListener("change", () => setSharkdleSetting(key, input.checked));
    });

    const test = document.getElementById("settings-test-sound");
    if (test && test.dataset.settingsBound !== "true") {
        test.dataset.settingsBound = "true";
        test.addEventListener("click", testSharkdleSound);
    }

    const reset = document.getElementById("settings-reset");
    if (reset && reset.dataset.settingsBound !== "true") {
        reset.dataset.settingsBound = "true";
        reset.addEventListener("click", resetSharkdleSettings);
    }

    applySharkdleSettings();
}

document.addEventListener("DOMContentLoaded", bindSharkdleSettings);
bindSharkdleSettings();

window.applySharkdleSettings = applySharkdleSettings;
window.resetSharkdleSettings = resetSharkdleSettings;
window.testSharkdleSound = testSharkdleSound;
window.playSfx = playSfx;

let consumablesPageInterval = null;

function renderConsumablesPage() {
    const pageRoot = document.getElementById("consumables-page");
    if (!pageRoot) return;

    const loginStateCopy = document.getElementById("consumables-login-state");
    const loginBtn = document.getElementById("consumables-login-btn");
    const shieldCountEl = document.getElementById("consumables-shield-count");

    if (loginBtn) {
        loginBtn.onclick = () => openLoginModal();
    }

    const loggedIn = Boolean(currentUser);
    pageRoot.classList.toggle("consumables-logged-out", !loggedIn);

    if (!loggedIn) {
        if (loginStateCopy) loginStateCopy.textContent = "Login to view and use your consumables.";
        if (shieldCountEl) shieldCountEl.textContent = "0";
        return;
    }

    const profileData = getCurrentProfileData();
    if (loginStateCopy) loginStateCopy.textContent = "Consumables are synced to your account.";
    if (shieldCountEl) shieldCountEl.textContent = String(getStreakShieldCount(profileData));
}

function ensureConsumablesPageTimer() {
    const pageRoot = document.getElementById("consumables-page");
    if (!pageRoot) {
        if (consumablesPageInterval) {
            clearInterval(consumablesPageInterval);
            consumablesPageInterval = null;
        }
        return;
    }

    renderConsumablesPage();
    if (consumablesPageInterval) return;
    consumablesPageInterval = setInterval(() => {
        if (!document.getElementById("consumables-page")) {
            clearInterval(consumablesPageInterval);
            consumablesPageInterval = null;
            return;
        }
        renderConsumablesPage();
    }, 1000);
}

function setupGlobalXpEventListener() {
    if (!db) return;
    if (globalXpEventUnsubscribe) {
        globalXpEventUnsubscribe();
        globalXpEventUnsubscribe = null;
    }
    globalXpEventUnsubscribe = db
        .collection(GLOBAL_XP_EVENT_CONFIG_PATH.collection)
        .doc(GLOBAL_XP_EVENT_CONFIG_PATH.doc)
        .onSnapshot(snapshot => {
            globalXpEventOverride = snapshot.exists ? (snapshot.data() || null) : null;
            ensureXpEventBannerTimer();
        }, error => {
            console.warn("Global XP event listener failed:", error);
        });
}

function getValidIndexThemeIds() {
    return INDEX_THEME_OPTIONS.map(option => option.id);
}

function normalizeIndexThemeId(themeId = "default") {
    const normalized = String(themeId || "").trim().toLowerCase();
    return getValidIndexThemeIds().includes(normalized) ? normalized : "default";
}

function isSeasonalThemeDisabled() {
    return localStorage.getItem(SEASONAL_THEME_DISABLED_KEY) === "true";
}

function updateSeasonalThemeToggleUI() {
    const button = document.getElementById("seasonal-theme-toggle-btn");
    const status = document.getElementById("seasonal-theme-status");
    if (!button) return;

    const disabled = isSeasonalThemeDisabled();
    button.textContent = disabled ? "Enable Seasonal Theme" : "Use Default Theme";
    if (status) {
        status.textContent = disabled
            ? "Seasonal themes are disabled on this device."
            : "Seasonal themes are enabled.";
    }
}

window.toggleSeasonalThemeOverride = function toggleSeasonalThemeOverride() {
    const nextDisabled = !isSeasonalThemeDisabled();
    if (nextDisabled) {
        localStorage.setItem(SEASONAL_THEME_DISABLED_KEY, "true");
        showNotification("Seasonal theme disabled (this device only).", "success", 2500);
    } else {
        localStorage.removeItem(SEASONAL_THEME_DISABLED_KEY);
        showNotification("Seasonal theme enabled.", "success", 2000);
    }

    // Re-apply the current (remote/cached) theme immediately on the home page.
    applyIndexTheme(localStorage.getItem("globalIndexThemeId") || "default");
    updateSeasonalThemeToggleUI();
};

function applyIndexTheme(themeId = "default", force = false) {
    const body = document.body;
    if (!body) return "default";

    const resolvedThemeId = normalizeIndexThemeId(themeId);
    const modePagesUseDefaultTheme = body.classList.contains("mode-v3-page") && resolvedThemeId !== "default";
    const appliedThemeId = (modePagesUseDefaultTheme || (!force && isSeasonalThemeDisabled() && resolvedThemeId !== "default"))
        ? "default"
        : resolvedThemeId;
    getValidIndexThemeIds().forEach(id => {
        body.classList.remove(`index-theme-${id}`);
        body.classList.remove(`global-ui-theme-${id}`);
    });
    body.classList.add(`index-theme-${appliedThemeId}`);
    body.classList.add(`global-ui-theme-${appliedThemeId}`);
    localStorage.setItem("globalIndexThemeId", resolvedThemeId);
    localStorage.setItem("globalUiThemeCache", resolvedThemeId);
    updateSeasonalCratePanels();

    return appliedThemeId;
}

function setupGlobalIndexThemeListener() {
    if (!db) return;
    if (globalIndexThemeUnsubscribe) {
        globalIndexThemeUnsubscribe();
        globalIndexThemeUnsubscribe = null;
    }

    // Apply cached theme immediately on index while Firestore snapshot connects.
    applyIndexTheme(localStorage.getItem("globalIndexThemeId") || "default");

    globalIndexThemeUnsubscribe = db
        .collection(GLOBAL_INDEX_THEME_CONFIG_PATH.collection)
        .doc(GLOBAL_INDEX_THEME_CONFIG_PATH.doc)
        .onSnapshot(snapshot => {
            const remoteThemeId = snapshot.exists ? snapshot.data()?.themeId : "default";
            applyIndexTheme(remoteThemeId || "default");
        }, error => {
            console.warn("Global index theme listener failed:", error);
            applyIndexTheme(localStorage.getItem("globalIndexThemeId") || "default");
        });
}

function getCrateRewardPreviewMarkup(reward) {
    if (reward.type === "theme") {
        const theme = getCardThemeMeta(reward.themeId);
        return `
            <div class="crate-reward-preview">
                <div style="background:${theme.preview}; border-radius: 16px;"></div>
            </div>
        `;
    }
    if (reward.type === "badge") {
        const badge = getBadgeMeta(reward.badgeId);
        return `
            <div class="crate-reward-preview">
                <div style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.04);padding:10px;font-size:34px;line-height:1;">${badge.emoji || "🦈"}</div>
            </div>
        `;
    }
    if (reward.type === "item") {
        const quantity = Math.max(1, Math.floor(Number(reward.quantity) || 1));
        const quantityLabel = quantity > 1 ? `x${quantity}` : "";
        return `
            <div class="crate-reward-preview">
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(255,255,255,0.04);padding:10px;line-height:1;">
                    <div style="font-size:34px;">${reward.emoji || "🛡️"}</div>
                    <div style="margin-top:6px;font-size:13px;font-weight:700;color:#dffaff;">${quantityLabel}</div>
                </div>
            </div>
        `;
    }
    return `
        <div class="crate-reward-preview">
            <img src="${reward.imagePath}" alt="${reward.name}">
        </div>
    `;
}

function renderCratesButton() {
    const cratesBtn = document.getElementById("crates-btn");
    const countEl = document.getElementById("crates-btn-count");
    if (!cratesBtn || !countEl) return;

    const inventory = getCrateInventory();
    const crateCount = inventory.reef + inventory.summer + inventory.christmas + inventory.halloween;
    countEl.textContent = crateCount;
    cratesBtn.classList.remove("hidden");
}

function renderHomeCratesModal() {
    const profileData = getCurrentProfileData();
    const inventory = getCrateInventory(profileData);
    const reefCount = inventory.reef || 0;
    const summerCount = inventory.summer || 0;
    const totalCount = Object.values(inventory).reduce((sum, value) => sum + (Number(value) || 0), 0);

    const reefCountEl = document.getElementById("home-crate-reef-count");
    const summerCountEl = document.getElementById("home-crate-summer-count");
    const reefBtn = document.getElementById("home-open-reef-crate-btn");
    const summerBtn = document.getElementById("home-open-summer-crate-btn");
    const status = document.getElementById("home-crates-status");

    if (reefCountEl) reefCountEl.textContent = reefCount;
    if (summerCountEl) summerCountEl.textContent = summerCount;

    if (reefBtn) {
        reefBtn.disabled = !currentUser || reefCount <= 0 || crateOpeningInProgress;
        reefBtn.textContent = currentUser ? "Open Crate" : "Login Required";
    }
    if (summerBtn) {
        summerBtn.disabled = !currentUser || summerCount <= 0 || crateOpeningInProgress;
        summerBtn.textContent = currentUser ? "Open Crate" : "Login Required";
    }

    if (status) {
        status.textContent = !currentUser
            ? "Login to open crates and save cosmetic rewards."
            : totalCount > 0
                ? `${totalCount} crate${totalCount === 1 ? "" : "s"} ready. Duplicate cosmetics convert into XP.`
                : "No crates ready yet. Win games or claim pass rewards to earn more.";
    }
}

function openHomeCratesModal() {
    renderHomeCratesModal();
    const modal = document.getElementById("homeCratesModal");
    if (modal) modal.classList.remove("hidden");
}

function closeHomeCratesModal() {
    const modal = document.getElementById("homeCratesModal");
    if (modal) modal.classList.add("hidden");
}

async function openHomeCrate(crateId = "reef") {
    await openCrate(crateId);
    renderHomeCratesModal();
    renderCratesButton();
}

function openFullCratesModalFromHome() {
    closeHomeCratesModal();
    openCraftingModalFromHome();
}

function openCraftingModalFromHome() {
    closeHomeCratesModal();
    closeCratesModal?.();
    const modal = document.getElementById("craftingModal");
    if (modal) {
        updateSummerCrateCraftingUI?.();
        modal.classList.remove("hidden");
    }
}

function closeCraftingModal() {
    document.getElementById("craftingModal")?.classList.add("hidden");
}

function renderCratesModal() {
    const profileData = getCurrentProfileData();
    const inventory = getCrateInventory(profileData);
    const crateCount = inventory.reef;
    const summerCrateCount = inventory.summer || 0;
    const christmasCrateCount = inventory.christmas || 0;
    const halloweenCrateCount = inventory.halloween || 0;

    const countValue = document.getElementById("crate-count-value");
    if (countValue) countValue.textContent = crateCount;

    const summerCountEl = document.getElementById("summer-crate-count-value");
    if (summerCountEl) summerCountEl.textContent = summerCrateCount;
    const christmasCountEl = document.getElementById("christmas-crate-count-value");
    if (christmasCountEl) christmasCountEl.textContent = christmasCrateCount;
    const halloweenCountEl = document.getElementById("halloween-crate-count-value");
    if (halloweenCountEl) halloweenCountEl.textContent = halloweenCrateCount;

    renderCratesButton();
    updateSeasonalCratePanels(profileData);
    updateSummerCrateCraftingUI(profileData);

    const statusCopy = document.getElementById("crate-status-copy");
    const instantToggle = document.getElementById("crate-instant-toggle");
    const pityCopy = document.getElementById("crate-pity-copy");
    const streakShieldCopy = document.getElementById("streak-shield-copy");
    if (!statusCopy || !instantToggle || !pityCopy) return;

    const pityReady = isLegendaryPityReady(profileData);
    const cratesUntilPity = getCratesUntilLegendaryPity(profileData);
    const streakShieldCount = getStreakShieldCount(profileData);

    instantToggle.checked = getCrateInstantOpenEnabled(profileData);
    pityCopy.textContent = pityReady
        ? "Next crate is guaranteed legendary."
        : `${cratesUntilPity} crate${cratesUntilPity === 1 ? "" : "s"} until guaranteed legendary.`;
    if (streakShieldCopy) {
        streakShieldCopy.textContent = `🛡️ Streak Shields: ${streakShieldCount} / 3 (max)`;
    }

    const totalCrateCount = crateCount + summerCrateCount + christmasCrateCount + halloweenCrateCount;
    if (!currentUser) {
        statusCopy.textContent = "Login to open crates, save rewards, and keep cosmetic unlocks synced.";
        ["open-crate-btn", "open-summer-crate-btn", "open-christmas-crate-btn", "open-halloween-crate-btn", "craft-summer-crate-btn"].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = true;
                btn.textContent = "Login Required";
            }
        });
    } else {
        const labelMap = {
            "open-crate-btn": "Open Cosmetic Crate",
            "open-summer-crate-btn": "Open Summer Crate",
            "open-christmas-crate-btn": "Open Christmas Crate",
            "open-halloween-crate-btn": "Open Halloween Crate"
        };
        Object.entries(labelMap).forEach(([id, label]) => {
            const btn = document.getElementById(id);
            if (btn) btn.textContent = label;
        });
    }

    if (currentUser && totalCrateCount <= 0) {
        statusCopy.textContent = "You don't have any crates to open.";
    } else if (currentUser) {
        statusCopy.textContent = getCrateInstantOpenEnabled(profileData)
            ? "Instant open is enabled."
            : "Animation reveal is enabled.";
    }
}

function renderCrateDropsModal(crateId = "reef") {
    const rewardGrid = document.getElementById("crate-drops-grid");
    if (!rewardGrid) return;
    const profileData = getCurrentProfileData();
    const pool = getCratePoolById(crateId);

    rewardGrid.innerHTML = pool.map(reward => {
        const owned = isCrateRewardOwned(profileData, reward);
        return `
            <article class="crate-reward-card ${owned ? "owned" : ""}">
                <span class="crate-rarity ${reward.rarity}">${reward.rarity}</span>
                ${getCrateRewardPreviewMarkup(reward)}
                <h4>${reward.name}</h4>
                <p>${owned ? "Collected" : reward.blurb}</p>
            </article>
        `;
    }).join("");
}

function getProfileTimestampMs(value) {
    if (!value) return 0;
    if (typeof value === "number") return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function getUnifiedCosmeticList(localItems, remoteItems, key) {
    const merged = [];
    [...(Array.isArray(localItems) ? localItems : []), ...(Array.isArray(remoteItems) ? remoteItems : [])].forEach(item => {
        if (!item) return;
        const identifier = item?.[key];
        if (!identifier || merged.some(existing => existing?.[key] === identifier)) return;
        merged.push(item);
    });
    return merged;
}

function getMergedUniqueIds(localIds, remoteIds, fallback = []) {
    return [...new Set([...(Array.isArray(fallback) ? fallback : []), ...(Array.isArray(localIds) ? localIds : []), ...(Array.isArray(remoteIds) ? remoteIds : [])])];
}

function openCratesModal() {
    crateOpeningInProgress = false;
    setCratesModalTab("inventory");
    renderCratesModal();
    const modal = document.getElementById("cratesModal");
    if (modal) modal.classList.remove("hidden");
}

function openCrateDropsModal(crateId = "reef") {
    renderCrateDropsModal(crateId);
    document.getElementById("crateDropsModal")?.classList.remove("hidden");
}

function closeCratesModal() {
    const modal = document.getElementById("cratesModal");
    if (modal) modal.classList.add("hidden");
    closeCrateUnboxOverlay();
    crateOpeningInProgress = false;
    updateSummerCrateCraftingUI();
}

function closeCrateDropsModal() {
    document.getElementById("crateDropsModal")?.classList.add("hidden");
}

function pickCrateReward(availableRewards) {
    const totalWeight = availableRewards.reduce((sum, reward) => sum + (crateRarityWeights[reward] || 0), 0);
    let roll = Math.random() * totalWeight;
    for (const reward of availableRewards) {
        roll -= crateRarityWeights[reward] || 0;
        if (roll <= 0) return reward;
    }
    return availableRewards[availableRewards.length - 1];
}

function pickCrateRewardRarity(profileData = getCurrentProfileData()) {
    if (isLegendaryPityReady(profileData)) {
        return "legendary";
    }
    return pickCrateReward(Object.keys(crateRarityWeights));
}

function grantCrateReward(profileData, reward) {
    const duplicateReward = reward.type === "item" ? false : isCrateRewardOwned(profileData, reward);
    if (reward.type === "pfp") {
        const earnedCosmetics = Array.isArray(profileData.earnedCosmetics) ? [...profileData.earnedCosmetics] : [];
        if (!duplicateReward) {
            earnedCosmetics.push({
                name: reward.name,
                imagePath: reward.imagePath,
                crateReward: true,
                rarity: reward.rarity
            });
        }
        profileData.earnedCosmetics = earnedCosmetics;
    } else if (reward.type === "theme") {
        if (!duplicateReward) {
            profileData.unlockedCardThemes = [...new Set([...(Array.isArray(profileData.unlockedCardThemes) ? profileData.unlockedCardThemes : ["default"]), reward.themeId])];
        }
    } else if (reward.type === "badge") {
        if (!duplicateReward) {
            profileData.unlockedBadges = [...new Set([...(Array.isArray(profileData.unlockedBadges) ? profileData.unlockedBadges : ["starter"]), reward.badgeId])];
        }
    } else if (reward.type === "item") {
        const quantity = Math.max(1, Math.floor(Number(reward.quantity) || 1));
        if (reward.itemId === STREAK_SHIELD_ITEM_ID) {
            const currentShields = getStreakShieldCount(profileData);
            const canAccept = Math.min(quantity, 3 - currentShields);
            if (canAccept > 0) {
                setStreakShieldCount(profileData, currentShields + canAccept);
            }
        }
    }
    return {
        profileData,
        duplicateReward
    };
}

async function persistCrateProfileUpdate(profileData) {
    profileData.lastUpdated = Date.now();
    saveUserProfileLocally(profileData, { skipRemoteSync: true });

    if (!currentUser || !db) return;
    await db.collection("userStats").doc(currentUser.uid).set({
        crateInventory: normalizeCrateInventory(profileData.crateInventory),
        cratesOpened: Math.max(0, Number(profileData.cratesOpened) || 0),
        cratesSinceLegendary: getCratesSinceLegendary(profileData),
        streakShields: getStreakShieldCount(profileData),
        instantCrateOpen: getCrateInstantOpenEnabled(profileData),
        pearls: getPearlCount(profileData),
        pearlBoostExpiresAt: getPearlBoostExpiresAt(profileData),
        seasonXpBoosts: getSeasonXpBoosts(profileData),
        totalXP: Math.max(0, Number(profileData.totalXP) || 0),
        earnedCosmetics: Array.isArray(profileData.earnedCosmetics) ? profileData.earnedCosmetics : [],
        unlockedBadges: Array.isArray(profileData.unlockedBadges) ? profileData.unlockedBadges : ["starter"],
        unlockedCardThemes: Array.isArray(profileData.unlockedCardThemes) ? profileData.unlockedCardThemes : ["default"],
        lastUpdated: profileData.lastUpdated,
        ...buildCosmeticSyncPayload(profileData)
    }, { merge: true });
}

const CRATE_UNBOX_THEME_IDS = ["reef", "summer", "christmas", "halloween"];
let activeCrateUnboxId = "reef";

function getCrateDefinition(crateId = "reef") {
    return crateDefinitions[crateId] || crateDefinitions.reef;
}

function getCrateUnboxCopy(crateId, phase = "opening", rewardName = "") {
    const crateName = getCrateDefinition(crateId).name;
    const itemLabel = rewardName ? String(rewardName) : "something";

    if (crateId === "summer") {
        if (phase === "reward") return `You found ${itemLabel} in the summer crate!`;
        if (phase === "duplicate") return `You found ${itemLabel} in the summer crate! (Already owned — converted to XP.)`;
        return "The summer crate is opening...";
    }
    if (phase === "reward") return `${crateName} reward revealed!`;
    if (phase === "duplicate") return "Duplicate converted into XP.";
    return `The ${crateName.toLowerCase()} is opening...`;
}

function resetCrateUnboxOverlay(crateId = "reef") {
    const themeId = CRATE_UNBOX_THEME_IDS.includes(crateId) ? crateId : "reef";
    const crateDef = getCrateDefinition(themeId);
    activeCrateUnboxId = themeId;

    const overlay = document.getElementById("crateUnboxOverlay");
    const stage = document.getElementById("crate-unbox-stage");
    const crate = document.getElementById("crate-unbox-crate");
    const burst = document.getElementById("crate-unbox-burst");
    const splash = document.getElementById("crate-unbox-splash");
    const icon = document.getElementById("crate-unbox-icon");
    const reveal = document.getElementById("crate-overlay-reveal");

    CRATE_UNBOX_THEME_IDS.forEach(id => {
        overlay?.classList.remove(`crate-theme-${id}`);
        stage?.classList.remove(`crate-theme-${id}`);
    });
    overlay?.classList.add(`crate-theme-${themeId}`);
    stage?.classList.add(`crate-theme-${themeId}`);

    if (crate) {
        crate.className = `crate-unbox-crate crate-theme-${themeId}`;
    }
    if (burst) burst.className = "crate-unbox-burst";
    if (splash) splash.classList.remove("active");
    if (icon) icon.className = `fa-solid ${crateDef.icon}`;
    if (reveal) {
        reveal.classList.remove("hidden", "crate-reveal-summer");
        reveal.innerHTML = "";
    }
}

function openCrateUnboxOverlay(crateId = "reef") {
    resetCrateUnboxOverlay(crateId);
    const overlay = document.getElementById("crateUnboxOverlay");
    const copy = document.getElementById("crate-unbox-copy");
    if (overlay) overlay.classList.remove("hidden");
    if (copy) copy.textContent = getCrateUnboxCopy(crateId, "opening");
}

function getCrateUnboxRevealDelay(crateId = activeCrateUnboxId) {
    return crateId === "summer" ? 1150 : 950;
}

function getCrateUnboxRevealHoldDelay(crateId = activeCrateUnboxId) {
    return crateId === "summer" ? 2050 : 1850;
}

function applyCrateUnboxOpeningState(reward) {
    const crate = document.getElementById("crate-unbox-crate");
    const burst = document.getElementById("crate-unbox-burst");
    const splash = document.getElementById("crate-unbox-splash");
    const isSummer = activeCrateUnboxId === "summer";

    if (crate) {
        crate.classList.add(isSummer ? "opening-summer" : "opening", `rarity-${reward.rarity}`);
    }
    if (burst) burst.classList.add(isSummer ? "active-summer" : "active", `rarity-${reward.rarity}`);
    if (splash && isSummer) splash.classList.add("active");
}

function closeCrateUnboxOverlay() {
    const overlay = document.getElementById("crateUnboxOverlay");
    if (overlay) overlay.classList.add("hidden");
    resetCrateUnboxOverlay(activeCrateUnboxId);
}

function showCrateOverlayReward(reward, crateId = activeCrateUnboxId) {
    const copy = document.getElementById("crate-unbox-copy");
    const reveal = document.getElementById("crate-overlay-reveal");
    const isSummer = crateId === "summer";
    applyCrateUnboxOpeningState(reward);
    if (copy) {
        copy.textContent = isSummer
            ? getCrateUnboxCopy(crateId, "reward", reward.name)
            : `${reward.name} dropped from the ${getCrateDefinition(crateId).name.toLowerCase()}.`;
    }
    if (reveal) {
        reveal.classList.remove("hidden");
        if (isSummer) reveal.classList.add("crate-reveal-summer");
        reveal.innerHTML = `
            <div class="crate-reveal-card crate-reveal-card-${reward.rarity}${isSummer ? " crate-reveal-card-summer" : ""}">
                ${getCrateRewardPreviewMarkup(reward)}
                <div class="crate-reveal-copy">
                    <span class="crate-rarity ${reward.rarity}">${reward.rarity}</span>
                    <h4>${reward.name}</h4>
                    <p>${reward.blurb}</p>
                </div>
            </div>
        `;
    }
}

let crateSkipTimeout = null;

function unlockCrateAchievement(crateId = "reef") {
    const achievementId = crateAchievementIds[crateId];
    if (!achievementId) return;

    if (typeof window.unlockAchievement === "function") {
        window.unlockAchievement(achievementId);
        return;
    }

    const unlockedAchievements = JSON.parse(localStorage.getItem("unlockedAchievements") || "[]");
    if (!unlockedAchievements.includes(achievementId)) {
        unlockedAchievements.push(achievementId);
        localStorage.setItem("unlockedAchievements", JSON.stringify(unlockedAchievements));
        syncUnlockedAchievementToFirebase(achievementId, unlockedAchievements);
    }
}

function finalizeCrateRewardPresentation(reward, duplicateReward, duplicateXpAward, crateId = "reef") {
    if (duplicateReward) {
        showNotification(`${reward.name} was already owned. Converted to ${duplicateXpAward.totalXp} XP.`, "success", 4600);
        if (typeof updateIndexStats === "function") updateIndexStats();
    } else if (reward.type === "pfp") {
        showCosmeticUnlockToast({
            name: reward.name,
            imagePath: reward.imagePath
        }, {
            title: "Crate Cosmetic Unlocked!",
            subtitle: `${reward.name} profile picture`,
            accent: "#ffd47f",
            background: "linear-gradient(135deg, rgba(255, 196, 87, 0.96), rgba(91, 58, 9, 0.96))",
            icon: "📦"
        });
    } else if (reward.type === "theme") {
        showNotification(`${reward.name} profile theme unlocked from a crate!`, "success", 4200);
    } else if (reward.type === "badge") {
        showNotification(`${reward.name} badge unlocked from a crate!`, "success", 4200);
    } else if (reward.type === "item") {
        const quantity = Math.max(1, Math.floor(Number(reward.quantity) || 1));
        if (reward.itemId === STREAK_SHIELD_ITEM_ID) {
            const totalShields = getStreakShieldCount();
            if (totalShields >= 3) {
                showNotification(`You have max streak shields (${totalShields}/3)`, "info", 4200);
            } else {
                showNotification(`${reward.name} +${quantity}! You now have ${totalShields}.`, "success", 4200);
            }
        } else {
            showNotification(`${reward.name} +${quantity}!`, "success", 4200);
        }
    }

    if (typeof loadAvailablePFPs === "function") loadAvailablePFPs();
    if (typeof loadEarnedCosmetics === "function") loadEarnedCosmetics();
    if (typeof renderThemeSelection === "function") renderThemeSelection();
    if (typeof renderBadgeSelection === "function") renderBadgeSelection();
    if (typeof updateProfileBadgeUI === "function") updateProfileBadgeUI();
    unlockCrateAchievement(crateId);
    renderCratesModal();
    if (typeof renderConsumablesPage === "function") {
        renderConsumablesPage();
    }
}

function toggleCrateInstantOpen(enabled) {
    const profileData = getCurrentProfileData();
    profileData.instantCrateOpen = Boolean(enabled);
    saveUserProfileLocally(profileData);
    renderCratesModal();
}

async function openCrate(crateId = "reef") {
    if (crateOpeningInProgress) return;
    const profileData = getCurrentProfileData();
    const inventory = getCrateInventory(profileData);
    if ((inventory[crateId] || 0) <= 0) {
        renderCratesModal();
        const crateName = getCrateDefinition(crateId).name;
        showNotification(`You don't have any ${crateName}s to open.`, "error", 2800);
        return;
    }

    crateOpeningInProgress = true;
    updateSummerCrateCraftingUI(profileData);
    inventory[crateId] -= 1;
    profileData.crateInventory = normalizeCrateInventory(inventory);
    profileData.cratesOpened = getOpenedCrateCount(profileData) + 1;
    const rewardRarity = pickCrateRewardRarity(profileData);
    const rarityRewards = getCrateRewardsByRarity(rewardRarity, crateId);
    const pool = getCratePoolById(crateId);
    const reward = rarityRewards[Math.floor(Math.random() * rarityRewards.length)] || pool[0];
    const previousCratesSinceLegendary = getCratesSinceLegendary(profileData);
    const { duplicateReward } = grantCrateReward(profileData, reward);
    profileData.cratesSinceLegendary = reward.rarity === "legendary" ? 0 : previousCratesSinceLegendary + 1;
    let duplicateXpAward = null;
    if (duplicateReward) {
        const baseDuplicateXp = crateDuplicateXpRewards[reward.rarity] || crateDuplicateXpRewards.common;
        duplicateXpAward = typeof window.applyLimitedTimeXpBonus === "function"
            ? window.applyLimitedTimeXpBonus(baseDuplicateXp)
            : { totalXp: baseDuplicateXp, baseXp: baseDuplicateXp, bonusXp: 0, multiplier: 1, event: null };
        profileData.totalXP = (profileData.totalXP || 0) + duplicateXpAward.totalXp;
    }
    await persistCrateProfileUpdate(profileData).catch(error => console.warn("Crate sync failed:", error));
    renderCratesButton();
    renderCratesModal();

    if (getCrateInstantOpenEnabled(profileData)) {
        crateOpeningInProgress = false;
        finalizeCrateRewardPresentation(reward, duplicateReward, duplicateXpAward, crateId);
        return;
    }

    openCrateUnboxOverlay(crateId);

    await new Promise(resolve => {
        crateSkipTimeout = setTimeout(resolve, getCrateUnboxRevealDelay(crateId));
    });

    if (duplicateReward) {
        showCrateOverlayDuplicateReward(reward, duplicateXpAward, crateId);
    } else {
        showCrateOverlayReward(reward, crateId);
    }

    await new Promise(resolve => {
        crateSkipTimeout = setTimeout(resolve, getCrateUnboxRevealHoldDelay(crateId));
    });
    crateOpeningInProgress = false;
    finalizeCrateRewardPresentation(reward, duplicateReward, duplicateXpAward, crateId);
    await new Promise(resolve => setTimeout(resolve, 1200));
    closeCrateUnboxOverlay();
}

function maybeAwardCrateDrop(source = "win") {
    if (!currentUser) return false;
    if (Math.random() > CRATE_DROP_CHANCE) return false;

    const profileData = getCurrentProfileData();
    const inventory = getCrateInventory(profileData);
    // Only award reef crates (normal crates) regardless of theme
    inventory.reef += 1;
    showNotification(`Cosmetic Crate dropped from your ${source}!`, "success", 3800);
    profileData.crateInventory = normalizeCrateInventory(inventory);
    persistCrateProfileUpdate(profileData).catch(error => console.warn("Crate sync failed:", error));
    renderCratesButton();
    renderCratesModal();
    return true;
}

window.openCratesModal = openCratesModal;
window.setCratesModalTab = setCratesModalTab;
window.openHomeCratesModal = openHomeCratesModal;
window.closeHomeCratesModal = closeHomeCratesModal;
window.openHomeCrate = openHomeCrate;
window.openFullCratesModalFromHome = openFullCratesModalFromHome;
window.openCrateDropsModal = openCrateDropsModal;
window.closeCratesModal = closeCratesModal;
window.closeCrateDropsModal = closeCrateDropsModal;
window.openCrate = openCrate;
window.toggleCrateInstantOpen = toggleCrateInstantOpen;
window.maybeAwardCrateDrop = maybeAwardCrateDrop;
window.getOpenedCrateCount = getOpenedCrateCount;
window.getStreakShieldCount = getStreakShieldCount;
window.applyStreakShieldOnLoss = applyStreakShieldOnLoss;
window.getActiveLimitedTimeXpEvent = getActiveLimitedTimeXpEvent;
window.applyLimitedTimeXpBonus = applyLimitedTimeXpBonus;
window.openPearlShopModal = openPearlShopModal;
window.closePearlShopModal = closePearlShopModal;
window.buyPearlShopItem = buyPearlShopItem;
window.renderPearlShop = renderPearlShop;
window.renderConsumablesPage = renderConsumablesPage;
window.ensureConsumablesPageTimer = ensureConsumablesPageTimer;
window.forceXpEventPreview = function(enabled = true) {
    localStorage.setItem("forceXpEventPreview", enabled ? "true" : "false");
    ensureXpEventBannerTimer();
    return enabled ? "XP event preview enabled." : "XP event preview disabled.";
};
window.openAdminAbuseModal = openAdminAbuseModal;
window.closeAdminAbuseModal = closeAdminAbuseModal;
window.openAdminAbuseMenu = openAdminAbuseMenu;
window.adminAbuse = openAdminAbuseMenu;

function getCardThemeMeta(themeId) {
    return sharkPassCardThemes.find(theme => theme.id === themeId) || sharkPassCardThemes[0];
}

function getBadgeMeta(badgeId) {
    const builtInBadge = allBadges.find(badge => badge.id === badgeId);
    const passReward = sharkPassRewards.find(reward => reward.type === "badge" && reward.badgeId === badgeId);
    if (passReward) {
        return {
            id: badgeId,
            name: builtInBadge?.name || passReward.name,
            emoji: builtInBadge?.emoji || sharkPassBadgeMeta[badgeId]?.emoji || "🦈",
            tier: sharkPassBadgeTiers[badgeId] || 1,
            description: builtInBadge?.description || passReward.blurb || `${passReward.name} Shark Pass badge.`,
            rarity: passReward.rarity || "common"
        };
    }
    const crateReward = getAllCrateBadgeRewards().find(reward => reward.badgeId === badgeId);
    if (crateReward) {
        return {
            id: badgeId,
            name: builtInBadge?.name || crateReward.name,
            emoji: builtInBadge?.emoji || sharkPassBadgeMeta[badgeId]?.emoji || "🦈",
            tier: sharkPassBadgeTiers[badgeId] || 1,
            description: builtInBadge?.description || crateReward.blurb || `${crateReward.name} crate badge.`,
            rarity: crateReward.rarity || "common"
        };
    }
    if (!builtInBadge) return allBadges[0];
    return {
        ...builtInBadge,
        rarity: builtInBadge.rarity || (builtInBadge.id === "starter" ? "core" : "special")
    };
}

function getBadgeRarityMeta(badge) {
    if (badge.id === "starter") return badgeRarityMeta.core;
    if (badge.id === "tester") return badgeRarityMeta.code;
    if (badge.id === "dev") return badgeRarityMeta.special;
    const passReward = sharkPassRewards.find(reward => reward.type === "badge" && reward.badgeId === badge.id);
    const crateReward = getAllCrateBadgeRewards().find(reward => reward.badgeId === badge.id);
    return badgeRarityMeta[passReward?.rarity || crateReward?.rarity || badge.rarity || "common"] || badgeRarityMeta.common;
}

function getBadgeRarityRank(badge) {
    const rarityOrder = ["core", "code", "special", "common", "rare", "epic", "legendary"];
    const rarityClass = getBadgeRarityMeta(badge).className;
    const rank = rarityOrder.indexOf(rarityClass);
    return rank === -1 ? rarityOrder.length : rank;
}

function getBadgeUnlockOrder(badge) {
    if (badge.id === "starter") return -3;
    if (badge.id === "tester") return -2;
    if (badge.id === "dev") return -1;
    const passReward = sharkPassRewards.find(reward => reward.type === "badge" && reward.badgeId === badge.id);
    if (passReward) return passReward.level;
    if (getAllCrateBadgeRewards().some(reward => reward.badgeId === badge.id)) return 500;
    return 999;
}

function getBadgePalette(rarityClass) {
    const palettes = {
        core: { shell: "#0f3c56", border: "#61e7ff", fin: "#9ff6ff", mark: "#d7ffff" },
        special: { shell: "#40215e", border: "#d3a2ff", fin: "#f0d2ff", mark: "#ffffff" },
        common: { shell: "#123f39", border: "#78f0c5", fin: "#b8ffe8", mark: "#effff7" },
        rare: { shell: "#11384f", border: "#7fe8ff", fin: "#b8f5ff", mark: "#ebfdff" },
        epic: { shell: "#2a2663", border: "#b1a2ff", fin: "#d7d1ff", mark: "#f4f1ff" },
        legendary: { shell: "#4d3511", border: "#ffd37b", fin: "#ffe7ad", mark: "#fff8df" }
    };
    return palettes[rarityClass] || palettes.common;
}

function buildBadgeIconSVG(badge, rarityClass) {
    const palette = getBadgePalette(rarityClass);
    const tier = Math.max(1, Math.min(5, badge.tier || 1));
    const marks = Array.from({ length: tier }, (_, index) => {
        const x = 24 + index * 12;
        return `<circle cx="${x}" cy="56" r="3" fill="${palette.mark}" opacity="${0.78 + index * 0.04}"/>`;
    }).join("");
    return `
<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="4" y="4" width="64" height="64" rx="20" fill="${palette.shell}" stroke="${palette.border}" stroke-width="3"/>
  <path d="M19 49c4-11 8-24 17-33 9 8 14 22 17 33-7-4-13-5-17-5s-10 1-17 5Z" fill="${palette.fin}"/>
  <path d="M31 24c4 6 6 12 7 18-4-2-8-3-11-3 1-5 2-10 4-15Z" fill="${palette.mark}" opacity=".28"/>
  <path d="M18 51c6-4 12-6 18-6s12 2 18 6" fill="none" stroke="${palette.border}" stroke-width="2.4" stroke-linecap="round"/>
  ${marks}
</svg>`.trim();
}

function getBadgeIconMarkup(badge) {
    const rarity = getBadgeRarityMeta(badge);
    return buildBadgeIconSVG(badge, rarity.className);
}

function getUnlockedBadgeIds(profileData = getCurrentProfileData()) {
    return getUnlockedBadges(profileData.uid || currentUser?.uid || "", profileData).map(badge => badge.id);
}

function getUnlockedCardThemeIds(profileData = getCurrentProfileData()) {
    return getUnlockedCardThemes(profileData).map(theme => theme.id);
}

function buildCosmeticSyncPayload(profileData = getCurrentProfileData()) {
    const profilePic = profileData.profilePicture || profileData.profilePic || "images/pfp/shark1.png";
    return {
        profilePicture: profilePic,
        profilePic: profilePic,
        equippedBadge: profileData.equippedBadge || "starter",
        equippedCardTheme: profileData.equippedCardTheme || "default",
        equippedTitle: getEquippedProfileTitle(profileData),
        unlockedBadges: getUnlockedBadgeIds(profileData),
        unlockedCardThemes: getUnlockedCardThemeIds(profileData),
        unlockedTitles: getUnlockedProfileTitleIds(profileData),
        lastUpdated: profileData.lastUpdated || Date.now()
    };
}

function getEquippedCardTheme() {
    const profileData = getCurrentProfileData();
    const equipped = profileData.equippedCardTheme || "default";
    const unlocked = getUnlockedCardThemes(profileData);
    return unlocked.some(theme => theme.id === equipped) ? equipped : "default";
}

function setEquippedCardTheme(themeId) {
    const profileData = getCurrentProfileData();
    syncAchievementThemeUnlocks(profileData);
    profileData.equippedCardTheme = themeId;
    saveUserProfileLocally(profileData);
    if (currentUser && db) {
        db.collection("userStats").doc(currentUser.uid).set(buildCosmeticSyncPayload(profileData), { merge: true });
    }
    applyProfileCardTheme(themeId);
    renderThemeSelection();
}

function applyProfileCardTheme(themeId = getEquippedCardTheme()) {
    const profileHero = document.getElementById("profile-hero-card");
    if (!profileHero) return;
    const baseClasses = ["profile-hero-card"];
    if (profileHero.closest(".profile-overhaul-modal")) {
        baseClasses.unshift("profile-overhaul-card");
    }
    profileHero.className = `${baseClasses.join(" ")} theme-${themeId || "default"}`;
    if (typeof getCardThemeMeta === "function") {
        const theme = getCardThemeMeta(themeId || "default");
        profileHero.style.setProperty("background", `
            radial-gradient(circle at 8% 18%, rgba(255,255,255,.16), transparent 28%),
            radial-gradient(circle at 92% 12%, rgba(104,226,240,.18), transparent 32%),
            ${theme.preview}
        `, "important");
    }
}

function applyThemeToProfileCard(elementId, themeId = "default") {
    const card = document.getElementById(elementId);
    if (!card) return;
    card.className = `profile-hero-card friend-profile-hero theme-${themeId || "default"}`;
}

function getLeaderboardRankLabel(rank) {
    if (rank === 1) return "🏆 #1";
    if (rank === 2) return "🥈 #2";
    if (rank === 3) return "🥉 #3";
    return "Outside Top 3";
}

let latestProfileLeaderboardRequest = 0;
let latestFriendLeaderboardRequest = 0;

function applyLeaderboardBadge(elementId, rank) {
    const badge = document.getElementById(elementId);
    if (!badge) return;

    badge.className = 'profile-leaderboard-badge hidden';
    badge.textContent = '';

    if (rank === 1 || rank === 2 || rank === 3) {
        badge.textContent = getLeaderboardRankLabel(rank);
        badge.className = `profile-leaderboard-badge rank-${rank}`;
    }
}

async function fetchLeaderboardPlacement(uid) {
    if (!uid || !db) return null;
    try {
        const snapshot = await db.collection("userStats")
            .orderBy("wins", "desc")
            .limit(25)
            .get();

        let rank = 1;
        let placement = null;
        snapshot.forEach(doc => {
            if (placement !== null) return;
            if (doc.id === uid || doc.data()?.uid === uid) {
                placement = rank;
                return;
            }
            rank += 1;
        });
        return placement;
    } catch (error) {
        console.warn("Unable to fetch leaderboard placement:", error);
        return null;
    }
}

function applyDuelPlayerTheme(elementId, themeId = "default") {
    const card = document.getElementById(elementId);
    if (!card) return;
    const theme = getCardThemeMeta(themeId || "default");
    card.style.background = `
        radial-gradient(circle at top left, rgba(255, 255, 255, 0.08), transparent 34%),
        ${theme.preview}
    `;
    card.style.borderColor = "rgba(97, 231, 255, 0.18)";
}

function renderThemeSelection() {
    const container = document.getElementById("theme-select-container");
    if (!container || !currentUser) return;
    syncAchievementThemeUnlocks();
    const unlockedThemes = getUnlockedCardThemes();
    const equippedTheme = getEquippedCardTheme();
    container.innerHTML = "";
    unlockedThemes
        .map(theme => ({ ...theme, ...getThemeCosmeticMeta(theme) }))
        .filter(theme => shouldShowCosmetic(theme, profileInventoryFilters.themes))
        .sort((a, b) => {
            const rarityDiff = getCosmeticRaritySortRank(a.rarity) - getCosmeticRaritySortRank(b.rarity);
            if (rarityDiff !== 0) return rarityDiff;
            return String(a.name || "").localeCompare(String(b.name || ""));
        })
        .forEach(theme => {
        const button = document.createElement("button");
        button.className = `theme-option rarity-${theme.rarity} ${theme.id === equippedTheme ? "active" : ""}`;
        button.onclick = () => setEquippedCardTheme(theme.id);
        button.innerHTML = `
            <span class="theme-swatch" style="background:${theme.preview};"></span>
            <span>${theme.name}</span>
            <small class="cosmetic-chip-row"><b class="rarity-chip rarity-${theme.rarity}">${getCosmeticRarityLabel(theme.rarity)}</b><b class="source-chip" title="${theme.source}">${getShortCosmeticSourceLabel(theme.source)}</b></small>
        `;
        container.appendChild(button);
    });
    if (!container.innerHTML.trim()) {
        container.innerHTML = `<div class="profile-empty-card">No themes match this filter.</div>`;
    }
    applyProfileCardTheme(equippedTheme);
}
const allBadges = [
    { id: "starter", name: "Starter", emoji: "🦈", description: "Default badge for all players." },
    { id: "dev", name: "Developer", emoji: "🖥️", description: "Awarded only to the developer.", devOnly: true },
    { id: "tester", name: "Tester", emoji: "🎮", description: "Awarded for testing via code redeem.", codeUnlock: true },
    { id: "anniversary", name: "Anniversary", emoji: "🎉", description: "Awarded for redeeming the Anniversary code.", codeUnlock: true },
    { id: "lucky-fin", name: "Lucky Fin", emoji: "🍀", description: "Awarded from the daily prize wheel.", codeUnlock: true },
    { id: "extinction", name: "Extinction", emoji: "☄️", description: "Awarded for defeating a summer community boss.", rarity: "legendary", codeUnlock: true },
    { id: "spiral-hunter", name: "Spiral Hunter", emoji: "🌀", description: "Awarded for defeating the Halloween Helicoprion community boss.", rarity: "legendary", codeUnlock: true },
    { id: "frost-anvil", name: "Frost Anvil", emoji: "❄️", description: "Awarded for defeating the Christmas Stethacanthus community boss.", rarity: "legendary", codeUnlock: true }
];

const currentPassBadgeDefs = [
    { id: "reef-scout", name: "Shiver", emoji: "🐟", description: "A Shark Pass badge for reaching level 3.", passLevel: 3 },
    { id: "bronze-fin", name: "Pup", emoji: "🪸", description: "A Shark Pass badge for reaching level 5.", passLevel: 5 },
    { id: "night-diver", name: "Juvenile", emoji: "🌙", description: "A Shark Pass badge for reaching level 8.", passLevel: 8 },
    { id: "abyss-explorer", name: "Oceanic", emoji: "💙", description: "A Shark Pass badge for reaching level 10.", passLevel: 10 },
    { id: "open-water-ace", name: "Subadult", emoji: "✨", description: "A Shark Pass badge for reaching level 12.", passLevel: 12 },
    { id: "storm-tracker", name: "Prime", emoji: "⚡", description: "A Shark Pass badge for reaching level 18.", passLevel: 18 },
    { id: "apex-voyager", name: "Apex", emoji: "👑", description: "A Shark Pass badge for reaching level 20.", passLevel: 20 },
    { id: "current-rider", name: "Current Rider", emoji: "🌊", description: "A Shark Pass badge for reaching level 22.", passLevel: 22 },
    { id: "tidebreaker", name: "Tidebreaker", emoji: "💫", description: "A Shark Pass badge for reaching level 26.", passLevel: 26 }
];

for (let i = allBadges.length - 1; i >= 0; i--) {
    if (currentPassBadgeDefs.some(badge => badge.id === allBadges[i].id)) {
        allBadges.splice(i, 1);
    }
}
allBadges.push(...currentPassBadgeDefs);
allBadges.push(
    { id: "reef-glint", name: "Driftwood", emoji: "🪵", description: "A badge found in Cosmetic Crates." },
    { id: "kelp-warden", name: "Smelly Boot", emoji: "🥾", description: "A badge found in Cosmetic Crates." },
    { id: "trench-myth", name: "Message Bottle", emoji: "🍾", description: "A badge found in Cosmetic Crates." },
    { id: "aurora-fin", name: "Doubloon", emoji: "🪙", description: "A badge found in Cosmetic Crates." },
    { id: "Tidepool", name: "Tidepool", emoji: "🌀", description: "A summer crate badge." },
    { id: "Ice Cream", name: "Ice Cream", emoji: "🍦", description: "A summer crate badge." },
    { id: "Horizon", name: "Horizon", emoji: "🌅", description: "A summer crate badge." },
    { id: "Paradise", name: "Paradise", emoji: "🌴", description: "A summer crate badge." },
    { id: "Christmas", name: "Christmas", emoji: "🎄", description: "A christmas crate badge." },
    { id: "Present", name: "Present", emoji: "🎁", description: "A christmas crate badge." },
    { id: "Snowflake", name: "Snowflake", emoji: "❄️", description: "A christmas crate badge." },
    { id: "Santa", name: "Santa", emoji: "🎅", description: "A christmas crate badge." },
    { id: "Pumpkin", name: "Pumpkin", emoji: "🎃", description: "A halloween crate badge." },
    { id: "Bat", name: "Bat", emoji: "🦇", description: "A halloween crate badge." },
    { id: "Ghost", name: "Ghost", emoji: "👻", description: "A halloween crate badge." },
    { id: "Vampire", name: "Vampire", emoji: "🧛", description: "A halloween crate badge." }
);

function getUnlockedBadges(uid, profileData = getCurrentProfileData()) {
    // Always unlock starter badge
    const badges = [allBadges[0]];
    if (isDeveloperUid(uid || profileData?.uid)) badges.push(allBadges[1]);
    const activeProfile = profileData || getCurrentProfileData();
    const playerLevel = getCurrentPlayerLevel(activeProfile);
    // Unlock tester badge if code redeemed
    try {
        if (activeProfile.testerBadgeUnlocked || hasRedeemedCode('TESTER')) {
            if (!badges.some(b => b.id === 'tester')) badges.push(allBadges.find(b => b.id === 'tester'));
        }
    } catch {}
    // Unlock anniversary badge if code redeemed
    try {
        if (hasRedeemedCode('ANNIVERSARY2026') || (Array.isArray(activeProfile.unlockedBadges) && activeProfile.unlockedBadges.includes('anniversary'))) {
            if (!badges.some(b => b.id === 'anniversary')) badges.push(allBadges.find(b => b.id === 'anniversary'));
        }
    } catch {}
    allBadges
        .filter(badge => badge.passLevel && playerLevel >= badge.passLevel)
        .forEach(badge => {
            if (!badges.some(existing => existing.id === badge.id)) {
                badges.push(badge);
            }
        });
    sharkPassRewards
        .filter(reward => reward.type === "badge" && reward.level <= playerLevel)
        .forEach(reward => {
            const badgeMeta = getBadgeMeta(reward.badgeId);
            if (!badges.some(existing => existing.id === badgeMeta.id)) {
                badges.push(badgeMeta);
            }
        });
    getStoredUnlockedBadgeIds(activeProfile).forEach(badgeId => {
        const badgeMeta = getBadgeMeta(badgeId);
        if (badgeMeta && !badges.some(existing => existing.id === badgeMeta.id)) {
            badges.push(badgeMeta);
        }
    });
    return badges.map(badge => getBadgeMeta(badge.id));
}

function getEquippedBadge(profileData = getCurrentProfileData()) {
    const equipped = profileData.equippedBadge || "starter";
    // Only allow equipped badge if it's unlocked
    const unlocked = getUnlockedBadges(profileData.uid || (currentUser && currentUser.uid), profileData);
    if (unlocked.some(b => b.id === equipped)) {
        return equipped;
    }
    return "starter";
}

function setEquippedBadge(badgeId) {
    const profileData = getCurrentProfileData();
    profileData.equippedBadge = badgeId;
    saveUserProfileLocally(profileData);
    // Save to Firestore if logged in
    if (currentUser && db) {
        db.collection("userStats").doc(currentUser.uid).set(buildCosmeticSyncPayload(profileData), { merge: true });
    }
    updateProfileBadgeUI();
    renderBadgeSelection();
    renderProfileInventoryUI(profileData);
}

function updateProfileBadgeUI() {
    const badgeImg = document.getElementById("profile-badge-img");
    const badgeLabel = document.getElementById("profile-badge-label");
    const badgeId = getEquippedBadge();
    const badge = getBadgeMeta(badgeId);
    // Remove any previous emoji span
    let prev = document.getElementById('profile-badge-emoji');
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    if (badgeImg) badgeImg.style.display = 'none';
    // Color rarity logic
    let borderColor = '#00b4d8', bgColor = 'rgba(0,180,216,0.12)', textColor = '#00b4d8';
    if (badge.id === 'dev') {
        borderColor = '#FFD700';
        bgColor = 'rgba(255,215,0,0.13)';
        textColor = '#FFD700';
    } else if (badge.id === 'tester') {
        borderColor = '#ff8a3d';
        bgColor = 'rgba(255,138,61,0.15)';
        textColor = '#ffc18d';
    } else if (badge.id === 'starter') {
        borderColor = '#00b4d8';
        bgColor = 'rgba(0,180,216,0.12)';
        textColor = '#00b4d8';
    }
    // Insert emoji with styled container
    if (badgeImg && badgeImg.parentNode) {
        const emblem = document.createElement('div');
        emblem.id = 'profile-badge-emoji';
        emblem.className = 'profile-badge-emblem';
        emblem.style.borderColor = borderColor;
        emblem.style.background = bgColor;
        emblem.textContent = badge.emoji || "🦈";
        badgeImg.parentNode.insertBefore(emblem, badgeImg.nextSibling);
    }
    if (badgeLabel) {
        badgeLabel.textContent = badge && badge.name ? badge.name : "Badge";
        badgeLabel.style.color = textColor;
    }
}

function renderBadgeSelection() {
    const badgeContainer = document.getElementById("badge-select-container");
    if (!badgeContainer || !currentUser) return;
    badgeContainer.innerHTML = "";
    const unlocked = getUnlockedBadges(currentUser.uid).sort((a, b) => {
        const rarityDiff = getBadgeRarityRank(a) - getBadgeRarityRank(b);
        if (rarityDiff !== 0) return rarityDiff;
        const unlockDiff = getBadgeUnlockOrder(a) - getBadgeUnlockOrder(b);
        if (unlockDiff !== 0) return unlockDiff;
        return a.name.localeCompare(b.name);
    });
    const equippedBadge = getEquippedBadge();
    unlocked.forEach(badge => {
        const rarityMeta = getBadgeRarityMeta(badge);
        // Color rarity logic
        let borderColor = '#00b4d8', bgColor = 'rgba(0,180,216,0.12)', textColor = '#00b4d8';
        if (badge.id === 'dev') {
            borderColor = '#FFD700';
            bgColor = 'rgba(255,215,0,0.13)';
            textColor = '#FFD700';
        } else if (badge.id === 'tester') {
            borderColor = '#ff8a3d';
            bgColor = 'rgba(255,138,61,0.15)';
            textColor = '#ffc18d';
        } else if (badge.id === 'starter') {
            borderColor = '#00b4d8';
            bgColor = 'rgba(0,180,216,0.12)';
            textColor = '#00b4d8';
        } else if (rarityMeta.className === 'rare') {
            borderColor = '#6ee7ff';
            bgColor = 'rgba(77,208,225,0.14)';
            textColor = '#9cf4ff';
        } else if (rarityMeta.className === 'epic') {
            borderColor = '#a99bff';
            bgColor = 'rgba(120,119,255,0.16)';
            textColor = '#d2cbff';
        } else if (rarityMeta.className === 'legendary') {
            borderColor = '#ffd47f';
            bgColor = 'rgba(255,196,87,0.18)';
            textColor = '#ffe3ad';
        }
        const div = document.createElement("div");
        div.className = `badge-option rarity-${rarityMeta.className}`;
        if (badge.id === equippedBadge) {
            div.classList.add("active");
        }
        div.onclick = () => setEquippedBadge(badge.id);
        div.innerHTML = `
          <span class="badge-option-kicker">Shark Badge</span>
          <span class="badge-option-emoji" style="background:${bgColor};border-color:${borderColor};color:${textColor};">${badge.emoji || "🦈"}</span>
          <span class="badge-option-name" style="color:${textColor};">${badge.name}</span>
          <span class="badge-option-rarity rarity-${rarityMeta.className}">${rarityMeta.label}</span>
        `;
        badgeContainer.appendChild(div);
    });
}

function getProfileTitleMeta(titleId) {
    return profileTitleDefs.find(title => title.id === titleId) || profileTitleDefs[0];
}

function getUnlockedProfileTitleIds(profileData = getCurrentProfileData()) {
    const storedTitles = Array.isArray(profileData.unlockedTitles) ? profileData.unlockedTitles : [];
    const normalized = storedTitles
        .map(titleId => getProfileTitleMeta(titleId).id)
        .filter(titleId => titleId && profileTitleDefs.some(title => title.id === titleId));
    return [...new Set(normalized)];
}

function getUnlockedProfileTitles(profileData = getCurrentProfileData()) {
    return [
        profileTitleDefs[0],
        ...getUnlockedProfileTitleIds(profileData).map(getProfileTitleMeta)
    ];
}

function getEquippedProfileTitle(profileData = getCurrentProfileData()) {
    const equippedTitle = profileData.equippedTitle || "";
    return getUnlockedProfileTitleIds(profileData).includes(equippedTitle) ? equippedTitle : "";
}

function updateProfileTitleUI(profileData = getCurrentProfileData()) {
    const titleEl = document.getElementById("profile-title-label");
    if (!titleEl) return;
    const equippedTitle = getEquippedProfileTitle(profileData);
    const titleMeta = getProfileTitleMeta(equippedTitle);
    titleEl.textContent = equippedTitle ? titleMeta.name : "";
    titleEl.classList.toggle("hidden", !equippedTitle);
}

function renderTitleSelection() {
    const container = document.getElementById("title-select-container");
    if (!container || !currentUser) return;
    const profileData = getCurrentProfileData();
    const unlockedTitles = getUnlockedProfileTitles(profileData);
    const equippedTitle = getEquippedProfileTitle(profileData);
    container.innerHTML = "";

    unlockedTitles.forEach(title => {
        const button = document.createElement("button");
        button.className = `title-option ${title.id === equippedTitle ? "active" : ""}`;
        button.type = "button";
        button.onclick = () => setEquippedProfileTitle(title.id);
        button.innerHTML = `
            <span>${title.name}</span>
            <small>${title.description}</small>
        `;
        container.appendChild(button);
    });
}

function setEquippedProfileTitle(titleId) {
    const profileData = getCurrentProfileData();
    const normalizedTitleId = getProfileTitleMeta(titleId).id;
    if (normalizedTitleId && !getUnlockedProfileTitleIds(profileData).includes(normalizedTitleId)) return;

    profileData.equippedTitle = normalizedTitleId;
    saveUserProfileLocally(profileData);
    if (currentUser && db) {
        db.collection("userStats").doc(currentUser.uid).set(buildCosmeticSyncPayload(profileData), { merge: true });
    }
    updateProfileTitleUI(profileData);
    renderTitleSelection();
}

const firebaseConfig = {
    apiKey: "AIzaSyAS9l8O1jRMafPt3r0lF6mqjr2-gl-EbZ0",
    authDomain: "sharkdle-leaderboard.firebaseapp.com",
    databaseURL: "https://sharkdle-leaderboard-default-rtdb.firebaseio.com",
    projectId: "sharkdle-leaderboard",
    storageBucket: "sharkdle-leaderboard.firebasestorage.app",
    messagingSenderId: "429123174628",
    appId: "1:429123174628:web:42ae9baed69c4b087c2cf1",
    measurementId: "G-HV5FFNKM5C"
};

let auth, db;

// Global sync state to prevent race conditions
let isSyncing = false;
let syncQueue = [];

// Global notification system
function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `global-notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: ${type === 'error' ? '#d32f2f' : type === 'success' ? '#4caf50' : '#2196F3'};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 9999;
        animation: slideUp 0.3s ease-out;
        max-width: 400px;
        word-wrap: break-word;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), duration);
}

function showCosmeticUnlockToast(cosmetic, options = {}) {
    if (!cosmetic?.imagePath || !cosmetic?.name) return;

    const {
        title = 'Cosmetic Unlocked!',
        subtitle = cosmetic.name,
        accent = '#00b4d8',
        background = 'linear-gradient(135deg, rgba(0, 180, 216, 0.96), rgba(0, 62, 82, 0.96))',
        duration = 4200,
        icon = '🎨'
    } = options;

    const notification = document.createElement('div');
    notification.className = 'cosmetic-unlock-toast';
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 280px;
        max-width: 340px;
        padding: 16px 18px;
        border-radius: 14px;
        background: ${background};
        color: #fff;
        border: 2px solid ${accent};
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.32);
        z-index: 10000;
        animation: slideUp 0.3s ease-out;
        backdrop-filter: blur(8px);
    `;

    notification.innerHTML = `
        <div style="width: 64px; height: 64px; flex: 0 0 64px; border-radius: 14px; overflow: hidden; border: 2px solid ${accent}; background: rgba(255,255,255,0.12); box-shadow: 0 6px 16px rgba(0,0,0,0.22);">
            <img src="${cosmetic.imagePath}" alt="${cosmetic.name}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
        <div style="min-width: 0; flex: 1 1 auto;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span style="font-size: 18px; line-height: 1;">${icon}</span>
                <div style="font-size: 15px; font-weight: 800; color: ${accent};">${title}</div>
            </div>
            <div style="font-size: 14px; font-weight: 700; line-height: 1.25; word-break: break-word;">${subtitle}</div>
        </div>
    `;

    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideUp 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

// Loading state manager
function showLoadingState(element, show = true) {
    if (show) {
        element.disabled = true;
        element.style.opacity = '0.6';
        element.style.pointerEvents = 'none';
    } else {
        element.disabled = false;
        element.style.opacity = '1';
        element.style.pointerEvents = 'auto';
    }
}

// Firebase init with retry limit
let initRetries = 0;
const MAX_INIT_RETRIES = 10;

function initializeFirebase() {
    if (typeof firebase === 'undefined') {
        if (initRetries < MAX_INIT_RETRIES) {
            console.warn(`Firebase not loaded, retrying... (${initRetries + 1}/${MAX_INIT_RETRIES})`);
            initRetries++;
            setTimeout(initializeFirebase, 100);
        } else {
            console.error('Firebase failed to initialize after max retries');
            showNotification('Connection error: Firebase failed to load', 'error', 5000);
        }
        return;
    }
    
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    auth = firebase.auth();
    db = firebase.firestore();
    setupGlobalXpEventListener();
    setupGlobalIndexThemeListener();
    setupCommunityBossEventListener();
    
    // Set up offline support detection
    window.addEventListener('online', () => {
        console.log('Connection restored');
        showNotification('Connection restored', 'success');
        updatePresenceHeartbeat();
    });
    window.addEventListener('offline', () => {
        console.warn('Offline - changes will sync when connection returns');
        showNotification('Offline - changes will sync when connection returns', 'info', 5000);
    });
    
    // Set up auth state listener after Firebase is initialized
    setupAuthStateListener();
}

initializeFirebase();

const APP_ROUTE_MAP = Object.freeze({
    "daily.html": "Daily/index.html",
    "Daily/": "Daily/index.html",
    "infinite.html": "Infinite/index.html",
    "Infinite/": "Infinite/index.html",
    "practice.html": "Practice/index.html",
    "Practice/": "Practice/index.html",
    "achievements.html": "Achievements/index.html",
    "Achievements/": "Achievements/index.html",
    "leaderboards.html": "Leaderboard/index.html",
    "Leaderboard/": "Leaderboard/index.html",
    "library.html": "Library/index.html",
    "Library/": "Library/index.html",
    "sharkpass.html": "Sharkpass/index.html",
    "Sharkpass/": "Sharkpass/index.html",
    "story.html": "Story/index.html",
    "Story/": "Story/index.html",
    "rng.html": "Minigames/SharkRNG/index.html",
    "Minigames/SharkRNG/": "Minigames/SharkRNG/index.html",
    "secret.html": "shark-rescue/index.html",
    "shark-rescue/": "shark-rescue/index.html",
    "updates.html": "Updates/index.html",
    "Updates/": "Updates/index.html",
    "early-release.html": "EarlyRelease/index.html",
    "EarlyRelease/": "EarlyRelease/index.html"
});

const APP_ROUTE_FOLDERS = Object.freeze([
    "achievements",
    "daily",
    "infinite",
    "practice",
    "leaderboard",
    "library",
    "sharkpass",
    "story",
    "updates",
    "earlyrelease",
    "minigames",
    "shark-rescue"
]);

function getAppRootUrl() {
    const rootUrl = new URL(window.location.href);
    const pathParts = rootUrl.pathname.split("/");
    const routeIndex = pathParts.findIndex(part => APP_ROUTE_FOLDERS.includes(decodeURIComponent(part).toLowerCase()));

    rootUrl.pathname = routeIndex >= 0
        ? `${pathParts.slice(0, routeIndex).join("/")}/`
        : rootUrl.pathname.replace(/[^/]*$/, "");
    rootUrl.search = "";
    rootUrl.hash = "";
    return rootUrl;
}

function resolveAppPath(page) {
    const rawPage = String(page || "");
    if (!rawPage || rawPage.startsWith("#") || /^[a-z][a-z\d+\-.]*:/i.test(rawPage)) {
        return rawPage;
    }
    if (rawPage.startsWith("../") || rawPage.startsWith("./")) {
        return new URL(rawPage, window.location.href).href;
    }
    const mappedPage = APP_ROUTE_MAP[rawPage] || rawPage;
    return new URL(mappedPage.replace(/^\/+/, ""), getAppRootUrl()).href;
}

window.resolveAppPath = resolveAppPath;

// Navigation helper function
function navigate(page) {
    window.location.href = resolveAppPath(page);
}

// ----- shark pass reward definitions -----
// this list is shared by multiple helpers (signup, stats sync, cosmetics)
const levelRewards = [
    { level: 2, imagePath: 'images/levelPfp/Shark6.png', name: 'Angel Shark' },
    { level: 3, imagePath: 'images/levelPfp/Shark7.png', name: 'Blue Shark' },
    { level: 4, imagePath: 'images/levelPfp/Shark8.png', name: 'Blacktip Reef Shark' },
    { level: 5, imagePath: 'images/levelPfp/Shark9.png', name: 'Tiger Shark' },
    { level: 6, imagePath: 'images/levelPfp/Shark10.png', name: 'Thresher Shark' },
    { level: 7, imagePath: 'images/levelPfp/Shark11.png', name: 'Lemon Shark' },
    { level: 8, imagePath: 'images/levelPfp/Shark12.png', name: 'Epaulette Shark' },
    { level: 9, imagePath: 'images/levelPfp/Shark13.png', name: 'Saw Shark' },
    { level: 10, imagePath: 'images/levelPfp/Shark14.png', name: 'Nurse Shark' },
    { level: 15, imagePath: 'images/levelPfp/Shark15.png', name: 'Oceanic Whitetip' },
    { level: 20, imagePath: 'images/levelPfp/Shark16.png', name: 'Mako Shark' },
];

// ----- REDEEM CODE SYSTEM -----
const redeemCodes = {
    'SHARKDLE': { xp: 2500, cosmetics: [{ imagePath: 'images/codePfp/Shark17.png', name: 'Wobbegong Shark' }], description: '2.5k XP + Wobbegong Shark Profile Icon' },
    'UPDATE1': { xp: 1000, cosmetics: [{ imagePath: 'images/codePfp/Shark18.png', name: 'Greenland Shark' }], description: '1k XP + Greenland Shark Profile Icon' },
    'UPDATE2': { xp: 1500, cosmetics: [{ imagePath: 'images/codePfp/Shark19.png', name: 'Goblin Shark' }], description: '1.5k XP + Goblin Shark Profile Icon' },
    'TIKTOK2026': { xp: 2000, cosmetics: [{ imagePath: 'images/codePfp/MantaRay.png', name: 'Manta Ray' }], description: '2k XP + Manta Ray Profile Icon' },
    'INSTAGRAM2026': { xp: 2000, cosmetics: [{ imagePath: 'images/codePfp/WhitespottedEagleRay.png', name: 'Whitespotted Eagle Ray' }], description: '2k XP + Whitespotted Eagle Ray Profile Icon' },
    'SUMMER2026': { xp: 3000, crates: { summer: 1 }, description: '3k XP + 1 Summer Crate' },
    'SORRY': { xp: 5000, description: '5k XP apology reward' },
    'TESTER': { badge: 'tester', description: 'Unlocks the Tester badge (🎮)' }
};

delete redeemCodes.TESTER;

function applyCodeCrateRewards(profileData, crateRewards = {}) {
    if (!crateRewards || typeof crateRewards !== "object") return [];
    const inventory = getCrateInventory(profileData);
    const granted = [];
    Object.entries(crateRewards).forEach(([crateId, amount]) => {
        const count = Math.max(0, Math.floor(Number(amount) || 0));
        if (!count || !crateDefinitions[crateId]) return;
        inventory[crateId] = (inventory[crateId] || 0) + count;
        granted.push({ crateId, count, name: getCrateDefinition(crateId).name });
    });
    if (granted.length) {
        profileData.crateInventory = normalizeCrateInventory(inventory);
    }
    return granted;
}

// Keep track of redeemed codes in localStorage
function getRedeemedCodes() {
    const redeemed = localStorage.getItem("redeemedCodes");
    return redeemed ? JSON.parse(redeemed) : [];
}

function addRedeemedCode(code) {
    const redeemed = getRedeemedCodes();
    const codeUpper = code.toUpperCase();
    if (!redeemed.includes(codeUpper)) {
        redeemed.push(codeUpper);
        localStorage.setItem("redeemedCodes", JSON.stringify(redeemed));
        // Special logic for TESTER
        if (codeUpper === 'TESTER') {
            // Mark badge as unlocked in profile
            const profileData = getCurrentProfileData();
            profileData.testerBadgeUnlocked = true;
            saveUserProfileLocally(profileData);
            // Save to Firestore if logged in
            if (currentUser && db) {
                db.collection("userStats").doc(currentUser.uid).set({ testerBadgeUnlocked: true }, { merge: true });
            }
            showNotification('Tester badge unlocked! Go equip it in your profile.', 'success', 4000);
        }
    }
}

function hasRedeemedCode(code) {
    const codeUpper = code.toUpperCase();
    // Check localStorage first
    const localRedeemed = getRedeemedCodes();
    if (localRedeemed.includes(codeUpper)) return true;
    
    // Also check if the cosmetic from this code is already in earnedCosmetics (from Firebase)
    const profileData = getCurrentProfileData();
    const earnedCosmetics = Array.isArray(profileData.earnedCosmetics) ? profileData.earnedCosmetics : [];
    
    // Check if any cosmetic from this code is already owned
    if (redeemCodes[codeUpper] && redeemCodes[codeUpper].cosmetics) {
        const codeCosmetics = redeemCodes[codeUpper].cosmetics;
        for (const cosmetic of codeCosmetics) {
            if (earnedCosmetics.some(c => c.imagePath === cosmetic.imagePath || c.name === cosmetic.name)) {
                return true;
            }
        }
    }
    
    return false;
}

const xpIncrements = [
    0,
    1000,
    1500,
    2000,
    2500,
    3000,
    4000,
    4500,
    5000,
    5500,
    6000,
    6500,
    7000,
    7500,
    8000,
    8500,
    9000,
    9500,
    10000,
    10500
];

function getXPForLevel(level) {
    // cumulative XP required to reach *start* of given level
    if (level <= 1) return 0;
    let sum = 0;
    for (let l = 1; l < level; l++) {
        sum += xpIncrements[l] !== undefined ? xpIncrements[l] : (1000 + (l - 1) * 500);
    }
    return sum;
}

function getLevelFromXP(totalXP) {
    let lvl = 1;
    while (true) {
        const nextXP = getXPForLevel(lvl + 1);
        if (totalXP < nextXP) break;
        lvl++;
    }
    return lvl;
}

function getXPToNextLevel(totalXP) {
    const currentLevel = getLevelFromXP(totalXP);
    const xpForNextLevel = getXPForLevel(currentLevel + 1);
    return xpForNextLevel - totalXP;
}

function getXPInCurrentLevel(totalXP) {
    const currentLevel = getLevelFromXP(totalXP);
    return totalXP - getXPForLevel(currentLevel);
}

// Authentication State
var currentUser = null;

function clearPendingProfileSyncTimeout() {
    if (!pendingProfileSyncTimeout) return;
    clearTimeout(pendingProfileSyncTimeout);
    pendingProfileSyncTimeout = null;
}

function clearPendingAuthStateClearTimeout() {
    if (!pendingAuthStateClearTimeout) return;
    clearTimeout(pendingAuthStateClearTimeout);
    pendingAuthStateClearTimeout = null;
}

function clearCloudProfileReloadTimeouts() {
    cloudProfileReloadTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    cloudProfileReloadTimeouts = [];
}

function setLoadCloudStatsButtonState(isLoading) {
    const loadBtn = document.getElementById("load-cloud-stats-btn");
    if (!loadBtn) return;
    if (!loadBtn.dataset.defaultText) {
        loadBtn.dataset.defaultText = loadBtn.textContent;
    }
    loadBtn.disabled = isLoading;
    loadBtn.textContent = isLoading ? "Loading..." : loadBtn.dataset.defaultText;
}

async function loadCloudStats(options = {}) {
    const { manual = false, showSuccessToast = false } = options;
    if (!currentUser) {
        if (manual) {
            showNotification("Please login first.", "error");
        }
        return false;
    }

    if (manual) {
        setLoadCloudStatsButtonState(true);
    }

    try {
        const loadedProfile = await loadUserProfile({ rethrowErrors: manual });
        if (manual && showSuccessToast && loadedProfile) {
            showNotification("Cloud stats loaded.", "success");
        }
        return Boolean(loadedProfile);
    } catch (error) {
        console.warn("Manual cloud stats reload failed:", error);
        if (manual) {
            showNotification("Couldn't load cloud stats right now. Try again.", "error");
        }
        return false;
    } finally {
        if (manual) {
            setLoadCloudStatsButtonState(false);
        }
    }
}

function scheduleCloudProfileReloads() {
    clearCloudProfileReloadTimeouts();
    if (!currentUser) return;

    CLOUD_PROFILE_RELOAD_DELAYS_MS.forEach(delayMs => {
        const timeoutId = setTimeout(() => {
            if (!currentUser) return;
            loadCloudStats().catch(error => console.warn("Auto cloud stats reload failed:", error));
        }, delayMs);
        cloudProfileReloadTimeouts.push(timeoutId);
    });
}

// Set up auth state listener
function setupAuthStateListener() {
    if (!auth) {
        console.warn('Auth not yet initialized, retrying...');
        setTimeout(setupAuthStateListener, 100);
        return;
    }

    // Listen for auth state changes
    auth.onAuthStateChanged(user => {
        const previousUid = currentUser?.uid || null;
        clearPendingAuthStateClearTimeout();
        currentUser = user;
        window.currentUser = user;
        clearPendingProfileSyncTimeout();
        clearCloudProfileReloadTimeouts();
        if (!user || previousUid !== user.uid) {
            lastServerHydratedProfileUid = null;
        }
        if (previousUid && user && user.uid !== previousUid) {
            clearCachedProfileState();
        } else if (!user) {
            // During reload, auth can briefly emit null before the persisted session user.
            // Delay clearing local stats so we don't wipe login streak keys during that race.
            pendingAuthStateClearTimeout = setTimeout(() => {
                pendingAuthStateClearTimeout = null;
                if (!currentUser) {
                    clearCachedProfileState();
                }
            }, 1500);
        }
        unsubscribeFriendNetworkListener();
        if (user && db) {
            setupFriendNetworkListener();
        }
        // Ensure DOM is ready before updating UI
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => updateAuthUI());
        } else {
            updateAuthUI();
        }
    });
    
    // Set up profile sync after auth is set up
    setupProfileSync();
}

function setupFriendNetworkListener() {
    if (!db || !currentUser) return;
    const ref = db.collection(FRIENDS_COLLECTION).doc(currentUser.uid);
    friendDocumentUnsubscribe = ref.onSnapshot(doc => {
        const data = doc.exists ? (doc.data() || {}) : {};
        activeDuelsCache = normalizeDuelsList(data.duels);
        reconcileCompletedDuelStats(activeDuelsCache);
        if (document.getElementById('profileModal')?.classList.contains('hidden') === false && document.getElementById('friends-tab')?.style.display !== 'none') {
            populateFriendsTab();
        }
        if (currentOpenDuelId) {
            const duel = activeDuelsCache.find(entry => entry.id === currentOpenDuelId);
            if (duel) {
                renderFriendDuelModal(duel);
            }
        }
        if (window.loadAndDisplayAchievements) {
            window.loadAndDisplayAchievements();
        }
    }, error => {
        console.warn('Friend network listener failed:', error);
    });
}

function unsubscribeFriendNetworkListener() {
    if (friendDocumentUnsubscribe) {
        friendDocumentUnsubscribe();
        friendDocumentUnsubscribe = null;
    }
}

function unsubscribeFriendDuelListener() {
    activeDuelsCache = [];
}

// Cross-subdomain profile sync
var profileSyncInterval = null;

function setupProfileSync() {
    // Stop previous sync if it exists
    if (profileSyncInterval) {
        clearInterval(profileSyncInterval);
    }

    // Sync profile from Firebase every 45 seconds to keep data fresh across subdomains
    profileSyncInterval = setInterval(() => {
        if (currentUser && document.visibilityState === 'visible') {
            loadUserProfile().catch(err => console.log("Background sync skipped:", err));
            updatePresenceHeartbeat();
        }
    }, 45000);

    // Refresh profile immediately when page becomes visible (user switches back to tab/window)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && currentUser) {
            loadUserProfile().catch(err => console.log("Visibility sync skipped:", err));
            updatePresenceHeartbeat();
        }
    });

    window.addEventListener('focus', () => {
        if (currentUser) {
            updatePresenceHeartbeat();
        }
    });
}

async function updateAuthUI() {
    const authContainer = document.getElementById("auth-container");
    const loginWarning = document.getElementById("login-warning");
    const loginBtn = document.getElementById("login-btn");

    if (currentUser) {
        // User is logged in
        if (loginWarning) loginWarning.classList.add("hidden");
        if (loginBtn) loginBtn.style.display = "none";
        updatePresenceHeartbeat();

        // Load user profile - need to await so redeemed codes and login streak load first
        await loadUserProfile();
        scheduleCloudProfileReloads();
        // Initialize daily login first so streak/login fields are updated before any broad stats sync.
        await initializeDailyLogin();
        await ensureLoginStreakRewards();
        updateSpinWheelUI();
        const legacyProfileBtn = document.getElementById("profile-btn-nav");
        if (legacyProfileBtn) legacyProfileBtn.remove();
        // Sync local stats to Firebase after daily login initialization to avoid stale login-field overwrites.
        syncStatsToFirebase();
    } else {
        // User is logged out
        if (loginWarning) loginWarning.classList.remove("hidden");
        if (loginBtn) loginBtn.style.display = "block";
        clearPendingProfileSyncTimeout();
        clearCloudProfileReloadTimeouts();
        
        const profileBtn = document.getElementById("profile-btn-nav");
        if (profileBtn) {
            profileBtn.remove();
        }
        closeAdminAbuseModal();
        // DO NOT clear userProfile
    }
    

    // Always update index stats from localStorage
    if (authContainer) {
        updateIndexStats();
    }
    ensureAdminAbuseVisibility();
    renderCratesButton();
    ensureXpEventBannerTimer();
    ensureCommunityBossUiTimer();
    renderCommunityBossPanel();
    if (typeof renderConsumablesPage === "function") {
        renderConsumablesPage();
    }
    if (typeof ensureConsumablesPageTimer === "function") {
        ensureConsumablesPageTimer();
    }

    // Always refresh friends tab when profile is open and friends view is active
    const profileModal = document.getElementById('profileModal');
    const friendsTab = document.getElementById('friends-tab');
    if (profileModal && !profileModal.classList.contains('hidden') && friendsTab && friendsTab.style.display !== 'none') {
        populateFriendsTab();
    }

    if (window.loadAndDisplayAchievements) {
        window.loadAndDisplayAchievements();
    }

    // Update daily bonus message
    const bonusMsg = document.getElementById("daily-bonus-msg");
    if (bonusMsg) {
        if (currentUser) {
            const currentLoginDay = parseInt(localStorage.getItem("currentLoginDay")) || 1;
            const streak = parseInt(localStorage.getItem("loginStreak")) || 1;
            bonusMsg.style.display = "block";
            bonusMsg.style.cursor = "pointer";
            bonusMsg.onclick = () => openDailyLoginModal();
            const cycleNumber = Math.floor((currentLoginDay - 1) / 7) + 1;
            const cycleEndDay = cycleNumber * 7;
            bonusMsg.innerHTML = `🔥 Login Streak: <strong>${streak} days</strong> - Day ${currentLoginDay}/${cycleEndDay} (Click to view rewards)`;
        } else {
            bonusMsg.style.display = "none";
        }
    } else {
    }

    updateSpinWheelUI();

    // Update streak display
    const existingStreak = document.getElementById("streak-display");
    if (existingStreak) {
        existingStreak.remove();
    }
    if (currentUser) {
        const streak = parseInt(localStorage.getItem("loginStreak")) || 1;
        if (streak > 0) {
            const streakDisplay = document.createElement("div");
            streakDisplay.id = "streak-display";
            streakDisplay.style.cssText = `
                text-align: center;
                padding: 15px 20px;
                color: #4dd0e1;
                font-weight: 600;
                font-size: 16px;
                margin-top: 10px;
                border-radius: 8px;
                border: 2px solid #ff6b6b;
                background: rgba(255, 107, 107, 0.05);
            `;
            streakDisplay.innerHTML = `🔥 <span style="color: #ff6b6b;">${streak} days</span> on fire!`;
            const statsSection = document.querySelector(".stats");
            if (statsSection) {
                statsSection.parentElement.insertBefore(streakDisplay, statsSection);
            }
        }
    }
}

function isDefaultEmailUsername(username) {
    if (!currentUser?.email || !username) return false;
    return username === currentUser.email.split("@")[0];
}

function hasMeaningfulProfileData(profile) {
    if (!profile || typeof profile !== 'object') return false;
    const crateInventory = normalizeCrateInventory(profile.crateInventory);
    const hasAnyCrates = Object.values(crateInventory).some(count => count > 0);
    const hasUnlockedBadges = Array.isArray(profile.unlockedBadges) && profile.unlockedBadges.some(id => id && id !== "starter");
    const hasUnlockedThemes = Array.isArray(profile.unlockedCardThemes) && profile.unlockedCardThemes.some(id => id && id !== "default");
    const hasSharkPassMissionClaims = Boolean(profile.sharkPassMissionClaims && Object.keys(profile.sharkPassMissionClaims).length);
    const hasSharkPassSeasonBaselines = Boolean(profile.sharkPassSeasonBaselines && Object.keys(profile.sharkPassSeasonBaselines).length);
    const hasCommunityBossRewards = Boolean(profile.communityBossRewards && Object.keys(profile.communityBossRewards).length);
    return Boolean(
        profile.totalXP ||
        profile.gamesPlayed ||
        profile.wins ||
        profile.losses ||
        profile.totalGuesses ||
        profile.duelGames ||
        profile.duelWins ||
        profile.loginStreak ||
        profile.currentLoginDay ||
        normalizeStoredDateValue(profile.lastLoginDate) ||
        hasAnyCrates ||
        profile.cratesOpened ||
        getCratesSinceLegendary(profile) ||
        getStreakShieldCount(profile) ||
        getPearlCount(profile) ||
        getPearlBoostExpiresAt(profile) ||
        getCrateInstantOpenEnabled(profile) ||
        Object.keys(getSeasonXpBoosts(profile)).length ||
        (Array.isArray(profile.earnedCosmetics) && profile.earnedCosmetics.length) ||
        hasUnlockedBadges ||
        hasUnlockedThemes ||
        (Array.isArray(profile.unlockedTitles) && profile.unlockedTitles.length) ||
        (Array.isArray(profile.unlockedAchievements) && profile.unlockedAchievements.length) ||
        (Array.isArray(profile.claimedAchievements) && profile.claimedAchievements.length) ||
        (Array.isArray(profile.redeemedCodes) && profile.redeemedCodes.length) ||
        hasSharkPassMissionClaims ||
        hasSharkPassSeasonBaselines ||
        (Array.isArray(profile.sharkPassLevelRewardClaims) && profile.sharkPassLevelRewardClaims.length) ||
        hasCommunityBossRewards ||
        (profile.equippedTitle && profile.equippedTitle !== "") ||
        (profile.username && !isDefaultEmailUsername(profile.username)) ||
        (profile.profilePicture && profile.profilePicture !== "images/pfp/shark1.png")
    );
}

function hasPersistedProfileIdentity(profile) {
    if (!profile || typeof profile !== 'object') return false;
    const crateInventory = normalizeCrateInventory(profile.crateInventory);
    const hasAnyCrates = Object.values(crateInventory).some(count => count > 0);
    return Boolean(
        (profile.username && !isDefaultEmailUsername(profile.username)) ||
        (profile.profilePicture && profile.profilePicture !== "images/pfp/shark1.png") ||
        (profile.profilePic && profile.profilePic !== "images/pfp/shark1.png") ||
        (profile.equippedBadge && profile.equippedBadge !== "starter") ||
        (profile.equippedCardTheme && profile.equippedCardTheme !== "default") ||
        hasAnyCrates ||
        profile.cratesOpened ||
        getCratesSinceLegendary(profile) ||
        getStreakShieldCount(profile) ||
        getPearlCount(profile) ||
        getPearlBoostExpiresAt(profile) ||
        getCrateInstantOpenEnabled(profile) ||
        Object.keys(getSeasonXpBoosts(profile)).length ||
        (profile.equippedTitle && profile.equippedTitle !== "") ||
        (Array.isArray(profile.earnedCosmetics) && profile.earnedCosmetics.length) ||
        (Array.isArray(profile.unlockedTitles) && profile.unlockedTitles.length) ||
        (Array.isArray(profile.unlockedBadges) && profile.unlockedBadges.some(id => id && id !== "starter")) ||
        (Array.isArray(profile.unlockedCardThemes) && profile.unlockedCardThemes.some(id => id && id !== "default")) ||
        (Array.isArray(profile.unlockedAchievements) && profile.unlockedAchievements.length) ||
        (Array.isArray(profile.claimedAchievements) && profile.claimedAchievements.length) ||
        (Array.isArray(profile.redeemedCodes) && profile.redeemedCodes.length) ||
        Boolean(profile.sharkPassMissionClaims && Object.keys(profile.sharkPassMissionClaims).length) ||
        Boolean(profile.sharkPassSeasonBaselines && Object.keys(profile.sharkPassSeasonBaselines).length) ||
        (Array.isArray(profile.sharkPassLevelRewardClaims) && profile.sharkPassLevelRewardClaims.length) ||
        Boolean(profile.communityBossRewards && Object.keys(profile.communityBossRewards).length)
    );
}

function hasRecoverableRemoteProfile(profile) {
    return hasMeaningfulProfileData(profile) || hasPersistedProfileIdentity(profile);
}

function maxNumeric(a, b) {
    return Math.max(Number(a) || 0, Number(b) || 0);
}

function getPreferredUsernameStorageKey() {
    if (!currentUser?.uid) return null;
    return `preferredUsername_${currentUser.uid}`;
}

function getScopedUserProfileStorageKey(uid = null) {
    const effectiveUid = uid || currentUser?.uid;
    return effectiveUid ? `userProfile_${effectiveUid}` : null;
}

function getScopedUserProfileBackupKey(uid = null) {
    const effectiveUid = uid || currentUser?.uid;
    return effectiveUid ? `userProfileBackup_${effectiveUid}` : null;
}

function getDailyLoginModalShownStorageKey(uid = null) {
    const effectiveUid = uid || currentUser?.uid;
    return effectiveUid ? `dailyLoginModalShownToday_${effectiveUid}` : "dailyLoginModalShownToday";
}

function getStoredDailyLoginModalShownDate(uid = null) {
    return localStorage.getItem(getDailyLoginModalShownStorageKey(uid)) || "";
}

function normalizeLoginProgress(source = {}) {
    const normalized = {
        loginStreak: Math.max(0, Math.floor(Number(source.loginStreak) || 0)),
        currentLoginDay: Math.max(0, Math.floor(Number(source.currentLoginDay) || 0)),
        lastLoginDate: normalizeStoredDateValue(source.lastLoginDate),
        dailyLoginModalShownToday: normalizeStoredDateValue(source.dailyLoginModalShownToday)
    };
    return normalized;
}

function getLoginProgressFromLocalStorage(uid = null) {
    return normalizeLoginProgress({
        loginStreak: localStorage.getItem("loginStreak"),
        currentLoginDay: localStorage.getItem("currentLoginDay"),
        lastLoginDate: localStorage.getItem("lastLoginDate"),
        dailyLoginModalShownToday: getStoredDailyLoginModalShownDate(uid)
    });
}

function mergeLoginProgress(localProgress = {}, remoteProgress = {}) {
    const local = normalizeLoginProgress(localProgress);
    const remote = normalizeLoginProgress(remoteProgress);
    const localDate = local.lastLoginDate;
    const remoteDate = remote.lastLoginDate;
    let preferred = null;

    if (localDate && remoteDate) {
        const dateDiff = getCalendarDayDifference(localDate, remoteDate);
        if (Number.isFinite(dateDiff) && dateDiff > 0) preferred = remote;
        if (Number.isFinite(dateDiff) && dateDiff < 0) preferred = local;
    } else if (localDate) {
        preferred = local;
    } else if (remoteDate) {
        preferred = remote;
    }

    const latestLoginDate = preferred?.lastLoginDate || [localDate, remoteDate].filter(Boolean).sort().pop() || "";
    const latestModalShownDate = [local.dailyLoginModalShownToday, remote.dailyLoginModalShownToday]
        .filter(Boolean)
        .sort()
        .pop() || "";
    const fallbackProgress = preferred === local ? remote : local;

    return {
        loginStreak: preferred ? (preferred.loginStreak || fallbackProgress.loginStreak || 0) : Math.max(local.loginStreak, remote.loginStreak),
        currentLoginDay: preferred ? (preferred.currentLoginDay || fallbackProgress.currentLoginDay || 0) : Math.max(local.currentLoginDay, remote.currentLoginDay),
        lastLoginDate: latestLoginDate,
        dailyLoginModalShownToday: latestModalShownDate
    };
}

function storeLoginProgressLocally(progress = {}, uid = null) {
    const normalized = normalizeLoginProgress(progress);
    if (normalized.loginStreak > 0) {
        localStorage.setItem("loginStreak", String(normalized.loginStreak));
    }
    if (normalized.currentLoginDay > 0) {
        localStorage.setItem("currentLoginDay", String(normalized.currentLoginDay));
    }
    if (normalized.lastLoginDate) {
        localStorage.setItem("lastLoginDate", normalized.lastLoginDate);
    }
    const modalStorageKey = getDailyLoginModalShownStorageKey(uid);
    if (normalized.dailyLoginModalShownToday) {
        localStorage.setItem(modalStorageKey, normalized.dailyLoginModalShownToday);
    }
    return normalized;
}

function buildLoginProgressSyncPayload(progress = {}) {
    const normalized = normalizeLoginProgress(progress);
    return {
        loginStreak: normalized.loginStreak,
        currentLoginDay: normalized.currentLoginDay,
        lastLoginDate: normalized.lastLoginDate,
        dailyLoginModalShownToday: normalized.dailyLoginModalShownToday
    };
}

function loginProgressDiffers(remoteData = {}, mergedProgress = {}) {
    const remote = normalizeLoginProgress(remoteData);
    const merged = normalizeLoginProgress(mergedProgress);
    return remote.loginStreak !== merged.loginStreak
        || remote.currentLoginDay !== merged.currentLoginDay
        || remote.lastLoginDate !== merged.lastLoginDate
        || remote.dailyLoginModalShownToday !== merged.dailyLoginModalShownToday;
}

function getLocalDateKey(dateValue = new Date()) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseDateLikeValue(rawValue) {
    if (rawValue === null || rawValue === undefined || rawValue === "") return null;

    if (rawValue instanceof Date) {
        return Number.isNaN(rawValue.getTime()) ? null : rawValue;
    }

    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
        const numericDate = new Date(rawValue);
        return Number.isNaN(numericDate.getTime()) ? null : numericDate;
    }

    if (typeof rawValue === "object") {
        if (typeof rawValue.toDate === "function") {
            const timestampDate = rawValue.toDate();
            return timestampDate instanceof Date && !Number.isNaN(timestampDate.getTime()) ? timestampDate : null;
        }
        if (typeof rawValue.seconds === "number") {
            const millis = rawValue.seconds * 1000 + Math.floor((rawValue.nanoseconds || 0) / 1000000);
            const timestampDate = new Date(millis);
            return Number.isNaN(timestampDate.getTime()) ? null : timestampDate;
        }
        if (typeof rawValue._seconds === "number") {
            const millis = rawValue._seconds * 1000 + Math.floor((rawValue._nanoseconds || 0) / 1000000);
            const timestampDate = new Date(millis);
            return Number.isNaN(timestampDate.getTime()) ? null : timestampDate;
        }
        const objectString = typeof rawValue.toString === "function" ? rawValue.toString() : "";
        if (!objectString || objectString === "[object Object]") return null;
        return parseDateLikeValue(objectString);
    }

    if (typeof rawValue !== "string") return null;
    const value = rawValue.trim();
    if (!value || value === "[object Object]" || value.toLowerCase() === "invalid date") return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split("-").map(Number);
        return new Date(year, month - 1, day);
    }

    if (/^\d+$/.test(value)) {
        let asNumber = Number(value);
        // Treat 10-digit unix timestamps as seconds.
        if (value.length <= 10) {
            asNumber *= 1000;
        }
        if (Number.isFinite(asNumber)) {
            const numericDate = new Date(asNumber);
            if (!Number.isNaN(numericDate.getTime())) {
                return numericDate;
            }
        }
    }

    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function normalizeStoredDateValue(rawValue) {
    const parsedDate = parseDateLikeValue(rawValue);
    return parsedDate ? getLocalDateKey(parsedDate) : "";
}

function normalizeStoredUtcDateValue(rawValue) {
    if (typeof rawValue === "string") {
        const value = rawValue.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return value;
        }
    }
    const parsedDate = parseDateLikeValue(rawValue);
    if (!parsedDate) return "";
    const year = parsedDate.getUTCFullYear();
    const month = String(parsedDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(parsedDate.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getCalendarDayDifference(fromDateKey, toDateKey) {
    if (!fromDateKey || !toDateKey) return NaN;
    const fromDate = parseDateLikeValue(fromDateKey);
    const toDate = parseDateLikeValue(toDateKey);
    if (!fromDate || !toDate) return NaN;
    const fromUtc = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    const toUtc = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
    return Math.round((toUtc - fromUtc) / 86400000);
}

function getLocalMonthKey(dateValue = new Date()) {
    const normalizedDate = normalizeStoredDateValue(dateValue);
    return normalizedDate ? normalizedDate.slice(0, 7) : "";
}

function getUtcDateKey(dateValue = new Date()) {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getUtcMonthKey(dateValue = new Date()) {
    const utcDateKey = getUtcDateKey(dateValue);
    return utcDateKey ? utcDateKey.slice(0, 7) : "";
}

function normalizeStoredMonthValue(rawValue) {
    if (typeof rawValue === "string" && /^\d{4}-\d{2}$/.test(rawValue.trim())) {
        return rawValue.trim();
    }
    const normalizedDate = normalizeStoredDateValue(rawValue);
    return normalizedDate ? normalizedDate.slice(0, 7) : "";
}

function normalizeStoredUtcMonthValue(rawValue) {
    if (typeof rawValue === "string") {
        const value = rawValue.trim();
        if (/^\d{4}-\d{2}$/.test(value)) return value;
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(0, 7);
    }
    const normalizedDate = normalizeStoredUtcDateValue(rawValue);
    return normalizedDate ? normalizedDate.slice(0, 7) : "";
}

function incrementProfilePeriodWins(profileData, nowValue = new Date()) {
    if (!profileData || typeof profileData !== "object") return profileData;
    const todayKey = getUtcDateKey(nowValue);
    const monthKey = getUtcMonthKey(nowValue);
    const existingDailyKey = normalizeStoredUtcDateValue(profileData.dailyWinsUtcDate || profileData.dailyWinsDate);
    const existingMonthlyKey = normalizeStoredUtcMonthValue(profileData.monthlyWinsUtcKey || profileData.monthlyWinsKey);
    const dailyBase = existingDailyKey === todayKey ? (Number(profileData.dailyWins) || 0) : 0;
    const monthlyBase = existingMonthlyKey === monthKey ? (Number(profileData.monthlyWins) || 0) : 0;

    profileData.dailyWins = dailyBase + 1;
    profileData.dailyWinsDate = todayKey;
    profileData.dailyWinsUtcDate = todayKey;
    profileData.monthlyWins = monthlyBase + 1;
    profileData.monthlyWinsKey = monthKey;
    profileData.monthlyWinsUtcKey = monthKey;
    profileData.winPeriodVersion = 2;
    return profileData;
}

async function getUserStatsSnapshot(statsRef) {
    try {
        const snapshot = await statsRef.get({ source: "server" });
        return { snapshot, fromServer: true };
    } catch (error) {
        console.warn("Falling back to cached userStats snapshot:", error);
        const snapshot = await statsRef.get();
        return { snapshot, fromServer: false };
    }
}

function getStoredPreferredUsername() {
    const key = getPreferredUsernameStorageKey();
    if (!key) return "";
    return localStorage.getItem(key) || "";
}

function cachePreferredUsername(username, uidOverride = null) {
    const effectiveUid = uidOverride || currentUser?.uid;
    if (!effectiveUid || !username) return;
    if (currentUser?.email && username === currentUser.email.split("@")[0]) return;
    localStorage.setItem(`preferredUsername_${effectiveUid}`, username);
}

function scheduleRemoteProfileSync(delayMs = 150) {
    if (typeof firebase === "undefined" || typeof firebase.auth !== "function") return;
    const authUser = firebase.auth().currentUser;
    if (!authUser || !db || typeof syncStatsToFirebase !== "function") return;
    if (currentUser && currentUser.uid !== authUser.uid) return;
    if (pendingProfileSyncTimeout) {
        clearTimeout(pendingProfileSyncTimeout);
    }
    pendingProfileSyncTimeout = setTimeout(() => {
        pendingProfileSyncTimeout = null;
        syncStatsToFirebase().catch(error => console.warn("Deferred profile sync failed:", error));
    }, delayMs);
}

function saveUserProfileLocally(profileData, options = {}) {
    if (!profileData || typeof profileData !== "object") return;
    if (options.preserveLastUpdated) {
        if (!profileData.lastUpdated) profileData.lastUpdated = Date.now();
    } else {
        profileData.lastUpdated = Date.now();
    }
    if (profileData.profilePicture && !profileData.profilePic) {
        profileData.profilePic = profileData.profilePicture;
    }
    if (profileData.profilePic && !profileData.profilePicture) {
        profileData.profilePicture = profileData.profilePic;
    }
    if (profileData.username) {
        cachePreferredUsername(profileData.username, profileData.uid);
    }
    profileData.crateInventory = normalizeCrateInventory(profileData.crateInventory);
    profileData.cratesOpened = Math.max(0, Number(profileData.cratesOpened) || 0);
    profileData.cratesSinceLegendary = getCratesSinceLegendary(profileData);
    profileData.streakShields = getStreakShieldCount(profileData);
    profileData.instantCrateOpen = getCrateInstantOpenEnabled(profileData);
    profileData.pearlBoostExpiresAt = getPearlBoostExpiresAt(profileData);
    profileData.seasonXpBoosts = getSeasonXpBoosts(profileData);
    setPearlCount(profileData, getPearlCount(profileData));
    if (!Array.isArray(profileData.earnedCosmetics)) profileData.earnedCosmetics = [];
    if (!Array.isArray(profileData.unlockedBadges)) profileData.unlockedBadges = ["starter"];
    if (!Array.isArray(profileData.unlockedCardThemes)) profileData.unlockedCardThemes = ["default"];
    if (!Array.isArray(profileData.unlockedTitles)) profileData.unlockedTitles = [];
    if (!Array.isArray(profileData.claimedAchievements)) profileData.claimedAchievements = [];
    if (!Array.isArray(profileData.unlockedAchievements)) profileData.unlockedAchievements = [];
    if (!Array.isArray(profileData.sharkPassLevelRewardClaims)) profileData.sharkPassLevelRewardClaims = [];
    if (!Array.isArray(profileData.redeemedCodes)) profileData.redeemedCodes = getRedeemedCodes();
    if (!profileData.communityBossRewards || typeof profileData.communityBossRewards !== "object") {
        profileData.communityBossRewards = {};
    }
    if (!profileData.sharkPassMissionClaims || typeof profileData.sharkPassMissionClaims !== "object") {
        profileData.sharkPassMissionClaims = {};
    }
    if (!profileData.sharkPassSeasonBaselines || typeof profileData.sharkPassSeasonBaselines !== "object") {
        profileData.sharkPassSeasonBaselines = {};
    }
    const scopedKey = getScopedUserProfileStorageKey(profileData.uid);
    const scopedBackupKey = getScopedUserProfileBackupKey(profileData.uid);
    localStorage.setItem("userProfile", JSON.stringify(profileData));
    localStorage.setItem("userProfileBackup", JSON.stringify(profileData));
    if (scopedKey) {
        localStorage.setItem(scopedKey, JSON.stringify(profileData));
    }
    if (scopedBackupKey) {
        localStorage.setItem(scopedBackupKey, JSON.stringify(profileData));
    }
    localStorage.setItem("games", String(profileData.gamesPlayed || 0));
    localStorage.setItem("wins", String(profileData.wins || 0));
    localStorage.setItem("losses", String(profileData.losses || 0));
    if (profileData.totalXP !== undefined) {
        localStorage.setItem("totalXP", String(profileData.totalXP || 0));
    }
    if (profileData.loginStreak !== undefined) {
        localStorage.setItem("loginStreak", String(profileData.loginStreak || 0));
    }
    if (profileData.currentLoginDay !== undefined) {
        localStorage.setItem("currentLoginDay", String(profileData.currentLoginDay || 0));
    }
    if (profileData.lastLoginDate) {
        localStorage.setItem("lastLoginDate", normalizeStoredDateValue(profileData.lastLoginDate) || profileData.lastLoginDate);
    }
    if (profileData.dailyLoginModalShownToday) {
        localStorage.setItem(
            getDailyLoginModalShownStorageKey(profileData.uid),
            normalizeStoredDateValue(profileData.dailyLoginModalShownToday) || profileData.dailyLoginModalShownToday
        );
    }
    localStorage.setItem("claimedAchievements", JSON.stringify(profileData.claimedAchievements));
    localStorage.setItem("unlockedAchievements", JSON.stringify(profileData.unlockedAchievements));
    localStorage.setItem("redeemedCodes", JSON.stringify(profileData.redeemedCodes));
    if (!options.skipRemoteSync) {
        scheduleRemoteProfileSync();
    }
}

function showCrateOverlayDuplicateReward(reward, xpAward, crateId = activeCrateUnboxId) {
    const copy = document.getElementById("crate-unbox-copy");
    const reveal = document.getElementById("crate-overlay-reveal");
    const isSummer = crateId === "summer";
    applyCrateUnboxOpeningState(reward);
    if (copy) {
        copy.textContent = isSummer
            ? getCrateUnboxCopy(crateId, "duplicate", reward.name)
            : `${reward.name} was a duplicate and converted into XP.`;
    }
    if (reveal) {
        reveal.classList.remove("hidden");
        if (isSummer) reveal.classList.add("crate-reveal-summer");
        reveal.innerHTML = `
            <div class="crate-reveal-card crate-reveal-card-${reward.rarity}${isSummer ? " crate-reveal-card-summer" : ""}">
                ${getCrateRewardPreviewMarkup(reward)}
                <div class="crate-reveal-copy">
                    <span class="crate-rarity ${reward.rarity}">${reward.rarity}</span>
                    <h4>${reward.name}</h4>
                    <p>Duplicate reward salvaged for ${xpAward.totalXp} XP.</p>
                </div>
            </div>
        `;
    }
}

window.saveUserProfileLocally = saveUserProfileLocally;

function clearCachedProfileState() {
    clearPendingProfileSyncTimeout();
    lastServerHydratedProfileUid = null;
    localStorage.removeItem("userProfile");
    localStorage.removeItem("userProfileBackup");
    localStorage.removeItem("lastViewedStats");
    localStorage.removeItem("games");
    localStorage.removeItem("wins");
    localStorage.removeItem("losses");
    localStorage.removeItem("totalXP");
    localStorage.removeItem("lastLoginDate");
    localStorage.removeItem("loginStreak");
    localStorage.removeItem("currentLoginDay");
}

function getBestLocalProfile() {
    const scopedPrimaryKey = getScopedUserProfileStorageKey();
    const scopedBackupKey = getScopedUserProfileBackupKey();
    const parseStoredProfile = raw => {
        try {
            const parsed = JSON.parse(raw || "{}");
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
            return {};
        }
    };
    const chooseBestCandidate = (primary, backup) => {
        if (hasMeaningfulProfileData(primary)) return primary;
        if (hasMeaningfulProfileData(backup)) return backup;
        if (hasPersistedProfileIdentity(primary)) return primary;
        if (hasPersistedProfileIdentity(backup)) return backup;
        return {};
    };

    const scopedPrimary = parseStoredProfile(scopedPrimaryKey ? localStorage.getItem(scopedPrimaryKey) : "{}");
    const scopedBackup = parseStoredProfile(scopedBackupKey ? localStorage.getItem(scopedBackupKey) : "{}");
    const genericPrimary = parseStoredProfile(localStorage.getItem("userProfile"));
    const genericBackup = parseStoredProfile(localStorage.getItem("userProfileBackup"));

    if (currentUser) {
        let selectedProfile = chooseBestCandidate(scopedPrimary, scopedBackup);
        if (!Object.keys(selectedProfile).length) {
            const genericMatchesCurrentUser =
                genericPrimary?.uid === currentUser.uid || genericBackup?.uid === currentUser.uid;
            if (genericMatchesCurrentUser) {
                selectedProfile = chooseBestCandidate(genericPrimary, genericBackup);
            }
        }
        if (selectedProfile?.uid && selectedProfile.uid !== currentUser.uid) {
            return {};
        }
        return selectedProfile;
    }

    return chooseBestCandidate(genericPrimary, genericBackup);
}

function mergeProfilesSafely(localProfile, firebaseData) {
    const cachedPreferredUsername = getStoredPreferredUsername();
    const fallbackUsername = cachedPreferredUsername || localProfile.username || firebaseData.username || currentUser.email.split("@")[0];
    const preferredUsername = cachedPreferredUsername
        ? cachedPreferredUsername
        : firebaseData.username && !isDefaultEmailUsername(firebaseData.username)
        ? firebaseData.username
        : localProfile.username && !isDefaultEmailUsername(localProfile.username)
            ? localProfile.username
            : fallbackUsername;
    const localUpdatedMs = getProfileTimestampMs(localProfile.lastUpdated);
    const firebaseUpdatedMs = getProfileTimestampMs(firebaseData.lastUpdated);
    const preferredCrateInventory = mergeCrateInventory(localProfile.crateInventory, firebaseData.crateInventory);
    const preferredCratesOpened = maxNumeric(localProfile.cratesOpened, firebaseData.cratesOpened);
    const preferredPearls = maxNumeric(localProfile.pearls ?? localProfile.tidePearls, firebaseData.pearls ?? firebaseData.tidePearls);
    const preferredCratesSinceLegendary = localUpdatedMs >= firebaseUpdatedMs
        ? getCratesSinceLegendary(localProfile)
        : getCratesSinceLegendary(firebaseData);
    const preferredInstantCrateOpen = localUpdatedMs >= firebaseUpdatedMs
        ? getCrateInstantOpenEnabled(localProfile)
        : getCrateInstantOpenEnabled(firebaseData);
    const preferredPearlBoostExpiresAt = maxNumeric(localProfile.pearlBoostExpiresAt, firebaseData.pearlBoostExpiresAt);
    const preferredSeasonXpBoosts = {
        ...(localProfile.seasonXpBoosts && typeof localProfile.seasonXpBoosts === "object" ? localProfile.seasonXpBoosts : {}),
        ...(firebaseData.seasonXpBoosts && typeof firebaseData.seasonXpBoosts === "object" ? firebaseData.seasonXpBoosts : {})
    };
    const preferredStreakShields = localUpdatedMs >= firebaseUpdatedMs
        ? getStreakShieldCount(localProfile)
        : getStreakShieldCount(firebaseData);
    const preferLocalProfileFields = localUpdatedMs > firebaseUpdatedMs;
    const localProfilePic = localProfile.profilePicture || localProfile.profilePic;
    const remoteProfilePic = firebaseData.profilePicture || firebaseData.profilePic;
    const preferredProfilePic = preferLocalProfileFields
        ? (localProfilePic || remoteProfilePic || "images/pfp/shark1.png")
        : (remoteProfilePic || localProfilePic || "images/pfp/shark1.png");
    const preferredAvatar = preferLocalProfileFields
        ? (localProfile.avatar || firebaseData.avatar || "🦈")
        : (firebaseData.avatar || localProfile.avatar || "🦈");
    const preferredEquippedBadge = preferLocalProfileFields
        ? (localProfile.equippedBadge || firebaseData.equippedBadge || "starter")
        : (firebaseData.equippedBadge || localProfile.equippedBadge || "starter");
    const preferredEquippedCardTheme = preferLocalProfileFields
        ? (localProfile.equippedCardTheme || firebaseData.equippedCardTheme || "default")
        : (firebaseData.equippedCardTheme || localProfile.equippedCardTheme || "default");
    const preferredEquippedTitle = preferLocalProfileFields
        ? (localProfile.equippedTitle || firebaseData.equippedTitle || "")
        : (firebaseData.equippedTitle || localProfile.equippedTitle || "");
    const mergedLoginProgress = mergeLoginProgress(getLoginProgressFromLocalStorage(currentUser?.uid), firebaseData);
    const mergedClaimedAchievements = getMergedUniqueIds(localProfile.claimedAchievements, firebaseData.claimedAchievements);
    const mergedUnlockedAchievements = getMergedUniqueIds(localProfile.unlockedAchievements, firebaseData.unlockedAchievements);
    const mergedRedeemedCodes = getMergedUniqueIds(localProfile.redeemedCodes, firebaseData.redeemedCodes, getRedeemedCodes());

    const localDailyWinsDate = normalizeStoredUtcDateValue(localProfile.dailyWinsUtcDate || localProfile.dailyWinsDate);
    const remoteDailyWinsDate = normalizeStoredUtcDateValue(firebaseData.dailyWinsUtcDate || firebaseData.dailyWinsDate);
    const localDailyWins = Number(localProfile.dailyWins) || 0;
    const remoteDailyWins = Number(firebaseData.dailyWins) || 0;
    const mergedDailyWinsDate = remoteDailyWinsDate || localDailyWinsDate || "";
    const mergedDailyWins = mergedDailyWinsDate
        ? Math.max(
            remoteDailyWinsDate === mergedDailyWinsDate ? remoteDailyWins : 0,
            localDailyWinsDate === mergedDailyWinsDate ? localDailyWins : 0
        )
        : 0;

    const localMonthlyWinsKey = normalizeStoredUtcMonthValue(localProfile.monthlyWinsUtcKey || localProfile.monthlyWinsKey);
    const remoteMonthlyWinsKey = normalizeStoredUtcMonthValue(firebaseData.monthlyWinsUtcKey || firebaseData.monthlyWinsKey);
    const localMonthlyWins = Number(localProfile.monthlyWins) || 0;
    const remoteMonthlyWins = Number(firebaseData.monthlyWins) || 0;
    const mergedMonthlyWinsKey = remoteMonthlyWinsKey || localMonthlyWinsKey || "";
    const mergedMonthlyWins = mergedMonthlyWinsKey
        ? Math.max(
            remoteMonthlyWinsKey === mergedMonthlyWinsKey ? remoteMonthlyWins : 0,
            localMonthlyWinsKey === mergedMonthlyWinsKey ? localMonthlyWins : 0
        )
        : 0;
    return {
        uid: currentUser.uid,
        username: preferredUsername,
        email: currentUser.email,
        profilePicture: preferredProfilePic,
        profilePic: preferredProfilePic,
        avatar: preferredAvatar,
        totalGuesses: maxNumeric(localProfile.totalGuesses, firebaseData.totalGuesses),
        gamesPlayed: maxNumeric(localProfile.gamesPlayed, firebaseData.gamesPlayed),
        wins: maxNumeric(localProfile.wins, firebaseData.wins),
        losses: maxNumeric(localProfile.losses, firebaseData.losses),
        averageGuesses: maxNumeric(localProfile.averageGuesses, firebaseData.averageGuesses),
        bestGame: (() => {
            const localBest = Number(localProfile.bestGame) || 0;
            const firebaseBest = Number(firebaseData.bestGame) || 0;
            if (!localBest) return firebaseBest;
            if (!firebaseBest) return localBest;
            return Math.min(localBest, firebaseBest);
        })(),
        currentStreak: maxNumeric(localProfile.currentStreak, firebaseData.currentStreak),
        highestStreak: maxNumeric(localProfile.highestStreak, firebaseData.highestStreak),
        dailyWins: mergedDailyWins,
        dailyWinsDate: mergedDailyWinsDate,
        dailyWinsUtcDate: mergedDailyWinsDate,
        monthlyWins: mergedMonthlyWins,
        monthlyWinsKey: mergedMonthlyWinsKey,
        monthlyWinsUtcKey: mergedMonthlyWinsKey,
        winPeriodVersion: Math.max(Number(localProfile.winPeriodVersion) || 0, Number(firebaseData.winPeriodVersion) || 0),
        totalXP: maxNumeric(localProfile.totalXP, firebaseData.totalXP || firebaseData.totalGuesses),
        duelGames: maxNumeric(localProfile.duelGames, firebaseData.duelGames),
        duelWins: maxNumeric(localProfile.duelWins, firebaseData.duelWins),
        cratesOpened: preferredCratesOpened,
        cratesSinceLegendary: preferredCratesSinceLegendary,
        streakShields: preferredStreakShields,
        instantCrateOpen: preferredInstantCrateOpen,
        pearls: preferredPearls,
        pearlBoostExpiresAt: preferredPearlBoostExpiresAt,
        seasonXpBoosts: preferredSeasonXpBoosts,
        earnedCosmetics: getUnifiedCosmeticList(localProfile.earnedCosmetics, firebaseData.earnedCosmetics, "imagePath"),
        testerBadgeUnlocked: Boolean(firebaseData.testerBadgeUnlocked || localProfile.testerBadgeUnlocked),
        equippedBadge: preferredEquippedBadge,
        equippedCardTheme: preferredEquippedCardTheme,
        unlockedBadges: getMergedUniqueIds(localProfile.unlockedBadges, firebaseData.unlockedBadges, ["starter"]),
        unlockedCardThemes: getMergedUniqueIds(localProfile.unlockedCardThemes, firebaseData.unlockedCardThemes, ["default"]),
        unlockedTitles: getMergedUniqueIds(localProfile.unlockedTitles, firebaseData.unlockedTitles, []),
        equippedTitle: preferredEquippedTitle,
        communityBossRewards: {
            ...(localProfile.communityBossRewards && typeof localProfile.communityBossRewards === "object" ? localProfile.communityBossRewards : {}),
            ...(firebaseData.communityBossRewards && typeof firebaseData.communityBossRewards === "object" ? firebaseData.communityBossRewards : {})
        },
        sharkPassMissionClaims: {
            ...(localProfile.sharkPassMissionClaims && typeof localProfile.sharkPassMissionClaims === "object" ? localProfile.sharkPassMissionClaims : {}),
            ...(firebaseData.sharkPassMissionClaims && typeof firebaseData.sharkPassMissionClaims === "object" ? firebaseData.sharkPassMissionClaims : {})
        },
        sharkPassSeasonBaselines: {
            ...(localProfile.sharkPassSeasonBaselines && typeof localProfile.sharkPassSeasonBaselines === "object" ? localProfile.sharkPassSeasonBaselines : {}),
            ...(firebaseData.sharkPassSeasonBaselines && typeof firebaseData.sharkPassSeasonBaselines === "object" ? firebaseData.sharkPassSeasonBaselines : {})
        },
        sharkPassLevelRewardClaims: getMergedUniqueIds(localProfile.sharkPassLevelRewardClaims, firebaseData.sharkPassLevelRewardClaims, []),
        sharkPassSeasonId: firebaseData.sharkPassSeasonId || localProfile.sharkPassSeasonId || SHARK_PASS_ACTIVE_SEASON_ID,
        crateInventory: preferredCrateInventory,
        claimedAchievements: mergedClaimedAchievements,
        unlockedAchievements: mergedUnlockedAchievements,
        redeemedCodes: mergedRedeemedCodes,
        loginStreak: mergedLoginProgress.loginStreak,
        currentLoginDay: mergedLoginProgress.currentLoginDay,
        lastLoginDate: mergedLoginProgress.lastLoginDate,
        dailyLoginModalShownToday: mergedLoginProgress.dailyLoginModalShownToday,
        lastSpinWheelDate: [normalizeStoredDateValue(localProfile.lastSpinWheelDate), normalizeStoredDateValue(firebaseData.lastSpinWheelDate)].filter(Boolean).sort().pop() || "",
        lastUpdated: Math.max(localUpdatedMs, firebaseUpdatedMs)
    };
}

async function loadUserProfile(options = {}) {
    const { rethrowErrors = false } = options;
    try {
        const authUser = firebase.auth().currentUser;
        if (!currentUser || !authUser || currentUser.uid !== authUser.uid) {
            console.warn("Skipped loadUserProfile: auth state not settled.");
            return null;
        }
        const localProfile = getBestLocalProfile();
        // Load from userStats collection
        const statsRef = db.collection("userStats").doc(authUser.uid);
        const { snapshot: statsSnap, fromServer } = await getUserStatsSnapshot(statsRef);
        // Accept cache-backed hydration as valid so stat sync is not blocked when
        // a direct server read is temporarily unavailable.
        lastServerHydratedProfileUid = authUser.uid;
        let userData = {};
        let firebaseData = null;
        // If Firestore doc exists and has at least one stat field, use it as source of truth
        if (statsSnap.exists && Object.keys(statsSnap.data() || {}).length > 0) {
            firebaseData = statsSnap.data();
            userData = mergeProfilesSafely(localProfile, firebaseData);
            storeLoginProgressLocally(userData, authUser.uid);
            saveUserProfileLocally(userData, { skipRemoteSync: true, preserveLastUpdated: true });
            // Ensure legacy localStorage keys are updated for compatibility with other parts of the app
            localStorage.setItem("games", String(userData.gamesPlayed || 0));
            localStorage.setItem("wins", String(userData.wins || 0));
            localStorage.setItem("losses", String(userData.losses || 0));
            if (userData.totalXP !== undefined) {
                localStorage.setItem("totalXP", String(userData.totalXP || 0));
            }
            const mergedRedeemedCodes = getMergedUniqueIds(
                JSON.parse(localStorage.getItem("redeemedCodes") || "[]"),
                firebaseData.redeemedCodes
            );
            localStorage.setItem("redeemedCodes", JSON.stringify(mergedRedeemedCodes));
            userData.redeemedCodes = mergedRedeemedCodes;
            const mergedLoginProgressPayload = buildLoginProgressSyncPayload(userData);
            if (loginProgressDiffers(firebaseData, mergedLoginProgressPayload)) {
                await statsRef.set(mergedLoginProgressPayload, { merge: true });
            }
            const normalizedSpinDate = normalizeStoredDateValue(firebaseData.lastSpinWheelDate);
            if (normalizedSpinDate) {
                localStorage.setItem(getLastSpinWheelDateStorageKey(currentUser.uid), normalizedSpinDate);
            } else {
                localStorage.removeItem(getLastSpinWheelDateStorageKey(currentUser.uid));
            }
            // Merge achievements instead of letting a stale Firestore snapshot clear local claims.
            const mergedClaimedAchievements = getMergedUniqueIds(
                JSON.parse(localStorage.getItem("claimedAchievements") || "[]"),
                firebaseData.claimedAchievements
            );
            const mergedUnlockedAchievements = getMergedUniqueIds(
                JSON.parse(localStorage.getItem("unlockedAchievements") || "[]"),
                firebaseData.unlockedAchievements
            );
            localStorage.setItem("claimedAchievements", JSON.stringify(mergedClaimedAchievements));
            localStorage.setItem("unlockedAchievements", JSON.stringify(mergedUnlockedAchievements));
            if (
                mergedClaimedAchievements.length !== (Array.isArray(firebaseData.claimedAchievements) ? firebaseData.claimedAchievements.length : 0)
                || mergedUnlockedAchievements.length !== (Array.isArray(firebaseData.unlockedAchievements) ? firebaseData.unlockedAchievements.length : 0)
                || mergedRedeemedCodes.length !== (Array.isArray(firebaseData.redeemedCodes) ? firebaseData.redeemedCodes.length : 0)
            ) {
                await statsRef.set({
                    claimedAchievements: mergedClaimedAchievements,
                    unlockedAchievements: mergedUnlockedAchievements,
                    redeemedCodes: mergedRedeemedCodes
                }, { merge: true });
            }
        } else if (hasMeaningfulProfileData(localProfile)) {
            userData = mergeProfilesSafely(localProfile, {});
            storeLoginProgressLocally(userData, authUser.uid);
            // Only seed remote stats if we positively confirmed from the server that the doc was empty.
            // This prevents cache-fallback reads from clobbering real cloud stats on login.
            if (fromServer) {
                await statsRef.set(userData, { merge: true });
            } else {
                console.warn("Skipped seeding userStats from local profile because snapshot was cache-fallback.");
            }
            saveUserProfileLocally(userData, { skipRemoteSync: true, preserveLastUpdated: true });
        } else {
            const cachedPreferredUsername = getStoredPreferredUsername();
            const localLoginProgress = getLoginProgressFromLocalStorage(authUser.uid);
            const parseStoredAchievementIds = key => {
                try {
                    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
                    return Array.isArray(parsed) ? parsed : [];
                } catch (error) {
                    return [];
                }
            };
            userData = {
                uid: authUser.uid,
                username: cachedPreferredUsername || localProfile.username || authUser.email.split("@")[0],
                email: authUser.email,
                profilePicture: "images/pfp/shark1.png",
                avatar: "🦈",
                totalGuesses: 0,
                gamesPlayed: 0,
                wins: 0,
                losses: 0,
                averageGuesses: 0,
                bestGame: 0,
                currentStreak: 0,
                highestStreak: 0,
                totalXP: 0,
                duelGames: 0,
                duelWins: 0,
                cratesOpened: 0,
                cratesSinceLegendary: 0,
                streakShields: 0,
                pearls: 0,
                pearlBoostExpiresAt: 0,
                seasonXpBoosts: {},
                instantCrateOpen: false,
                earnedCosmetics: [],
                testerBadgeUnlocked: false,
                equippedBadge: "starter",
                equippedCardTheme: "default",
                unlockedBadges: ["starter"],
                unlockedCardThemes: ["default"],
                unlockedTitles: [],
                equippedTitle: "",
                loginStreak: localLoginProgress.loginStreak,
                currentLoginDay: localLoginProgress.currentLoginDay,
                lastLoginDate: localLoginProgress.lastLoginDate,
                dailyLoginModalShownToday: localLoginProgress.dailyLoginModalShownToday,
                claimedAchievements: parseStoredAchievementIds("claimedAchievements"),
                unlockedAchievements: parseStoredAchievementIds("unlockedAchievements"),
                redeemedCodes: getRedeemedCodes(),
                communityBossRewards: {},
                sharkPassMissionClaims: {},
                sharkPassSeasonBaselines: {},
                sharkPassLevelRewardClaims: [],
                sharkPassSeasonId: SHARK_PASS_ACTIVE_SEASON_ID,
                crateInventory: normalizeCrateInventory()
            };
            storeLoginProgressLocally(userData, authUser.uid);
            saveUserProfileLocally(userData, { skipRemoteSync: true, preserveLastUpdated: true });
        }
        const themeSyncResult = syncAchievementThemeUnlocks(userData);
        userData = themeSyncResult.profileData;
        if (themeSyncResult.changed && currentUser && db) {
            await statsRef.set({ unlockedCardThemes: themeSyncResult.unlockedThemeIds }, { merge: true });
        }
        updateProfileDisplay(userData);
        // Update navbar profile pic
        const navProfilePic = document.getElementById("nav-profile-pic");
        if (navProfilePic) navProfilePic.src = userData.profilePicture || "images/pfp/shark1.png";
        if (typeof updateProfileBadgeUI === "function") {
            updateProfileBadgeUI();
        }
        if (typeof renderThemeSelection === "function") {
            renderThemeSelection();
        }
        if (typeof renderTitleSelection === "function") {
            renderTitleSelection();
        }
        loadEarnedCosmetics();
        if (typeof loadAvailablePFPs === "function") {
            loadAvailablePFPs();
        }
        return userData;
    } catch (error) {
        console.error("Error loading profile:", error);
        if (rethrowErrors) throw error;
        return null;
    }
}

function updateProfileDisplay(userData) {
    if (!userData) return;
    const profileUsername = document.getElementById("profile-username");
    const profileTotalGuesses = document.getElementById("profile-xp");
    const profileGames = document.getElementById("profile-games");
    const profileWins = document.getElementById("profile-wins");
    const profileLosses = document.getElementById("profile-losses");
    const profileAvgGuesses = document.getElementById("profile-avg-guesses");
    const profileBestGame = document.getElementById("profile-best-game");
    const profileCurrentStreak = document.getElementById("profile-current-streak");
    const profileHighestStreak = document.getElementById("profile-highest-streak");
    const profilePic = document.getElementById("profile-pic");

    if (profileUsername) profileUsername.textContent = userData.username || "Unknown";
    if (profileTotalGuesses) profileTotalGuesses.textContent = userData.totalGuesses ?? 0;
    if (profileGames) profileGames.textContent = userData.gamesPlayed ?? userData.games ?? 0;
    if (profileWins) profileWins.textContent = userData.wins ?? 0;
    if (profileLosses) profileLosses.textContent = userData.losses ?? 0;
    if (profileAvgGuesses) {
        let avg = userData.averageGuesses;
        if (typeof avg !== "number") avg = Number(avg);
        if (isNaN(avg)) avg = 0;
        profileAvgGuesses.textContent = avg.toFixed(2);
    }
    if (profileBestGame) profileBestGame.textContent = userData.bestGame ?? 0;
    if (profileCurrentStreak) profileCurrentStreak.textContent = userData.currentStreak ?? 0;
    if (profileHighestStreak) profileHighestStreak.textContent = userData.highestStreak ?? 0;
    if (profilePic) profilePic.src = userData.profilePicture || "images/pfp/shark1.png";
    const navProfilePic = document.getElementById("nav-profile-pic");
    if (navProfilePic) navProfilePic.src = userData.profilePicture || "images/pfp/shark1.png";
    updateHomeV3Sidebar(userData);
    applyProfileCardTheme(userData.equippedCardTheme || "default");
    updateProfileTitleUI(userData);
    renderTitleSelection();

    const profileUid = userData.uid || currentUser?.uid;
    if (profileUid) {
        const requestId = ++latestProfileLeaderboardRequest;
        fetchLeaderboardPlacement(profileUid).then(rank => {
            if (requestId !== latestProfileLeaderboardRequest) return;
            applyLeaderboardBadge("profile-leaderboard-badge", rank);
        });
    } else {
        applyLeaderboardBadge("profile-leaderboard-badge", null);
    }

    // Also update index stats just in case
    updateIndexStats();
}

function updateHomeV3Sidebar(profileData = getCurrentProfileData()) {
    const isLoggedIn = Boolean(currentUser);
    const data = profileData || {};
    const totalXP = Number(data.totalXP) || 0;
    const currentLevel = typeof getLevelFromXP === "function" ? getLevelFromXP(totalXP) : 1;
    const gamesPlayed = Number(data.gamesPlayed ?? data.games) || 0;
    const wins = Number(data.wins) || 0;
    const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
    const avatarPath = data.profilePicture || data.profilePic || "images/pfp/shark1.png";
    const xpIntoLevel = typeof getXPInCurrentLevel === "function" ? getXPInCurrentLevel(totalXP) : totalXP;
    const xpToNext = typeof getXPToNextLevel === "function" ? getXPToNextLevel(totalXP) : 0;
    const xpLevelTotal = Math.max(1, xpIntoLevel + xpToNext);
    const xpPercent = Math.max(0, Math.min(100, (xpIntoLevel / xpLevelTotal) * 100));

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    const avatar = document.getElementById("home-v3-avatar");
    if (avatar) avatar.src = avatarPath;

    const widget = document.getElementById("home-v3-profile-widget");
    if (widget) widget.classList.toggle("hidden", !isLoggedIn);
    setText("home-v3-username", isLoggedIn ? (data.username || currentUser?.email?.split("@")[0] || "Sharkdle Player") : "Guest Shark");
    setText("home-v3-level-label", isLoggedIn ? `Level ${currentLevel}` : "Level 1");
    setText("home-v3-xp-label", isLoggedIn ? `XP ${xpIntoLevel}/${xpLevelTotal}` : "XP 0/0");
    const fill = document.getElementById("home-v3-xp-fill");
    if (fill) fill.style.width = isLoggedIn ? `${xpPercent}%` : "0%";

    setText("home-v3-games", isLoggedIn ? gamesPlayed : 0);
    setText("home-v3-winrate", isLoggedIn ? `${winRate}%` : "0%");
    setText("home-v3-best-streak", isLoggedIn ? (data.highestStreak || 0) : 0);
    setText("home-v3-total-xp", isLoggedIn ? totalXP : 0);

    const shieldCount = typeof getStreakShieldCount === "function" ? getStreakShieldCount(data) : (Number(data.streakShields) || 0);
    setText("home-v3-shields", isLoggedIn ? `${shieldCount}/3` : "0/3");
    const pearls = typeof getPearlCount === "function" ? getPearlCount(data) : (Number(data.pearls ?? data.tidePearls) || 0);
    setText("home-v3-pearls", isLoggedIn ? pearls.toLocaleString() : "0");
    renderPearlShop(data);
}

function formatShopTimeRemaining(msRemaining) {
    const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function getPearlShopEventCrateId() {
    return COMMUNITY_BOSS_EVENT?.crateId || "summer";
}

function getPearlShopPurchaseState(itemId, profileData = getCurrentProfileData()) {
    const item = PEARL_SHOP_ITEMS[itemId];
    if (!item) return { disabled: true, label: "Unavailable", owned: false, reason: "Unavailable" };

    const pearls = getPearlCount(profileData);
    const isLoggedIn = Boolean(currentUser);
    let disabled = !isLoggedIn || pearls < item.price;
    let label = `${item.price}p`;
    let owned = false;
    let reason = !isLoggedIn ? "Login required" : pearls < item.price ? "Need more pearls" : "";

    if (itemId === "streak-shield" && getStreakShieldCount(profileData) >= 3) {
        disabled = true;
        label = "Maxed";
        owned = true;
        reason = "Max shields";
    }

    if (itemId === "pearl-boost" && isPearlBoostActive(profileData)) {
        label = `Extend ${item.price}p`;
        reason = "";
    }

    if (itemId === "season-xp" && hasSeasonXpBoost(profileData)) {
        disabled = true;
        label = "Owned";
        owned = true;
        reason = "Owned";
    }

    return { disabled, label, owned, reason };
}

function renderPearlShop(profileData = getCurrentProfileData()) {
    const status = document.getElementById("home-v3-shop-status");
    const eventCrateName = document.getElementById("home-v3-event-crate-name");
    const balance = document.getElementById("pearl-shop-balance");
    if (!status && !eventCrateName && !balance && !document.querySelector("[data-pearl-shop-item]")) return;

    const eventCrateId = getPearlShopEventCrateId();
    const eventCrateDef = getCrateDefinition(eventCrateId);
    if (eventCrateName) eventCrateName.textContent = eventCrateDef.name || "Event Crate";

    const isLoggedIn = Boolean(currentUser);
    const pearls = getPearlCount(profileData);
    if (balance) balance.textContent = isLoggedIn ? pearls.toLocaleString() : "0";
    const pearlBoostMs = getPearlBoostExpiresAt(profileData) - Date.now();
    if (status) {
        if (!isLoggedIn) {
            status.textContent = "Login to spend and save pearls.";
        } else if (pearlBoostMs > 0 && hasSeasonXpBoost(profileData)) {
            status.textContent = `2x pearls active for ${formatShopTimeRemaining(pearlBoostMs)}. Season 2x XP owned.`;
        } else if (pearlBoostMs > 0) {
            status.textContent = `2x pearls active for ${formatShopTimeRemaining(pearlBoostMs)}.`;
        } else if (hasSeasonXpBoost(profileData)) {
            status.textContent = "Season 2x XP owned for the current season.";
        } else {
            status.textContent = "Spend pearls on boosts, crates, and streak protection.";
        }
    }

    Object.keys(PEARL_SHOP_ITEMS).forEach(itemId => {
        const state = getPearlShopPurchaseState(itemId, profileData);
        document.querySelectorAll(`[data-pearl-shop-item="${itemId}"]`).forEach(card => {
            const button = card.querySelector("button");
            if (!button) return;
            button.textContent = state.label;
            button.disabled = state.disabled;
            button.title = state.reason || "";
            card.classList.toggle("owned", state.owned);
            card.classList.toggle("disabled", state.disabled && !state.owned);
        });
    });
}

function openPearlShopModal() {
    const modal = document.getElementById("pearlShopModal");
    if (!modal) return;
    renderPearlShop(getCurrentProfileData());
    modal.classList.remove("hidden");
}

function closePearlShopModal() {
    document.getElementById("pearlShopModal")?.classList.add("hidden");
}

function grantPearlShopItem(profileData, itemId) {
    if (!profileData || typeof profileData !== "object") return { success: false, message: "Profile not ready." };

    if (itemId === "streak-shield") {
        const currentShields = getStreakShieldCount(profileData);
        if (currentShields >= 3) return { success: false, message: "You already have the maximum Streak Shields." };
        setStreakShieldCount(profileData, currentShields + 1);
        return { success: true, message: "Streak Shield added." };
    }

    if (itemId === "pearl-boost") {
        const startsAt = Math.max(Date.now(), getPearlBoostExpiresAt(profileData));
        profileData.pearlBoostExpiresAt = startsAt + PEARL_BOOST_DURATION_MS;
        return { success: true, message: "2x Pearls Boost activated for 1 hour." };
    }

    if (itemId === "cosmetic-crate" || itemId === "event-crate") {
        const crateId = itemId === "event-crate" ? getPearlShopEventCrateId() : "reef";
        const inventory = getCrateInventory(profileData);
        inventory[crateId] = (inventory[crateId] || 0) + 1;
        profileData.crateInventory = normalizeCrateInventory(inventory);
        return { success: true, message: `${getCrateDefinition(crateId).name} added.` };
    }

    if (itemId === "season-xp") {
        if (hasSeasonXpBoost(profileData)) return { success: false, message: "Season 2x XP is already owned." };
        setSeasonXpBoost(profileData);
        return { success: true, message: "Season 2x XP unlocked for the current season." };
    }

    return { success: false, message: "Unknown shop item." };
}

function buyPearlShopItem(itemId) {
    const item = PEARL_SHOP_ITEMS[itemId];
    if (!item) return;
    if (!currentUser) {
        showNotification("Login to spend pearls in the shop.", "error", 3200);
        return;
    }

    const profileData = getCurrentProfileData();
    const state = getPearlShopPurchaseState(itemId, profileData);
    if (state.disabled && state.reason) {
        showNotification(state.reason, "error", 2800);
        return;
    }

    const pearls = getPearlCount(profileData);
    if (pearls < item.price) {
        showNotification(`You need ${item.price - pearls} more pearls.`, "error", 3200);
        return;
    }

    const grant = grantPearlShopItem(profileData, itemId);
    if (!grant.success) {
        showNotification(grant.message, "error", 3200);
        renderPearlShop(profileData);
        return;
    }

    setPearlCount(profileData, pearls - item.price);
    saveUserProfileLocally({
        ...profileData,
        uid: window.currentUser?.uid || firebase.auth().currentUser?.uid || profileData.uid
    });
    updateHomeV3Sidebar(profileData);
    renderCratesButton();
    renderCratesModal();
    updateSeasonalCratePanels(profileData);
    showNotification(`${grant.message} -${item.price} pearls`, "success", 3400);
}

function switchHomeV3Tab(tabId = "play") {
    const tabs = document.querySelectorAll("[data-home-v3-tab]");
    const panels = document.querySelectorAll("[data-home-v3-panel]");
    tabs.forEach(tab => {
        const isActive = tab.dataset.homeV3Tab === tabId;
        tab.classList.toggle("active", isActive);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    panels.forEach(panel => {
        const isActive = panel.dataset.homeV3Panel === tabId;
        panel.classList.toggle("active", isActive);
        panel.hidden = !isActive;
    });
}

function initHomeV3Tabs() {
    document.querySelectorAll("[data-home-v3-tab]").forEach(tab => {
        if (tab.dataset.homeV3Ready === "true") return;
        tab.dataset.homeV3Ready = "true";
        tab.addEventListener("click", () => switchHomeV3Tab(tab.dataset.homeV3Tab || "play"));
    });
}

function initHomeV3CratesButton() {
    const cratesBtn = document.getElementById("crates-btn");
    if (!cratesBtn || cratesBtn.dataset.homeCratesReady === "true") return;
    cratesBtn.dataset.homeCratesReady = "true";
    cratesBtn.addEventListener("click", event => {
        event.preventDefault();
        openHomeCratesModal();
    });
}

function updateIndexStats() {
        const profileData = getCurrentProfileData();
        updateHomeV3Sidebar(profileData);

        if (currentUser && profileData) {
                // Logged-in -> use profileData
                const gamesEl = document.getElementById("games");
                const winsEl = document.getElementById("wins");
                const lossesEl = document.getElementById("losses");
                const guessesEl = document.getElementById("profile-guesses");
                const totalXpEl = document.getElementById("total-xp");
                const avgGuessesEl = document.getElementById("avg-guesses");
                const bestGameEl = document.getElementById("best-game");
                const currentStreakEl = document.getElementById("current-streak");
                const highestStreakEl = document.getElementById("highest-streak");

                if (gamesEl) gamesEl.textContent = profileData.gamesPlayed || 0;
                if (winsEl) winsEl.textContent = profileData.wins || 0;
                if (lossesEl) lossesEl.textContent = profileData.losses || 0;
                if (guessesEl) guessesEl.textContent = profileData.totalGuesses || 0;
                if (totalXpEl) totalXpEl.textContent = profileData.totalXP || 0;
                if (avgGuessesEl) avgGuessesEl.textContent = (profileData.averageGuesses || 0).toFixed(2);
                if (bestGameEl) bestGameEl.textContent = profileData.bestGame || 0;
                if (currentStreakEl) currentStreakEl.textContent = profileData.currentStreak || 0;
                if (highestStreakEl) highestStreakEl.textContent = profileData.highestStreak || 0;
        } else {
                // Logged-out -> show 0
                const gamesEl = document.getElementById("games");
                const winsEl = document.getElementById("wins");
                const lossesEl = document.getElementById("losses");
                const guessesEl = document.getElementById("profile-guesses");
                const totalXpEl = document.getElementById("total-xp");
                const avgGuessesEl = document.getElementById("avg-guesses");
                const bestGameEl = document.getElementById("best-game");
                const currentStreakEl = document.getElementById("current-streak");
                const highestStreakEl = document.getElementById("highest-streak");

                if (gamesEl) gamesEl.textContent = 0;
                if (winsEl) winsEl.textContent = 0;
                if (lossesEl) lossesEl.textContent = 0;
                if (guessesEl) guessesEl.textContent = 0;
                if (totalXpEl) totalXpEl.textContent = 0;
                if (avgGuessesEl) avgGuessesEl.textContent = 0;
                if (bestGameEl) bestGameEl.textContent = 0;
                if (currentStreakEl) currentStreakEl.textContent = 0;
                if (highestStreakEl) highestStreakEl.textContent = 0;
        }
        // Also update recent games tab if visible
        var recentTab = document.getElementById('recent-tab');
        if (recentTab && recentTab.style.display !== 'none') {
            renderRecentGames();
        }
        renderCratesButton();
        updateSpinWheelUI();
}
// expose for game files
window.updateIndexStats = updateIndexStats;

// Profile Tabs Logic
window.showProfileTab = function(tab) {
    const statsTab = document.getElementById('stats-tab');
    const recentTab = document.getElementById('recent-tab');
    const friendsTab = document.getElementById('friends-tab');
    const consumablesTab = document.getElementById('consumables-tab');
    const statsBtn = document.getElementById('stats-tab-btn');
    const recentBtn = document.getElementById('recent-tab-btn');
    const friendsBtn = document.getElementById('friends-tab-btn');
    const consumablesBtn = document.getElementById('consumables-tab-btn');

    if (statsTab) statsTab.style.display = tab === 'stats' ? 'block' : 'none';
    if (recentTab) recentTab.style.display = tab === 'recent' ? 'block' : 'none';
    if (friendsTab) friendsTab.style.display = tab === 'friends' ? 'block' : 'none';
    if (consumablesTab) consumablesTab.style.display = tab === 'consumables' ? 'block' : 'none';

    if (statsBtn) statsBtn.classList.toggle('active', tab === 'stats');
    if (recentBtn) recentBtn.classList.toggle('active', tab === 'recent');
    if (friendsBtn) friendsBtn.classList.toggle('active', tab === 'friends');
    if (consumablesBtn) consumablesBtn.classList.toggle('active', tab === 'consumables');

    if (tab === 'stats') {
        animateStatsFromLastView();
    } else if (tab === 'recent') {
        saveLastViewedStats();
        renderRecentGames();
    } else if (tab === 'friends') {
        populateFriendsTab();
    } else if (tab === 'consumables') {
        renderConsumablesPage();
    }

    // Save current tab for persistent tab selection (optional QoL)
    localStorage.setItem('profileLastTab', tab);
}

function saveLastViewedStats() {
    const stats = {
        totalGuesses: parseInt(document.getElementById('profile-xp')?.textContent) || 0,
        gamesPlayed: parseInt(document.getElementById('profile-games')?.textContent) || 0,
        wins: parseInt(document.getElementById('profile-wins')?.textContent) || 0,
        losses: parseInt(document.getElementById('profile-losses')?.textContent) || 0,
        averageGuesses: parseFloat(document.getElementById('profile-avg-guesses')?.textContent) || 0,
        bestGame: parseInt(document.getElementById('profile-best-game')?.textContent) || 0,
        currentStreak: parseInt(document.getElementById('profile-current-streak')?.textContent) || 0,
        highestStreak: parseInt(document.getElementById('profile-highest-streak')?.textContent) || 0
    };
    localStorage.setItem('lastViewedStats', JSON.stringify(stats));
}

function animateStatsFromLastView() {
    const userData = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const lastStats = JSON.parse(localStorage.getItem('lastViewedStats') || '{}');
    const statMap = [
        { id: 'profile-xp', key: 'totalGuesses', decimals: 0 },
        { id: 'profile-games', key: 'gamesPlayed', decimals: 0 },
        { id: 'profile-wins', key: 'wins', decimals: 0 },
        { id: 'profile-losses', key: 'losses', decimals: 0 },
        { id: 'profile-avg-guesses', key: 'averageGuesses', decimals: 2 },
        { id: 'profile-best-game', key: 'bestGame', decimals: 0 },
        { id: 'profile-current-streak', key: 'currentStreak', decimals: 0 },
        { id: 'profile-highest-streak', key: 'highestStreak', decimals: 0 }
    ];
    statMap.forEach(({ id, key, decimals }) => {
        const el = document.getElementById(id);
        if (!el) return;
        const start = (lastStats && typeof lastStats[key] !== 'undefined') ? Number(lastStats[key]) : 0;
        let end = userData[key] ?? 0;
        if (typeof end === 'string') end = parseFloat(end);
        animateNumber(el, start, end, 900, decimals);
    });
}

function animateNumber(el, start, end, duration, decimals) {
    if (start === end) {
        el.textContent = (typeof end === 'number' ? end.toFixed(decimals) : end);
        return;
    }
    const startTime = performance.now();
    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const value = start + (end - start) * progress;
        el.textContent = value.toFixed(decimals);
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = (typeof end === 'number' ? end.toFixed(decimals) : end);
        }
    }
    requestAnimationFrame(update);
}

function renderRecentGames() {
    const recentGamesDiv = document.getElementById('recent-games-list');
    if (!recentGamesDiv) return;
    const recentGames = JSON.parse(localStorage.getItem('recentGames') || '[]');
    if (recentGames.length === 0) {
        recentGamesDiv.innerHTML = '<div style="color:#b3e5fc;text-align:center;padding:20px 0;">No recent games found.</div>';
        return;
    }
    recentGamesDiv.innerHTML = recentGames.slice(0, 10).map(game => `
        <div class="recent-game-item">
            <div class="game-result">${game.result === 'Win' ? '🏆 Win' : '❌ Loss'}</div>
            <div class="game-date">${game.date} ${game.time}</div>
            <div class="game-shark">Shark: <b>${game.sharkName || 'Unknown'}</b></div>
            <div>Guesses: <b>${game.guesses}</b></div>
            <div>Mode: <b>${game.mode || ''}</b></div>
        </div>
    `).join('');
}

// ---------- Username editing helpers ----------
function enableUsernameEdit() {
    const profileUsernameEl = document.getElementById("profile-username");
    const input = document.getElementById("username-input");
    const editBtn = document.getElementById("edit-profile-btn");
    const shell = document.querySelector(".username-editor-shell");

    if (profileUsernameEl && input) {
        input.value = profileUsernameEl.textContent.trim();
    }
    document.getElementById("username-edit-container").classList.remove("hidden");
    if (editBtn) editBtn.disabled = true;
    if (shell) shell.classList.add("editing");
    if (input) setTimeout(() => input.focus(), 0);
}

function cancelUsernameEdit() {
    document.getElementById("username-edit-container").classList.add("hidden");
    const editBtn = document.getElementById("edit-profile-btn");
    const shell = document.querySelector(".username-editor-shell");
    if (editBtn) editBtn.disabled = false;
    if (shell) shell.classList.remove("editing");
}

async function saveUsername() {
    const newName = document.getElementById("username-input").value.trim();
    if (!newName) {
        alert("Username cannot be empty.");
        return;
    }
    await updateUsername(newName);
    cancelUsernameEdit();
}

async function updateUsername(newUsername) {
    if (!currentUser) return;
    try {
        const profileData = getCurrentProfileData();
        profileData.username = newUsername;
        cachePreferredUsername(newUsername);
        saveUserProfileLocally(profileData);

        const profileUsernameEl = document.getElementById("profile-username");
        if (profileUsernameEl) profileUsernameEl.textContent = newUsername;

        // Save to Firebase
        const statsRef = db.collection("userStats").doc(currentUser.uid);
        await statsRef.set({ username: newUsername, lastUpdated: profileData.lastUpdated || Date.now() }, { merge: true });
    } catch (error) {
        console.warn("Username update failed:", error);
    }
}

function loginUser() {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();
    const errorEl = document.getElementById("auth-error");
    const loginSubmitBtn = document.querySelector("#login-form button[type='submit']") || 
                           document.querySelector("#login-form button:last-of-type");

    if (!email || !password) {
        errorEl.textContent = "Please fill in all fields.";
        errorEl.style.display = "block";
        return;
    }

    // Disable button during login
    if (loginSubmitBtn) {
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.textContent = "Logging in...";
    }

    auth.signInWithEmailAndPassword(email, password)
        .then(result => {
            errorEl.style.display = "none";
            showNotification('Login successful!', 'success');
            closeLoginModal();
            loadUserProfile();
        })
        .catch(error => {
            errorEl.textContent = error.message || "Login failed. Please check your credentials.";
            errorEl.style.display = "block";
            showNotification('Login failed: ' + (error.message || 'Unknown error'), 'error');
        })
        .finally(() => {
            // Re-enable button
            if (loginSubmitBtn) {
                loginSubmitBtn.disabled = false;
                loginSubmitBtn.textContent = "Login";
            }
        });
}

async function forgotPassword() {
    const emailInput = document.getElementById("login-email");
    const errorEl = document.getElementById("auth-error");
    const email = emailInput ? emailInput.value.trim() : "";

    if (!email) {
        errorEl.textContent = "Enter your email first, then we'll send the reset link.";
        errorEl.style.display = "block";
        return;
    }

    try {
        await auth.sendPasswordResetEmail(email);
        errorEl.style.display = "none";
        showNotification("Password reset email sent. Check your inbox.", "success");
    } catch (error) {
        const message = error.message || "Unable to send reset email.";
        errorEl.textContent = message;
        errorEl.style.display = "block";
        showNotification("Password reset failed: " + message, "error");
    }
}

async function signupUser() {
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value.trim();
    const username = document.getElementById("signup-username").value.trim();
    const errorEl = document.getElementById("auth-error");
    const signupSubmitBtn = document.querySelector("#signup-form button[type='submit']") || 
                            document.querySelectorAll("#signup-form button")[1] || 
                            document.querySelector("#signup-form button:last-of-type");

    if (!email || !password || !username) {
        errorEl.textContent = "Please fill in all fields.";
        errorEl.style.display = "block";
        return;
    }

    if (password.length < 6) {
        errorEl.textContent = "Password must be at least 6 characters.";
        errorEl.style.display = "block";
        return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errorEl.textContent = "Please enter a valid email address.";
        errorEl.style.display = "block";
        return;
    }

    // Disable button during signup
    if (signupSubmitBtn) {
        signupSubmitBtn.disabled = true;
        signupSubmitBtn.textContent = "Creating account...";
    }

    try {
        // Check if email is already in use
        const methods = await auth.fetchSignInMethodsForEmail(email);
        if (methods.length > 0) {
            errorEl.textContent = "This email is already registered. Please try logging in instead.";
            errorEl.style.display = "block";
            return;
        }

        // Proceed with account creation
        const result = await auth.createUserWithEmailAndPassword(email, password);
        const userRef = db.collection("userStats").doc(result.user.uid);
        
        // Migrate local offline stats - check both new and old storage locations
        const rawLocalProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
        const localProfile = rawLocalProfile && !rawLocalProfile.uid ? rawLocalProfile : {};
        const _totalXP = localProfile.totalXP || parseInt(localStorage.getItem("totalXP")) || 0;
        const _gamesPlayed = localProfile.gamesPlayed || parseInt(localStorage.getItem("games")) || 0;
        const _wins = localProfile.wins || parseInt(localStorage.getItem("wins")) || 0;
        const _losses = localProfile.losses || parseInt(localStorage.getItem("losses")) || 0;
        const _totalGuesses = localProfile.totalGuesses || 0;
        const _averageGuesses = localProfile.averageGuesses || 0;
        const _bestGame = localProfile.bestGame || 0;
        const _currentStreak = localProfile.currentStreak || 0;
        const _highestStreak = localProfile.highestStreak || 0;
        const _loginProgress = getLoginProgressFromLocalStorage(result.user.uid);
        let _claimedAchievements = [];
        let _unlockedAchievements = [];
        try {
            _claimedAchievements = JSON.parse(localStorage.getItem("claimedAchievements") || "[]");
            _unlockedAchievements = JSON.parse(localStorage.getItem("unlockedAchievements") || "[]");
        } catch (error) {
            console.warn("Unable to migrate local achievement cache during signup:", error);
        }
        
        const _currentLevel = getLevelFromXP(_totalXP);
        const _xpInLevel = getXPInCurrentLevel(_totalXP);
        const _xpToNext = getXPToNextLevel(_totalXP);
        const _unlockedPfps = levelRewards
            .filter(r => r.level <= _currentLevel)
            .map(r => ({ level: r.level, name: r.name || r.imagePath }));

        const newProfile = {
            profilePicture: localProfile.profilePicture || "images/pfp/shark1.png",
            equippedBadge: localProfile.equippedBadge || "starter",
            equippedCardTheme: localProfile.equippedCardTheme || "default",
            equippedTitle: localProfile.equippedTitle || "",
            unlockedTitles: Array.isArray(localProfile.unlockedTitles) ? localProfile.unlockedTitles : [],
            unlockedBadges: Array.isArray(localProfile.unlockedBadges) ? localProfile.unlockedBadges : ["starter"],
            unlockedCardThemes: Array.isArray(localProfile.unlockedCardThemes) ? localProfile.unlockedCardThemes : ["default"],
            earnedCosmetics: Array.isArray(localProfile.earnedCosmetics) ? localProfile.earnedCosmetics : [],
            testerBadgeUnlocked: Boolean(localProfile.testerBadgeUnlocked),
            communityBossRewards: localProfile.communityBossRewards && typeof localProfile.communityBossRewards === "object"
                ? localProfile.communityBossRewards
                : {},
            sharkPassMissionClaims: localProfile.sharkPassMissionClaims && typeof localProfile.sharkPassMissionClaims === "object"
                ? localProfile.sharkPassMissionClaims
                : {},
            sharkPassSeasonBaselines: localProfile.sharkPassSeasonBaselines && typeof localProfile.sharkPassSeasonBaselines === "object"
                ? localProfile.sharkPassSeasonBaselines
                : {},
            sharkPassLevelRewardClaims: Array.isArray(localProfile.sharkPassLevelRewardClaims) ? localProfile.sharkPassLevelRewardClaims : [],
            sharkPassSeasonId: localProfile.sharkPassSeasonId || SHARK_PASS_ACTIVE_SEASON_ID,
            crateInventory: normalizeCrateInventory(localProfile.crateInventory),
            cratesOpened: Math.max(0, Number(localProfile.cratesOpened) || 0),
            streakShields: getStreakShieldCount(localProfile),
            instantCrateOpen: getCrateInstantOpenEnabled(localProfile),
            pearls: getPearlCount(localProfile),
            pearlBoostExpiresAt: getPearlBoostExpiresAt(localProfile),
            seasonXpBoosts: getSeasonXpBoosts(localProfile),
            username: username,
            email: email,
            avatar: "🦈",
            totalXP: _totalXP,
            gamesPlayed: _gamesPlayed,
            wins: _wins,
            losses: _losses,
            totalGuesses: _totalGuesses,
            averageGuesses: _averageGuesses,
            bestGame: _bestGame,
            currentStreak: _currentStreak,
            highestStreak: _highestStreak,
            currentLevel: _currentLevel,
            currentXP: _xpInLevel,
            xpToNextLevel: _xpToNext,
            unlockedPfps: _unlockedPfps,
            claimedAchievements: Array.isArray(_claimedAchievements) ? _claimedAchievements : [],
            unlockedAchievements: Array.isArray(_unlockedAchievements) ? _unlockedAchievements : [],
            redeemedCodes: getRedeemedCodes(),
            loginStreak: _loginProgress.loginStreak,
            currentLoginDay: _loginProgress.currentLoginDay,
            lastLoginDate: _loginProgress.lastLoginDate,
            dailyLoginModalShownToday: _loginProgress.dailyLoginModalShownToday,
            createdAt: new Date()
        };
        await userRef.set(newProfile);

        errorEl.style.display = "none";
        closeLoginModal();
        loadUserProfile();
    } catch (error) {
        errorEl.textContent = error.message || "Account creation failed. Please try again.";
        errorEl.style.display = "block";
        showNotification('Signup failed: ' + (error.message || 'Unknown error'), 'error');
    } finally {
        if (signupSubmitBtn) {
            signupSubmitBtn.disabled = false;
            signupSubmitBtn.textContent = "Sign Up";
        }
    }
}

function logoutUser() {
    auth.signOut().then(() => {
        currentUser = null;
        clearPendingProfileSyncTimeout();
        clearCloudProfileReloadTimeouts();
        clearCachedProfileState();
        closeProfileModal();
        updateAuthUI();
    });
}

function openLoginModal() {
    const loginModal = document.getElementById("loginModal");
    if (loginModal) {
        loginModal.classList.remove("hidden");
    }
}

function closeLoginModal() {
    const loginModal = document.getElementById("loginModal");
    if (loginModal) {
        loginModal.classList.add("hidden");
    }
    const loginEmail = document.getElementById("login-email");
    const loginPassword = document.getElementById("login-password");
    const signupEmail = document.getElementById("signup-email");
    const signupPassword = document.getElementById("signup-password");
    const signupUsername = document.getElementById("signup-username");
    const authError = document.getElementById("auth-error");
    if (loginEmail) loginEmail.value = "";
    if (loginPassword) loginPassword.value = "";
    if (signupEmail) signupEmail.value = "";
    if (signupPassword) signupPassword.value = "";
    if (signupUsername) signupUsername.value = "";
    if (authError) authError.style.display = "none";
    switchToLogin();
}

async function openProfileModal() {
    if (!currentUser) {
        openLoginModal();
        return;
    }

    const profileModal = document.getElementById("profileModal");
    if (!profileModal) {
        showNotification("Profile editing is available on the home page.", "info", 3000);
        return;
    }
    // Reload profile data when opening modal
    await loadUserProfile().catch(err => console.error("Error loading profile:", err));
    if (document.getElementById("username-edit-container")) {
        cancelUsernameEdit();
    }
    updateProfileBadgeUI();
    renderThemeSelection();
    renderTitleSelection();
    updateSeasonalThemeToggleUI();
    ensureAdminAbuseVisibility();
    await ensureFriendDocument(currentUser.uid).catch(err => console.error("Friend network init failed:", err));
    profileModal.classList.remove("hidden");
}

window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.openProfileModal = openProfileModal;

async function openUserProfileModal(uid) {
    if (!uid || !currentUser) return;
    const profileData = await getUserProfileForUid(uid);
    if (!profileData) {
        showNotification('Unable to load user profile', 'error', 3000);
        return;
    }
    updateFriendProfileDisplay(profileData, uid);
    document.getElementById("friendProfileModal").classList.remove("hidden");
}

function updateFriendProfileDisplay(profileData, uid) {
    const usernameEl = document.getElementById('friend-profile-username');
    const titleEl = document.getElementById('friend-profile-title');
    const uidEl = document.getElementById('friend-profile-uid');
    const picEl = document.getElementById('friend-profile-pic');
    const totalGuessesEl = document.getElementById('friend-profile-total-guesses');
    const gamesEl = document.getElementById('friend-profile-games');
    const winsEl = document.getElementById('friend-profile-wins');
    const lossesEl = document.getElementById('friend-profile-losses');
    const avgEl = document.getElementById('friend-profile-avg');
    const bestEl = document.getElementById('friend-profile-best');
    const currentEl = document.getElementById('friend-profile-current');
    const highestEl = document.getElementById('friend-profile-highest');

    if (usernameEl) usernameEl.textContent = profileData.username || uid;
    if (titleEl) {
        const equippedTitle = getEquippedProfileTitle(profileData);
        titleEl.textContent = equippedTitle ? getProfileTitleMeta(equippedTitle).name : "";
        titleEl.classList.toggle("hidden", !equippedTitle);
    }
    if (uidEl) uidEl.textContent = uid;
    if (picEl) picEl.src = profileData.profilePicture || "images/pfp/shark1.png";
    applyThemeToProfileCard('friend-profile-hero-card', profileData.equippedCardTheme || "default");

    const totalGuesses = profileData.totalGuesses ?? 0;
    const games = profileData.gamesPlayed ?? profileData.games ?? 0;
    const wins = profileData.wins ?? 0;
    const losses = profileData.losses ?? 0;

    if (totalGuessesEl) totalGuessesEl.textContent = totalGuesses;
    if (gamesEl) gamesEl.textContent = games;
    if (winsEl) winsEl.textContent = wins;
    if (lossesEl) lossesEl.textContent = losses;

    let avg = profileData.averageGuesses;
    if (typeof avg !== "number") avg = Number(avg);
    if (isNaN(avg)) avg = 0;
    if (avgEl) avgEl.textContent = avg.toFixed(2);

    if (bestEl) bestEl.textContent = profileData.bestGame ?? 0;
    if (currentEl) currentEl.textContent = profileData.currentStreak ?? 0;
    if (highestEl) highestEl.textContent = profileData.highestStreak ?? 0;
    const requestId = ++latestFriendLeaderboardRequest;
    fetchLeaderboardPlacement(uid).then(rank => {
        if (requestId !== latestFriendLeaderboardRequest) return;
        applyLeaderboardBadge('friend-profile-leaderboard-badge', rank);
    });
}

function closeProfileModal() {
    const profileModal = document.getElementById("profileModal");
    if (profileModal) {
        profileModal.classList.add("hidden");
    }
}

function ensureAdminAbuseVisibility() {
    const adminBtn = document.getElementById("open-admin-abuse-btn");
    if (!adminBtn) return;

    const isDeveloper = Boolean(currentUser && isDeveloperUid(currentUser.uid));
    adminBtn.classList.toggle("hidden", !isDeveloper);
}

function openAdminAbuseModal() {
    if (!currentUser || !isDeveloperUid(currentUser.uid)) {
        showNotification("Developer access is required for Admin Abuse.", "error", 3400);
        return;
    }
    const modal = document.getElementById("adminAbuseModal");
    if (!modal) return;
    modal.classList.remove("hidden");
    if (typeof refreshAdminAbusePanel === "function") {
        refreshAdminAbusePanel().catch(error => {
            console.warn("Unable to load admin abuse panel state:", error);
        });
    }
}

function closeAdminAbuseModal() {
    const modal = document.getElementById("adminAbuseModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

function openBadgeModal() {
    if (!currentUser) return;
    renderBadgeSelection();
    document.getElementById("badgeModal").classList.remove("hidden");
}

function closeBadgeModal() {
    document.getElementById("badgeModal").classList.add("hidden");
}

function closeFriendProfileModal() {
    document.getElementById("friendProfileModal").classList.add("hidden");
}

async function refreshProfilePicPicker() {
    await loadEarnedCosmetics();
    renderProfilePicPicker();
}

function openProfilePicModal() {
    const modal = document.getElementById("profilePicModal");
    if (!modal) return;

    pfpPickerFilter = "all";
    pfpPickerSearchQuery = "";
    const searchInput = document.getElementById("pfp-picker-search");
    if (searchInput) searchInput.value = "";
    document.querySelectorAll("#pfp-picker-tabs .picker-modal-tab").forEach(tab => {
        const isAll = tab.dataset.pfpFilter === "all";
        tab.classList.toggle("active", isAll);
        tab.setAttribute("aria-selected", isAll ? "true" : "false");
    });

    const showModal = () => {
        renderProfilePicPicker();
        modal.classList.remove("hidden");
    };

    if (typeof loadUserProfile === "function") {
        loadUserProfile()
            .then(() => refreshProfilePicPicker().then(showModal))
            .catch(() => refreshProfilePicPicker().then(showModal));
        return;
    }

    refreshProfilePicPicker().then(showModal);
}

function closeProfilePicModal() {
    document.getElementById("profilePicModal").classList.add("hidden");
}

function switchToLogin() {
    const loginForm = document.querySelector(".login-form");
    const signupForm = document.querySelector(".signup-form");
    if (loginForm) loginForm.classList.remove("hidden");
    if (signupForm) signupForm.classList.add("hidden");
}

function switchToSignup() {
    const loginForm = document.querySelector(".login-form");
    const signupForm = document.querySelector(".signup-form");
    if (loginForm) loginForm.classList.add("hidden");
    if (signupForm) signupForm.classList.remove("hidden");
}

async function setProfilePicture(picturePath) {
    if (!currentUser) return;

    try {
        // Update localStorage immediately
        const profileData = getCurrentProfileData();
        profileData.profilePicture = picturePath;
        profileData.profilePic = picturePath;
        saveUserProfileLocally(profileData);

        // Update UI immediately
        const profilePic = document.getElementById("profile-pic");
        if (profilePic) profilePic.src = picturePath;
        const navProfilePic = document.getElementById("nav-profile-pic");
        if (navProfilePic) navProfilePic.src = picturePath;

        // Save to Firebase
        const statsRef = db.collection("userStats").doc(currentUser.uid);
        await statsRef.set({
            profilePicture: picturePath,
            profilePic: picturePath,
            lastUpdated: Date.now()
        }, { merge: true });

        updateProfilePicPickerPreview(picturePath);
        renderProfilePicPicker();
        renderProfileInventoryUI(profileData);
        const equippedEntry = findProfilePicCatalogEntry(buildProfilePicPickerCatalog(), picturePath);
        showNotification(`${equippedEntry?.name || "Portrait"} equipped.`, "success", 2400);
    } catch (error) {
        console.error("Error setting profile picture:", error);
        showNotification("Could not update profile picture. Try again.", "error", 3200);
    }
}

const STARTER_PROFILE_PFPS = [
    { filename: "shark1.png", name: "Whale Shark" },
    { filename: "shark2.png", name: "Great White Shark" },
    { filename: "shark3.png", name: "Hammerhead Shark" },
    { filename: "shark4.png", name: "Basking Shark" },
    { filename: "shark5.png", name: "Zebra Shark" }
];

const PFP_RARITY_ORDER = ["core", "common", "rare", "epic", "legendary", "special"];
let pfpPickerFilter = "all";
let pfpPickerSearchQuery = "";
let pfpPickerControlsBound = false;

function inferPfpRarityFromPath(imagePath = "") {
    if (/leaderPfp\/Shark19\.png$/i.test(imagePath)) return "legendary";
    if (/leaderPfp\/(Daily|Monthly)\//i.test(imagePath)) return "rare";
    if (/loginPfp/i.test(imagePath) || imagePath === SPIN_WHEEL_LEGENDARY_PFP.imagePath) return "legendary";
    if (/codePfp/i.test(imagePath)) return "special";
    if (/levelPfp\/Shark16\.png$/i.test(imagePath)) return "legendary";
    if (/levelPfp\/Shark1[2-5]\.png$/i.test(imagePath)) return "epic";
    if (/levelPfp/i.test(imagePath)) return "common";
    const seasonalMatch = imagePath.match(/cratePfp\/(?:SummerPfp|ChristmasPfp|HalloweenPfp)\/Shark([1-4])\.png$/i);
    if (seasonalMatch) {
        return ({ 1: "common", 2: "rare", 3: "epic", 4: "legendary" })[Number(seasonalMatch[1])] || "common";
    }
    if (/cratePfp\/Shark24\.png$/i.test(imagePath)) return "common";
    if (/cratePfp\/Shark25\.png$/i.test(imagePath)) return "rare";
    if (/cratePfp\/Shark23\.png$/i.test(imagePath)) return "epic";
    if (/cratePfp\/Shark22\.png$/i.test(imagePath)) return "legendary";
    if (/cratePfp/i.test(imagePath)) return "rare";
    if (/images\/pfp\//i.test(imagePath)) return "core";
    return "common";
}

function getPfpRarityLabel(rarity) {
    return ({
        core: "Starter",
        common: "Common",
        rare: "Rare",
        epic: "Epic",
        legendary: "Legendary",
        special: "Special"
    })[rarity] || "Common";
}

function getPfpCategoryLabel(category) {
    return ({
        starter: "Starter",
        pass: "Shark Pass",
        reward: "Reward",
        crate: "Crate"
    })[category] || "Portrait";
}

function getCosmeticSourceLabel(cosmetic = {}) {
    if (cosmetic.source) return cosmetic.source;
    if (isLeaderRewardPfp(cosmetic) || cosmetic.name === "Port Jackson Shark") return "All-time leaderboard top 3";
    if (/leaderPfp\/Daily/i.test(cosmetic.imagePath || "")) return "Daily leaderboard #1";
    if (/leaderPfp\/Monthly/i.test(cosmetic.imagePath || "")) return "Monthly leaderboard #1";
    if (/codePfp/i.test(cosmetic.imagePath || "")) return "Redeem code reward";
    if (/loginPfp/i.test(cosmetic.imagePath || "")) return "Day 7 login reward";
    if ((cosmetic.imagePath || "") === SPIN_WHEEL_LEGENDARY_PFP.imagePath || cosmetic.spinReward) return "Daily prize wheel";
    if (/cratePfp/i.test(cosmetic.imagePath || "")) return "Cosmetic crate";
    if (cosmetic.level) return `Shark Pass level ${cosmetic.level}`;
    return "Special reward";
}

function isCosmeticUnlocked(earnedCosmetics, imagePath, name) {
    return earnedCosmetics.some(cosmetic =>
        (imagePath && cosmetic?.imagePath === imagePath) ||
        (name && cosmetic?.name === name)
    );
}

function buildProfilePicPickerCatalog() {
    const profileData = getCurrentProfileData();
    const earnedCosmetics = Array.isArray(profileData.earnedCosmetics) ? profileData.earnedCosmetics : [];
    const totalXP = profileData.totalXP !== undefined
        ? profileData.totalXP
        : parseInt(localStorage.getItem("totalXP"), 10) || parseInt(localStorage.getItem("totalGuesses"), 10) || 0;
    const userLevel = getLevelFromXP(totalXP);
    const catalog = [];
    const seen = new Set();

    function addEntry(entry) {
        if (!entry?.imagePath || seen.has(entry.imagePath)) return;
        seen.add(entry.imagePath);
        catalog.push({
            imagePath: entry.imagePath,
            name: entry.name || "Shark",
            category: entry.category || "reward",
            source: entry.source || getCosmeticSourceLabel(entry),
            unlocked: entry.unlocked !== false,
            levelRequired: entry.levelRequired || null,
            rarity: entry.rarity || inferPfpRarityFromPath(entry.imagePath),
            isLeader: Boolean(entry.isLeader)
        });
    }

    STARTER_PROFILE_PFPS.forEach(pfp => {
        addEntry({
            imagePath: `images/pfp/${pfp.filename}`,
            name: pfp.name,
            category: "starter",
            source: "Starter shark",
            unlocked: true,
            rarity: "core"
        });
    });

    sharkPassRewards
        .filter(reward => reward.type === "pfp")
        .forEach(reward => {
            addEntry({
                imagePath: reward.imagePath,
                name: reward.name,
                category: "pass",
                source: `Shark Pass level ${reward.level}`,
                unlocked: userLevel >= reward.level || isCosmeticUnlocked(earnedCosmetics, reward.imagePath, reward.name),
                levelRequired: reward.level,
                rarity: reward.rarity || inferPfpRarityFromPath(reward.imagePath)
            });
        });

    levelRewards.forEach(reward => {
        addEntry({
            imagePath: reward.imagePath,
            name: reward.name,
            category: "pass",
            source: `Shark Pass level ${reward.level}`,
            unlocked: userLevel >= reward.level || isCosmeticUnlocked(earnedCosmetics, reward.imagePath, reward.name),
            levelRequired: reward.level,
            rarity: inferPfpRarityFromPath(reward.imagePath)
        });
    });

    const specialRewardDefs = [
        { imagePath: "images/codePfp/Shark17.png", name: "Wobbegong Shark", source: "Redeem code reward" },
        { imagePath: "images/codePfp/Shark18.png", name: "Greenland Shark", source: "Redeem code reward" },
        { imagePath: "images/codePfp/Shark19.png", name: "Goblin Shark", source: "Redeem code reward" },
        { imagePath: "images/codePfp/Shark26.png", name: "Hammerhead Shark", source: "Anniversary code reward" },
        { imagePath: "images/codePfp/MantaRay.png", name: "Manta Ray", source: "TikTok 2026 code reward" },
        { imagePath: "images/codePfp/WhitespottedEagleRay.png", name: "Whitespotted Eagle Ray", source: "Instagram 2026 code reward" },
        { imagePath: "images/leaderPfp/Daily/Shark1.png", name: "Catshark", source: "Daily leaderboard #1" },
        { imagePath: "images/leaderPfp/Monthly/Shark1.png", name: "Whitetip Reef Shark", source: "Monthly leaderboard #1" },
        { imagePath: "images/leaderPfp/Shark19.png", name: "Port Jackson Shark", source: "All-time leaderboard top 3", isLeader: true },
        { imagePath: SPIN_WHEEL_LEGENDARY_PFP.imagePath, name: "Wheel Shark", source: "Daily prize wheel" },
        { imagePath: "images/loginPfp/Shark20.png", name: "Bull Shark", source: "Day 7 login reward" }
    ];

    specialRewardDefs.forEach(def => {
        if (!isCosmeticUnlocked(earnedCosmetics, def.imagePath, def.name)) return;
        addEntry({
            ...def,
            category: "reward",
            unlocked: true,
            rarity: inferPfpRarityFromPath(def.imagePath)
        });
    });

    getAllCrateRewardPools()
        .flat()
        .filter(reward => reward.type === "pfp")
        .forEach(reward => {
            if (!isCosmeticUnlocked(earnedCosmetics, reward.imagePath, reward.name)) return;
            addEntry({
                imagePath: reward.imagePath,
                name: reward.name,
                category: "crate",
                source: `${reward.name.includes("Summer") || reward.imagePath.includes("SummerPfp") ? "Summer" : reward.imagePath.includes("ChristmasPfp") ? "Christmas" : reward.imagePath.includes("HalloweenPfp") ? "Halloween" : "Cosmetic"} crate`,
                unlocked: true,
                rarity: reward.rarity || inferPfpRarityFromPath(reward.imagePath)
            });
        });

    earnedCosmetics.forEach(cosmetic => {
        if (!cosmetic?.imagePath || seen.has(cosmetic.imagePath) || /^images\/pfp\//i.test(cosmetic.imagePath)) {
            return;
        }
        const category = /cratePfp/i.test(cosmetic.imagePath) ? "crate" : "reward";
        addEntry({
            imagePath: cosmetic.imagePath,
            name: getCosmeticDisplayName(cosmetic) || cosmetic.name || "Shark",
            category,
            source: getCosmeticSourceLabel(cosmetic),
            unlocked: true,
            levelRequired: cosmetic.level || null,
            rarity: inferPfpRarityFromPath(cosmetic.imagePath),
            isLeader: isLeaderRewardPfp(cosmetic) || cosmetic.name === "Port Jackson Shark"
        });
    });

    return catalog.sort((a, b) => {
        if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
        const rarityDiff = PFP_RARITY_ORDER.indexOf(a.rarity) - PFP_RARITY_ORDER.indexOf(b.rarity);
        if (rarityDiff !== 0) return rarityDiff;
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.name.localeCompare(b.name);
    });
}

function getEquippedProfilePicturePath() {
    const profileData = getCurrentProfileData();
    return profileData.profilePicture || profileData.profilePic || "images/pfp/shark1.png";
}

function findProfilePicCatalogEntry(catalog, imagePath) {
    return catalog.find(entry => entry.imagePath === imagePath) || null;
}

function updateProfilePicPickerPreview(imagePath = getEquippedProfilePicturePath()) {
    const previewImg = document.getElementById("pfp-picker-preview-img");
    const previewName = document.getElementById("pfp-picker-preview-name");
    const previewSource = document.getElementById("pfp-picker-preview-source");
    const previewCrown = document.getElementById("pfp-picker-preview-crown");
    if (!previewImg || !previewName || !previewSource) return;

    const catalog = buildProfilePicPickerCatalog();
    const entry = findProfilePicCatalogEntry(catalog, imagePath);
    previewImg.src = imagePath;
    previewName.textContent = entry?.name || "Shark";
    previewSource.textContent = entry?.source || "Profile portrait";
    if (previewCrown) {
        previewCrown.classList.toggle("hidden", !entry?.isLeader);
    }
}

function bindProfilePicPickerControls() {
    if (pfpPickerControlsBound) return;
    pfpPickerControlsBound = true;

    const searchInput = document.getElementById("pfp-picker-search");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            pfpPickerSearchQuery = searchInput.value.trim().toLowerCase();
            renderProfilePicPicker();
        });
    }

    const tabs = document.getElementById("pfp-picker-tabs");
    if (tabs) {
        tabs.addEventListener("click", event => {
            const button = event.target.closest("[data-pfp-filter]");
            if (!button) return;
            pfpPickerFilter = button.dataset.pfpFilter || "all";
            tabs.querySelectorAll(".picker-modal-tab").forEach(tab => {
                const isActive = tab === button;
                tab.classList.toggle("active", isActive);
                tab.setAttribute("aria-selected", isActive ? "true" : "false");
            });
            renderProfilePicPicker();
        });
    }
}

function renderProfilePicPicker() {
    const grid = document.getElementById("pfp-picker-grid");
    if (!grid) return;

    bindProfilePicPickerControls();

    const catalog = buildProfilePicPickerCatalog();
    const equippedPath = getEquippedProfilePicturePath();
    const filtered = catalog.filter(entry => {
        const matchesFilter = pfpPickerFilter === "all" || entry.category === pfpPickerFilter;
        const matchesSearch = !pfpPickerSearchQuery ||
            entry.name.toLowerCase().includes(pfpPickerSearchQuery) ||
            entry.source.toLowerCase().includes(pfpPickerSearchQuery);
        return matchesFilter && matchesSearch;
    });

    const unlockedCount = catalog.filter(entry => entry.unlocked).length;
    const countEl = document.getElementById("pfp-picker-count");
    const unlockedEl = document.getElementById("pfp-picker-unlocked-count");
    const emptyEl = document.getElementById("pfp-picker-empty");
    if (countEl) countEl.textContent = `${filtered.length} shown`;
    if (unlockedEl) unlockedEl.textContent = `${unlockedCount} unlocked`;
    if (emptyEl) emptyEl.classList.toggle("hidden", filtered.length > 0);

    updateProfilePicPickerPreview(equippedPath);
    grid.innerHTML = "";

    filtered.forEach(entry => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = `pfp-option rarity-${entry.rarity}${entry.unlocked ? "" : " pfp-option-locked"}`;
        if (entry.imagePath === equippedPath) card.classList.add("active");
        card.title = entry.unlocked
            ? `${entry.name} — ${entry.source}`
            : `Unlock at Shark Pass level ${entry.levelRequired}`;

        card.innerHTML = `
            <span class="pfp-option-kicker">${getPfpCategoryLabel(entry.category)}</span>
            <span class="pfp-option-frame rarity-${entry.rarity}${entry.isLeader ? " is-leader" : ""}">
                ${entry.isLeader ? '<span class="pfp-option-crown">👑</span>' : ""}
                <img src="${entry.imagePath}" alt="${entry.name}" loading="lazy" onerror="this.onerror=null;this.src='images/pfp/shark1.png';">
                ${entry.unlocked ? "" : '<span class="pfp-option-lock" aria-hidden="true">🔒</span>'}
            </span>
            <span class="pfp-option-name">${entry.name}</span>
            <span class="pfp-option-rarity rarity-${entry.rarity}">${entry.unlocked ? getPfpRarityLabel(entry.rarity) : `Lv. ${entry.levelRequired}`}</span>
        `;

        card.addEventListener("click", () => {
            if (!entry.unlocked) {
                showNotification(`Reach Shark Pass level ${entry.levelRequired} to unlock ${entry.name}.`, "info", 3200);
                return;
            }
            setProfilePicture(entry.imagePath);
        });

        grid.appendChild(card);
    });
}

const LEADER_REWARD_PFP_NAMES = {
    "images/leaderPfp/Daily/Shark1.png": "Catshark",
    "images/leaderPfp/Monthly/Shark1.png": "Whitetip Reef Shark",
    "images/leaderPfp/Shark19.png": "Port Jackson Shark",
    [SPIN_WHEEL_LEGENDARY_PFP.imagePath]: "Wheel Shark"
};

function getCosmeticDisplayName(cosmetic) {
    if (!cosmetic) return "";
    return LEADER_REWARD_PFP_NAMES[cosmetic.imagePath] || cosmetic.name || "";
}

function isLeaderRewardPfp(cosmetic) {
    return /leaderPfp/i.test(cosmetic?.imagePath || "");
}

function loadAvailablePFPs() {
    renderProfilePicPicker();
}

async function loadEarnedCosmetics() {
    if (!currentUser) return;

    try {
        // first, try to fetch the unlockedPfps array directly from userStats
        let unlocked = [];
        let specialCosmetics = [];
        const statsDoc = await db.collection('userStats').doc(currentUser.uid).get();
        if (statsDoc.exists && Array.isArray(statsDoc.data().unlockedPfps)) {
            unlocked = statsDoc.data().unlockedPfps.slice(); // copy
        }
        if (statsDoc.exists && Array.isArray(statsDoc.data().earnedCosmetics)) {
            specialCosmetics = statsDoc.data().earnedCosmetics.filter(cos =>
                !levelRewards.some(reward => reward.name === cos.name)
            );
        }

        // make sure every item has an imagePath; fall back to global levelRewards
        unlocked = unlocked.map(entry => {
            if (!entry.imagePath) {
                const match = levelRewards.find(r => r.level === entry.level || r.name === entry.name);
                if (match) {
                    entry.imagePath = match.imagePath;
                }
            }
            return entry;
        });

        // fallback: if nothing stored yet, compute by level so that offline users still see something
        if (unlocked.length === 0) {
            const profileData = getCurrentProfileData();
            const totalXP = profileData.totalXP !== undefined ? profileData.totalXP : parseInt(localStorage.getItem("totalXP")) || (profileData.totalGuesses || 0);
            const userLevel = getLevelFromXP(totalXP);

            unlocked = levelRewards
                .filter(r => r.level <= userLevel)
                .map(r => ({ level: r.level, name: r.name, imagePath: r.imagePath }));
        }

        const localProfile = getCurrentProfileData();
        if (Array.isArray(localProfile.earnedCosmetics)) {
            localProfile.earnedCosmetics.forEach(cosmetic => {
                const isSpecial = !levelRewards.some(reward => reward.name === cosmetic.name);
                if (isSpecial && !specialCosmetics.some(existing => existing.name === cosmetic.name || existing.imagePath === cosmetic.imagePath)) {
                    specialCosmetics.push(cosmetic);
                }
            });
        }

        const mergedUnlocked = [...unlocked];
        specialCosmetics.forEach(cosmetic => {
            if (!mergedUnlocked.some(existing => existing.name === cosmetic.name || existing.imagePath === cosmetic.imagePath)) {
                mergedUnlocked.push(cosmetic);
            }
        });

        // save locally so other parts of the app can use it
        const profileData = getCurrentProfileData();
        profileData.earnedCosmetics = mergedUnlocked;
        saveUserProfileLocally(profileData, { skipRemoteSync: true });

        if (document.getElementById("pfp-picker-grid")) {
            renderProfilePicPicker();
        }
    } catch (error) {
        console.error("Error loading earned cosmetics:", error);
    }
}


// Save stats to Firebase when they update
async function syncEarnedCosmetics() {
    if (!currentUser) return;

    try {
        const totalXP = parseInt(localStorage.getItem("totalXP")) || parseInt(localStorage.getItem("totalGuesses")) || 0;
        const userLevel = getLevelFromXP(totalXP);

        // Get level-based cosmetics
        const levelCosmetics = levelRewards.filter(reward => reward.level <= userLevel);

        // Get existing special cosmetics from Firebase/localStorage
        let specialCosmetics = [];
        const profileData = getCurrentProfileData();
        const existingEarnedCosmetics = Array.isArray(profileData.earnedCosmetics) ? profileData.earnedCosmetics : [];
        if (Array.isArray(profileData.earnedCosmetics)) {
            specialCosmetics = profileData.earnedCosmetics.filter(cos => !levelRewards.some(lr => lr.name === cos.name));
        }

        const newlyUnlockedLevelCosmetics = levelCosmetics.filter(reward =>
            !existingEarnedCosmetics.some(existing => existing.name === reward.name || existing.imagePath === reward.imagePath)
        );

        // Merge level and special cosmetics, avoiding duplicates
        const earnedCosmetics = [...levelCosmetics];
        specialCosmetics.forEach(special => {
            if (!earnedCosmetics.some(ec => ec.name === special.name)) {
                earnedCosmetics.push(special);
            }
        });

        // Update Firebase with merged cosmetics
        const statsRef = db.collection("userStats").doc(currentUser.uid);
        await statsRef.set({ earnedCosmetics: earnedCosmetics }, { merge: true });

        profileData.earnedCosmetics = earnedCosmetics;
        saveUserProfileLocally(profileData);

        // Reload earned cosmetics display if modal is open
        loadEarnedCosmetics();

        newlyUnlockedLevelCosmetics.forEach(cosmetic => {
            showCosmeticUnlockToast(cosmetic, {
                title: "Shark Pass Reward Unlocked!",
                subtitle: `${cosmetic.name} profile picture`,
                accent: "#61e7ff",
                background: "linear-gradient(135deg, rgba(0, 180, 216, 0.96), rgba(9, 49, 74, 0.96))",
                icon: "🦈"
            });
        });
    } catch (error) {
        console.error("Error syncing earned cosmetics:", error);
    }
}

// Save stats to Firebase when they update
async function syncStatsToFirebase() {
    const authUser = firebase.auth().currentUser;
    if (!authUser) return;
    if (!currentUser || currentUser.uid !== authUser.uid) {
        console.warn("Skipping sync: auth state mismatch during account transition.");
        scheduleRemoteProfileSync(800);
        return;
    }
    if (lastServerHydratedProfileUid !== authUser.uid) {
        console.warn("Skipping sync: waiting for server profile hydration.");
        loadCloudStats().catch(error => console.warn("Hydration retry failed:", error));
        scheduleRemoteProfileSync(1200);
        return;
    }

    // Prevent race condition: queue sync if one is already in progress
    if (isSyncing) {
        console.log('Sync already in progress, queueing...');
        syncQueue.push(() => syncStatsToFirebase());
        return;
    }

    isSyncing = true;
    try {
        const profileData = getBestLocalProfile();

        const statsRef = db.collection("userStats").doc(authUser.uid);
        const { snapshot: remoteSnap, fromServer } = await getUserStatsSnapshot(statsRef);
        const remoteData = remoteSnap.exists ? (remoteSnap.data() || {}) : {};
        const remoteHasData = remoteSnap.exists && Object.keys(remoteData).length > 0;

        // Server reads can occasionally fall back to cache. Continue syncing with
        // merge-safe logic so leaderboard period counters still update after wins.
        if (!fromServer) {
            console.warn("Proceeding with cache-backed userStats snapshot during sync.");
        }

        // If remote appears empty, only allow sync when local has meaningful numeric progress.
        // This prevents identity-only local profiles from pushing zeroed stats.
        if (!remoteHasData && !hasMeaningfulProfileData(profileData) && !hasPersistedProfileIdentity(profileData)) {
            console.warn("Skipping sync: remote profile empty and local profile has no meaningful stats.");
            scheduleRemoteProfileSync(3000);
            return;
        }

        // Never let a fresh/blank local cache clobber a real Firestore profile.
        if (!hasMeaningfulProfileData(profileData) && hasRecoverableRemoteProfile(remoteData)) {
            const recoveredProfile = mergeProfilesSafely(profileData, remoteData);
            storeLoginProgressLocally(recoveredProfile, authUser.uid);
            saveUserProfileLocally(recoveredProfile, { skipRemoteSync: true, preserveLastUpdated: true });
            updateProfileDisplay(recoveredProfile);
            updateIndexStats();
            return;
        }

        // Don't sync if localStorage has no real stats and Firestore is also empty.
        if (!hasMeaningfulProfileData(profileData) && !hasPersistedProfileIdentity(profileData)) {
            console.log("Skipping sync: no meaningful local profile data");
            return;
        }

        const mergedProfile = mergeProfilesSafely(profileData, remoteData);
        const mergedClaimedAchievements = getMergedUniqueIds(
            JSON.parse(localStorage.getItem("claimedAchievements") || "[]"),
            remoteData.claimedAchievements
        );
        const mergedUnlockedAchievements = getMergedUniqueIds(
            JSON.parse(localStorage.getItem("unlockedAchievements") || "[]"),
            remoteData.unlockedAchievements
        );
        const mergedLoginProgress = mergeLoginProgress(getLoginProgressFromLocalStorage(authUser.uid), remoteData);
        storeLoginProgressLocally(mergedLoginProgress, authUser.uid);
        
        // base stats
        const stats = {
            uid: authUser.uid,
            email: authUser.email,
            avatar: mergedProfile.avatar || "🦈",
            totalXP: mergedProfile.totalXP || 0,
            // keep totalGuesses for backwards compatibility/analytics
            totalGuesses: mergedProfile.totalGuesses || 0,
            gamesPlayed: mergedProfile.gamesPlayed || 0,
            wins: mergedProfile.wins || 0,
            losses: mergedProfile.losses || 0,
            averageGuesses: mergedProfile.averageGuesses || 0,
            bestGame: mergedProfile.bestGame || 0,
            currentStreak: mergedProfile.currentStreak || 0,
            highestStreak: mergedProfile.highestStreak || 0,
            duelGames: mergedProfile.duelGames || 0,
            duelWins: mergedProfile.duelWins || 0,
            cratesOpened: mergedProfile.cratesOpened || 0,
            cratesSinceLegendary: getCratesSinceLegendary(mergedProfile),
            streakShields: getStreakShieldCount(mergedProfile),
            instantCrateOpen: getCrateInstantOpenEnabled(mergedProfile),
            pearls: getPearlCount(mergedProfile),
            pearlBoostExpiresAt: getPearlBoostExpiresAt(mergedProfile),
            seasonXpBoosts: getSeasonXpBoosts(mergedProfile),
            username: mergedProfile.username || getStoredPreferredUsername() || authUser.email.split("@")[0],
            profilePic: mergedProfile.profilePicture || "images/pfp/shark1.png",
            profilePicture: mergedProfile.profilePicture || "images/pfp/shark1.png",
            earnedCosmetics: Array.isArray(mergedProfile.earnedCosmetics) ? mergedProfile.earnedCosmetics : [],
            testerBadgeUnlocked: Boolean(mergedProfile.testerBadgeUnlocked),
            unlockedTitles: getUnlockedProfileTitleIds(mergedProfile),
            equippedTitle: getEquippedProfileTitle(mergedProfile),
            communityBossRewards: mergedProfile.communityBossRewards && typeof mergedProfile.communityBossRewards === "object"
                ? mergedProfile.communityBossRewards
                : {},
            sharkPassMissionClaims: mergedProfile.sharkPassMissionClaims && typeof mergedProfile.sharkPassMissionClaims === "object"
                ? mergedProfile.sharkPassMissionClaims
                : {},
            sharkPassSeasonBaselines: mergedProfile.sharkPassSeasonBaselines && typeof mergedProfile.sharkPassSeasonBaselines === "object"
                ? mergedProfile.sharkPassSeasonBaselines
                : {},
            sharkPassLevelRewardClaims: Array.isArray(mergedProfile.sharkPassLevelRewardClaims)
                ? mergedProfile.sharkPassLevelRewardClaims
                : [],
            sharkPassSeasonId: mergedProfile.sharkPassSeasonId || SHARK_PASS_ACTIVE_SEASON_ID,
            crateInventory: normalizeCrateInventory(mergedProfile.crateInventory),
            lastUpdated: new Date()
        };

        const currentWins = Number(mergedProfile.wins) || 0;
        const remoteWinsParsed = Number(remoteData.wins);
        const hasReliableRemoteWins = Number.isFinite(remoteWinsParsed);
        const remoteWins = hasReliableRemoteWins ? remoteWinsParsed : currentWins;
        const winsDelta = Math.max(0, currentWins - remoteWins);
        const todayKey = getUtcDateKey();
        const monthKey = getUtcMonthKey();
        const remoteDailyWinsDate = normalizeStoredUtcDateValue(remoteData.dailyWinsUtcDate || remoteData.dailyWinsDate);
        const remoteMonthlyWinsKey = normalizeStoredUtcMonthValue(remoteData.monthlyWinsUtcKey || remoteData.monthlyWinsKey);
        const remoteDailyWins = Number(remoteData.dailyWins) || 0;
        const remoteMonthlyWins = Number(remoteData.monthlyWins) || 0;
        const localDailyWinsDate = normalizeStoredUtcDateValue(profileData.dailyWinsUtcDate || profileData.dailyWinsDate);
        const localMonthlyWinsKey = normalizeStoredUtcMonthValue(profileData.monthlyWinsUtcKey || profileData.monthlyWinsKey);
        const localDailyWins = Number(profileData.dailyWins) || 0;
        const localMonthlyWins = Number(profileData.monthlyWins) || 0;

        const remoteDailyBaseWins = remoteDailyWinsDate === todayKey ? remoteDailyWins : 0;
        const remoteMonthlyBaseWins = remoteMonthlyWinsKey === monthKey ? remoteMonthlyWins : 0;
        const localDailyBaseWins = localDailyWinsDate === todayKey ? localDailyWins : 0;
        const localMonthlyBaseWins = localMonthlyWinsKey === monthKey ? localMonthlyWins : 0;

        const computedDailyFromDelta = remoteDailyBaseWins + winsDelta;
        const computedMonthlyFromDelta = remoteMonthlyBaseWins + winsDelta;

        let nextDailyWins = Math.max(remoteDailyBaseWins, localDailyBaseWins, computedDailyFromDelta);
        let nextMonthlyWins = Math.max(remoteMonthlyBaseWins, localMonthlyBaseWins, computedMonthlyFromDelta);
        if (!Number.isFinite(nextDailyWins) || nextDailyWins < 0) nextDailyWins = 0;
        if (!Number.isFinite(nextMonthlyWins) || nextMonthlyWins < 0) nextMonthlyWins = 0;
        if (nextDailyWins > currentWins) nextDailyWins = currentWins;
        if (nextMonthlyWins > currentWins) nextMonthlyWins = currentWins;

        stats.dailyWins = nextDailyWins;
        stats.dailyWinsDate = todayKey;
        stats.dailyWinsUtcDate = todayKey;
        stats.monthlyWins = nextMonthlyWins;
        stats.monthlyWinsKey = monthKey;
        stats.monthlyWinsUtcKey = monthKey;
        stats.winPeriodVersion = 2;

        Object.assign(stats, buildCosmeticSyncPayload(mergedProfile));
        
        // shark pass related values
        const totalXP = mergedProfile.totalXP || 0;
        const currentLevel = getLevelFromXP(totalXP);
        const currentXP = getXPInCurrentLevel(totalXP);
        const xpToNextLevel = getXPToNextLevel(totalXP);
        const unlockedPfps = levelRewards
            .filter(r => r.level <= currentLevel)
            .map(r => ({ level: r.level, name: r.name || r.imagePath }));

        // attach them to stats object so firestore has dedicated fields
        stats.currentLevel = currentLevel;
        stats.currentXP = currentXP;
        stats.xpToNextLevel = xpToNextLevel;
        stats.unlockedPfps = unlockedPfps;

        // Sync achievements to Firebase
        stats.claimedAchievements = mergedClaimedAchievements;
        stats.unlockedAchievements = mergedUnlockedAchievements;
        stats.redeemedCodes = getRedeemedCodes();
        stats.loginStreak = mergedLoginProgress.loginStreak;
        stats.currentLoginDay = mergedLoginProgress.currentLoginDay;
        const normalizedLastLoginDate = mergedLoginProgress.lastLoginDate;
        if (normalizedLastLoginDate) {
            localStorage.setItem("lastLoginDate", normalizedLastLoginDate);
        } else {
            localStorage.removeItem("lastLoginDate");
        }
        stats.lastLoginDate = normalizedLastLoginDate;
        const normalizedModalShownDate = mergedLoginProgress.dailyLoginModalShownToday;
        if (normalizedModalShownDate) {
            localStorage.setItem(getDailyLoginModalShownStorageKey(), normalizedModalShownDate);
        } else {
            localStorage.removeItem(getDailyLoginModalShownStorageKey());
        }
        stats.dailyLoginModalShownToday = normalizedModalShownDate;
        stats.lastSpinWheelDate = normalizeStoredDateValue(mergedProfile.lastSpinWheelDate);

        // Save stats to userStats collection
        await statsRef.set(stats, { merge: true });
        
        Object.assign(mergedProfile, stats);
        saveUserProfileLocally(mergedProfile, { skipRemoteSync: true });
        localStorage.setItem("claimedAchievements", JSON.stringify(mergedClaimedAchievements));
        localStorage.setItem("unlockedAchievements", JSON.stringify(mergedUnlockedAchievements));
                // Update navbar profile pic if it exists
        const navProfilePic = document.getElementById("nav-profile-pic");
        if (navProfilePic) navProfilePic.src = mergedProfile.profilePicture;
                // Update display if profile modal is open
        if (document.getElementById("profile-xp")) {
            updateProfileDisplay(mergedProfile);
        }

        // Update the main page stats display after syncing
        updateIndexStats();
    } catch (error) {
        console.error("Error syncing stats:", error);
        if (!navigator.onLine) {
            console.log('Sync failed: offline');
        } else {
            showNotification('Failed to sync stats - will retry', 'error');
        }
    } finally {
        isSyncing = false;
        // Process queued syncs
        if (syncQueue.length > 0) {
            const nextSync = syncQueue.shift();
            nextSync();
        }
    }
}

async function syncAllFirestoreData() {
    const syncButton = document.getElementById("sync-data-button");
    if (syncButton) syncButton.disabled = true;

    try {
        const authUser = firebase.auth().currentUser;
        if (!authUser) {
            showNotification('Please login first to sync your profile.', 'error', 4000);
            return;
        }

        showNotification('Syncing profile data with Firebase...', 'info', 3000);
        await loadUserProfile();
        await syncStatsToFirebase();
        showNotification('Your profile data is now synced with Firebase.', 'success', 4500);
    } catch (error) {
        console.error('Error syncing data:', error);
        showNotification('Could not sync profile data. Please try again later.', 'error', 5000);
    } finally {
        if (syncButton) syncButton.disabled = false;
    }
}

// Navigation
function navigate(page){
    window.location.href = typeof resolveAppPath === "function" ? resolveAppPath(page) : page;
}

// ===== DAILY LOGIN & XP SYSTEM =====

// Daily login rewards - 7 day cycle
const DAY_7_LOGIN_PFP = {
    name: "Bull Shark",
    imagePath: "images/loginPfp/Shark20.png",
    loginReward: true,
    day: 7,
    rarity: "rare"
};

const dailyRewards = [
    { day: 1, xp: 50, emoji: '1️⃣' },
    { day: 2, xp: 60, emoji: '2️⃣' },
    { day: 3, xp: 70, emoji: '3️⃣' },
    { day: 4, xp: 80, emoji: '4️⃣' },
    { day: 5, xp: 90, emoji: '5️⃣' },
    { day: 6, xp: 100, emoji: '6️⃣' },
    { day: 7, xp: 500, emoji: '🏆', isBig: true, cosmetics: [DAY_7_LOGIN_PFP] }
];

async function ensureLoginStreakRewards() {
    if (!currentUser) return false;

    const currentLoginDay = parseInt(localStorage.getItem("currentLoginDay")) || 0;
    const loginStreak = parseInt(localStorage.getItem("loginStreak")) || 0;
    if (currentLoginDay < 7 && loginStreak < 7) return false;

    const profileData = typeof getCurrentProfileData === "function"
        ? getCurrentProfileData()
        : JSON.parse(localStorage.getItem("userProfile") || "{}");
    const earnedCosmetics = Array.isArray(profileData.earnedCosmetics) ? [...profileData.earnedCosmetics] : [];
    const alreadyUnlocked = earnedCosmetics.some(cosmetic =>
        cosmetic?.name === DAY_7_LOGIN_PFP.name || cosmetic?.imagePath === DAY_7_LOGIN_PFP.imagePath
    );

    if (alreadyUnlocked) return false;

    earnedCosmetics.push({ ...DAY_7_LOGIN_PFP });
    profileData.earnedCosmetics = earnedCosmetics;

    if (typeof saveUserProfileLocally === "function") {
        saveUserProfileLocally(profileData, { skipRemoteSync: true });
    } else {
        saveUserProfileLocally(profileData, { skipRemoteSync: true });
    }

    try {
        await db.collection("userStats").doc(currentUser.uid).set({
            earnedCosmetics: earnedCosmetics
        }, { merge: true });
    } catch (error) {
        console.warn("Unable to sync day 7 login reward:", error);
    }

    if (document.getElementById("pfp-picker-grid")) {
        loadEarnedCosmetics();
    }

    showCosmeticUnlockToast(DAY_7_LOGIN_PFP, {
        title: "Login Reward Unlocked!",
        subtitle: `${DAY_7_LOGIN_PFP.name} profile picture`,
        accent: "#ffd700",
        background: "linear-gradient(135deg, rgba(255, 215, 0, 0.96), rgba(112, 83, 0, 0.96))",
        icon: "🏆"
    });

    return true;
}

async function initializeDailyLogin() {
    if (!currentUser) return;

    const today = getLocalDateKey();
    const storedLastLoginDate = localStorage.getItem("lastLoginDate");
    const lastLoginDate = normalizeStoredDateValue(storedLastLoginDate);
    const dailyLoginModalShownStorageKey = getDailyLoginModalShownStorageKey();
    const storedModalShownDate = getStoredDailyLoginModalShownDate();
    const normalizedModalShownDate = normalizeStoredDateValue(storedModalShownDate);
    const dailyLoginModalShownToday = normalizedModalShownDate === today;
    const currentLoginDay = parseInt(localStorage.getItem("currentLoginDay")) || 1;
    const totalXP = parseInt(localStorage.getItem("totalXP")) || 0;

    if (storedLastLoginDate && lastLoginDate && storedLastLoginDate !== lastLoginDate) {
        localStorage.setItem("lastLoginDate", lastLoginDate);
    }
    if (storedModalShownDate && normalizedModalShownDate && storedModalShownDate !== normalizedModalShownDate) {
        localStorage.setItem(dailyLoginModalShownStorageKey, normalizedModalShownDate);
    }

    // Check if user has already logged in today
    if (lastLoginDate !== today) {
        // Calculate next day (keeps incrementing)
        let nextDay = currentLoginDay;
        let streak = 1;
        
        if (lastLoginDate) {
            const daysDiff = getCalendarDayDifference(lastLoginDate, today);
            
            if (daysDiff === 1) {
                // User logged in yesterday, advance the day
                nextDay = currentLoginDay + 1;
                streak = (parseInt(localStorage.getItem("loginStreak")) || 1) + 1;
            } else if (daysDiff > 1) {
                // User missed days, reset to day 1
                nextDay = 1;
                streak = 1;
            } else if (!Number.isFinite(daysDiff)) {
                // Recover from legacy/invalid date formats without wiping streak progress.
                nextDay = currentLoginDay + 1;
                streak = (parseInt(localStorage.getItem("loginStreak")) || 1) + 1;
            } else {
                // Same day/future date edge cases should keep existing streak.
                streak = parseInt(localStorage.getItem("loginStreak")) || 1;
            }
        } else if (storedLastLoginDate) {
            // We had legacy unparseable data - preserve momentum once and rewrite in normalized format.
            nextDay = currentLoginDay + 1;
            streak = (parseInt(localStorage.getItem("loginStreak")) || 1) + 1;
        }

        // Get reward for this day using modulo to cycle through 7-day rewards
        const rewardIndex = (nextDay - 1) % 7;
        const reward = dailyRewards[rewardIndex];
        const xpAward = typeof window.applyLimitedTimeXpBonus === "function"
            ? window.applyLimitedTimeXpBonus(reward.xp)
            : { totalXp: reward.xp };
        const xpGain = xpAward.totalXp;
        const profileData = getCurrentProfileData();
        const currentProfileXp = Number(profileData.totalXP) || 0;
        const currentStoredXp = Number(totalXP) || 0;
        const nextTotalXp = Math.max(currentProfileXp, currentStoredXp) + xpGain;

        profileData.totalXP = nextTotalXp;
        profileData.loginStreak = streak;
        profileData.currentLoginDay = nextDay;
        profileData.lastLoginDate = today;
        profileData.dailyLoginModalShownToday = today;
        if (currentUser?.uid) {
            profileData.uid = currentUser.uid;
        }
        saveUserProfileLocally(profileData, { skipRemoteSync: true });

        // Update localStorage
        localStorage.setItem("lastLoginDate", today);
        localStorage.setItem("currentLoginDay", nextDay);
        localStorage.setItem("loginStreak", streak);
        localStorage.setItem("totalXP", nextTotalXp);
        localStorage.setItem(dailyLoginModalShownStorageKey, today);

        // Sync login streak data to Firebase
        if (currentUser) {
            const statsRef = db.collection("userStats").doc(currentUser.uid);
            await statsRef.set({
                lastLoginDate: today,
                currentLoginDay: nextDay,
                loginStreak: streak,
                dailyLoginModalShownToday: today,
                totalXP: nextTotalXp
            }, { merge: true });
        }

        // Show daily login modal only if not already shown today
        if (!dailyLoginModalShownToday) {
            showDailyLoginModal(nextDay, xpGain);
            localStorage.setItem(dailyLoginModalShownStorageKey, today);
        }

        // if logged in, sync the updated profile immediately
        if (currentUser) {
            syncStatsToFirebase();
        }
    }

    // (No need to set dailyLoginModalShownStorageKey here, handled above)

    await ensureLoginStreakRewards();
    // If both conditions are false (already logged in today and modal already shown), do nothing
}

function showDailyLoginModal(currentDay, xpGained) {
    if (!currentUser) return;
    const modal = document.getElementById("dailyLoginModal");
    const grid = document.getElementById("daily-rewards-grid");
    const day7Container = document.getElementById("day-7-reward");
    
    if (!modal || !grid || !day7Container) return; // Element doesn't exist on this page

    grid.innerHTML = '';
    day7Container.innerHTML = '';

    // Store whether this is a new claim (xpGained > 0) for UI logic
    const isNewClaim = xpGained > 0;

    // Calculate position in current 7-day cycle
    const positionInCycle = (currentDay - 1) % 7 + 1;
    const cycleEndDay = currentDay + (7 - positionInCycle);
    const bullSharkUnlocked = (() => {
        const profileData = getCurrentProfileData();
        return Array.isArray(profileData.earnedCosmetics) && profileData.earnedCosmetics.some(cosmetic =>
            cosmetic?.name === DAY_7_LOGIN_PFP.name || cosmetic?.imagePath === DAY_7_LOGIN_PFP.imagePath
        );
    })();

    // Add days 1-6 to grid
    for (let i = 1; i <= 6; i++) {
        const reward = dailyRewards[i - 1];
        const isClaimed = i < positionInCycle || (i === positionInCycle && !isNewClaim);
        const isAvailable = i === positionInCycle && isNewClaim;
        
        const dayCard = document.createElement("div");
        dayCard.style.cssText = `
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            background: ${isAvailable ? 'rgba(0, 180, 216, 0.2)' : isClaimed ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 255, 255, 0.1)'};
            border: 2px solid ${isAvailable ? '#00b4d8' : isClaimed ? '#4caf50' : '#666'};
            cursor: ${isAvailable ? 'pointer' : 'default'};
            transition: all 0.3s ease;
        `;
        
        if (isAvailable) {
            dayCard.style.boxShadow = '0 0 15px rgba(0, 180, 216, 0.5)';
        }
        
        dayCard.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 8px;">${reward.emoji}</div>
            <div style="font-size: 14px; color: #4dd0e1; font-weight: 600;">${reward.xp} XP</div>
            <div style="font-size: 12px; color: #888; margin-top: 5px;">${isClaimed ? '✓ Claimed' : isAvailable ? 'Available Today!' : 'Locked'}</div>
        `;
        
        if (isAvailable) {
            dayCard.onclick = () => claimDailyReward(i);
        }
        
        grid.appendChild(dayCard);
    }

    const day7Reward = dailyRewards[6];
    const isDay7Claimed = 7 < positionInCycle || (7 === positionInCycle && !isNewClaim);
    const isDay7Available = 7 === positionInCycle && isNewClaim;
    const shouldShowBullReward = !bullSharkUnlocked && currentDay <= 7;
    
    const day7Card = document.createElement("div");
    day7Card.style.cssText = `
        padding: 25px;
        border-radius: 12px;
        text-align: center;
        background: ${isDay7Available ? 'linear-gradient(135deg, #ffd700, #ffed4e)' : isDay7Claimed ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 255, 255, 0.1)'};
        border: 3px solid ${isDay7Available ? '#ffd700' : isDay7Claimed ? '#4caf50' : '#666'};
        cursor: ${isDay7Available ? 'pointer' : 'default'};
        transition: all 0.3s ease;
        min-width: 150px;
    `;
    
    if (isDay7Available) {
        day7Card.style.boxShadow = '0 0 25px rgba(255, 215, 0, 0.8)';
        day7Card.style.transform = 'scale(1.05)';
    }
    
    const day7BonusMarkup = shouldShowBullReward
        ? [
            `<div style="margin: 10px 0 8px;">`,
            `<img src="${DAY_7_LOGIN_PFP.imagePath}" alt="PFP ${DAY_7_LOGIN_PFP.name}" style="width: 58px; height: 58px; border-radius: 12px; object-fit: cover; border: 2px solid ${isDay7Available ? '#001f3f' : '#ffd700'}; box-shadow: 0 6px 16px rgba(0,0,0,0.18);">`,
            `</div>`,
            `<div style="font-size: 13px; color: ${isDay7Available ? '#001f3f' : '#f5d76e'}; font-weight: 700;">+ ${DAY_7_LOGIN_PFP.name} PFP</div>`
        ].join("")
        : `<div style="font-size: 12px; color: ${isDay7Available ? '#001f3f' : '#f5d76e'}; font-weight: 700; margin-top: 8px;">Cycle reward milestone</div>`;

    day7Card.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 12px;">${day7Reward.emoji}</div>
        <div style="font-size: 15px; color: ${isDay7Available ? '#001f3f' : '#ffd700'}; font-weight: 700; margin-bottom: 8px;">Day ${cycleEndDay}</div>
        <div style="font-size: 28px; color: #001f3f; font-weight: 700;">${day7Reward.xp} XP</div>
        ${day7BonusMarkup}
        <div style="font-size: 14px; color: ${isDay7Available ? '#001f3f' : '#888'}; margin-top: 8px; font-weight: 600;">${isDay7Claimed ? '✓ Claimed' : isDay7Available ? 'MEGA REWARD!' : 'Locked'}</div>
    `;
    
    if (isDay7Available) {
        day7Card.onclick = () => claimDailyReward(7);
    }
    
    day7Container.appendChild(day7Card);
    
    modal.classList.remove("hidden");
}

function claimDailyReward(day) {
    // Just close the modal after a brief celebration
    setTimeout(() => {
        closeDailyLoginModal();
    }, 1000);
}

function openDailyLoginModal() {
    if (!currentUser) {
        openLoginModal();
        return;
    }
    const currentDay = parseInt(localStorage.getItem("currentLoginDay")) || 1;
    showDailyLoginModal(currentDay, 0);
}

function closeDailyLoginModal() {
    const modal = document.getElementById("dailyLoginModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

window.openDailyLoginModal = openDailyLoginModal;
window.closeDailyLoginModal = closeDailyLoginModal;

// Load stats and streaks
document.addEventListener("DOMContentLoaded", function() {
    initHomeV3Tabs();
    initHomeV3CratesButton();
    // Update displayed stats from localStorage
    if (document.getElementById("games")) {
        document.getElementById("games").textContent = localStorage.getItem("games") || 0;
    }
    if (document.getElementById("wins")) {
        document.getElementById("wins").textContent = localStorage.getItem("wins") || 0;
    }
    if (document.getElementById("losses")) {
        document.getElementById("losses").textContent = localStorage.getItem("losses") || 0;
    }

    // Load profile picture picker data on page load
    if (document.getElementById("pfp-picker-grid")) {
        loadEarnedCosmetics();
    }

    // If user is already logged in, refresh profile from Firebase immediately
    // This ensures cross-subdomain sync works correctly
    if (currentUser) {
        loadUserProfile().catch(err => console.log("Initial profile load skipped:", err));
    }

    if (typeof renderConsumablesPage === "function") {
        renderConsumablesPage();
    }
    if (typeof ensureConsumablesPageTimer === "function") {
        ensureConsumablesPageTimer();
    }
    ensureCommunityBossUiTimer();
    initCratesModalTabs();
    updateSeasonalCratePanels();
});

// ----- REDEEM CODE FUNCTIONS -----
async function redeemCode() {
    if (!currentUser) {
        alert("Please login first to redeem codes.");
        return;
    }

    const codeInput = document.getElementById("redeem-code-input");
    if (!codeInput) {
        showNotification("Code input is unavailable right now.", "error", 3000);
        return;
    }
    const code = codeInput.value.trim().toUpperCase();

    if (!code) {
        showRedeemMessage("Please enter a code.", false);
        return;
    }

    // Check if code exists
    if (!redeemCodes[code]) {
        showRedeemMessage("Invalid code. Please check and try again.", false);
        codeInput.value = '';
        return;
    }

    // Check if already redeemed
    if (hasRedeemedCode(code)) {
        showRedeemMessage("This code has already been redeemed.", false);
        codeInput.value = '';
        return;
    }

    try {
        // Get current user data
        const userProfile = getCurrentProfileData();
        const currentXP = userProfile.totalXP || 0;
        const codeReward = redeemCodes[code];

        // Add XP
        const rewardXp = Number(codeReward.xp) || 0;
        const xpAward = typeof window.applyLimitedTimeXpBonus === "function"
            ? window.applyLimitedTimeXpBonus(rewardXp)
            : { totalXp: rewardXp };
        const newXP = currentXP + xpAward.totalXp;
        userProfile.totalXP = newXP;

        // Add cosmetics if any
        const newlyUnlockedCosmetics = [];
        if (codeReward.cosmetics) {
            if (!userProfile.earnedCosmetics) {
                userProfile.earnedCosmetics = [];
            }
            codeReward.cosmetics.forEach(cosmetic => {
                // Check if cosmetic is not already in the list
                if (!userProfile.earnedCosmetics.some(c => c.name === cosmetic.name)) {
                    userProfile.earnedCosmetics.push(cosmetic);
                    newlyUnlockedCosmetics.push(cosmetic);
                }
            });
        }

        // Add badge if any
        if (codeReward.badge) {
            if (!Array.isArray(userProfile.unlockedBadges)) {
                userProfile.unlockedBadges = ["starter"];
            }
            if (!userProfile.unlockedBadges.includes(codeReward.badge)) {
                userProfile.unlockedBadges.push(codeReward.badge);
            }
            // Backwards compatible: keep the legacy tester flag for the tester badge.
            if (codeReward.badge === "tester") {
                userProfile.testerBadgeUnlocked = true;
            }
        }

        const grantedCrates = applyCodeCrateRewards(userProfile, codeReward.crates);

        // Save to localStorage
        saveUserProfileLocally(userProfile);

        // Sync to Firebase
        if (currentUser) {
            const statsRef = db.collection("userStats").doc(currentUser.uid);
            await statsRef.set({
                totalXP: newXP,
                earnedCosmetics: userProfile.earnedCosmetics,
                unlockedBadges: Array.isArray(userProfile.unlockedBadges) ? userProfile.unlockedBadges : ["starter"],
                testerBadgeUnlocked: userProfile.testerBadgeUnlocked === true,
                crateInventory: normalizeCrateInventory(userProfile.crateInventory)
            }, { merge: true });
        }

        // Mark code as redeemed
        addRedeemedCode(code);

        // Sync redeemed codes BEFORE refreshing UI
        if (currentUser) {
            const redeemedCodesList = getRedeemedCodes();
            const statsRef = db.collection("userStats").doc(currentUser.uid);
            const syncData = { redeemedCodes: redeemedCodesList };
            if (codeReward.badge === 'tester' && userProfile.testerBadgeUnlocked) {
                syncData.testerBadgeUnlocked = true;
            }
            // Wait for Firebase sync to complete before refreshing UI
            await statsRef.set(syncData, { merge: true });
        }

        // Show success message
        const rewardLines = [];
        if (xpAward.totalXp > 0) rewardLines.push(`${xpAward.totalXp} XP`);
        if (newlyUnlockedCosmetics.length) rewardLines.push(`${newlyUnlockedCosmetics.length} cosmetic${newlyUnlockedCosmetics.length === 1 ? "" : "s"}`);
        if (codeReward.badge) rewardLines.push(`badge unlocked`);
        grantedCrates.forEach(crate => {
            rewardLines.push(`${crate.count} ${crate.name}${crate.count === 1 ? "" : "s"}`);
        });
        const rewardSummary = rewardLines.length ? rewardLines.join(" + ") : "Rewards unlocked";
        showRedeemMessage(`✨ Success! ${rewardSummary}.`, true);
        codeInput.value = '';

        // Refresh profile and cosmetics
        loadUserProfile();
        loadEarnedCosmetics();
        loadAvailablePFPs();
        renderCratesButton();
        renderCratesModal();
        updateSeasonalCratePanels();

    } catch (error) {
        console.error("Error redeeming code:", error);
        showRedeemMessage("An error occurred. Please try again.", false);
    }
}

function showRedeemMessage(message, isSuccess) {
    const messageEl = document.getElementById("redeem-message");
    if (messageEl) {
        messageEl.textContent = message;
        messageEl.style.display = 'block';
        messageEl.style.color = isSuccess ? '#4caf50' : '#ff6b6b';
        messageEl.style.background = isSuccess ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 107, 107, 0.1)';
    }
}

function bindLockerRedeemInput() {
    const redeemInput = document.getElementById("redeem-code-input");
    if (!redeemInput || redeemInput.dataset.redeemBound === "true") return;
    redeemInput.dataset.redeemBound = "true";
    redeemInput.addEventListener("keydown", event => {
        if (event.key === "Enter") redeemCode();
    });
}

document.addEventListener("DOMContentLoaded", bindLockerRedeemInput);
bindLockerRedeemInput();

// ----- CONSOLE COMMANDS FOR STAT MANAGEMENT -----
// Usage in browser console:
// addStats({wins: 5, losses: 2, xp: 1000, gamesPlayed: 7, totalGuesses: 25})
// Or use individual commands: addWin(), addLoss(), addXP(100), etc.

async function addStats(statsObj) {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("❌ Access denied. This command is for developers only.");
        return;
    }
    if (!currentUser) {
        console.log("❌ Error: User must be logged in");
        return;
    }

    try {
        const userProfile = getCurrentProfileData();
        
        // Add to requested stats
        if (statsObj.xp) {
            userProfile.totalXP = (userProfile.totalXP || 0) + statsObj.xp;
            console.log(`✅ Added ${statsObj.xp} XP. Total: ${userProfile.totalXP}`);
        }
        if (statsObj.wins) {
            userProfile.wins = (userProfile.wins || 0) + statsObj.wins;
            console.log(`✅ Added ${statsObj.wins} wins. Total: ${userProfile.wins}`);
        }
        if (statsObj.losses) {
            userProfile.losses = (userProfile.losses || 0) + statsObj.losses;
            console.log(`✅ Added ${statsObj.losses} losses. Total: ${userProfile.losses}`);
        }
        if (statsObj.gamesPlayed) {
            userProfile.gamesPlayed = (userProfile.gamesPlayed || 0) + statsObj.gamesPlayed;
            console.log(`✅ Added ${statsObj.gamesPlayed} games. Total: ${userProfile.gamesPlayed}`);
        }
        if (statsObj.totalGuesses) {
            userProfile.totalGuesses = (userProfile.totalGuesses || 0) + statsObj.totalGuesses;
            console.log(`✅ Added ${statsObj.totalGuesses} guesses. Total: ${userProfile.totalGuesses}`);
        }
        if (statsObj.currentStreak !== undefined) {
            userProfile.currentStreak = statsObj.currentStreak;
            console.log(`✅ Set streak to ${statsObj.currentStreak}`);
        }
        if (statsObj.highestStreak) {
            userProfile.highestStreak = Math.max(userProfile.highestStreak || 0, statsObj.highestStreak);
            console.log(`✅ Highest streak: ${userProfile.highestStreak}`);
        }
        
        // Save to localStorage
        saveUserProfileLocally(userProfile);
        
        // Sync to Firebase
        const statsRef = db.collection("userStats").doc(currentUser.uid);
        await statsRef.set(userProfile, { merge: true });
        
        console.log("✅ Stats synced to Firebase");
        
        // Refresh UI
        loadUserProfile();
        updateAuthUI();
        
    } catch (error) {
        console.error("❌ Error adding stats:", error);
    }
}

// Individual convenience functions
async function addXP(amount) {
    return addStats({ xp: amount });
}

async function addWin() {
    return addStats({ wins: 1, gamesPlayed: 1 });
}

async function addLoss() {
    return addStats({ losses: 1, gamesPlayed: 1 });
}

async function addGuesses(amount) {
    return addStats({ totalGuesses: amount });
}

async function setLevel(level) {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("❌ Access denied. This command is for developers only.");
        return;
    }
    if (!currentUser) {
        console.log("❌ Error: User must be logged in");
        return;
    }

    const targetLevel = Math.floor(Number(level));
    if (!Number.isFinite(targetLevel) || targetLevel < 1) {
        console.log("❌ Usage: setLevel(10)");
        return;
    }

    try {
        const userProfile = getCurrentProfileData();
        const targetXP = getXPForLevel(targetLevel);
        userProfile.totalXP = targetXP;

        saveUserProfileLocally(userProfile);

        const statsRef = db.collection("userStats").doc(currentUser.uid);
        await statsRef.set({
            totalXP: targetXP
        }, { merge: true });

        await loadUserProfile();
        updateAuthUI();

        console.log(`✅ Set level to ${targetLevel}. Total XP is now ${targetXP}.`);
    } catch (error) {
        console.error("❌ Error setting level:", error);
    }
}

function isDeveloperSessionActive() {
    return Boolean(currentUser && isDeveloperUid(currentUser.uid));
}

function setAdminAbuseStatus(elementId, message, options = {}) {
    const statusEl = document.getElementById(elementId);
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle("error", Boolean(options.error));
}

function getAdminPositiveCountValue(elementId, fallback = 1) {
    const inputEl = document.getElementById(elementId);
    const parsed = Math.floor(Number(inputEl?.value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatAdminDateTime(timestamp) {
    const parsed = Number(timestamp);
    if (!Number.isFinite(parsed) || parsed <= 0) return "unknown time";
    return new Date(parsed).toLocaleString();
}

function getAdminTimestampMillis(timestamp) {
    if (typeof timestamp?.toMillis === "function") return timestamp.toMillis();
    const parsed = Number(timestamp);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatAdminRelativeTime(timestamp, nowMs = Date.now()) {
    const elapsedMs = Math.max(0, nowMs - getAdminTimestampMillis(timestamp));
    const minutes = Math.floor(elapsedMs / (60 * 1000));
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatAdminDateTime(getAdminTimestampMillis(timestamp));
}

function getAdminUtcDayKeys(dayCount = 30) {
    const count = Math.max(1, Math.floor(Number(dayCount) || 30));
    const now = new Date();
    const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Array.from({ length: count }, (_, index) => {
        const daysAgo = count - index - 1;
        return new Date(todayUtcMs - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    });
}

function calculateAdminVisitorAverage(dailyCounts) {
    const firstRecordedIndex = dailyCounts.findIndex(count => count > 0);
    if (firstRecordedIndex < 0) {
        return { average: null, recordedDays: 0 };
    }

    const recordedCounts = dailyCounts.slice(firstRecordedIndex);
    const total = recordedCounts.reduce((sum, count) => sum + count, 0);
    return {
        average: total / recordedCounts.length,
        recordedDays: recordedCounts.length
    };
}

function setAdminVisitorMetric(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) element.textContent = String(value);
}

function renderAdminRecentVisitors(visitors, nowMs = Date.now()) {
    const list = document.getElementById("admin-recent-visitors-list");
    if (!list) return;
    list.replaceChildren();

    if (!visitors.length) {
        const empty = document.createElement("div");
        empty.className = "admin-visitor-empty";
        empty.textContent = "No signed-in visitors recorded in the last 7 days.";
        list.appendChild(empty);
        return;
    }

    visitors.slice(0, 20).forEach(visitor => {
        const row = document.createElement("div");
        row.className = "admin-recent-visitor";

        const name = document.createElement("strong");
        name.textContent = visitor.username;

        const seen = document.createElement("span");
        const online = nowMs - visitor.lastActiveMs < ACTIVE_PLAYER_WINDOW_MS;
        seen.textContent = online ? "Online now" : formatAdminRelativeTime(visitor.lastActiveMs, nowMs);
        seen.title = formatAdminDateTime(visitor.lastActiveMs);

        row.append(name, seen);
        list.appendChild(row);
    });
}

async function refreshAdminVisitorInsights() {
    if (!isDeveloperSessionActive() || !db) return false;

    setAdminAbuseStatus("admin-visitor-status", "Refreshing visitor insights...");
    const nowMs = Date.now();
    const sevenDayCutoffMs = nowMs - 7 * 24 * 60 * 60 * 1000;
    const oneDayCutoffMs = nowMs - 24 * 60 * 60 * 1000;
    const dayKeys = getAdminUtcDayKeys(30);

    const [recentSnapshot, dailySnapshots] = await Promise.all([
        db.collection("userStats").where("lastActive", ">=", sevenDayCutoffMs).get(),
        Promise.all(dayKeys.map(dayKey => (
            db.collection("visitorDaily").doc(dayKey).collection("users").get()
        )))
    ]);

    const recentVisitors = recentSnapshot.docs
        .map(doc => {
            const data = doc.data() || {};
            return {
                username: String(data.username || `Player ${doc.id.slice(0, 6)}`),
                lastActiveMs: getAdminTimestampMillis(data.lastActive)
            };
        })
        .filter(visitor => visitor.lastActiveMs >= sevenDayCutoffMs)
        .sort((a, b) => b.lastActiveMs - a.lastActiveMs);

    const dailyCounts = dailySnapshots.map(snapshot => snapshot.size);
    const lastSevenDailyCounts = dailyCounts.slice(-7);
    const sevenDayAverage = calculateAdminVisitorAverage(lastSevenDailyCounts);
    const thirtyDayAverage = calculateAdminVisitorAverage(dailyCounts);
    const onlineVisitors = recentVisitors.filter(visitor => nowMs - visitor.lastActiveMs < ACTIVE_PLAYER_WINDOW_MS);
    const lastDayVisitors = recentVisitors.filter(visitor => visitor.lastActiveMs >= oneDayCutoffMs);

    setAdminVisitorMetric("admin-visitors-online", onlineVisitors.length);
    setAdminVisitorMetric("admin-visitors-24h", lastDayVisitors.length);
    setAdminVisitorMetric("admin-visitors-7d", recentVisitors.length);
    setAdminVisitorMetric("admin-visitors-today", dailyCounts.at(-1) || 0);
    setAdminVisitorMetric(
        "admin-visitors-average-7d",
        sevenDayAverage.average === null ? "—" : sevenDayAverage.average.toFixed(1)
    );
    setAdminVisitorMetric(
        "admin-visitors-average-30d",
        thirtyDayAverage.average === null ? "—" : thirtyDayAverage.average.toFixed(1)
    );

    const onlineMetric = document.getElementById("admin-visitors-online");
    if (onlineMetric) {
        onlineMetric.title = onlineVisitors.length
            ? onlineVisitors.map(visitor => visitor.username).join("\n")
            : "No signed-in players are currently online.";
    }

    renderAdminRecentVisitors(recentVisitors, nowMs);

    if (thirtyDayAverage.recordedDays > 0) {
        const firstRecordedDay = dayKeys[dayKeys.length - thirtyDayAverage.recordedDays];
        setAdminAbuseStatus(
            "admin-visitor-status",
            `Daily averages currently cover ${thirtyDayAverage.recordedDays} day${thirtyDayAverage.recordedDays === 1 ? "" : "s"}, beginning ${firstRecordedDay}.`
        );
    } else {
        setAdminAbuseStatus(
            "admin-visitor-status",
            "Daily averages will begin filling as signed-in players visit after this update."
        );
    }

    return true;
}

async function adminRefreshVisitorInsights() {
    try {
        return await refreshAdminVisitorInsights();
    } catch (error) {
        console.warn("Unable to refresh visitor insights:", error);
        setAdminAbuseStatus(
            "admin-visitor-status",
            `Visitor insights failed to load: ${error.message || error}`,
            { error: true }
        );
        return false;
    }
}

function normalizeGlobalMessageType(type = "info") {
    const normalized = String(type || "").trim().toLowerCase();
    if (normalized === "event" || normalized === "warning") return normalized;
    return "info";
}

async function setGlobalIndexTheme(themeId = "default") {
    if (!isDeveloperSessionActive()) {
        throw new Error("Developer access required.");
    }
    if (!db) {
        throw new Error("Firestore is not ready yet.");
    }

    const resolvedThemeId = normalizeIndexThemeId(themeId);
    const themeMeta = INDEX_THEME_OPTIONS.find(option => option.id === resolvedThemeId) || INDEX_THEME_OPTIONS[0];
    const payload = {
        themeId: resolvedThemeId,
        themeName: themeMeta?.name || resolvedThemeId,
        enabled: true,
        updatedAt: Date.now(),
        updatedBy: currentUser.uid
    };

    await db.collection(GLOBAL_INDEX_THEME_CONFIG_PATH.collection)
        .doc(GLOBAL_INDEX_THEME_CONFIG_PATH.doc)
        .set(payload, { merge: true });

    applyIndexTheme(resolvedThemeId);
    return payload;
}

async function setGlobalMessageConfig(message = "", type = "info") {
    if (!isDeveloperSessionActive()) {
        throw new Error("Developer access required.");
    }
    if (!db) {
        throw new Error("Firestore is not ready yet.");
    }

    const trimmedMessage = String(message || "").trim();
    const normalizedType = normalizeGlobalMessageType(type);
    const payload = {
        enabled: trimmedMessage.length > 0,
        message: trimmedMessage,
        type: normalizedType,
        updatedAt: Date.now(),
        updatedBy: currentUser.uid
    };

    await db.collection(GLOBAL_MESSAGE_CONFIG_PATH.collection)
        .doc(GLOBAL_MESSAGE_CONFIG_PATH.doc)
        .set(payload, { merge: true });

    return payload;
}

const ACTIVE_PLAYER_WINDOW_MS = 5 * 60 * 1000;

async function runActiveUserStatsBatch(updateBuilder, options = {}) {
    if (!isDeveloperSessionActive()) {
        throw new Error("Developer access required.");
    }
    if (!db) {
        throw new Error("Firestore is not ready yet.");
    }

    const nowMs = Date.now();
    const activeWindowMs = Math.max(60 * 1000, Number(options.activeWindowMs) || ACTIVE_PLAYER_WINDOW_MS);
    const activeCutoffMs = nowMs - activeWindowMs;

    const snapshot = await db
        .collection("userStats")
        .where("lastActive", ">=", activeCutoffMs)
        .get();

    if (snapshot.empty) {
        return {
            updatedUsers: 0,
            activeCutoffMs,
            activeWindowMs
        };
    }

    const docs = snapshot.docs;
    const chunkSize = 450;
    for (let start = 0; start < docs.length; start += chunkSize) {
        const batch = db.batch();
        docs.slice(start, start + chunkSize).forEach(doc => {
            const updatePayload = updateBuilder(doc) || {};
            batch.update(doc.ref, updatePayload);
        });
        await batch.commit();
    }

    return {
        updatedUsers: docs.length,
        activeCutoffMs,
        activeWindowMs
    };
}

async function grantGlobalCrates(amount = 1) {
    const count = Math.floor(Number(amount));
    if (!Number.isFinite(count) || count <= 0) {
        throw new Error("Invalid crate amount.");
    }
    const nowMs = Date.now();
    return runActiveUserStatsBatch(() => ({
        "crateInventory.reef": firebase.firestore.FieldValue.increment(count),
        lastUpdated: nowMs
    }));
}

async function grantGlobalStreakShields(amount = 1) {
    const count = Math.floor(Number(amount));
    if (!Number.isFinite(count) || count <= 0) {
        throw new Error("Invalid streak shield amount.");
    }
    const nowMs = Date.now();
    return runActiveUserStatsBatch(() => ({
        streakShields: firebase.firestore.FieldValue.increment(count),
        lastUpdated: nowMs
    }));
}

async function refreshAdminAbusePanel() {
    if (!isDeveloperSessionActive() || !db) return false;

    const visitorInsightsPromise = adminRefreshVisitorInsights();
    const [xpDoc, themeDoc, messageDoc] = await Promise.all([
        db.collection(GLOBAL_XP_EVENT_CONFIG_PATH.collection).doc(GLOBAL_XP_EVENT_CONFIG_PATH.doc).get(),
        db.collection(GLOBAL_INDEX_THEME_CONFIG_PATH.collection).doc(GLOBAL_INDEX_THEME_CONFIG_PATH.doc).get(),
        db.collection(GLOBAL_MESSAGE_CONFIG_PATH.collection).doc(GLOBAL_MESSAGE_CONFIG_PATH.doc).get()
    ]);

    const xpData = xpDoc.exists ? (xpDoc.data() || {}) : {};
    const themeData = themeDoc.exists ? (themeDoc.data() || {}) : {};
    const messageData = messageDoc.exists ? (messageDoc.data() || {}) : {};

    const themeSelect = document.getElementById("admin-index-theme-select");
    if (themeSelect) {
        themeSelect.value = normalizeIndexThemeId(themeData.themeId || "default");
    }

    const messageInput = document.getElementById("admin-global-message-input");
    if (messageInput) {
        messageInput.value = String(messageData.message || "");
    }

    const messageTypeSelect = document.getElementById("admin-global-message-type");
    if (messageTypeSelect) {
        messageTypeSelect.value = normalizeGlobalMessageType(messageData.type || "info");
    }

    if (xpData.enabled) {
        setAdminAbuseStatus(
            "admin-xp-status",
            `Global 2x XP is live until ${formatAdminDateTime(xpData.endMs)}.`
        );
    } else {
        setAdminAbuseStatus("admin-xp-status", "Global 2x XP is currently off.");
    }

    const themeName = INDEX_THEME_OPTIONS.find(option => option.id === normalizeIndexThemeId(themeData.themeId || "default"))?.name || "Default Ocean";
    setAdminAbuseStatus(
        "admin-theme-status",
        `Current index theme: ${themeName}.`
    );

    if (messageData.enabled && messageData.message) {
        setAdminAbuseStatus(
            "admin-message-status",
            `Live message (${normalizeGlobalMessageType(messageData.type)}): ${String(messageData.message).slice(0, 120)}`
        );
    } else {
        setAdminAbuseStatus("admin-message-status", "No global message is active.");
    }

    await visitorInsightsPromise;

    return true;
}

async function adminStartGlobalXpEvent() {
    if (!isDeveloperSessionActive()) {
        showNotification("Developer access required.", "error", 3000);
        return;
    }
    const hours = getAdminPositiveCountValue("admin-global-xp-hours", 24);
    setAdminAbuseStatus("admin-xp-status", "Starting global 2x XP...");
    try {
        const eventConfig = await startGlobalDoubleXpEvent(hours);
        if (!eventConfig) {
            setAdminAbuseStatus("admin-xp-status", "Could not start global 2x XP. Check console logs.", { error: true });
            return;
        }
        const endLabel = formatAdminDateTime(eventConfig.endMs);
        setAdminAbuseStatus("admin-xp-status", `Global 2x XP started for ${hours}h. Ends ${endLabel}.`);
        showNotification(`Global 2x XP started for ${hours} hour${hours === 1 ? "" : "s"}.`, "success", 3200);
    } catch (error) {
        setAdminAbuseStatus("admin-xp-status", `Failed to start XP event: ${error.message || error}`, { error: true });
    }
}

async function adminStopGlobalXpEvent() {
    if (!isDeveloperSessionActive()) {
        showNotification("Developer access required.", "error", 3000);
        return;
    }
    setAdminAbuseStatus("admin-xp-status", "Stopping global 2x XP...");
    try {
        const update = await stopGlobalDoubleXpEvent();
        if (!update) {
            setAdminAbuseStatus("admin-xp-status", "Could not stop global 2x XP. Check console logs.", { error: true });
            return;
        }
        setAdminAbuseStatus("admin-xp-status", `Global 2x XP stopped at ${formatAdminDateTime(update.endMs)}.`);
        showNotification("Global 2x XP stopped.", "success", 3000);
    } catch (error) {
        setAdminAbuseStatus("admin-xp-status", `Failed to stop XP event: ${error.message || error}`, { error: true });
    }
}

async function adminGrantGlobalCrates() {
    if (!isDeveloperSessionActive()) {
        showNotification("Developer access required.", "error", 3000);
        return;
    }
    const amount = getAdminPositiveCountValue("admin-grant-crates-count", 1);
    setAdminAbuseStatus("admin-grant-status", `Granting ${amount} crate${amount === 1 ? "" : "s"} to active players...`);
    try {
        const result = await grantGlobalCrates(amount);
        const activeMinutes = Math.round(result.activeWindowMs / 60000);
        setAdminAbuseStatus(
            "admin-grant-status",
            `Granted ${amount} crate${amount === 1 ? "" : "s"} to ${result.updatedUsers} active player${result.updatedUsers === 1 ? "" : "s"} (last ${activeMinutes}m).`
        );
        showNotification(`Granted crates to ${result.updatedUsers} active player${result.updatedUsers === 1 ? "" : "s"}.`, "success", 3400);
    } catch (error) {
        setAdminAbuseStatus("admin-grant-status", `Crate grant failed: ${error.message || error}`, { error: true });
    }
}

async function adminGrantGlobalStreakShields() {
    if (!isDeveloperSessionActive()) {
        showNotification("Developer access required.", "error", 3000);
        return;
    }
    const amount = getAdminPositiveCountValue("admin-grant-shields-count", 1);
    setAdminAbuseStatus("admin-grant-status", `Granting ${amount} streak shield${amount === 1 ? "" : "s"} to active players...`);
    try {
        const result = await grantGlobalStreakShields(amount);
        const activeMinutes = Math.round(result.activeWindowMs / 60000);
        setAdminAbuseStatus(
            "admin-grant-status",
            `Granted ${amount} streak shield${amount === 1 ? "" : "s"} to ${result.updatedUsers} active player${result.updatedUsers === 1 ? "" : "s"} (last ${activeMinutes}m).`
        );
        showNotification(`Granted streak shields to ${result.updatedUsers} active player${result.updatedUsers === 1 ? "" : "s"}.`, "success", 3400);
    } catch (error) {
        setAdminAbuseStatus("admin-grant-status", `Shield grant failed: ${error.message || error}`, { error: true });
    }
}

async function adminApplyIndexTheme() {
    if (!isDeveloperSessionActive()) {
        showNotification("Developer access required.", "error", 3000);
        return;
    }
    const themeSelect = document.getElementById("admin-index-theme-select");
    const themeId = themeSelect?.value || "default";
    setAdminAbuseStatus("admin-theme-status", "Applying index theme...");
    try {
        const payload = await setGlobalIndexTheme(themeId);
        setAdminAbuseStatus("admin-theme-status", `Index theme set to ${payload.themeName}.`);
        showNotification(`Index theme changed to ${payload.themeName}.`, "success", 3200);
    } catch (error) {
        setAdminAbuseStatus("admin-theme-status", `Theme update failed: ${error.message || error}`, { error: true });
    }
}

async function adminSetGlobalMessage() {
    if (!isDeveloperSessionActive()) {
        showNotification("Developer access required.", "error", 3000);
        return;
    }
    const messageInput = document.getElementById("admin-global-message-input");
    const messageTypeSelect = document.getElementById("admin-global-message-type");
    const message = String(messageInput?.value || "").trim();
    const type = normalizeGlobalMessageType(messageTypeSelect?.value || "info");
    if (!message) {
        setAdminAbuseStatus("admin-message-status", "Write a message before publishing.", { error: true });
        return;
    }
    setAdminAbuseStatus("admin-message-status", "Publishing global message...");
    try {
        await setGlobalMessageConfig(message, type);
        setAdminAbuseStatus("admin-message-status", `Published ${type} message: ${message.slice(0, 120)}`);
        showNotification("Global message published.", "success", 3200);
    } catch (error) {
        setAdminAbuseStatus("admin-message-status", `Message publish failed: ${error.message || error}`, { error: true });
    }
}

async function adminClearGlobalMessage() {
    if (!isDeveloperSessionActive()) {
        showNotification("Developer access required.", "error", 3000);
        return;
    }
    setAdminAbuseStatus("admin-message-status", "Clearing global message...");
    try {
        await setGlobalMessageConfig("", "info");
        const messageInput = document.getElementById("admin-global-message-input");
        if (messageInput) messageInput.value = "";
        setAdminAbuseStatus("admin-message-status", "Global message cleared.");
        showNotification("Global message cleared.", "success", 3000);
    } catch (error) {
        setAdminAbuseStatus("admin-message-status", `Message clear failed: ${error.message || error}`, { error: true });
    }
}

function openAdminAbuseMenu() {
    openAdminAbuseModal();
    return "Opened the Admin Abuse panel.";
}

async function startGlobalDoubleXpEvent(hours = 72) {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("❌ Access denied. This command is for developers only.");
        return null;
    }
    if (!currentUser) {
        console.log("❌ Error: User must be logged in");
        return null;
    }

    const durationHours = Number(hours);
    if (!Number.isFinite(durationHours) || durationHours <= 0) {
        console.log("❌ Usage: startGlobalDoubleXpEvent(72)");
        return null;
    }

    try {
        const nowMs = Date.now();
        const endMs = nowMs + Math.round(durationHours * 60 * 60 * 1000);
        const eventConfig = {
            id: `global-double-xp-${nowMs}`,
            label: "2x XP Event",
            multiplier: 2,
            enabled: true,
            startMs: nowMs,
            endMs,
            startedBy: currentUser.uid,
            updatedAt: nowMs
        };

        await db.collection(GLOBAL_XP_EVENT_CONFIG_PATH.collection)
            .doc(GLOBAL_XP_EVENT_CONFIG_PATH.doc)
            .set(eventConfig, { merge: true });

        globalXpEventOverride = eventConfig;
        ensureXpEventBannerTimer();

        console.log(`✅ Started global 2x XP event for ${durationHours} hour${durationHours === 1 ? "" : "s"}.`);
        return eventConfig;
    } catch (error) {
        console.error("❌ Error starting global 2x XP event:", error);
        return null;
    }
}

async function stopGlobalDoubleXpEvent() {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("❌ Access denied. This command is for developers only.");
        return null;
    }
    if (!currentUser) {
        console.log("❌ Error: User must be logged in");
        return null;
    }

    try {
        const update = {
            enabled: false,
            endMs: Date.now(),
            updatedAt: Date.now(),
            stoppedBy: currentUser.uid
        };
        await db.collection(GLOBAL_XP_EVENT_CONFIG_PATH.collection)
            .doc(GLOBAL_XP_EVENT_CONFIG_PATH.doc)
            .set(update, { merge: true });

        globalXpEventOverride = {
            ...(globalXpEventOverride || {}),
            ...update
        };
        ensureXpEventBannerTimer();

        console.log("✅ Stopped the global 2x XP event.");
        return update;
    } catch (error) {
        console.error("❌ Error stopping global 2x XP event:", error);
        return null;
    }
}

async function addLoginDays(days) {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("❌ Access denied. This command is for developers only.");
        return;
    }
    if (!currentUser) {
        console.log("❌ Error: User must be logged in");
        return;
    }

    const amount = Number(days);
    if (!Number.isFinite(amount) || amount <= 0) {
        console.log("❌ Usage: addLoginDays(7)");
        return;
    }

    try {
        const currentLoginDay = parseInt(localStorage.getItem("currentLoginDay")) || 1;
        const loginStreak = parseInt(localStorage.getItem("loginStreak")) || 1;
        const nextLoginDay = currentLoginDay + Math.floor(amount);
        const nextLoginStreak = loginStreak + Math.floor(amount);
        const today = getLocalDateKey();

        localStorage.setItem("currentLoginDay", String(nextLoginDay));
        localStorage.setItem("loginStreak", String(nextLoginStreak));
        localStorage.setItem("lastLoginDate", today);
        localStorage.removeItem(getDailyLoginModalShownStorageKey());

        await db.collection("userStats").doc(currentUser.uid).set({
            currentLoginDay: nextLoginDay,
            loginStreak: nextLoginStreak,
            lastLoginDate: today
        }, { merge: true });

        await ensureLoginStreakRewards();
        await loadUserProfile();
        if (typeof loadAvailablePFPs === "function") loadAvailablePFPs();
        if (typeof loadEarnedCosmetics === "function") loadEarnedCosmetics();

        console.log(`✅ Added ${Math.floor(amount)} login day(s). Current login day: ${nextLoginDay}. Login streak: ${nextLoginStreak}.`);
        if (nextLoginDay >= 7 || nextLoginStreak >= 7) {
            console.log("🦈 Day 7 Bull Shark reward check completed.");
        }
    } catch (error) {
        console.error("❌ Error adding login days:", error);
    }
}

async function skipLoginDay(days = 1) {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("❌ Access denied. This command is for developers only.");
        return;
    }
    if (!currentUser) {
        console.log("❌ Error: User must be logged in");
        return;
    }

    const amount = Number(days);
    if (!Number.isFinite(amount) || amount <= 0) {
        console.log("❌ Usage: skipLoginDay(1)");
        return;
    }

    const skippedDays = Math.floor(amount);

    try {
        const simulatedLastLogin = new Date();
        simulatedLastLogin.setHours(12, 0, 0, 0);
        // Skip N calendar days means the previous login was N+1 days ago.
        simulatedLastLogin.setDate(simulatedLastLogin.getDate() - (skippedDays + 1));
        const simulatedLastLoginDate = getLocalDateKey(simulatedLastLogin);
        if (!simulatedLastLoginDate) {
            console.log("❌ Could not generate a valid simulated login date.");
            return;
        }

        localStorage.setItem("lastLoginDate", simulatedLastLoginDate);
        localStorage.removeItem(getDailyLoginModalShownStorageKey());

        await db.collection("userStats").doc(currentUser.uid).set({
            lastLoginDate: simulatedLastLoginDate,
            dailyLoginModalShownToday: ""
        }, { merge: true });

        await initializeDailyLogin();
        await loadUserProfile();

        const currentLoginDay = parseInt(localStorage.getItem("currentLoginDay")) || 1;
        const loginStreak = parseInt(localStorage.getItem("loginStreak")) || 1;
        console.log(`✅ Simulated skipping ${skippedDays} day(s).`);
        console.log(`   lastLoginDate set to ${simulatedLastLoginDate}`);
        console.log(`   Post-check login day: ${currentLoginDay}, login streak: ${loginStreak}`);
    } catch (error) {
        console.error("❌ Error skipping login day:", error);
    }
}

async function simulateNextLoginDay() {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("❌ Access denied. This command is for developers only.");
        return;
    }
    if (!currentUser) {
        console.log("❌ Error: User must be logged in");
        return;
    }

    try {
        const simulatedLastLogin = new Date();
        simulatedLastLogin.setHours(12, 0, 0, 0);
        simulatedLastLogin.setDate(simulatedLastLogin.getDate() - 1);
        const simulatedLastLoginDate = getLocalDateKey(simulatedLastLogin);
        if (!simulatedLastLoginDate) {
            console.log("❌ Could not generate a valid simulated login date.");
            return;
        }

        localStorage.setItem("lastLoginDate", simulatedLastLoginDate);
        localStorage.removeItem(getDailyLoginModalShownStorageKey());

        await db.collection("userStats").doc(currentUser.uid).set({
            lastLoginDate: simulatedLastLoginDate,
            dailyLoginModalShownToday: ""
        }, { merge: true });

        await initializeDailyLogin();
        await loadUserProfile();

        const currentLoginDay = parseInt(localStorage.getItem("currentLoginDay")) || 1;
        const loginStreak = parseInt(localStorage.getItem("loginStreak")) || 1;
        console.log("✅ Simulated a consecutive login day.");
        console.log(`   lastLoginDate set to ${simulatedLastLoginDate}`);
        console.log(`   Post-check login day: ${currentLoginDay}, login streak: ${loginStreak}`);
    } catch (error) {
        console.error("❌ Error simulating next login day:", error);
    }
}

// Bulk add function for quick testing
async function addTestStats() {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("❌ Access denied. This command is for developers only.");
        return;
    }
    return addStats({
        xp: 500,
        wins: 10,
        losses: 5,
        gamesPlayed: 15,
        totalGuesses: 75
    });
}

async function forceRedeemCode(code) {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("❌ Access denied. This command is for developers only.");
        return;
    }
    if (!currentUser) {
        console.log("❌ Error: User must be logged in");
        return;
    }

    const codeUpper = (code || "").toUpperCase().trim();
    if (!redeemCodes[codeUpper]) {
        console.log(`❌ Code "${codeUpper}" does not exist.`);
        return;
    }

    try {
        const userProfile = getCurrentProfileData();
        const currentXP = userProfile.totalXP || 0;
        const codeReward = redeemCodes[codeUpper];

        // Add XP
        const xpAward = typeof window.applyLimitedTimeXpBonus === "function"
            ? window.applyLimitedTimeXpBonus(codeReward.xp)
            : { totalXp: codeReward.xp };
        const newXP = currentXP + xpAward.totalXp;
        userProfile.totalXP = newXP;

        // Add cosmetics if any
        const newlyUnlockedCosmetics = [];
        if (codeReward.cosmetics) {
            if (!userProfile.earnedCosmetics) {
                userProfile.earnedCosmetics = [];
            }
            codeReward.cosmetics.forEach(cosmetic => {
                if (!userProfile.earnedCosmetics.some(c => c.name === cosmetic.name)) {
                    userProfile.earnedCosmetics.push(cosmetic);
                    newlyUnlockedCosmetics.push(cosmetic);
                }
            });
        }

        // Add badge if any
        if (codeReward.badge) {
            if (codeReward.badge === "tester") {
                userProfile.testerBadgeUnlocked = true;
            }
            if (!Array.isArray(userProfile.unlockedBadges)) {
                userProfile.unlockedBadges = ["starter"];
            }
            if (!userProfile.unlockedBadges.includes(codeReward.badge)) {
                userProfile.unlockedBadges.push(codeReward.badge);
            }
        }

        const grantedCrates = applyCodeCrateRewards(userProfile, codeReward.crates);

        saveUserProfileLocally(userProfile);

        // Sync to Firebase
        if (currentUser) {
            const statsRef = db.collection("userStats").doc(currentUser.uid);
            await statsRef.set({
                totalXP: newXP,
                earnedCosmetics: userProfile.earnedCosmetics,
                testerBadgeUnlocked: userProfile.testerBadgeUnlocked,
                unlockedBadges: userProfile.unlockedBadges,
                crateInventory: normalizeCrateInventory(userProfile.crateInventory)
            }, { merge: true });
        }

        // Mark code as redeemed (so it doesn't get re-added accidentally)
        addRedeemedCode(codeUpper);

        // Sync redeemed codes to Firebase
        if (currentUser) {
            const redeemedCodesList = getRedeemedCodes();
            const statsRef = db.collection("userStats").doc(currentUser.uid);
            await statsRef.set({ redeemedCodes: redeemedCodesList }, { merge: true });
        }

        console.log(`✅ Force-redeemed code "${codeUpper}". Rewards:`);
        if (codeReward.xp) console.log(`   XP: +${xpAward.totalXp} (new total: ${newXP})`);
        if (codeReward.cosmetics) {
            codeReward.cosmetics.forEach(c => console.log(`   Cosmetic: ${c.name}`));
        }
        if (codeReward.badge) console.log(`   Badge: ${codeReward.badge}`);
        grantedCrates.forEach(crate => console.log(`   Crate: +${crate.count} ${crate.name}`));

        loadUserProfile();
        loadEarnedCosmetics();
        loadAvailablePFPs();
        renderCratesButton();
        renderCratesModal();
        updateSeasonalCratePanels();

    } catch (error) {
        console.error("❌ Error force-redeeming code:", error);
    }
}

async function addCrates(amount = 1) {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("❌ Access denied. This command is for developers only.");
        return;
    }
    if (!currentUser) {
        console.log("❌ Error: User must be logged in");
        return;
    }

    const count = Math.floor(Number(amount));
    if (!Number.isFinite(count) || count <= 0) {
        console.log("❌ Usage: addCrates(3)");
        return;
    }

    try {
        const profileData = getCurrentProfileData();
        const inventory = getCrateInventory(profileData);
        inventory.reef += count;
        profileData.crateInventory = normalizeCrateInventory(inventory);
        saveUserProfileLocally(profileData);
        await db.collection("userStats").doc(currentUser.uid).set({
            crateInventory: profileData.crateInventory
        }, { merge: true });
        renderCratesButton();
        renderCratesModal();
        console.log(`✅ Added ${count} Cosmetic Crate${count === 1 ? "" : "s"}. Total: ${profileData.crateInventory.reef}`);
    } catch (error) {
        console.error("❌ Error adding crates:", error);
    }
}

async function addStreakShields(amount = 1) {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("❌ Access denied. This command is for developers only.");
        return;
    }
    if (!currentUser) {
        console.log("❌ Error: User must be logged in");
        return;
    }

    const count = Math.floor(Number(amount));
    if (!Number.isFinite(count) || count <= 0) {
        console.log("❌ Usage: addStreakShields(3)");
        return;
    }

    try {
        const profileData = getCurrentProfileData();
        setStreakShieldCount(profileData, getStreakShieldCount(profileData) + count);
        saveUserProfileLocally(profileData);
        await db.collection("userStats").doc(currentUser.uid).set({
            streakShields: getStreakShieldCount(profileData)
        }, { merge: true });
        renderCratesModal();
        if (typeof renderConsumablesPage === "function") {
            renderConsumablesPage();
        }
        console.log(`✅ Added ${count} Streak Shield${count === 1 ? "" : "s"}. Total: ${getStreakShieldCount(profileData)}`);
    } catch (error) {
        console.error("❌ Error adding streak shields:", error);
    }
}

// Display current stats
function showStats() {
    const userProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    console.log("=== CURRENT STATS ===");
    console.log(`XP: ${userProfile.totalXP || 0}`);
    console.log(`Wins: ${userProfile.wins || 0}`);
    console.log(`Losses: ${userProfile.losses || 0}`);
    console.log(`Games Played: ${userProfile.gamesPlayed || 0}`);
    console.log(`Total Guesses: ${userProfile.totalGuesses || 0}`);
    console.log(`Current Streak: ${userProfile.currentStreak || 0}`);
    console.log(`Highest Streak: ${userProfile.highestStreak || 0}`);
    console.log(`Streak Shields: ${Math.max(0, Number(userProfile.streakShields) || 0)}`);
    console.log(`Login Day: ${parseInt(localStorage.getItem("currentLoginDay")) || 1}`);
    console.log(`Login Streak: ${parseInt(localStorage.getItem("loginStreak")) || 1}`);
    console.log(`Level: ${getLevelFromXP(userProfile.totalXP || 0)}`);
    console.log("====================");
}

// Print available commands
function showCommands() {
    console.log("=== AVAILABLE STAT COMMANDS ===");
    console.log("addStats({xp: 100, wins: 1, losses: 1, gamesPlayed: 1, totalGuesses: 5})");
    console.log("addXP(100) - Add XP");
    console.log("setLevel(10) - Set your level directly");
    console.log("openAdminAbuseMenu() - Open the Admin Abuse panel");
    console.log("startGlobalDoubleXpEvent(72) - Start a global 2x XP event");
    console.log("stopGlobalDoubleXpEvent() - Stop the global 2x XP event");
    console.log("addWin() - Add 1 win");
    console.log("addLoss() - Add 1 loss");
    console.log("addGuesses(10) - Add guesses");
    console.log("addLoginDays(7) - Add login days/streak and test login rewards");
    console.log("simulateNextLoginDay() - Simulate logging in the day after your last login");
    console.log("skipLoginDay(1) - Simulate missing 1 day and re-run daily login logic");
    console.log("addCrates(3) - Add Cosmetic Crates for testing");
    console.log("addStreakShields(3) - Add Streak Shields for testing");
    console.log("resetDailySpin() - Reset today's daily spin wheel");
    console.log("unlockAllCosmetics() - Unlock all profile icons, badges, and themes");
    console.log("addTestStats() - Quick test add (500 XP, 10 wins, 5 losses, 15 games, 75 guesses)");
    console.log("revealShark() - Reveal the currently open duel shark");
    console.log("revealShark('duel_id') - Reveal a specific duel shark by id");
    console.log("showStats() - Display current stats");
    console.log("showCommands() - Show this help");
    console.log("================================");
}

// Profile modal overhaul helpers
function syncProfileOverviewStats(profileData = getCurrentProfileData()) {
    const map = {
        "profile-xp-overview": profileData.totalGuesses ?? 0,
        "profile-wins-overview": profileData.wins ?? 0,
        "profile-current-streak-overview": profileData.currentStreak ?? 0,
        "profile-best-game-overview": profileData.bestGame ?? 0
    };
    Object.entries(map).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
    const previewName = document.getElementById("profile-username-overview-preview");
    const previewPic = document.getElementById("profile-pic-overview-preview");
    if (previewName) previewName.textContent = profileData.username || currentUser?.email?.split("@")[0] || "Sharkdle Player";
    if (previewPic) previewPic.src = profileData.profilePicture || "images/pfp/shark1.png";
}

const profileInventoryFilters = {
    portraits: "all",
    badges: "all",
    themes: "all",
    items: "all"
};

const cosmeticFilterLabels = {
    all: "All",
    starter: "Starter",
    pass: "Pass",
    crate: "Crates",
    reward: "Rewards",
    code: "Codes",
    common: "Common",
    rare: "Rare",
    epic: "Epic",
    legendary: "Legendary",
    item: "Items"
};

function normalizeCosmeticFilterValue(value = "all") {
    return String(value || "all").trim().toLowerCase();
}

function getCosmeticRarityLabel(rarity = "common") {
    const key = normalizeCosmeticFilterValue(rarity);
    return ({
        core: "Starter",
        starter: "Starter",
        special: "Special",
        code: "Code",
        common: "Common",
        uncommon: "Uncommon",
        rare: "Rare",
        epic: "Epic",
        legendary: "Legendary",
        item: "Item"
    })[key] || "Common";
}

function getShortCosmeticSourceLabel(source = "Reward") {
    const label = String(source || "Reward");
    const lower = label.toLowerCase();
    if (lower.includes("starter")) return "Starter";
    if (lower.includes("summer")) return "Summer";
    if (lower.includes("christmas")) return "Christmas";
    if (lower.includes("halloween")) return "Halloween";
    if (lower.includes("cosmetic crate")) return "Crate";
    if (lower.includes("crate")) return "Crate";
    if (lower.includes("shark pass")) return label.replace("Shark Pass level", "Pass Lv.").replace("Shark Pass", "Pass");
    if (lower.includes("pass lv")) return label;
    if (lower.includes("redeem") || lower.includes("code")) return "Code";
    if (lower.includes("leaderboard")) return "Leaderboard";
    if (lower.includes("login")) return "Login";
    if (lower.includes("wheel")) return "Wheel";
    if (lower.includes("achievement")) return "Achievement";
    return label.length > 12 ? `${label.slice(0, 11)}...` : label;
}

function getThemeCosmeticMeta(theme) {
    const passReward = sharkPassRewards.find(reward => reward.type === "theme" && reward.themeId === theme.id);
    const crateReward = getAllCrateRewardPools()
        .flat()
        .find(reward => reward.type === "theme" && reward.themeId === theme.id);
    if (theme.id === "default") {
        return { rarity: "core", category: "starter", source: "Starter" };
    }
    if (passReward || typeof theme.level === "number") {
        return {
            rarity: passReward?.rarity || (theme.level >= 20 ? "legendary" : theme.level >= 15 ? "epic" : "rare"),
            category: "pass",
            source: theme.level ? `Pass Lv. ${theme.level}` : "Shark Pass"
        };
    }
    if (crateReward) {
        const source = crateReward.id?.includes("summer") ? "Summer crate"
            : crateReward.id?.includes("christmas") ? "Christmas crate"
            : crateReward.id?.includes("halloween") ? "Halloween crate"
            : "Cosmetic crate";
        return { rarity: crateReward.rarity || "rare", category: "crate", source };
    }
    return { rarity: "special", category: "reward", source: "Achievement" };
}

function getBadgeCosmeticMeta(badge) {
    const rarityMeta = typeof getBadgeRarityMeta === "function"
        ? getBadgeRarityMeta(badge)
        : { className: badge?.rarity || "common", label: getCosmeticRarityLabel(badge?.rarity) };
    const passReward = sharkPassRewards.find(reward => reward.type === "badge" && reward.badgeId === badge.id);
    const crateReward = getAllCrateBadgeRewards().find(reward => reward.badgeId === badge.id);
    if (badge.id === "starter") return { rarity: "core", category: "starter", source: "Starter" };
    if (passReward || badge.passLevel) return { rarity: rarityMeta.className, category: "pass", source: passReward?.level || badge.passLevel ? `Pass Lv. ${passReward?.level || badge.passLevel}` : "Shark Pass" };
    if (crateReward) return { rarity: rarityMeta.className, category: "crate", source: "Crate" };
    if (badge.codeUnlock) return { rarity: rarityMeta.className, category: "code", source: "Code" };
    return { rarity: rarityMeta.className, category: "reward", source: "Reward" };
}

function shouldShowCosmetic(item, activeFilter) {
    const filter = normalizeCosmeticFilterValue(activeFilter);
    if (filter === "all") return true;
    return normalizeCosmeticFilterValue(item.category) === filter
        || normalizeCosmeticFilterValue(item.rarity) === filter
        || normalizeCosmeticFilterValue(item.source).includes(filter);
}

function getCosmeticRaritySortRank(rarity = "common") {
    const order = ["core", "starter", "common", "rare", "epic", "legendary"];
    const rank = order.indexOf(normalizeCosmeticFilterValue(rarity));
    return rank === -1 ? order.indexOf("common") : rank;
}

function sortCosmeticsForLocker(items) {
    return [...items].sort((a, b) => {
        const rarityDiff = getCosmeticRaritySortRank(a.rarity) - getCosmeticRaritySortRank(b.rarity);
        if (rarityDiff !== 0) return rarityDiff;
        const categoryDiff = normalizeCosmeticFilterValue(a.category).localeCompare(normalizeCosmeticFilterValue(b.category));
        if (categoryDiff !== 0) return categoryDiff;
        return String(a.name || a.label || "").localeCompare(String(b.name || b.label || ""));
    });
}

function ensureProfileInventoryFilterBar(category, filters) {
    const section = document.querySelector(`[data-profile-inventory-section="${category}"]`);
    if (!section) return;
    let bar = section.querySelector(".profile-cosmetic-filters");
    if (!bar) {
        bar = document.createElement("div");
        bar.className = "profile-cosmetic-filters";
        const title = section.querySelector("h4");
        title?.insertAdjacentElement("afterend", bar);
    }
    const active = profileInventoryFilters[category] || "all";
    bar.innerHTML = filters.map(filter => `
        <button type="button" class="${active === filter ? "active" : ""}" onclick="setProfileInventoryFilter('${category}', '${filter}')">${cosmeticFilterLabels[filter] || filter}</button>
    `).join("");
}

function setProfileInventoryFilter(category, filter = "all") {
    profileInventoryFilters[category] = normalizeCosmeticFilterValue(filter);
    renderProfileInventoryUI();
    showProfileInventoryCategory(category);
}

function renderProfileInventoryUI(profileData = getCurrentProfileData()) {
    const summary = document.getElementById("profile-inventory-summary");
    const pfpGrid = document.getElementById("profile-inventory-pfps");
    const badgeGrid = document.getElementById("profile-inventory-badges");
    const crateGrid = document.getElementById("profile-inventory-crates");
    if (!pfpGrid && !badgeGrid && !crateGrid && !summary) return;

    const pfps = typeof buildProfilePicPickerCatalog === "function"
        ? buildProfilePicPickerCatalog().filter(item => item.unlocked)
        : [];
    const badges = typeof getUnlockedBadges === "function" ? getUnlockedBadges(currentUser?.uid, profileData) : [];
    const themes = typeof getUnlockedCardThemes === "function" ? getUnlockedCardThemes(profileData) : [];
    const inventory = typeof getCrateInventory === "function" ? getCrateInventory(profileData) : {};
    const shieldCount = Number(profileData.streakShields || profileData.shields || 0);

    if (summary) {
        summary.innerHTML = `
            <article><strong>${pfps.length}</strong><span>Portraits</span></article>
            <article><strong>${badges.length}</strong><span>Badges</span></article>
            <article><strong>${themes.length}</strong><span>Themes</span></article>
            <article><strong>${Object.values(inventory).reduce((a, b) => a + Number(b || 0), 0)}</strong><span>Crates</span></article>
        `;
    }

    if (pfpGrid) {
        ensureProfileInventoryFilterBar("portraits", ["all", "starter", "pass", "crate", "reward", "common", "rare", "epic", "legendary"]);
        const normalizePath = path => String(path || "").replace(/\\/g, "/").replace(/^\.?\//, "").trim().toLowerCase();
        const equipped = normalizePath(profileData.profilePicture || profileData.profilePic || "images/pfp/shark1.png");
        const visiblePfps = sortCosmeticsForLocker(pfps.filter(pfp => shouldShowCosmetic(pfp, profileInventoryFilters.portraits))).slice(0, 48);
        pfpGrid.innerHTML = visiblePfps.map(pfp => `
            <button class="profile-inventory-card pfp rarity-${pfp.rarity || "common"} ${normalizePath(pfp.imagePath) === equipped ? "equipped" : ""}" onclick="setProfilePicture('${pfp.imagePath.replace(/'/g, "\\'")}')">
                <img src="${pfp.imagePath}" alt="${pfp.name}">
                <span>${pfp.name}</span>
                <small class="cosmetic-chip-row"><b class="rarity-chip rarity-${pfp.rarity || "common"}">${getPfpRarityLabel?.(pfp.rarity) || getCosmeticRarityLabel(pfp.rarity)}</b><b class="source-chip" title="${pfp.source || "Reward"}">${getShortCosmeticSourceLabel(pfp.source)}</b></small>
            </button>
        `).join("") || `<div class="profile-empty-card">No portraits match this filter.</div>`;
    }

    if (badgeGrid) {
        ensureProfileInventoryFilterBar("badges", ["all", "starter", "pass", "crate", "code", "reward", "common", "rare", "epic", "legendary"]);
        const normalizeId = id => String(id || "starter").trim().toLowerCase();
        const equippedBadge = normalizeId(profileData.equippedBadge || getEquippedBadge?.(profileData) || "starter");
        const visibleBadges = badges
            .map(badge => ({ ...badge, ...getBadgeCosmeticMeta(badge) }))
            .filter(badge => shouldShowCosmetic(badge, profileInventoryFilters.badges));
        badgeGrid.innerHTML = sortCosmeticsForLocker(visibleBadges).map(badge => `
            <button class="profile-inventory-card badge rarity-${badge.rarity} ${normalizeId(badge.id) === equippedBadge ? "equipped" : ""}" onclick="setEquippedBadge('${badge.id}')">
                <span class="badge-mark">${badge.emoji || "🏅"}</span>
                <span>${badge.name}</span>
                <small class="cosmetic-chip-row"><b class="rarity-chip rarity-${badge.rarity}">${getCosmeticRarityLabel(badge.rarity)}</b><b class="source-chip" title="${badge.source}">${getShortCosmeticSourceLabel(badge.source)}</b></small>
            </button>
        `).join("") || `<div class="profile-empty-card">No badges match this filter.</div>`;
    }

    const themeGrid = document.getElementById("theme-select-container");
    if (themeGrid) {
        ensureProfileInventoryFilterBar("themes", ["all", "starter", "pass", "crate", "reward", "rare", "epic", "legendary"]);
    }

    if (typeof renderThemeSelection === "function") renderThemeSelection();

    if (crateGrid) {
        ensureProfileInventoryFilterBar("items", ["all", "crate", "item"]);
        const crates = [
            { id: "reef", label: "Cosmetic", icon: "fa-box-open", category: "crate", rarity: "item", source: "Crate" },
            { id: "summer", label: "Summer", icon: "fa-umbrella-beach", category: "crate", rarity: "item", source: "Crate" },
            { id: "christmas", label: "Christmas", icon: "fa-snowflake", category: "crate", rarity: "item", source: "Crate" },
            { id: "halloween", label: "Halloween", icon: "fa-ghost", category: "crate", rarity: "item", source: "Crate" }
        ];
        const items = [...crates, { id: "shield", label: "Streak Shields", icon: "fa-shield-halved", category: "item", rarity: "epic", source: "Utility", count: shieldCount }];
        crateGrid.innerHTML = sortCosmeticsForLocker(items.filter(item => shouldShowCosmetic(item, profileInventoryFilters.items))).map(item => `
            <article class="profile-inventory-card utility rarity-${item.rarity}">
                <i class="fa-solid ${item.icon}"></i>
                <span>${item.label}</span>
                <strong>${Number(item.count ?? inventory[item.id] ?? 0)}</strong>
                <small class="cosmetic-chip-row"><b class="rarity-chip rarity-${item.rarity}">${getCosmeticRarityLabel(item.rarity)}</b><b class="source-chip" title="${item.source}">${getShortCosmeticSourceLabel(item.source)}</b></small>
            </article>
        `).join("") || `<div class="profile-empty-card">No items match this filter.</div>`;
    }
}

function showProfileInventoryCategory(category = "portraits") {
    const validCategories = ["portraits", "badges", "themes", "items", "codes"];
    const activeCategory = validCategories.includes(category) ? category : "portraits";
    document.querySelectorAll("[data-profile-inventory-tab]").forEach(button => {
        button.classList.toggle("active", button.dataset.profileInventoryTab === activeCategory);
    });
    document.querySelectorAll("[data-profile-inventory-section]").forEach(section => {
        const isActive = section.dataset.profileInventorySection === activeCategory;
        section.hidden = !isActive;
        section.classList.toggle("active", isActive);
    });
    localStorage.setItem("profileInventoryCategory", activeCategory);
}

const originalShowProfileTab = window.showProfileTab;
window.showProfileTab = function(tab = "overview") {
    const validTabs = ["overview", "inventory", "stats", "recent", "friends", "settings"];
    const activeTab = validTabs.includes(tab) ? tab : "overview";
    validTabs.forEach(name => {
        const panel = document.getElementById(name === "inventory" ? "profile-inventory-tab" : `${name}-tab`);
        const btn = document.getElementById(`${name}-tab-btn`);
        if (panel) {
            panel.style.display = name === activeTab ? "block" : "none";
            panel.classList.toggle("active", name === activeTab);
        }
        if (btn) btn.classList.toggle("active", name === activeTab);
    });
    if (activeTab === "stats") {
        saveLastViewedStats?.();
        animateStatsFromLastView?.();
    } else if (activeTab === "recent") {
        saveLastViewedStats?.();
        renderRecentGames?.();
    } else if (activeTab === "friends") {
        populateFriendsTab?.();
    } else if (activeTab === "inventory") {
        renderProfileInventoryUI?.();
        renderThemeSelection?.();
        showProfileInventoryCategory(localStorage.getItem("profileInventoryCategory") || "portraits");
    } else if (activeTab === "overview") {
        syncProfileOverviewStats?.();
        const overviewList = document.getElementById("recent-games-list-overview");
        if (overviewList && typeof renderRecentGames === "function") {
            const mainList = document.getElementById("recent-games-list");
            renderRecentGames();
            if (mainList) overviewList.innerHTML = mainList.innerHTML || '<div class="profile-empty-card">No recent games yet.</div>';
        }
    }
    localStorage.setItem("profileLastTab", activeTab);
};

const originalOpenProfileModal = window.openProfileModal;
window.openProfileModal = async function() {
    await originalOpenProfileModal?.();
    syncProfileOverviewStats?.();
    renderProfileInventoryUI?.();
    window.showProfileTab("inventory");
};

window.openCraftingModalFromHome = openCraftingModalFromHome;
window.closeCraftingModal = closeCraftingModal;
window.showProfileInventoryCategory = showProfileInventoryCategory;
window.setProfileInventoryFilter = setProfileInventoryFilter;
window.renderProfileInventoryUI = renderProfileInventoryUI;

const SHARKDLE_ANDROID_VERSION = "1.0.1";
const SHARKDLE_ANDROID_VERSION_CODE = 10001;
const SHARKDLE_ANDROID_UPDATE_MANIFEST_URL = "https://raw.githubusercontent.com/Noobler28/Sharkdle/main/Mobile%20Release/latest.json";
const SHARKDLE_ANDROID_DOWNLOAD_URL = "https://github.com/Noobler28/Sharkdle/tree/main/Mobile%20Release";

function compareVersionStrings(a = "0.0.0", b = "0.0.0") {
    const left = String(a).split(".").map(part => Number.parseInt(part, 10) || 0);
    const right = String(b).split(".").map(part => Number.parseInt(part, 10) || 0);
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
        const diff = (left[index] || 0) - (right[index] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

function isNewerAndroidRelease(release = {}) {
    const remoteCode = Number(release.versionCode || 0);
    if (remoteCode && remoteCode > SHARKDLE_ANDROID_VERSION_CODE) return true;
    if (remoteCode && remoteCode <= SHARKDLE_ANDROID_VERSION_CODE) return false;
    return compareVersionStrings(release.version, SHARKDLE_ANDROID_VERSION) > 0;
}

function openAndroidUpdateDownload(url = SHARKDLE_ANDROID_DOWNLOAD_URL) {
    const target = url || SHARKDLE_ANDROID_DOWNLOAD_URL;
    try {
        const opened = window.open(target, "_system");
        if (opened) return;
    } catch (error) {
        // Fall through to same-window navigation.
    }
    window.location.href = target;
}

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function showAndroidUpdatePrompt(release = {}) {
    const version = release.version || "new";
    const sessionKey = `sharkdle-update-dismissed-${version}`;
    if (sessionStorage.getItem(sessionKey) === "true") return;
    if (document.getElementById("android-update-prompt")) return;

    const downloadUrl = release.downloadUrl || SHARKDLE_ANDROID_DOWNLOAD_URL;
    const backdrop = document.createElement("div");
    backdrop.id = "android-update-prompt";
    backdrop.className = "app-update-backdrop";
    backdrop.innerHTML = `
        <section class="app-update-card" role="dialog" aria-modal="true" aria-labelledby="android-update-title">
            <span>Android update</span>
            <h2 id="android-update-title">Update available</h2>
            <p>${escapeHtml(release.message || "A new Sharkdle Android update is available.")}</p>
            <div class="app-update-actions">
                <a href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener">Download update</a>
                <button type="button" data-update-dismiss>Later</button>
            </div>
        </section>
    `;

    const closePrompt = () => {
        sessionStorage.setItem(sessionKey, "true");
        backdrop.remove();
    };

    backdrop.querySelector("[data-update-dismiss]")?.addEventListener("click", closePrompt);
    backdrop.querySelector("a")?.addEventListener("click", event => {
        event.preventDefault();
        closePrompt();
        openAndroidUpdateDownload(downloadUrl);
    });

    document.body.appendChild(backdrop);
}

async function checkSharkdleAndroidUpdate(options = {}) {
    const manifestUrl = options.manifestUrl || SHARKDLE_ANDROID_UPDATE_MANIFEST_URL;
    try {
        const response = await fetch(manifestUrl, { cache: "no-store" });
        if (!response.ok) return null;
        const release = await response.json();
        if (!isNewerAndroidRelease(release)) return release;
        showAndroidUpdatePrompt(release);
        return release;
    } catch (error) {
        return null;
    }
}

function isCordovaAndroidShell() {
    return Boolean(window.cordova) && /Android/i.test(navigator.userAgent || "");
}

function initAndroidUpdateCheck() {
    if (!isCordovaAndroidShell()) return;
    checkSharkdleAndroidUpdate();
}

if (window.cordova) {
    document.addEventListener("deviceready", initAndroidUpdateCheck, false);
}

window.checkSharkdleAndroidUpdate = checkSharkdleAndroidUpdate;
window.isNewerAndroidRelease = isNewerAndroidRelease;
window.showAndroidUpdatePrompt = showAndroidUpdatePrompt;
