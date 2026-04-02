
// ========================================
// Protocol-3 Phase4 Client
// ========================================

const GAME_CONFIG = {
  maxHp: 100,
  commandCount: 3,
  timings: {
    intro: 700,
    turnDelay: 880,
    lineDelay: 90,
  },
};

const MODE = {
  CPU: "cpu",
  LOCAL: "local",
  ONLINE: "online",
};

const PHASE = {
  TITLE: "title",
  INPUT: "input",
  ONLINE_LOBBY: "online_lobby",
  ONLINE_WAITING: "online_waiting",
  BATTLE: "battle",
  RESULT: "result",
};

const MODE_LABEL = {
  [MODE.CPU]: "CPU戦",
  [MODE.LOCAL]: "ローカル対戦",
  [MODE.ONLINE]: "オンライン対戦",
};

const MESSAGE_TYPES = {
  CREATE_ROOM: "create_room",
  JOIN_ROOM: "join_room",
  SUBMIT_COMMANDS: "submit_commands",
  RESTART_REQUEST: "restart_request",
  LEAVE_ROOM: "leave_room",

  ROOM_CREATED: "room_created",
  ROOM_JOINED: "room_joined",
  PLAYER_JOINED: "player_joined",
  READY_TO_BATTLE: "ready_to_battle",
  OPPONENT_SUBMITTED: "opponent_submitted",
  OPPONENT_RESTART_REQUESTED: "opponent_restart_requested",
  BATTLE_RESULT: "battle_result",
  ERROR: "error",
  OPPONENT_LEFT: "opponent_left",
  RESTART_WAITING: "restart_waiting",
};

const NETWORK_CONFIG = {
  wsEndpoint: window.__WS_ENDPOINT || null,
};

const SKILLS = {
  SHOT: {
    id: "SHOT",
    name: "SHOT",
    description: "通常攻撃 / 20ダメージ",
    role: "攻撃",
    roleClass: "attack",
    power: 20,
  },
  BURST: {
    id: "BURST",
    name: "BURST",
    description: "強攻撃 / 35ダメージ",
    role: "攻撃",
    roleClass: "attack",
    power: 35,
  },
  GUARD: {
    id: "GUARD",
    name: "GUARD",
    description: "そのターン被ダメージ半減",
    role: "防御",
    roleClass: "defense",
  },
  CHARGE: {
    id: "CHARGE",
    name: "CHARGE",
    description: "次の攻撃を1.5倍",
    role: "補助",
    roleClass: "support",
  },
  JAM: {
    id: "JAM",
    name: "JAM",
    description: "相手の次攻撃を0.7倍",
    role: "妨害",
    roleClass: "jam",
    jamMultiplier: 0.7,
  },
  REPAIR: {
    id: "REPAIR",
    name: "REPAIR",
    description: "HPを18回復",
    role: "回復",
    roleClass: "heal",
    heal: 18,
  },
  DRONE: {
    id: "DRONE",
    name: "DRONE",
    description: "次ターン終了時に15ダメージ",
    role: "設置",
    roleClass: "setup",
    delayedDamage: 15,
  },
};

const SKILL_LIST = Object.values(SKILLS);

const state = {
  mode: null,
  phase: PHASE.TITLE,
  inputSide: "p1",
  awaitingHandoff: false,
  p1Commands: [],
  p2Commands: [],
  locks: {
    p1: false,
    p2: false,
  },
  online: {
    socket: null,
    connected: false,
    playerId: null,
    playerName: "",
    opponentName: "",
    roomId: "",
    mySubmitted: false,
    opponentSubmitted: false,
    commandLocked: false,
    restartRequested: false,
    opponentRestartRequested: false,
    isConnecting: false,
  },
  battleAnimationRunning: false,
};

const ui = {
  titleScreen: document.getElementById("title-screen"),
  gameScreen: document.getElementById("game-screen"),
  handoffScreen: document.getElementById("handoff-screen"),
  howToScreen: document.getElementById("how-to-screen"),

  howToOpenBtn: document.getElementById("how-to-open-btn"),
  howToCloseBtn: document.getElementById("how-to-close-btn"),

  modeBadge: document.getElementById("mode-badge"),
  turnIndicator: document.getElementById("turn-indicator"),
  statusBanner: document.getElementById("status-banner"),

  phaseTitle: document.getElementById("phase-title"),
  phaseSubtitle: document.getElementById("phase-subtitle"),
  selectionStep: document.getElementById("selection-step"),
  selectedSequence: document.getElementById("selected-sequence"),
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

  offlineFlowButtons: document.getElementById("offline-flow-buttons"),
  onlineFlowButtons: document.getElementById("online-flow-buttons"),

  undoBtn: document.getElementById("undo-btn"),
  clearBtn: document.getElementById("clear-btn"),
  lockBtn: document.getElementById("lock-btn"),
  switchPlayerBtn: document.getElementById("switch-player-btn"),
  startBattleBtn: document.getElementById("start-battle-btn"),

  onlineUndoBtn: document.getElementById("online-undo-btn"),
  onlineClearBtn: document.getElementById("online-clear-btn"),
  onlineLockBtn: document.getElementById("online-lock-btn"),
  submitOnlineBtn: document.getElementById("submit-online-btn"),
  onlineRestartBtn: document.getElementById("online-restart-btn"),

  resultPanel: document.getElementById("result-panel"),
  resultCard: document.getElementById("result-card"),
  resultText: document.getElementById("result-text"),
  resultDetail: document.getElementById("result-detail"),
  resultExtraStatus: document.getElementById("result-extra-status"),
  resultP1Title: document.getElementById("result-p1-title"),
  resultP2Title: document.getElementById("result-p2-title"),
  resultP1Commands: document.getElementById("result-p1-commands"),
  resultP2Commands: document.getElementById("result-p2-commands"),

  cpuModeBtn: document.getElementById("cpu-mode-btn"),
  localModeBtn: document.getElementById("local-mode-btn"),
  onlineModeBtn: document.getElementById("online-mode-btn"),
  retryBtn: document.getElementById("retry-btn"),
  backTitleBtn: document.getElementById("back-title-btn"),
  handoffReadyBtn: document.getElementById("handoff-ready-btn"),

  onlinePanel: document.getElementById("online-room-panel"),
  onlineNameInput: document.getElementById("online-name-input"),
  onlineRoomInput: document.getElementById("online-room-input"),
  createRoomBtn: document.getElementById("create-room-btn"),
  joinRoomBtn: document.getElementById("join-room-btn"),
  leaveRoomBtn: document.getElementById("leave-room-btn"),
  copyRoomBtn: document.getElementById("copy-room-btn"),
  connectionStatus: document.getElementById("connection-status"),
  opponentStateText: document.getElementById("opponent-state-text"),
  roomIdText: document.getElementById("room-id-text"),
  onlineSelfName: document.getElementById("online-self-name"),
  onlineOpponentName: document.getElementById("online-opponent-name"),
  onlineMessage: document.getElementById("online-message"),

  toast: document.getElementById("toast"),
};

