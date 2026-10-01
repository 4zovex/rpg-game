// Visual and audio effects for the terminal.
//
// The game engine only ever calls print(). This file watches the lines being printed and
// reacts to them: it colors them, shakes or flashes the screen, floats damage numbers and plays
// small synthesized sounds (no audio files, so the game still works offline from file://).
//
// To add a new effect, add one entry to RULES below. To mute everything, use the Sound button.

const FX = (() => {
  const SOUND_KEY = "the-last-save.sound";
  const STAGGER_MS = 16; // delay between lines printed in the same burst
  const STAGGER_MAX_MS = 500; // a long burst never takes longer than this to appear

  const terminal = document.querySelector(".terminal");
  const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Sound ----------

  let soundOn = true;
  try {
    soundOn = localStorage.getItem(SOUND_KEY) !== "off";
  } catch (e) {}

  let audio = null; // created on the first key press or click (browsers block it before that)
  const lastPlayed = {};

  function unlockAudio() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!audio && AudioCtx) audio = new AudioCtx();
    if (audio && audio.state === "suspended") audio.resume();
  }
  ["keydown", "pointerdown"].forEach((evt) => window.addEventListener(evt, unlockAudio));

  // Plays one note. `slideTo` bends the pitch, `delay` (seconds) lets us chain notes into a tune.
  function tone(
    freq,
    duration,
    { type = "square", volume = 0.05, slideTo = null, delay = 0 } = {}
  ) {
    const start = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  // Short melody helper: plays each note a little after the previous one.
  function melody(notes, { step = 0.1, length = 0.16, type = "square", volume = 0.05 } = {}) {
    notes.forEach((freq, i) => tone(freq, length, { type, volume, delay: i * step }));
  }

  const SOUNDS = {
    hit: () => tone(220, 0.12, { slideTo: 90 }),
    hurt: () => tone(150, 0.22, { type: "sawtooth", slideTo: 50, volume: 0.08 }),
    crit: () => {
      tone(660, 0.08);
      tone(990, 0.14, { delay: 0.07 });
    },
    parry: () => {
      tone(1200, 0.05, { type: "triangle" });
      tone(800, 0.1, { type: "triangle", delay: 0.04 });
    },
    dodge: () => tone(500, 0.18, { type: "triangle", slideTo: 1200, volume: 0.04 }),
    heal: () => {
      tone(440, 0.12, { type: "sine" });
      tone(660, 0.18, { type: "sine", delay: 0.1 });
    },
    coin: () => {
      tone(988, 0.06, { volume: 0.03 });
      tone(1319, 0.12, { volume: 0.03, delay: 0.06 });
    },
    warning: () => {
      tone(880, 0.1, { volume: 0.05 });
      tone(880, 0.1, { volume: 0.05, delay: 0.16 });
    },
    encounter: () => tone(110, 0.3, { type: "sawtooth", slideTo: 70, volume: 0.07 }),
    levelUp: () => melody([523, 659, 784, 1047], { step: 0.09 }),
    victory: () => melody([392, 523, 659], { step: 0.12, length: 0.2 }),
    defeat: () => melody([330, 262, 196, 147], { step: 0.18, length: 0.3, type: "sawtooth" }),
    chapter: () => melody([196, 247, 294, 392, 494], { step: 0.16, length: 0.3, type: "triangle" }),
    glitch: () => {
      for (let i = 0; i < 4; i++) {
        tone(100 + Math.random() * 900, 0.05, { volume: 0.03, delay: i * 0.05 });
      }
    },
  };

  function play(name) {
    if (!soundOn || !audio || audio.state !== "running") return;
    const now = performance.now();
    if (now - (lastPlayed[name] || 0) < 70) return; // avoid a wall of sound from rapid lines
    lastPlayed[name] = now;
    SOUNDS[name]();
  }

  function setSound(on) {
    soundOn = on;
    try {
      localStorage.setItem(SOUND_KEY, on ? "on" : "off");
    } catch (e) {}
    const button = document.getElementById("soundToggle");
    if (button) button.textContent = on ? "🔊 Sound on" : "🔇 Sound off";
  }

  // ---------- Screen effects ----------

  const flashLayer = document.createElement("div");
  flashLayer.className = "fx-flash";
  terminal.appendChild(flashLayer);

  // Restarts a CSS animation by removing the class, forcing a reflow, then adding it back.
  function restartClass(element, className) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
  }

  function flash(color) {
    if (reduceMotion) return;
    flashLayer.style.background = color;
    restartClass(flashLayer, "on");
  }

  function shake(strong = false) {
    if (reduceMotion) return;
    terminal.classList.remove("shake", "shake-strong");
    void terminal.offsetWidth;
    terminal.classList.add(strong ? "shake-strong" : "shake");
  }

  // Damage number that drifts up from the player (left) or the enemy (right).
  function floatNumber(text, side, kind) {
    if (reduceMotion) return;
    const el = document.createElement("div");
    el.className = `fx-float ${kind}`;
    el.textContent = text;
    el.style.left = side === "player" ? "22%" : "68%";
    el.style.top = `${28 + Math.random() * 12}%`;
    el.style.marginLeft = `${Math.random() * 50 - 25}px`;
    terminal.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  // ---------- Line rules ----------
  // Each rule: `match` is tested against a printed line, `cls` colors it, and `run` (optional)
  // triggers effects. The first rule that matches wins. `m` is the regex match.

  const RULES = [
    {
      match: /^\s*💔 You are hit for (\d+)/,
      cls: "fx-hurt",
      run: (m) => {
        shake(+m[1] >= 30);
        flash("rgba(220, 40, 40, 0.35)");
        floatNumber(`-${m[1]}`, "player", "hurt");
        play("hurt");
      },
    },
    {
      match: /Counterattack deals (\d+) damage/,
      cls: "fx-crit",
      run: (m) => {
        floatNumber(m[1], "enemy", "crit");
        flash("rgba(255, 210, 80, 0.25)");
        play("crit");
      },
    },
    {
      match: /You hit the .* for (\d+) damage/,
      cls: "fx-hit",
      run: (m) => {
        floatNumber(m[1], "enemy", "hit");
        play("hit");
      },
    },
    {
      match: /Critical hit|PERFECT PARRY/,
      cls: "fx-crit",
      run: () => {
        flash("rgba(255, 210, 80, 0.25)");
        play("crit");
      },
    },
    {
      match: /⚔️ PARRY!/,
      cls: "fx-parry",
      run: () => {
        flash("rgba(120, 200, 255, 0.2)");
        play("parry");
      },
    },
    { match: /You dodge the attack|You escaped/, cls: "fx-dodge", run: () => play("dodge") },
    {
      match: /🧪 You use|You drain \d+ HP/,
      cls: "fx-heal",
      run: () => {
        flash("rgba(60, 200, 110, 0.2)");
        play("heal");
      },
    },
    {
      match: /LEVEL UP/,
      cls: "fx-levelup",
      run: () => {
        flash("rgba(255, 215, 90, 0.35)");
        play("levelUp");
      },
    },
    {
      match: /🏆 You defeated/,
      cls: "fx-win",
      run: () => {
        flash("rgba(90, 220, 130, 0.25)");
        play("victory");
      },
    },
    {
      match: /💀 The .* defeated you/,
      cls: "fx-lose",
      run: () => {
        shake(true);
        flash("rgba(160, 0, 0, 0.5)");
        play("defeat");
      },
    },
    {
      match: /CHAPTER \d+ UNLOCKED|REACHED ITS LAST SAVE/,
      cls: "fx-chapter",
      run: () => {
        flash("rgba(190, 150, 255, 0.35)");
        play("chapter");
      },
    },
    {
      match: /A wild .* appeared!/,
      cls: "fx-encounter",
      run: () => {
        shake(false);
        play("encounter");
      },
    },
    { match: /WARNING!/, cls: "fx-warning", run: () => play("warning") },
    {
      match: /^\s*⚠️/, // fourth-wall events glitch the screen
      cls: "fx-glitch",
      run: () => {
        shake(false);
        flash("rgba(0, 255, 200, 0.15)");
        play("glitch");
      },
    },
    { match: /QUEST COMPLETE/, cls: "fx-levelup" },
    { match: /^added \d+ of coin/, cls: "fx-loot", run: () => play("coin") },
    { match: /^added \d+ of |🎉 The monster dropped loot/, cls: "fx-loot" },
    { match: /☠️|🔥 You are burning|🩸/, cls: "fx-status" },
    { match: /🟢 YOUR TURN/, cls: "fx-turn-player" },
    { match: /🔴 THE .* TURN/, cls: "fx-turn-enemy" },
    { match: /^===== Turn \d+ =====$/, cls: "fx-dim" },
    { match: /^[=\-]{10,}$/, cls: "fx-dim" },
  ];

  // ---------- Status bars ----------

  // "You:   [#######-----] 70/100" -> colored bar whose color follows how much HP is left.
  const HP_BAR = /^(.*?)\[(#*)(-*)\] (\d+)\/(\d+)\s*$/;
  // "Energy:   ●●●○○○ 3/6" -> colored dots.
  const ENERGY_BAR = /^(\s*Energy:\s+)(●*)(○*)(.*)$/;

  function span(text, className) {
    const el = document.createElement("span");
    el.textContent = text;
    if (className) el.className = className;
    return el;
  }

  // Builds the content of one printed line, adding colored bars where they apply.
  function buildContent(line) {
    const hp = line.match(HP_BAR);
    if (hp) {
      const ratio = +hp[5] > 0 ? +hp[4] / +hp[5] : 0;
      const level = ratio > 0.5 ? "bar-good" : ratio > 0.25 ? "bar-warn" : "bar-low";
      const wrapper = document.createElement("span");
      wrapper.append(span(hp[1] + "["), span(hp[2], level), span(hp[3], "bar-empty"));
      wrapper.append(span(`] ${hp[4]}/${hp[5]}`));
      return wrapper;
    }
    const energy = line.match(ENERGY_BAR);
    if (energy) {
      const wrapper = document.createElement("span");
      wrapper.append(span(energy[1]), span(energy[2], "bar-energy"), span(energy[3], "bar-empty"));
      wrapper.append(span(energy[4]));
      return wrapper;
    }
    return document.createTextNode(line);
  }

  // ---------- Public API ----------

  let burstCount = 0; // lines already queued in the current synchronous burst
  let burstResetScheduled = false;

  // Turns one line of game text into a DOM element, queuing its effects to fire as it appears.
  function renderLine(line, { plain = false, newline = true } = {}) {
    const el = document.createElement("span");
    el.className = "line";
    el.append(buildContent(line), newline ? "\n" : "");

    const delay = Math.min(burstCount * STAGGER_MS, STAGGER_MAX_MS);
    burstCount++;
    if (!burstResetScheduled) {
      burstResetScheduled = true;
      setTimeout(() => {
        burstCount = 0;
        burstResetScheduled = false;
      }, 0);
    }
    if (!reduceMotion) el.style.animationDelay = `${delay}ms`;

    if (!plain) {
      const rule = RULES.find((r) => r.match.test(line));
      if (rule) {
        el.classList.add(rule.cls);
        if (rule.run) {
          const m = line.match(rule.match);
          setTimeout(() => rule.run(m), reduceMotion ? 0 : delay);
        }
      }
    }
    return el;
  }

  document.getElementById("soundToggle")?.addEventListener("click", () => setSound(!soundOn));
  setSound(soundOn);

  return { renderLine };
})();
