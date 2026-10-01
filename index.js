// Terminal UI: prints game text to the page, turns the input box into the game's input(), and autosaves.
const SAVE_KEY = "the-last-save.autosave.v1";
const termScreen = document.getElementById("screen");
const termInput = document.getElementById("command");
const termStatus = document.getElementById("status");
let pendingInput = null, cmdHistory = [], cmdIndex = 0;

function write(text) { termScreen.appendChild(document.createTextNode(text)); termScreen.scrollTop = termScreen.scrollHeight; }
function print(...args) { write(args.join(" ") + "\n"); }

function autosave() {
  try { localStorage.setItem(SAVE_KEY, saveCode()); termStatus.textContent = "Autosaved · progress is stored in this browser"; }
  catch (e) { termStatus.textContent = "Autosave unavailable in this browser"; }
}

// The game awaits this wherever the Python version called input().
function input(prompt = "") {
  write(prompt);
  autosave();
  return new Promise(resolve => { pendingInput = resolve; termInput.focus(); });
}

termInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    const value = termInput.value; termInput.value = "";
    if (!pendingInput) return;
    if (value.trim()) { cmdHistory.push(value); if (cmdHistory.length > 100) cmdHistory.shift(); cmdIndex = cmdHistory.length; }
    write(value + "\n");
    const resolve = pendingInput; pendingInput = null; resolve(value);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (cmdHistory.length) { cmdIndex = Math.max(0, cmdIndex - 1); termInput.value = cmdHistory[cmdIndex] || ""; }
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    if (cmdHistory.length) { cmdIndex = Math.min(cmdHistory.length, cmdIndex + 1); termInput.value = cmdHistory[cmdIndex] || ""; }
  }
});

termScreen.addEventListener("click", () => termInput.focus());
document.getElementById("newGame").addEventListener("click", () => {
  if (confirm("Delete the automatic save and start a new game?")) {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    location.reload();
  }
});

let savedCode = "";
try { savedCode = localStorage.getItem(SAVE_KEY) || ""; } catch (e) {}
runGame(savedCode).catch(e => write("\n[error] " + (e && e.stack || e) + "\n"));
