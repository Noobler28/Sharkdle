(function initializeGlobalBroadcast() {
    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyAS9l8O1jRMafPt3r0lF6mqjr2-gl-EbZ0",
        authDomain: "sharkdle-leaderboard.firebaseapp.com",
        databaseURL: "https://sharkdle-leaderboard-default-rtdb.firebaseio.com",
        projectId: "sharkdle-leaderboard",
        storageBucket: "sharkdle-leaderboard.firebasestorage.app",
        messagingSenderId: "429123174628",
        appId: "1:429123174628:web:42ae9baed69c4b087c2cf1",
        measurementId: "G-HV5FFNKM5C"
    };

    const MESSAGE_CONFIG_PATH = { collection: "globalConfig", doc: "globalMessage" };
    const INDEX_THEME_CONFIG_PATH = { collection: "globalConfig", doc: "indexTheme" };
    const RNG_BROADCAST_COLLECTION = "rngBroadcasts";
    const MESSAGE_CACHE_KEY = "globalBroadcastMessageCache";
    const RNG_BROADCAST_SEEN_CACHE_KEY = "rngBroadcastSeenIds";
    const THEME_CACHE_KEY = "globalUiThemeCache";
    const THEME_DISABLE_KEY = "disableSeasonalTheme";
    const THEME_IDS = ["default", "summer", "birthday", "christmas", "halloween", "northpole"];
    const THEME_CLASS_PREFIX = "global-ui-theme-";
    const STYLE_ID = "global-broadcast-style";
    const BANNER_ID = "global-broadcast-banner";
    const STARTED_KEY = "__globalBroadcastStarted";
    const VISITOR_TRACKING_STARTED_KEY = "__sharkdleVisitorTrackingStarted";
    const VISITOR_DAILY_COLLECTION = "visitorDaily";
    const VISITOR_HEARTBEAT_MS = 45 * 1000;
    const RNG_BROADCAST_MIN_ONE_IN = 100_000_000;
    const RNG_BROADCAST_MAX_AGE_MS = 5 * 60 * 1000;
    const RNG_BROADCAST_DISPLAY_MS = 6500;
    const RNG_BROADCAST_QUERY_LIMIT = 8;
    let currentGlobalMessagePayload = null;
    let rngBroadcastRestoreTimer = null;

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
        });
    }

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            .global-broadcast-banner {
                position: fixed;
                left: 50%;
                bottom: 14px;
                transform: translateX(-50%);
                max-width: min(94vw, 920px);
                width: fit-content;
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 14px;
                border-radius: 12px;
                border: 1px solid rgba(180, 236, 255, 0.28);
                background: linear-gradient(135deg, rgba(7, 38, 58, 0.96), rgba(10, 60, 92, 0.96));
                color: #f2fdff;
                box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
                z-index: 12000;
                font-family: 'Poppins', sans-serif;
            }
            .global-broadcast-banner.hidden {
                display: none;
            }
            .global-broadcast-pill {
                font-size: 10px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.12em;
                padding: 5px 8px;
                border-radius: 999px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                background: rgba(255, 255, 255, 0.12);
                white-space: nowrap;
            }
            .global-broadcast-message {
                font-size: 13px;
                line-height: 1.45;
                font-weight: 600;
                color: #eaf9ff;
                word-break: break-word;
            }
            .global-broadcast-banner.type-warning {
                background: linear-gradient(135deg, rgba(79, 39, 11, 0.96), rgba(121, 56, 15, 0.96));
                border-color: rgba(255, 204, 142, 0.38);
            }
            .global-broadcast-banner.type-event {
                background: linear-gradient(135deg, rgba(29, 16, 84, 0.96), rgba(28, 91, 146, 0.96));
                border-color: rgba(203, 194, 255, 0.4);
            }
            .global-broadcast-banner.type-rng {
                background: linear-gradient(135deg, rgba(4, 61, 67, 0.97), rgba(12, 83, 91, 0.96));
                border-color: rgba(94, 234, 212, 0.45);
            }
            .global-broadcast-banner.type-apex {
                background: linear-gradient(135deg, rgba(91, 24, 24, 0.98), rgba(123, 55, 16, 0.97));
                border-color: rgba(253, 186, 116, 0.55);
                box-shadow: 0 14px 36px rgba(127, 29, 29, 0.36);
            }
            .global-broadcast-banner.type-apex .global-broadcast-pill {
                background: rgba(251, 146, 60, 0.22);
                border-color: rgba(253, 186, 116, 0.42);
            }
            body.${THEME_CLASS_PREFIX}default {
                --global-theme-body-bg: linear-gradient(135deg, #061a40, #0b3c5d);
                --global-theme-navbar-bg: #071c2c;
                --global-theme-surface-bg: linear-gradient(180deg, rgba(11,34,51,0.96), rgba(9,29,44,0.96));
                --global-theme-surface-border: rgba(77, 208, 225, 0.14);
            }
            body.${THEME_CLASS_PREFIX}summer {
                /* Summer Splash: add a subtle "sandy ocean floor" near the bottom */
                --global-theme-body-bg:
                    radial-gradient(1200px 260px at 35% 110%, rgba(255, 232, 182, 0.55) 0%, rgba(255, 232, 182, 0) 62%),
                    radial-gradient(900px 220px at 78% 112%, rgba(228, 190, 118, 0.42) 0%, rgba(228, 190, 118, 0) 64%),
                    linear-gradient(180deg,
                        #0a3a52 0%,
                        #0d6f86 52%,
                        #1a9ba5 68%,
                        #2fb3b0 74%,
                        #cfa86e 86%,
                        #b88950 100%);
                --global-theme-navbar-bg: #0b3948;
                --global-theme-surface-bg: linear-gradient(180deg, rgba(8, 52, 70, 0.95), rgba(11, 95, 118, 0.92));
                --global-theme-surface-border: rgba(151, 245, 255, 0.3);
            }
            body.${THEME_CLASS_PREFIX}birthday {
                --global-theme-body-bg:
                    /* Soft party glow */
                    radial-gradient(900px 420px at 50% -10%, rgba(255, 120, 203, 0.18) 0%, rgba(255, 120, 203, 0) 62%),
                    radial-gradient(820px 360px at 15% 12%, rgba(120, 210, 255, 0.16) 0%, rgba(120, 210, 255, 0) 60%),
                    radial-gradient(760px 340px at 85% 18%, rgba(255, 221, 120, 0.14) 0%, rgba(255, 221, 120, 0) 60%),
                    linear-gradient(135deg, #071a3a, #163c7a, #2b77b8);
                --global-theme-navbar-bg: #0b1f45;
                --global-theme-surface-bg: linear-gradient(180deg, rgba(18, 33, 80, 0.95), rgba(29, 112, 171, 0.92));
                --global-theme-surface-border: rgba(255, 186, 247, 0.26);
            }
            /* Summer Splash: logo gradient + badge */
            body.${THEME_CLASS_PREFIX}summer .logo {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                background: linear-gradient(135deg, #ffe066, #ff9a3c, #ff6b6b);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            body.${THEME_CLASS_PREFIX}summer .logo::after {
                content: "Summer";
                display: inline-block;
                padding: 6px 10px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                background: rgba(255, 255, 255, 0.10);
                border: 1px solid rgba(255, 224, 102, 0.34);
                color: #ffe066;
                box-shadow: 0 10px 22px rgba(0, 0, 0, 0.18);
                -webkit-text-fill-color: #ffe066;
            }
            /* Christmas Reef: logo gradient + badge */
            body.${THEME_CLASS_PREFIX}christmas .logo {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                background: linear-gradient(135deg, #ff6b6b, #c44eff, #4dabf7);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            body.${THEME_CLASS_PREFIX}christmas .logo::after {
                content: "Christmas";
                display: inline-block;
                padding: 6px 10px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                background: rgba(255, 255, 255, 0.10);
                border: 1px solid rgba(255, 107, 107, 0.34);
                color: #ff6b6b;
                box-shadow: 0 10px 22px rgba(0, 0, 0, 0.18);
                -webkit-text-fill-color: #ff6b6b;
            }
            /* Halloween Depths: logo gradient + badge */
            body.${THEME_CLASS_PREFIX}halloween .logo {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                background: linear-gradient(135deg, #c44eff, #ff6b6b, #ffe066);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            body.${THEME_CLASS_PREFIX}halloween .logo::after {
                content: "Halloween";
                display: inline-block;
                padding: 6px 10px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                background: rgba(255, 255, 255, 0.10);
                border: 1px solid rgba(196, 78, 255, 0.34);
                color: #c44eff;
                box-shadow: 0 10px 22px rgba(0, 0, 0, 0.18);
                -webkit-text-fill-color: #c44eff;
            }
            /* Birthday extras: visible confetti overlay + anniversary badge */
            body.${THEME_CLASS_PREFIX}birthday {
                position: relative;
            }
            body.${THEME_CLASS_PREFIX}birthday::before {
                content: "";
                position: fixed;
                inset: 0;
                pointer-events: none;
                z-index: 2;
                opacity: 0.62;
                mix-blend-mode: screen;
                background:
                    radial-gradient(circle at 18px 22px, rgba(255, 120, 203, 0.98) 0 3.4px, transparent 3.9px),
                    radial-gradient(circle at 52px 74px, rgba(120, 210, 255, 0.98) 0 3.4px, transparent 3.9px),
                    radial-gradient(circle at 108px 26px, rgba(255, 221, 120, 0.98) 0 3.4px, transparent 3.9px),
                    radial-gradient(circle at 76px 118px, rgba(160, 255, 198, 0.92) 0 3.4px, transparent 3.9px),
                    radial-gradient(circle at 138px 92px, rgba(205, 164, 255, 0.92) 0 3.4px, transparent 3.9px),
                    radial-gradient(circle at 158px 40px, rgba(255, 165, 120, 0.92) 0 3.4px, transparent 3.9px),
                    radial-gradient(circle at 26px 146px, rgba(255, 255, 255, 0.35) 0 2.4px, transparent 2.9px);
                background-size: 220px 220px, 260px 260px, 320px 320px, 240px 240px, 360px 360px, 300px 300px, 420px 420px;
                animation: birthday-confetti-drift 16s linear infinite;
            }
            body.${THEME_CLASS_PREFIX}birthday .logo {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                background: linear-gradient(135deg, #ff78cb, #ffe085, #78d2ff);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            body.${THEME_CLASS_PREFIX}birthday .logo::after {
                content: "1 Year Anniversary";
                display: inline-block;
                padding: 6px 10px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                background: rgba(255, 255, 255, 0.10);
                border: 1px solid rgba(255, 186, 247, 0.34);
                color: #ffe085;
                box-shadow: 0 10px 22px rgba(0, 0, 0, 0.18);
                -webkit-text-fill-color: #ffe085;
            }
            @keyframes birthday-confetti-drift {
                from { background-position: 0 0, 40px 10px, 120px 0, 10px 70px, 80px 40px, 150px 20px; }
                to   { background-position: 0 520px, 40px 640px, 120px 610px, 10px 760px, 80px 700px, 150px 740px; }
            }
            @media (prefers-reduced-motion: reduce) {
                body.${THEME_CLASS_PREFIX}birthday::before {
                    animation: none;
                }
            }
            body.${THEME_CLASS_PREFIX}christmas {
                --global-theme-body-bg: linear-gradient(135deg, #06241f, #133a2d, #6f1515);
                --global-theme-navbar-bg: #0d2c24;
                --global-theme-surface-bg: linear-gradient(180deg, rgba(16, 50, 37, 0.96), rgba(72, 18, 18, 0.9));
                --global-theme-surface-border: rgba(255, 224, 163, 0.28);
            }
            body.${THEME_CLASS_PREFIX}halloween {
                --global-theme-body-bg: linear-gradient(135deg, #160d2b, #2b153f, #5f2c0a);
                --global-theme-navbar-bg: #1e1133;
                --global-theme-surface-bg: linear-gradient(180deg, rgba(35, 19, 54, 0.96), rgba(86, 40, 14, 0.9));
                --global-theme-surface-border: rgba(255, 193, 142, 0.3);
            }
            /* North Pole: icy blues + animated snowflakes */
            body.${THEME_CLASS_PREFIX}northpole {
                --global-theme-body-bg: linear-gradient(135deg, #0a2f4a, #1a5a7a, #2a7fa0);
                --global-theme-navbar-bg: #08293d;
                --global-theme-surface-bg: linear-gradient(180deg, rgba(10, 47, 74, 0.96), rgba(26, 95, 122, 0.92));
                --global-theme-surface-border: rgba(179, 224, 255, 0.25);
            }
            body.${THEME_CLASS_PREFIX}northpole {
                position: relative;
            }
            body.${THEME_CLASS_PREFIX}northpole::before {
                content: "";
                position: fixed;
                inset: 0;
                pointer-events: none;
                z-index: 2;
                opacity: 0.7;
                background:
                    radial-gradient(circle at 20px 40px, rgba(255, 255, 255, 0.9) 0 2px, transparent 3px),
                    radial-gradient(circle at 120px 80px, rgba(255, 255, 255, 0.8) 0 1.8px, transparent 2.8px),
                    radial-gradient(circle at 220px 30px, rgba(255, 255, 255, 0.9) 0 2.2px, transparent 3.2px),
                    radial-gradient(circle at 80px 180px, rgba(255, 255, 255, 0.85) 0 1.6px, transparent 2.6px),
                    radial-gradient(circle at 200px 150px, rgba(255, 255, 255, 0.9) 0 2px, transparent 3px),
                    radial-gradient(circle at 320px 100px, rgba(255, 255, 255, 0.8) 0 1.8px, transparent 2.8px),
                    radial-gradient(circle at 400px 50px, rgba(255, 255, 255, 0.9) 0 2.4px, transparent 3.4px),
                    radial-gradient(circle at 500px 120px, rgba(255, 255, 255, 0.85) 0 1.7px, transparent 2.7px),
                    radial-gradient(circle at 600px 70px, rgba(255, 255, 255, 0.9) 0 2px, transparent 3px),
                    radial-gradient(circle at 700px 160px, rgba(255, 255, 255, 0.8) 0 1.9px, transparent 2.9px);
                background-size: 800px 800px;
                animation: snowfall 20s linear infinite;
            }
            body.${THEME_CLASS_PREFIX}northpole .logo {
                display: inline-flex;
                align-items: center;
                gap: 10px;
                background: linear-gradient(135deg, #e6f7ff, #b3e0ff, #80d0ff);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            body.${THEME_CLASS_PREFIX}northpole .logo::after {
                content: "North Pole";
                display: inline-block;
                padding: 6px 10px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                background: rgba(255, 255, 255, 0.10);
                border: 1px solid rgba(179, 224, 255, 0.34);
                color: #e6f7ff;
                box-shadow: 0 10px 22px rgba(0, 0, 0, 0.18);
                -webkit-text-fill-color: #e6f7ff;
            }
            @keyframes snowfall {
                from { background-position: 0 0, 40px 20px, 120px 10px, 80px 80px, 200px 60px, 320px 40px, 400px 30px, 500px 100px, 600px 70px, 700px 140px; }
                to { background-position: 0 800px, 40px 820px, 120px 810px, 80px 880px, 200px 860px, 320px 840px, 400px 830px, 500px 900px, 600px 870px, 700px 940px; }
            }
            @media (prefers-reduced-motion: reduce) {
                body.${THEME_CLASS_PREFIX}northpole::before {
                    animation: none;
                }
            }
            body[class*="${THEME_CLASS_PREFIX}"] {
                background: var(--global-theme-body-bg, linear-gradient(135deg, #061a40, #0b3c5d)) !important;
            }
            body[class*="${THEME_CLASS_PREFIX}"] .navbar {
                background: var(--global-theme-navbar-bg, #071c2c) !important;
            }
            body[class*="${THEME_CLASS_PREFIX}"] .game-card,
            body[class*="${THEME_CLASS_PREFIX}"] .modal-content,
            body[class*="${THEME_CLASS_PREFIX}"] .picker-section,
            body[class*="${THEME_CLASS_PREFIX}"] .timeline-item,
            body[class*="${THEME_CLASS_PREFIX}"] .stat-card {
                background: var(--global-theme-surface-bg, linear-gradient(180deg, rgba(11,34,51,0.96), rgba(9,29,44,0.96))) !important;
                border-color: var(--global-theme-surface-border, rgba(77, 208, 225, 0.14)) !important;
            }
            @media (max-width: 640px) {
                .global-broadcast-banner {
                    left: 10px;
                    right: 10px;
                    transform: none;
                    width: auto;
                    bottom: 12px;
                    padding: 10px 12px;
                }
                .global-broadcast-message {
                    font-size: 12px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureBannerElement() {
        let banner = document.getElementById(BANNER_ID);
        if (!banner) {
            banner = document.createElement("div");
            banner.id = BANNER_ID;
            banner.className = "global-broadcast-banner hidden";
            banner.setAttribute("role", "status");
            banner.setAttribute("aria-live", "polite");
            banner.innerHTML = `
                <span class="global-broadcast-pill">Global</span>
                <span class="global-broadcast-message"></span>
            `;
            document.body.appendChild(banner);
        }
        return banner;
    }

    function normalizeMessageType(type) {
        const normalized = String(type || "").trim().toLowerCase();
        if (["event", "warning", "rng", "apex"].includes(normalized)) return normalized;
        return "info";
    }

    function parseMessagePayload(rawData) {
        if (!rawData || typeof rawData !== "object") return null;
        const message = String(rawData.message || "").trim();
        if (!rawData.enabled || !message) return null;
        const expiresAt = Number(rawData.expiresAt || 0);
        if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= Date.now()) {
            return null;
        }
        return {
            message,
            type: normalizeMessageType(rawData.type || "info")
        };
    }

    function formatRngOneIn(value) {
        const num = Math.max(0, Math.floor(Number(value) || 0));
        if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(num % 1_000_000_000 === 0 ? 0 : 2)}B`;
        if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1)}M`;
        return num.toLocaleString();
    }

    function sanitizeRngBroadcastText(value, fallback, maxLength) {
        const text = String(value ?? fallback ?? "").replace(/\s+/g, " ").trim();
        const fallbackText = String(fallback ?? "").replace(/\s+/g, " ").trim();
        return (text || fallbackText).slice(0, maxLength);
    }

    function getTimestampMs(value) {
        if (value && typeof value.toMillis === "function") return value.toMillis();
        if (value instanceof Date) return value.getTime();
        if (typeof value === "number") return value;
        return 0;
    }

    function getCurrentGlobalBroadcastUid() {
        try {
            return firebase.auth?.().currentUser?.uid || "";
        } catch (error) {
            return "";
        }
    }

    function readSeenRngBroadcastIds() {
        try {
            const parsed = JSON.parse(localStorage.getItem(RNG_BROADCAST_SEEN_CACHE_KEY) || "[]");
            return Array.isArray(parsed)
                ? parsed.filter(id => typeof id === "string").slice(-40)
                : [];
        } catch (error) {
            return [];
        }
    }

    function cacheSeenRngBroadcastId(id) {
        const normalizedId = String(id || "").trim();
        if (!normalizedId) return;
        const ids = readSeenRngBroadcastIds().filter(seenId => seenId !== normalizedId);
        ids.push(normalizedId);
        localStorage.setItem(RNG_BROADCAST_SEEN_CACHE_KEY, JSON.stringify(ids.slice(-40)));
    }

    function parseRngBroadcastDoc(doc) {
        if (!doc) return null;
        const data = typeof doc.data === "function" ? doc.data() || {} : {};
        const id = String(doc.id || "").trim();
        const createdAtMs = getTimestampMs(data.createdAt);
        if (!id || !createdAtMs || Date.now() - createdAtMs > RNG_BROADCAST_MAX_AGE_MS) return null;

        const currentUid = getCurrentGlobalBroadcastUid();
        const broadcastUid = String(data.uid || "").trim();
        if (currentUid && broadcastUid && currentUid === broadcastUid) return null;

        const oneIn = Math.max(0, Math.floor(Number(data.oneIn) || 0));
        const tier = sanitizeRngBroadcastText(data.tier, "Ultra", 24);
        const mutation = String(data.mutation || "").trim().toLowerCase();
        const isApex = mutation === "apex" || tier.toLowerCase() === "apex";
        if (!isApex && oneIn < RNG_BROADCAST_MIN_ONE_IN) return null;

        const playerName = sanitizeRngBroadcastText(data.playerName, "Someone", 32);
        const speciesName = sanitizeRngBroadcastText(data.speciesName, "something rare", 80);
        const mutationName = sanitizeRngBroadcastText(data.mutationName, "", 32);
        const rollCount = Math.max(1, Math.floor(Number(data.rollCount) || 1));
        const namedApexMutation = isApex && mutationName && mutationName.toLowerCase() !== "apex";
        const displayName = mutationName && (!isApex || namedApexMutation) ? `${mutationName} ${speciesName}` : speciesName;
        const rarityText = isApex ? "APEX" : tier;
        const detailText = isApex ? `${namedApexMutation ? "APEX path, " : ""}1 in ${formatRngOneIn(oneIn)}` : `${rarityText}, 1 in ${formatRngOneIn(oneIn)}`;
        const apexPrefix = isApex && !namedApexMutation ? "APEX " : "";
        const rollText = rollCount > 1 ? ` in a ${rollCount}x roll` : "";

        return {
            id,
            type: isApex ? "apex" : "rng",
            label: "Global Message",
            message: `${playerName} just rolled ${apexPrefix}${displayName} (${detailText})${rollText}`
        };
    }

    function showRngBroadcast(payload) {
        if (!payload?.id || readSeenRngBroadcastIds().includes(payload.id)) return;
        cacheSeenRngBroadcastId(payload.id);
        renderBanner(payload, { cache: false });

        if (rngBroadcastRestoreTimer) {
            window.clearTimeout(rngBroadcastRestoreTimer);
        }

        rngBroadcastRestoreTimer = window.setTimeout(() => {
            rngBroadcastRestoreTimer = null;
            renderBanner(currentGlobalMessagePayload, { cache: true });
        }, RNG_BROADCAST_DISPLAY_MS);
    }

    function normalizeThemeId(themeId) {
        const normalized = String(themeId || "").trim().toLowerCase();
        return THEME_IDS.includes(normalized) ? normalized : "default";
    }

    function shouldDisableSeasonalThemes() {
        return localStorage.getItem(THEME_DISABLE_KEY) === "true";
    }

    function applyGlobalTheme(themeId) {
        const normalizedThemeId = normalizeThemeId(themeId);
        const appliedThemeId = (shouldDisableSeasonalThemes() && normalizedThemeId !== "default")
            ? "default"
            : normalizedThemeId;

        // Always cache the remote theme id so the user can re-enable later.
        localStorage.setItem(THEME_CACHE_KEY, normalizedThemeId);

        THEME_IDS.forEach(id => document.body.classList.remove(`${THEME_CLASS_PREFIX}${id}`));
        document.body.classList.add(`${THEME_CLASS_PREFIX}${appliedThemeId}`);
        return appliedThemeId;
    }

    function cacheMessagePayload(payload) {
        if (!payload) {
            localStorage.removeItem(MESSAGE_CACHE_KEY);
            return;
        }
        localStorage.setItem(MESSAGE_CACHE_KEY, JSON.stringify({
            message: payload.message,
            type: payload.type,
            label: payload.label || "",
            cachedAt: Date.now()
        }));
    }

    function readCachedMessagePayload() {
        try {
            const parsed = JSON.parse(localStorage.getItem(MESSAGE_CACHE_KEY) || "null");
            if (!parsed || typeof parsed !== "object") return null;
            const message = String(parsed.message || "").trim();
            if (!message) return null;
            return {
                message,
                type: normalizeMessageType(parsed.type || "info"),
                label: String(parsed.label || "").trim()
            };
        } catch (error) {
            return null;
        }
    }

    function readCachedThemeId() {
        return normalizeThemeId(localStorage.getItem(THEME_CACHE_KEY) || "default");
    }

    function getUtcVisitorDayKey(timestamp = Date.now()) {
        return new Date(timestamp).toISOString().slice(0, 10);
    }

    function getVisitorStorageKey(userId, dayKey) {
        return `sharkdle-visitor-recorded-${userId}-${dayKey}`;
    }

    function getVisitorDisplayName(user) {
        const displayName = String(user?.displayName || "").trim();
        if (displayName) return displayName.slice(0, 80);

        const emailName = String(user?.email || "").split("@")[0].trim();
        if (emailName) return emailName.slice(0, 80);

        return "Signed-in player";
    }

    function getCurrentActivityLabel() {
        const path = decodeURIComponent(window.location.pathname || "/").toLowerCase();
        const profileModal = document.getElementById("profileModal");
        if (profileModal && !profileModal.classList.contains("hidden")) return "Profile";
        if (path.includes("/minigames/sharkrng/") || path.includes("/rng.html")) return "Shark RNG";
        if (path.includes("/library/") || path.includes("/library.html")) return "Sharchive";
        if (path.includes("/daily/") || path.includes("/daily.html")) return "Daily";
        if (path.includes("/infinite/") || path.includes("/infinite.html")) return "Infinite";
        if (path.includes("/practice/") || path.includes("/practice.html")) return "Practice";
        if (path.includes("/story/") || path.includes("/story.html")) return "Story";
        if (path.includes("/sharkpass/") || path.includes("/sharkpass.html")) return "Sharkpass";
        if (path.includes("/achievements/") || path.includes("/achievements.html")) return "Achievements";
        if (path.includes("/leaderboard/") || path.includes("/leaderboards.html")) return "Leaderboards";
        if (path.includes("/updates/") || path.includes("/updates.html")) return "Updates";
        if (path.includes("/shark-rescue/") || path.includes("/secret.html")) return "Shark Rescue";
        if (path.includes("/minigames/sharkslots/") || path.includes("/slots.html")) return "Shark Slots";
        if (document.body?.classList.contains("home-page")) return "Home";
        return "Sharkdle";
    }

    function isCurrentSharkRngPage() {
        const path = decodeURIComponent(window.location.pathname || "/").toLowerCase();
        return path.includes("/minigames/sharkrng/") || path.includes("/rng.html");
    }

    function getCurrentActivityPayload(nowMs = Date.now()) {
        if (typeof window.getCurrentSharkdleActivityPayload === "function") {
            return window.getCurrentSharkdleActivityPayload(nowMs);
        }
        return {
            label: getCurrentActivityLabel(),
            path: String(window.location.pathname || "/").slice(0, 120),
            updatedAt: nowMs
        };
    }

    async function recordSignedInVisitor(db, user) {
        if (!db || !user?.uid) return;

        const nowMs = Date.now();
        const dayKey = getUtcVisitorDayKey(nowMs);
        const storageKey = getVisitorStorageKey(user.uid, dayKey);
        const hasPagePresenceHeartbeat = typeof window.updatePresenceHeartbeat === "function";
        const writes = [];

        if (!hasPagePresenceHeartbeat) {
            writes.push(
                db.collection("userStats").doc(user.uid).set({
                    lastActive: nowMs,
                    lastActivity: getCurrentActivityPayload(nowMs)
                }, { merge: true })
            );
        }

        if (localStorage.getItem(storageKey) !== "true") {
            const visitorRef = db
                .collection(VISITOR_DAILY_COLLECTION)
                .doc(dayKey)
                .collection("users")
                .doc(user.uid);

            writes.push(
                visitorRef.set({
                    uid: user.uid,
                    username: getVisitorDisplayName(user),
                    visitedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    path: String(window.location.pathname || "/").slice(0, 120)
                }, { merge: true }).then(() => {
                    localStorage.setItem(storageKey, "true");
                })
            );
        }

        if (!writes.length) return;
        await Promise.all(writes);
    }

    function startVisitorTracking(db) {
        if (window[VISITOR_TRACKING_STARTED_KEY]) return;
        if (typeof firebase === "undefined" || typeof firebase.auth !== "function") return;
        window[VISITOR_TRACKING_STARTED_KEY] = true;

        let signedInUser = null;
        const recordCurrentVisitor = () => {
            if (!signedInUser || document.visibilityState === "hidden") return;
            recordSignedInVisitor(db, signedInUser).catch(error => {
                console.warn("Visitor tracking update failed:", error);
            });
        };

        firebase.auth().onAuthStateChanged(user => {
            signedInUser = user || null;
            recordCurrentVisitor();
        });

        window.setInterval(recordCurrentVisitor, VISITOR_HEARTBEAT_MS);
        document.addEventListener("visibilitychange", recordCurrentVisitor);
        window.addEventListener("focus", recordCurrentVisitor);
    }

    function renderBanner(payload, options = {}) {
        const banner = ensureBannerElement();
        const messageEl = banner.querySelector(".global-broadcast-message");
        const pillEl = banner.querySelector(".global-broadcast-pill");
        if (!messageEl) return;
        const shouldCache = options.cache !== false;

        banner.classList.remove("type-info", "type-event", "type-warning", "type-rng", "type-apex");
        if (!payload) {
            banner.classList.add("hidden");
            messageEl.textContent = "";
            if (pillEl) pillEl.textContent = "Global";
            if (shouldCache) cacheMessagePayload(null);
            return;
        }

        const bannerType = normalizeMessageType(payload.type || "info");
        banner.classList.add(`type-${bannerType}`);
        if (pillEl) pillEl.textContent = payload.label || "Global";
        messageEl.textContent = payload.message;
        banner.classList.remove("hidden");
        if (shouldCache) {
            cacheMessagePayload({
                message: payload.message,
                type: bannerType,
                label: payload.label || ""
            });
        }
    }

    async function ensureFirebaseLoaded() {
        if (typeof firebase === "undefined") {
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
        }

        if (typeof firebase.auth !== "function") {
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
        }

        if (typeof firebase.firestore !== "function") {
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
        }
    }

    async function startFirestoreListener() {
        if (window[STARTED_KEY]) return;
        window[STARTED_KEY] = true;

        try {
            await ensureFirebaseLoaded();
            if (typeof firebase === "undefined" || typeof firebase.firestore !== "function") {
                return;
            }

            if (!firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
            }

            const db = firebase.firestore();
            startVisitorTracking(db);
            db.collection(MESSAGE_CONFIG_PATH.collection)
                .doc(MESSAGE_CONFIG_PATH.doc)
                .onSnapshot(snapshot => {
                    const payload = parseMessagePayload(snapshot.exists ? snapshot.data() : null);
                    currentGlobalMessagePayload = payload;
                    if (rngBroadcastRestoreTimer) {
                        cacheMessagePayload(payload);
                    } else {
                        renderBanner(payload);
                    }
                }, error => {
                    console.warn("Global broadcast listener failed:", error);
                });

            db.collection(INDEX_THEME_CONFIG_PATH.collection)
                .doc(INDEX_THEME_CONFIG_PATH.doc)
                .onSnapshot(snapshot => {
                    const remoteThemeId = snapshot.exists ? snapshot.data()?.themeId : "default";
                    applyGlobalTheme(remoteThemeId || "default");
                }, error => {
                    console.warn("Global theme listener failed:", error);
                    applyGlobalTheme(readCachedThemeId());
                });

            let rngBroadcastListenerReady = false;
            if (isCurrentSharkRngPage()) {
                db.collection(RNG_BROADCAST_COLLECTION)
                    .orderBy("createdAt", "desc")
                    .limit(RNG_BROADCAST_QUERY_LIMIT)
                    .onSnapshot(snapshot => {
                        snapshot.docChanges().forEach(change => {
                            if (change.type !== "added") return;
                            if (!rngBroadcastListenerReady) {
                                cacheSeenRngBroadcastId(change.doc.id);
                                return;
                            }
                            const payload = parseRngBroadcastDoc(change.doc);
                            if (payload) showRngBroadcast(payload);
                        });
                        rngBroadcastListenerReady = true;
                    }, error => {
                        console.warn("RNG global broadcast listener failed:", error);
                    });
            }
        } catch (error) {
            console.warn("Global broadcast bootstrap failed:", error);
        }
    }

    function boot() {
        injectStyles();
        applyGlobalTheme(readCachedThemeId());
        currentGlobalMessagePayload = readCachedMessagePayload();
        renderBanner(currentGlobalMessagePayload);
        startFirestoreListener();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
        boot();
    }
})();
