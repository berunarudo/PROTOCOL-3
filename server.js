const path = require("path");
const http = require("http");
const express = require("express");
const WebSocket = require("ws");

// ========================================
// Config
// ========================================

const PORT = process.env.PORT || 3000;
const ROOM_ID_LENGTH = 6;
const ROOM_ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const MSG = {
  CREATE_ROOM: "create_room",
  JOIN_ROOM: "join_room",
  SUBMIT_COMMANDS: "submit_commands",
  RESTART_REQUEST: "restart_request",
  LEAVE_ROOM: "leave_room",
  RANDOM_MATCH: "randomMatch",
  CANCEL_RANDOM_MATCH: "cancelRandomMatch",

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
  RANDOM_MATCH_WAITING: "randomMatchWaiting",
  MATCH_FOUND: "matchFound",
  RANDOM_MATCH_CANCELED: "randomMatchCanceled",
  MATCH_ERROR: "matchError",
};

const VALID_SKILLS = ["SHOT", "BURST", "GUARD", "CHARGE", "JAM", "REPAIR", "DRONE"];

// ========================================
// Runtime State
// ========================================

const rooms = new Map();
const playersBySocket = new Map();
const waitingPlayers = [];
let playerSequence = 1;

// ========================================
// Express + WS bootstrap
// ========================================

const app = express();
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  logInfo("WS", "connected");
  ws.on("message", (raw) => handleMessage(ws, raw));
  ws.on("close", () => handleLeaveRoom(ws, true));
  ws.on("error", (error) => logError("WS", error.message));
});

server.listen(PORT, () => {
  logInfo("BOOT", `Server running on http://localhost:${PORT}`);
});

// ========================================
// Message Router
// ========================================

function handleMessage(ws, raw) {
  let parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return sendError(ws, "不正なメッセージ形式です");
  }

  const { type, payload = {} } = parsed;
  logInfo("WS_MSG", type);

  switch (type) {
    case MSG.CREATE_ROOM:
      return handleCreateRoom(ws, payload);
    case MSG.JOIN_ROOM:
      return handleJoinRoom(ws, payload);
    case MSG.SUBMIT_COMMANDS:
      return handleSubmitCommands(ws, payload);
    case MSG.RESTART_REQUEST:
      return handleRestartRequest(ws);
    case MSG.LEAVE_ROOM:
      return handleLeaveRoom(ws, false);
    case MSG.RANDOM_MATCH:
      return handleRandomMatch(ws, payload);
    case MSG.CANCEL_RANDOM_MATCH:
      return handleCancelRandomMatch(ws);
    default:
      return sendError(ws, "未知のメッセージ種別です");
  }
}

// ========================================
// Room Actions
// ========================================

function handleCreateRoom(ws, payload) {
  removeWaitingPlayer(ws);
  const playerName = sanitizeName(payload.playerName);
  if (!playerName) return sendError(ws, "名前を入力してください");
  if (playersBySocket.has(ws)) return sendError(ws, "既にルーム参加中です");

  const roomId = generateRoomId();
  const player = createPlayer(ws, playerName);

  const room = {
    roomId,
    players: [player],
    submitted: {},
    restartRequests: new Set(),
    status: "waiting",
    battleResult: null,
  };

  rooms.set(roomId, room);
  playersBySocket.set(ws, { playerId: player.id, roomId, playerName });

  send(ws, MSG.ROOM_CREATED, {
    roomId,
    playerId: player.id,
    playerName,
  });

  logInfo("ROOM_CREATE", `${roomId} by ${playerName}`);
}

