// ================================
// Protocol-3 Phase2
// 戦闘ロジックとUI処理を分離
// ================================

const GAME_CONFIG = {
  maxHp: 100,
  commandCount: 3,
  timings: {
    intro: 800,
    perTurn: 1100,
    betweenLogLines: 110,
  },
};

const SKILLS = {
  SHOT: {
    id: "SHOT",
    name: "SHOT",
    description: "通常攻撃 / 20ダメージ",
    role: "攻撃",
    roleClass: "attack",
    type: "attack",
    power: 20,
  },
  BURST: {
    id: "BURST",
    name: "BURST",
    description: "強攻撃 / 35ダメージ",
    role: "攻撃",
    roleClass: "attack",
    type: "attack",
    power: 35,
  },
  GUARD: {
    id: "GUARD",
    name: "GUARD",
    description: "そのターン被ダメージ半減",
    role: "防御",
    roleClass: "defense",
    type: "defense",
  },
  CHARGE: {
    id: "CHARGE",
    name: "CHARGE",
    description: "次の攻撃を1.5倍",
    role: "補助",
    roleClass: "support",
    type: "support",
  },
  JAM: {
    id: "JAM",
    name: "JAM",
    description: "相手の次攻撃を0.7倍",
    role: "妨害",
    roleClass: "jam",
    type: "support",
    jamMultiplier: 0.7,
  },
  REPAIR: {
    id: "REPAIR",
    name: "REPAIR",
    description: "HPを18回復",
    role: "回復",
    roleClass: "heal",
    type: "heal",
    heal: 18,
  },
  DRONE: {
    id: "DRONE",
    name: "DRONE",
    description: "次ターン終了時に15ダメージ",
    role: "設置",
    roleClass: "setup",
    type: "support",
    delayedDamage: 15,
  },
};

const SKILL_LIST = Object.values(SKILLS);

const MODE_LABEL = {
  cpu: "CPU戦",
  local: "ローカル対戦",
};

const state = {
  mode: null,
  phase: "title",
  inputSide: "p1",
  p1Commands: [],
  p2Commands: [],
  battleResult: null,
  awaitingHandoff: false,
};

const ui = {
  titleScreen: document.getElementById("title-screen"),
  gameScreen: document.getElementById("game-screen"),
  handoffScreen: document.getElementById("handoff-screen"),
  modeBadge: document.getElementById("mode-badge"),
  turnIndicator: document.getElementById("turn-indicator"),
  phaseTitle: document.getElementById("phase-title"),
  phaseSubtitle: document.getElementById("phase-subtitle"),
  selectionStep: document.getElementById("selection-step"),
  confirmationText: document.getElementById("confirmation-text"),

  playerPanel: document.getElementById("player-panel"),
  opponentPanel: document.getElementById("opponent-panel"),
  playerName: document.getElementById("player-name"),
  opponentName: document.getElementById("opponent-name"),
  playerStateTag: document.getElementById("player-state-tag"),
  opponentStateTag: document.getElementById("opponent-state-tag"),

  playerHpText: document.getElementById("player-hp-text"),
  opponentHpText: document.getElementById("opponent-hp-text"),
  playerHpFill: document.getElementById("player-hp-fill"),
  opponentHpFill: document.getElementById("opponent-hp-fill"),

  slotP1Title: document.getElementById("slot-p1-title"),
  slotP2Title: document.getElementById("slot-p2-title"),
  playerSlots: document.getElementById("player-slots"),
  opponentSlots: document.getElementById("opponent-slots"),

  skillButtons: document.getElementById("skill-buttons"),
  battleLog: document.getElementById("battle-log"),

  undoBtn: document.getElementById("undo-btn"),
  switchPlayerBtn: document.getElementById("switch-player-btn"),
  startBattleBtn: document.getElementById("start-battle-btn"),

  resultPanel: document.getElementById("result-panel"),
  resultText: document.getElementById("result-text"),
  resultDetail: document.getElementById("result-detail"),
  resultP1Title: document.getElementById("result-p1-title"),
  resultP2Title: document.getElementById("result-p2-title"),
  resultP1Commands: document.getElementById("result-p1-commands"),
  resultP2Commands: document.getElementById("result-p2-commands"),

  cpuModeBtn: document.getElementById("cpu-mode-btn"),
  localModeBtn: document.getElementById("local-mode-btn"),
  retryBtn: document.getElementById("retry-btn"),
  backTitleBtn: document.getElementById("back-title-btn"),

  handoffTitle: document.getElementById("handoff-title"),
  handoffMessage: document.getElementById("handoff-message"),
  handoffReadyBtn: document.getElementById("handoff-ready-btn"),
};

