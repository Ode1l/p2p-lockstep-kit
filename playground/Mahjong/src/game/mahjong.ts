import {
  failure,
  success,
  type GameEventSpec,
  type JsonObject,
  type MultiGamePlugin,
  type ParticipantId,
  type Result,
} from "p2p-lockstep-kit-multisession";
import {
  analyzeWinningHand,
  buildSichuanWall,
  isMahjongSuit,
  isValidExchangeSelection,
  scoreWinningHand,
  sortMahjongTiles,
  type MahjongSuit,
  type MahjongTileShape,
} from "./mahjongRules";

export interface MahjongTile extends JsonObject, MahjongTileShape {}

export type { MahjongSuit } from "./mahjongRules";

export interface MahjongDiscard extends JsonObject {
  readonly participantId: ParticipantId;
  readonly tile: MahjongTile;
  readonly turn: number;
  readonly claimedBy: readonly ParticipantId[];
}

export interface MahjongMeld extends JsonObject {
  readonly kind: "peng" | "gang";
  readonly gangType: "exposed" | "concealed" | "added" | null;
  readonly tiles: readonly MahjongTile[];
  readonly fromParticipantId: ParticipantId;
}

export interface MahjongResponseOffer extends JsonObject {
  readonly participantId: ParticipantId;
  readonly canHu: boolean;
  readonly canPeng: boolean;
  readonly canGang: boolean;
}

export interface MahjongPendingResponse extends JsonObject {
  readonly source: "discard" | "addedGang";
  readonly stage: "hu" | "claim";
  readonly discardedBy: ParticipantId;
  readonly tile: MahjongTile;
  readonly offers: readonly MahjongResponseOffer[];
  readonly offerIndex: number;
  readonly acceptedHu: readonly ParticipantId[];
  readonly addedGangMeldIndex: number | null;
}

export interface MahjongWinner extends JsonObject {
  readonly participantId: ParticipantId;
  readonly method: "discard" | "selfDraw" | "robKong";
  readonly tile: MahjongTile;
  readonly fan: number;
  readonly points: number;
  readonly patterns: readonly string[];
  readonly turn: number;
}

export interface MahjongSettlement extends JsonObject {
  readonly kind: "hu" | "gang";
  readonly fromParticipantId: ParticipantId;
  readonly toParticipantId: ParticipantId;
  readonly points: number;
  readonly reason: string;
  readonly turn: number;
}

export interface MahjongSnapshot extends JsonObject {
  readonly phase: "exchange" | "dingque" | "playing" | "responding" | "ended";
  readonly order: readonly ParticipantId[];
  readonly hands: Readonly<Record<string, readonly MahjongTile[]>>;
  readonly melds: Readonly<Record<string, readonly MahjongMeld[]>>;
  readonly wall: readonly MahjongTile[];
  readonly wallIndex: number;
  readonly dealerId: ParticipantId;
  readonly currentParticipantId: ParticipantId;
  readonly exchangeDirection: ExchangeDirection;
  readonly exchangeSelections: Readonly<Record<string, readonly string[]>>;
  readonly missingSuits: Readonly<Record<string, MahjongSuit>>;
  readonly pendingResponse: MahjongPendingResponse | null;
  readonly winners: readonly MahjongWinner[];
  readonly scoreByParticipant: Readonly<Record<string, number>>;
  readonly settlements: readonly MahjongSettlement[];
  readonly drawnTileId: string | null;
  readonly lastDrawWasReplacement: boolean;
  readonly discards: readonly MahjongDiscard[];
  readonly turn: number;
}

export type MahjongState = MahjongSnapshot;

export type ExchangeDirection = "clockwise" | "opposite" | "counterclockwise";

export type MahjongCommand =
  | (JsonObject & {
      readonly kind: "exchange";
      readonly tileIds: readonly string[];
    })
  | (JsonObject & {
      readonly kind: "chooseMissing";
      readonly suit: MahjongSuit;
    })
  | (JsonObject & {
      readonly kind: "discard";
      readonly tileId: string;
    })
  | (JsonObject & {
      readonly kind: "pass";
    })
  | (JsonObject & {
      readonly kind: "peng";
    })
  | (JsonObject & {
      readonly kind: "gang";
      readonly tileId?: string;
    })
  | (JsonObject & {
      readonly kind: "hu";
    });

export type MahjongEventPayload = MahjongCommand;

const exchangeDirections: readonly ExchangeDirection[] = [
  "clockwise",
  "opposite",
  "counterclockwise",
];

const randomIndex = (maxExclusive: number): number => {
  if (maxExclusive <= 1) return 0;
  const crypto = globalThis.crypto;
  if (crypto) {
    const value = crypto.getRandomValues(new Uint32Array(1))[0]!;
    return value % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
};

const shuffledWallIds = (): readonly string[] => {
  const ids = buildSichuanWall().map((tile) => tile.id);
  const ordered = ids.join("|");
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [ids[index], ids[swapIndex]] = [ids[swapIndex]!, ids[index]!];
  }
  if (ids.join("|") === ordered) {
    [ids[0], ids[1]] = [ids[1]!, ids[0]!];
  }
  return ids;
};