function handleJoinRoom(ws, payload) {
  removeWaitingPlayer(ws);
  const playerName = sanitizeName(payload.playerName);
  const roomId = String(payload.roomId || "").toUpperCase();

  if (!playerName || !roomId) return sendError(ws, "名前とルームIDが必要です");
  if (playersBySocket.has(ws)) return sendError(ws, "既にルーム参加中です");

  const room = rooms.get(roomId);
  if (!room) return sendError(ws, "ルームIDが存在しません");
  if (room.players.length >= 2) return sendError(ws, "ルームが満員です");

  const player = createPlayer(ws, playerName);
  room.players.push(player);
  room.status = "ready";
  room.submitted = {};
  room.restartRequests.clear();
  room.battleResult = null;

  playersBySocket.set(ws, { playerId: player.id, roomId, playerName });

  const host = room.players[0];

  send(ws, MSG.ROOM_JOINED, {
    roomId,
    playerId: player.id,
    playerName,
    opponentName: host.name,
    ready: true,
  });

  send(host.ws, MSG.PLAYER_JOINED, { opponentName: playerName });
  broadcast(room, MSG.READY_TO_BATTLE, { roomId });

  logInfo("ROOM_JOIN", `${playerName} joined ${roomId}`);
}

function handleSubmitCommands(ws, payload) {
  const context = getPlayerContext(ws);
  if (!context) return sendError(ws, "ルームに参加してください");

  const { room, playerId } = context;
  if (room.players.length < 2) return sendError(ws, "相手の参加を待ってください");
  if (room.status !== "ready") return sendError(ws, "現在は命令送信できません");

  const commands = Array.isArray(payload.commands) ? payload.commands : [];
  if (!validateCommands(commands)) return sendError(ws, "命令は3つの有効な技で送信してください");

  if (room.submitted[playerId]) return sendError(ws, "既に送信済みです");

  room.submitted[playerId] = commands;

  const opponent = getOpponent(room, playerId);
  if (opponent) send(opponent.ws, MSG.OPPONENT_SUBMITTED, {});

  const bothSubmitted = room.players.every((p) => Array.isArray(room.submitted[p.id]));
  if (!bothSubmitted) return;

  const p1 = room.players[0];
  const p2 = room.players[1];

  logInfo("BATTLE_START", `${room.roomId} ${p1.name} vs ${p2.name}`);

  const rawResult = simulateBattle(room.submitted[p1.id], room.submitted[p2.id], {
    p1Name: p1.name,
    p2Name: p2.name,
  });

  room.battleResult = rawResult;
  room.status = "result";
  room.restartRequests.clear();

  send(p1.ws, MSG.BATTLE_RESULT, { roomId: room.roomId, result: mapResultForPerspective(rawResult, true) });
  send(p2.ws, MSG.BATTLE_RESULT, { roomId: room.roomId, result: mapResultForPerspective(rawResult, false) });

  logInfo("BATTLE_END", `${room.roomId} winner=${rawResult.winner.key}`);
}

function handleRestartRequest(ws) {
  const context = getPlayerContext(ws);
  if (!context) return sendError(ws, "ルームに参加してください");

  const { room, playerId } = context;
  if (room.status !== "result") return sendError(ws, "結果表示後に再戦できます");
  if (room.restartRequests.has(playerId)) {
    send(ws, MSG.RESTART_WAITING, {});
    return;
  }

  room.restartRequests.add(playerId);
  const opponent = getOpponent(room, playerId);
  if (opponent) send(opponent.ws, MSG.OPPONENT_RESTART_REQUESTED, {});

  if (room.restartRequests.size < 2) {
    send(ws, MSG.RESTART_WAITING, {});
    logInfo("RESTART_WAIT", `${room.roomId} waiting for opponent`);
    return;
  }

  room.submitted = {};
  room.battleResult = null;
  room.status = "ready";
  room.restartRequests.clear();

  broadcast(room, MSG.READY_TO_BATTLE, { roomId: room.roomId, isRematch: true });
  logInfo("RESTART_READY", `${room.roomId} rematch ready`);
}