let toastTimer = null;
const socketReadyCallbacks = [];

function init() {
  renderSkillButtons();
  bindEvents();
  renderCommandSlots();
  updateHpDisplay(GAME_CONFIG.maxHp, GAME_CONFIG.maxHp);
  updateOnlineRoomActionButtons();
}

function bindEvents() {
  ui.cpuModeBtn.addEventListener("click", () => startMode(MODE.CPU));
  ui.localModeBtn.addEventListener("click", () => startMode(MODE.LOCAL));
  ui.onlineModeBtn.addEventListener("click", () => startMode(MODE.ONLINE));

  ui.howToOpenBtn.addEventListener("click", () => ui.howToScreen.classList.remove("hidden"));
  ui.howToCloseBtn.addEventListener("click", () => ui.howToScreen.classList.add("hidden"));

  ui.undoBtn.addEventListener("click", undoOfflineCommand);
  ui.clearBtn.addEventListener("click", clearOfflineCommands);
  ui.lockBtn.addEventListener("click", lockOfflineCommands);
  ui.switchPlayerBtn.addEventListener("click", openHandoffScreen);
  ui.startBattleBtn.addEventListener("click", startOfflineBattle);

  ui.onlineUndoBtn.addEventListener("click", undoOnlineCommand);
  ui.onlineClearBtn.addEventListener("click", clearOnlineCommands);
  ui.onlineLockBtn.addEventListener("click", lockOnlineCommands);
  ui.submitOnlineBtn.addEventListener("click", submitOnlineCommands);
  ui.onlineRestartBtn.addEventListener("click", requestOnlineRestart);

  ui.createRoomBtn.addEventListener("click", onCreateRoom);
  ui.joinRoomBtn.addEventListener("click", onJoinRoom);
  ui.leaveRoomBtn.addEventListener("click", leaveOnlineRoom);
  ui.copyRoomBtn.addEventListener("click", copyRoomId);

  ui.retryBtn.addEventListener("click", onResultPrimaryAction);
  ui.backTitleBtn.addEventListener("click", returnToTitle);
  ui.handoffReadyBtn.addEventListener("click", beginPlayer2Input);
}

function startMode(mode) {
  resetForNewMatch();
  state.mode = mode;
  setPhase(PHASE.INPUT);
  ui.titleScreen.classList.add("hidden");
  ui.gameScreen.classList.remove("hidden");
  hideResultOverlay();
  ui.handoffScreen.classList.add("hidden");
  ui.howToScreen.classList.add("hidden");
  clearLog();

  ui.modeBadge.textContent = `MODE: ${MODE_LABEL[mode]}`;

  if (mode === MODE.ONLINE) {
    setupOnlineMode();
  } else {
    setupOfflineMode(mode);
  }
}

function resetForNewMatch() {
  setPhase(PHASE.INPUT);
  state.inputSide = "p1";
  state.awaitingHandoff = false;
  state.p1Commands = [];
  state.p2Commands = [];
  state.locks.p1 = false;
  state.locks.p2 = false;
  state.battleAnimationRunning = false;
}

function setPhase(nextPhase) {
  state.phase = nextPhase;
}

function setupOfflineMode(mode) {
  ui.onlinePanel.classList.add("hidden");
  ui.offlineFlowButtons.classList.remove("hidden");
  ui.onlineFlowButtons.classList.add("hidden");
  ui.retryBtn.disabled = false;

  if (mode === MODE.CPU) {
    setPlayerLabels("PLAYER", "CPU UNIT", "ONLINE", "AI CORE");
    ui.slotP1Title.textContent = "PLAYER COMMANDS";
    ui.slotP2Title.textContent = "CPU COMMANDS";
    ui.resultP1Title.textContent = "PLAYER COMMANDS";
    ui.resultP2Title.textContent = "CPU COMMANDS";
  } else {
    setPlayerLabels("PLAYER 1", "PLAYER 2", "OPERATOR 1", "OPERATOR 2");
    ui.slotP1Title.textContent = "PLAYER 1 COMMANDS";
    ui.slotP2Title.textContent = "PLAYER 2 COMMANDS";
    ui.resultP1Title.textContent = "PLAYER 1 COMMANDS";
    ui.resultP2Title.textContent = "PLAYER 2 COMMANDS";
  }

  updateHpDisplay(GAME_CONFIG.maxHp, GAME_CONFIG.maxHp);
  setStatusBanner("命令を入力してください。", "info");
  updateOfflineInputUI();
}

function setupOnlineMode() {
  setPhase(PHASE.ONLINE_LOBBY);
  state.online.commandLocked = false;
  state.online.mySubmitted = false;
  state.online.opponentSubmitted = false;
  state.online.restartRequested = false;
  state.online.opponentRestartRequested = false;
  hideResultOverlay();

  ui.onlinePanel.classList.remove("hidden");
  ui.offlineFlowButtons.classList.add("hidden");
  ui.onlineFlowButtons.classList.remove("hidden");
  ui.retryBtn.disabled = true;

  setPlayerLabels("YOU", "OPPONENT", "NET READY", "UNKNOWN");
  ui.slotP1Title.textContent = "YOUR COMMANDS";
  ui.slotP2Title.textContent = "OPPONENT COMMANDS";
  ui.resultP1Title.textContent = "YOUR COMMANDS";
  ui.resultP2Title.textContent = "OPPONENT COMMANDS";

  updateHpDisplay(GAME_CONFIG.maxHp, GAME_CONFIG.maxHp);
  setOnlineMessage("名前を入力してルーム作成または参加を選んでください。");
  setStatusBanner("オンライン対戦の準備中です。", "info");
  updateConnectionStatus();
  updateOnlineStatusPanel();
  updateOnlineInputUI();
  updateOnlineRoomActionButtons();
}

function setPlayerLabels(p1, p2, p1Tag, p2Tag) {
  ui.playerName.textContent = p1;
  ui.opponentName.textContent = p2;
  ui.playerStateTag.textContent = p1Tag;
  ui.opponentStateTag.textContent = p2Tag;
}