const toMahjongTile = (tile: MahjongTileShape): MahjongTile => ({
  id: tile.id,
  suit: tile.suit,
  rank: tile.rank,
  label: tile.label,
});

const wallFromStartPayload = (payload: unknown): MahjongTile[] | null => {
  if (!isRecord(payload) || !Array.isArray(payload.wall)) return null;
  const ids = payload.wall;
  if (!ids.every((id): id is string => typeof id === "string")) return null;
  const baseWall = buildSichuanWall();
  if (ids.length !== baseWall.length || new Set(ids).size !== ids.length) {
    return null;
  }
  const byId = new Map(baseWall.map((tile) => [tile.id, tile]));
  const wall: MahjongTile[] = [];
  for (const id of ids) {
    const tile = byId.get(id);
    if (!tile) return null;
    wall.push(toMahjongTile(tile));
  }
  return wall;
};

const directionFromStartPayload = (payload: unknown): ExchangeDirection => {
  if (!isRecord(payload)) return "clockwise";
  const direction = payload.exchangeDirection;
  return exchangeDirections.includes(direction as ExchangeDirection)
    ? direction as ExchangeDirection
    : "clockwise";
};

const cloneState = (state: MahjongState): MahjongState => ({
  ...state,
  order: [...state.order],
  hands: Object.fromEntries(
    Object.entries(state.hands).map(([id, hand]) => [
      id,
      hand.map((tile) => ({ ...tile })),
    ]),
  ),
  melds: Object.fromEntries(
    Object.entries(state.melds).map(([id, melds]) => [
      id,
      melds.map((meld) => ({
        ...meld,
        tiles: meld.tiles.map((tile) => ({ ...tile })),
      })),
    ]),
  ),
  wall: state.wall.map((tile) => ({ ...tile })),
  exchangeSelections: Object.fromEntries(
    Object.entries(state.exchangeSelections).map(([id, tileIds]) => [id, [...tileIds]]),
  ),
  missingSuits: { ...state.missingSuits },
  pendingResponse: state.pendingResponse
    ? {
        ...state.pendingResponse,
        tile: { ...state.pendingResponse.tile },
        offers: state.pendingResponse.offers.map((offer) => ({ ...offer })),
        acceptedHu: [...state.pendingResponse.acceptedHu],
      }
    : null,
  winners: state.winners.map((winner) => ({
    ...winner,
    tile: { ...winner.tile },
    patterns: [...winner.patterns],
  })),
  scoreByParticipant: { ...state.scoreByParticipant },
  settlements: state.settlements.map((settlement) => ({ ...settlement })),
  discards: state.discards.map((discard) => ({
    ...discard,
    tile: { ...discard.tile },
    claimedBy: [...discard.claimedBy],
  })),
});

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const nextUnsubmitted = (
  order: readonly ParticipantId[],
  submitted: Readonly<Record<string, unknown>>,
): ParticipantId | null => order.find((id) => submitted[id] === undefined) ?? null;

const exchangedHands = (
  state: MahjongState,
  selections: Readonly<Record<string, readonly string[]>>,
): Readonly<Record<string, readonly MahjongTile[]>> => {
  const hands: Record<string, MahjongTile[]> = {};
  for (const id of state.order) {
    const selected = new Set(selections[id] ?? []);
    hands[id] = state.hands[id]!.filter((tile) => !selected.has(tile.id));
  }
  const offset = state.exchangeDirection === "clockwise"
    ? 1
    : state.exchangeDirection === "counterclockwise" ? -1 : 2;
  state.order.forEach((giverId, index) => {
    const recipientIndex = (index + offset + state.order.length) % state.order.length;
    const recipientId = state.order[recipientIndex]!;
    const selected = new Set(selections[giverId] ?? []);
    hands[recipientId]!.push(
      ...state.hands[giverId]!.filter((tile) => selected.has(tile.id)),
    );
  });
  return Object.fromEntries(
    Object.entries(hands).map(([id, hand]) => [id, sortMahjongTiles(hand)]),
  );
};

const sameTileType = (left: MahjongTile, right: MahjongTile): boolean =>
  left.suit === right.suit && left.rank === right.rank;

const countTileType = (hand: readonly MahjongTile[], target: MahjongTile): number =>
  hand.filter((tile) => sameTileType(tile, target)).length;

const gangOption = (
  state: MahjongState,
  participantId: ParticipantId,
  tileId: string,
): { readonly kind: "concealed" | "added"; readonly tile: MahjongTile; readonly meldIndex: number } | null => {
  const tile = state.hands[participantId]?.find((item) => item.id === tileId);
  if (!tile) return null;
  const meldIndex = state.melds[participantId]!.findIndex(
    (meld) => meld.kind === "peng" && sameTileType(meld.tiles[0]!, tile),
  );
  if (meldIndex >= 0) return { kind: "added", tile, meldIndex };
  return countTileType(state.hands[participantId]!, tile) === 4
    ? { kind: "concealed", tile, meldIndex: -1 }
    : null;
};

