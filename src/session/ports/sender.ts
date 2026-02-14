import { createEnvelope, type NetAdapter } from "../net";
import type { GameMove, GameStatus } from "../../game/types";
import type {
  GameMessageType,
  MovePayload,
  RejectPayload,
  ReadyPayload,
  SessionMessageType,
  StartPayload,
  SyncStatePayload,
} from "../../utils";

export const createMessageSender = (deps: {
  sid: string;
  net: NetAdapter;
  getStatus: () => GameStatus;
  getPeerId: () => string;
  getHash: () => string;
  getSnapshot: () => unknown;
  nextSeq: () => number;
}) => {
  const { sid, net, getStatus, getPeerId, getHash, getSnapshot, nextSeq } = deps;

  const sendSession = <T>(
    type: SessionMessageType,
    payload?: T,
    meta?: { turn?: number; stateHash?: string },
  ) => {
    const peerId = getPeerId();
    if (!peerId) {
      return;
    }
    net.send(
      createEnvelope({
        domain: "session",
        type,
        sid,
        from: peerId,
        seq: nextSeq(),
        turn: meta?.turn,
        stateHash: meta?.stateHash,
        payload,
      }),
    );
  };

  const sendGame = <T>(
    type: GameMessageType,
    payload?: T,
    meta?: { turn?: number; stateHash?: string },
  ) => {
    const peerId = getPeerId();
    if (!peerId) {
      return;
    }
    net.send(
      createEnvelope({
        domain: "game",
        type,
        from: peerId,
        seq: nextSeq(),
        turn: meta?.turn,
        stateHash: meta?.stateHash,
        payload,
      }),
    );
  };

  const sendSyncRequest = () => {
    sendSession("SYNC_REQUEST");
  };

  const sendSyncState = () => {
    const payload: SyncStatePayload = {
      state: getSnapshot(),
    };
    sendSession("SYNC_STATE", payload);
  };

  const sendMove = (move: GameMove) => {
    const payload: MovePayload = {
      x: move.x,
      y: move.y,
      player: move.player,
    };
    sendGame("MOVE", payload, { turn: move.turn, stateHash: getHash() });
  };

  const sendReject = (action: RejectPayload["action"], reason: string, stateHash?: string) => {
    const payload: RejectPayload = { action, reason };
    const status = getStatus();
    sendSession("REJECT", payload, {
      turn: status.turn,
      stateHash: stateHash ?? getHash(),
    });
  };

  const sendApprove = () => {
    sendSession("APPROVE");
  };

  const sendReady = (ready: boolean) => {
    const payload: ReadyPayload = { ready };
    sendSession("READY", payload);
  };

  const sendStart = (payload: StartPayload) => {
    sendSession("START", payload);
  };

  const sendUndo = (count: 1 | 2) => {
    sendSession("UNDO", { count });
  };

  const sendRestart = () => {
    sendSession("RESTART");
  };

  const sendRejoin = (turn: number, cacheHash: string) => {
    sendSession("REJOIN", undefined, { turn, stateHash: cacheHash });
  };

  return {
    sendSyncRequest,
    sendSyncState,
    sendMove,
    sendReject,
    sendApprove,
    sendReady,
    sendStart,
    sendUndo,
    sendRestart,
    sendRejoin,
  };
};
