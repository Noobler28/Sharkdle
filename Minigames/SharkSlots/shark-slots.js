(function () {
    "use strict";

    const SAVE_KEY = "sharkSlotsProfileV1";
    const BET_STEPS = [5, 10, 25, 50, 100, 250];
    const STARTING_BANK = 750;
    const STARTING_JACKPOT = 2500;
    const MAX_LOG = 18;

    const SYMBOLS = [
        {
            id: "cherry",
            name: "Cherry",
            tier: "Common",
            emoji: "🍒",
            color: "#ff4f7b",
            glow: "rgba(255, 79, 123, 0.28)",
            weight: 25,
            payout: 2
        },
        {
            id: "lemon",
            name: "Lemon",
            tier: "Common",
            emoji: "🍋",
            color: "#ffe66d",
            glow: "rgba(255, 230, 109, 0.28)",
            weight: 21,
            payout: 3
        },
        {
            id: "orange",
            name: "Orange",
            tier: "Fresh",
            emoji: "🍊",
            color: "#ff9f1c",
            glow: "rgba(255, 159, 28, 0.28)",
            weight: 17,
            payout: 6
        },
        {
            id: "watermelon",
            name: "Watermelon",
            tier: "Juicy",
            emoji: "🍉",
            color: "#52e07f",
            glow: "rgba(82, 224, 127, 0.25)",
            weight: 13,
            payout: 9
        },
        {
            id: "mako",
            name: "Mako",
            tier: "Shark",
            image: "images/home-v3/mako.png",
            color: "#32d5e8",
            glow: "rgba(50, 213, 232, 0.24)",
            weight: 10,
            payout: 14
        },
        {
            id: "hammerhead",
            name: "Hammerhead",
            tier: "Shark",
            image: "images/home-v3/hammerhead.png",
            color: "#8ce85f",
            glow: "rgba(140, 232, 95, 0.22)",
            weight: 7,
            payout: 24
        },
        {
            id: "tiger",
            name: "Tiger Shark",
            tier: "Shark",
            image: "images/home-v3/tiger.png",
            color: "#ff6f61",
            glow: "rgba(255, 111, 97, 0.25)",
            weight: 4.5,
            payout: 45
        },
        {
            id: "pearl-scatter",
            name: "Pearl Scatter",
            tier: "Bonus",
            icon: "fa-solid fa-gem",
            color: "#f0b7ff",
            glow: "rgba(240, 183, 255, 0.24)",
            weight: 2.8,
            payout: 0,
            scatter: true
        },
        {
            id: "apex-wild",
            name: "Great White Wild",
            tier: "Wild",
            image: "images/home-v3/great-white.png",
            color: "#f6fbff",
            glow: "rgba(246, 251, 255, 0.26)",
            weight: 1.8,
            payout: 90,
            wild: true
        }
    ];

    const SYMBOL_BY_ID = new Map(SYMBOLS.map((symbol) => [symbol.id, symbol]));
    const TOTAL_WEIGHT = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);

    const PAYLINES = [
        { id: "middle", name: "Middle", cells: [[1, 0], [1, 1], [1, 2]], marker: "0" },
        { id: "top", name: "Top", cells: [[0, 0], [0, 1], [0, 2]], marker: "1" },
        { id: "bottom", name: "Bottom", cells: [[2, 0], [2, 1], [2, 2]], marker: "2" },
        { id: "dive", name: "Dive", cells: [[0, 0], [1, 1], [2, 2]] },
        { id: "breach", name: "Breach", cells: [[2, 0], [1, 1], [0, 2]] }
    ];

    const LINE_PRESETS = {
        1: [0],
        3: [0, 1, 2],
        5: [0, 1, 2, 3, 4]
    };

    let profile = null;
    let currentGrid = null;
    let spinning = false;
    let autoSpin = false;
    let toastTimer = 0;

    function initSharkSlots() {
        profile = loadProfile();
        currentGrid = generateGrid();
        bindEvents();
        renderPaytable();
        renderReels(currentGrid);
        renderAll();
        if (!profile.log.length) {
            addLog("Reels ready", "Bank loaded with " + formatNumber(profile.bank) + " chips.", "info");
        }
    }

    function bindEvents() {
        byId("ss-spin-btn")?.addEventListener("click", () => spinOnce());
        byId("ss-auto-btn")?.addEventListener("click", toggleAutoSpin);
        byId("ss-bet-down")?.addEventListener("click", () => adjustBet(-1));
        byId("ss-bet-up")?.addEventListener("click", () => adjustBet(1));
        byId("ss-clear-log")?.addEventListener("click", () => {
            profile.log = [];
            saveProfile();
            renderLog();
        });
        byId("ss-reset-btn")?.addEventListener("click", resetProgress);
        document.querySelectorAll("[data-lines]").forEach((button) => {
            button.addEventListener("click", () => {
                profile.lines = Number(button.dataset.lines) || 1;
                saveProfile();
                renderAll();
            });
        });
    }

    function loadProfile() {
        const fallback = createProfile();
        try {
            const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
            if (!saved || typeof saved !== "object") return fallback;
            return normalizeProfile({ ...fallback, ...saved });
        } catch (error) {
            return fallback;
        }
    }

    function createProfile() {
        return {
            bank: STARTING_BANK,
            betIndex: 1,
            lines: 3,
            jackpot: STARTING_JACKPOT,
            bestWin: 0,
            totalSpins: 0,
            totalWagered: 0,
            totalWon: 0,
            streak: 0,
            lastResult: "Ready to spin",
            log: []
        };
    }

    function normalizeProfile(raw) {
        const profile = raw || {};
        profile.bank = toSafeNumber(profile.bank, STARTING_BANK);
        profile.betIndex = clamp(Math.round(toSafeNumber(profile.betIndex, 1)), 0, BET_STEPS.length - 1);
        profile.lines = [1, 3, 5].includes(Number(profile.lines)) ? Number(profile.lines) : 3;
        profile.jackpot = Math.max(STARTING_JACKPOT, Math.round(toSafeNumber(profile.jackpot, STARTING_JACKPOT)));
        profile.bestWin = Math.max(0, Math.round(toSafeNumber(profile.bestWin, 0)));
        profile.totalSpins = Math.max(0, Math.round(toSafeNumber(profile.totalSpins, 0)));
        profile.totalWagered = Math.max(0, Math.round(toSafeNumber(profile.totalWagered, 0)));
        profile.totalWon = Math.max(0, Math.round(toSafeNumber(profile.totalWon, 0)));
        profile.streak = Math.max(0, Math.round(toSafeNumber(profile.streak, 0)));
        profile.lastResult = String(profile.lastResult || "Ready to spin");
        profile.log = Array.isArray(profile.log) ? profile.log.slice(0, MAX_LOG) : [];
        return profile;
    }

    function saveProfile() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(profile));
        } catch (error) {
            console.warn("Unable to save Shark Slots progress", error);
        }
    }

    async function spinOnce() {
        if (spinning) return;

        const bet = getBet();
        const lineCount = getLineCount();
        const cost = bet * lineCount;
        if (profile.bank < cost) {
            autoSpin = false;
            showToast("Not enough chips for that spin.");
            renderAll();
            return;
        }

        spinning = true;
        profile.bank -= cost;
        profile.totalSpins += 1;
        profile.totalWagered += cost;
        profile.jackpot += Math.max(1, Math.ceil(cost * 0.1));
        profile.lastResult = "Reels spinning...";
        saveProfile();
        renderAll();
        clearWinMarkers();

        const finalGrid = generateGrid();
        await animateToGrid(finalGrid);
        currentGrid = finalGrid;

        const result = evaluateSpin(finalGrid, bet, lineCount);
        settleSpin(result, cost);
        spinning = false;
        renderAll();
        renderReels(currentGrid, result);

        if (autoSpin) {
            const nextCost = getBet() * getLineCount();
            if (profile.bank >= nextCost) {
                window.setTimeout(spinOnce, 650);
            } else {
                autoSpin = false;
                showToast("Auto spin stopped. Bank is low.");
                renderAll();
            }
        }
    }

    async function animateToGrid(finalGrid) {
        const displayGrid = generateGrid();
        const spinningReels = new Set([0, 1, 2]);
        renderReels(displayGrid, null, spinningReels);

        await Promise.all([0, 1, 2].map((reelIndex) => new Promise((resolve) => {
            const interval = window.setInterval(() => {
                displayGrid[reelIndex] = generateColumn();
                renderReels(displayGrid, null, spinningReels);
            }, 72);

            window.setTimeout(() => {
                window.clearInterval(interval);
                displayGrid[reelIndex] = finalGrid[reelIndex];
                spinningReels.delete(reelIndex);
                renderReels(displayGrid, null, spinningReels);
                resolve();
            }, 620 + reelIndex * 260);
        })));
    }

    function evaluateSpin(grid, bet, lineCount) {
        const activeIndexes = LINE_PRESETS[lineCount] || LINE_PRESETS[1];
        const lineWins = [];
        const winningCells = new Set();
        const activeMarkers = new Set();
        let lineTotal = 0;
        let jackpotWin = 0;

        activeIndexes.forEach((lineIndex) => {
            const line = PAYLINES[lineIndex];
            const symbols = line.cells.map(([row, column]) => getCell(grid, row, column));
            const target = symbols.find((symbol) => symbol && !symbol.wild && !symbol.scatter) || SYMBOL_BY_ID.get("apex-wild");
            const allMatch = symbols.every((symbol) => {
                if (!symbol || symbol.scatter) return false;
                return symbol.wild || symbol.id === target.id;
            });

            if (!allMatch) return;

            const natural = symbols.every((symbol) => symbol.id === target.id);
            const wildCount = symbols.filter((symbol) => symbol.wild).length;
            let multiplier = target.payout;
            if (!natural && target.id !== "apex-wild") {
                multiplier = Math.max(1, Math.floor(multiplier * 0.75));
            }

            const amount = bet * multiplier;
            lineTotal += amount;
            line.cells.forEach(([row, column]) => winningCells.add(cellKey(row, column)));
            if (line.marker) activeMarkers.add(line.marker);
            lineWins.push({
                line: line.name,
                symbol: target,
                multiplier,
                amount,
                natural,
                wildCount
            });

            if (target.id === "apex-wild" && natural) {
                jackpotWin += profile.jackpot;
            }
        });

        const scatterCells = [];
        grid.forEach((column, columnIndex) => {
            column.forEach((symbol, rowIndex) => {
                if (symbol.scatter) scatterCells.push([rowIndex, columnIndex]);
            });
        });

        let scatterWin = 0;
        if (scatterCells.length >= 3) {
            scatterWin = bet * lineCount * (8 + (scatterCells.length - 3) * 4);
            scatterCells.forEach(([row, column]) => winningCells.add(cellKey(row, column)));
        }

        return {
            lineWins,
            lineTotal,
            scatterWin,
            scatterCount: scatterCells.length,
            scatterCells: new Set(scatterCells.map(([row, column]) => cellKey(row, column))),
            winningCells,
            activeMarkers,
            jackpotWin
        };
    }

    function settleSpin(result, cost) {
        let totalWin = result.lineTotal + result.scatterWin + result.jackpotWin;
        let streakBonus = 0;

        if (totalWin > 0) {
            profile.streak += 1;
            if (profile.streak > 0 && profile.streak % 4 === 0) {
                streakBonus = Math.ceil(totalWin * 0.2);
                totalWin += streakBonus;
            }
            profile.bank += totalWin;
            profile.totalWon += totalWin;
            profile.bestWin = Math.max(profile.bestWin, totalWin);
            profile.lastResult = buildWinSummary(result, totalWin, streakBonus);
            addLog(totalWin >= cost ? "Win +" + formatNumber(totalWin) : "Return +" + formatNumber(totalWin), profile.lastResult, result.jackpotWin ? "jackpot" : "win");
            showFloat("+" + formatNumber(totalWin));
            showToast(profile.lastResult);
        } else {
            profile.streak = 0;
            profile.lastResult = "No match. Jackpot grew to " + formatNumber(profile.jackpot) + ".";
            addLog("No win", "Wagered " + formatNumber(cost) + " chips.", "info");
        }

        if (result.jackpotWin > 0) {
            profile.jackpot = STARTING_JACKPOT + Math.floor(Math.random() * 900);
        }

        saveProfile();
    }

    function buildWinSummary(result, totalWin, streakBonus) {
        if (result.jackpotWin > 0) {
            return "Great White Wild jackpot for " + formatNumber(totalWin) + " chips.";
        }
        if (result.scatterWin > 0 && result.lineWins.length) {
            return "Lines and pearls paid " + formatNumber(totalWin) + " chips.";
        }
        if (result.scatterWin > 0) {
            return result.scatterCount + " pearls paid " + formatNumber(totalWin) + " chips.";
        }
        if (result.lineWins.length > 1) {
            return result.lineWins.length + " lines paid " + formatNumber(totalWin) + " chips.";
        }
        if (result.lineWins.length === 1) {
            const win = result.lineWins[0];
            const suffix = streakBonus ? " with streak boost" : "";
            return win.line + " " + win.symbol.name + " paid " + formatNumber(totalWin) + suffix + ".";
        }
        return "Won " + formatNumber(totalWin) + " chips.";
    }

    function toggleAutoSpin() {
        autoSpin = !autoSpin;
        renderAll();
        if (autoSpin && !spinning) spinOnce();
    }

    function adjustBet(direction) {
        if (spinning) return;
        profile.betIndex = clamp(profile.betIndex + direction, 0, BET_STEPS.length - 1);
        saveProfile();
        renderAll();
    }

    function resetProgress() {
        if (!confirm("Reset Shark Slots progress?")) return;
        autoSpin = false;
        profile = createProfile();
        currentGrid = generateGrid();
        saveProfile();
        renderReels(currentGrid);
        renderAll();
        addLog("Fresh bank", "Progress reset with " + formatNumber(profile.bank) + " chips.", "info");
        showToast("Shark Slots reset.");
    }

    function renderAll() {
        renderStats();
        renderControls();
        renderLog();
    }

    function renderStats() {
        setText("ss-bank", formatNumber(profile.bank));
        setText("ss-best", formatNumber(profile.bestWin));
        setText("ss-jackpot", formatNumber(profile.jackpot));
        setText("ss-jackpot-top", formatNumber(profile.jackpot));
        setText("ss-last-result", profile.lastResult);
        setText("ss-streak", String(profile.streak));
        setText("ss-spins", profile.totalSpins + " spins");
        setText("ss-wagered", formatNumber(profile.totalWagered));
        setText("ss-won", formatNumber(profile.totalWon));
        setText("ss-net", formatSigned(profile.totalWon - profile.totalWagered));
        setText("ss-active-lines", String(profile.lines));
    }

    function renderControls() {
        const cost = getBet() * getLineCount();
        setText("ss-bet", formatNumber(getBet()));

        byId("ss-bet-down").disabled = spinning || profile.betIndex <= 0;
        byId("ss-bet-up").disabled = spinning || profile.betIndex >= BET_STEPS.length - 1;
        byId("ss-spin-btn").disabled = spinning || profile.bank < cost;
        byId("ss-auto-btn").disabled = spinning && !autoSpin;
        byId("ss-auto-btn").classList.toggle("active", autoSpin);

        const spinLabel = byId("ss-spin-btn")?.querySelector("span");
        if (spinLabel) spinLabel.textContent = spinning ? "Spinning" : "Spin";

        document.querySelectorAll("[data-lines]").forEach((button) => {
            const active = Number(button.dataset.lines) === profile.lines;
            button.classList.toggle("active", active);
            button.disabled = spinning;
        });
    }

    function renderReels(grid, result = null, spinningReels = new Set()) {
        const reelRoot = byId("ss-reels");
        if (!reelRoot) return;

        const winningCells = result?.winningCells || new Set();
        const scatterCells = result?.scatterCells || new Set();
        reelRoot.innerHTML = grid.map((column, columnIndex) => {
            const spinningClass = spinningReels.has(columnIndex) ? " spinning" : "";
            const cells = column.map((symbol, rowIndex) => renderSymbol(symbol, rowIndex, columnIndex, winningCells, scatterCells)).join("");
            return `<div class="ss-reel${spinningClass}" data-reel="${columnIndex}">${cells}</div>`;
        }).join("");

        document.querySelectorAll("[data-line-marker]").forEach((marker) => {
            marker.classList.toggle("active", Boolean(result?.activeMarkers?.has(marker.dataset.lineMarker)));
        });
    }

    function renderSymbol(symbol, rowIndex, columnIndex, winningCells, scatterCells) {
        const isWinning = winningCells.has(cellKey(rowIndex, columnIndex));
        const isScatterWin = scatterCells.has(cellKey(rowIndex, columnIndex));
        const classes = ["ss-symbol"];
        if (isWinning) classes.push("winning");
        if (isScatterWin) classes.push("scatter-win");

        const media = getSymbolMedia(symbol);

        return `
            <div class="${classes.join(" ")}" style="--symbol-color:${escapeAttr(symbol.color)};--symbol-glow:${escapeAttr(symbol.glow)}" data-row="${rowIndex}" data-column="${columnIndex}" aria-label="${escapeAttr(symbol.name)}" title="${escapeAttr(symbol.name)}">
                <div class="ss-symbol-media">${media}</div>
            </div>
        `;
    }

    function renderPaytable() {
        const root = byId("ss-paytable");
        if (!root) return;

        root.innerHTML = SYMBOLS.map((symbol) => {
            const media = getSymbolMedia(symbol);
            const note = symbol.scatter ? "3 anywhere" : symbol.wild ? "wild jackpot" : symbol.tier;
            const pay = symbol.scatter ? "8x+" : symbol.payout + "x";
            return `
                <div class="ss-paytable-row" style="--symbol-color:${escapeAttr(symbol.color)}">
                    <div class="ss-paytable-media">${media}</div>
                    <div>
                        <span class="ss-paytable-name">${escapeHtml(symbol.name)}</span>
                        <span class="ss-paytable-note">${escapeHtml(note)}</span>
                    </div>
                    <strong class="ss-paytable-pay">${escapeHtml(pay)}</strong>
                </div>
            `;
        }).join("");
    }

    function getSymbolMedia(symbol) {
        if (symbol.image) {
            return `<img src="${escapeAttr(symbol.image)}" alt="">`;
        }
        if (symbol.emoji) {
            return `<span class="ss-symbol-emoji">${escapeHtml(symbol.emoji)}</span>`;
        }
        return `<i class="${escapeAttr(symbol.icon)}"></i>`;
    }

    function renderLog() {
        const root = byId("ss-log");
        if (!root) return;
        if (!profile.log.length) {
            root.innerHTML = `<div class="ss-log-entry"><strong>No spins yet</strong><span>Your reel results will appear here.</span></div>`;
            return;
        }
        root.innerHTML = profile.log.map((entry) => `
            <div class="ss-log-entry ${escapeAttr(entry.type || "info")}">
                <strong>${escapeHtml(entry.title || "Spin")}</strong>
                <span>${escapeHtml(entry.detail || "")}</span>
            </div>
        `).join("");
    }

    function addLog(title, detail, type) {
        profile.log.unshift({
            title,
            detail,
            type: type || "info",
            at: Date.now()
        });
        profile.log = profile.log.slice(0, MAX_LOG);
        saveProfile();
        renderLog();
    }

    function clearWinMarkers() {
        document.querySelectorAll("[data-line-marker]").forEach((marker) => marker.classList.remove("active"));
    }

    function generateGrid() {
        return [generateColumn(), generateColumn(), generateColumn()];
    }

    function generateColumn() {
        return [randomSymbol(), randomSymbol(), randomSymbol()];
    }

    function randomSymbol() {
        let roll = Math.random() * TOTAL_WEIGHT;
        for (const symbol of SYMBOLS) {
            roll -= symbol.weight;
            if (roll <= 0) return symbol;
        }
        return SYMBOLS[0];
    }

    function getCell(grid, row, column) {
        return grid[column]?.[row] || SYMBOLS[0];
    }

    function getBet() {
        return BET_STEPS[profile.betIndex] || BET_STEPS[0];
    }

    function getLineCount() {
        return [1, 3, 5].includes(profile.lines) ? profile.lines : 1;
    }

    function showToast(message) {
        const toast = byId("ss-toast");
        if (!toast) return;
        toast.textContent = message;
        toast.classList.remove("hidden");
        requestAnimationFrame(() => toast.classList.add("visible"));
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => {
            toast.classList.remove("visible");
            window.setTimeout(() => toast.classList.add("hidden"), 220);
        }, 2400);
    }

    function showFloat(text) {
        const layer = byId("ss-float-layer");
        if (!layer) return;
        const float = document.createElement("div");
        float.className = "ss-float-win";
        float.textContent = text;
        float.style.setProperty("--x", (44 + Math.random() * 12).toFixed(1) + "%");
        float.style.setProperty("--y", (42 + Math.random() * 14).toFixed(1) + "%");
        layer.appendChild(float);
        window.setTimeout(() => float.remove(), 1200);
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function setText(id, value) {
        const node = byId(id);
        if (node) node.textContent = value;
    }

    function cellKey(row, column) {
        return row + "-" + column;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function toSafeNumber(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function formatNumber(value) {
        return Math.round(Number(value) || 0).toLocaleString();
    }

    function formatSigned(value) {
        const rounded = Math.round(Number(value) || 0);
        return (rounded > 0 ? "+" : "") + rounded.toLocaleString();
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, "&#096;");
    }

    window.initSharkSlots = initSharkSlots;
})();
