function getPassStatusLabel(level) {
    if (level >= 20) return "Pass Cleared";
    if (level >= 15) return "Apex Hunter";
    if (level >= 10) return "Deep Current";
    if (level >= 5) return "On The Rise";
    return "Getting Started";
}

function getRewardIcon(reward) {
    switch (reward.type) {
        case "pfp":
            return "fa-image";
        case "badge":
            return "fa-award";
        case "theme":
            return "fa-swatchbook";
        default:
            return "fa-star";
    }
}

function getRewardTypeLabel(reward) {
    switch (reward.type) {
        case "pfp":
            return "Profile Picture";
        case "badge":
            return "Badge";
        case "theme":
            return "Profile Theme";
        default:
            return "Reward";
    }
}

function getNextLockedReward(profileData) {
    const level = getCurrentPlayerLevel(profileData);
    return sharkPassRewards.find(reward => reward.level > level) || null;
}

function getMilestoneLevels() {
    return [...new Set(sharkPassRewards.map(reward => reward.level))].sort((a, b) => a - b);
}

function renderPassOverview(profileData) {
    const totalXP = profileData.totalXP || 0;
    const userLevel = getCurrentPlayerLevel(profileData);
    const xpInLevel = getXPInCurrentLevel(totalXP);
    const xpLevelSize = xpIncrements[userLevel] !== undefined
        ? xpIncrements[userLevel]
        : (1000 + (userLevel - 1) * 500);
    const progress = xpLevelSize > 0 ? Math.round((xpInLevel / xpLevelSize) * 100) : 0;
    const nextReward = getNextLockedReward(profileData);
    const unlockedRewards = getUnlockedPassRewards(profileData);

    const currentLevelEl = document.getElementById("current-level");
    const currentXpEl = document.getElementById("current-xp");
    const xpToNextEl = document.getElementById("xp-to-next");
    const bar = document.getElementById("xp-bar-fill");
    const totalXpEl = document.getElementById("pass-total-xp");
    const nextRewardCopy = document.getElementById("next-reward-copy");
    const unlockedCountEl = document.getElementById("pass-unlocked-count");
    const nextMilestoneEl = document.getElementById("pass-next-milestone");
    const statusEl = document.getElementById("pass-status-label");

    if (currentLevelEl) currentLevelEl.textContent = userLevel;
    if (currentXpEl) currentXpEl.textContent = xpInLevel;
    if (xpToNextEl) xpToNextEl.textContent = xpLevelSize;
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    if (totalXpEl) totalXpEl.textContent = totalXP;
    if (unlockedCountEl) unlockedCountEl.textContent = unlockedRewards.length;
    if (statusEl) statusEl.textContent = getPassStatusLabel(userLevel);

    if (nextReward) {
        const xpNeeded = Math.max(0, getXPForLevel(nextReward.level) - totalXP);
        if (nextRewardCopy) {
            nextRewardCopy.textContent = `${xpNeeded} XP to ${nextReward.name} (${getRewardTypeLabel(nextReward)})`;
        }
        if (nextMilestoneEl) {
            nextMilestoneEl.textContent = `Level ${nextReward.level}`;
        }
    } else {
        if (nextRewardCopy) nextRewardCopy.textContent = "Every reward in the pass is unlocked.";
        if (nextMilestoneEl) nextMilestoneEl.textContent = "Complete";
    }
}

