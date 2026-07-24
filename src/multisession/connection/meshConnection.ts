import type { ParticipantId, PeerId } from "../ids";
import type {
  MultiSessionState,
  PeerConnectionState,
} from "../state/types";
import type { MultiPeerTransport } from "../transport/types";

export class MeshConnectionManager {
  readonly #transport: MultiPeerTransport;
  readonly #localPeerId: PeerId;
  readonly #maxConcurrentConnections: number;

  constructor(input: {
    transport: MultiPeerTransport;
    localPeerId: PeerId;
    maxConcurrentConnections: number;
  }) {
    this.#transport = input.transport;
    this.#localPeerId = input.localPeerId;
    this.#maxConcurrentConnections = input.maxConcurrentConnections;
  }

  async connectRequiredPeers<TGameState>(
    state: MultiSessionState<TGameState>,
  ): Promise<ReadonlyMap<ParticipantId, PeerConnectionState>> {
    const peers = [...state.participants.values()]
      .filter(
        (participant) =>
          participant.id !== state.localParticipantId &&
          this.#transport.getPeerState(participant.peerId) !== "connected" &&
          this.#localPeerId < participant.peerId,
      )
      .map((participant) => participant.peerId);
    let cursor = 0;
    const worker = async () => {
      while (cursor < peers.length) {
        const peer = peers[cursor++];
        if (!peer) continue;
        try {
          await this.#transport.connect(peer);
        } catch {
          // A failed link is transport state, not a protocol violation. Keep
          // building the remaining links and let resume() retry this peer.
        }
      }
    };
    await Promise.all(
      Array.from(
        {
          length: Math.min(this.#maxConcurrentConnections, peers.length),
        },
        worker,
      ),
    );

    return new Map(
      [...state.participants.values()].map((participant) => [
        participant.id,
        participant.id === state.localParticipantId
          ? "connected"
          : this.#transport.getPeerState(participant.peerId),
      ]),
    );
  }

  getPeerState(peerId: PeerId): PeerConnectionState {
    return this.#transport.getPeerState(peerId);
  }
}
