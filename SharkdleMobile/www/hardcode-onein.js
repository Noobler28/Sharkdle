#!/usr/bin/env node
/**
 * Sharkdle OneIn hardcoder
 *
 * Usage:
 *   node hardcode-onein.js sharks.js
 *
 * Output:
 *   sharks.onein.js
 *
 * This edits every shark object to include a literal hardcoded OneIn field.
 * It does NOT add a runtime generator to your game file.
 */

const fs = require("fs");
const path = require("path");

const inputFile = process.argv[2] || "sharks.js";

if (!fs.existsSync(inputFile)) {
  console.error(`Could not find ${inputFile}`);
  process.exit(1);
}

let source = fs.readFileSync(inputFile, "utf8");

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(str) {
  return hashString(str) / 4294967295;
}

function niceRound(n) {
  if (n >= 100_000_000) return Math.round(n / 5_000_000) * 5_000_000;
  if (n >= 10_000_000) return Math.round(n / 1_000_000) * 1_000_000;
  if (n >= 1_000_000) return Math.round(n / 100_000) * 100_000;
  if (n >= 100_000) return Math.round(n / 10_000) * 10_000;
  if (n >= 10_000) return Math.round(n / 1_000) * 1_000;
  if (n >= 1_000) return Math.round(n / 100) * 100;
  if (n >= 100) return Math.round(n / 10) * 10;
  return Math.max(8, Math.round(n));
}

function generateOneIn(shark, index) {
  const min = 8;
  const max = 500_000_000;

  // Main rarity is log-scale, so there are no insane jumps.
  const baseRand = seededRandom(`${shark.name}|${shark.family}|${shark.genus}|${shark.yod}|${index}|base`);

  // Curve keeps most sharks playable, while still letting a few hit insane odds.
  const curved = Math.pow(baseRand, 1.72);
  let rarity = min * Math.pow(max / min, curved);

  // Independent chaos prevents same family/order/genus from feeling grouped.
  const chaosA = 0.72 + seededRandom(`${shark.name}|chaosA`) * 0.76;
  const chaosB = 0.88 + seededRandom(`${shark.order}|${index}|chaosB`) * 0.34;
  rarity *= chaosA * chaosB;

  // A few hand-feel nudges based on size, but deliberately weak.
  const sizeNudge = {
    Tiny: 0.92,
    Small: 1.00,
    Medium: 1.08,
    Large: 1.20,
    Giant: 1.45,
  }[shark.size] || 1;

  rarity *= sizeNudge;

  // Very rare outlier chance, still capped.
  const outlier = seededRandom(`${shark.name}|${shark.yod}|outlier`);
  if (outlier > 0.985) rarity *= 7.5;
  else if (outlier > 0.965) rarity *= 3.0;
  else if (outlier < 0.025) rarity *= 0.23;

  rarity = Math.max(min, Math.min(max, rarity));
  return niceRound(rarity);
}

function parseObjectLiteral(objText) {
  const fields = {};
  const re = /"([^"]+)"\s*:\s*(?:"([^"]*)"|([0-9]+))/g;
  let m;
  while ((m = re.exec(objText))) {
    fields[m[1]] = m[2] !== undefined ? m[2] : Number(m[3]);
  }
  return fields;
}

// Matches the shark object literals in your file.
const objectRegex = /\{[\s\S]*?"name"\s*:\s*"[^"]+"[\s\S]*?\}/g;
let count = 0;
const used = new Map();

source = source.replace(objectRegex, (objText) => {
  const shark = parseObjectLiteral(objText);

  if (!shark.name || !shark.family || !shark.order || !shark.genus) {
    return objText;
  }

  let oneIn = generateOneIn(shark, count);

  // Avoid too many duplicate exact odds.
  while (used.has(oneIn)) {
    oneIn = niceRound(oneIn * (1.04 + seededRandom(`${shark.name}|dupe|${oneIn}`) * 0.08));
    oneIn = Math.min(500_000_000, Math.max(8, oneIn));
  }
  used.set(oneIn, shark.name);

  count++;

  if (/"OneIn"\s*:/.test(objText) || /\bOneIn\s*:/.test(objText)) {
    return objText.replace(/("?OneIn"?)\s*:\s*[0-9_]+/, `$1: ${oneIn}`);
  }

  // Insert after yod if present, otherwise before closing brace.
  if (/"yod"\s*:\s*[0-9]+/.test(objText)) {
    return objText.replace(/("yod"\s*:\s*[0-9]+)/, `$1, "OneIn": ${oneIn}`);
  }

  return objText.replace(/\}$/, `, "OneIn": ${oneIn} }`);
});

const outputFile = path.join(
  path.dirname(inputFile),
  path.basename(inputFile, path.extname(inputFile)) + ".onein" + path.extname(inputFile)
);

fs.writeFileSync(outputFile, source);

console.log(`Done. Added hardcoded OneIn fields to ${count} sharks.`);
console.log(`Output written to: ${outputFile}`);