function init() {
  renderSkillButtons();
  bindEvents();
  renderCommandSlots();
  updateHpDisplay(GAME_CONFIG.maxHp, GAME_CONFIG.maxHp);
}

function bindEvents() {
  ui.cpuModeBtn.addEventListener("click", () => startGame("cpu"));
  ui.localModeBtn.addEventListener("click", () => startGame("local"));
  ui.undoBtn.addEventListener("click", undoLastCommand);
  ui.switchPlayerBtn.addEventListener("click", openHandoffScreen);
  ui.handoffReadyBtn.addEventListener("click", beginPlayer2Input);
  ui.startBattleBtn.addEventListener("click", beginBattleSequence);
  ui.retryBtn.addEventListener("click", retryMatch);
  ui.backTitleBtn.addEventListener("click", returnToTitle);
}

// ================================
// Game Flow
// ================================

function startGame(mode) {
  state.mode = mode;
  state.phase = "input";
  state.inputSide = "p1";
  state.awaitingHandoff = false;
  state.p1Commands = [];
  state.p2Commands = [];
  state.battleResult = null;

  ui.titleScreen.classList.add("hidden");
  ui.gameScreen.classList.remove("hidden");
  ui.handoffScreen.classList.add("hidden");
  ui.resultPanel.classList.add("hidden");
  clearLog();

  setupModeLabels();
  updateHpDisplay(GAME_CONFIG.maxHp, GAME_CONFIG.maxHp);
  updateInputPhaseUI();
  renderCommandSlots();
}

function setupModeLabels() {
  ui.modeBadge.textContent = `MODE: ${MODE_LABEL[state.mode]}`;
  if (state.mode === "cpu") {
    ui.playerName.textContent = "PLAYER";
    ui.opponentName.textContent = "CPU UNIT";
    ui.slotP1Title.textContent = "PLAYER COMMANDS";
    ui.slotP2Title.textContent = "CPU COMMANDS";
    ui.resultP1Title.textContent = "PLAYER COMMANDS";
    ui.resultP2Title.textContent = "CPU COMMANDS";
    ui.playerStateTag.textContent = "ONLINE";
    ui.opponentStateTag.textContent = "AI CORE";
  } else {
    ui.playerName.textContent = "PLAYER 1";
    ui.opponentName.textContent = "PLAYER 2";
    ui.slotP1Title.textContent = "PLAYER 1 COMMANDS";
    ui.slotP2Title.textContent = "PLAYER 2 COMMANDS";
    ui.resultP1Title.textContent = "PLAYER 1 COMMANDS";
    ui.resultP2Title.textContent = "PLAYER 2 COMMANDS";
    ui.playerStateTag.textContent = "OPERATOR 1";
    ui.opponentStateTag.textContent = "OPERATOR 2";
  }
}

function selectCommand(skillId) {
  if (state.phase !== "input" || state.awaitingHandoff) {
    return;
  }

  const commands = getActiveCommandArray();
  if (commands.length >= GAME_CONFIG.commandCount) {
    return;
  }

  commands.push(skillId);

  if (state.mode === "cpu" && state.p1Commands.length === GAME_CONFIG.commandCount) {
    state.p2Commands = generateCpuCommands(state.p1Commands);
  }

  renderCommandSlots();
  updateInputPhaseUI();
}

function undoLastCommand() {
  if (state.phase !== "input" || state.awaitingHandoff) {
    return;
  }

  const commands = getActiveCommandArray();
  if (commands.length === 0) {
    return;
  }

  commands.pop();

  if (state.mode === "cpu") {
    state.p2Commands = [];
  }

  renderCommandSlots();
  updateInputPhaseUI();
}

