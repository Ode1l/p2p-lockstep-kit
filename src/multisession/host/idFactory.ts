import { gameId, type GameId } from "../ids";
import { createRandomId } from "../../utils/randomId";

export interface IdFactory {
  eventId(): string;
  gameId(): GameId;
}

export const createIdFactory = (): IdFactory => ({
  eventId: () => `event-${createRandomId()}`,
  gameId: () => gameId(`game-${createRandomId()}`),
});
