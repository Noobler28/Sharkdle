(function () {
    'use strict';
    const rewardDefs = {
        xp: { label: 'XP', max: 1000000 }, pearls: { label: 'Pearls', max: 1000000 },
        crates: { label: 'Cosmetic Crates', max: 999 }, halloween: { label: 'Halloween Crates', max: 999 },
        christmas: { label: 'Christmas Crates', max: 999 }, spins: { label: 'Daily Spins', max: 999 },
        streak_shields: { label: 'Streak Shields', max: 3 }
    };
    let preview = null;
    let busy = false;
    function access(expectedUid) {
        if (!isDeveloperSessionActive() || !db || currentUser.emailVerified === false || (expectedUid && currentUser.uid !== expectedUid)) throw new Error('Sign in to your verified developer account first.');
        return currentUser.uid;
    }
    function normalizeRewards(input) {
        const rewards = {};
        for (const [key, raw] of Object.entries(input || {})) {
            if (!rewardDefs[key]) throw new Error('Unknown reward type.');
            const count = Number(raw);
            if (!Number.isSafeInteger(count) || count < 0 || count > rewardDefs[key].max) throw new Error(`${rewardDefs[key].label}: enter a whole number from 0 to ${rewardDefs[key].max.toLocaleString()}.`);
            if (count > 0) rewards[key] = count;
        }
        if (!Object.keys(rewards).length) throw new Error('Choose at least one reward.');
        return rewards;
    }
    function summary(rewards) {
        return Object.entries(rewards).map(([key, amount]) => `${amount.toLocaleString()} ${rewardDefs[key].label}`).join(' + ');
    }
    function buildPayload(data, rewards, runId, uid, now) {
        let next = { ...data };
        const payload = {}, grants = [];
        for (const [type, amount] of Object.entries(normalizeRewards(rewards))) {
            if (type === 'halloween' || type === 'christmas') {
                const inventory = normalizeCrateInventory(next.crateInventory || {});
                inventory[type] = (Number(inventory[type]) || 0) + amount;
                Object.assign(payload, { crateInventory: inventory, crateInventoryUpdatedAt: now });
                Object.assign(next, payload);
                grants.push({ name: rewardDefs[type].label, value: `+${amount}`, detail: 'Developer giveaway' });
            } else {
                if (type === 'streak_shields' && getStreakShieldCount(next) >= 3) continue;
                const grant = buildAdminCompensationPayload({ data: next }, type, amount, now);
                Object.assign(payload, grant.payload); Object.assign(next, grant.payload); grants.push(grant.grant);
            }
        }
        if (grants.length) Object.assign(payload, {
            lastUpdated: now,
            adminCompensationNotice: { id: `${runId}-${uid}`, createdAt: now, grantedBy: currentUser.uid, grants },
            lastAdminCompensation: { type: 'giveaway', amount: 1, label: summary(rewards), grantedAt: now, grantedBy: currentUser.uid }
        });
        return { payload, grants };
    }
    async function onlinePlan(rewards, mode = '') {
        const owner = access(), now = Date.now();
        const snapshot = await db.collection('userStats').where('lastActive', '>=', now - 5 * 60 * 1000).get();
        access(owner);
        const recipients = snapshot.docs.filter(doc => {
            const data = doc.data() || {}, active = getAdminTimestampMillis(data.lastActive);
            const label = String(data.lastActivity?.label || data.lastActivity || '').toLowerCase();
            return active >= now - 5 * 60 * 1000 && active <= now + 60000 && (!mode || label.includes(mode));
        }).map(doc => ({ uid: doc.id, name: String(doc.data()?.username || doc.id).slice(0, 60) }));
        return { id: `drop-${now}-${Math.random().toString(36).slice(2, 12)}`, createdAt: now, createdBy: owner, rewards: normalizeRewards(rewards), recipients, audience: mode || 'all-online' };
    }
    async function execute(plan, resume = false) {
        const owner = access();
        const runRef = db.collection('adminRewardRuns').doc(plan.id);
        let run;
        if (resume) {
            const snapshot = await runRef.get(); access(owner);
            if (!snapshot.exists) throw new Error('Giveaway not found.');
            run = snapshot.data();
        } else {
            if (plan.createdBy !== owner || Date.now() - plan.createdAt > 120000) throw new Error('Refresh the online preview before sending.');
            if (!plan.recipients?.length) throw new Error('No signed-in players matched this preview.');
            run = { ...plan, rewards: normalizeRewards(plan.rewards), status: 'sending' };
            await db.runTransaction(async tx => {
                const existing = await tx.get(runRef); access(owner);
                if (!existing.exists) tx.set(runRef, run);
                else run = existing.data();
            });
        }
        access(owner);
        const rewards = normalizeRewards(run.rewards);
        if (!Array.isArray(run.recipients) || !run.recipients.length) throw new Error('This giveaway has no recipients.');
        let delivered = 0, skipped = 0, failed = 0;
        // Each recipient has an atomic receipt, so retries and resumed runs cannot pay twice.
        for (let offset = 0; offset < run.recipients.length; offset += 4) {
            access(owner);
            const results = await Promise.allSettled(run.recipients.slice(offset, offset + 4).map(async recipient => {
                const receipt = runRef.collection('recipients').doc(recipient.uid);
                const player = db.collection('userStats').doc(recipient.uid);
                return db.runTransaction(async tx => {
                    const [received, snapshot] = await Promise.all([tx.get(receipt), tx.get(player)]);
                    access(owner);
                    if (received.exists) return received.data().status;
                    const now = Date.now();
                    const built = snapshot.exists ? buildPayload(snapshot.data() || {}, rewards, plan.id, recipient.uid, now) : { grants: [] };
                    const status = built.grants.length ? 'delivered' : 'skipped';
                    if (built.grants.length) tx.set(player, built.payload, { merge: true });
                    tx.set(receipt, { uid: recipient.uid, status, grantedAt: now, grantedBy: owner });
                    return status;
                });
            }));
            for (const result of results) {
                if (result.status === 'rejected') failed++;
                else if (result.value === 'delivered') delivered++;
                else skipped++;
            }
        }
        access(owner);
        const result = { delivered, skipped, failed, status: failed ? 'interrupted' : 'complete', finishedAt: Date.now() };
        await runRef.set(result, { merge: true });
        return result;
    }
    const byId = id => document.getElementById(id);
    const status = text => setAdminAbuseStatus('admin-tools-status', text);
    async function action(callback) {
        if (busy) return;
        try {
            access(); busy = true;
            document.querySelectorAll('[data-dev-tool]').forEach(el => { el.disabled = true; });
            await callback();
        } catch (error) { status(error.message || String(error)); }
        finally {
            busy = false;
            document.querySelectorAll('[data-dev-tool]').forEach(el => { el.disabled = false; });
            if (byId('admin-drop-send')) byId('admin-drop-send').disabled = !preview;
        }
    }
    async function refreshSelf(owner) {
        access(owner);
        await loadUserProfile({ rethrowErrors: true });
        access(owner); updateAuthUI(); renderCratesButton(); updateSpinWheelUI();
    }
    window.adminOwnAllCosmetics = () => action(async () => {
        status('Unlocking the cosmetic collection for your account…');
        const owner = access();
        await window.unlockAllCosmetics();
        await refreshSelf(owner);
        status('You now own all available portraits, badges, themes and titles. Current Shark Pass completed for testing.');
    });
    window.adminSelfReward = preset => action(async () => {
        const owner = access();
        const presets = { pearls: { pearls: 10000 }, crates: { crates: 25 }, seasonal: { halloween: 10, christmas: 10 }, spins: { spins: 10 }, shields: { streak_shields: 3 }, xp: { xp: 10000 }, bundle: { pearls: 10000, crates: 25, halloween: 10, christmas: 10, spins: 10, streak_shields: 3 } };
        const rewards = normalizeRewards(presets[preset]);
        const now = Date.now();
        const result = await execute({ id: `self-${now}-${Math.random().toString(36).slice(2, 12)}`, createdAt: now, createdBy: owner, rewards, recipients: [{ uid: owner, name: 'You' }], audience: 'developer' });
        if (result.failed) throw new Error('Reward interrupted. Resume it from giveaway history.');
        await refreshSelf(owner);
        status(result.delivered ? `Added to your account: ${summary(rewards)}. Shields stay capped at 3.` : 'Your shields are already full.');
        await history();
    });
    function formRewards() {
        return normalizeRewards(Object.fromEntries(Object.keys(rewardDefs).map(type => [type, Number(byId(`admin-drop-${type}`)?.value || 0)])));
    }
    window.adminDropPreset = preset => {
        if (!isDeveloperSessionActive() || busy) return;
        const presets = { welcome: { pearls: 100, crates: 1 }, party: { xp: 1000, pearls: 250, crates: 2, spins: 1 }, seasonal: { halloween: 1, christmas: 1 }, shields: { streak_shields: 1 } };
        for (const type of Object.keys(rewardDefs)) if (byId(`admin-drop-${type}`)) byId(`admin-drop-${type}`).value = presets[preset]?.[type] || 0;
        window.adminInvalidateDrop();
    };
    window.adminInvalidateDrop = () => {
        if (busy) return;
        preview = null; if (byId('admin-drop-send')) byId('admin-drop-send').disabled = true;
        if (byId('admin-drop-preview')) byId('admin-drop-preview').textContent = 'Choose rewards, then preview the online recipients.';
    };
    window.adminPreviewDrop = () => action(async () => {
        preview = null;
        status('Finding signed-in players active in the last 5 minutes…');
        preview = await onlinePlan(formRewards(), byId('admin-drop-mode')?.value || '');
        byId('admin-drop-preview').textContent = `${summary(preview.rewards)} per player · ${preview.recipients.length} recipients\n${preview.recipients.slice(0, 30).map(p => p.name).join(', ')}${preview.recipients.length > 30 ? ', …' : ''}\nPreview valid for 2 minutes. Guests cannot receive saved rewards.`;
        status(preview.recipients.length ? 'Preview ready. Send rewards when ready.' : 'No signed-in players matched. Refresh the preview later.');
        if (!preview.recipients.length) preview = null;
    });
    window.adminSendDrop = () => action(async () => {
        if (!preview) throw new Error('Preview recipients first.');
        const plan = preview; preview = null;
        status(`Sending ${summary(plan.rewards)} to ${plan.recipients.length} players…`);
        const result = await execute(plan);
        status(`Giveaway ${result.status}: ${result.delivered} delivered, ${result.skipped} skipped, ${result.failed} failed.${result.failed ? ' Resume from history to retry unpaid players.' : ''}`);
        await history();
    });
    window.adminResumeDrop = id => action(async () => {
        status('Resuming giveaway. Existing receipts prevent duplicate rewards…');
        const result = await execute({ id }, true);
        status(`Giveaway ${result.status}: ${result.delivered} delivered, ${result.skipped} skipped, ${result.failed} failed.`);
        await history();
    });
    async function history() {
        const owner = access();
        const snapshot = await db.collection('adminRewardRuns').orderBy('createdAt', 'desc').limit(10).get();
        access(owner);
        const list = byId('admin-drop-history'); if (!list) return;
        list.replaceChildren();
        for (const doc of snapshot.docs) {
            const run = doc.data(), row = document.createElement('div'); row.className = 'admin-abuse-card';
            const text = document.createElement('p');
            text.textContent = `${formatAdminDateTime(run.createdAt)} · ${summary(normalizeRewards(run.rewards))} · ${run.recipients?.length || 0} players · ${run.status}`;
            row.appendChild(text);
            if (run.status !== 'complete') {
                const button = document.createElement('button'); button.type = 'button'; button.className = 'admin-abuse-btn'; button.textContent = 'Resume unpaid rewards'; button.dataset.devTool = ''; button.disabled = busy;
                button.addEventListener('click', () => window.adminResumeDrop(doc.id)); row.appendChild(button);
            }
            list.appendChild(row);
        }
        if (!snapshot.docs.length) list.textContent = 'No giveaways sent yet.';
    }
    window.adminRefreshDropHistory = () => action(history);
    window.SharkdleAdminTools = { normalizeRewards, buildPayload, onlinePlan, execute };
})();
