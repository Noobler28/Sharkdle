(function () {
    "use strict";

    const WORLD = { width: 3200, height: 2200 };
    const PLAYER_SPEED = 270;
    const BOOST_SPEED_MULTIPLIER = 1.75;
    const BOOST_DRAIN_PER_SECOND = 48;
    const BOOST_RECHARGE_PER_SECOND = 28;
    const BOAT_DIRECTIONS = 16;

    const player = {
        x: WORLD.width / 2,
        y: WORLD.height / 2,
        facing: 8
    };

    const keys = {};
    const boost = {
        value: 100,
        active: false
    };
    let lastFrame = performance.now();

    function initSharkLagoon() {
        bindMovement();
        byId("lagoon-ocean")?.focus();
        requestAnimationFrame(loop);
    }

    function bindMovement() {
        window.addEventListener("keydown", (event) => {
            keys[event.key.toLowerCase()] = true;
            if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "shift"].includes(event.key.toLowerCase())) event.preventDefault();
        });
        window.addEventListener("keyup", (event) => keys[event.key.toLowerCase()] = false);
    }

    function loop(now) {
        const dt = Math.min(0.05, (now - lastFrame) / 1000);
        lastFrame = now;
        updatePlayer(dt);
        renderWorld();
        requestAnimationFrame(loop);
    }

    function updatePlayer(dt) {
        let dx = 0;
        let dy = 0;
        if (keys.a || keys.arrowleft) dx -= 1;
        if (keys.d || keys.arrowright) dx += 1;
        if (keys.w || keys.arrowup) dy -= 1;
        if (keys.s || keys.arrowdown) dy += 1;
        const isMoving = Boolean(dx || dy);
        const wantsBoost = keys[" "] || keys.shift;
        boost.active = isMoving && wantsBoost && boost.value > 0;

        if (boost.active) {
            boost.value = clamp(boost.value - BOOST_DRAIN_PER_SECOND * dt, 0, 100);
        } else {
            boost.value = clamp(boost.value + BOOST_RECHARGE_PER_SECOND * dt, 0, 100);
        }

        if (!isMoving) return;

        const mag = Math.hypot(dx, dy);
        const nx = dx / mag;
        const ny = dy / mag;
        const speed = PLAYER_SPEED * (boost.active ? BOOST_SPEED_MULTIPLIER : 1);
        player.facing = getBoatDirection(nx, ny);
        player.trailX = -nx * 28;
        player.trailY = -ny * 28;
        player.x = clamp(player.x + nx * speed * dt, 0, WORLD.width);
        player.y = clamp(player.y + ny * speed * dt, 0, WORLD.height);
    }

    function getBoatDirection(dx, dy) {
        const angleFromNorth = Math.atan2(dx, -dy);
        const frame = Math.round(((angleFromNorth + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * BOAT_DIRECTIONS) % BOAT_DIRECTIONS;
        return (frame + BOAT_DIRECTIONS / 2) % BOAT_DIRECTIONS;
    }

    function renderWorld() {
        const ocean = byId("lagoon-ocean");
        const boat = byId("lagoon-player");
        if (!ocean || !boat) return;

        const rect = ocean.getBoundingClientRect();
        const cameraX = clamp(player.x - rect.width / 2, 0, WORLD.width - rect.width);
        const cameraY = clamp(player.y - rect.height / 2, 0, WORLD.height - rect.height);
        ocean.style.setProperty("--camera-x", -cameraX + "px");
        ocean.style.setProperty("--camera-y", -cameraY + "px");
        boat.style.left = (player.x - cameraX) + "px";
        boat.style.top = (player.y - cameraY) + "px";
        boat.style.setProperty("--boat-offset", (player.facing * -96) + "px");
        boat.style.setProperty("--trail-x", (player.trailX || 0).toFixed(1) + "px");
        boat.style.setProperty("--trail-y", (player.trailY || 0).toFixed(1) + "px");
        boat.classList.toggle("is-boosting", boost.active);
        renderBoost();
    }

    function renderBoost() {
        const hud = document.querySelector(".lagoon-hud");
        if (!hud) return;

        hud.style.setProperty("--boost-meter", boost.value.toFixed(1));
        hud.classList.toggle("is-boosting", boost.active);
        hud.classList.toggle("is-empty", boost.value <= 0);
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function byId(id) {
        return document.getElementById(id);
    }

    window.initSharkLagoon = initSharkLagoon;
})();