function handleLeaveRoom(ws, disconnected) {
  const entry = playersBySocket.get(ws);
  if (!entry) {
    const wasWaiting = removeWaitingPlayer(ws);
    if (wasWaiting && !disconnected) send(ws, MSG.RANDOM_MATCH_CANCELED, {});
    return;
  }

  playersBySocket.delete(ws);
  const room = rooms.get(entry.roomId);
  if (!room) return;

  room.players = room.players.filter((p) => p.id !== entry.playerId);
  delete room.submitted[entry.playerId];
  room.restartRequests.delete(entry.playerId);
  room.status = "waiting";
  room.battleResult = null;

  logInfo(disconnected ? "DISCONNECT" : "LEAVE", `${entry.playerName} from ${entry.roomId}`);

  if (room.players.length === 0) {
    rooms.delete(room.roomId);
    logInfo("ROOM_CLOSE", `${room.roomId} closed`);
    return;
  }

  room.submitted = {};
  room.restartRequests.clear();
  broadcast(room, MSG.OPPONENT_LEFT, { message: "相手が切断しました" });

  if (!disconnected) {
    send(ws, MSG.ROOM_JOINED, { left: true, roomId: null });
  }
}

function handleRandomMatch(ws, payload) {
  if (playersBySocket.has(ws)) {
    sendMatchError(ws, "既にルーム参加中です");
    return;
  }

  if (isWaitingPlayer(ws)) {
    send(ws, MSG.RANDOM_MATCH_WAITING, { queueSize: waitingPlayers.length });
    return;
  }

  const playerName = sanitizeName(payload.playerName);
  if (!playerName) {
    sendMatchError(ws, "名前を入力してください");
    return;
  }

  waitingPlayers.push({ ws, playerName });
  logInfo("RANDOM_QUEUE", `${playerName} joined queue size=${waitingPlayers.length}`);
  send(ws, MSG.RANDOM_MATCH_WAITING, { queueSize: waitingPlayers.length });
  tryMatchWaitingPlayers();
}

function handleCancelRandomMatch(ws) {
  const removed = removeWaitingPlayer(ws);
  if (!removed) {
    sendMatchError(ws, "キャンセルできる待機状態ではありません");
    return;
  }
  send(ws, MSG.RANDOM_MATCH_CANCELED, {});
}

function tryMatchWaitingPlayers() {
  cleanupWaitingPlayers();

  while (waitingPlayers.length >= 2) {
    const first = waitingPlayers.shift();
    const second = waitingPlayers.shift();
    if (!first || !second) return;
    if (first.ws === second.ws) continue;

    const roomId = generateRoomId();
    const p1 = createPlayer(first.ws, first.playerName);
    const p2 = createPlayer(second.ws, second.playerName);

    const room = {
      roomId,
      players: [p1, p2],
      submitted: {},
      restartRequests: new Set(),
      status: "ready",
      battleResult: null,
    };

    rooms.set(roomId, room);
    playersBySocket.set(first.ws, { playerId: p1.id, roomId, playerName: p1.name });
    playersBySocket.set(second.ws, { playerId: p2.id, roomId, playerName: p2.name });

    send(first.ws, MSG.MATCH_FOUND, {
      roomId,
      playerId: p1.id,
      playerName: p1.name,
      opponentName: p2.name,
    });

    send(second.ws, MSG.MATCH_FOUND, {
      roomId,
      playerId: p2.id,
      playerName: p2.name,
      opponentName: p1.name,
    });

    logInfo("RANDOM_MATCH", `${roomId} ${p1.name} vs ${p2.name}`);
  }
}

// ========================================
// Battle Logic
// ========================================

function simulateBattle(player1Commands, player2Commands, meta = { p1Name: "P1", p2Name: "P2" }) {
  const battleState = {
    p1: { hp: 100, chargeReady: false, jamMultiplier: 1, droneReady: false },
    p2: { hp: 100, chargeReady: false, jamMultiplier: 1, droneReady: false },
  };

  const turns = [];

  for (let i = 0; i < 3; i += 1) {
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

    const damageToP2 = calcDamage(action1, battleState.p1, p2Guarding);
    const damageToP1 = calcDamage(action2, battleState.p2, p1Guarding);

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
    commands: {
      p1: [...player1Commands],
      p2: [...player2Commands],
    },
  };
}

