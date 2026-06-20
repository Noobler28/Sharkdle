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
        case "crate":
            return "fa-box-open";
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
        case "crate":
            return "Crate";
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
    const seasonNameEl = document.getElementById("pass-season-name");
    const seasonEndsEl = document.getElementById("pass-season-ends");
    const seasonXpEl = document.getElementById("pass-season-xp");
    const nextRewardCard = document.getElementById("pass-next-reward-card");
    const nextRewardMedia = document.getElementById("pass-next-reward-media");
    const nextRewardTypeEl = document.getElementById("pass-next-reward-type");
    const nextRewardNameEl = document.getElementById("pass-next-reward-name");
    const nextRewardLevelEl = document.getElementById("pass-next-reward-level");
    const seasonState = typeof getSharkPassSeasonState === "function" ? getSharkPassSeasonState(profileData) : null;

    if (currentLevelEl) currentLevelEl.textContent = userLevel;
    if (currentXpEl) currentXpEl.textContent = xpInLevel;
    if (xpToNextEl) xpToNextEl.textContent = xpLevelSize;
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    if (totalXpEl) totalXpEl.textContent = totalXP;
    if (unlockedCountEl) unlockedCountEl.textContent = unlockedRewards.length;
    if (statusEl) statusEl.textContent = getPassStatusLabel(userLevel);
    if (seasonState) {
        const endMs = Date.parse(seasonState.season.endsAt);
        const daysLeft = Number.isFinite(endMs) ? Math.max(0, Math.ceil((endMs - Date.now()) / 86400000)) : 0;
        if (seasonNameEl) seasonNameEl.textContent = `${seasonState.season.subtitle}: ${seasonState.season.name}`;
        if (seasonEndsEl) seasonEndsEl.textContent = daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "Ending soon";
        if (seasonXpEl) seasonXpEl.textContent = `${seasonState.claimableXp.toLocaleString()} XP ready`;
    }

    if (nextReward) {
        const xpNeeded = Math.max(0, getXPForLevel(nextReward.level) - totalXP);
        if (nextRewardCopy) {
            nextRewardCopy.textContent = `${xpNeeded} XP to ${nextReward.name} (${getRewardTypeLabel(nextReward)})`;
        }
        if (nextMilestoneEl) {
            nextMilestoneEl.textContent = `Level ${nextReward.level}`;
        }
        if (nextRewardCard) nextRewardCard.classList.remove("complete");
        if (nextRewardMedia) {
            nextRewardMedia.innerHTML = nextReward.imagePath
                ? `<img src="${nextReward.imagePath}" alt="${nextReward.name}">`
                : `<i class="fas ${getRewardIcon(nextReward)}"></i>`;
        }
        if (nextRewardTypeEl) nextRewardTypeEl.textContent = getRewardTypeLabel(nextReward);
        if (nextRewardNameEl) nextRewardNameEl.textContent = nextReward.name;
        if (nextRewardLevelEl) nextRewardLevelEl.textContent = `Level ${nextReward.level} reward`;
    } else {
        if (nextRewardCopy) nextRewardCopy.textContent = "Every reward in the pass is unlocked.";
        if (nextMilestoneEl) nextMilestoneEl.textContent = "Complete";
        if (nextRewardCard) nextRewardCard.classList.add("complete");
        if (nextRewardMedia) nextRewardMedia.innerHTML = `<i class="fas fa-crown"></i>`;
        if (nextRewardTypeEl) nextRewardTypeEl.textContent = "Track Complete";
        if (nextRewardNameEl) nextRewardNameEl.textContent = "All Rewards Claimed";
        if (nextRewardLevelEl) nextRewardLevelEl.textContent = "Nice work";
    }
}

