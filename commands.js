// Command router and the main game loop (runGame).
class Quit extends Error{}
const COMMANDS={explore:[exploreStory,"explore","Travel the story area and fight - THE way to progress"],story:[showStory,"story","Your chapter, objective and progress"],
  ending:[showEnding,"ending","Make the final choice (after The Witness)"],fight:[fightCommand,"fight [enemy]","Pick an enemy you've already beaten, or a random fight"],
  bestiary:[showBestiary,"bestiary [enemy]","Enemy moves, drops and unlock status"],inventory:[showInventory,"inventory [category]","Your items, sorted by category"],
  stats:[showStats,"stats","Your stats and equipped gear"],skills:[showSkills,"skills","Skills of your equipped weapon"],
  info:[showItemInfo,"info [item]","Stats, recipe, drops and prices of any item"],equip:[equipItem,"equip [item]","Equip a weapon, armor, shield ..."],
  unequip:[unequipItem,"unequip [item]","Take something off"],craft:[craftItem,"craft [item] [amount]","Craft items ('craft potion 5, shield' does several)"],
  recipes:[showRecipes,"recipes [category]","Browse recipes by category"],shop:[shop,"shop [buy|sell|category]","Browse the shop by category"],
  buy:[buyItem,"buy [item] [amount]","Buy from the shop"],sell:[sellItem,"sell [item] [amount]","Sell to the shop ('sell all <item>')"],
  event:[()=>print("\n⚠️ "+fourthWall()),"event","Trigger a fourth-wall event"],copy:[copyData,"copy","Get your save code"],load:[loadData,"load","Load a save code"],
  menu:[()=>showMainMenu(),"menu","Show this list"],quit:[()=>{throw new Quit();},"quit","Leave the game"]};
const MENU=[["PROGRESS",["explore","story","ending"]],["BATTLE",["fight","bestiary"]],["CHARACTER",["inventory","stats","skills","info","equip","unequip"]],
  ["CRAFT & TRADE",["craft","recipes","shop","buy","sell"]],["OTHER",["event","copy","load","menu","quit"]]];
const ORDER=MENU.flatMap(x=>x[1]),cnum=n=>ORDER.indexOf(n)+1;
const ALIASES={progress:"story",inspect:"info",item:"info",help:"menu",m:"menu","?":"menu",exit:"quit",q:"quit"};
function showMainMenu(){print("\n=== WHAT DO YOU WANT TO DO? ===");for(const [t,names] of MENU){print(`\n${t}`);names.forEach(n=>print(`  ${rpad(cnum(n),2)}. ${pad(COMMANDS[n][1],26)} ${COMMANDS[n][2]}`));}
  print("\nType a number or a command name. Commands that need more details will ask,");print("or type it all at once, e.g. 'buy potion 2', 'info iron sword', 'fight goblin'.");}
function keyHint(){const ch=curChapter(),p=STORY_PROGRESS[ch.id],fin=STORY.flags.has("final_defeated");print("\n"+"-".repeat(62));
  print(`📖 Chapter ${ch.id}: ${ch.title}   |   Level ${PLAYER.level}`);
  if(fin)print("🌑 The Last Save is defeated. The final choice is waiting.");
  else{print(`🎯 Objective: ${p.objective}`);if(p.boss&&PLAYER.level>=p.level&&!objectiveComplete())print("⚔️  The chapter boss is ready: 'explore', then choose 'boss'.");}
  print("⭐ Key commands:");print(`   ${rpad(cnum("explore"),2)}. explore  - travel and fight; this is how the story moves forward`);
  print(`   ${rpad(cnum("story"),2)}. story    - check your objective and progress`);
  if(fin&&!STORY.ending)print(`   ${rpad(cnum("ending"),2)}. ending   - make the final choice`);
  print(`   ${rpad(cnum("menu"),2)}. menu     - every command (type a number or a name)`);}
function resolveCommand(w){if(isDigit(w)){const i=+w;return i>=1&&i<=ORDER.length?ORDER[i-1]:null;}w=ALIASES[w]||w;return COMMANDS[w]?w:null;}
async function doFunction(line){const m=line.trim().match(/^(\S+)\s*(.*)$/);if(!m)return;const n=resolveCommand(m[1]);
  if(!n){print("Invalid command! Type 'menu' to see everything you can do.");return;}await COMMANDS[n][0](m[2]);}
async function runGame(savedCode){resetState();
  if(savedCode){try{applySave(await parseSave(savedCode));print("💾 Autosave restored.");}catch(e){resetState();print(`[autosave warning] ${e.message}`);}}
  print("\nWelcome to THE LAST SAVE.");print("This is a campaign, not just a sandbox. Your victories unlock the story.");storyIntro();showStory();showMainMenu();
  try{while(true){keyHint();await doFunction((await input("\nwhat do you want to do? ")).trim().toLowerCase());}}
  catch(e){if(e instanceof Quit)print("Thanks for playing! (Use New Game or reload to play again.)");else throw e;}}
