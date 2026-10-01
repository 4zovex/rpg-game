// Terminal UI: prints game text to the page, turns the input box into the game's input(), and autosaves.
const SAVE_KEY = "the-last-save.autosave.v1";
const termScreen = document.getElementById("screen");
const termInput = document.getElementById("command");
const termStatus = document.getElementById("status");
let pendingInput = null,
  cmdHistory = [],
  cmdIndex = 0;

// Adds text to the screen. Text ending in "\n" becomes a finished line; anything else (like the
// "what do you want to do?" prompt) stays on the same line as what the player types next.
function write(text) {
  const endsLine = text.endsWith("\n");
  const body = endsLine ? text.slice(0, -1) : text;
  termScreen.appendChild(FX.renderLine(body, { plain: true, newline: endsLine }));
  termScreen.scrollTop = termScreen.scrollHeight;
}

// The game's print(): each line goes through the effects system (colors, shakes, sounds...).
function print(...args) {
  for (const line of args.join(" ").split("\n")) {
    termScreen.appendChild(FX.renderLine(line));
  }
  termScreen.scrollTop = termScreen.scrollHeight;
}

function autosave() {
  try {
    localStorage.setItem(SAVE_KEY, saveCode());
    termStatus.textContent = "Autosaved · progress is stored in this browser";
  } catch (e) {
    termStatus.textContent = "Autosave unavailable in this browser";
  }
}

// The game awaits this wherever the Python version called input().
function input(prompt = "") {
  write(prompt);
  autosave();
  return new Promise((resolve) => {
    pendingInput = resolve;
    termInput.focus();
  });
}

termInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const value = termInput.value;
    termInput.value = "";
    if (!pendingInput) return;
    if (value.trim()) {
      cmdHistory.push(value);
      if (cmdHistory.length > 100) cmdHistory.shift();
      cmdIndex = cmdHistory.length;
    }
    write(value + "\n");
    const resolve = pendingInput;
    pendingInput = null;
    resolve(value);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (cmdHistory.length) {
      cmdIndex = Math.max(0, cmdIndex - 1);
      termInput.value = cmdHistory[cmdIndex] || "";
    }
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    if (cmdHistory.length) {
      cmdIndex = Math.min(cmdHistory.length, cmdIndex + 1);
      termInput.value = cmdHistory[cmdIndex] || "";
    }
  }
});

termScreen.addEventListener("click", () => termInput.focus());
document.getElementById("newGame").addEventListener("click", () => {
  if (confirm("Delete the automatic save and start a new game?")) {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
    location.reload();
  }
});

let savedCode = "";
try {
  savedCode = localStorage.getItem(SAVE_KEY) || "";
} catch (e) {}
runGame(savedCode).catch((e) => write("\n[error] " + ((e && e.stack) || e) + "\n"));
