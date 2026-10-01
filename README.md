# THE LAST SAVE

A turn-based crafting RPG with a fourth-wall campaign, as an offline HTML/JS game.

## Play

Open `index.html` in any modern browser (just double-click it). No server, install or internet connection needed.
Progress autosaves in your browser; use `copy` / `load` to back up or move a save code.

## Files

| File            | What it holds                                                         |
| --------------- | --------------------------------------------------------------------- |
| `index.html`    | The terminal page; loads every script below                           |
| `index.js`      | Terminal UI, input handling, autosave, game start                     |
| `items.js`      | Items, weapon skills, consumables, recipes, shop prices               |
| `monsters.js`   | Monsters and enemy attack defaults                                    |
| `dialogue.js`   | Story chapters, areas, characters, quests, scenes, endings            |
| `helpers.js`    | Constants, game state, helpers, item categories, descriptions         |
| `playerGear.js` | Stats, inventory, equipment, item info                                |
| `effects.js`    | Colors, screen shake/flash, floating damage numbers and sound effects |
| `crafting.js`   | Crafting and the shop                                                 |
| `combat.js`     | Enemy AI, combat, fights, bestiary                                    |
| `story.js`      | Story engine, objectives, chapter progress                            |
| `saves.js`      | Save codes (copy / load)                                              |
| `commands.js`   | Command router and main loop                                          |
| `resources/`    | Reserved for extra assets                                             |

## Story

The campaign runs through Chapters 0-10. Chapters 6-10 (Archive of Attempts, Hollow Kingdom, Margin, Blank Page, Last Autosave) each end in a boss and unlock new gear; the final three-way choice now comes after The Last Save in Chapter 10. Old saves that already beat The Witness are moved on to Chapter 6.

## Effects

`effects.js` reacts to the text the game prints: colored lines, red flash and shake when you are hit, gold flash on crits and level-ups, floating damage numbers, colored HP/energy bars and short synthesized sounds (no audio files). Use the Sound button in the title bar to mute. Effects are skipped automatically if the browser asks for reduced motion. To add one, add an entry to `RULES` in `effects.js`.

Scripts are plain classic `<script>` files (no modules or build step), so the game also works straight from `file://`.