function getCurrentOfflineCommands() {
  return state.inputSide === "p1" ? state.p1Commands : state.p2Commands;
}

function isCurrentOfflineLocked() {
  return state.inputSide === "p1" ? state.locks.p1 : state.locks.p2;
}

function setCurrentOfflineLocked(locked) {
  if (state.inputSide === "p1") state.locks.p1 = locked;
  else state.locks.p2 = locked;
}
function selectSkill(skillId) {
  if (state.mode === MODE.ONLINE) {
    if (state.phase !== PHASE.INPUT || state.online.commandLocked || state.online.mySubmitted) return;
    if (state.p1Commands.length >= GAME_CONFIG.commandCount) return;
    state.p1Commands.push(skillId);
    updateOnlineInputUI();
    return;
  }

  if (state.phase !== PHASE.INPUT || state.awaitingHandoff || isCurrentOfflineLocked()) return;
  const list = getCurrentOfflineCommands();
  if (list.length >= GAME_CONFIG.commandCount) return;
  list.push(skillId);
  updateOfflineInputUI();
}

function undoOfflineCommand() {
  if (state.mode === MODE.ONLINE || state.phase !== PHASE.INPUT || state.awaitingHandoff || isCurrentOfflineLocked()) return;
  const list = getCurrentOfflineCommands();
  if (list.length === 0) return;
  list.pop();
  updateOfflineInputUI();
}

function clearOfflineCommands() {
  if (state.mode === MODE.ONLINE || state.phase !== PHASE.INPUT || state.awaitingHandoff || isCurrentOfflineLocked()) return;
  const list = getCurrentOfflineCommands();
  list.length = 0;
  updateOfflineInputUI();
}

function lockOfflineCommands() {
  if (state.mode === MODE.ONLINE || state.phase !== PHASE.INPUT || state.awaitingHandoff || isCurrentOfflineLocked()) return;
  const list = getCurrentOfflineCommands();
  if (list.length !== GAME_CONFIG.commandCount) {
    showToast("3手すべて選択してください", "error");
    return;
  }

  setCurrentOfflineLocked(true);

  if (state.mode === MODE.CPU && state.inputSide === "p1") {
    state.p2Commands = generateCpuCommands(state.p1Commands);
    state.locks.p2 = true;
    setStatusBanner("命令確定。戦闘開始できます。", "ok");
  }

  if (state.mode === MODE.LOCAL && state.inputSide === "p1") {
    setStatusBanner("PLAYER 1の命令確定。プレイヤー交代へ進んでください。", "ok");
  }

  if (state.mode === MODE.LOCAL && state.inputSide === "p2") {
    setStatusBanner("双方の命令が確定しました。戦闘開始できます。", "ok");
  }

  updateOfflineInputUI();
}

function canStartOfflineBattle() {
  if (state.mode === MODE.CPU) return state.locks.p1;
  return state.locks.p1 && state.locks.p2;
}

function openHandoffScreen() {
  if (state.mode !== MODE.LOCAL || !state.locks.p1 || state.inputSide !== "p1") return;
  state.awaitingHandoff = true;
  ui.handoffScreen.classList.remove("hidden");
  updateOfflineInputUI();
}

function beginPlayer2Input() {
  state.awaitingHandoff = false;
  state.inputSide = "p2";
  ui.handoffScreen.classList.add("hidden");
  setStatusBanner("PLAYER 2の命令入力を開始してください。", "info");
  updateOfflineInputUI();
}

async function startOfflineBattle() {
  if (state.mode === MODE.ONLINE || !canStartOfflineBattle() || state.battleAnimationRunning) return;

  state.battleAnimationRunning = true;
  setPhase(PHASE.BATTLE);
  hideResultOverlay();
  toggleSkillButtons(false);
  ui.startBattleBtn.disabled = true;
  ui.switchPlayerBtn.classList.add("hidden");

  const result = simulateBattle(state.p1Commands, state.p2Commands, {
    p1Name: state.mode === MODE.CPU ? "PLAYER" : "PLAYER 1",
    p2Name: state.mode === MODE.CPU ? "CPU" : "PLAYER 2",
  });

  setStatusBanner("シミュレーション実行中...", "warn");
  await playBattlePresentation(result);
  await sleep(360);
  showResultOverlay(result);
  setPhase(PHASE.RESULT);
  state.battleAnimationRunning = false;
}

function onResultPrimaryAction() {
  if (state.mode === MODE.ONLINE) {
    requestOnlineRestart();
    return;
  }
  if (!state.mode) return;
  startMode(state.mode);
}

function returnToTitle() {
  if (state.online.socket && state.online.socket.readyState === WebSocket.OPEN) {
    sendToServer(MESSAGE_TYPES.LEAVE_ROOM);
    state.online.socket.close();
  }
  state.online.socket = null;
  state.mode = null;
  setPhase(PHASE.TITLE);
  resetOnlineSessionState(false);
  hideResultOverlay();
  clearLog();
  updateHpDisplay(GAME_CONFIG.maxHp, GAME_CONFIG.maxHp);
  setStatusBanner("モードを選択してください。", "info");
  updateOnlineStatusPanel();
  updateOnlineRoomActionButtons();
  ui.titleScreen.classList.remove("hidden");
  ui.gameScreen.classList.add("hidden");
  ui.handoffScreen.classList.add("hidden");
  ui.howToScreen.classList.add("hidden");
}

