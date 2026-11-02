# Editing the Sharkdle wiki

The wiki is a static part of the existing site. It does not need another database,
account system, build service or publishing platform.

## Where the writing lives

| File | Content |
| --- | --- |
| `wiki.html` in the project root | Homepage, navigation shell and script order |
| `wiki-data.js` | Category list and initial data container |
| `wiki-play.js` | Guessing, modes, progression, achievements, codes and community |
| `wiki-rng.js` | SharkRNG guides and full upgrade, potion, tier and mutation references |
| `wiki-world.js` | Story, Rescue Command, Lost Treasures, events and update archive |
| `wiki-cosmetics.js` | Cosmetic records, obtainments, artwork, trivia and crate guides |
| `wiki-extra.js` | Settings, glossary, badge references and activity availability |
| `wiki-items.js` | Dedicated cosmetic and crate articles, using shared collection records |
| `wiki-species-data.js` | Compact public species records and current base RNG ratings |
| `wiki-species.js` | Species guide text and linked species, family and order pages |
| `wiki.js` | Rendering, navigation, search, table filters and catalogue filters |
| `wiki-infoboxes.js` | Overview infoboxes for major guides and catalogues |

The main guides are ordinary article records. A record has an `id`, `category`,
`title`, `summary` and `sections`. Use `guide: true` for a walkthrough and
`kind: 'reference'` for a reference entry. `related` contains other article IDs.
`playUrl` can link to an existing game page.

For an article infobox, add `facts` as pairs of labels and values. Values can be
strings or the same linked cell objects used in tables. `image` supports `src`,
`alt` and an optional `caption`; `icon` supports an emoji or plain symbol.
Cosmetic theme articles can use the shared `preview` background definition.

A section supports paragraph strings in `text`, plain strings in `bullets`, an
`image` with `src`, `alt` and optional `caption`, and a `table` with `caption`,
`columns` and `rows`. Table cells can be strings or objects with `text` plus an
`article`, `href` or `image`. Long tables get their own search field. Text is
escaped automatically: do not add raw HTML inside a paragraph or table cell.

Cosmetics are stored once and reused by their IDs across catalogues, crate lists
and trivia pages. Update the shared record rather than writing conflicting
obtainments in several lists.

## Checking changes

From the project folder, run:

```text
node tools/build-wiki.cjs
node verification/wiki-cosmetics-regression.cjs
```

The first command validates content, table shapes, article links, local game
destinations and exact artwork paths. It does not regenerate any writing. The
second exercises all article routes, search, pagination, table and cosmetic
filters, and checks species and cosmetic coverage against the game.

After changing the playable species list or base RNG rating rules, refresh the
compact species reference with:

```text
node tools/build-wiki-species.cjs
```

This refresh affects the species reference only. It preserves the authored
guides, homepage and cosmetic descriptions. Seasonal availability and historical
event notes should be reviewed when the corresponding game rules change.
