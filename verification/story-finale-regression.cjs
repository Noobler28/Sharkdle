// Exercise the real campaign/ending flow without contacting Firebase or changing a player save.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('Story/story.js');
const html = read('Story/index.html');
const saveKey = 'sharkdle_story_mode_v2';

function harness(storage = new Map()) {
    const events = {}, timers = [], achievements = [];
    let document;
    class Element {
        constructor(tag = 'div') {
            this.tagName = tag.toUpperCase();
            this.children = [];
            this.style = {};
            this.dataset = {};
            this.attributes = {};
            this.events = {};
            this.textContent = '';
            this.hidden = false;
            this.open = false;
            this.classes = new Set();
            this.classList = {
                add: name => this.classes.add(name),
                remove: name => this.classes.delete(name),
                contains: name => this.classes.has(name),
                toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name)
            };
        }
        get className() { return [...this.classes].join(' '); }
        set className(value) { this.classes = new Set(value.split(/\s+/)); }
        get innerHTML() { return this.markup || ''; }
        set innerHTML(value) {
            for (const child of this.children) child.parent = null;
            this.children = [];
            this.markup = value;
        }
        get isConnected() { return this === document.body || Boolean(this.parent?.isConnected); }
        appendChild(child) { child.parent = this; this.children.push(child); return child; }
        setAttribute(key, value) { this.attributes[key] = value; }
        removeAttribute(key) { delete this.attributes[key]; delete this[key]; }
        addEventListener(name, fn) { this.events[name] = fn; }
        focus() { document.activeElement = this; }
        showModal() { assert.ok(!this.open); this.open = true; }
        close() { this.open = false; }
        remove() {
            if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
            this.parent = null;
        }
    }
    const body = new Element('body');
    const ids = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(match => [match[1], new Element()]));
    const all = () => {
        const walk = node => [node, ...node.children.flatMap(walk)];
        return walk(body);
    };
    document = {
        body, activeElement: body,
        getElementById: id => ids[id] || null,
        createElement: tag => new Element(tag),
        addEventListener: (name, fn) => { events[name] = fn; },
        querySelector: selector => selector.startsWith('.')
            ? all().find(node => node.classes.has(selector.slice(1))) || null
            : null
    };
    Object.values(ids).forEach(node => body.appendChild(node));
    ids['area-modal'].classList.add('hidden');
    const context = vm.createContext({
        document, console,
        window: {
            unlockAchievement: id => achievements.push(id),
            getCurrentProfileData: () => ({ username: '<Agent & Finn>' })
        },
        localStorage: {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, String(value))
        },
        requestAnimationFrame: fn => fn(),
        setTimeout: fn => { timers.push(fn); return timers.length; }
    });
    vm.runInContext(source, context);
    const run = code => vm.runInContext(code, context);
    return {
        run, storage, achievements, document, ids,
        boot: () => events.DOMContentLoaded(),
        flush: () => { while (timers.length) timers.shift()(); },
        state: () => JSON.parse(run('JSON.stringify(storyState)')),
        scene: () => ids['story-finale-text'].textContent,
        next: () => ids['story-finale-next'].onclick(),
        launcher: () => document.querySelector('.story-finale-launcher')
    };
}

function completedSave(except = null) {
    const h = harness();
    const state = h.run('defaultStoryState()');
    for (const [id, area] of Object.entries(state.areas)) {
        area.unlocked = true;
        area.completed = id !== except;
        area.bossCompleted = id !== except;
        area.species = Array.from({ length: 3 }, () => [true, true, true]);
    }
    return JSON.parse(JSON.stringify(state));
}
const withSave = state => new Map([[saveKey, JSON.stringify(state)]]);

// New/unfinished campaigns cannot expose the ending, including through a replay call.
const fresh = harness();
fresh.boot();
assert.equal(fresh.ids['story-finale'].open, false);
assert.equal(fresh.launcher(), null);
assert.equal(fresh.run('openStoryFinale({ replay: true })'), false);
assert.equal(fresh.state().finale.seen, false);

// Completing another chapter, or Japan with an earlier chapter missing, cannot trigger it.
const unfinished = harness(withSave(completedSave('indian')));
unfinished.boot();
unfinished.run('completeArea("japan")');
unfinished.flush();
assert.equal(unfinished.ids['story-finale'].open, false);
assert.equal(unfinished.launcher(), null);

// The real final completion runs the celebration first, then the ending.
const finish = harness(withSave(completedSave('japan')));
finish.boot();
finish.run('completeArea("japan"); saveStoryState(); renderMap();');
assert.equal(finish.ids['story-finale'].open, false);
assert.ok(finish.launcher());
assert.deepEqual(finish.achievements, ['japan_master']);
finish.flush();
assert.equal(finish.ids['story-finale'].open, true);
assert.equal(finish.document.activeElement, finish.ids['story-finale-next']);
assert.equal(finish.ids['story-finale-image'].hidden, true);
assert.equal(finish.ids['story-finale-back'].disabled, true);
finish.next();
assert.ok(finish.scene().includes('<Agent & Finn>'), 'username is inserted as text');
assert.equal(finish.ids['story-finale-image'].src, 'images/storyMode/DrFinn.png');
finish.next();
assert.equal(finish.ids['story-finale-image'].src, 'images/storyMode/Patch.png');
assert.equal(finish.ids['story-finale-image'].alt, 'An unidentified shark in the transmission');
finish.next();
assert.equal(finish.ids['story-finale-speaker'].textContent, 'Dr. Finn');
assert.match(finish.scene(), /Patch/);
finish.ids['story-finale-back'].onclick();
assert.equal(finish.state().finale.step, 2);
finish.next();