const nextParticipant = (
  state: MahjongState,
  participantId: ParticipantId,
): ParticipantId => {
  const index = state.order.indexOf(participantId);
  return state.order[(index + 1) % state.order.length]!;
};

const hasWon = (state: MahjongState, participantId: ParticipantId): boolean =>
  state.winners.some((winner) => winner.participantId === participantId);

const nextActiveParticipant = (
  state: MahjongState,
  participantId: ParticipantId,
): ParticipantId | null => {
  let current = nextParticipant(state, participantId);
  while (current !== participantId) {
    if (!hasWon(state, current)) return current;
    current = nextParticipant(state, current);
  }
  return hasWon(state, participantId) ? null : participantId;
};

const participantsAfter = (
  state: MahjongState,
  participantId: ParticipantId,
): readonly ParticipantId[] => {
  const result: ParticipantId[] = [];
  let current = nextParticipant(state, participantId);
  while (current !== participantId) {
    result.push(current);
    current = nextParticipant(state, current);
  }
  return result;
};

const hasMissingSuitTiles = (state: MahjongState, participantId: ParticipantId): boolean => {
  const suit = state.missingSuits[participantId];
  return suit !== undefined && state.hands[participantId]!.some((tile) => tile.suit === suit);
};

const responseOffers = (
  state: MahjongState,
  discardedBy: ParticipantId,
  tile: MahjongTile,
): readonly MahjongResponseOffer[] => participantsAfter(state, discardedBy)
  .filter((participantId) => !hasWon(state, participantId))
  .map((participantId) => {
    const count = countTileType(state.hands[participantId]!, tile);
    const mayClaim = !hasMissingSuitTiles(state, participantId) &&
      state.missingSuits[participantId] !== tile.suit;
    const canHu = !hasMissingSuitTiles(state, participantId) &&
      state.missingSuits[participantId] !== tile.suit &&
      analyzeWinningHand(
        [...state.hands[participantId]!, tile],
        state.melds[participantId]!.length,
      ).winning;
    return {
      participantId,
      canHu,
      canPeng: mayClaim && count >= 2,
      canGang: mayClaim && count >= 3,
    };
  })
  .filter((offer) => offer.canHu || offer.canPeng || offer.canGang);

const robKongOffers = (
  state: MahjongState,
  participantId: ParticipantId,
  tile: MahjongTile,
): readonly MahjongResponseOffer[] => participantsAfter(state, participantId)
  .filter((id) => !hasWon(state, id) && !hasMissingSuitTiles(state, id))
  .filter((id) => analyzeWinningHand(
    [...state.hands[id]!, tile],
    state.melds[id]!.length,
  ).winning)
  .map((id) => ({ participantId: id, canHu: true, canPeng: false, canGang: false }));

const drawFor = (
  state: MahjongState,
  participantId: ParticipantId,
  replacement = false,
): MahjongState => {
  const draw = state.wall[state.wallIndex];
  if (!draw) {
    return {
      ...state,
      phase: "ended",
      currentParticipantId: participantId,
      pendingResponse: null,
      drawnTileId: null,
      lastDrawWasReplacement: false,
    };
  }
  return {
    ...state,
    phase: "playing",
    hands: {
      ...state.hands,
      [participantId]: sortMahjongTiles([...state.hands[participantId]!, draw]),
    },
    wallIndex: state.wallIndex + 1,
    currentParticipantId: participantId,
    pendingResponse: null,
    drawnTileId: draw.id,
    lastDrawWasReplacement: replacement,
  };
};

const claimLastDiscard = (
  discards: readonly MahjongDiscard[],
  participantId: ParticipantId,
): readonly MahjongDiscard[] => discards.map((discard, index) =>
  index === discards.length - 1
    ? { ...discard, claimedBy: [...discard.claimedBy, participantId] }
    : discard,
);

const nextOfferIndex = (
  pending: MahjongPendingResponse,
  afterIndex: number,
  stage: MahjongPendingResponse["stage"],
): number => pending.offers.findIndex((offer, index) =>
  index > afterIndex && (stage === "hu" ? offer.canHu : offer.canPeng || offer.canGang),
);

const withClaimStageOrDraw = (state: MahjongState): MahjongState => {
  const pending = state.pendingResponse!;
  if (pending.source === "addedGang") return finalizeAddedGang(state);
  const claimIndex = nextOfferIndex(pending, -1, "claim");
  if (claimIndex >= 0) {
    return {
      ...state,
      pendingResponse: { ...pending, stage: "claim", offerIndex: claimIndex },
      currentParticipantId: pending.offers[claimIndex]!.participantId,
    };
  }
  const next = nextActiveParticipant(state, pending.discardedBy);
  return next ? drawFor(state, next) : { ...state, phase: "ended", pendingResponse: null };
};

const applyPayment = (
  scores: Record<string, number>,
  fromParticipantId: ParticipantId,
  toParticipantId: ParticipantId,
  points: number,
): void => {
  scores[fromParticipantId] = (scores[fromParticipantId] ?? 0) - points;
  scores[toParticipantId] = (scores[toParticipantId] ?? 0) + points;
};