function updateOfflineInputUI() {
  const activeCommands = getCurrentOfflineCommands();
  const activeLocked = isCurrentOfflineLocked();
  const done = activeCommands.length === GAME_CONFIG.commandCount;
  const canSwitchLocal = state.mode === MODE.LOCAL && state.inputSide === "p1" && state.locks.p1 && !state.awaitingHandoff;

  ui.undoBtn.disabled = !activeCommands.length || activeLocked || state.awaitingHandoff;
  ui.clearBtn.disabled = !activeCommands.length || activeLocked || state.awaitingHandoff;
  ui.lockBtn.disabled = activeLocked || !done || state.awaitingHandoff;
  ui.switchPlayerBtn.classList.toggle("hidden", !canSwitchLocal);
  ui.startBattleBtn.disabled = !canStartOfflineBattle();

  renderCommandSlots(state.mode === MODE.LOCAL && (state.inputSide === "p2" || state.awaitingHandoff), false);
  toggleSkillButtons(state.phase === PHASE.INPUT && !state.awaitingHandoff && !activeLocked && activeCommands.length < GAME_CONFIG.commandCount);
  updateSequenceText();

  if (state.phase !== PHASE.INPUT) return;
  ui.turnIndicator.textContent = "入力フェーズ";
  ui.confirmationText.classList.toggle("hidden", !activeLocked);

  if (state.mode === MODE.CPU) {
    ui.phaseTitle.textContent = "コマンド入力";
    ui.phaseSubtitle.textContent = activeLocked ? "命令は確定済みです。戦闘開始できます。" : "3手を選んで命令確定してください。";
    ui.selectionStep.textContent = activeLocked ? "選択中: 完了" : `選択中: ${activeCommands.length + 1}手目`;
    return;
  }

  if (state.awaitingHandoff) {
    ui.phaseTitle.textContent = "プレイヤー交代待機";
    ui.phaseSubtitle.textContent = "相手に見せないでください。端末受け渡し中です。";
    ui.selectionStep.textContent = "選択中: 交代待機";
    return;
  }

  if (state.inputSide === "p1") {
    ui.phaseTitle.textContent = "PLAYER 1 入力";
    ui.phaseSubtitle.textContent = activeLocked ? "PLAYER 1命令は確定済みです。" : "プレイヤー1が3手を入力してください。";
  } else {
    ui.phaseTitle.textContent = "PLAYER 2 入力";
    ui.phaseSubtitle.textContent = activeLocked ? "PLAYER 2命令は確定済みです。" : "プレイヤー2が3手を入力してください。";
  }
  ui.selectionStep.textContent = activeLocked ? "選択中: 完了" : `選択中: ${activeCommands.length + 1}手目`;
}

function onCreateRoom() {
  if (state.mode !== MODE.ONLINE) return;
  const playerName = ui.onlineNameInput.value.trim();
  if (!playerName) return showToast("名前を入力してください", "error");
  ensureOnlineSocket(() => sendToServer(MESSAGE_TYPES.CREATE_ROOM, { playerName }));
}

function onJoinRoom() {
  if (state.mode !== MODE.ONLINE) return;
  const playerName = ui.onlineNameInput.value.trim();
  const roomId = ui.onlineRoomInput.value.trim().toUpperCase();
  if (!playerName || !roomId) return showToast("名前とルームIDを入力してください", "error");
  ensureOnlineSocket(() => sendToServer(MESSAGE_TYPES.JOIN_ROOM, { playerName, roomId }));
}

function getWebSocketUrl() {
  if (NETWORK_CONFIG.wsEndpoint) return NETWORK_CONFIG.wsEndpoint;
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  if (location.hostname === "localhost" && !location.port) return `${protocol}://localhost:3000`;
  return `${protocol}://${location.host}`;
}

function ensureOnlineSocket(onReady) {
  if (state.online.socket && state.online.socket.readyState === WebSocket.CONNECTING) {
    socketReadyCallbacks.push(onReady);
    state.online.isConnecting = true;
    updateOnlineRoomActionButtons();
    return;
  }

  if (state.online.socket && state.online.socket.readyState === WebSocket.OPEN) {
    onReady();
    return;
  }

  state.online.isConnecting = true;
  socketReadyCallbacks.push(onReady);
  updateOnlineRoomActionButtons();

  const socket = new WebSocket(getWebSocketUrl());
  state.online.socket = socket;

  socket.addEventListener("open", () => {
    state.online.connected = true;
    state.online.isConnecting = false;
    updateConnectionStatus();
    setStatusBanner("サーバー接続成功", "ok");
    while (socketReadyCallbacks.length) {
      const callback = socketReadyCallbacks.shift();
      if (typeof callback === "function") callback();
    }
    updateOnlineRoomActionButtons();
  });

  socket.addEventListener("message", (event) => handleServerMessage(event.data));

  socket.addEventListener("close", () => {
    state.online.connected = false;
    state.online.isConnecting = false;
    state.battleAnimationRunning = false;
    updateConnectionStatus();
    if (state.mode !== MODE.ONLINE) return;
    setPhase(PHASE.ONLINE_LOBBY);
    resetOnlineSessionState(true);
    setOnlineMessage("接続が切断されました。再接続してください。");
    setStatusBanner("通信切断: 再接続が必要です", "error");
    updateOnlineStatusPanel();
    updateOnlineInputUI();
    updateOnlineRoomActionButtons();
  });

  socket.addEventListener("error", () => {
    state.online.isConnecting = false;
    setOnlineMessage("通信エラーが発生しました。");
    setStatusBanner("サーバー接続失敗", "error");
    showToast("サーバー接続に失敗しました", "error");
    updateOnlineRoomActionButtons();
  });
}

function sendToServer(type, payload = {}) {
  if (!state.online.socket || state.online.socket.readyState !== WebSocket.OPEN) {
    showToast("サーバーに接続されていません", "error");
    return;
  }
  state.online.socket.send(JSON.stringify({ type, payload }));
}

