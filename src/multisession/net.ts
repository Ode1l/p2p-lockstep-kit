import type { GameId, ParticipantId, PeerId } from "./ids";
import { MeshConnectionManager } from "./connection/meshConnection";
import type {
  MultiSessionState,
  Participant,
  PeerConnectionState,
} from "./state/types";
import type { MultiPeerTransport, Unsubscribe } from "./transport/types";
import {
  PROTOCOL_NAME,
  PROTOCOL_VERSION,
} from "../utils/protocol/constants";
import type {
  ProtocolMessage,
  ProtocolMessageType,
} from "../utils/protocol/multisession";

export class NetClient {
  readonly #transport: MultiPeerTransport;
  readonly #localParticipant: Omit<Participant, "joinedAtSeq">;
  readonly #mesh: MeshConnectionManager;
  readonly #ownsTransport: boolean;

  constructor(input: {
    transport: MultiPeerTransport;
    localParticipant: Omit<Participant, "joinedAtSeq">;
    maxConcurrentConnections: number;
    ownsTransport: boolean;
  }) {
    this.#transport = input.transport;
    this.#localParticipant = input.localParticipant;
    this.#ownsTransport = input.ownsTransport;
    this.#mesh = new MeshConnectionManager({
      transport: input.transport,
      localPeerId: input.localParticipant.peerId,
      maxConcurrentConnections: input.maxConcurrentConnections,
    });
  }

  onMessage(handler: (peerId: PeerId, message: unknown) => void): Unsubscribe {
    return this.#transport.onMessage(handler);
  }

  onPeerStateChange(
    handler: (peerId: PeerId, state: PeerConnectionState) => void,
  ): Unsubscribe {
    return this.#transport.onPeerStateChange(handler);
  }

  getPeerState(peerId: PeerId): PeerConnectionState {
    return this.#mesh.getPeerState(peerId);
  }

  connect(peerId: PeerId): Promise<void> {
    return this.#transport.connect(peerId);
  }

  connectRequiredPeers<TGameState>(
    state: MultiSessionState<TGameState>,
  ): Promise<ReadonlyMap<ParticipantId, PeerConnectionState>> {
    return this.#mesh.connectRequiredPeers(state);
  }

  sendTo<TGameState>(
    state: MultiSessionState<TGameState>,
    peerId: PeerId,
    type: ProtocolMessageType,
    payload: unknown,
    senderParticipantId: ParticipantId | null = state.localParticipantId,
    gameScope: GameId = state.gameId,
  ): void {
    this.#transport.sendTo(
      peerId,
      this.message(state, type, payload, senderParticipantId, gameScope),
    );
  }

  broadcast<TGameState>(
    state: MultiSessionState<TGameState>,
    type: ProtocolMessageType,
    payload: unknown,
    except?: ReadonlySet<PeerId>,
    gameScope: GameId = state.gameId,
  ): void {
    const message = this.message(
      state,
      type,
      payload,
      state.localParticipantId,
      gameScope,
    );
    for (const participant of state.participants.values()) {
      if (participant.id === state.localParticipantId) continue;
      if (except?.has(participant.peerId)) continue;
      if (this.getPeerState(participant.peerId) !== "connected") continue;
      this.#transport.sendTo(participant.peerId, message);
    }
  }

  message<TGameState>(
    state: MultiSessionState<TGameState>,
    type: ProtocolMessageType,
    payload: unknown,
    senderParticipantId: ParticipantId | null = state.localParticipantId,
    gameScope: GameId = state.gameId,
  ): ProtocolMessage {
    return {
      protocol: PROTOCOL_NAME,
      version: PROTOCOL_VERSION,
      type,
      hostPeerId: state.hostPeerId,
      gameId: gameScope,
      senderParticipantId,
      senderPeerId: this.#localParticipant.peerId,
      payload,
    } as ProtocolMessage;
  }

  dispose(): void {
    if (this.#ownsTransport) this.#transport.dispose();
  }
}

export const createNetClient = (
  input: ConstructorParameters<typeof NetClient>[0],
): NetClient => new NetClient(input);