const withGangPayments = (
  state: MahjongState,
  toParticipantId: ParticipantId,
  payerIds: readonly ParticipantId[],
  points: number,
  reason: string,
): MahjongState => {
  const scores = { ...state.scoreByParticipant };
  const settlements = [...state.settlements];
  for (const fromParticipantId of payerIds) {
    applyPayment(scores, fromParticipantId, toParticipantId, points);
    settlements.push({
      kind: "gang",
      fromParticipantId,
      toParticipantId,
      points,
      reason,
      turn: state.turn,
    });
  }
  return { ...state, scoreByParticipant: scores, settlements };
};

const finalizeAddedGang = (state: MahjongState): MahjongState => {
  const pending = state.pendingResponse!;
  const participantId = pending.discardedBy;
  const meldIndex = pending.addedGangMeldIndex!;
  const hand = [...state.hands[participantId]!];
  const tileIndex = hand.findIndex((tile) => tile.id === pending.tile.id);
  const [tile] = hand.splice(tileIndex, 1);
  const melds = [...state.melds[participantId]!];
  const peng = melds[meldIndex]!;
  melds[meldIndex] = {
    ...peng,
    kind: "gang",
    gangType: "added",
    tiles: sortMahjongTiles([...peng.tiles, tile!]),
  };
  const completed: MahjongState = {
    ...state,
    phase: "playing",
    hands: { ...state.hands, [participantId]: sortMahjongTiles(hand) },
    melds: { ...state.melds, [participantId]: melds },
    currentParticipantId: participantId,
    pendingResponse: null,
  };
  const payers = state.order.filter((id) => id !== participantId && !hasWon(state, id));
  return drawFor(
    withGangPayments(completed, participantId, payers, 1, "补杠"),
    participantId,
    true,
  );
};

const settleDiscardWins = (state: MahjongState): MahjongState => {
  const pending = state.pendingResponse!;
  const scores = { ...state.scoreByParticipant };
  const hands: Record<string, readonly MahjongTile[]> = { ...state.hands };
  const winners = [...state.winners];
  const settlements = [...state.settlements];
  for (const participantId of pending.acceptedHu) {
    const winningHand = sortMahjongTiles([...state.hands[participantId]!, pending.tile]);
    const robbedKong = pending.source === "addedGang";
    const score = scoreWinningHand(winningHand, state.melds[participantId]!, { robbedKong });
    applyPayment(scores, pending.discardedBy, participantId, score.points);
    hands[participantId] = winningHand;
    winners.push({
      participantId,
      method: robbedKong ? "robKong" : "discard",
      tile: pending.tile,
      fan: score.fan,
      points: score.points,
      patterns: score.patterns,
      turn: state.turn,
    });
    settlements.push({
      kind: "hu",
      fromParticipantId: pending.discardedBy,
      toParticipantId: participantId,
      points: score.points,
      reason: score.patterns.join("、"),
      turn: state.turn,
    });
  }
  if (pending.source === "addedGang") {
    const kongHand = [...hands[pending.discardedBy]!];
    const tileIndex = kongHand.findIndex((tile) => tile.id === pending.tile.id);
    if (tileIndex >= 0) kongHand.splice(tileIndex, 1);
    hands[pending.discardedBy] = sortMahjongTiles(kongHand);
  }
  const settled: MahjongState = {
    ...state,
    hands,
    winners,
    scoreByParticipant: scores,
    settlements,
    discards: pending.source === "discard"
      ? pending.acceptedHu.reduce(
          (discards, participantId) => claimLastDiscard(discards, participantId),
          state.discards,
        )
      : state.discards,
    pendingResponse: null,
  };
  if (winners.length >= 3) return { ...settled, phase: "ended" };
  const next = nextActiveParticipant(settled, pending.discardedBy);
  return next ? drawFor(settled, next) : { ...settled, phase: "ended" };
};

const settleSelfDraw = (state: MahjongState, participantId: ParticipantId): MahjongState => {
  const hand = state.hands[participantId]!;
  const winningTile = hand.find((tile) => tile.id === state.drawnTileId) ?? hand.at(-1)!;
  const score = scoreWinningHand(hand, state.melds[participantId]!, {
    selfDraw: true,
    gangAfterDraw: state.lastDrawWasReplacement,
  });
  const scores = { ...state.scoreByParticipant };
  const settlements = [...state.settlements];
  for (const payerId of state.order) {
    if (payerId === participantId || hasWon(state, payerId)) continue;
    applyPayment(scores, payerId, participantId, score.points);
    settlements.push({
      kind: "hu",
      fromParticipantId: payerId,
      toParticipantId: participantId,
      points: score.points,
      reason: score.patterns.join("、"),
      turn: state.turn,
    });
  }
  const winners: readonly MahjongWinner[] = [
    ...state.winners,
    {
      participantId,
      method: "selfDraw",
      tile: winningTile,
      fan: score.fan,
      points: score.points,
      patterns: score.patterns,
      turn: state.turn,
    },
  ];
  const settled: MahjongState = {
    ...state,
    winners,
    scoreByParticipant: scores,
    settlements,
    drawnTileId: null,
    lastDrawWasReplacement: false,
  };
  if (winners.length >= 3) return { ...settled, phase: "ended" };
  const next = nextActiveParticipant(settled, participantId);
  return next ? drawFor(settled, next) : { ...settled, phase: "ended" };
};