function handleServerMessage(raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch (error) {
    console.error("Invalid server message", raw);
    return;
  }

  const { type, payload } = message;

  switch (type) {
    case MESSAGE_TYPES.ROOM_CREATED:
      state.online.playerId = payload.playerId;
      state.online.playerName = payload.playerName;
      state.online.roomId = payload.roomId;
      state.online.opponentName = "-";
      setPhase(PHASE.ONLINE_WAITING);
      setOnlineMessage(`ルーム作成完了。ID: ${payload.roomId} を相手に共有してください。`);
      setStatusBanner("ルーム作成完了: 相手の参加待ち", "warn");
      updateOnlineStatusPanel();
      updateOnlineInputUI();
      updateOnlineRoomActionButtons();
      break;

    case MESSAGE_TYPES.ROOM_JOINED:
      if (payload.left) {
        setOnlineMessage("ルームから退出しました。");
        setStatusBanner("ルーム退出完了", "info");
        updateOnlineRoomActionButtons();
        break;
      }
      state.online.playerId = payload.playerId;
      state.online.playerName = payload.playerName;
      state.online.roomId = payload.roomId;
      state.online.opponentName = payload.opponentName || "-";
      setPhase(payload.ready ? PHASE.INPUT : PHASE.ONLINE_WAITING);
      resetOnlineInputState();
      setOnlineMessage(payload.ready ? "対戦準備完了。3手を入力してください。" : "ルーム参加完了。相手待ちです。");
      setStatusBanner(payload.ready ? "両者準備完了: 命令入力開始" : "参加完了: 相手待ち", payload.ready ? "ok" : "warn");
      updateOnlineStatusPanel();
      updateOnlineInputUI();
      updateOnlineRoomActionButtons();
      break;

    case MESSAGE_TYPES.PLAYER_JOINED:
      state.online.opponentName = payload.opponentName;
      setOnlineMessage(`${payload.opponentName} が参加しました。`);
      setStatusBanner("相手が参加しました", "ok");
      updateOnlineStatusPanel();
      break;

    case MESSAGE_TYPES.READY_TO_BATTLE:
      setPhase(PHASE.INPUT);
      state.battleAnimationRunning = false;
      resetOnlineInputState();
      clearLog();
      updateHpDisplay(GAME_CONFIG.maxHp, GAME_CONFIG.maxHp);
      setOnlineMessage(payload.isRematch ? "再戦開始。命令を入力してください。" : "3手を入力して命令確定→送信してください。");
      setStatusBanner(payload.isRematch ? "再戦開始" : "命令入力中", "ok");
      updateOnlineInputUI();
      updateOnlineRoomActionButtons();
      break;

    case MESSAGE_TYPES.OPPONENT_SUBMITTED:
      state.online.opponentSubmitted = true;
      setOnlineMessage("相手の命令送信を確認しました。結果を待っています。");
      setStatusBanner("相手送信完了: 戦闘結果待ち", "warn");
      updateOnlineInputUI();
      break;

    case MESSAGE_TYPES.OPPONENT_RESTART_REQUESTED:
      state.online.opponentRestartRequested = true;
      setOnlineMessage("相手が再戦を希望しています。再戦要求を押すと開始します。");
      setStatusBanner("相手が再戦希望中", "warn");
      updateResultOverlayStatus();
      break;

    case MESSAGE_TYPES.BATTLE_RESULT:
      if (state.battleAnimationRunning) return;
      state.battleAnimationRunning = true;
      setPhase(PHASE.BATTLE);
      hideResultOverlay();
      state.p2Commands = payload.result.commands.p2;
      state.online.opponentSubmitted = true;
      setStatusBanner("戦闘シミュレーション中", "warn");
      playBattlePresentation(payload.result).then(() => {
        sleep(360).then(() => showResultOverlay(payload.result));
        setPhase(PHASE.RESULT);
        state.battleAnimationRunning = false;
        updateOnlineInputUI();
        updateOnlineRoomActionButtons();
      });
      break;

    case MESSAGE_TYPES.RESTART_WAITING:
      state.online.restartRequested = true;
      setOnlineMessage("再戦要求を送信しました。相手の承認を待っています。");
      setStatusBanner("再戦承認待ち", "warn");
      updateResultOverlayStatus();
      updateOnlineInputUI();
      break;

    case MESSAGE_TYPES.OPPONENT_LEFT:
      state.online.opponentName = "-";
      setPhase(PHASE.ONLINE_WAITING);
      state.battleAnimationRunning = false;
      resetOnlineInputState();
      setOnlineMessage("相手が切断しました。新しい相手の参加を待っています。");
      setStatusBanner("相手が切断しました", "error");
      showToast("相手が切断しました", "error");
      updateOnlineStatusPanel();
      updateOnlineInputUI();
      updateOnlineRoomActionButtons();
      break;

    case MESSAGE_TYPES.ERROR:
      setOnlineMessage(`エラー: ${payload.message}`);
      setStatusBanner(`エラー: ${payload.message}`, "error");
      showToast(payload.message, "error");
      break;

    default:
      console.log("Unknown message type", type, payload);
  }

  if (state.mode === MODE.ONLINE) {
    updateOnlineRoomActionButtons();
  }
}

function resetOnlineInputState() {
  state.p1Commands = [];
  state.p2Commands = [];
  state.online.commandLocked = false;
  state.online.mySubmitted = false;
  state.online.opponentSubmitted = false;
  state.online.restartRequested = false;
  state.online.opponentRestartRequested = false;
  hideResultOverlay();
}

function resetOnlineSessionState(keepIdentity = false) {
  state.online.connected = false;
  state.online.isConnecting = false;
  if (!keepIdentity) {
    state.online.playerId = null;
    state.online.playerName = "";
  }
  state.online.roomId = "";
  state.online.opponentName = "";
  state.online.restartRequested = false;
  state.online.opponentRestartRequested = false;
  state.online.mySubmitted = false;
  state.online.opponentSubmitted = false;
  state.online.commandLocked = false;
}

function updateOnlineRoomActionButtons() {
  const hasRoom = Boolean(state.online.roomId);
  const canCreateOrJoin = !hasRoom && !state.online.isConnecting;
  ui.createRoomBtn.disabled = !canCreateOrJoin;
  ui.joinRoomBtn.disabled = !canCreateOrJoin;
  ui.leaveRoomBtn.disabled = !hasRoom;
  ui.copyRoomBtn.disabled = !hasRoom;
}

function undoOnlineCommand() {
  if (state.mode !== MODE.ONLINE || state.phase !== PHASE.INPUT || state.online.commandLocked || state.online.mySubmitted) return;
  if (!state.p1Commands.length) return;
  state.p1Commands.pop();
  updateOnlineInputUI();
}

function clearOnlineCommands() {
  if (state.mode !== MODE.ONLINE || state.phase !== PHASE.INPUT || state.online.commandLocked || state.online.mySubmitted) return;
  state.p1Commands = [];
  updateOnlineInputUI();
}

function lockOnlineCommands() {
  if (state.mode !== MODE.ONLINE || state.phase !== PHASE.INPUT || state.online.mySubmitted || state.online.commandLocked) return;
  if (state.p1Commands.length !== GAME_CONFIG.commandCount) {
    showToast("3手すべて選択してください", "error");
    return;
  }
  state.online.commandLocked = true;
  setStatusBanner("命令確定: 送信できます", "ok");
  setOnlineMessage("命令を確定しました。送信ボタンでサーバーへ提出してください。");
  updateOnlineInputUI();
}

function submitOnlineCommands() {
  if (state.mode !== MODE.ONLINE || state.phase !== PHASE.INPUT) return;
  if (!state.online.commandLocked) {
    showToast("先に命令確定してください", "error");
    return;
  }
  if (state.online.mySubmitted) return;

  sendToServer(MESSAGE_TYPES.SUBMIT_COMMANDS, { commands: state.p1Commands });
  state.online.mySubmitted = true;
  setStatusBanner("送信完了: 相手待ち", "warn");
  setOnlineMessage("命令を送信しました。相手の命令を待っています。");
  updateOnlineInputUI();
}

