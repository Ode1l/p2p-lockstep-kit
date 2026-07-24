import {
  EndpointMeshTransport,
  NetworkEndpoint,
  createMultiSession,
  gameId,
  participantId,
  peerId,
  proposalId,
  type JsonValue,
  type MultiSession,
  type ParticipantId,
  type PeerId,
  type SeatSelector,
} from "p2p-lockstep-kit-multisession";
import { DISPLAY_NAME_MAX_LENGTH } from "../config.js";
import type {
  MultiTableController,
  MultiTableView,
  MultiUiOptions,
  MultiUiRuntime,
} from "../types.js";

export const selectRandomSeat: SeatSelector = ({ availableSeatIds }) => {
  const values = new Uint32Array(1);
  const random = globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(values)[0]!
    : Math.floor(Math.random() * 2 ** 32);
  return availableSeatIds[random % availableSeatIds.length]!;
};

export class LiveTableController<
  TCommand extends JsonValue,
  TGameSnapshot extends JsonValue,
> implements MultiTableController<TCommand, TGameSnapshot>
{
  readonly runtime: MultiUiRuntime<TCommand, TGameSnapshot>;
  readonly #session: MultiSession<TCommand, TGameSnapshot>;
  readonly #localParticipantId: ParticipantId;
  readonly #listeners = new Set<
    (view: MultiTableView<TGameSnapshot>) => void
  >();
  readonly #unsubscribe: () => void;
  #view: MultiTableView<TGameSnapshot> | null = null;
  #disposed = false;

  private constructor(input: {
    session: MultiSession<TCommand, TGameSnapshot>;
    localParticipantId: ParticipantId;
    localPeerId: PeerId;
    hostPeerId: PeerId;
  }) {
    this.#session = input.session;
    this.runtime = Object.freeze({
      actions: input.session.actions,
      observer: input.session.observer,
    });
    this.#localParticipantId = input.localParticipantId;
    this.#unsubscribe = input.session.observer.subscribe({
      onStateChange: (snapshot) => {
        this.#emit({
          snapshot,
          events: snapshot.history,
          localPeerId: input.localPeerId,
          hostPeerId: input.hostPeerId,
          error: snapshot.state.protocolError?.message ?? null,
        });
      },
    });
  }

  static async create<
    TCommand extends JsonValue,
    TEventPayload extends JsonValue,
    TGameState,
    TGameSnapshot extends JsonValue,
  >(
    options: MultiUiOptions<
      TCommand,
      TEventPayload,
      TGameState,
      TGameSnapshot
    >,
  ): Promise<
    LiveTableController<
      TCommand,
      TGameSnapshot
    >
  > {
    const endpoint = new NetworkEndpoint<PeerId>();
    let controller: LiveTableController<
      TCommand,
      TGameSnapshot
    > | null = null;
    try {
      const { peerId: localPeerId } = await endpoint.register(
        options.signalUrl ?? "wss://signal.jiahengli.xyz",
      );
      const requestedHostPeerId = options.hostPeerId
        ? peerId(options.hostPeerId.trim())
        : null;
      if (requestedHostPeerId === localPeerId) {
        throw new Error(
          "这是你自己的邀请链接，请使用另一个浏览器配置文件加入",
        );
      }
      const isHost = requestedHostPeerId === null;
      const hostPeerId = requestedHostPeerId ?? localPeerId;
      const localParticipantId = participantId(
        `participant-${localPeerId}`,
      );
      const hostId = participantId(`participant-${hostPeerId}`);
      const displayName = options.displayName?.trim() ?? "";
      if (!displayName || displayName.length > DISPLAY_NAME_MAX_LENGTH) {
        throw new Error(
          `玩家名称必须为 1–${DISPLAY_NAME_MAX_LENGTH} 个字符`,
        );
      }
      const transport = new EndpointMeshTransport(endpoint);
      const session = createMultiSession<
        TCommand,
        TEventPayload,
        TGameState,
        TGameSnapshot
      >({
        gameId: gameId(String(hostPeerId)),
        localParticipant: {
          id: localParticipantId,
          peerId: localPeerId,
          displayName,
        },
        hostId,
        hostPeerId,
        configuration: options.game.configuration,
        plugin: options.game.plugin,
        transport,
        ownsTransport: true,
        selectSeat: options.game.selectSeat ?? selectRandomSeat,
      });
      controller = new LiveTableController({
        session,
        localParticipantId,
        localPeerId,
        hostPeerId,
      });
      await session.start();
      if (!isHost) await session.actions.join({ displayName });
      return controller;
    } catch (error) {
      if (controller) controller.dispose();
      else endpoint.dispose();
      throw error;
    }
  }

  subscribe(
    handler: (view: MultiTableView<TGameSnapshot>) => void,
  ): () => void {
    this.#listeners.add(handler);
    if (this.#view) handler(this.#view);
    return () => this.#listeners.delete(handler);
  }

  async setDisplayName(displayName: string): Promise<void> {
    await this.#session.actions.setDisplayName(displayName);
  }

  async ready(): Promise<void> {
    await this.#session.actions.ready();
  }

  async start(): Promise<void> {
    await this.#session.actions.start();
  }

  async restart(): Promise<void> {
    const pending = this.#session.observer.getSnapshot()?.state.pendingRestart;
    if (!pending) {
      await this.#session.actions.proposeRestart(
        proposalId(`multiui-restart-${Date.now()}`),
      );
      return;
    }
    if (!pending.votes.has(this.#localParticipantId)) {
      await this.#session.actions.voteRestart(pending.id, true);
    }
  }

  async resume(): Promise<void> {
    await this.#session.actions.resume();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#unsubscribe();
    this.#session.dispose();
    this.#listeners.clear();
  }

  #emit(view: MultiTableView<TGameSnapshot>): void {
    this.#view = view;
    for (const listener of [...this.#listeners]) listener(view);
  }
}
