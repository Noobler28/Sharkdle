/* Christmas Part 2: Santa Jaws' win-to-open countdown calendar. */
(() => {
    "use strict";
    const YEAR = 2026;
    const DAY_MS = 86400000;
    const START = Date.UTC(YEAR, 11, 1);
    const END = Date.UTC(YEAR, 11, 26);
    const state = { part: 1, previewUid: null, previewPart: null, previewDay: 1,
        previewWon: false, previewClaims: new Set(), uid: null, wins: new Set(), claims: new Set(), loaded: false,
        loading: false, opening: false, busy: false };
    const admin = () => Boolean(currentUser?.uid && isDeveloperUid(currentUser.uid));
    const previewing = () => admin() && state.previewUid === currentUser.uid && state.previewPart !== null;
    const activePart = () => previewing() ? state.previewPart : state.part;
    const configRef = () => db.collection("globalConfig").doc("christmasEvent");
    const userRef = uid => db.collection("userStats").doc(uid);
    const dayAt = (now = Date.now()) => now >= START && now < END ? Math.floor((now - START) / DAY_MS) + 1 : 0;
    const rewardFor = day => ({ xp: 500, pearls: 100, crates: day % 5 === 0 ? 1 : 0 });
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
        try {
            host.hidden = false;
            host.innerHTML = '<div class="christmas-present-sprite" aria-hidden="true"></div><p role="status">Opening your present…</p>';
            host.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
            const sprite = host.querySelector(".christmas-present-sprite");
            const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
            for (let frame = 0; frame < 12; frame++) {
                if (currentUser?.uid !== uid) { host.hidden = true; return; }
                sprite.style.backgroundPosition = `${(frame % 4) * 100 / 3}% ${Math.floor(frame / 4) * 50}%`;
                if (!reduced) await new Promise(resolve => setTimeout(resolve, 75));
            }
            host.querySelector("p").textContent = `${isPreview ? "Preview only · " : "Gift saved! · "}${reward.xp} XP + ${reward.pearls} pearls${reward.crates ? " + 1 Christmas Crate" : ""}`;
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
        if (!Number.isInteger(day) || day < 1 || day > 25 || state.busy || activePart() !== 2) return;
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
                next.totalXP = Math.max(Number(next.totalXP) || 0, Number(remote.totalXP) || 0) + reward.xp;
                applySharkPassXpGain(next, reward.xp);
                setPearlCount(next, getPearlCount(remote) + reward.pearls, { markChanged: true });
                next.crateInventory = getCrateInventory(remote);
                if (reward.crates) { next.crateInventory.christmas += reward.crates; markCrateInventoryChanged(next); }
                const payload = { totalXP: next.totalXP, ...getSharkPassSyncPayload(next), pearls: next.pearls,
                    pearlBalanceUpdatedAt: getPearlBalanceUpdatedAt(next), lastUpdated: Date.now() };
                if (reward.crates) Object.assign(payload, { crateInventory: next.crateInventory, crateInventoryUpdatedAt: getCrateInventoryUpdatedAt(next) });
                tx.set(profileRef, payload, { merge: true });
                tx.set(claimRef, { uid, day, claimedAt: firebase.firestore.FieldValue.serverTimestamp() });
                return next;
            });
            if (currentUser?.uid !== uid) return;
            if (!result) { await refresh(); showNotification("This gift is already opened or isn't available right now.", "info", 3500); return; }
            committed = true;
            saveUserProfileLocally(result, { skipRemoteSync: true });
            state.uid = uid; state.claims.add(day);
            window.SharkdleCorners?.check('calendar', { gifts: state.claims.size });
            updateHomeV3Sidebar(result); renderCratesButton();
            markGiftOpened(day);
            await animateGift(reward, false, uid);
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
            <header class="christmas-calendar-hero"><div><span class="winter-kicker">CHRISTMAS · PART 2</span><h2 id="community-boss-modal-title">Santa Jaws is coming!</h2><p>A win a day. A little Christmas magic.</p><strong id="christmas-countdown">${daysLeft()} ${daysLeft() === 1 ? "day" : "days"} until Christmas</strong></div><div class="santa-jaws-portrait"><img src="images/christmasEvent/SantaJaws.png" alt="Santa Jaws wearing a Santa hat"></div></header>
            <p class="christmas-calendar-status" role="status">${message}</p>
            <div class="christmas-calendar-heading"><h3>December 1–25</h3><span>Each gift: 500 XP + 100 pearls<br>Every fifth day: +1 Christmas Crate</span></div>
            <div class="christmas-calendar-grid" aria-label="Christmas countdown calendar">${Array.from({ length: 25 }, (_, i) => {
                const number = i + 1, status = statusFor(number), ready = status === "ready", claimed = status === "opened";
                const label = status === "win-needed" ? "Win to open" : status === "missed" ? "Missed" : status === "ended" ? "Ended" : claimed ? "Opened" : ready ? "Open gift" : "Locked";
                return `<button class="christmas-calendar-day ${status}" type="button" data-calendar-day="${number}" aria-label="December ${number}, ${label}" ${ready && !state.busy ? "" : "disabled"}><b>${number}</b><span class="christmas-calendar-gift-icon" aria-hidden="true"></span><small>${label}</small></button>`;
            }).join("")}</div>
            <div id="christmas-present-reveal" class="christmas-present-reveal" hidden></div>
            <p class="christmas-calendar-fine-print">Win on a gift's date (UTC) to unlock it. Unlocked gifts can be opened until December 25 ends.</p>
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
            progress.max = 25; progress.value = ownsState() ? state.claims.size : 0;
            progress.setAttribute("aria-label", "Christmas gifts opened");
            document.getElementById("home-community-boss-progress-label").textContent = `${daysLeft()} days until Christmas`;
        } else document.getElementById("home-community-boss-progress").setAttribute("aria-label", "Community protection progress");
    }

    function preview(part) {
        if (!admin() || state.opening) return;
        state.previewUid = currentUser.uid;
        state.previewPart = part === "live" ? null : Number(part) === 2 ? 2 : 1;
        state.previewDay = Math.max(1, Math.min(25, Number(document.getElementById("admin-christmas-day")?.value) || 1));
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