function requestOnlineRestart() {
  if (state.mode !== MODE.ONLINE || state.phase !== PHASE.RESULT || state.online.restartRequested) return;
  sendToServer(MESSAGE_TYPES.RESTART_REQUEST);
  state.online.restartRequested = true;
  setStatusBanner("再戦承認待ち", "warn");
  setOnlineMessage("再戦要求を送信しました。相手の承認待ちです。");
  updateResultOverlayStatus();
  updateOnlineInputUI();
}

function leaveOnlineRoom() {
  if (state.mode !== MODE.ONLINE) return;
  sendToServer(MESSAGE_TYPES.LEAVE_ROOM);
  setPhase(PHASE.ONLINE_LOBBY);
  state.online.roomId = "";
  state.online.opponentName = "";
  resetOnlineInputState();
  hideResultOverlay();
  setStatusBanner("ルーム退出完了", "info");
  setOnlineMessage("ルームから退出しました。新しく作成または参加できます。");
  updateOnlineStatusPanel();
  updateOnlineInputUI();
  updateOnlineRoomActionButtons();
}

async function copyRoomId() {
  const roomId = state.online.roomId;
  if (!roomId) {
    showToast("コピーできるルームIDがありません", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(roomId);
    showToast("ルームIDをコピーしました", "ok");
  } catch (error) {
    showToast("コピーに失敗しました", "error");
  }
}

function updateOnlineInputUI() {
  const isInput = state.phase === PHASE.INPUT;
  const hasRoom = Boolean(state.online.roomId);
  const done = state.p1Commands.length === GAME_CONFIG.commandCount;

  ui.onlineUndoBtn.disabled = !isInput || state.online.commandLocked || state.online.mySubmitted || !state.p1Commands.length;
  ui.onlineClearBtn.disabled = !isInput || state.online.commandLocked || state.online.mySubmitted || !state.p1Commands.length;
  ui.onlineLockBtn.disabled = !isInput || state.online.commandLocked || state.online.mySubmitted || !done;
  ui.submitOnlineBtn.disabled = !isInput || !state.online.commandLocked || state.online.mySubmitted;
  ui.onlineRestartBtn.disabled = !(state.phase === PHASE.RESULT && hasRoom) || state.online.restartRequested;

  const canPick = isInput && !state.online.commandLocked && !state.online.mySubmitted && state.p1Commands.length < GAME_CONFIG.commandCount;
  toggleSkillButtons(canPick);
  renderCommandSlots(false, state.phase !== PHASE.RESULT);
  updateSequenceText();
  updateOnlineStatusPanel();

  ui.turnIndicator.textContent = isInput ? "入力フェーズ" : state.phase === PHASE.RESULT ? "対戦終了" : "接続待機";
  ui.phaseTitle.textContent = isInput ? "オンライン命令入力" : "オンライン待機";
  ui.phaseSubtitle.textContent = isInput
    ? "3手を選択して命令確定→命令送信を行ってください。"
    : "ルーム状態を確認してください。";
  ui.selectionStep.textContent = isInput ? `選択中: ${Math.min(state.p1Commands.length + 1, 3)}手目` : "選択中: -";

  const showConfirm = state.online.commandLocked || state.online.mySubmitted;
  ui.confirmationText.classList.toggle("hidden", !showConfirm);
  ui.confirmationText.textContent = state.online.mySubmitted ? "命令送信済み / 相手待ち" : "命令確定 / COMMAND LOCKED";

  if (!hasRoom) {
    ui.opponentStateText.textContent = "未参加";
  } else if (state.phase === PHASE.INPUT) {
    ui.opponentStateText.textContent = state.online.opponentSubmitted ? "送信完了" : "入力中";
  } else if (state.phase === PHASE.RESULT) {
    ui.opponentStateText.textContent = "対戦終了";
    ui.retryBtn.textContent = state.online.restartRequested ? "再戦要求送信済み" : "再戦を希望";
    ui.retryBtn.disabled = state.online.restartRequested;
    updateResultOverlayStatus();
  } else {
    ui.opponentStateText.textContent = "待機中";
  }
}
function updateOnlineStatusPanel() {
  ui.connectionStatus.textContent = state.online.connected ? "接続中" : "未接続";
  ui.roomIdText.textContent = state.online.roomId || "-";
  ui.onlineSelfName.textContent = state.online.playerName || "-";
  ui.onlineOpponentName.textContent = state.online.opponentName || "-";
  if (state.mode === MODE.ONLINE) {
    ui.playerName.textContent = state.online.playerName || "YOU";
    ui.opponentName.textContent = state.online.opponentName || "OPPONENT";
  }
}

function updateConnectionStatus() {
  ui.connectionStatus.textContent = state.online.connected ? "接続中" : "未接続";
}

function setOnlineMessage(text) {
  ui.onlineMessage.textContent = text;
}

function setStatusBanner(text, type = "info") {
  ui.statusBanner.textContent = text;
  ui.statusBanner.classList.remove("ok", "warn", "error", "info");
  ui.statusBanner.classList.add(type);
}

function showToast(text, type = "info") {
  ui.toast.textContent = text;
  ui.toast.classList.remove("hidden", "ok", "error", "info");
  ui.toast.classList.add(type);
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.add("hidden"), 1800);
}

function updateSequenceText() {
  if (state.mode === MODE.ONLINE) {
    ui.selectedSequence.textContent = state.p1Commands.length ? `現在の並び: ${state.p1Commands.join(" -> ")}` : "現在の並び: -";
    return;
  }

  const current = getCurrentOfflineCommands();
  ui.selectedSequence.textContent = current.length ? `現在の並び: ${current.join(" -> ")}` : "現在の並び: -";
}

function renderSkillButtons() {
  ui.skillButtons.innerHTML = "";
  SKILL_LIST.forEach((skill) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `skill-btn skill-role-${skill.roleClass}`;
    button.innerHTML = `<span class="name">${skill.name}</span><span class="desc">${skill.description}</span><span class="role">${skill.role}</span>`;
    button.addEventListener("click", () => selectSkill(skill.id));
    ui.skillButtons.appendChild(button);
  });
}

function renderCommandSlots(hideP1 = false, hideP2 = false) {
  renderSlotsForSide(ui.playerSlots, state.p1Commands, hideP1);
  renderSlotsForSide(ui.opponentSlots, state.p2Commands, hideP2);
}

