import { failure, success, type Result } from "../../utils/result";

declare const identifierBrand: unique symbol;
type Identifier<Name extends string> = string & {
  readonly [identifierBrand]: Name;
};

export type GameId = Identifier<"GameId">;
export type ParticipantId = Identifier<"ParticipantId">;
export type PeerId = Identifier<"PeerId">;
export type SeatId = Identifier<"SeatId">;
export type ProposalId = Identifier<"ProposalId">;

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~:-]{0,127}$/;

const parseIdentifier = <T extends string>(
  value: unknown,
  label: string,
): Result<T> => {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    return failure(
      `${label} must be 1-128 URL-safe ASCII characters and start with an alphanumeric character`,
    );
  }
  return success(value as T);
};

const createParser = <T extends string>(label: string) => (value: unknown) =>
  parseIdentifier<T>(value, label);

const createConstructor = <T extends string>(label: string) =>
  (value: string): T => {
    const parsed = parseIdentifier<T>(value, label);
    if (!parsed.ok) throw new TypeError(parsed.error);
    return parsed.value;
  };

export const parseGameId = createParser<GameId>("GameId");
export const parseParticipantId = createParser<ParticipantId>("ParticipantId");
export const parsePeerId = createParser<PeerId>("PeerId");
export const parseSeatId = createParser<SeatId>("SeatId");
export const parseProposalId = createParser<ProposalId>("ProposalId");

export const gameId = createConstructor<GameId>("GameId");
export const participantId = createConstructor<ParticipantId>("ParticipantId");
export const peerId = createConstructor<PeerId>("PeerId");
export const seatId = createConstructor<SeatId>("SeatId");
export const proposalId = createConstructor<ProposalId>("ProposalId");