function openHandoffScreen() {
  if (state.mode !== "local" || state.p1Commands.length < GAME_CONFIG.commandCount) {
    return;
  }

  state.awaitingHandoff = true;
  ui.handoffTitle.textContent = "端末をプレイヤー2へ渡してください";
  ui.handoffMessage.textContent = "相手に見せないでください。準備ができたら続行します。";
  ui.handoffScreen.classList.remove("hidden");
  updateInputPhaseUI();
  renderCommandSlots();
}

function beginPlayer2Input() {
  state.awaitingHandoff = false;
  state.inputSide = "p2";
  ui.handoffScreen.classList.add("hidden");
  updateInputPhaseUI();
  renderCommandSlots();
}

async function beginBattleSequence() {
  if (!canStartBattle()) {
    return;
  }

  state.phase = "battle";
  updateInputPhaseUI();
  ui.resultPanel.classList.add("hidden");
  clearLog();

  const p1Label = state.mode === "cpu" ? "PLAYER" : "PLAYER 1";
  const p2Label = state.mode === "cpu" ? "CPU" : "PLAYER 2";

  const result = simulateBattle(state.p1Commands, state.p2Commands, {
    p1Name: p1Label,
    p2Name: p2Label,
  });
  state.battleResult = result;

  await playBattlePresentation(result);
  showResult(result);
}

function retryMatch() {
  if (!state.mode) {
    return;
  }
  startGame(state.mode);
}

function returnToTitle() {
  state.mode = null;
  state.phase = "title";
  state.awaitingHandoff = false;

  ui.titleScreen.classList.remove("hidden");
  ui.gameScreen.classList.add("hidden");
  ui.handoffScreen.classList.add("hidden");
}

function getActiveCommandArray() {
  return state.inputSide === "p1" ? state.p1Commands : state.p2Commands;
}

function canStartBattle() {
  if (state.mode === "cpu") {
    return state.p1Commands.length === GAME_CONFIG.commandCount;
  }

  return (
    state.p1Commands.length === GAME_CONFIG.commandCount &&
    state.p2Commands.length === GAME_CONFIG.commandCount
  );
}

// ================================
// Battle Simulation (Pure Logic)
// ================================