function renderPassMissions(profileData) {
    const missionGrid = document.getElementById("pass-mission-grid");
    const missionSummary = document.getElementById("pass-mission-summary");
    if (!missionGrid || typeof getSharkPassSeasonState !== "function") return;

    const seasonState = getSharkPassSeasonState(profileData);
    if (missionSummary) {
        missionSummary.textContent = `${seasonState.completedCount}/${seasonState.missions.length}`;
    }

    function createMissionCard(mission) {
        const progress = Math.max(0, Math.min(100, Math.round((mission.progress / mission.goal) * 100)));
        const buttonLabel = mission.claimed ? "Claimed" : mission.complete ? `Claim ${mission.xp.toLocaleString()} XP` : `${mission.progress}/${mission.goal}`;
        return `
            <article class="pass-mission-card ${mission.complete ? "complete" : ""} ${mission.claimed ? "claimed" : ""}">
                <div class="pass-mission-icon"><i class="fas ${mission.icon || "fa-bullseye"}"></i></div>
                <div class="pass-mission-body">
                    <div class="pass-mission-top">
                        <h3>${mission.title}</h3>
                        <span>${mission.xp.toLocaleString()} XP</span>
                    </div>
                    <p>${mission.description}</p>
                    <div class="pass-mission-progress" aria-hidden="true">
                        <span style="width:${progress}%"></span>
                    </div>
                    <div class="pass-mission-footer">
                        <span>${mission.progress.toLocaleString()} / ${mission.goal.toLocaleString()}</span>
                        <button type="button" class="pass-mission-claim" ${mission.complete && !mission.claimed ? "" : "disabled"} onclick="claimPassMissionFromUI('${mission.claimKey || mission.id}')">${buttonLabel}</button>
                    </div>
                </div>
            </article>
        `;
    }

    missionGrid.innerHTML = seasonState.groups.map(group => {
        const groupProgress = group.missions.length
            ? Math.round((group.completedCount / group.missions.length) * 100)
            : 0;
        return `
        <section class="pass-quest-group ${group.id}">
            <div class="pass-quest-group-head">
                <div>
                    <span class="pass-quest-kicker">${group.cadence}</span>
                    <h3>${group.label} Quests</h3>
                </div>
                <div class="pass-quest-group-meta">
                    <span>${group.completedCount}/${group.missions.length} complete</span>
                    <span>${group.claimableXp.toLocaleString()} XP ready</span>
                </div>
                <div class="pass-quest-group-progress" aria-hidden="true">
                    <span style="width:${groupProgress}%"></span>
                </div>
            </div>
            <div class="pass-quest-grid ${group.id === "season" ? "season" : ""}">
                ${group.missions.map(createMissionCard).join("")}
            </div>
        </section>
    `;
    }).join("");
}

function bindPassTabs() {
    const tabButtons = Array.from(document.querySelectorAll("[data-pass-tab]"));
    const tabPanels = Array.from(document.querySelectorAll("[data-pass-panel]"));
    if (!tabButtons.length || bindPassTabs.bound) return;

    tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            const target = button.dataset.passTab;
            tabButtons.forEach(tab => {
                const isActive = tab.dataset.passTab === target;
                tab.classList.toggle("active", isActive);
                tab.setAttribute("aria-selected", String(isActive));
            });
            tabPanels.forEach(panel => {
                const isActive = panel.dataset.passPanel === target;
                panel.classList.toggle("active", isActive);
                panel.hidden = !isActive;
            });
        });
    });
    bindPassTabs.bound = true;
}

