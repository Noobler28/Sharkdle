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
                <button onclick="event.stopPropagation(); removeFriend('${uid}')" class="action-btn remove-btn">
                    <span class="btn-icon">❌</span>
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
    { id: "coral-bloom", name: "Coral Bloom", unlockAchievement: "pacific_master", preview: "linear-gradient(135deg, rgba(255, 122, 156, 0.28), rgba(255, 176, 109, 0.2) 38%, rgba(15, 92, 112, 0.96))" },
    { id: "deep-abyss", name: "Deep Abyss", unlockAchievement: "guess_master", preview: "linear-gradient(135deg, rgba(17, 255, 203, 0.14), rgba(5, 18, 34, 0.94) 42%, rgba(1, 6, 15, 0.99))" },
    { id: "storm-current", name: "Storm Current", unlockAchievement: "duel_won", preview: "linear-gradient(135deg, rgba(117, 202, 255, 0.26), rgba(67, 126, 255, 0.2) 34%, rgba(9, 20, 47, 0.98))" },
    { id: "pearl-reef", name: "Pearl Reef", unlockAchievement: "secret_command_found", preview: "linear-gradient(135deg, rgba(250, 240, 214, 0.3), rgba(164, 244, 231, 0.18) 42%, rgba(24, 72, 92, 0.96))" },
    { id: "volcanic-ember", name: "Volcanic Ember", preview: "linear-gradient(135deg, rgba(255, 120, 70, 0.3), rgba(255, 66, 66, 0.18) 34%, rgba(44, 10, 24, 0.98) 72%, rgba(16, 5, 14, 1))" },
    { id: "kelp-canopy", name: "Kelp Canopy", preview: "linear-gradient(135deg, rgba(166, 223, 110, 0.18), rgba(65, 121, 70, 0.22) 34%, rgba(12, 49, 43, 0.98) 70%, rgba(6, 24, 21, 1))" },
    { id: "glacier-shine", name: "Glacier Shine", preview: "linear-gradient(135deg, rgba(232, 247, 255, 0.34), rgba(132, 214, 255, 0.18) 36%, rgba(35, 80, 118, 0.92) 72%, rgba(10, 31, 52, 1))" }
];

const CRATE_DROP_CHANCE = 0.35;
const GLOBAL_XP_EVENT_CONFIG_PATH = {
    collection: "globalConfig",
    doc: "xpEvent"
};
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
    }
};

const crateRarityWeights = {
    common: 58,
    rare: 28,
    epic: 10,
    legendary: 4
};
const CRATE_LEGENDARY_PITY_THRESHOLD = 25;

const crateDuplicateXpRewards = {
    common: 40,
    rare: 85,
    epic: 160,
    legendary: 320
};

const crateRewardPool = [
    { id: "crate-pfp-pyjama", type: "pfp", name: "Pyjama Shark", imagePath: "images/cratePfp/Shark24.png", rarity: "common", blurb: "Unlock the Pyjama Shark profile picture." },
    { id: "crate-badge-reef-glint", type: "badge", badgeId: "reef-glint", name: "Driftwood", rarity: "common", blurb: "Unlock the Driftwood badge." },
    { id: "crate-pfp-japanese-bullhead", type: "pfp", name: "Japanese Bullhead Shark", imagePath: "images/cratePfp/Shark25.png", rarity: "rare", blurb: "Unlock the Japanese Bullhead Shark profile picture." },
    { id: "crate-badge-kelp-warden", type: "badge", badgeId: "kelp-warden", name: "Smelly Boot", rarity: "rare", blurb: "Unlock the Smelly Boot badge." },
    { id: "crate-theme-volcanic-ember", type: "theme", themeId: "volcanic-ember", name: "Volcanic Ember", rarity: "rare", blurb: "Unlock the Volcanic Ember theme." },
    { id: "crate-pfp-frilled", type: "pfp", name: "Frilled Shark", imagePath: "images/cratePfp/Shark23.png", rarity: "epic", blurb: "Unlock the Frilled Shark profile picture." },
    { id: "crate-badge-trench-myth", type: "badge", badgeId: "trench-myth", name: "Message Bottle", rarity: "epic", blurb: "Unlock the Message Bottle badge." },
    { id: "crate-theme-kelp-canopy", type: "theme", themeId: "kelp-canopy", name: "Kelp Canopy", rarity: "epic", blurb: "Unlock the Kelp Canopy theme." },
    { id: "crate-pfp-megamouth", type: "pfp", name: "Megamouth Shark", imagePath: "images/cratePfp/Shark22.png", rarity: "legendary", blurb: "Unlock the Megamouth Shark profile picture." },
    { id: "crate-badge-aurora-fin", type: "badge", badgeId: "aurora-fin", name: "Doubloon", rarity: "legendary", blurb: "Unlock the Doubloon badge." },
    { id: "crate-theme-glacier-shine", type: "theme", themeId: "glacier-shine", name: "Glacier Shine", rarity: "legendary", blurb: "Unlock the Glacier Shine theme." }
];

let crateOpeningInProgress = false;
let pendingProfileSyncTimeout = null;
let pendingAuthStateClearTimeout = null;
let globalXpEventOverride = null;
let globalXpEventUnsubscribe = null;
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
    { level: 20, type: "badge", name: "Apex", badgeId: "apex-voyager", rarity: "legendary", blurb: "The final Shark Pass badge." }
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
    "aurora-fin": { emoji: "🌊" }
};

const badgeRarityMeta = {
    core: { label: "Core", className: "core" },
    code: { label: "Code", className: "code" },
    special: { label: "Special", className: "special" },
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
    "reef-glint": { emoji: "🐚" },
    "kelp-warden": { emoji: "🌿" },
    "trench-myth": { emoji: "⚓" },
    "aurora-fin": { emoji: "🌊" }
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

function getClaimedAchievementIds() {
    return JSON.parse(localStorage.getItem("claimedAchievements") || "[]");
}

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
        reef: Math.max(0, Number(rawInventory?.reef) || 0)
    };
}

