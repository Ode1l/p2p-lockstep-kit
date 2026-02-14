import type { Logger, MessageType } from "../../utils";
import type { CommandOrigin } from "../commandRegistry";

export type SessionPhase = "OFFLINE" | "WAITING" | "READY" | "GAMING";

export type SessionFsm = {
  getPhase: () => SessionPhase;
  onConnected: () => void;
  onDisconnected: () => void;
  onReadyStateChange: (ready: { self: boolean; peer: boolean }, reason?: string) => void;
  onMatchStart: (reason?: string) => void;
  onMatchEnd: (reason?: string) => void;
  guard: (type: MessageType, origin: CommandOrigin) => { ok: boolean; reason?: string };
};

type GuardRules = Partial<Record<MessageType, SessionPhase[] | "*">>;

const WAITING_OR_READY: SessionPhase[] = ["WAITING", "READY"];
const ACTIVE_STATES: SessionPhase[] = ["WAITING", "READY", "GAMING"];
const IN_GAME_ONLY: SessionPhase[] = ["GAMING"];

const LOCAL_RULES: GuardRules = {
  READY: WAITING_OR_READY,
  START: ["READY"],
  UNDO: IN_GAME_ONLY,
  RESTART: WAITING_OR_READY,
  MOVE: IN_GAME_ONLY,
};

const REMOTE_RULES: GuardRules = {
  READY: WAITING_OR_READY,
  START: ["READY"],
  UNDO: IN_GAME_ONLY,
  MOVE: IN_GAME_ONLY,
  RESTART: WAITING_OR_READY,
  APPROVE: ACTIVE_STATES,
  REJECT: ACTIVE_STATES,
  REJOIN: ACTIVE_STATES,
  SYNC_REQUEST: ACTIVE_STATES,
  SYNC_STATE: ACTIVE_STATES,
};

const LOCAL_REASONS: Partial<Record<MessageType, string>> = {
  READY: "Ready/Unready is only available while in the lobby.",
  START: "Both players must be ready before starting.",
  MOVE: "The game has not started yet.",
  UNDO: "Undo can only be requested during a game.",
  RESTART: "Restart is only available from the lobby.",
};

const defaultReasonForPhase = (phase: SessionPhase) => {
  switch (phase) {
    case "OFFLINE":
      return "Connect to a peer first.";
    case "GAMING":
      return "A match is already in progress.";
    default:
      return "Action is not allowed right now.";
  }
};

const isAllowed = (
  rules: GuardRules,
  type: MessageType,
  phase: SessionPhase,
): boolean => {
  const allowed = rules[type];
  if (!allowed) {
    return true;
  }
  if (allowed === "*") {
    return true;
  }
  return allowed.includes(phase);
};

export const createSessionFsm = (deps: { logger: Logger }): SessionFsm => {
  const { logger } = deps;
  let phase: SessionPhase = "OFFLINE";
  let connected = false;
  let readyState: { self: boolean; peer: boolean } = { self: false, peer: false };

  const transition = (next: SessionPhase, reason?: string) => {
    if (phase === next) {
      return;
    }
    phase = next;
    logger.info("[session:fsm] transition", { next, reason });
  };

  const evaluateReady = (reason?: string, force = false) => {
    if (!connected) {
      return;
    }
    if (!force && phase === "GAMING") {
      return;
    }
    const next = readyState.self && readyState.peer ? "READY" : "WAITING";
    transition(next, reason);
  };

  const onConnected = () => {
    connected = true;
    if (phase === "GAMING") {
      return;
    }
    evaluateReady("connected");
  };

  const onDisconnected = () => {
    connected = false;
    transition("OFFLINE", "disconnected");
  };

  const onReadyStateChange = (
    ready: { self: boolean; peer: boolean },
    reason?: string,
  ) => {
    readyState = ready;
    evaluateReady(reason ?? "ready-change");
  };

  const onMatchStart = (reason?: string) => {
    if (!connected) {
      connected = true;
    }
    transition("GAMING", reason ?? "match-start");
  };

  const onMatchEnd = (reason?: string) => {
    if (!connected) {
      transition("OFFLINE", reason ?? "match-end-offline");
      return;
    }
    evaluateReady(reason ?? "match-end", true);
  };

  const guard = (type: MessageType, origin: CommandOrigin) => {
    const ok = isAllowed(origin === "local" ? LOCAL_RULES : REMOTE_RULES, type, phase);
    if (ok) {
      return { ok: true };
    }
    const reason =
      origin === "local"
        ? LOCAL_REASONS[type] ?? defaultReasonForPhase(phase)
        : `Dropping ${type} while session state is ${phase}`;
    return { ok: false, reason };
  };

  return {
    getPhase: () => phase,
    onConnected,
    onDisconnected,
    onReadyStateChange,
    onMatchStart,
    onMatchEnd,
    guard,
  };
};