export interface MahjongAvailableActions {
  readonly canExchange: boolean;
  readonly canChooseMissing: boolean;
  readonly canDiscard: boolean;
  readonly discardableTileIds: readonly string[];
  readonly canPeng: boolean;
  readonly canGang: boolean;
  readonly gangTileIds: readonly string[];
  readonly canHu: boolean;
  readonly canPass: boolean;
  readonly prompt: string;
}

const noActions = (prompt: string): MahjongAvailableActions => ({
  canExchange: false,
  canChooseMissing: false,
  canDiscard: false,
  discardableTileIds: [],
  canPeng: false,
  canGang: false,
  gangTileIds: [],
  canHu: false,
  canPass: false,
  prompt,
});

export const availableMahjongActions = (
  state: MahjongState,
  participantId: ParticipantId,
): MahjongAvailableActions => {
  if (state.phase === "ended") return noActions("本局已结束");
  if (state.currentParticipantId !== participantId) {
    return noActions(state.phase === "exchange"
      ? "等待其他玩家换三张"
      : state.phase === "dingque" ? "等待其他玩家定缺" : "等待其他玩家操作");
  }
  if (state.phase === "exchange") {
    return { ...noActions("请选择同一花色的三张牌"), canExchange: true };
  }
  if (state.phase === "dingque") {
    return { ...noActions("请选择本局必须打净的缺门"), canChooseMissing: true };
  }
  if (state.phase === "responding") {
    const pending = state.pendingResponse;
    const offer = pending?.offers[pending.offerIndex];
    if (!pending || offer?.participantId !== participantId) return noActions("等待响应结算");
    return {
      ...noActions(pending.stage === "hu" ? "可以胡这张牌，或选择过" : "可以碰杠，或选择过"),
      canPeng: pending.stage === "claim" && offer.canPeng,
      canGang: pending.stage === "claim" && offer.canGang,
      canHu: pending.stage === "hu" && offer.canHu,
      canPass: true,
    };
  }

  const hand = state.hands[participantId] ?? [];
  const missingSuit = state.missingSuits[participantId];
  const missingTiles = missingSuit
    ? hand.filter((tile) => tile.suit === missingSuit)
    : [];
  const discardableTiles = missingTiles.length > 0 ? missingTiles : hand;
  const mayGang = missingTiles.length === 0;
  const gangTileIds = mayGang
    ? hand.filter((tile) => gangOption(state, participantId, tile.id) !== null)
        .filter((tile, index, all) => all.findIndex((item) => sameTileType(item, tile)) === index)
        .map((tile) => tile.id)
    : [];
  const canHu = missingTiles.length === 0 &&
    analyzeWinningHand(hand, state.melds[participantId]?.length ?? 0).winning;
  return {
    ...noActions(missingTiles.length > 0
      ? `请先打净${missingSuit === "characters" ? "万" : missingSuit === "dots" ? "筒" : "索"}牌`
      : canHu ? "可以自摸，或继续出牌" : "请选择一张手牌打出"),
    canDiscard: true,
    discardableTileIds: discardableTiles.map((tile) => tile.id),
    canGang: gangTileIds.length > 0,
    gangTileIds,
    canHu,
  };
};

export const mahjongPlugin: MultiGamePlugin<
  MahjongCommand,
  MahjongEventPayload,
  MahjongState,
  MahjongSnapshot