function simulateBattle(player1Commands, player2Commands, meta = { p1Name: "P1", p2Name: "P2" }) {
  const battleState = {
    p1: createUnitState(),
    p2: createUnitState(),
  };

  const turns = [];

  for (let index = 0; index < GAME_CONFIG.commandCount; index += 1) {
    const action1 = player1Commands[index];
    const action2 = player2Commands[index];

    const turnEvents = [];

    // 1. そのターンの行動を取得
    turnEvents.push(createEvent("highlight", `${meta.p1Name}: ${action1} / ${meta.p2Name}: ${action2}`));

    // 2. CHARGE / JAM / GUARD / DRONE設置
    const p1Guarding = action1 === "GUARD";
    const p2Guarding = action2 === "GUARD";

    let p1ScheduleDrone = false;
    let p2ScheduleDrone = false;

    if (action1 === "CHARGE") {
      battleState.p1.chargeReady = true;
      turnEvents.push(createEvent("highlight", `${meta.p1Name} がCHARGE。次の攻撃が強化される。`));
    }
    if (action2 === "CHARGE") {
      battleState.p2.chargeReady = true;
      turnEvents.push(createEvent("highlight", `${meta.p2Name} がCHARGE。次の攻撃が強化される。`));
    }

    const p1AppliesJam = action1 === "JAM";
    const p2AppliesJam = action2 === "JAM";

    if (p1AppliesJam) {
      turnEvents.push(createEvent("highlight", `${meta.p1Name} がJAM。${meta.p2Name} の次攻撃を弱体化。`));
    }
    if (p2AppliesJam) {
      turnEvents.push(createEvent("highlight", `${meta.p2Name} がJAM。${meta.p1Name} の次攻撃を弱体化。`));
    }

    if (action1 === "DRONE") {
      p1ScheduleDrone = true;
      turnEvents.push(createEvent("highlight", `${meta.p1Name} がDRONEを設置。次ターン終了時に起動。`));
    }
    if (action2 === "DRONE") {
      p2ScheduleDrone = true;
      turnEvents.push(createEvent("highlight", `${meta.p2Name} がDRONEを設置。次ターン終了時に起動。`));
    }

    // 3. 攻撃ダメージ計算
    const damageToP2 = calculateAttackDamage(action1, battleState.p1, p2Guarding);
    const damageToP1 = calculateAttackDamage(action2, battleState.p2, p1Guarding);

    if (damageToP2 > 0) {
      turnEvents.push(createEvent("impact", `${meta.p1Name} の攻撃: ${meta.p2Name} に ${damageToP2} ダメージ`));
    }
    if (damageToP1 > 0) {
      turnEvents.push(createEvent("impact", `${meta.p2Name} の攻撃: ${meta.p1Name} に ${damageToP1} ダメージ`));
    }

    if (p1Guarding) {
      turnEvents.push(createEvent("highlight", `${meta.p1Name} はGUARD態勢。被ダメージ軽減。`));
    }
    if (p2Guarding) {
      turnEvents.push(createEvent("highlight", `${meta.p2Name} はGUARD態勢。被ダメージ軽減。`));
    }

    // このターン終了後から適用されるJAM
    if (p1AppliesJam) {
      battleState.p2.jamMultiplier *= SKILLS.JAM.jamMultiplier;
    }
    if (p2AppliesJam) {
      battleState.p1.jamMultiplier *= SKILLS.JAM.jamMultiplier;
    }

    // 4. REPAIR
    const healP1 = action1 === "REPAIR" ? SKILLS.REPAIR.heal : 0;
    const healP2 = action2 === "REPAIR" ? SKILLS.REPAIR.heal : 0;

    if (healP1 > 0) {
      turnEvents.push(createEvent("heal", `${meta.p1Name} がREPAIRで ${healP1} 回復`));
    }
    if (healP2 > 0) {
      turnEvents.push(createEvent("heal", `${meta.p2Name} がREPAIRで ${healP2} 回復`));
    }

    // 5. DRONE遅延ダメージ
    const droneToP2 = battleState.p1.droneReady ? SKILLS.DRONE.delayedDamage : 0;
    const droneToP1 = battleState.p2.droneReady ? SKILLS.DRONE.delayedDamage : 0;

    if (droneToP2 > 0) {
      turnEvents.push(createEvent("impact", `${meta.p1Name} のDRONE起動: ${meta.p2Name} に ${droneToP2} ダメージ`));
    }
    if (droneToP1 > 0) {
      turnEvents.push(createEvent("impact", `${meta.p2Name} のDRONE起動: ${meta.p1Name} に ${droneToP1} ダメージ`));
    }

    // 6. HP更新
    battleState.p1.hp = clampHp(battleState.p1.hp - damageToP1 - droneToP1 + healP1);
    battleState.p2.hp = clampHp(battleState.p2.hp - damageToP2 - droneToP2 + healP2);

    // DRONE予約更新
    battleState.p1.droneReady = p1ScheduleDrone;
    battleState.p2.droneReady = p2ScheduleDrone;

    // 7. ターン詳細
    turns.push({
      turn: index + 1,
      actions: { p1: action1, p2: action2 },
      hp: { p1: battleState.p1.hp, p2: battleState.p2.hp },
      flags: {
        p1Guarding,
        p2Guarding,
        p1Healed: healP1 > 0,
        p2Healed: healP2 > 0,
        p1DroneTriggered: droneToP2 > 0,
        p2DroneTriggered: droneToP1 > 0,
        p1Damaged: damageToP1 + droneToP1 > 0,
        p2Damaged: damageToP2 + droneToP2 > 0,
      },
      events: turnEvents,
    });
  }

  const winner = decideWinner(battleState.p1.hp, battleState.p2.hp, meta);

  return {
    meta,
    turns,
    finalHp: {
      p1: battleState.p1.hp,
      p2: battleState.p2.hp,
    },
    winner,
    commands: {
      p1: [...player1Commands],
      p2: [...player2Commands],
    },
  };
}

function createUnitState() {
  return {
    hp: GAME_CONFIG.maxHp,
    chargeReady: false,
    jamMultiplier: 1,
    droneReady: false,
  };
}

