/* admin.js - THE LAST SAVE admin commands
 *
 * Unlock:  type  load  then, at the load prompt, type  admin
 *          (typing  load admin  on one line works too)
 * Use:     admin <command> <arg> <arg> ...      (type  admin help)
 *
 * Load AFTER index.js:  <script src="admin.js"></script>
 *
 * The script finds the player/state object by itself. If it picks the wrong
 * one, put the right global variable name first in CANDIDATES.
 */
(function () {
  "use strict";

  const CANDIDATES = ["state", "player", "game", "gameState", "G", "S", "save", "hero", "p"];
  const SAVERS = ["saveGame", "save", "autosave", "writeSave", "persist"];
  const STAT_KEY = /^(hp|health|level|lvl|gold|xp|exp|energy|coins|money)$/i;
  const INV_KEY = /^(inventory|inv|items|bag|backpack)$/i;

  const readGlobal = (name) => {
    try { return (0, eval)(name); } catch (e) { return undefined; } // sees global let/const too
  };
  const isObj = (v) => v !== null && typeof v === "object";
  const statScore = (o) => (isObj(o) ? Object.keys(o).filter((k) => STAT_KEY.test(k)).length : 0);

  function findState() {
    for (const name of CANDIDATES) {
      const o = readGlobal(name);
      if (statScore(o) > 0) return o;
      if (isObj(o) && statScore(o.player) > 0) return o.player;
    }
    return null;
  }

  // ---------- output ----------
  function out(text, cls) {
    const screen = document.getElementById("screen");
    if (!screen) return;
    String(text).split("\n").forEach((ln) => {
      const div = document.createElement("div");
      div.className = "line " + (cls || "fx-dim");
      div.textContent = ln;
      screen.appendChild(div);
    });
    screen.scrollTop = screen.scrollHeight;
  }
  const ok = (t) => out(t, "fx-heal");
  const bad = (t) => out(t, "fx-hurt");

  // ---------- helpers ----------
  function parseArg(s) {
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    if (s === "true") return true;
    if (s === "false") return false;
    if (s === "null") return null;
    if (/^[\[{]/.test(s)) { try { return JSON.parse(s); } catch (e) { /* keep string */ } }
    return s;
  }

  function tokenize(line) {
    const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    const t = [];
    let m;
    while ((m = re.exec(line))) t.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
    return t;
  }

  function getPath(obj, path) {
    return path.split(".").reduce((o, k) => (isObj(o) ? o[k] : undefined), obj);
  }

  function setPath(obj, path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    let o = obj;
    for (const k of keys) {
      if (!isObj(o[k])) o[k] = {};
      o = o[k];
    }
    o[last] = value;
  }

  // Resolve a field name case-insensitively (so "gold" finds "Gold").
  function resolvePath(obj, path) {
    const keys = path.split(".");
    let o = obj;
    const real = [];
    for (const k of keys) {
      if (!isObj(o)) { real.push(k); continue; }
      const hit = Object.keys(o).find((x) => x.toLowerCase() === k.toLowerCase());
      real.push(hit || k);
      o = o[hit || k];
    }
    return real.join(".");
  }

  function findKey(obj, re) {
    return Object.keys(obj).find((k) => re.test(k) && typeof obj[k] === "number");
  }

  function trySave() {
    for (const name of SAVERS) {
      const fn = readGlobal(name);
      if (typeof fn === "function") {
        try { fn(); return name + "()"; } catch (e) { /* try next */ }
      }
    }
    return null;
  }

  const brief = (v) => {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return s === undefined ? String(v) : s.length > 300 ? s.slice(0, 300) + "..." : s;
  };

  // ---------- admin commands ----------
  const commands = {
    help() {
      out(
        [
          "admin commands (type admin on its own to see this list):",
          "  admin show [path]            show the player, or one field (e.g. inventory.potion)",
          "  admin set <path> <value>     set a field   (admin set hp 50)",
          "  admin add <path> <n>         add to a number (negative subtracts)",
          "  admin heal                   restore hp and energy",
          "  admin gold <n>               add gold",
          "  admin level <n>              set level",
          "  admin give <item> [n]        add item(s) to the inventory",
          "  admin take <item> [n]        remove item(s) from the inventory",
          "  admin call <fn> [args...]    call any global game function",
          "  admin save                   save the game",
          "  admin lock                   turn admin off",
        ].join("\n"),
        "fx-loot"
      );
    },

    show(s, [path]) {
      if (!path) {
        Object.keys(s).forEach((k) => {
          if (typeof s[k] !== "function") out(k + ": " + brief(s[k]));
        });
        return;
      }
      const real = resolvePath(s, path);
      const v = getPath(s, real);
      if (v === undefined) return bad("No field '" + path + "'. Try: admin show");
      out(real + " = " + brief(v));
    },

    set(s, [path, ...rest]) {
      if (!path || !rest.length) return bad("Usage: admin set <path> <value>");
      const real = resolvePath(s, path);
      const value = parseArg(rest.join(" "));
      setPath(s, real, value);
      ok(real + " = " + brief(value));
    },

    add(s, [path, n]) {
      if (!path || n === undefined) return bad("Usage: admin add <path> <n>");
      const real = resolvePath(s, path);
      const cur = getPath(s, real);
      const num = Number(n);
      if (typeof cur !== "number" || Number.isNaN(num)) return bad(real + " is not a number");
      setPath(s, real, cur + num);
      ok(real + " = " + (cur + num));
    },

    heal(s) {
      const hp = findKey(s, /^(hp|health)$/i);
      if (!hp) return bad("No hp field found");
      const max = findKey(s, /^(max_?hp|maxhealth|hpmax|max_?health)$/i);
      s[hp] = max ? s[max] : Math.max(s[hp], 999);
      const en = findKey(s, /^energy$/i);
      const enMax = findKey(s, /^(max_?energy|energymax)$/i);
      if (en && enMax) s[en] = s[enMax];
      ok("Healed: " + hp + " = " + s[hp]);
    },

    gold(s, [n]) {
      const k = findKey(s, /^(gold|coins|money)$/i);
      if (!k) return bad("No gold field found");
      const num = Number(n);
      if (Number.isNaN(num)) return bad("Usage: admin gold <n>");
      s[k] += num;
      ok(k + " = " + s[k]);
    },

    level(s, [n]) {
      const k = findKey(s, /^(level|lvl)$/i);
      const num = Number(n);
      if (!k || Number.isNaN(num)) return bad(k ? "Usage: admin level <n>" : "No level field found");
      s[k] = num;
      ok(k + " = " + num);
    },

    give(s, [item, n]) {
      if (!item) return bad("Usage: admin give <item> [n]");
      const invKey = Object.keys(s).find((k) => INV_KEY.test(k) && isObj(s[k]));
      if (!invKey) return bad("No inventory found on the player");
      const inv = s[invKey];
      const count = n === undefined ? 1 : Number(n);
      if (Number.isNaN(count)) return bad("Usage: admin give <item> [n]");
      if (Array.isArray(inv)) {
        for (let i = 0; i < count; i++) inv.push(item);
        ok("Added " + count + " x " + item + " to " + invKey + " (list)");
      } else {
        const real = Object.keys(inv).find((k) => k.toLowerCase() === item.toLowerCase()) || item;
        inv[real] = (Number(inv[real]) || 0) + count;
        ok(real + " x" + inv[real] + " in " + invKey);
      }
    },

    take(s, [item, n]) {
      if (!item) return bad("Usage: admin take <item> [n]");
      const invKey = Object.keys(s).find((k) => INV_KEY.test(k) && isObj(s[k]));
      if (!invKey) return bad("No inventory found on the player");
      const inv = s[invKey];
      const count = n === undefined ? 1 : Number(n);
      if (Array.isArray(inv)) {
        let removed = 0;
        for (let i = inv.length - 1; i >= 0 && removed < count; i--) {
          const e = inv[i];
          const name = typeof e === "string" ? e : e && (e.id || e.name);
          if (String(name).toLowerCase() === item.toLowerCase()) { inv.splice(i, 1); removed++; }
        }
        ok("Removed " + removed + " x " + item);
      } else {
        const real = Object.keys(inv).find((k) => k.toLowerCase() === item.toLowerCase());
        if (!real) return bad("No '" + item + "' in " + invKey);
        inv[real] = Math.max(0, (Number(inv[real]) || 0) - count);
        ok(real + " x" + inv[real] + " in " + invKey);
      }
    },

    call(s, [fnName, ...args]) {
      if (!fnName) return bad("Usage: admin call <fn> [args...]");
      const fn = readGlobal(fnName);
      if (typeof fn !== "function") return bad("No global function '" + fnName + "'");
      const result = fn(...args.map(parseArg));
      ok(fnName + "() done" + (result !== undefined ? " -> " + brief(result) : ""));
    },

    save() {
      const used = trySave();
      used ? ok("Saved via " + used) : bad("No save function found; the game may autosave on your next action");
    },
  };

  function runAdmin(line) {
    const [, sub = "help", ...args] = tokenize(line);
    const name = sub.toLowerCase();

    if (name === "lock") {
      unlocked = false;
      return out("[admin access removed]", "fx-warning");
    }
    if (!Object.prototype.hasOwnProperty.call(commands, name)) {
      return bad("Unknown admin command '" + sub + "'. Type: admin");
    }
    const state = findState();
    if (!state && name !== "help" && name !== "call") {
      return bad(
        "No player object found. Start or load a game first, or add your state variable's name to CANDIDATES in admin.js."
      );
    }
    try {
      commands[name](state, args);
    } catch (e) {
      bad("admin " + name + " failed: " + e.message);
    }
  }

  // ---------- unlock via the load command ----------
  let unlocked = false;
  let awaitingLoad = false; // true after the player typed a bare "load"

  function unlock() {
    awaitingLoad = false;
    unlocked = true;
    out("[admin access granted]  type: admin", "fx-glitch");
  }

  const cmd = document.getElementById("command");
  if (cmd) {
    cmd.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Enter") return;
        const line = cmd.value.trim();
        const lower = line.toLowerCase();

        const swallow = () => {
          e.preventDefault();
          e.stopImmediatePropagation(); // the game never sees it
          cmd.value = "";
        };

        // "load admin"  or  "load" followed by "admin" at the load prompt
        if (/^load\s+admin$/.test(lower) || (awaitingLoad && lower === "admin")) {
          swallow();
          return unlock();
        }

        awaitingLoad = lower === "load";

        // "admin <command> ..." once unlocked
        if (unlocked && (lower === "admin" || lower.startsWith("admin "))) {
          swallow();
          out(">>> " + line, "fx-dim");
          runAdmin(line);
        }
      },
      true // capture phase: runs before the game's own handler
    );
  }

  // If the game's load command uses a browser prompt() box instead of the terminal.
  const nativePrompt = window.prompt;
  window.prompt = function () {
    const answer = nativePrompt.apply(this, arguments);
    if (awaitingLoad && typeof answer === "string" && answer.trim().toLowerCase() === "admin") {
      unlock();
      return null;
    }
    return answer;
  };
})();