function renderPassLoadout(profileData) {
    const loadoutGrid = document.getElementById("pass-loadout-grid");
    if (!loadoutGrid) return;

    const equippedBadge = getBadgeMeta(getEquippedBadge());
    const equippedTheme = getCardThemeMeta(getEquippedCardTheme());
    const unlockedBadges = getUnlockedBadges(profileData.uid || currentUser?.uid || "");

    loadoutGrid.innerHTML = `
        <article class="loadout-card">
            <span class="loadout-label">Equipped PFP</span>
            <div class="loadout-pfp-wrap">
                <img class="loadout-pfp" src="${profileData.profilePicture || "images/pfp/shark1.png"}" alt="Equipped profile picture">
            </div>
            <strong>${profileData.profilePicture ? "Current Portrait" : "Starter Portrait"}</strong>
        </article>
        <article class="loadout-card">
            <span class="loadout-label">Equipped Badge</span>
            <div class="loadout-emoji">${equippedBadge.emoji}</div>
            <strong>${equippedBadge.name}</strong>
        </article>
        <article class="loadout-card">
            <span class="loadout-label">Unlocked Badges</span>
            <div class="loadout-title">${unlockedBadges.length}</div>
            <strong>Badge Collection</strong>
        </article>
        <article class="loadout-card">
            <span class="loadout-label">Profile Theme</span>
            <div class="loadout-theme" style="background:${equippedTheme.preview};"></div>
            <strong>${equippedTheme.name}</strong>
        </article>
    `;
}

function createRewardMarkup(reward, unlocked, isNextReward, variant = "default") {
    const imageMarkup = reward.imagePath
        ? `<img class="pass-reward-image" src="${reward.imagePath}" alt="${reward.name}">`
        : `<div class="pass-reward-icon"><i class="fas ${getRewardIcon(reward)}"></i></div>`;
    const isCompact = variant === "compact";

    return `
        <article class="pass-reward-card ${reward.rarity} ${unlocked ? "unlocked" : "locked"} ${isNextReward ? "next" : ""} ${isCompact ? "compact" : "featured"}">
            <div class="pass-reward-card-top">
                <span class="pass-reward-type">${getRewardTypeLabel(reward)}</span>
                <span class="pass-rarity ${reward.rarity}">${reward.rarity}</span>
            </div>
            ${imageMarkup}
            <h3>${reward.name}</h3>
            ${isCompact ? "" : `<p>${reward.blurb || ""}</p>`}
            <div class="pass-reward-footer">
                <span>Level ${reward.level}</span>
                <span>${unlocked ? "Unlocked" : "Locked"}</span>
            </div>
        </article>
    `;
}

function createFutureTierMarkup(level, rewards, totalXP, nextLevel) {
    const xpNeeded = Math.max(0, getXPForLevel(level) - totalXP);
    const distance = level - nextLevel;
    const tierLabel = distance === 1 ? "Coming Right After" : `${distance} Levels Away`;

    return `
        <article class="pass-tier future-tier">
            <div class="pass-tier-head compact">
                <div>
                    <div class="pass-tier-kicker">${tierLabel}</div>
                    <h3>Level ${level}</h3>
                </div>
                <div class="pass-tier-meta">
                    <span class="pass-tier-state">${xpNeeded} XP needed</span>
                    <span class="pass-tier-count">${rewards.length} reward${rewards.length === 1 ? "" : "s"}</span>
                </div>
            </div>
            <div class="pass-tier-grid compact">
                ${rewards.map(reward => createRewardMarkup(reward, false, false, "compact")).join("")}
            </div>
        </article>
    `;
}

function renderFocusTrack(profileData) {
    const focusShell = document.getElementById("pass-focus-shell");
    if (!focusShell) return;

    const nextReward = getNextLockedReward(profileData);
    const nextTierRewards = nextReward ? sharkPassRewards.filter(reward => reward.level === nextReward.level) : [];
    const xpNeeded = nextReward ? Math.max(0, getXPForLevel(nextReward.level) - (profileData.totalXP || 0)) : 0;

    focusShell.innerHTML = `
        <article class="pass-focus-card next">
            <div class="pass-focus-topline">
                <span class="pass-focus-kicker">Next Tier</span>
                <span class="pass-focus-level">${nextReward ? `Level ${nextReward.level}` : "Complete"}</span>
            </div>
            <h3>${nextReward ? `${xpNeeded} XP Needed` : "Pass fully cleared"}</h3>
            <p>${nextReward ? `Reach level ${nextReward.level} to unlock this next reward wave.` : "You’ve claimed every free reward in the pass."}</p>
            <div class="pass-focus-list">
                ${nextTierRewards.length
                    ? nextTierRewards.map(reward => `<span class="pass-focus-chip ${reward.rarity}">${reward.name}</span>`).join("")
                    : `<span class="pass-focus-empty">No more locked rewards</span>`}
            </div>
        </article>
    `;
}

