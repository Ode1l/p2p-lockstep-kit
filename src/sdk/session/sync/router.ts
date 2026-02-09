// Message Router (sync): dispatches envelopes to session handlers.
// Responsibilities:
// - Route by message type and gate by session id.
// - Keep controller logic narrow by isolating message fan-out.
import type {
  GameEnvelope as Envelope,
  ReadyPayload,
  StartPayload,
  UndoPayload,
  RestartPayload,
  ApprovePayload,
  RejectPayload,
  MovePayload,
  RejoinPayload,
  SyncStatePayload,
  HelloPayload,
} from "../../protocol";

type RouterDeps = {
  sid: string;
  onHello: (payload: HelloPayload) => void;
  onReady: (payload: ReadyPayload) => void;
  onStart: (payload: StartPayload) => void;
  onUndo: (payload: UndoPayload) => Promise<void> | void;
  onRestart: (payload: RestartPayload) => Promise<void> | void;
  onApprove: (payload: ApprovePayload) => void;
  onReject: (payload: RejectPayload) => void;
  onRejoin: (payload: RejoinPayload) => Promise<void> | void;
  onMove: (payload: MovePayload) => void;
  onSyncRequest: () => void;
  onSyncState: (payload: SyncStatePayload) => void;
  afterHandle: () => void;
};

export const createShellRouter = (deps: RouterDeps) => {
  const handleMessage = async (msg: Envelope) => {
    if (msg.sid !== deps.sid) {
      return;
    }
    switch (msg.type) {
      case "HELLO":
        deps.onHello((msg.payload ?? {}) as HelloPayload);
        break;
      case "READY":
        deps.onReady((msg.payload ?? {}) as ReadyPayload);
        break;
      case "START":
        deps.onStart((msg.payload ?? {}) as StartPayload);
        break;
      case "UNDO":
        await deps.onUndo((msg.payload ?? {}) as UndoPayload);
        break;
      case "RESTART":
        await deps.onRestart((msg.payload ?? {}) as RestartPayload);
        break;
      case "APPROVE":
        deps.onApprove((msg.payload ?? {}) as ApprovePayload);
        break;
      case "REJECT":
        deps.onReject((msg.payload ?? {}) as RejectPayload);
        break;
      case "REJOIN":
        await deps.onRejoin((msg.payload ?? {}) as RejoinPayload);
        break;
      case "MOVE":
        deps.onMove((msg.payload ?? {}) as MovePayload);
        break;
      case "SYNC_REQUEST":
        deps.onSyncRequest();
        break;
      case "SYNC_STATE":
        deps.onSyncState((msg.payload ?? {}) as SyncStatePayload);
        break;
      default:
        break;
    }
    deps.afterHandle();
  };

  return { handleMessage };
};