function calcDamage(actionId, attacker, targetGuarding) {
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

function mapResultForPerspective(result, isP1View) {
  if (isP1View) return result;

  const first = result.meta.p1Name;
  const second = result.meta.p2Name;

  return {
    meta: { p1Name: second, p2Name: first },
    turns: result.turns.map((turn) => ({
      turn: turn.turn,
      hp: { p1: turn.hp.p2, p2: turn.hp.p1 },
      events: turn.events.map((event) => ({
        ...event,
        message: swapNames(event.message, first, second),
      })),
      flags: {
        p1Guarding: turn.flags.p2Guarding,
        p2Guarding: turn.flags.p1Guarding,
        p1Healed: turn.flags.p2Healed,
        p2Healed: turn.flags.p1Healed,
        p1DroneTriggered: turn.flags.p2DroneTriggered,
        p2DroneTriggered: turn.flags.p1DroneTriggered,
        p1Damaged: turn.flags.p2Damaged,
        p2Damaged: turn.flags.p1Damaged,
      },
    })),
    finalHp: { p1: result.finalHp.p2, p2: result.finalHp.p1 },
    winner:
      result.winner.key === "draw"
        ? { key: "draw" }
        : result.winner.key === "p1"
          ? { key: "p2" }
          : { key: "p1" },
    commands: {
      p1: result.commands.p2,
      p2: result.commands.p1,
    },
  };
}

function swapNames(message, a, b) {
  const token = "__TMP_NAME__";
  return message.split(a).join(token).split(b).join(a).split(token).join(b);
}

// ========================================
// Utilities
// ========================================

function createPlayer(ws, name) {
  return { id: `P${playerSequence++}`, name, ws };
}

function getOpponent(room, playerId) {
  return room.players.find((player) => player.id !== playerId) || null;
}

function getPlayerContext(ws) {
  const entry = playersBySocket.get(ws);
  if (!entry) return null;
  const room = rooms.get(entry.roomId);
  if (!room) return null;
  return { ...entry, room };
}

function isWaitingPlayer(ws) {
  return waitingPlayers.some((entry) => entry.ws === ws);
}

function removeWaitingPlayer(ws) {
  const index = waitingPlayers.findIndex((entry) => entry.ws === ws);
  if (index === -1) return false;
  const removed = waitingPlayers.splice(index, 1)[0];
  logInfo("RANDOM_CANCEL", `${removed.playerName} removed queue size=${waitingPlayers.length}`);
  return true;
}

function cleanupWaitingPlayers() {
  for (let i = waitingPlayers.length - 1; i >= 0; i -= 1) {
    if (waitingPlayers[i].ws.readyState !== WebSocket.OPEN) {
      waitingPlayers.splice(i, 1);
    }
  }
}

function sanitizeName(name) {
  const value = String(name || "").trim();
  if (!value) return "";
  return value.slice(0, 20);
}

function validateCommands(commands) {
  return commands.length === 3 && commands.every((cmd) => VALID_SKILLS.includes(cmd));
}

function generateRoomId() {
  let roomId = "";
  do {
    roomId = "";
    for (let i = 0; i < ROOM_ID_LENGTH; i += 1) {
      roomId += ROOM_ID_CHARS[Math.floor(Math.random() * ROOM_ID_CHARS.length)];
    }
  } while (rooms.has(roomId));
  return roomId;
}

function send(ws, type, payload = {}) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

function broadcast(room, type, payload = {}) {
  room.players.forEach((player) => send(player.ws, type, payload));
}

function sendError(ws, message) {
  send(ws, MSG.ERROR, { message });
  logError("ERROR", message);
}

function sendMatchError(ws, message) {
  send(ws, MSG.MATCH_ERROR, { message });
  logError("MATCH_ERROR", message);
}

function logInfo(scope, message) {
  console.log(`[${scope}] ${message}`);
}

function logError(scope, message) {
  console.error(`[${scope}] ${message}`);
}