function renderRewardTrack(profileData) {
    const grid = document.getElementById("level-pfp-grid");
    if (!grid) return;
    const nextReward = getNextLockedReward(profileData);
    const userLevel = getCurrentPlayerLevel(profileData);
    const totalXP = profileData.totalXP || 0;
    const futureLevels = getMilestoneLevels().filter(level => level > userLevel);

    if (!nextReward || !futureLevels.length) {
        grid.innerHTML = `
            <section class="pass-tier unlocked next-tier">
                <div class="pass-tier-head">
                    <div>
                        <div class="pass-tier-kicker">Pass Complete</div>
                        <h3>All Rewards Claimed</h3>
                    </div>
                </div>
            </section>
        `;
        return;
    }

    const nextLevel = futureLevels[0];
    const nextTierRewards = sharkPassRewards.filter(reward => reward.level === nextLevel);
    const laterLevels = futureLevels.slice(1);
    const xpNeeded = Math.max(0, getXPForLevel(nextLevel) - totalXP);

    grid.innerHTML = `
        <div class="pass-track-shell">
            <section class="pass-tier locked next-tier featured-tier">
                <div class="pass-tier-head">
                    <div>
                        <div class="pass-tier-kicker">Next Upcoming Rewards</div>
                        <h3>Level ${nextLevel}</h3>
                    </div>
                    <div class="pass-tier-meta">
                        <span class="pass-tier-state">${xpNeeded} XP needed</span>
                        <span class="pass-tier-count">${nextTierRewards.length} reward${nextTierRewards.length === 1 ? "" : "s"}</span>
                    </div>
                </div>
                <div class="pass-tier-spotlight">
                    <div class="pass-tier-spotlight-copy">
                        <span class="pass-tier-spotlight-label">Up Next</span>
                        <h4>${nextTierRewards.map(reward => reward.name).join(" + ")}</h4>
                        <p>Hit level ${nextLevel} to unlock this reward wave. After that, the track keeps rolling into the later tiers below.</p>
                    </div>
                    <div class="pass-tier-grid featured">
                        ${nextTierRewards.map(reward => createRewardMarkup(reward, false, true, "default")).join("")}
                    </div>
                </div>
            </section>
            ${laterLevels.length ? `
                <section class="pass-track-future">
                    <div class="pass-track-future-head">
                        <div>
                            <div class="pass-tier-kicker">Further Ahead</div>
                            <h3>Future Rewards</h3>
                        </div>
                        <p>Smaller stops on the track so you can see what is coming without the next tier losing focus.</p>
                    </div>
                    <div class="pass-track-future-grid">
                        ${laterLevels.map(level => createFutureTierMarkup(level, sharkPassRewards.filter(reward => reward.level === level), totalXP, nextLevel)).join("")}
                    </div>
                </section>
            ` : ""}
        </div>
    `;
}

async function renderPassUI() {
    if (currentUser && typeof loadUserProfile === "function") {
        try {
            await loadUserProfile();
        } catch (error) {
            console.warn("Unable to refresh profile before rendering Shark Pass:", error);
        }
    }
    const profileData = getCurrentProfileData();
    renderPassOverview(profileData);
    renderPassLoadout(profileData);
    renderRewardTrack(profileData);

    if (typeof syncEarnedCosmetics === "function" && currentUser) {
        try {
            await syncEarnedCosmetics();
        } catch (error) {
            console.warn("Unable to sync earned cosmetics while rendering Shark Pass:", error);
        }
    }
}

document.addEventListener("DOMContentLoaded", renderPassUI);

if (typeof firebase !== "undefined" && firebase.auth) {
    firebase.auth().onAuthStateChanged(() => {
        renderPassUI();
    });
}