function calculateAttackDamage(actionId, attackerState, targetGuarding) {
  if (actionId !== "SHOT" && actionId !== "BURST") {
    return 0;
  }

  let damage = SKILLS[actionId].power;

  if (attackerState.chargeReady) {
    damage *= 1.5;
    attackerState.chargeReady = false;
  }

  if (attackerState.jamMultiplier !== 1) {
    damage *= attackerState.jamMultiplier;
    attackerState.jamMultiplier = 1;
  }

  if (targetGuarding) {
    damage *= 0.5;
  }

  return Math.max(0, Math.round(damage));
}

function decideWinner(p1Hp, p2Hp, meta) {
  if (p1Hp > p2Hp) {
    return { key: "p1", label: `${meta.p1Name} WIN` };
  }
  if (p2Hp > p1Hp) {
    return { key: "p2", label: `${meta.p2Name} WIN` };
  }
  return { key: "draw", label: "DRAW" };
}

function createEvent(type, message) {
  return { type, message };
}

function clampHp(value) {
  return Math.max(0, Math.min(GAME_CONFIG.maxHp, value));
}

// ================================
// CPU Logic
// ================================

function generateCpuCommands(playerCommands) {
  const commands = [];
  let estimatedHp = GAME_CONFIG.maxHp;

  while (commands.length < GAME_CONFIG.commandCount) {
    const turn = commands.length;

    if (turn <= 1 && Math.random() < 0.32 && !isTripleRisk(commands, "CHARGE")) {
      commands.push("CHARGE");
      if (commands.length < GAME_CONFIG.commandCount && !isTripleRisk(commands, "BURST")) {
        commands.push("BURST");
      }
      continue;
    }

    if (estimatedHp <= 58 && Math.random() < 0.52 && !isTripleRisk(commands, "REPAIR")) {
      commands.push("REPAIR");
      estimatedHp = Math.min(GAME_CONFIG.maxHp, estimatedHp + SKILLS.REPAIR.heal);
      continue;
    }

    const playerHint = playerCommands[turn] || "SHOT";
    const weightedPool = buildCpuPool(playerHint);
    const choice = pickWithRetry(weightedPool, commands);
    commands.push(choice);

    estimatedHp -= Math.floor(Math.random() * 10) + 7;
  }

  return commands.slice(0, GAME_CONFIG.commandCount);
}

function buildCpuPool(playerHint) {
  if (playerHint === "BURST") {
    return ["GUARD", "JAM", "SHOT", "BURST", "REPAIR", "DRONE", "GUARD"];
  }
  if (playerHint === "CHARGE") {
    return ["JAM", "BURST", "SHOT", "GUARD", "DRONE", "SHOT"];
  }
  return ["SHOT", "SHOT", "BURST", "GUARD", "JAM", "DRONE", "REPAIR"];
}

function pickWithRetry(pool, existing) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const picked = pool[Math.floor(Math.random() * pool.length)];
    if (!isTripleRisk(existing, picked)) {
      return picked;
    }
  }
  return "SHOT";
}

function isTripleRisk(existing, nextSkill) {
  if (existing.length < 2) {
    return false;
  }
  return existing[existing.length - 1] === nextSkill && existing[existing.length - 2] === nextSkill;
}

// ================================
// UI Rendering
// ================================

function renderSkillButtons() {
  ui.skillButtons.innerHTML = "";

  SKILL_LIST.forEach((skill) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `skill-btn skill-role-${skill.roleClass}`;
    button.dataset.skillId = skill.id;
    button.innerHTML = `
      <span class="name">${skill.name}</span>
      <span class="desc">${skill.description}</span>
      <span class="role">${skill.role}</span>
    `;
    button.addEventListener("click", () => selectCommand(skill.id));
    ui.skillButtons.appendChild(button);
  });
}