function renderSlotsForSide(container, commands, hideValues) {
  container.innerHTML = "";
  for (let i = 0; i < GAME_CONFIG.commandCount; i += 1) {
    const slot = document.createElement("div");
    slot.className = "slot";

    const index = document.createElement("span");
    index.className = "slot-index";
    index.textContent = `${i + 1}手目`;

    const value = document.createElement("strong");
    if (!commands[i]) {
      value.textContent = "EMPTY";
    } else if (hideValues) {
      value.textContent = "LOCKED";
      slot.classList.add("filled", "locked");
    } else {
      value.textContent = commands[i];
      slot.classList.add("filled");
    }

    slot.append(index, value);
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

function appendLog(message, category = "system", kind = "row") {
  const line = document.createElement("div");
  line.className = "log-row";
  if (kind === "turn") line.classList.add("log-turn");
  line.classList.add(`log-${category}`);
  line.textContent = message;
  ui.battleLog.appendChild(line);
  ui.battleLog.scrollTop = ui.battleLog.scrollHeight;
}

function appendLogDivider() {
  const divider = document.createElement("div");
  divider.className = "log-divider";
  ui.battleLog.appendChild(divider);
}

async function playBattlePresentation(result) {
  clearLog();
  appendLog("SIMULATION START", "system");
  appendLog("COMMAND EXECUTION", "system");
  await sleep(GAME_CONFIG.timings.intro);

  for (const turn of result.turns) {
    ui.turnIndicator.textContent = `TURN ${turn.turn} / ${GAME_CONFIG.commandCount}`;
    appendLogDivider();
    appendLog(`TURN ${turn.turn}`, "system", "turn");

    for (const event of turn.events) {
      appendLog(event.message, event.category || "system");
      await sleep(GAME_CONFIG.timings.lineDelay);
    }

    applyTurnEffects(turn.flags);
    updateHpDisplay(turn.hp.p1, turn.hp.p2);
    appendLog(`HP => ${result.meta.p1Name}: ${turn.hp.p1} / ${result.meta.p2Name}: ${turn.hp.p2}`, "system");
    await sleep(GAME_CONFIG.timings.turnDelay);
  }
}

function applyTurnEffects(flags) {
  if (flags.p1Guarding) flashPanel(ui.playerPanel, "guard-flash");
  if (flags.p2Guarding) flashPanel(ui.opponentPanel, "guard-flash");
  if (flags.p1Healed) flashPanel(ui.playerPanel, "heal-flash");
  if (flags.p2Healed) flashPanel(ui.opponentPanel, "heal-flash");
  if (flags.p1Damaged) flashPanel(ui.playerPanel, "hit-flash");
  if (flags.p2Damaged) flashPanel(ui.opponentPanel, "hit-flash");
  if (flags.p1DroneTriggered) flashPanel(ui.playerPanel, "drone-flash");
  if (flags.p2DroneTriggered) flashPanel(ui.opponentPanel, "drone-flash");
}

function flashPanel(panel, className) {
  panel.classList.remove(className);
  panel.offsetWidth;
  panel.classList.add(className);
  setTimeout(() => panel.classList.remove(className), 430);
}

function showResultOverlay(result) {
  let resultText = "引き分け";
  let resultClass = "draw";
  if (result.winner.key === "p1") {
    resultText = state.mode === MODE.CPU ? "あなたの勝利" : `${result.meta.p1Name} 勝利`;
    resultClass = state.mode === MODE.CPU ? "win" : "win";
  } else if (result.winner.key === "p2") {
    resultText = state.mode === MODE.CPU ? "CPUの勝利" : `${result.meta.p2Name} 勝利`;
    resultClass = state.mode === MODE.CPU ? "lose" : "lose";
  }

  ui.resultCard.classList.remove("win", "lose", "draw");
  ui.resultCard.classList.add(resultClass);
  ui.resultText.textContent = resultText;
  ui.resultDetail.textContent = `最終HP - ${result.meta.p1Name}: ${result.finalHp.p1} / ${result.meta.p2Name}: ${result.finalHp.p2}`;
  ui.resultP1Commands.textContent = result.commands.p1.join(" -> ");
  ui.resultP2Commands.textContent = result.commands.p2.join(" -> ");
  ui.resultPanel.classList.remove("hidden");
  ui.resultPanel.setAttribute("aria-hidden", "false");

  if (state.mode === MODE.ONLINE) {
    ui.retryBtn.textContent = state.online.restartRequested ? "再戦要求送信済み" : "再戦を希望";
    ui.retryBtn.disabled = state.online.restartRequested;
  } else {
    ui.retryBtn.textContent = "もう一度";
    ui.retryBtn.disabled = false;
  }
  updateResultOverlayStatus();

  setStatusBanner("対戦終了", "ok");
  appendLogDivider();
  appendLog(`RESULT: ${resultText}`, "system");
}

function updateResultOverlayStatus() {
  if (state.mode !== MODE.ONLINE) {
    ui.resultExtraStatus.textContent = "";
    return;
  }

  if (state.online.restartRequested && state.online.opponentRestartRequested) {
    ui.resultExtraStatus.textContent = "再戦準備完了";
    return;
  }
  if (state.online.restartRequested) {
    ui.resultExtraStatus.textContent = "再戦要求を送信済みです。相手の承認待ちです。";
    return;
  }
  if (state.online.opponentRestartRequested) {
    ui.resultExtraStatus.textContent = "相手が再戦を希望しています。";
    return;
  }
  ui.resultExtraStatus.textContent = "再戦する場合は「再戦を希望」を押してください。";
}

function hideResultOverlay() {
  ui.resultPanel.classList.add("hidden");
  ui.resultPanel.setAttribute("aria-hidden", "true");
  ui.resultCard.classList.remove("win", "lose", "draw");
  ui.resultExtraStatus.textContent = "";
  ui.retryBtn.textContent = "もう一度";
  ui.retryBtn.disabled = false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function simulateBattle(player1Commands, player2Commands, meta = { p1Name: "P1", p2Name: "P2" }) {
  const battleState = {
    p1: { hp: 100, chargeReady: false, jamMultiplier: 1, droneReady: false },
    p2: { hp: 100, chargeReady: false, jamMultiplier: 1, droneReady: false },
  };

  const turns = [];

  for (let i = 0; i < GAME_CONFIG.commandCount; i += 1) {
    const action1 = player1Commands[i];
    const action2 = player2Commands[i];
    const events = [];

    events.push({ category: "system", message: `${meta.p1Name}: ${action1} / ${meta.p2Name}: ${action2}` });

    const p1Guarding = action1 === "GUARD";
    const p2Guarding = action2 === "GUARD";
    const p1ScheduleDrone = action1 === "DRONE";
    const p2ScheduleDrone = action2 === "DRONE";

    if (action1 === "CHARGE") {
      battleState.p1.chargeReady = true;
      events.push({ category: "setup", message: `${meta.p1Name} がCHARGE。次の攻撃が強化。` });
    }
    if (action2 === "CHARGE") {
      battleState.p2.chargeReady = true;
      events.push({ category: "setup", message: `${meta.p2Name} がCHARGE。次の攻撃が強化。` });
    }

    const p1Jam = action1 === "JAM";
    const p2Jam = action2 === "JAM";
    if (p1Jam) events.push({ category: "jam", message: `${meta.p1Name} がJAM。${meta.p2Name} の次攻撃を弱体化。` });
    if (p2Jam) events.push({ category: "jam", message: `${meta.p2Name} がJAM。${meta.p1Name} の次攻撃を弱体化。` });

    if (p1ScheduleDrone) events.push({ category: "setup", message: `${meta.p1Name} がDRONEを設置。` });
    if (p2ScheduleDrone) events.push({ category: "setup", message: `${meta.p2Name} がDRONEを設置。` });

    const damageToP2 = calculateAttackDamage(action1, battleState.p1, p2Guarding);
    const damageToP1 = calculateAttackDamage(action2, battleState.p2, p1Guarding);

    if (damageToP2 > 0) events.push({ category: "attack", message: `${meta.p1Name} の攻撃: ${meta.p2Name} に ${damageToP2} ダメージ` });
    if (damageToP1 > 0) events.push({ category: "attack", message: `${meta.p2Name} の攻撃: ${meta.p1Name} に ${damageToP1} ダメージ` });
    if (p1Guarding) events.push({ category: "defense", message: `${meta.p1Name} はGUARD態勢` });
    if (p2Guarding) events.push({ category: "defense", message: `${meta.p2Name} はGUARD態勢` });

    if (p1Jam) battleState.p2.jamMultiplier *= 0.7;
    if (p2Jam) battleState.p1.jamMultiplier *= 0.7;

    const heal1 = action1 === "REPAIR" ? 18 : 0;
    const heal2 = action2 === "REPAIR" ? 18 : 0;
    if (heal1 > 0) events.push({ category: "heal", message: `${meta.p1Name} がREPAIRで 18 回復` });
    if (heal2 > 0) events.push({ category: "heal", message: `${meta.p2Name} がREPAIRで 18 回復` });

    const droneToP2 = battleState.p1.droneReady ? 15 : 0;
    const droneToP1 = battleState.p2.droneReady ? 15 : 0;
    if (droneToP2 > 0) events.push({ category: "setup", message: `${meta.p1Name} のDRONE起動: ${meta.p2Name} に 15 ダメージ` });
    if (droneToP1 > 0) events.push({ category: "setup", message: `${meta.p2Name} のDRONE起動: ${meta.p1Name} に 15 ダメージ` });

    battleState.p1.hp = clampHp(battleState.p1.hp - damageToP1 - droneToP1 + heal1);
    battleState.p2.hp = clampHp(battleState.p2.hp - damageToP2 - droneToP2 + heal2);

    battleState.p1.droneReady = p1ScheduleDrone;
    battleState.p2.droneReady = p2ScheduleDrone;

    turns.push({
      turn: i + 1,
      hp: { p1: battleState.p1.hp, p2: battleState.p2.hp },
      events,
      flags: {
        p1Guarding,
        p2Guarding,
        p1Healed: heal1 > 0,
        p2Healed: heal2 > 0,
        p1DroneTriggered: droneToP1 > 0,
        p2DroneTriggered: droneToP2 > 0,
        p1Damaged: damageToP1 + droneToP1 > 0,
        p2Damaged: damageToP2 + droneToP2 > 0,
      },
    });
  }

  return {
    meta,
    turns,
    finalHp: { p1: battleState.p1.hp, p2: battleState.p2.hp },
    winner: decideWinner(battleState.p1.hp, battleState.p2.hp),
    commands: { p1: [...player1Commands], p2: [...player2Commands] },
  };
}

function calculateAttackDamage(actionId, attacker, targetGuarding) {
  if (actionId !== "SHOT" && actionId !== "BURST") return 0;
  let damage = actionId === "SHOT" ? 20 : 35;
  if (attacker.chargeReady) {
    damage *= 1.5;
    attacker.chargeReady = false;
  }
  if (attacker.jamMultiplier !== 1) {
    damage *= attacker.jamMultiplier;
    attacker.jamMultiplier = 1;
  }
  if (targetGuarding) damage *= 0.5;
  return Math.max(0, Math.round(damage));
}

function decideWinner(p1, p2) {
  if (p1 > p2) return { key: "p1" };
  if (p2 > p1) return { key: "p2" };
  return { key: "draw" };
}

function clampHp(v) {
  return Math.max(0, Math.min(100, v));
}

function generateCpuCommands(playerCommands) {
  const picks = [];
  let estimatedHp = 100;

  while (picks.length < GAME_CONFIG.commandCount) {
    const i = picks.length;

    if (i <= 1 && Math.random() < 0.32 && !isTripleRisk(picks, "CHARGE")) {
      picks.push("CHARGE");
      if (picks.length < GAME_CONFIG.commandCount) picks.push("BURST");
      continue;
    }

    if (estimatedHp <= 58 && Math.random() < 0.52 && !isTripleRisk(picks, "REPAIR")) {
      picks.push("REPAIR");
      estimatedHp = Math.min(100, estimatedHp + 18);
      continue;
    }

    const hint = playerCommands[i] || "SHOT";
    const pool = hint === "BURST"
      ? ["GUARD", "JAM", "SHOT", "BURST", "REPAIR", "DRONE", "GUARD"]
      : ["SHOT", "SHOT", "BURST", "GUARD", "JAM", "DRONE", "REPAIR"];

    let pick = "SHOT";
    for (let t = 0; t < 6; t += 1) {
      const candidate = pool[Math.floor(Math.random() * pool.length)];
      if (!isTripleRisk(picks, candidate)) {
        pick = candidate;
        break;
      }
    }

    picks.push(pick);
    estimatedHp -= Math.floor(Math.random() * 10) + 7;
  }

  return picks.slice(0, GAME_CONFIG.commandCount);
}

function isTripleRisk(arr, next) {
  if (arr.length < 2) return false;
  return arr[arr.length - 1] === next && arr[arr.length - 2] === next;
}

init();