function getCrateInventory(profileData = getCurrentProfileData()) {
    return normalizeCrateInventory(profileData.crateInventory || {});
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

function getCrateRewardsByRarity(rarity) {
    return crateRewardPool.filter(reward => reward.rarity === rarity);
}

function getOpenedCrateCount(profileData = getCurrentProfileData()) {
    const storedCount = Math.max(0, Number(profileData?.cratesOpened) || 0);
    if (storedCount > 0) return storedCount;
    return crateRewardPool.filter(reward => isCrateRewardOwned(profileData, reward)).length;
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
    if (!activeEvent) {
        return {
            baseXp: safeBaseXp,
            totalXp: safeBaseXp,
            bonusXp: 0,
            multiplier: 1,
            event: null
        };
    }

    const totalXp = Math.round(safeBaseXp * activeEvent.multiplier);
    return {
        baseXp: safeBaseXp,
        totalXp,
        bonusXp: totalXp - safeBaseXp,
        multiplier: activeEvent.multiplier,
        event: activeEvent
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

    banner.classList.remove("hidden");
    timer.textContent = `${activeEvent.previewMode ? "Preview ends in" : "Ends in"} ${formatEventTimeRemaining(activeEvent.endMs - Date.now())}`;
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

    if (!currentUser) {
        cratesBtn.classList.add("hidden");
        return;
    }

    const crateCount = getCrateInventory().reef;
    countEl.textContent = crateCount;
    cratesBtn.classList.remove("hidden");
}

function renderCratesModal() {
    const countValue = document.getElementById("crate-count-value");
    const statusCopy = document.getElementById("crate-status-copy");
    const openBtn = document.getElementById("open-crate-btn");
    const instantToggle = document.getElementById("crate-instant-toggle");
    const pityCopy = document.getElementById("crate-pity-copy");
    if (!countValue || !statusCopy || !openBtn || !instantToggle || !pityCopy) return;

    const profileData = getCurrentProfileData();
    const crateCount = getCrateInventory(profileData).reef;
    const cratesSinceLegendary = getCratesSinceLegendary(profileData);
    const pityReady = isLegendaryPityReady(profileData);
    const cratesUntilPity = getCratesUntilLegendaryPity(profileData);

    countValue.textContent = crateCount;
    instantToggle.checked = getCrateInstantOpenEnabled(profileData);
    renderCratesButton();
    pityCopy.textContent = pityReady
        ? "Next crate is guaranteed legendary."
        : `${cratesUntilPity} crate${cratesUntilPity === 1 ? "" : "s"} until guaranteed legendary.`;

    if (crateCount <= 0) {
        statusCopy.textContent = "You don't have any crates to open.";
        openBtn.disabled = true;
        openBtn.style.opacity = "0.5";
    } else {
        statusCopy.textContent = getCrateInstantOpenEnabled(profileData)
            ? "Instant open is enabled."
            : "Animation reveal is enabled.";
        openBtn.disabled = false;
        openBtn.style.opacity = "1";
    }
}

function renderCrateDropsModal() {
    const rewardGrid = document.getElementById("crate-drops-grid");
    if (!rewardGrid) return;
    const profileData = getCurrentProfileData();

    rewardGrid.innerHTML = crateRewardPool.map(reward => {
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
    if (!currentUser) {
        openLoginModal();
        return;
    }
    renderCratesModal();
    const modal = document.getElementById("cratesModal");
    if (modal) modal.classList.remove("hidden");
}

function openCrateDropsModal() {
    renderCrateDropsModal();
    document.getElementById("crateDropsModal")?.classList.remove("hidden");
}

function closeCratesModal() {
    const modal = document.getElementById("cratesModal");
    if (modal) modal.classList.add("hidden");
    closeCrateUnboxOverlay();
    crateOpeningInProgress = false;
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
    const duplicateReward = isCrateRewardOwned(profileData, reward);
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
        instantCrateOpen: getCrateInstantOpenEnabled(profileData),
        totalXP: Math.max(0, Number(profileData.totalXP) || 0),
        earnedCosmetics: Array.isArray(profileData.earnedCosmetics) ? profileData.earnedCosmetics : [],
        unlockedBadges: Array.isArray(profileData.unlockedBadges) ? profileData.unlockedBadges : ["starter"],
        unlockedCardThemes: Array.isArray(profileData.unlockedCardThemes) ? profileData.unlockedCardThemes : ["default"],
        lastUpdated: profileData.lastUpdated,
        ...buildCosmeticSyncPayload(profileData)
    }, { merge: true });
}

function openCrateUnboxOverlay() {
    const overlay = document.getElementById("crateUnboxOverlay");
    const crate = document.getElementById("crate-unbox-crate");
    const burst = document.getElementById("crate-unbox-burst");
    const copy = document.getElementById("crate-unbox-copy");
    const reveal = document.getElementById("crate-overlay-reveal");
    if (overlay) overlay.classList.remove("hidden");
    if (crate) crate.className = "crate-unbox-crate";
    if (burst) burst.className = "crate-unbox-burst";
    if (copy) copy.textContent = "The cosmetic crate is opening...";
    if (reveal) {
        reveal.classList.add("hidden");
        reveal.innerHTML = "";
    }
}

function closeCrateUnboxOverlay() {
    const overlay = document.getElementById("crateUnboxOverlay");
    const reveal = document.getElementById("crate-overlay-reveal");
    if (overlay) overlay.classList.add("hidden");
    if (reveal) {
        reveal.classList.add("hidden");
        reveal.innerHTML = "";
    }
}

function showCrateOverlayReward(reward) {
    const crate = document.getElementById("crate-unbox-crate");
    const burst = document.getElementById("crate-unbox-burst");
    const copy = document.getElementById("crate-unbox-copy");
    const reveal = document.getElementById("crate-overlay-reveal");
    if (crate) crate.classList.add("opening", `rarity-${reward.rarity}`);
    if (burst) burst.classList.add("active", `rarity-${reward.rarity}`);
    if (copy) copy.textContent = `${reward.name} dropped from the cosmetic crate.`;
    if (reveal) {
        reveal.classList.remove("hidden");
        reveal.innerHTML = `
            <div class="crate-reveal-card crate-reveal-card-${reward.rarity}">
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

function finalizeCrateRewardPresentation(reward, duplicateReward, duplicateXpAward) {
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
    }

    if (typeof loadAvailablePFPs === "function") loadAvailablePFPs();
    if (typeof loadEarnedCosmetics === "function") loadEarnedCosmetics();
    if (typeof renderThemeSelection === "function") renderThemeSelection();
    if (typeof renderBadgeSelection === "function") renderBadgeSelection();
    if (typeof updateProfileBadgeUI === "function") updateProfileBadgeUI();
    if (typeof window.unlockAchievement === "function") {
        window.unlockAchievement("crate_opened");
    } else {
        const unlockedAchievements = JSON.parse(localStorage.getItem("unlockedAchievements") || "[]");
        if (!unlockedAchievements.includes("crate_opened")) {
            unlockedAchievements.push("crate_opened");
            localStorage.setItem("unlockedAchievements", JSON.stringify(unlockedAchievements));
        }
    }
    renderCratesModal();
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
        return;
    }

    crateOpeningInProgress = true;
    inventory[crateId] -= 1;
    profileData.crateInventory = normalizeCrateInventory(inventory);
    profileData.cratesOpened = getOpenedCrateCount(profileData) + 1;
    const rewardRarity = pickCrateRewardRarity(profileData);
    const rarityRewards = getCrateRewardsByRarity(rewardRarity);
    const reward = rarityRewards[Math.floor(Math.random() * rarityRewards.length)] || crateRewardPool[0];
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
        finalizeCrateRewardPresentation(reward, duplicateReward, duplicateXpAward);
        crateOpeningInProgress = false;
        return;
    }

    openCrateUnboxOverlay();

    await new Promise(resolve => {
        crateSkipTimeout = setTimeout(resolve, 950);
    });

    if (duplicateReward) {
        showCrateOverlayDuplicateReward(reward, duplicateXpAward);
    } else {
        showCrateOverlayReward(reward);
    }

    await new Promise(resolve => {
        crateSkipTimeout = setTimeout(resolve, 1850);
    });
    finalizeCrateRewardPresentation(reward, duplicateReward, duplicateXpAward);
    await new Promise(resolve => setTimeout(resolve, 1200));
    closeCrateUnboxOverlay();
    crateOpeningInProgress = false;
}

function maybeAwardCrateDrop(source = "win") {
    if (!currentUser) return false;
    if (Math.random() > CRATE_DROP_CHANCE) return false;

    const profileData = getCurrentProfileData();
    const inventory = getCrateInventory(profileData);
    inventory.reef += 1;
    profileData.crateInventory = normalizeCrateInventory(inventory);
    persistCrateProfileUpdate(profileData).catch(error => console.warn("Crate drop sync failed:", error));
    renderCratesButton();
    renderCratesModal();

    showNotification(`Cosmetic Crate dropped from your ${source}!`, "success", 3800);
    return true;
}

window.openCratesModal = openCratesModal;
window.openCrateDropsModal = openCrateDropsModal;
window.closeCratesModal = closeCratesModal;
window.closeCrateDropsModal = closeCrateDropsModal;
window.openCrate = openCrate;
window.toggleCrateInstantOpen = toggleCrateInstantOpen;
window.maybeAwardCrateDrop = maybeAwardCrateDrop;
window.getOpenedCrateCount = getOpenedCrateCount;
window.getActiveLimitedTimeXpEvent = getActiveLimitedTimeXpEvent;
window.applyLimitedTimeXpBonus = applyLimitedTimeXpBonus;
window.forceXpEventPreview = function(enabled = true) {
    localStorage.setItem("forceXpEventPreview", enabled ? "true" : "false");
    ensureXpEventBannerTimer();
    return enabled ? "XP event preview enabled." : "XP event preview disabled.";
};

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
    const crateReward = crateRewardPool.find(reward => reward.type === "badge" && reward.badgeId === badgeId);
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
    const crateReward = crateRewardPool.find(reward => reward.type === "badge" && reward.badgeId === badge.id);
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
    if (crateRewardPool.some(reward => reward.type === "badge" && reward.badgeId === badge.id)) return 500;
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
    return getUnlockedBadges(profileData.uid || currentUser?.uid || "").map(badge => badge.id);
}

function getUnlockedCardThemeIds(profileData = getCurrentProfileData()) {
    return getUnlockedCardThemes(profileData).map(theme => theme.id);
}

function buildCosmeticSyncPayload(profileData = getCurrentProfileData()) {
    return {
        equippedBadge: profileData.equippedBadge || "starter",
        equippedCardTheme: profileData.equippedCardTheme || "default",
        unlockedBadges: getUnlockedBadgeIds(profileData),
        unlockedCardThemes: getUnlockedCardThemeIds(profileData)
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
    profileHero.className = `profile-hero-card theme-${themeId}`;
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
    unlockedThemes.forEach(theme => {
        const button = document.createElement("button");
        button.className = `theme-option ${theme.id === equippedTheme ? "active" : ""}`;
        button.onclick = () => setEquippedCardTheme(theme.id);
        button.innerHTML = `
            <span class="theme-swatch" style="background:${theme.preview};"></span>
            <span>${theme.name}</span>
        `;
        container.appendChild(button);
    });
    applyProfileCardTheme(equippedTheme);
}
const allBadges = [
    { id: "starter", name: "Starter", emoji: "🦈", description: "Default badge for all players." },
    { id: "dev", name: "Developer", emoji: "🖥️", description: "Awarded only to the developer.", devOnly: true },
    { id: "tester", name: "Tester", emoji: "🎮", description: "Awarded for testing via code redeem.", codeUnlock: true }
];

const currentPassBadgeDefs = [
    { id: "reef-scout", name: "Shiver", emoji: "🦈", description: "A Shark Pass badge for reaching level 3.", passLevel: 3 },
    { id: "bronze-fin", name: "Pup", emoji: "🪸", description: "A Shark Pass badge for reaching level 5.", passLevel: 5 },
    { id: "night-diver", name: "Juvenile", emoji: "🌙", description: "A Shark Pass badge for reaching level 8.", passLevel: 8 },
    { id: "abyss-explorer", name: "Oceanic", emoji: "💙", description: "A Shark Pass badge for reaching level 10.", passLevel: 10 },
    { id: "open-water-ace", name: "Subadult", emoji: "✨", description: "A Shark Pass badge for reaching level 12.", passLevel: 12 },
    { id: "storm-tracker", name: "Prime", emoji: "⚡", description: "A Shark Pass badge for reaching level 18.", passLevel: 18 },
    { id: "apex-voyager", name: "Apex", emoji: "👑", description: "A Shark Pass badge for reaching level 20.", passLevel: 20 }
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
    { id: "aurora-fin", name: "Doubloon", emoji: "🪙", description: "A badge found in Cosmetic Crates." }
);

function getUnlockedBadges(uid) {
    // Always unlock starter badge
    const badges = [allBadges[0]];
    if (isDeveloperUid(uid)) badges.push(allBadges[1]);
    const profileData = getCurrentProfileData();
    const playerLevel = getCurrentPlayerLevel(profileData);
    // Unlock tester badge if code redeemed
    try {
        if (profileData.testerBadgeUnlocked || hasRedeemedCode('TESTER')) {
            if (!badges.some(b => b.id === 'tester')) badges.push(allBadges.find(b => b.id === 'tester'));
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
    getStoredUnlockedBadgeIds(profileData).forEach(badgeId => {
        const badgeMeta = getBadgeMeta(badgeId);
        if (badgeMeta && !badges.some(existing => existing.id === badgeMeta.id)) {
            badges.push(badgeMeta);
        }
    });
    return badges.map(badge => getBadgeMeta(badge.id));
}

function getEquippedBadge() {
    const profileData = getCurrentProfileData();
    const equipped = profileData.equippedBadge || "starter";
    // Only allow equipped badge if it's unlocked
    const unlocked = getUnlockedBadges(profileData.uid || (currentUser && currentUser.uid));
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

// Navigation helper function
function navigate(page) {
    window.location.href = page;
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
    'TESTER': { badge: 'tester', description: 'Unlocks the Tester badge (🎮)' }
};

delete redeemCodes.TESTER;

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
        await ensureLoginStreakRewards();
        ensureNavProfileButton();
        // Sync local stats to Firebase
        syncStatsToFirebase();
        // Initialize daily login - this will use the loaded streak data
        await initializeDailyLogin();
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
        // DO NOT clear userProfile
    }
    

    // Always update index stats from localStorage
    if (authContainer) {
        updateIndexStats();
    }
    renderCratesButton();
    ensureXpEventBannerTimer();

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
            bonusMsg.style.transition = "all 0.3s ease";
            bonusMsg.onmouseover = () => bonusMsg.style.transform = "scale(1.02)";
            bonusMsg.onmouseout = () => bonusMsg.style.transform = "scale(1)";
            bonusMsg.onclick = () => openDailyLoginModal();
            const cycleNumber = Math.floor((currentLoginDay - 1) / 7) + 1;
            const cycleEndDay = cycleNumber * 7;
            bonusMsg.innerHTML = `🔥 Login Streak: <strong>${streak} days</strong> - Day ${currentLoginDay}/${cycleEndDay} (Click to view rewards)`;
        } else {
            bonusMsg.style.display = "none";
        }
    } else {
    }

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

function ensureNavProfileButton() {
    const authContainer = document.getElementById("auth-container");
    const loginBtn = document.getElementById("login-btn");
    if (!authContainer) return;

    let profileBtn = document.getElementById("profile-btn-nav");
    if (!profileBtn) {
        profileBtn = document.createElement("button");
        profileBtn.id = "profile-btn-nav";
        profileBtn.className = "profile-btn";
        profileBtn.onclick = () => openProfileModal();
        profileBtn.style.cssText = "background: none; border: none; cursor: pointer; padding: 5px; border-radius: 50%; display: flex; align-items: center;";
        profileBtn.innerHTML = `<img id="nav-profile-pic" src="images/pfp/shark1.png" alt="Profile" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #00b4d8;">`;
        authContainer.insertBefore(profileBtn, loginBtn);
    }

    const profileData = getCurrentProfileData();
    const navProfilePic = document.getElementById("nav-profile-pic");
    if (navProfilePic) {
        navProfilePic.src = profileData.profilePicture || "images/pfp/shark1.png";
    }
}

function isDefaultEmailUsername(username) {
    if (!currentUser?.email || !username) return false;
    return username === currentUser.email.split("@")[0];
}

function hasMeaningfulProfileData(profile) {
    if (!profile || typeof profile !== 'object') return false;
    return Boolean(
        profile.totalXP ||
        profile.gamesPlayed ||
        profile.wins ||
        profile.losses ||
        profile.totalGuesses ||
        profile.duelGames ||
        profile.duelWins ||
        normalizeCrateInventory(profile.crateInventory).reef ||
        (Array.isArray(profile.earnedCosmetics) && profile.earnedCosmetics.length) ||
        (profile.username && !isDefaultEmailUsername(profile.username)) ||
        (profile.profilePicture && profile.profilePicture !== "images/pfp/shark1.png")
    );
}

function hasPersistedProfileIdentity(profile) {
    if (!profile || typeof profile !== 'object') return false;
    return Boolean(
        (profile.username && !isDefaultEmailUsername(profile.username)) ||
        (profile.profilePicture && profile.profilePicture !== "images/pfp/shark1.png") ||
        (profile.profilePic && profile.profilePic !== "images/pfp/shark1.png") ||
        (profile.equippedBadge && profile.equippedBadge !== "starter") ||
        (profile.equippedCardTheme && profile.equippedCardTheme !== "default") ||
        normalizeCrateInventory(profile.crateInventory).reef ||
        (Array.isArray(profile.earnedCosmetics) && profile.earnedCosmetics.length) ||
        (Array.isArray(profile.unlockedAchievements) && profile.unlockedAchievements.length) ||
        (Array.isArray(profile.claimedAchievements) && profile.claimedAchievements.length)
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

function getCalendarDayDifference(fromDateKey, toDateKey) {
    if (!fromDateKey || !toDateKey) return NaN;
    const fromDate = parseDateLikeValue(fromDateKey);
    const toDate = parseDateLikeValue(toDateKey);
    if (!fromDate || !toDate) return NaN;
    const fromUtc = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    const toUtc = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
    return Math.round((toUtc - fromUtc) / 86400000);
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
    if (!currentUser || !authUser || currentUser.uid !== authUser.uid || !db || typeof syncStatsToFirebase !== "function") return;
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
    if (!profileData.lastUpdated) profileData.lastUpdated = Date.now();
    if (profileData.profilePicture && !profileData.profilePic) {
        profileData.profilePic = profileData.profilePicture;
    }
    if (profileData.profilePic && !profileData.profilePicture) {
        profileData.profilePicture = profileData.profilePic;
    }
    if (profileData.username) {
        cachePreferredUsername(profileData.username, profileData.uid);
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
    if (!options.skipRemoteSync) {
        scheduleRemoteProfileSync();
    }
}

function showCrateOverlayDuplicateReward(reward, xpAward) {
    const crate = document.getElementById("crate-unbox-crate");
    const burst = document.getElementById("crate-unbox-burst");
    const copy = document.getElementById("crate-unbox-copy");
    const reveal = document.getElementById("crate-overlay-reveal");
    if (crate) crate.classList.add("opening", `rarity-${reward.rarity}`);
    if (burst) burst.classList.add("active", `rarity-${reward.rarity}`);
    if (copy) copy.textContent = `${reward.name} was a duplicate and converted into XP.`;
    if (reveal) {
        reveal.classList.remove("hidden");
        reveal.innerHTML = `
            <div class="crate-reveal-card crate-reveal-card-${reward.rarity}">
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
    // Note: We intentionally do NOT clear claimedAchievements/unlockedAchievements here
    // because those are synced to Firebase and should persist across logout/login
    // They will be properly loaded when the user logs back in
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
    const localCrateInventory = normalizeCrateInventory(localProfile.crateInventory);
    const firebaseCrateInventory = normalizeCrateInventory(firebaseData.crateInventory);
    const preferredCrateInventory = localUpdatedMs >= firebaseUpdatedMs ? localCrateInventory : firebaseCrateInventory;
    const preferredCratesOpened = maxNumeric(localProfile.cratesOpened, firebaseData.cratesOpened);
    const preferredCratesSinceLegendary = localUpdatedMs >= firebaseUpdatedMs
        ? getCratesSinceLegendary(localProfile)
        : getCratesSinceLegendary(firebaseData);
    const preferredInstantCrateOpen = localUpdatedMs >= firebaseUpdatedMs
        ? getCrateInstantOpenEnabled(localProfile)
        : getCrateInstantOpenEnabled(firebaseData);

    return {
        uid: currentUser.uid,
        username: preferredUsername,
        email: currentUser.email,
        profilePicture: firebaseData.profilePicture || firebaseData.profilePic || localProfile.profilePicture || localProfile.profilePic || "images/pfp/shark1.png",
        profilePic: firebaseData.profilePicture || firebaseData.profilePic || localProfile.profilePicture || localProfile.profilePic || "images/pfp/shark1.png",
        avatar: firebaseData.avatar || localProfile.avatar || "🦈",
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
        totalXP: maxNumeric(localProfile.totalXP, firebaseData.totalXP || firebaseData.totalGuesses),
        duelGames: maxNumeric(localProfile.duelGames, firebaseData.duelGames),
        duelWins: maxNumeric(localProfile.duelWins, firebaseData.duelWins),
        cratesOpened: preferredCratesOpened,
        cratesSinceLegendary: preferredCratesSinceLegendary,
        instantCrateOpen: preferredInstantCrateOpen,
        earnedCosmetics: getUnifiedCosmeticList(localProfile.earnedCosmetics, firebaseData.earnedCosmetics, "imagePath"),
        testerBadgeUnlocked: Boolean(firebaseData.testerBadgeUnlocked || localProfile.testerBadgeUnlocked),
        equippedBadge: firebaseData.equippedBadge || localProfile.equippedBadge || "starter",
        equippedCardTheme: firebaseData.equippedCardTheme || localProfile.equippedCardTheme || "default",
        unlockedBadges: getMergedUniqueIds(localProfile.unlockedBadges, firebaseData.unlockedBadges, ["starter"]),
        unlockedCardThemes: getMergedUniqueIds(localProfile.unlockedCardThemes, firebaseData.unlockedCardThemes, ["default"]),
        crateInventory: preferredCrateInventory,
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
        if (fromServer) {
            lastServerHydratedProfileUid = authUser.uid;
        }
        let userData = {};
        let firebaseData = null;
        // If Firestore doc exists and has at least one stat field, use it as source of truth
        if (statsSnap.exists && Object.keys(statsSnap.data() || {}).length > 0) {
            firebaseData = statsSnap.data();
            userData = mergeProfilesSafely(localProfile, firebaseData);
            saveUserProfileLocally(userData, { skipRemoteSync: true });
            // Ensure legacy localStorage keys are updated for compatibility with other parts of the app
            localStorage.setItem("games", String(userData.gamesPlayed || 0));
            localStorage.setItem("wins", String(userData.wins || 0));
            localStorage.setItem("losses", String(userData.losses || 0));
            if (userData.totalXP !== undefined) {
                localStorage.setItem("totalXP", String(userData.totalXP || 0));
            }
            // Load redeemed codes from Firebase
            localStorage.setItem("redeemedCodes", JSON.stringify(Array.isArray(firebaseData.redeemedCodes) ? firebaseData.redeemedCodes : []));
            // Load login streak data from Firebase
            if (firebaseData.loginStreak !== undefined) {
                localStorage.setItem("loginStreak", firebaseData.loginStreak);
            } else {
                localStorage.removeItem("loginStreak");
            }
            const normalizedLastLoginDate = normalizeStoredDateValue(firebaseData.lastLoginDate);
            if (normalizedLastLoginDate) {
                localStorage.setItem("lastLoginDate", normalizedLastLoginDate);
            } else {
                localStorage.removeItem("lastLoginDate");
            }
            if (firebaseData.currentLoginDay !== undefined) {
                localStorage.setItem("currentLoginDay", firebaseData.currentLoginDay);
            } else {
                localStorage.removeItem("currentLoginDay");
            }
            const normalizedModalShownDate = normalizeStoredDateValue(firebaseData.dailyLoginModalShownToday);
            if (normalizedModalShownDate) {
                localStorage.setItem(getDailyLoginModalShownStorageKey(currentUser.uid), normalizedModalShownDate);
            } else {
                localStorage.removeItem(getDailyLoginModalShownStorageKey(currentUser.uid));
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
            ) {
                await statsRef.set({
                    claimedAchievements: mergedClaimedAchievements,
                    unlockedAchievements: mergedUnlockedAchievements
                }, { merge: true });
            }
        } else if (hasMeaningfulProfileData(localProfile)) {
            userData = mergeProfilesSafely(localProfile, {});
            // Only seed remote stats if we positively confirmed from the server that the doc was empty.
            // This prevents cache-fallback reads from clobbering real cloud stats on login.
            if (fromServer) {
                await statsRef.set(userData, { merge: true });
            } else {
                console.warn("Skipped seeding userStats from local profile because snapshot was cache-fallback.");
            }
            saveUserProfileLocally(userData, { skipRemoteSync: true });
        } else {
            const cachedPreferredUsername = getStoredPreferredUsername();
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
                instantCrateOpen: false,
                earnedCosmetics: [],
                testerBadgeUnlocked: false,
                equippedBadge: "starter",
                equippedCardTheme: "default",
                unlockedBadges: ["starter"],
                unlockedCardThemes: ["default"],
                crateInventory: normalizeCrateInventory()
            };
            saveUserProfileLocally(userData, { skipRemoteSync: true });
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
    applyProfileCardTheme(userData.equippedCardTheme || "default");

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

function updateIndexStats() {
        const profileData = getCurrentProfileData();

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
}
// expose for game files
window.updateIndexStats = updateIndexStats;

// Profile Tabs Logic
window.showProfileTab = function(tab) {
    const statsTab = document.getElementById('stats-tab');
    const recentTab = document.getElementById('recent-tab');
    const friendsTab = document.getElementById('friends-tab');
    const statsBtn = document.getElementById('stats-tab-btn');
    const recentBtn = document.getElementById('recent-tab-btn');
    const friendsBtn = document.getElementById('friends-tab-btn');

    if (statsTab) statsTab.style.display = tab === 'stats' ? 'block' : 'none';
    if (recentTab) recentTab.style.display = tab === 'recent' ? 'block' : 'none';
    if (friendsTab) friendsTab.style.display = tab === 'friends' ? 'block' : 'none';

    if (statsBtn) statsBtn.classList.toggle('active', tab === 'stats');
    if (recentBtn) recentBtn.classList.toggle('active', tab === 'recent');
    if (friendsBtn) friendsBtn.classList.toggle('active', tab === 'friends');

    if (tab === 'stats') {
        animateStatsFromLastView();
    } else if (tab === 'recent') {
        saveLastViewedStats();
        renderRecentGames();
    } else if (tab === 'friends') {
        populateFriendsTab();
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
        await statsRef.set({ username: newUsername }, { merge: true });
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
            crateInventory: normalizeCrateInventory(localProfile.crateInventory),
            cratesOpened: Math.max(0, Number(localProfile.cratesOpened) || 0),
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

async function manualLoadCloudStats() {
    await loadCloudStats({ manual: true, showSuccessToast: true });
}

function openLoginModal() {
    document.getElementById("loginModal").classList.remove("hidden");
}

function closeLoginModal() {
    document.getElementById("loginModal").classList.add("hidden");
    document.getElementById("login-email").value = "";
    document.getElementById("login-password").value = "";
    document.getElementById("signup-email").value = "";
    document.getElementById("signup-password").value = "";
    document.getElementById("signup-username").value = "";
    document.getElementById("auth-error").style.display = "none";
    switchToLogin();
}

async function openProfileModal() {
    if (currentUser) {
        // Reload profile data when opening modal
        await loadUserProfile().catch(err => console.error("Error loading profile:", err));
        if (document.getElementById("username-edit-container")) {
            cancelUsernameEdit();
        }
        updateProfileBadgeUI();
        renderThemeSelection();
        await ensureFriendDocument(currentUser.uid).catch(err => console.error("Friend network init failed:", err));
        document.getElementById("profileModal").classList.remove("hidden");
    }
}

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
    document.getElementById("profileModal").classList.add("hidden");
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

function openProfilePicModal() {
    // Always refresh user profile from Firestore before showing pfps
    if (typeof loadUserProfile === 'function') {
        loadUserProfile().then(() => {
            loadAvailablePFPs();
            loadEarnedCosmetics().catch(err => console.error("Error loading earned cosmetics:", err));
            document.getElementById("profilePicModal").classList.remove("hidden");
        }).catch(err => {
            // fallback if error
            loadAvailablePFPs();
            loadEarnedCosmetics().catch(err => console.error("Error loading earned cosmetics:", err));
            document.getElementById("profilePicModal").classList.remove("hidden");
        });
    } else {
        loadAvailablePFPs();
        loadEarnedCosmetics().catch(err => console.error("Error loading earned cosmetics:", err));
        document.getElementById("profilePicModal").classList.remove("hidden");
    }
}

function closeProfilePicModal() {
    document.getElementById("profilePicModal").classList.add("hidden");
}

function switchToLogin() {
    document.querySelector(".login-form").classList.remove("hidden");
    document.querySelector(".signup-form").classList.add("hidden");
}

function switchToSignup() {
    document.querySelector(".login-form").classList.add("hidden");
    document.querySelector(".signup-form").classList.remove("hidden");
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

        closeProfilePicModal();
    } catch (error) {
        console.error("Error setting profile picture:", error);
    }
}

function normalizeProfilePictureCards(container) {
    if (!container) return;

    Array.from(container.children).forEach(card => {
        if (!(card instanceof HTMLElement)) return;

        card.style.display = "flex";
        card.style.flexDirection = "column";
        card.style.alignItems = "center";
        card.style.justifyContent = "flex-start";
        card.style.minHeight = "140px";

        const imageSlot = card.querySelector("div");
        if (imageSlot instanceof HTMLElement) {
            imageSlot.style.width = "70px";
            imageSlot.style.height = "70px";
            imageSlot.style.aspectRatio = "1 / 1";
            imageSlot.style.flex = "0 0 70px";
            imageSlot.style.flexShrink = "0";
        }

        const label = card.querySelector("p");
        if (label instanceof HTMLElement) {
            label.style.fontSize = "11px";
            label.style.lineHeight = "1.1";
            label.style.width = "100%";
            label.style.maxWidth = "88px";
            label.style.overflowWrap = "normal";
            label.style.wordBreak = "normal";
            label.style.hyphens = "none";
            label.style.whiteSpace = "normal";
            label.style.textAlign = "center";
            label.style.flex = "0 0 48px";
            label.style.minHeight = "48px";
            label.style.maxHeight = "48px";
            label.style.overflow = "hidden";

            let fontSize = 11;
            while ((label.scrollHeight > label.clientHeight || label.scrollWidth > label.clientWidth) && fontSize > 6) {
                fontSize -= 0.5;
                label.style.fontSize = `${fontSize}px`;
            }
        }
    });
}

function loadAvailablePFPs() {
    const availablePFPsContainer = document.getElementById("available-pfps");
    if (!availablePFPsContainer) return;

    availablePFPsContainer.innerHTML = "";
    const profileData = getCurrentProfileData();
    const earnedCosmetics = Array.isArray(profileData.earnedCosmetics) ? profileData.earnedCosmetics : [];
    const baseCardStyle = "text-align: center; cursor: pointer; transition: all 0.3s ease; padding: 6px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;";
    const earnedImagePaths = new Set(earnedCosmetics.map(cosmetic => cosmetic?.imagePath).filter(Boolean));

    function appendAvailablePfpCard({ imagePath, name, title = "", accentBorder = "rgba(0, 180, 216, 0.3)", accentBackground = "rgba(0, 180, 216, 0.1)", accentText = "#ddd", hoverBackground = "rgba(0, 180, 216, 0.15)", prefix = "" }) {
        const div = document.createElement("div");
        div.style.cssText = baseCardStyle;
        if (title) div.title = title;
        div.onmouseover = () => {
            div.style.transform = "scale(1.08)";
            div.style.background = hoverBackground;
        };
        div.onmouseout = () => {
            div.style.transform = "scale(1)";
            div.style.background = "transparent";
        };
        div.addEventListener("click", (e) => {
            e.preventDefault();
            setProfilePicture(imagePath);
        });
        div.innerHTML = `
            <div style="width: 70px; height: 70px; aspect-ratio: 1 / 1; flex: 0 0 70px; border-radius: 10px; overflow: hidden; background: ${accentBackground}; margin: 0 auto 7px; border: 2px solid ${accentBorder};">
                <img src="${imagePath}" alt="PFP ${name}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
            <p style="margin: 5px 0 0 0; font-size: 11px; font-weight: 600; color: ${accentText};">${prefix}${name}</p>
        `;
        availablePFPsContainer.appendChild(div);
    }

    // display only the five default shark PFPs with their actual names
    const pfps = [
        { filename: "shark1.png", name: "Whale Shark" },
        { filename: "shark2.png", name: "Great White Shark" },
        { filename: "shark3.png", name: "Hammerhead Shark" },
        { filename: "shark4.png", name: "Basking Shark" },
        { filename: "shark5.png", name: "Zebra Shark" }
    ];

    pfps.forEach((pfp, index) => {
        const picPath = `images/pfp/${pfp.filename}`;
        appendAvailablePfpCard({
            imagePath: picPath,
            name: pfp.name
        });
    });

    // Add code PFPs using the helper function for consistent grid layout
    // Check earnedCosmetics from Firebase instead of hasRedeemedCode() which reads from localStorage
    if (earnedCosmetics.some(c => c.imagePath === "images/codePfp/Shark17.png" || c.name === "Wobbegong Shark")) {
        appendAvailablePfpCard({
            imagePath: "images/codePfp/Shark17.png",
            name: "Wobbegong Shark",
            title: "Redeem code reward",
            accentBorder: "#ff6b6b",
            accentBackground: "rgba(255, 107, 107, 0.1)",
            accentText: "#ff6b6b",
            hoverBackground: "rgba(255, 107, 107, 0.15)",
            prefix: "🎁 "
        });
    }

    if (earnedCosmetics.some(c => c.imagePath === "images/codePfp/Shark18.png" || c.name === "Greenland Shark")) {
        appendAvailablePfpCard({
            imagePath: "images/codePfp/Shark18.png",
            name: "Greenland Shark",
            title: "Redeem code reward",
            accentBorder: "#ff6b6b",
            accentBackground: "rgba(255, 107, 107, 0.1)",
            accentText: "#ff6b6b",
            hoverBackground: "rgba(255, 107, 107, 0.15)",
            prefix: "🎁 "
        });
    }

    if (earnedCosmetics.some(c => c.imagePath === "images/codePfp/Shark19.png" || c.name === "Goblin Shark")) {
        appendAvailablePfpCard({
            imagePath: "images/codePfp/Shark19.png",
            name: "Goblin Shark",
            title: "Redeem code reward",
            accentBorder: "#ff6b6b",
            accentBackground: "rgba(255, 107, 107, 0.1)",
            accentText: "#ff6b6b",
            hoverBackground: "rgba(255, 107, 107, 0.15)",
            prefix: "🎁 "
        });
    }

    // Add special unlocked profile pictures that should appear in the available PFP list
    if (earnedCosmetics.some(c => c.name === "Port Jackson Shark")) {
        const div = document.createElement("div");
        div.style.cssText = baseCardStyle;
        div.title = "Leaderboard Top 3 Reward";
        div.onmouseover = () => {
            div.style.transform = "scale(1.08)";
            div.style.background = "rgba(212,175,55,0.22)"; // more golden
        };
        div.onmouseout = () => {
            div.style.transform = "scale(1)";
            div.style.background = "transparent";
        };
        div.addEventListener("click", (e) => {
            e.preventDefault();
            setProfilePicture("images/leaderPfp/Shark19.png");
        });
        div.innerHTML = `
            <div style="width: 70px; height: 70px; aspect-ratio: 1 / 1; flex: 0 0 70px; border-radius: 10px; overflow: hidden; background: linear-gradient(135deg, #222 60%, #D4AF37 100%); margin: 0 auto 7px; border: 2px solid #D4AF37; position:relative;">
                <span style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);font-size:2em;color:#D4AF37;text-shadow:0 2px 8px #000;">👑</span>
                <img src="images/leaderPfp/Shark19.png" alt="PFP Port Jackson Shark" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
            <p style="margin: 5px 0 0 0; font-size: 11px; font-weight: 700; color: #D4AF37;">Port Jackson Shark <span style="color:#D4AF37;font-size:1.1em;vertical-align:middle;">👑</span></p>
        `;
        availablePFPsContainer.appendChild(div);
    }

    if (earnedCosmetics.some(c => c.name === DAY_7_LOGIN_PFP.name || c.imagePath === DAY_7_LOGIN_PFP.imagePath)) {
        const div = document.createElement("div");
        div.style.cssText = baseCardStyle;
        div.title = "Day 7 login reward";
        div.onmouseover = () => {
            div.style.transform = "scale(1.08)";
            div.style.background = "rgba(255, 215, 0, 0.16)";
        };
        div.onmouseout = () => {
            div.style.transform = "scale(1)";
            div.style.background = "transparent";
        };
        div.addEventListener("click", (e) => {
            e.preventDefault();
            setProfilePicture(DAY_7_LOGIN_PFP.imagePath);
        });
        div.innerHTML = `
            <div style="width: 70px; height: 70px; aspect-ratio: 1 / 1; flex: 0 0 70px; border-radius: 10px; overflow: hidden; background: rgba(255, 215, 0, 0.12); margin: 0 auto 7px; border: 2px solid #ffd700;">
                <img src="${DAY_7_LOGIN_PFP.imagePath}" alt="PFP ${DAY_7_LOGIN_PFP.name}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
            <p style="margin: 5px 0 0 0; font-size: 11px; font-weight: 700; color: #ffd700;">🏆 ${DAY_7_LOGIN_PFP.name}</p>
        `;
        availablePFPsContainer.appendChild(div);
    }

    crateRewardPool
        .filter(reward => reward.type === "pfp" && earnedImagePaths.has(reward.imagePath))
        .forEach(reward => {
            appendAvailablePfpCard({
                imagePath: reward.imagePath,
                name: reward.name,
                title: "Cosmetic Crate reward",
                accentBorder: "#ffd47f",
                accentBackground: "rgba(255, 212, 127, 0.12)",
                accentText: "#ffd47f",
                hoverBackground: "rgba(255, 212, 127, 0.14)",
                prefix: "📦 "
            });
        });

    normalizeProfilePictureCards(availablePFPsContainer);
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

        // display in modal
        const earnedPFPsContainer = document.getElementById("earned-pfps");
        if (!earnedPFPsContainer) {
            // Element doesn't exist on this page, silently return
            return;
        }
        const noEarned = document.getElementById("no-earned");
        earnedPFPsContainer.innerHTML = "";

        const cosmeticPfpsShownInAvailable = new Set([
            "Port Jackson Shark",
            DAY_7_LOGIN_PFP.name,
            "Wobbegong Shark",
            "Greenland Shark",
            "Goblin Shark"
        ]);
        crateRewardPool
            .filter(reward => reward.type === "pfp")
            .forEach(reward => {
                cosmeticPfpsShownInAvailable.add(reward.name);
                if (reward.imagePath) cosmeticPfpsShownInAvailable.add(reward.imagePath);
            });
        const cosmeticsForGallery = mergedUnlocked.filter(cosmetic =>
            !cosmeticPfpsShownInAvailable.has(cosmetic.name) &&
            !cosmeticPfpsShownInAvailable.has(cosmetic.imagePath) &&
            !/^images\/codePfp\//.test(cosmetic.imagePath || "")
        );

        if (cosmeticsForGallery.length === 0) {
            if (noEarned) noEarned.style.display = "block";
            return;
        } else if (noEarned) {
            noEarned.style.display = "none";
        }

        cosmeticsForGallery.forEach(cosmetic => {
            const div = document.createElement("div");
            div.style.cssText = "text-align: center; cursor: pointer; transition: all 0.3s ease; padding: 6px; border-radius: 8px; position: relative;";

            // Add hover tooltip for shark pass cosmetics
            if (cosmetic.level && cosmetic.name && !cosmetic.name.includes('Port Jackson Shark')) {
                div.setAttribute('title', `Level ${cosmetic.level} in the Shark Pass`);
            }
            
            // Special styling for Port Jackson Shark (leaderboard pfp)
            const isBlackTip = cosmetic.name === "Port Jackson Shark" && /Shark19\.png/.test(cosmetic.imagePath);
            // Check rarity tiers: Mako (Shark16) is yellow, Epaulette-Oceanic Whitetip (Shark12-15) are pink
            const isMako = /Shark16\.png/.test(cosmetic.imagePath);
            const isRare = /Shark1[2-5]\.png/.test(cosmetic.imagePath);
            let borderColor = "#4caf50";
            let hoverBgColor = "rgba(76, 175, 80, 0.15)";
            let textColor = "#4caf50";
            let bgColor = "rgba(76, 175, 80, 0.1)";
            let crown = "";
            if (isBlackTip) {
                borderColor = "#222";
                hoverBgColor = "rgba(255, 215, 0, 0.18)";
                textColor = "#FFD700";
                bgColor = "linear-gradient(135deg, #222 60%, #FFD700 100%)";
                crown = '<span style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);font-size:2em;color:#FFD700;text-shadow:0 2px 8px #000;">👑</span>';
            } else if (isMako) {
                borderColor = "#ffc107";
                hoverBgColor = "rgba(255, 193, 7, 0.15)";
                textColor = "#ffc107";
                bgColor = "rgba(255, 193, 7, 0.1)";
            } else if (isRare) {
                borderColor = "#e91e63";
                hoverBgColor = "rgba(233, 30, 99, 0.15)";
                textColor = "#e91e63";
                bgColor = "rgba(233, 30, 99, 0.1)";
            }
            div.onmouseover = () => {
                div.style.transform = "scale(1.08)";
                div.style.background = hoverBgColor;
            };
            div.onmouseout = () => {
                div.style.transform = "scale(1)";
                div.style.background = "transparent";
            };
            div.addEventListener("click", e => {
                e.preventDefault();
                setProfilePicture(cosmetic.imagePath);
            });
            div.innerHTML = `
                <div style="width: 70px; height: 70px; aspect-ratio: 1 / 1; flex: 0 0 70px; border-radius: 10px; overflow: hidden; background: ${bgColor}; margin: 0 auto 7px; border: 2px solid ${borderColor}; position:relative;">
                    ${crown}
                    <img src="${cosmetic.imagePath}" alt="${cosmetic.name === 'Port Jackson Shark' ? 'PFP Port Jackson Shark' : cosmetic.name}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <p style="margin: 5px 0 0 0; font-size: 11px; font-weight: 700; color: ${textColor};">${cosmetic.name === 'Port Jackson Shark' ? 'Port Jackson Shark <span style=\"color:#FFD700;font-size:1.1em;vertical-align:middle;\">👑</span>' : cosmetic.name}</p>
            `;
            earnedPFPsContainer.appendChild(div);
        });

        normalizeProfilePictureCards(earnedPFPsContainer);


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

        // Safety valve: never write profile stats when our remote read is cache-fallback only.
        // Waiting for a server-backed read avoids accidental cloud resets on login.
        if (!fromServer) {
            console.warn("Skipping sync: userStats read was cache-fallback (server not confirmed).");
            scheduleRemoteProfileSync(3000);
            return;
        }

        // If remote appears empty, only allow sync when local has meaningful numeric progress.
        // This prevents identity-only local profiles from pushing zeroed stats.
        if (!remoteHasData && !hasMeaningfulProfileData(profileData)) {
            console.warn("Skipping sync: remote profile empty and local profile has no meaningful stats.");
            scheduleRemoteProfileSync(3000);
            return;
        }

        // Never let a fresh/blank local cache clobber a real Firestore profile.
        if (!hasMeaningfulProfileData(profileData) && hasRecoverableRemoteProfile(remoteData)) {
            const recoveredProfile = mergeProfilesSafely(profileData, remoteData);
            saveUserProfileLocally(recoveredProfile, { skipRemoteSync: true });
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
            instantCrateOpen: getCrateInstantOpenEnabled(mergedProfile),
            username: mergedProfile.username || getStoredPreferredUsername() || authUser.email.split("@")[0],
            profilePic: mergedProfile.profilePicture || "images/pfp/shark1.png",
            profilePicture: mergedProfile.profilePicture || "images/pfp/shark1.png",
            earnedCosmetics: Array.isArray(mergedProfile.earnedCosmetics) ? mergedProfile.earnedCosmetics : [],
            testerBadgeUnlocked: Boolean(mergedProfile.testerBadgeUnlocked),
            crateInventory: normalizeCrateInventory(mergedProfile.crateInventory),
            lastUpdated: new Date()
        };
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
        stats.loginStreak = localStorage.getItem("loginStreak") !== null
            ? parseInt(localStorage.getItem("loginStreak")) || 0
            : (Number(remoteData.loginStreak) || 0);
        stats.currentLoginDay = localStorage.getItem("currentLoginDay") !== null
            ? parseInt(localStorage.getItem("currentLoginDay")) || 0
            : (Number(remoteData.currentLoginDay) || 0);
        const normalizedLastLoginDate = normalizeStoredDateValue(localStorage.getItem("lastLoginDate"))
            || normalizeStoredDateValue(remoteData.lastLoginDate);
        if (normalizedLastLoginDate) {
            localStorage.setItem("lastLoginDate", normalizedLastLoginDate);
        } else {
            localStorage.removeItem("lastLoginDate");
        }
        stats.lastLoginDate = normalizedLastLoginDate;
        const normalizedModalShownDate = normalizeStoredDateValue(getStoredDailyLoginModalShownDate())
            || normalizeStoredDateValue(remoteData.dailyLoginModalShownToday);
        if (normalizedModalShownDate) {
            localStorage.setItem(getDailyLoginModalShownStorageKey(), normalizedModalShownDate);
        } else {
            localStorage.removeItem(getDailyLoginModalShownStorageKey());
        }
        stats.dailyLoginModalShownToday = normalizedModalShownDate;

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

// Navigation
function navigate(page){
    window.location.href = page;
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

    if (document.getElementById("available-pfps")) {
        loadAvailablePFPs();
    }
    if (document.getElementById("earned-pfps")) {
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

        // Update localStorage
        localStorage.setItem("lastLoginDate", today);
        localStorage.setItem("currentLoginDay", nextDay);
        localStorage.setItem("loginStreak", streak);
        localStorage.setItem("totalXP", totalXP + xpGain);
        localStorage.setItem(dailyLoginModalShownStorageKey, today);

        // Sync login streak data to Firebase
        if (currentUser) {
            const statsRef = db.collection("userStats").doc(currentUser.uid);
            await statsRef.set({
                lastLoginDate: today,
                currentLoginDay: nextDay,
                loginStreak: streak,
                dailyLoginModalShownToday: today
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
    if (!currentUser) return;
    const currentDay = parseInt(localStorage.getItem("currentLoginDay")) || 1;
    showDailyLoginModal(currentDay, 0);
}

function closeDailyLoginModal() {
    const modal = document.getElementById("dailyLoginModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

// Load stats and streaks
document.addEventListener("DOMContentLoaded", function() {
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

    // Load available PFPs on page load
    if (document.getElementById("available-pfps")) {
        loadAvailablePFPs();
    }

    // If user is already logged in, refresh profile from Firebase immediately
    // This ensures cross-subdomain sync works correctly
    if (currentUser) {
        loadUserProfile().catch(err => console.log("Initial profile load skipped:", err));
    }
});

// ----- REDEEM CODE FUNCTIONS -----
async function redeemCode() {
    if (!currentUser) {
        alert("Please login first to redeem codes.");
        return;
    }

    const codeInput = document.getElementById("redeem-code-input");
    const code = codeInput.value.trim().toUpperCase();
    const messageEl = document.getElementById("redeem-message");

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
                // Check if cosmetic is not already in the list
                if (!userProfile.earnedCosmetics.some(c => c.name === cosmetic.name)) {
                    userProfile.earnedCosmetics.push(cosmetic);
                    newlyUnlockedCosmetics.push(cosmetic);
                }
            });
        }

        // Save to localStorage
        saveUserProfileLocally(userProfile);

        // Sync to Firebase
        if (currentUser) {
            const statsRef = db.collection("userStats").doc(currentUser.uid);
            await statsRef.set({
                totalXP: newXP,
                earnedCosmetics: userProfile.earnedCosmetics
            }, { merge: true });
        }

        // Mark code as redeemed
        addRedeemedCode(code);

        // Sync redeemed codes and tester badge to Firebase BEFORE refreshing UI
        if (currentUser) {
            const redeemedCodesList = getRedeemedCodes();
            const statsRef = db.collection("userStats").doc(currentUser.uid);
            const syncData = { redeemedCodes: redeemedCodesList };
            if (code === 'TESTER' && userProfile.testerBadgeUnlocked) {
                syncData.testerBadgeUnlocked = true;
            }
            // Wait for Firebase sync to complete before refreshing UI
            await statsRef.set(syncData, { merge: true });
        }

        // Show success message
        showRedeemMessage(`✨ Success! You received ${xpAward.totalXp} XP!`, true);
        codeInput.value = '';

        // Refresh profile and cosmetics
        loadUserProfile();
        loadEarnedCosmetics();
        loadAvailablePFPs();

        // Close modal after 2 seconds
        setTimeout(() => {
            closeProfileModal();
        }, 2000);

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

async function startGlobalDoubleXpEvent(hours = 72) {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("❌ Access denied. This command is for developers only.");
        return;
    }
    if (!currentUser) {
        console.log("❌ Error: User must be logged in");
        return;
    }

    const durationHours = Number(hours);
    if (!Number.isFinite(durationHours) || durationHours <= 0) {
        console.log("❌ Usage: startGlobalDoubleXpEvent(72)");
        return;
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
    } catch (error) {
        console.error("❌ Error starting global 2x XP event:", error);
    }
}

async function stopGlobalDoubleXpEvent() {
    if (!firebase.auth().currentUser || !isDeveloperUid(firebase.auth().currentUser.uid)) {
        console.log("❌ Access denied. This command is for developers only.");
        return;
    }
    if (!currentUser) {
        console.log("❌ Error: User must be logged in");
        return;
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
    } catch (error) {
        console.error("❌ Error stopping global 2x XP event:", error);
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
            userProfile.testerBadgeUnlocked = true;
            if (!Array.isArray(userProfile.unlockedBadges)) {
                userProfile.unlockedBadges = ["starter"];
            }
            if (!userProfile.unlockedBadges.includes(codeReward.badge)) {
                userProfile.unlockedBadges.push(codeReward.badge);
            }
        }

        saveUserProfileLocally(userProfile);

        // Sync to Firebase
        if (currentUser) {
            const statsRef = db.collection("userStats").doc(currentUser.uid);
            await statsRef.set({
                totalXP: newXP,
                earnedCosmetics: userProfile.earnedCosmetics,
                testerBadgeUnlocked: userProfile.testerBadgeUnlocked,
                unlockedBadges: userProfile.unlockedBadges
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

        loadUserProfile();
        loadEarnedCosmetics();
        loadAvailablePFPs();

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
    console.log("startGlobalDoubleXpEvent(72) - Start a global 2x XP event");
    console.log("stopGlobalDoubleXpEvent() - Stop the global 2x XP event");
    console.log("addWin() - Add 1 win");
    console.log("addLoss() - Add 1 loss");
    console.log("addGuesses(10) - Add guesses");
    console.log("addLoginDays(7) - Add login days/streak and test login rewards");
    console.log("skipLoginDay(1) - Simulate missing 1 day and re-run daily login logic");
    console.log("addCrates(3) - Add Cosmetic Crates for testing");
    console.log("addTestStats() - Quick test add (500 XP, 10 wins, 5 losses, 15 games, 75 guesses)");
    console.log("revealShark() - Reveal the currently open duel shark");
    console.log("revealShark('duel_id') - Reveal a specific duel shark by id");
    console.log("showStats() - Display current stats");
    console.log("showCommands() - Show this help");
    console.log("================================");
}