> = {
  id: "mahjong.sichuan-blood-battle",

  parseCommand(input): Result<MahjongCommand> {
    if (!isRecord(input)) return failure("麻将指令必须是对象");
    if (
      input.kind === "exchange" &&
      Array.isArray(input.tileIds) &&
      input.tileIds.every((id) => typeof id === "string")
    ) {
      return success({ kind: "exchange", tileIds: [...input.tileIds] });
    }
    if (input.kind === "chooseMissing" && isMahjongSuit(input.suit)) {
      return success({ kind: "chooseMissing", suit: input.suit });
    }
    if (input.kind === "discard" && typeof input.tileId === "string") {
      return success({ kind: "discard", tileId: input.tileId });
    }
    if (input.kind === "pass" || input.kind === "peng" || input.kind === "hu") {
      return success({ kind: input.kind });
    }
    if (
      input.kind === "gang" &&
      (input.tileId === undefined || typeof input.tileId === "string")
    ) {
      return success({
        kind: "gang",
        ...(typeof input.tileId === "string" ? { tileId: input.tileId } : {}),
      });
    }
    return failure("无效的四川麻将指令");
  },

  parseEvent(type, payload): Result<MahjongEventPayload> {
    const command = this.parseCommand(payload);
    if (!command.ok) return command;
    const expectedType = command.value.kind === "chooseMissing"
      ? "mahjong.choose-missing"
      : `mahjong.${command.value.kind}`;
    return type === expectedType ? command : failure("麻将事件类型与内容不匹配");
  },

  createStartPayload() {
    return {
      wall: shuffledWallIds(),
      exchangeDirection: exchangeDirections[randomIndex(exchangeDirections.length)]!,
    };
  },

  createInitialState(input): MahjongState {
    const order = [...input.seats.values()].filter(
      (id): id is ParticipantId => id !== null,
    );
    const wall = wallFromStartPayload(input.startPayload) ??
      buildSichuanWall().map(toMahjongTile);
    const hands: Record<string, MahjongTile[]> = Object.fromEntries(
      order.map((id) => [id, []]),
    );
    let wallIndex = 0;
    for (let round = 0; round < 13; round += 1) {
      for (const id of order) {
        hands[id]!.push(wall[wallIndex++]!);
      }
    }
    const first = order[0];
    if (!first || order.length !== 4) throw new Error("四川麻将需要四个已入座参与者");
    return {
      phase: "exchange",
      order,
      hands,
      melds: Object.fromEntries(order.map((id) => [id, []])),
      wall,
      wallIndex,
      dealerId: first,
      currentParticipantId: first,
      exchangeDirection: directionFromStartPayload(input.startPayload),
      exchangeSelections: {},
      missingSuits: {},
      pendingResponse: null,
      winners: [],
      scoreByParticipant: Object.fromEntries(order.map((id) => [id, 0])),
      settlements: [],
      drawnTileId: null,
      lastDrawWasReplacement: false,
      discards: [],
      turn: 1,
    };
  },

  validateCommand(command, context): Result<true> {
    if (context.actorId !== context.state.currentParticipantId) {
      return failure("还没有轮到该玩家");
    }
    if (command.kind === "exchange") {
      if (context.state.phase !== "exchange") return failure("当前不在换三张阶段");
      return isValidExchangeSelection(
        context.state.hands[context.actorId] ?? [],
        command.tileIds,
      ) ? success(true) : failure("换三张必须选择同一花色的三张手牌");
    }
    if (command.kind === "chooseMissing") {
      return context.state.phase === "dingque"
        ? success(true)
        : failure("当前不在定缺阶段");
    }
    if (context.state.phase === "responding") {
      const pending = context.state.pendingResponse;
      const offer = pending?.offers[pending.offerIndex];
      if (!pending || offer?.participantId !== context.actorId) {
        return failure("当前玩家没有响应资格");
      }
      if (command.kind === "pass") return success(true);
      if (command.kind === "hu") {
        return pending.stage === "hu" && offer.canHu
          ? success(true)
          : failure("当前弃牌不能胡");
      }
      if (pending.stage !== "claim") return failure("请先选择胡或过");
      if (command.kind === "peng") {
        return offer.canPeng ? success(true) : failure("当前弃牌不能碰");
      }
      if (command.kind === "gang" && command.tileId === undefined) {
        return offer.canGang ? success(true) : failure("当前弃牌不能杠");
      }
      return failure("响应阶段只能碰、杠或过");
    }
    if (context.state.phase !== "playing") return failure("牌局尚未进入摸打阶段");
    if (command.kind === "hu") {
      return !hasMissingSuitTiles(context.state, context.actorId) &&
        analyzeWinningHand(
          context.state.hands[context.actorId] ?? [],
          context.state.melds[context.actorId]?.length ?? 0,
        ).winning
        ? success(true)
        : failure("当前手牌不能胡");
    }
    if (command.kind === "gang" && command.tileId !== undefined) {
      if (hasMissingSuitTiles(context.state, context.actorId)) {
        return failure("缺门牌未打净时不能杠");
      }
      return gangOption(context.state, context.actorId, command.tileId)
        ? success(true)
        : failure("当前手牌不能杠这张牌");
    }
    if (command.kind !== "discard") return failure("当前必须先出牌");
    const hand = context.state.hands[context.actorId] ?? [];
    const selected = hand.find((tile) => tile.id === command.tileId);
    if (!selected) return failure("手牌中不存在这张牌");
    const missingSuit = context.state.missingSuits[context.actorId];
    return hasMissingSuitTiles(context.state, context.actorId) && selected.suit !== missingSuit
      ? failure("缺门牌未打净时必须先打缺门")
      : success(true);
  },

  commandToEvents(command): readonly GameEventSpec<MahjongEventPayload>[] {
    const type = command.kind === "chooseMissing"
      ? "mahjong.choose-missing"
      : `mahjong.${command.kind}`;
    return [{ type, payload: command }];
  },

  validateEvent(event, context): Result<true> {
    return this.validateCommand(event.payload, context);
  },

  reduce(state, event, context): MahjongState {
    if (event.payload.kind === "exchange") {
      const exchangeSelections = {
        ...state.exchangeSelections,
        [context.actorId]: [...event.payload.tileIds],
      };
      const next = nextUnsubmitted(state.order, exchangeSelections);
      if (next) return { ...state, exchangeSelections, currentParticipantId: next };
      return {
        ...state,
        phase: "dingque",
        hands: exchangedHands(state, exchangeSelections),
        exchangeSelections,
        currentParticipantId: state.order[0]!,
      };
    }

    if (event.payload.kind === "chooseMissing") {
      const missingSuits = {
        ...state.missingSuits,
        [context.actorId]: event.payload.suit,
      };
      const next = nextUnsubmitted(state.order, missingSuits);
      if (next) return { ...state, missingSuits, currentParticipantId: next };
      const hands: Record<string, readonly MahjongTile[]> = { ...state.hands };
      const draw = state.wall[state.wallIndex];
      let wallIndex = state.wallIndex;
      if (draw) {
        hands[state.dealerId] = sortMahjongTiles([
          ...state.hands[state.dealerId]!,
          draw,
        ]);
        wallIndex += 1;
      }
      return {
        ...state,
        phase: draw ? "playing" : "ended",
        hands,
        wallIndex,
        missingSuits,
        currentParticipantId: state.dealerId,
        drawnTileId: draw?.id ?? null,
        lastDrawWasReplacement: false,
      };
    }

    if (event.payload.kind === "hu") {
      if (state.phase === "playing") return settleSelfDraw(state, context.actorId);
      const pending = state.pendingResponse!;
      const acceptedHu = [...pending.acceptedHu, context.actorId];
      const nextHuIndex = nextOfferIndex(pending, pending.offerIndex, "hu");
      if (nextHuIndex >= 0) {
        return {
          ...state,
          pendingResponse: { ...pending, acceptedHu, offerIndex: nextHuIndex },
          currentParticipantId: pending.offers[nextHuIndex]!.participantId,
        };
      }
      return settleDiscardWins({
        ...state,
        pendingResponse: { ...pending, acceptedHu },
      });
    }

    if (event.payload.kind === "gang" && event.payload.tileId !== undefined) {
      const option = gangOption(state, context.actorId, event.payload.tileId)!;
      if (option.kind === "added") {
        const offers = robKongOffers(state, context.actorId, option.tile);
        const pendingResponse: MahjongPendingResponse = {
          source: "addedGang",
          stage: "hu",
          discardedBy: context.actorId,
          tile: option.tile,
          offers,
          offerIndex: 0,
          acceptedHu: [],
          addedGangMeldIndex: option.meldIndex,
        };
        const pendingState: MahjongState = {
          ...state,
          phase: "responding",
          currentParticipantId: offers[0]?.participantId ?? context.actorId,
          pendingResponse,
          drawnTileId: null,
          lastDrawWasReplacement: false,
        };
        return offers.length > 0 ? pendingState : finalizeAddedGang(pendingState);
      }

      const hand = [...state.hands[context.actorId]!];
      const gangTiles = hand.filter((tile) => sameTileType(tile, option.tile));
      const remaining = hand.filter((tile) => !sameTileType(tile, option.tile));
      const meld: MahjongMeld = {
        kind: "gang",
        gangType: "concealed",
        tiles: sortMahjongTiles(gangTiles),
        fromParticipantId: context.actorId,
      };
      const completed: MahjongState = {
        ...state,
        hands: { ...state.hands, [context.actorId]: sortMahjongTiles(remaining) },
        melds: {
          ...state.melds,
          [context.actorId]: [...state.melds[context.actorId]!, meld],
        },
        drawnTileId: null,
        lastDrawWasReplacement: false,
      };
      const payers = state.order.filter(
        (id) => id !== context.actorId && !hasWon(state, id),
      );
      return drawFor(
        withGangPayments(completed, context.actorId, payers, 2, "暗杠"),
        context.actorId,
        true,
      );
    }

    if (event.payload.kind === "pass") {
      const pending = state.pendingResponse!;
      const nextIndex = nextOfferIndex(pending, pending.offerIndex, pending.stage);
      const nextOffer = nextIndex >= 0 ? pending.offers[nextIndex] : undefined;
      if (nextOffer) {
        return {
          ...state,
          pendingResponse: { ...pending, offerIndex: nextIndex },
          currentParticipantId: nextOffer.participantId,
        };
      }
      if (pending.stage === "hu") {
        return pending.acceptedHu.length > 0
          ? settleDiscardWins(state)
          : withClaimStageOrDraw(state);
      }
      const next = nextActiveParticipant(state, pending.discardedBy);
      return next ? drawFor(state, next) : { ...state, phase: "ended", pendingResponse: null };
    }

    if (event.payload.kind === "peng" || event.payload.kind === "gang") {
      const pending = state.pendingResponse!;
      const hand = [...state.hands[context.actorId]!];
      const required = event.payload.kind === "peng" ? 2 : 3;
      const claimedTiles: MahjongTile[] = [];
      for (let index = hand.length - 1; index >= 0 && claimedTiles.length < required; index -= 1) {
        if (sameTileType(hand[index]!, pending.tile)) {
          claimedTiles.push(...hand.splice(index, 1));
        }
      }
      const meld: MahjongMeld = {
        kind: event.payload.kind,
        gangType: event.payload.kind === "gang" ? "exposed" : null,
        tiles: sortMahjongTiles([...claimedTiles, pending.tile]),
        fromParticipantId: pending.discardedBy,
      };
      const claimed: MahjongState = {
        ...state,
        phase: "playing",
        hands: { ...state.hands, [context.actorId]: sortMahjongTiles(hand) },
        melds: {
          ...state.melds,
          [context.actorId]: [...state.melds[context.actorId]!, meld],
        },
        discards: claimLastDiscard(state.discards, context.actorId),
        currentParticipantId: context.actorId,
        pendingResponse: null,
        drawnTileId: null,
        lastDrawWasReplacement: false,
      };
      if (event.payload.kind !== "gang") return claimed;
      return drawFor(
        withGangPayments(
          claimed,
          context.actorId,
          [pending.discardedBy],
          2,
          "直杠",
        ),
        context.actorId,
        true,
      );
    }

    if (event.payload.kind !== "discard") return state;
    const hands: Record<string, MahjongTile[]> = Object.fromEntries(
      Object.entries(state.hands).map(([id, hand]) => [id, [...hand]]),
    );
    const hand = hands[context.actorId] ?? [];
    const tileIndex = hand.findIndex((tile) => tile.id === event.payload.tileId);
    const [tile] = hand.splice(tileIndex, 1);
    if (!tile) return state;

    const discards: readonly MahjongDiscard[] = [
      ...state.discards,
      {
        participantId: context.actorId,
        tile,
        turn: state.turn,
        claimedBy: [],
      },
    ];
    const discarded: MahjongState = {
      ...state,
      hands,
      discards,
      turn: state.turn + 1,
      drawnTileId: null,
      lastDrawWasReplacement: false,
    };
    const offers = responseOffers(discarded, context.actorId, tile);
    if (offers.length > 0) {
      const huIndex = offers.findIndex((offer) => offer.canHu);
      const offerIndex = huIndex >= 0 ? huIndex : 0;
      return {
        ...discarded,
        phase: "responding",
        currentParticipantId: offers[offerIndex]!.participantId,
        pendingResponse: {
          source: "discard",
          stage: huIndex >= 0 ? "hu" : "claim",
          discardedBy: context.actorId,
          tile,
          offers,
          offerIndex,
          acceptedHu: [],
          addedGangMeldIndex: null,
        },
      };
    }
    const next = nextActiveParticipant(discarded, context.actorId);
    return next ? drawFor(discarded, next) : { ...discarded, phase: "ended" };
  },

  getDecisionWindow(state) {
    if (state.phase === "ended") return null;
    return {
      id: `${state.phase}-${state.turn}-${state.pendingResponse?.offerIndex ?? 0}-${Object.keys(state.exchangeSelections).length}-${Object.keys(state.missingSuits).length}`,
      openedAtSeq: state.turn,
      eligibleParticipantIds: [state.currentParticipantId],
      submittedParticipantIds: [],
      mode: "single",
    };
  },

  getOutcome(state) {
    if (state.phase !== "ended") return null;
    if (state.winners.length >= 3) {
      return { type: "winner", winners: state.winners.map((winner) => winner.participantId) };
    }
    return {
      type: "ranking",
      order: [...state.order].sort((left, right) =>
        state.scoreByParticipant[right]! - state.scoreByParticipant[left]! ||
        state.order.indexOf(left) - state.order.indexOf(right),
      ),
    };
  },

  createSnapshot(state): MahjongSnapshot {
    return cloneState(state);
  },

  restoreSnapshot(snapshot): Result<MahjongState> {
    if (
      !isRecord(snapshot) ||
      !["exchange", "dingque", "playing", "responding", "ended"].includes(String(snapshot.phase)) ||
      !Array.isArray(snapshot.order) ||
      !isRecord(snapshot.hands) ||
      !isRecord(snapshot.melds) ||
      !Array.isArray(snapshot.wall) ||
      !Array.isArray(snapshot.discards) ||
      typeof snapshot.wallIndex !== "number" ||
      typeof snapshot.dealerId !== "string" ||
      typeof snapshot.currentParticipantId !== "string" ||
      !isRecord(snapshot.exchangeSelections) ||
      !isRecord(snapshot.missingSuits) ||
      !(snapshot.pendingResponse === null || isRecord(snapshot.pendingResponse)) ||
      !Array.isArray(snapshot.winners) ||
      !isRecord(snapshot.scoreByParticipant) ||
      !Array.isArray(snapshot.settlements) ||
      !(snapshot.drawnTileId === null || typeof snapshot.drawnTileId === "string") ||
      typeof snapshot.lastDrawWasReplacement !== "boolean" ||
      typeof snapshot.turn !== "number"
    ) {
      return failure("无效的麻将快照");
    }
    return success(cloneState(snapshot as unknown as MahjongState));
  },
};

export const isMahjongSnapshot = (value: unknown): value is MahjongSnapshot =>
  isRecord(value) &&
  ["exchange", "dingque", "playing", "responding", "ended"].includes(String(value.phase)) &&
  Array.isArray(value.order) &&
  isRecord(value.hands) &&
  isRecord(value.melds) &&
  Array.isArray(value.winners) &&
  isRecord(value.scoreByParticipant) &&
  Array.isArray(value.wall) &&
  Array.isArray(value.discards) &&
  typeof value.currentParticipantId === "string";
