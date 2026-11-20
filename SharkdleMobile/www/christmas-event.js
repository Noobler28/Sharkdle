/* Christmas Part 2: Santa Jaws' win-to-open countdown calendar. */
(() => {
    "use strict";
    const YEAR = 2026;
    const DAY_MS = 86400000;
    const START = Date.UTC(YEAR, 11, 1);
    const END = Date.UTC(YEAR + 1, 0, 1);
    const DAY_COUNT = 31;
    const CRATE_REWARDS = {
        1: { summer: 2 }, 4: { thanksgiving: 2 }, 6: { christmas: 2 }, 9: { halloween: 2 },
        13: { legacy: 3 }, 16: { valentines: 2 }, 18: { stpatricks: 3 }, 20: { easter: 3 },
        23: { christmas: 5 }, 27: { legacy: 5 }, 30: { newyears: 5 }, 31: { newyears: 10 }
    };
    const DAILY_REWARDS = {
        2: { pearls: 100 }, 3: { xp: 10000 }, 5: { spins: 1 }, 7: { passLevels: 1 },
        8: { shields: 1 }, 10: { xp: 15000 }, 11: { profileIcon: true }, 12: { spins: 2 },
        14: { pearls: 150 }, 15: { passLevels: 1 }, 17: { xp: 25000 }, 19: { shields: 2 },
        21: { passLevels: 2 }, 22: { pearls: 300 }, 24: { profileTheme: true },
        25: { premiumSpins: 1 }, 26: { xp: 50000 }, 28: { pearls: 500 }, 29: { spins: 3 }
    };
    const rewardFor = day => ({ ...(DAILY_REWARDS[day] || {}), ...(CRATE_REWARDS[day] ? { crates: CRATE_REWARDS[day] } : {}) });
    const ordinal = day => `${day}${day % 100 >= 11 && day % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[day % 10] || "th")}`;
    const rewardLabel = reward => {
        const parts = [];
        if (reward.crates) for (const [crate, count] of Object.entries(reward.crates)) parts.push(`${count} ${({ summer: "Summer", thanksgiving: "Thanksgiving", christmas: "Christmas", halloween: "Halloween", legacy: "Classic OG", valentines: "Valentine's", stpatricks: "St Patrick's", easter: "Easter", newyears: "New Year's" })[crate]} Crate${count === 1 ? "" : "s"}`);
        if (reward.pearls) parts.push(`${reward.pearls} Pearls`);
        if (reward.xp) parts.push(`${reward.xp.toLocaleString()} XP`);
        if (reward.spins) parts.push(`${reward.spins} Wheel Spin${reward.spins === 1 ? "" : "s"}`);
        if (reward.premiumSpins) parts.push("Premium Wheel Spin");
        if (reward.passLevels) parts.push(`${reward.passLevels} Shark Pass Level${reward.passLevels === 1 ? "" : "s"}`);
        if (reward.shields) parts.push(`${reward.shields} Streak Shield${reward.shields === 1 ? "" : "s"}`);
        if (reward.profileIcon) parts.push("Exclusive Profile Icon");
        if (reward.profileTheme) parts.push("Exclusive Profile Theme");
        return parts.join(" + ");
    };
    const rewardEmoji = reward => {
        const icons = [];
        if (reward.crates) icons.push("🎁");
        if (reward.pearls) icons.push("🫧");
        if (reward.xp) icons.push("✨");
        if (reward.spins || reward.premiumSpins) icons.push("🎡");
        if (reward.passLevels) icons.push("🦈");
        if (reward.shields) icons.push("🛡️");
        if (reward.profileIcon) icons.push("🖼️");
        if (reward.profileTheme) icons.push("🌊");
        return icons.join(" ") || "🎁";
    };
    const state = { part: 1, previewUid: null, previewPart: null, previewDay: 1,
        previewWon: false, previewClaims: new Set(), uid: null, wins: new Set(), claims: new Set(), loaded: false,
        loading: false, opening: false, busy: false };
    const admin = () => Boolean(currentUser?.uid && isDeveloperUid(currentUser.uid));
    const previewing = () => admin() && state.previewUid === currentUser.uid && state.previewPart !== null;
    const activePart = () => previewing() ? state.previewPart : state.part;
    const configRef = () => db.collection("globalConfig").doc("christmasEvent");
    const userRef = uid => db.collection("userStats").doc(uid);
    const dayAt = (now = Date.now()) => now >= START && now < END ? Math.floor((now - START) / DAY_MS) + 1 : 0;
    const daysLeft = (now = Date.now()) => Math.max(0, Math.ceil((Date.UTC(YEAR, 11, 25) - now) / DAY_MS));
    const viewedDay = () => previewing() ? state.previewDay : dayAt();
    const ownsState = () => currentUser?.uid && currentUser.uid === state.uid;
    const hasWin = day => previewing() ? state.previewWon && day === state.previewDay : ownsState() && state.wins.has(day);
    const hasClaim = day => previewing() ? state.previewClaims.has(day) : ownsState() && state.claims.has(day);
    const rerender = () => { if (!state.opening && typeof renderCommunityBossPanel === "function") renderCommunityBossPanel(); };

    function statusFor(day, now = Date.now()) {
        if (hasClaim(day)) return "opened";
        if (previewing()) return day === state.previewDay ? state.previewWon ? "ready" : "win-needed" : "locked";
        if (now >= END) return "ended";
        if (now < START + (day - 1) * DAY_MS) return "locked";
        if (hasWin(day)) return "ready";
        return day === dayAt(now) ? "win-needed" : "missed";
    }

    async function refresh() {
        const uid = currentUser?.uid;
        if (!uid || !db || state.loading) return;
        state.loading = true;
        if (state.uid !== uid) {
            state.uid = uid; state.wins = new Set(); state.claims = new Set(); state.loaded = false;
        }
        try {
            const [wins, claims] = await Promise.all([
                userRef(uid).collection("christmasCalendarWins").get({ source: "server" }),
                userRef(uid).collection("christmasCalendarClaims").get({ source: "server" })
            ]);
            if (currentUser?.uid !== uid) return;
            state.wins = new Set(wins.docs.map(doc => Number(doc.id)));
            state.claims = new Set(claims.docs.map(doc => Number(doc.id)));
            state.loaded = true;
            window.SharkdleCorners?.check('calendar', { gifts: state.claims.size });
        } catch (error) {
            console.warn("Christmas calendar could not load:", error);
        } finally {
            state.loading = false;
            rerender();
            if (currentUser?.uid && currentUser.uid !== uid) refresh();
        }
    }

    async function recordWin(mode) {
        if (!currentUser?.uid || !db || activePart() !== 2) return;
        if (previewing()) { state.previewWon = true; rerender(); return; }
        const day = dayAt(), uid = currentUser.uid;
        if (!day) return;
        const winRef = userRef(uid).collection("christmasCalendarWins").doc(String(day));
        try {
            const created = await db.runTransaction(async tx => {
                const config = await tx.get(configRef());
                const win = await tx.get(winRef);
                if (config.data()?.part !== 2 || win.exists || dayAt() !== day) return false;
                tx.set(winRef, { uid, day, mode: mode === "daily" ? "daily" : "infinite", wonAt: firebase.firestore.FieldValue.serverTimestamp() });
                return true;
            });
            if (currentUser?.uid !== uid) return;
            await refresh();
            if (created && state.wins.has(day) && !state.claims.has(day)) showNotification("Santa Jaws has a present for you! Open today's Christmas calendar gift.", "success", 4500);
        } catch (error) {
            console.warn("Christmas calendar win could not save:", error);
            if (currentUser?.uid === uid) showNotification("Your calendar win could not save. Reconnect and win again to unlock today's gift.", "error", 4500);
        }
    }

    async function animateGift(reward, isPreview, uid = currentUser?.uid) {
        const host = document.getElementById("christmas-present-reveal");
        if (!host) return;
        state.opening = true;
        const previousFocus = document.activeElement;
        try {
            host.hidden = false;
            host.setAttribute("role", "dialog");
            host.setAttribute("aria-modal", "true");
            host.setAttribute("aria-labelledby", "christmas-present-title");
            host.innerHTML = '<div class="christmas-present-modal"><div class="christmas-present-sprite" aria-hidden="true"></div><div class="christmas-present-reward-emoji" aria-hidden="true"></div><h3 id="christmas-present-title">A gift from Santa Jaws</h3><p role="status">Opening your present…</p><button type="button" class="christmas-present-close" disabled>Claim</button></div>';
            const sprite = host.querySelector(".christmas-present-sprite");
            const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
            for (let frame = 0; frame < 12; frame++) {
                if (currentUser?.uid !== uid) { host.hidden = true; return; }
                sprite.style.backgroundPosition = `${(frame % 4) * 100 / 3}% ${Math.floor(frame / 4) * 50}%`;
                if (!reduced) await new Promise(resolve => setTimeout(resolve, 75));
            }
            host.querySelector(".christmas-present-reward-emoji").textContent = rewardEmoji(reward);
            host.querySelector("p").textContent = `${isPreview ? "Preview only · " : "Gift saved! · "}${rewardLabel(reward)}`;
            const closeButton = host.querySelector(".christmas-present-close");
            closeButton.disabled = false;
            closeButton.focus();
            closeButton.onclick = () => {
                host.hidden = true;
                host.innerHTML = "";
                previousFocus?.focus?.();
            };
        } finally { state.opening = false; }
    }

    function markGiftOpened(day) {
        const button = document.querySelector(`[data-calendar-day="${day}"]`);
        if (!button) return;
        button.disabled = true;
        button.className = "christmas-calendar-day opened";
        button.setAttribute("aria-label", `December ${day}, opened`);
        const label = button.querySelector("small");
        if (label) label.textContent = "Opened";
    }

    async function openGift(rawDay) {
        const day = Number(rawDay);
        if (!Number.isInteger(day) || day < 1 || day > DAY_COUNT || state.busy || activePart() !== 2) return;
        if (!currentUser) { openLoginModal(); return; }
        if (statusFor(day) !== "ready") return;
        const uid = currentUser.uid;
        const localProfile = getCurrentProfileData();
        state.busy = true;
        let committed = false;
        try {
            const reward = rewardFor(day);
            if (previewing()) {
                await animateGift(reward, true);
                if (currentUser?.uid === uid && previewing()) {
                    state.previewClaims.add(day);
                    markGiftOpened(day);
                }
                return;
            }
            const profileRef = userRef(uid);
            const winRef = profileRef.collection("christmasCalendarWins").doc(String(day));
            const claimRef = profileRef.collection("christmasCalendarClaims").doc(String(day));
            const result = await db.runTransaction(async tx => {
                const config = await tx.get(configRef());
                const win = await tx.get(winRef);
                const claim = await tx.get(claimRef);
                const snapshot = await tx.get(profileRef);
                if (config.data()?.part !== 2 || Date.now() < START + (day - 1) * DAY_MS || Date.now() >= END || !win.exists || claim.exists) return null;
                const remote = snapshot.data() || {};
                const next = mergeProfilesSafely(localProfile, remote, { preferRemote: true });
                next.totalXP = Math.max(Number(next.totalXP) || 0, Number(remote.totalXP) || 0) + (reward.xp || 0);
                if (reward.passLevels) {
                    const passXp = remote.sharkPassProgressSeasonId === SHARK_PASS_ACTIVE_SEASON_ID
                        ? Math.max(0, Number(remote.sharkPassXP) || 0)
                        : 0;
                    const passLevel = getLevelFromXP(passXp);
                    const targetXp = getXPForLevel(passLevel + reward.passLevels);
                    applySharkPassXpGain(next, Math.max(0, targetXp - passXp));
                } else applySharkPassXpGain(next, reward.xp || 0);
                setPearlCount(next, getPearlCount(remote) + (reward.pearls || 0), { markChanged: true });
                next.crateInventory = getCrateInventory(remote);
                for (const [crate, count] of Object.entries(reward.crates || {})) next.crateInventory[crate] = (next.crateInventory[crate] || 0) + count;
                if (reward.crates) markCrateInventoryChanged(next);
                if (reward.spins || reward.premiumSpins) next.dailySpinBonusSpins = Math.max(0, Number(remote.dailySpinBonusSpins) || 0) + (reward.spins || 0) + (reward.premiumSpins || 0);
                if (reward.shields) next.streakShields = Math.min(3, Math.max(0, Number(remote.streakShields) || 0) + reward.shields);
                if (reward.profileIcon) {
                    const cosmetics = Array.isArray(remote.earnedCosmetics) ? remote.earnedCosmetics.slice() : [];
                    if (!cosmetics.some(item => item?.imagePath === "images/christmasEvent/AdventRewards/ZebraShark.png")) cosmetics.push({ name: "Zebra Shark", imagePath: "images/christmasEvent/AdventRewards/ZebraShark.png", calendarReward: true, source: "Advent 2026", rarity: "exclusive" });
                    next.earnedCosmetics = cosmetics;
                }
                if (reward.profileTheme) next.unlockedCardThemes = [...new Set([...(Array.isArray(remote.unlockedCardThemes) ? remote.unlockedCardThemes : ["default"]), "advent-2026"])] ;
                let completionBonus = false;
                if (day === DAY_COUNT) {
                    const otherClaimRefs = Array.from({ length: DAY_COUNT - 1 }, (_, index) => profileRef.collection("christmasCalendarClaims").doc(String(index + 1)));
                    const otherClaims = await Promise.all(otherClaimRefs.map(ref => tx.get(ref)));
                    completionBonus = otherClaims.every(snapshot => snapshot.exists);
                    if (completionBonus) next.unlockedBadges = [...new Set([...(Array.isArray(remote.unlockedBadges) ? remote.unlockedBadges : ["starter"]), "advent-2026"])] ;
                }
                const payload = { totalXP: next.totalXP, ...getSharkPassSyncPayload(next), pearls: next.pearls,
                    pearlBalanceUpdatedAt: getPearlBalanceUpdatedAt(next), lastUpdated: Date.now() };
                if (reward.crates) Object.assign(payload, { crateInventory: next.crateInventory, crateInventoryUpdatedAt: getCrateInventoryUpdatedAt(next) });
                if (reward.spins || reward.premiumSpins) payload.dailySpinBonusSpins = next.dailySpinBonusSpins;
                if (reward.shields) payload.streakShields = next.streakShields;
                if (reward.profileIcon) payload.earnedCosmetics = next.earnedCosmetics;
                if (reward.profileTheme) payload.unlockedCardThemes = next.unlockedCardThemes;
                if (completionBonus) payload.unlockedBadges = next.unlockedBadges;
                tx.set(profileRef, payload, { merge: true });
                tx.set(claimRef, { uid, day, claimedAt: firebase.firestore.FieldValue.serverTimestamp() });
                return { profile: next, completionBonus };
            });
            if (currentUser?.uid !== uid) return;
            if (!result) { await refresh(); showNotification("This gift is already opened or isn't available right now.", "info", 3500); return; }
            committed = true;
            saveUserProfileLocally(result.profile, { skipRemoteSync: true });
            if (reward.spins || reward.premiumSpins) setDailySpinBonusCount(result.profile, result.profile.dailySpinBonusSpins, uid);
            state.uid = uid; state.claims.add(day);
            window.SharkdleCorners?.check('calendar', { gifts: state.claims.size });
            updateHomeV3Sidebar(result.profile); renderCratesButton();
            if (reward.profileIcon && typeof loadEarnedCosmetics === "function") loadEarnedCosmetics();
            if (reward.profileTheme && typeof renderThemeSelection === "function") renderThemeSelection();
            if (result.completionBonus && typeof updateProfileBadgeUI === "function") updateProfileBadgeUI();
            markGiftOpened(day);
            await animateGift(reward, false, uid);
            if (result.completionBonus) showNotification("All 31 Advent gifts opened! You earned the Exclusive Advent 2026 Badge.", "success", 5000);
        } catch (error) {
            console.warn("Christmas present could not save:", error);
            if (currentUser?.uid === uid) showNotification(committed ? "Your gift was saved. Reopen the calendar to refresh its display." : "Your present could not be saved. Please try again.", committed ? "info" : "error", 3500);
        } finally { state.busy = false; }
    }

    function markup() {
        const day = viewedDay();
        const now = Date.now();
        const message = previewing() ? `Admin preview · December ${day}. No real rewards are granted.`
            : now < START ? "The first present opens on December 1. Win each day to unlock that day's gift."
            : now >= END ? "Santa Jaws' calendar has finished. Merry Christmas!"
            : !currentUser ? "Log in and win a Daily or Infinite game to unlock today's present."
            : !ownsState() || !state.loaded ? "Checking your calendar…"
            : hasClaim(day) ? "Today's present is opened. Come back tomorrow for another gift!"
            : hasWin(day) ? "Your win unlocked today's present. Choose its door below!"
            : "Win a Daily or Infinite game today to unlock your present.";
        return `<section class="winter-event christmas-calendar-event" aria-labelledby="community-boss-modal-title">
            <header class="christmas-calendar-hero"><div class="christmas-calendar-intro"><span class="winter-kicker">CHRISTMAS · PART 2</span><h2 id="community-boss-modal-title">Santa Jaws is here</h2><p>Win a game every day to open a gift from Santa Jaws.</p><strong id="christmas-countdown">${daysLeft()} ${daysLeft() === 1 ? "day" : "days"} until Christmas</strong></div><div class="santa-jaws-portrait"><img src="images/christmasEvent/SantaJaws.png" alt="Santa Jaws wearing a Santa hat"></div><span class="christmas-hero-snow christmas-hero-snow-one" aria-hidden="true">✦</span><span class="christmas-hero-snow christmas-hero-snow-two" aria-hidden="true">✧</span></header>
            <p class="christmas-calendar-status" role="status">${message}</p>
            <div class="christmas-calendar-heading"><div><span class="christmas-section-kicker">YOUR ADVENT CALENDAR</span><h3>December 1–31</h3></div><span>Win each day to unlock its listed gift.<br>Open every gift for the Advent badge.</span></div>
            <div class="christmas-calendar-grid" aria-label="Christmas advent calendar">${Array.from({ length: DAY_COUNT }, (_, i) => {
                const number = i + 1, status = statusFor(number), ready = status === "ready", claimed = status === "opened";
                const label = status === "win-needed" ? "Win to open" : status === "missed" ? "Missed" : status === "ended" ? "Ended" : claimed ? "Opened" : ready ? "Open gift" : "Locked";
                const rewardText = rewardLabel(rewardFor(number));
                return `<button class="christmas-calendar-day ${status}" type="button" data-calendar-day="${number}" aria-label="December ${ordinal(number)} gift, ${label}" ${ready && !state.busy ? "" : "disabled"}><b>${number}</b><span class="christmas-calendar-gift-icon" aria-hidden="true"></span><small>Dec ${ordinal(number)} gift</small><em>${label}</em></button>`;
            }).join("")}</div>
            <div id="christmas-present-reveal" class="christmas-present-reveal" hidden></div>
            <p class="christmas-calendar-fine-print">Win on a gift's date (UTC) to unlock it. Unlocked gifts can be opened through December 31.</p>
            <footer class="winter-footer"><div class="winter-primary-actions"><button type="button" onclick="navigate('Daily/index.html')">Play Daily</button><button type="button" onclick="navigate('Infinite/index.html')">Play Infinite ↗</button></div>${previewing() ? '<button type="button" class="christmas-test-win" onclick="SharkdleChristmas.testWin()">Simulate a win for this preview day</button>' : ""}</footer>
        </section>`;
    }

    function bind() {
        document.querySelectorAll("[data-calendar-day]").forEach(button => { button.onclick = () => openGift(button.dataset.calendarDay); });
    }

    function updateSidebar() {
        const card = document.getElementById("home-community-boss-event");
        if (!card) return;
        const part = activePart();
        card.querySelector(".home-boss-kicker").textContent = `Christmas · Part ${part}${previewing() ? " · Preview" : ""}`;
        card.querySelector(".home-boss-heading strong").textContent = part === 2 ? "Santa Jaws' calendar" : "Protect Stethacanthus";
        card.querySelector(".home-boss-heading img").src = part === 2 ? "images/christmasEvent/SantaJaws.png" : "images/christmasEvent/StevenStethecanthus.png";
        card.classList.toggle("santa-calendar-card", part === 2);
        if (part === 2) {
            document.getElementById("home-community-boss-copy").textContent = "Win a Daily or Infinite game, then open your Christmas gift.";
            const progress = document.getElementById("home-community-boss-progress");
            progress.max = DAY_COUNT; progress.value = ownsState() ? state.claims.size : 0;
            progress.setAttribute("aria-label", "Christmas gifts opened");
            document.getElementById("home-community-boss-progress-label").textContent = `${daysLeft()} days until Christmas`;
        } else document.getElementById("home-community-boss-progress").setAttribute("aria-label", "Community protection progress");
    }

    function preview(part) {
        if (!admin() || state.opening) return;
        state.previewUid = currentUser.uid;
        state.previewPart = part === "live" ? null : Number(part) === 2 ? 2 : 1;
        state.previewDay = Math.max(1, Math.min(DAY_COUNT, Number(document.getElementById("admin-christmas-day")?.value) || 1));
        state.previewWon = false;
        state.previewClaims = new Set();
        adminStatus(`Local ${state.previewPart ? `Part ${state.previewPart} preview` : "live event"}. Everyone else still sees Part ${state.part}.`);
        rerender();
        openCommunityBossEventModal();
    }
    function adminStatus(message) { const el = document.getElementById("admin-christmas-status"); if (el) el.textContent = message; }
    async function publish() {
        if (!admin() || !db) return;
        const part = Number(document.getElementById("admin-christmas-part")?.value) === 2 ? 2 : 1;
        try {
            await configRef().set({ part, updatedBy: currentUser.uid, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            state.part = part; state.previewPart = null;
            adminStatus(`Christmas Part ${part} is active for everyone.`); rerender();
        } catch (error) { console.warn(error); adminStatus("Could not save the event switch. Try again."); }
    }
    window.SharkdleChristmas = { activePart, markup, bind, updateSidebar, refresh, recordWin, preview, publish,
        isOpening: () => state.opening, dayAt, rewardFor, daysLeft,
        testWin: () => { if (previewing()) { state.previewWon = true; rerender(); } }, openGift, statusFor };
    document.addEventListener("DOMContentLoaded", () => {
        if (!db) return;
        let lastDay = dayAt(), lastUid = currentUser?.uid || null;
        configRef().onSnapshot(snapshot => {
            state.part = snapshot.data()?.part === 2 ? 2 : 1;
            if (!previewing()) {
                const select = document.getElementById("admin-christmas-part");
                if (select) select.value = String(state.part);
                adminStatus(`Part ${state.part} is active for everyone. Local previews do not grant real rewards.`);
            }
            if (activePart() === 2) refresh();
            rerender();
        }, error => { console.warn("Christmas part setting could not load:", error); });
        setInterval(() => {
            const countdown = document.getElementById("christmas-countdown");
            if (countdown) countdown.textContent = `${daysLeft()} ${daysLeft() === 1 ? "day" : "days"} until Christmas`;
            if (dayAt() !== lastDay || (currentUser?.uid || null) !== lastUid) {
                lastDay = dayAt(); lastUid = currentUser?.uid || null;
                if (activePart() === 2) { refresh(); rerender(); }
            }
        }, 60000);
    }, { once: true });
})();
