# Sharkdle stress-test report

Date: 21 October 2026. These are local workspace results; no production deployment or live account changes were made.

## Reproduced and fixed

1. **Fresh-device offline initialization bypass.** A placeholder save could make a signed-in account appear ready before its cloud profile had been loaded. Saving locally no longer turns an uninitialized placeholder into trusted account progress. Existing owned device saves remain playable offline.
2. **Large collections exceeding Firestore request limits.** Chunking alone did not keep the whole transaction small enough. Large collections now use compressed chunks with document/request size checks. Reads validate completeness before replacing local progress. Corrupt or unsupported cloud data leaves the device save intact. Schema rules prevent older clients from downgrading the new save format.
3. **Reward-code retries and competing claims.** Failed network attempts could award local XP before the claim committed. Rewards now commit atomically with an immutable per-account claim document. Rapid clicks, simultaneous devices, account switching during a claim, and a stale profile snapshot cannot duplicate a normal code redemption.
4. **Blacklisted accounts publishing through the fallback collection.** The database rules now block the listed accounts from publishing RNG metrics to `userStats`, as well as blocking `rngLeaderboard` writes. Their ordinary private saves remain available.

The code fixes are present in both the website and the mobile mirror where applicable.

## Results

| Check | Result |
| --- | --- |
| Automated local regression/audit runner | 20/20 passed |
| Sampled RNG choices | 1,000,000 total across web/mobile |
| Seeded save/account operations | 2,400 across 12 accounts and four simulated devices per version |
| Competing save attempts | 240 total; transaction conflicts retried and catches retained |
| Maximum collection round-trip | 297,316 catches; about 79.9 MiB of JSON compressed to 3.60 MiB of cloud data |
| Actual Firebase emulator scenarios | 7/7 passed |
| Static source/resource audit | 80 scripts, 52 inline scripts, 67 HTML pages, 439 local resource references; no syntax errors, missing references or path-case mismatches detected |

The Firebase emulator used the isolated `demo-sharkdle-stress` project and the actual `firestore.rules`. It verified verified-owner access, cross-account/anonymous denials, schema downgrade protection, immutable/validated reward claims, eight competing LSFSW transactions granting once, atomic rollback, all 14 blacklist entries, and canonical-account requirements for leaderboard publication. The actual RNG save implementation also saved and reloaded all 297,316 catches across 298 chunks through Firebase's SDK and emulator.

Other regression cases include local-storage quota failures and IndexedDB fallback, guest/account isolation, delayed reads and writes after an account switch, logout during a save, offline retry, incomplete/corrupt chunks, prestige/reset behavior, orphan leaderboard pagination, forged UID filtering, blacklist removal, malformed redemption caches and stale redemption snapshots.

Browser checks covered the main page, RNG, public leaderboard, mobile homepage/shop/login validation, Daily, Infinite and Achievements. RNG progress survived a refresh. The mobile shop fit a narrow viewport. The active shop contained six pearl purchases and no real-money pack controls. The Advent calendar remained absent with its old preview URL. No JavaScript errors were observed in those checks; Daily logged a nonfatal shared Achievements warning about an absent achievements container.

## Limits and remaining security work

- RNG results, XP and currency are still fundamentally client-managed. A modified client can fabricate its own values. The fixes address the reproduced cloning/replay/publication bugs; fully preventing invented scores requires server-authoritative rolls and reward validation. Some social/multiplayer rules also permit broad authenticated writes and need a separate server-backed security redesign.
- The fresh-device and concurrency tests use simulated devices plus the real local Firebase emulator. They do not establish behavior on every physical Android/iOS device, older WebViews, real mobile networks, production indexes, billing limits or production latency.
- Very large saves require browser support for `CompressionStream`/`DecompressionStream`. Unsupported browsers keep the device save and report an error rather than uploading an incomplete collection. The near-300,000-catch integration case took roughly 64 seconds locally for save plus fresh-device loading; low-memory device performance has not been established.
- This run did not use live credentials, make purchases, create real accounts, or load-test production services. Passing tests cannot prove that no other bugs exist.

## Deployment requirement

Deploy the updated website/mobile code **and `firestore.rules` together**. Code claims now use `userStats/{uid}/redeemedCodes/{code}`, so old rules will reject the new atomic redemption. The new schema and blacklist protections also require the updated rules. Refresh existing clients after deployment. These changes have not been deployed by this test run.

## Reproduce

From the repository root, run `node verification/run-stress.cjs`. Results are saved in `stress-results.json` and `project-audit-results.json` beside this report.

For the separate Firebase integration checks, install the locked test dependencies with `npm ci --prefix verification/firebase-emulator`, set `JAVA_HOME`/`PATH` to Java 21 or newer, and run `node verification/firebase-emulator/run.cjs`. The runner copies the current rules into its ignored emulator directory and only starts the demo project. Results are saved in `firebase-emulator/results.json`. Firebase's emulator runtime is downloaded on the first run.
