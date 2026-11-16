const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const gameSource = fs.readFileSync('script.js', 'utf8');
const themeStart = gameSource.indexOf('const sharkPassCardThemes = ');
const themeOpen = gameSource.indexOf('[', themeStart);
const themeEnd = gameSource.indexOf('\n];', themeOpen) + 2;
const themes = vm.runInNewContext('(' + gameSource.slice(themeOpen, themeEnd) + ')');

const badgeStart = gameSource.indexOf('const allBadges = ');
const badgeEnd = gameSource.indexOf('\nfunction getUnlockedBadges', badgeStart);
const badgeContext = {};
vm.runInNewContext(gameSource.slice(badgeStart, badgeEnd)
  .replace('const allBadges =', 'let allBadges =') + '\nthis.badges = allBadges;', badgeContext);

for (const [helperPath, pagePath] of [
  ['Leaderboard/cosmetics-display.js', 'Leaderboard/index.html'],
  ['SharkdleMobile/www/Leaderboard/cosmetics-display.js', 'SharkdleMobile/www/Leaderboard/index.html']
]) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(helperPath, 'utf8'), context, { filename: helperPath });
  const display = context.window.SharkdleCosmeticsDisplay;
  const page = fs.readFileSync(pagePath, 'utf8');

  for (const theme of themes) {
    assert.equal(display.sanitizeCardTheme(theme.id), theme.id, `${helperPath}: theme ${theme.id} is recognized`);
    assert.ok(page.includes(`lb-theme-${theme.id}`), `${pagePath}: theme ${theme.id} has a leaderboard treatment`);
    for (const match of theme.preview.matchAll(/url\((?:["']?)(images\/[^\s"')]+)/g)) {
      assert.ok(fs.existsSync(match[1]), `${theme.id}: missing artwork ${match[1]}`);
    }
  }

  for (const badge of badgeContext.badges) {
    const displayed = display.getBadgeMeta(badge.id);
    assert.equal(displayed.name, badge.name, `${helperPath}: badge ${badge.id} has the right name`);
    assert.equal(displayed.emoji, badge.emoji, `${helperPath}: badge ${badge.id} has the right icon`);
  }

  for (const picture of [
    'images/pfp/shark1.png',
    'images/leaderPfp/Shark19.png',
    'images/cratePfp/ThanksgivingPfp/BonnetheadShark.png',
    'images/codePfp/MantaRay.png',
    'images/loginPfp/Shark20.png'
  ]) {
    assert.equal(display.resolveProfilePicturePath(picture), picture, `${helperPath}: profile image path ${picture} is preserved`);
  }
}

console.log('PASS leaderboard display supports every profile theme, badge and representative profile picture');