function updateInputPhaseUI() {
  const isInput = state.phase === "input";
  const activeCommands = getActiveCommandArray();
  const isActiveComplete = activeCommands.length === GAME_CONFIG.commandCount;

  ui.undoBtn.disabled = !isInput || state.awaitingHandoff || activeCommands.length === 0;
  ui.startBattleBtn.disabled = !canStartBattle() || !isInput;

  if (state.mode === "local" && state.inputSide === "p1" && isActiveComplete && !state.awaitingHandoff) {
    ui.switchPlayerBtn.classList.remove("hidden");
  } else {
    ui.switchPlayerBtn.classList.add("hidden");
  }

  const showLocked = isInput && state.mode === "local" && (state.inputSide === "p2" || state.awaitingHandoff);
  renderCommandSlots(showLocked);

  toggleSkillButtons(isInput && !isActiveComplete && !state.awaitingHandoff);

  if (state.phase === "input") {
    ui.turnIndicator.textContent = "入力フェーズ";
    ui.confirmationText.classList.add("hidden");
    ui.confirmationText.classList.remove("confirm-pulse");

    if (state.mode === "cpu") {
      const nextStep = state.p1Commands.length + 1;
      ui.phaseTitle.textContent = "コマンド入力";
      ui.phaseSubtitle.textContent = "3手の命令を確定し、CPUとの同時実行に備えてください。";
      ui.selectionStep.textContent = isActiveComplete ? "入力完了" : `選択中: ${nextStep}手目`;
      if (isActiveComplete) {
        ui.confirmationText.classList.remove("hidden");
        ui.confirmationText.classList.add("confirm-pulse");
      }
      return;
    }

    if (state.awaitingHandoff) {
      ui.phaseTitle.textContent = "プレイヤー交代待機";
      ui.phaseSubtitle.textContent = "端末の受け渡し後、プレイヤー2の入力を開始します。";
      ui.selectionStep.textContent = "選択中: 交代待機";
      return;
    }

    if (state.inputSide === "p1") {
      const step = state.p1Commands.length + 1;
      ui.phaseTitle.textContent = "PLAYER 1 入力";
      ui.phaseSubtitle.textContent = "プレイヤー1が3手を入力してください。";
      ui.selectionStep.textContent = isActiveComplete ? "入力完了" : `選択中: ${step}手目`;
      if (isActiveComplete) {
        ui.confirmationText.classList.remove("hidden");
        ui.confirmationText.classList.add("confirm-pulse");
      }
      return;
    }

    const step = state.p2Commands.length + 1;
    ui.phaseTitle.textContent = "PLAYER 2 入力";
    ui.phaseSubtitle.textContent = "相手に見せないでください。プレイヤー2が3手を入力します。";
    ui.selectionStep.textContent = isActiveComplete ? "入力完了" : `選択中: ${step}手目`;
    if (isActiveComplete) {
      ui.confirmationText.classList.remove("hidden");
      ui.confirmationText.classList.add("confirm-pulse");
    }
    return;
  }

  if (state.phase === "battle") {
    ui.phaseTitle.textContent = "戦闘実行中";
    ui.phaseSubtitle.textContent = "COMMAND EXECUTION";
    ui.selectionStep.textContent = "選択中: -";
    ui.turnIndicator.textContent = "戦闘フェーズ";
    ui.confirmationText.classList.add("hidden");
  }
}

function renderCommandSlots(hideP1 = false) {
  renderSlotsForSide(ui.playerSlots, state.p1Commands, hideP1);
  renderSlotsForSide(ui.opponentSlots, state.p2Commands, false);
}

function renderSlotsForSide(container, commands, hideValues) {
  container.innerHTML = "";

  for (let i = 0; i < GAME_CONFIG.commandCount; i += 1) {
    const slot = document.createElement("div");
    slot.className = "slot";

    const label = document.createElement("span");
    label.className = "slot-index";
    label.textContent = `${i + 1}手目`;
    slot.appendChild(label);

    const value = document.createElement("strong");
    const skill = commands[i];

    if (!skill) {
      value.textContent = "EMPTY";
    } else if (hideValues) {
      value.textContent = "LOCKED";
      slot.classList.add("locked", "filled");
    } else {
      value.textContent = skill;
      slot.classList.add("filled");
    }

    slot.appendChild(value);
    container.appendChild(slot);
  }
}

function toggleSkillButtons(enabled) {
  ui.skillButtons.querySelectorAll("button").forEach((button) => {
    button.disabled = !enabled;
  });
}

function updateHpDisplay(p1Hp, p2Hp) {
  ui.playerHpText.textContent = p1Hp;
  ui.opponentHpText.textContent = p2Hp;
  ui.playerHpFill.style.width = `${p1Hp}%`;
  ui.opponentHpFill.style.width = `${p2Hp}%`;
}