// Escape preserves an unfinished scene, removes the scroll lock and permits resuming.
let prevented = false;
finish.ids['story-finale'].events.cancel({ preventDefault: () => { prevented = true; } });
assert.ok(prevented);
assert.equal(finish.ids['story-finale'].open, false);
assert.equal(finish.document.body.classList.contains('story-finale-open'), false);
assert.equal(finish.state().finale.seen, false);
assert.equal(finish.state().finale.step, 3);
finish.launcher().onclick();
assert.match(finish.scene(), /Patch/);
finish.ids['story-finale-close'].onclick();

// Reloading a completed older save automatically resumes the unseen reveal.
const resumed = harness(finish.storage);
resumed.boot();
assert.equal(resumed.ids['story-finale'].open, true);
assert.equal(resumed.state().finale.step, 3);
assert.match(resumed.scene(), /Patch/);
const restoredAreas = JSON.stringify(resumed.state().areas);
const lines = [];
while (resumed.ids['story-finale-next'].textContent !== 'Return to map') {
    resumed.next();
    lines.push(resumed.scene());
}
assert.ok(lines.some(line => line.includes('I was trying to call for help')), 'Patch explains his protective intention');
assert.ok(lines.some(line => line.includes('Your tag was damaged')), 'the collapse is traced to a damaged tag');
assert.ok(lines.some(line => line.includes('You were right to call for help')), 'Finn responds supportively');
assert.equal(resumed.ids['story-finale-image'].hidden, true, 'narration clears the portrait');
assert.equal(resumed.ids['story-finale-image'].src, undefined);
assert.equal(resumed.state().finale.seen, false, 'finish is recorded only when the player exits the last scene');
resumed.next();
assert.equal(resumed.state().finale.seen, true);
assert.equal(resumed.ids['story-finale'].open, false);
assert.equal(JSON.stringify(resumed.state().areas), restoredAreas, 'ending preserves all campaign progress');
assert.equal(resumed.achievements.length, 0, 'viewing the ending does not repeat achievements');

// Seen endings do not auto-open again. Replays are explicit and award nothing.
const replay = harness(resumed.storage);
replay.boot();
assert.equal(replay.ids['story-finale'].open, false);
assert.match(replay.launcher().innerHTML, /Replay the ending/);
replay.launcher().focus();
replay.launcher().onclick();
assert.equal(replay.run('finaleStepIndex'), 0);
replay.next();
replay.ids['story-finale-close'].onclick();
assert.equal(replay.state().finale.seen, true);
assert.equal(replay.achievements.length, 0);
assert.equal(replay.document.activeElement, replay.launcher(), 'focus returns to the rebuilt launcher');

const legacy = completedSave();
delete legacy.finale;
const old = harness(withSave(legacy));
old.boot();
assert.equal(old.ids['story-finale'].open, true, 'players who already cleared the campaign can see the new ending');
for (const step of [-20, 999, '3', null]) {
    const malformed = completedSave();
    malformed.finale = { seen: 'true', step };
    const h = harness(withSave(malformed));
    h.boot();
    assert.equal(h.ids['story-finale'].open, true);
    assert.ok(h.state().finale.step >= 0 && h.state().finale.step < h.run('STORY_FINALE_SCENES.length'));
    assert.ok(h.scene());
}

// Every referenced control and character asset exists in the actual delivered page.
for (const id of source.matchAll(/getElementById\("(story-finale[^\"]*)"\)/g)) {
    assert.equal([...html.matchAll(new RegExp(`id="${id[1]}"`, 'g'))].length, 1, id[1]);
}
for (const scene of fresh.run('STORY_FINALE_SCENES')) {
    if (!scene.image) continue;
    let directory = root;
    for (const component of scene.image.split('/')) {
        assert.ok(fs.readdirSync(directory).includes(component), scene.image + ' exists with exact casing');
        directory = path.join(directory, component);
    }
}
assert.match(html, /<dialog[^>]+id="story-finale"[^>]+aria-labelledby=/);
assert.match(read('Story/story-guide.css'), /\.story-finale:not\(\[open\]\)\s*\{\s*display:\s*none/);
for (const file of ['Story/story.js', 'Story/story-guide.css', 'images/storyMode/Patch.png', 'images/storyMode/DrFinn.png']) {
    assert.deepEqual(fs.readFileSync(path.join(root, 'SharkdleMobile/www', file)), fs.readFileSync(path.join(root, file)), 'mobile parity: ' + file);
}
const finaleTemplate = page => page.match(/<dialog id="story-finale"[\s\S]*?<\/dialog>/)[0].replace(/\r\n/g, '\n');
const mobileHtml = read('SharkdleMobile/www/Story/index.html');
assert.equal(finaleTemplate(mobileHtml), finaleTemplate(html), 'web and mobile use the same accessible scene controls');
assert.ok(mobileHtml.includes('href="Story/story-guide.css"'));
console.log('Story finale checks passed: campaign gating, final-breach trigger, recognition and rescue reveal, saved resume, legacy saves, replay, focus and artwork.');