async function claimPassMissionFromUI(missionId) {
    if (typeof claimSharkPassMission !== "function") return;
    const claimed = await claimSharkPassMission(missionId);
    if (claimed) {
        await renderPassUI();
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

function createRewardTierMarkup(level, rewards, profileData, nextLevel) {
    const userLevel = getCurrentPlayerLevel(profileData);
    const totalXP = profileData.totalXP || 0;
    const unlocked = level <= userLevel;
    const isNext = level === nextLevel;
    const tierState = unlocked ? "Claimed" : isNext ? "Up Next" : "Locked";
    const xpNeeded = Math.max(0, getXPForLevel(level) - totalXP);
    const tierClass = unlocked ? "unlocked" : isNext ? "next-tier" : "locked";

    return `
        <article class="pass-lane-tier ${tierClass}">
            <div class="pass-lane-marker">
                <span>${unlocked ? `<i class="fas fa-check"></i>` : level}</span>
            </div>
            <div class="pass-lane-card">
                <div class="pass-tier-head compact">
                    <div>
                        <div class="pass-tier-kicker">${tierState}</div>
                        <h3>Level ${level}</h3>
                    </div>
                    <div class="pass-tier-meta">
                        <span class="pass-tier-state">${unlocked ? "Unlocked" : `${xpNeeded.toLocaleString()} XP needed`}</span>
                        <span class="pass-tier-count">${rewards.length} reward${rewards.length === 1 ? "" : "s"}</span>
                    </div>
                </div>
                <div class="pass-tier-grid compact">
                    ${rewards.map(reward => createRewardMarkup(reward, unlocked, isNext, "compact")).join("")}
                </div>
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
    const milestoneLevels = getMilestoneLevels();
    const nextLevel = nextReward ? nextReward.level : null;
    const completedCount = milestoneLevels.filter(level => level <= userLevel).length;

    if (!nextReward || !nextLevel) {
        grid.innerHTML = `
            <section class="pass-track-complete">
                <div class="pass-track-complete-icon"><i class="fas fa-crown"></i></div>
                <div>
                    <div class="pass-tier-kicker">Pass Complete</div>
                    <h3>All Rewards Claimed</h3>
                    <p>Every reward in this Shark Pass track is unlocked.</p>
                </div>
            </section>
        `;
        return;
    }

    const nextTierRewards = sharkPassRewards.filter(reward => reward.level === nextLevel);
    const xpNeeded = Math.max(0, getXPForLevel(nextLevel) - totalXP);

    grid.innerHTML = `
        <div class="pass-track-shell">
            <section class="pass-track-highlight">
                <div class="pass-track-highlight-copy">
                    <span class="pass-tier-spotlight-label">Next Reward Wave</span>
                    <h3>Level ${nextLevel}</h3>
                    <p>${xpNeeded.toLocaleString()} XP to unlock ${nextTierRewards.map(reward => reward.name).join(" + ")}.</p>
                </div>
                <div class="pass-track-highlight-stats">
                    <article>
                        <span>${completedCount}</span>
                        <small>tiers cleared</small>
                    </article>
                    <article>
                        <span>${milestoneLevels.length - completedCount}</span>
                        <small>tiers left</small>
                    </article>
                </div>
            </section>
            <section class="pass-lane">
                ${milestoneLevels.map(level => createRewardTierMarkup(
                    level,
                    sharkPassRewards.filter(reward => reward.level === level),
                    profileData,
                    nextLevel
                )).join("")}
            </section>
        </div>
    `;
}

async function renderPassUI() {
    bindPassTabs();
    if (currentUser && typeof loadUserProfile === "function") {
        try {
            await loadUserProfile();
        } catch (error) {
            console.warn("Unable to refresh profile before rendering Shark Pass:", error);
        }
    }
    let profileData = getCurrentProfileData();
    if (typeof syncSharkPassLevelRewards === "function") {
        try {
            const syncResult = await syncSharkPassLevelRewards(profileData);
            profileData = syncResult.profileData || getCurrentProfileData();
        } catch (error) {
            console.warn("Unable to sync Shark Pass level rewards:", error);
        }
    }
    renderPassOverview(profileData);
    renderPassLoadout(profileData);
    renderPassMissions(profileData);
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
window.claimPassMissionFromUI = claimPassMissionFromUI;

if (typeof firebase !== "undefined" && firebase.auth) {
    firebase.auth().onAuthStateChanged(() => {
        renderPassUI();
    });
}
