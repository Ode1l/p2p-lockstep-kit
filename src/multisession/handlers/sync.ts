import type { EventIngestResult, OrderedEvent } from "../state/events";
import type { PeerId } from "../ids";
import type { SessionContext } from "../context";
import type { JsonValue } from "../../utils/serialization/json";

export class SyncHandler<
  TCommand extends JsonValue,
  TEventPayload extends JsonValue,
  TGameState,
  TGameSnapshot extends JsonValue,
> {
  readonly #context: SessionContext<
    TCommand,
    TEventPayload,
    TGameState,
    TGameSnapshot
  >;

  constructor(
    context: SessionContext<
      TCommand,
      TEventPayload,
      TGameState,
      TGameSnapshot
    >,
  ) {
    this.#context = context;
  }

  async resumeConnections(): Promise<void> {
    await this.connectRequiredPeers();
    if (this.finishConnectionSyncIfReady()) this.#context.notify();
  }

  finishConnectionSyncIfReady(): boolean {
    const state = this.#context.state.getState();
    if (!state.meshReady || state.phase !== "syncing") return false;
    if (this.#context.isHost) {
      this.#context.state.completeConnectionSync();
      return true;
    }
    this.requestSync();
    return false;
  }

  async applyEvents(
    events: readonly OrderedEvent[],
    sourcePeerId: PeerId,
  ): Promise<void> {
    for (const event of events) {
      const result = this.#context.state.ingest(event);
      if (result.status === "gap") {
        this.#context.notify();
        this.requestSync();
        return;
      }
      if (result.status === "rejected") {
        this.failFromIngest(result, sourcePeerId);
        return;
      }
      if (result.status === "applied") {
        this.#context.notify();
      }
    }
  }

  async replaceFromRecord(events: readonly OrderedEvent[]): Promise<void> {
    this.#context.state.replaceRecord(events);
    for (const participant of this.#context.state.getState().participants.values()) {
      const connection =
        participant.id === this.#context.state.getState().localParticipantId
          ? "connected"
          : this.#context.net.getPeerState(participant.peerId);
      this.#context.state.updateConnection(participant.id, connection);
    }
    this.#context.state.markRecordSynchronized();
    this.#context.notify();
  }

  async restoreFromHostRecord(events: readonly OrderedEvent[]): Promise<void> {
    await this.replaceFromRecord(events);
    await this.connectRequiredPeers();
    this.#context.state.completeConnectionSync();
    this.#context.notify();
  }

  async connectRequiredPeers(): Promise<void> {
    const connections = await this.#context.net.connectRequiredPeers(
      this.#context.state.getState(),
    );
    for (const [participantId, connection] of connections) {
      this.#context.state.updateConnection(participantId, connection);
    }
    this.#context.notify();
  }

  requestSync(): void {
    const state = this.#context.state.getState();
    const host = state.participants.get(state.hostId);
    if (!host || host.id === state.localParticipantId) return;
    this.#context.net.sendTo(state, host.peerId, "SYNC_REQUEST", {
      lastAppliedSeq: state.lastAppliedSeq,
    });
  }

  failFromIngest(
    result: Extract<EventIngestResult, { status: "rejected" }>,
    peerId: PeerId,
  ): void {
    const code =
      result.code === "sequence_conflict"
        ? "sequence_conflict"
        : "invalid_event";
    this.#context.fail({ code, message: result.message, peerId });
  }
}
