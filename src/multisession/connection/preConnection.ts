import type { ParticipantId, PeerId, SeatId } from "../ids";
import type { MultiSessionState, Participant } from "../state/types";

export interface SeatSelectionContext {
  readonly availableSeatIds: readonly SeatId[];
  readonly participant: Omit<Participant, "joinedAtSeq">;
}

export type SeatSelector = (context: SeatSelectionContext) => SeatId;

export class PreConnectionManager<TGameState> {
  readonly #selectSeat: SeatSelector | undefined;

  constructor(selectSeat?: SeatSelector) {
    this.#selectSeat = selectSeat;
  }

  canAcceptParticipant(state: MultiSessionState<TGameState>): boolean {
    return (
      state.phase !== "playing" &&
      state.participants.size < state.configuration.participantCount
    );
  }

  createParticipant(input: {
    participantId: ParticipantId;
    peerId: PeerId;
    displayName?: string;
  }): Omit<Participant, "joinedAtSeq"> {
    return {
      id: input.participantId,
      peerId: input.peerId,
      ...(input.displayName === undefined
        ? {}
        : { displayName: input.displayName }),
    };
  }

  participantForPeer(
    state: MultiSessionState<TGameState>,
    peerId: PeerId,
  ): Participant | null {
    return (
      [...state.participants.values()].find(
        (participant) => participant.peerId === peerId,
      ) ?? null
    );
  }

  selectAvailableSeat(
    state: MultiSessionState<TGameState>,
    participant: Omit<Participant, "joinedAtSeq">,
  ): SeatId {
    const availableSeatIds = [...state.seats]
      .filter(([, occupant]) => occupant === null)
      .map(([seatId]) => seatId);
    const fallback = availableSeatIds[0];
    if (!fallback) throw new Error("no seat available");
    const selected =
      this.#selectSeat?.({
        availableSeatIds: Object.freeze([...availableSeatIds]),
        participant,
      }) ?? fallback;
    if (!availableSeatIds.includes(selected)) {
      throw new Error("selectSeat must return an available seat");
    }
    return selected;
  }
}