function clearLog() {
  ui.battleLog.innerHTML = "";
}

function appendLog(message, style = "normal") {
  const line = document.createElement("div");
  line.className = "log-row";

  if (style === "turn") {
    line.classList.add("log-turn");
  }
  if (style === "highlight") {
    line.classList.add("log-highlight");
  }
  if (style === "impact") {
    line.classList.add("log-impact");
  }
  if (style === "heal") {
    line.classList.add("log-heal");
  }

  line.textContent = message;
  ui.battleLog.appendChild(line);
  ui.battleLog.scrollTop = ui.battleLog.scrollHeight;
}

function appendLogDivider() {
  const divider = document.createElement("div");
  divider.className = "log-divider";
  ui.battleLog.appendChild(divider);
}

// ================================
// Battle Presentation
// ================================

async function playBattlePresentation(result) {
  appendLog("SIMULATION START", "highlight");
  appendLog("COMMAND EXECUTION", "highlight");
  await sleep(GAME_CONFIG.timings.intro);

  for (const turn of result.turns) {
    ui.turnIndicator.textContent = `TURN ${turn.turn} / ${GAME_CONFIG.commandCount}`;
    appendLogDivider();
    appendLog(`TURN ${turn.turn}`, "turn");

    for (const event of turn.events) {
      appendLog(event.message, event.type);
      await sleep(GAME_CONFIG.timings.betweenLogLines);
    }

    applyTurnEffects(turn);
    updateHpDisplay(turn.hp.p1, turn.hp.p2);
    appendLog(
      `HP => ${result.meta.p1Name}: ${turn.hp.p1} / ${result.meta.p2Name}: ${turn.hp.p2}`,
      "highlight"
    );

    await sleep(GAME_CONFIG.timings.perTurn);
  }
}

function applyTurnEffects(turn) {
  if (turn.flags.p1Guarding) {
    flashPanel(ui.playerPanel, "guard-flash");
  }
  if (turn.flags.p2Guarding) {
    flashPanel(ui.opponentPanel, "guard-flash");
  }

  if (turn.flags.p1Healed) {
    flashPanel(ui.playerPanel, "heal-flash");
  }
  if (turn.flags.p2Healed) {
    flashPanel(ui.opponentPanel, "heal-flash");
  }

  if (turn.flags.p1Damaged) {
    flashPanel(ui.playerPanel, "hit-flash");
  }
  if (turn.flags.p2Damaged) {
    flashPanel(ui.opponentPanel, "hit-flash");
  }

  if (turn.flags.p1DroneTriggered) {
    flashPanel(ui.playerPanel, "drone-flash");
  }
  if (turn.flags.p2DroneTriggered) {
    flashPanel(ui.opponentPanel, "drone-flash");
  }
}

function flashPanel(panel, className) {
  panel.classList.remove(className);
  panel.offsetWidth;
  panel.classList.add(className);
  setTimeout(() => panel.classList.remove(className), 460);
}

function showResult(result) {
  state.phase = "result";
  ui.turnIndicator.textContent = "戦闘終了";

  let title = "DRAW";
  if (result.winner.key === "p1") {
    title = state.mode === "cpu" ? "あなたの勝利" : "PLAYER 1 勝利";
  } else if (result.winner.key === "p2") {
    title = state.mode === "cpu" ? "CPUの勝利" : "PLAYER 2 勝利";
  } else {
    title = "引き分け";
  }

  ui.phaseTitle.textContent = "戦闘終了";
  ui.phaseSubtitle.textContent = "結果を確認してください。";
  ui.resultText.textContent = title;
  ui.resultDetail.textContent = `最終HP - ${result.meta.p1Name}: ${result.finalHp.p1} / ${result.meta.p2Name}: ${result.finalHp.p2}`;
  ui.resultP1Commands.textContent = result.commands.p1.join(" -> ");
  ui.resultP2Commands.textContent = result.commands.p2.join(" -> ");
  ui.resultPanel.classList.remove("hidden");

  appendLogDivider();
  appendLog(`RESULT: ${title}`, "highlight");

  toggleSkillButtons(false);
  ui.undoBtn.disabled = true;
  ui.switchPlayerBtn.classList.add("hidden");
  ui.startBattleBtn.disabled = true;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

init();
