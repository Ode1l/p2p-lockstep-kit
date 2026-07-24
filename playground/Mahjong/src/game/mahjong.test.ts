import {
  createMultiSession,
  createSessionConfiguration,
  FakeMeshNetwork,
  gameId,
  participantId,
  peerId,
  seatId,
  type IdFactory,
  type JsonValue,
  type MultiSession,
  type Participant,
} from "p2p-lockstep-kit-multisession";
import { describe, expect, it } from "vitest";
import {
  availableMahjongActions,
  mahjongPlugin,
  type MahjongCommand,
  type MahjongSnapshot,
  type MahjongState,
  type MahjongSuit,
  type MahjongTile,
} from "./mahjong";
import {
  analyzeWinningHand,
  isValidExchangeSelection,
  MAHJONG_SUITS,
  scoreWinningHand,
} from "./mahjongRules";

const ids = ["south", "east", "north", "west"].map(participantId);
const participants = new Map(
  ids.map((id, index) => [
    id,
    {
      id,
      peerId: `peer-${index}`,
      joinedAtSeq: index + 1,
    } as Participant,
  ]),
);
const seats = new Map(
  ["south", "east", "north", "west"].map((seat, index) => [
    seatId(seat),
    ids[index]!,
  ]),
);

type Runtime = MultiSession<
  MahjongCommand,
  MahjongSnapshot
>;

const runtimeIds = (prefix: string): IdFactory => {
  let event = 0;
  let game = 0;
  return {
    eventId: () => `${prefix}-event-${++event}`,
    gameId: () => gameId(`${prefix}-game-${++game}`),
  };
};

const pump = async (network: FakeMeshNetwork, runtimes: readonly Runtime[]) => {
  for (let round = 0; round < 100; round += 1) {
    network.deliverAll();
    await Promise.all(runtimes.map((runtime) => runtime.idle()));
    if (network.queuedMessageCount() === 0) return;
  }
  throw new Error("mahjong runtime network did not become idle");
};

const selectExchangeTiles = (hand: readonly MahjongTile[]): readonly string[] => {
  for (const suit of MAHJONG_SUITS) {
    const ids = hand.filter((tile) => tile.suit === suit).map((tile) => tile.id);
    if (ids.length >= 3) return ids.slice(0, 3);
  }
  throw new Error("a 13-tile Sichuan hand must contain three tiles of one suit");
};

const chooseMissingSuit = (hand: readonly MahjongTile[]): MahjongSuit =>
  [...MAHJONG_SUITS].sort((left, right) =>
    hand.filter((tile) => tile.suit === left).length -
    hand.filter((tile) => tile.suit === right).length,
  )[0]!;

const tile = (suit: MahjongSuit, rank: number, copy = 0): MahjongTile => ({
  id: `${suit}-${rank}-${copy}`,
  suit,
  rank,
  label: `${rank}`,
});

const tiles = (suit: MahjongSuit, count: number, startRank = 1): MahjongTile[] =>
  Array.from({ length: count }, (_, index) =>
    tile(suit, ((startRank + index - 1) % 9) + 1, Math.floor(index / 9)),
  );

const contextFor = (state: MahjongState, actorId: (typeof ids)[number]) => ({
  hostPeerId: peerId("peer-host"),
  gameId: gameId("game-test"),
  actorId,
  participantCount: 4,
  participants,
  seats,
  state,
  lastAppliedSeq: 1,
});

const eventContextFor = (actorId: (typeof ids)[number]) => ({
  hostPeerId: peerId("peer-host"),
  gameId: gameId("game-test"),
  actorId,
  participantCount: 4,
  participants,
  seats,
  lastAppliedSeq: 2,
});

const controlledPlayingState = (hands: Record<string, readonly MahjongTile[]>): MahjongState => {
  const initial = mahjongPlugin.createInitialState({
    hostPeerId: peerId("peer-host"),
    gameId: gameId("game-test"),
    participantCount: 4,
    participants,
    seats,
  });
  return {
    ...initial,
    phase: "playing",
    hands,
    missingSuits: Object.fromEntries(ids.map((id) => [id, "bamboo"])),
    currentParticipantId: ids[0]!,
  };
};

describe("Sichuan Mahjong plugin", () => {
  it("builds 108 unique suited tiles and deals thirteen to every player", () => {
    const payload = mahjongPlugin.createStartPayload?.({
      hostPeerId: peerId("peer-host"),
      gameId: gameId("game-test"),
      participantCount: 4,
      participants,
      seats,
    });
    expect(payload).toBeDefined();
    if (!payload) throw new Error("mahjong start payload was not created");
    const wall = payload?.wall;
    expect(Array.isArray(wall)).toBe(true);
    expect(wall).toHaveLength(108);
    expect(new Set(wall as readonly JsonValue[]).size).toBe(108);
    expect((wall as readonly string[]).some((id) => id.startsWith("honor"))).toBe(false);

    const state = mahjongPlugin.createInitialState({
      hostPeerId: peerId("peer-host"),
      gameId: gameId("game-test"),
      participantCount: 4,
      participants,
      seats,
      startPayload: payload,
    });
    expect(state.phase).toBe("exchange");
    expect(state.wall.map((tile) => tile.id)).toEqual(wall);
    for (const id of ids) expect(state.hands[id]).toHaveLength(13);
    expect(state.wallIndex).toBe(52);
  });

  it("recognizes standard and seven-pairs wins without accepting incomplete hands", () => {
    const standard = [
      tile("characters", 1, 0), tile("characters", 2, 0), tile("characters", 3, 0),
      tile("characters", 4, 0), tile("characters", 5, 0), tile("characters", 6, 0),
      tile("dots", 2, 0), tile("dots", 3, 0), tile("dots", 4, 0),
      tile("bamboo", 7, 0), tile("bamboo", 7, 1), tile("bamboo", 7, 2),
      tile("dots", 9, 0), tile("dots", 9, 1),
    ];
    const pairs = [1, 2, 3, 4, 5, 6, 7].flatMap((rank) => [
      tile("characters", rank, 0),
      tile("characters", rank, 1),
    ]);
    expect(analyzeWinningHand(standard)).toEqual({
      winning: true,
      standard: true,
      sevenPairs: false,
    });
    expect(analyzeWinningHand(pairs)).toEqual({
      winning: true,
      standard: true,
      sevenPairs: true,
    });
    expect(scoreWinningHand(pairs, [])).toEqual({
      fan: 4,
      points: 16,
      patterns: ["七对", "清一色"],
    });
    expect(analyzeWinningHand(standard.slice(0, 13)).winning).toBe(false);
  });

  it("requires exactly three same-suit owned tiles for the exchange", () => {
    const state = mahjongPlugin.createInitialState({
      hostPeerId: peerId("peer-host"),
      gameId: gameId("game-test"),
      participantCount: 4,
      participants,
      seats,
    });
    const first = ids[0]!;
    const hand = state.hands[first]!;
    const selected = selectExchangeTiles(hand);
    expect(isValidExchangeSelection(hand, selected)).toBe(true);
    expect(isValidExchangeSelection(hand, selected.slice(0, 2))).toBe(false);
    expect(isValidExchangeSelection(hand, [selected[0]!, selected[0]!, selected[1]!])).toBe(false);
    expect(isValidExchangeSelection(hand, [...selected.slice(0, 2), "missing-tile"])).toBe(false);
  });

  it("forces a player to discard the missing suit before any other suit", () => {
    const forced = tile("bamboo", 9, 3);
    const allowedLater = tile("characters", 9, 3);
    const state = controlledPlayingState({
      [ids[0]!]: [forced, allowedLater, ...tiles("dots", 12)],
      [ids[1]!]: tiles("dots", 13),
      [ids[2]!]: tiles("characters", 13),
      [ids[3]!]: tiles("dots", 13, 3),
    });
    expect(mahjongPlugin.validateCommand(
      { kind: "discard", tileId: allowedLater.id },
      contextFor(state, ids[0]!),
    )).toEqual({ ok: false, error: "缺门牌未打净时必须先打缺门" });
    expect(mahjongPlugin.validateCommand(
      { kind: "discard", tileId: forced.id },
      contextFor(state, ids[0]!),
    )).toEqual({ ok: true, value: true });
  });

  it("offers a discard in seat order and lets the eligible player peng", () => {
    const discarded = tile("characters", 5, 3);
    const responderCopies = [tile("characters", 5, 0), tile("characters", 5, 1)];
    const state = controlledPlayingState({
      [ids[0]!]: [discarded, ...tiles("dots", 13)],
      [ids[1]!]: [...responderCopies, ...tiles("dots", 11)],
      [ids[2]!]: tiles("dots", 13, 2),
      [ids[3]!]: tiles("dots", 13, 4),
    });
    const responding = mahjongPlugin.reduce(
      state,
      { type: "mahjong.discard", payload: { kind: "discard", tileId: discarded.id } },
      eventContextFor(ids[0]!),
    );
    expect(responding.phase).toBe("responding");
    expect(responding.currentParticipantId).toBe(ids[1]);
    expect(responding.pendingResponse?.offers).toEqual([{
      participantId: ids[1],
      canHu: false,
      canPeng: true,
      canGang: false,
    }]);

    const claimed = mahjongPlugin.reduce(
      responding,
      { type: "mahjong.peng", payload: { kind: "peng" } },
      eventContextFor(ids[1]!),
    );
    expect(claimed.phase).toBe("playing");
    expect(claimed.currentParticipantId).toBe(ids[1]);
    expect(claimed.hands[ids[1]!]).toHaveLength(11);
    expect(claimed.melds[ids[1]!]![0]).toMatchObject({
      kind: "peng",
      fromParticipantId: ids[0],
    });
    expect(claimed.melds[ids[1]!]![0]!.tiles).toHaveLength(3);
    expect(claimed.discards[0]?.claimedBy).toEqual([ids[1]]);
  });

  it("draws for the next player after passes and replacement-draws after an exposed gang", () => {
    const discarded = tile("characters", 5, 3);
    const responderCopies = [
      tile("characters", 5, 0),
      tile("characters", 5, 1),
      tile("characters", 5, 2),
    ];
    const state = controlledPlayingState({
      [ids[0]!]: [discarded, ...tiles("dots", 13)],
      [ids[1]!]: [...responderCopies, ...tiles("dots", 10)],
      [ids[2]!]: tiles("dots", 13, 2),
      [ids[3]!]: tiles("dots", 13, 4),
    });
    const responding = mahjongPlugin.reduce(
      state,
      { type: "mahjong.discard", payload: { kind: "discard", tileId: discarded.id } },
      eventContextFor(ids[0]!),
    );
    const passed = mahjongPlugin.reduce(
      responding,
      { type: "mahjong.pass", payload: { kind: "pass" } },
      eventContextFor(ids[1]!),
    );
    expect(passed.phase).toBe("playing");
    expect(passed.currentParticipantId).toBe(ids[1]);
    expect(passed.hands[ids[1]!]).toHaveLength(14);
    expect(passed.wallIndex).toBe(state.wallIndex + 1);

    const ganged = mahjongPlugin.reduce(
      responding,
      { type: "mahjong.gang", payload: { kind: "gang" } },
      eventContextFor(ids[1]!),
    );
    expect(ganged.phase).toBe("playing");
    expect(ganged.currentParticipantId).toBe(ids[1]);
    expect(ganged.hands[ids[1]!]).toHaveLength(11);
    expect(ganged.melds[ids[1]!]![0]?.tiles).toHaveLength(4);
    expect(ganged.wallIndex).toBe(state.wallIndex + 1);
  });

  it("settles a self-draw against every active opponent", () => {
    const winningHand = [
      tile("characters", 1, 0), tile("characters", 2, 0), tile("characters", 3, 0),
      tile("characters", 4, 0), tile("characters", 5, 0), tile("characters", 6, 0),
      tile("dots", 1, 0), tile("dots", 2, 0), tile("dots", 3, 0),
      tile("dots", 4, 0), tile("dots", 5, 0), tile("dots", 6, 0),
      tile("dots", 9, 0), tile("dots", 9, 1),
    ];
    const state = {
      ...controlledPlayingState({
        [ids[0]!]: winningHand,
        [ids[1]!]: tiles("dots", 13),
        [ids[2]!]: tiles("characters", 13),
        [ids[3]!]: tiles("dots", 13, 3),
      }),
      drawnTileId: winningHand.at(-1)!.id,
    };
    expect(mahjongPlugin.validateCommand(
      { kind: "hu" },
      contextFor(state, ids[0]!),
    )).toEqual({ ok: true, value: true });

    const settled = mahjongPlugin.reduce(
      state,
      { type: "mahjong.hu", payload: { kind: "hu" } },
      eventContextFor(ids[0]!),
    );
    expect(settled.winners).toHaveLength(1);
    expect(settled.winners[0]).toMatchObject({
      participantId: ids[0],
      method: "selfDraw",
      fan: 1,
      points: 2,
    });
    expect(settled.scoreByParticipant[ids[0]!]).toBe(6);
    for (const id of ids.slice(1)) expect(settled.scoreByParticipant[id!]).toBe(-2);
    expect(settled.currentParticipantId).toBe(ids[1]);
    expect(settled.hands[ids[1]!]).toHaveLength(14);
  });

  it("collects multiple discard wins before settling and continues blood battle", () => {
    const discarded = tile("characters", 9, 3);
    const waitingHand = [
      tile("characters", 1, 0), tile("characters", 2, 0), tile("characters", 3, 0),
      tile("characters", 4, 0), tile("characters", 5, 0), tile("characters", 6, 0),
      tile("dots", 1, 0), tile("dots", 2, 0), tile("dots", 3, 0),
      tile("dots", 7, 0), tile("dots", 8, 0), tile("dots", 9, 0),
      tile("characters", 9, 0),
    ];
    const state = controlledPlayingState({
      [ids[0]!]: [discarded, ...tiles("dots", 13, 2)],
      [ids[1]!]: waitingHand,
      [ids[2]!]: waitingHand.map((item, index) => ({ ...item, id: `${item.id}-p2-${index}` })),
      [ids[3]!]: tiles("dots", 13, 4),
    });
    const responding = mahjongPlugin.reduce(
      state,
      { type: "mahjong.discard", payload: { kind: "discard", tileId: discarded.id } },
      eventContextFor(ids[0]!),
    );
    expect(responding.pendingResponse?.stage).toBe("hu");
    expect(responding.currentParticipantId).toBe(ids[1]);

    const firstHu = mahjongPlugin.reduce(
      responding,
      { type: "mahjong.hu", payload: { kind: "hu" } },
      eventContextFor(ids[1]!),
    );
    expect(firstHu.winners).toHaveLength(0);
    expect(firstHu.pendingResponse?.acceptedHu).toEqual([ids[1]]);
    expect(firstHu.currentParticipantId).toBe(ids[2]);

    const settled = mahjongPlugin.reduce(
      firstHu,
      { type: "mahjong.hu", payload: { kind: "hu" } },
      eventContextFor(ids[2]!),
    );
    expect(settled.winners.map((winner) => winner.participantId)).toEqual([ids[1], ids[2]]);
    expect(settled.scoreByParticipant[ids[0]!]).toBe(-2);
    expect(settled.scoreByParticipant[ids[1]!]).toBe(1);
    expect(settled.scoreByParticipant[ids[2]!]).toBe(1);
    expect(settled.discards[0]?.claimedBy).toEqual([ids[1], ids[2]]);
    expect(settled.phase).toBe("playing");
    expect(settled.currentParticipantId).toBe(ids[3]);
    expect(settled.hands[ids[3]!]).toHaveLength(14);
  });

  it("settles a concealed gang against every active opponent and replacement-draws", () => {
    const gangTiles = [0, 1, 2, 3].map((copy) => tile("characters", 5, copy));
    const state = controlledPlayingState({
      [ids[0]!]: [...gangTiles, ...tiles("dots", 10)],
      [ids[1]!]: tiles("dots", 13),
      [ids[2]!]: tiles("characters", 13, 1),
      [ids[3]!]: tiles("dots", 13, 3),
    });
    expect(mahjongPlugin.validateCommand(
      { kind: "gang", tileId: gangTiles[0]!.id },
      contextFor(state, ids[0]!),
    )).toEqual({ ok: true, value: true });

    const settled = mahjongPlugin.reduce(
      state,
      { type: "mahjong.gang", payload: { kind: "gang", tileId: gangTiles[0]!.id } },
      eventContextFor(ids[0]!),
    );
    expect(settled.melds[ids[0]!]![0]).toMatchObject({
      kind: "gang",
      gangType: "concealed",
      fromParticipantId: ids[0],
    });
    expect(settled.hands[ids[0]!]).toHaveLength(11);
    expect(settled.lastDrawWasReplacement).toBe(true);
    expect(settled.scoreByParticipant[ids[0]!]).toBe(6);
    for (const id of ids.slice(1)) expect(settled.scoreByParticipant[id!]).toBe(-2);
  });

  it("completes an added gang after nobody can rob it", () => {
    const added = tile("characters", 5, 3);
    const state = {
      ...controlledPlayingState({
        [ids[0]!]: [added, ...tiles("dots", 10)],
        [ids[1]!]: tiles("dots", 13),
        [ids[2]!]: tiles("characters", 13, 1),
        [ids[3]!]: tiles("dots", 13, 3),
      }),
      melds: {
        [ids[0]!]: [{
          kind: "peng" as const,
          gangType: null,
          tiles: [0, 1, 2].map((copy) => tile("characters", 5, copy)),
          fromParticipantId: ids[1]!,
        }],
        [ids[1]!]: [],
        [ids[2]!]: [],
        [ids[3]!]: [],
      },
    };
    const completed = mahjongPlugin.reduce(
      state,
      { type: "mahjong.gang", payload: { kind: "gang", tileId: added.id } },
      eventContextFor(ids[0]!),
    );
    expect(completed.phase).toBe("playing");
    expect(completed.melds[ids[0]!]![0]).toMatchObject({ kind: "gang", gangType: "added" });
    expect(completed.melds[ids[0]!]![0]?.tiles).toHaveLength(4);
    expect(completed.hands[ids[0]!]).toHaveLength(11);
    expect(completed.scoreByParticipant[ids[0]!]).toBe(3);
    for (const id of ids.slice(1)) expect(completed.scoreByParticipant[id!]).toBe(-1);
  });

  it("lets a player rob an added gang before it becomes final", () => {
    const added = tile("characters", 5, 3);
    const waiting = [
      tile("characters", 1, 0), tile("characters", 2, 0), tile("characters", 3, 0),
      tile("characters", 6, 0), tile("characters", 7, 0), tile("characters", 8, 0),
      tile("dots", 1, 0), tile("dots", 2, 0), tile("dots", 3, 0),
      tile("dots", 7, 0), tile("dots", 8, 0), tile("dots", 9, 0),
      tile("characters", 5, 0),
    ];
    const state = {
      ...controlledPlayingState({
        [ids[0]!]: [added, ...tiles("dots", 10)],
        [ids[1]!]: waiting,
        [ids[2]!]: tiles("dots", 13, 1),
        [ids[3]!]: tiles("dots", 13, 3),
      }),
      melds: {
        [ids[0]!]: [{
          kind: "peng" as const,
          gangType: null,
          tiles: [0, 1, 2].map((copy) => tile("characters", 5, copy)),
          fromParticipantId: ids[2]!,
        }],
        [ids[1]!]: [],
        [ids[2]!]: [],
        [ids[3]!]: [],
      },
    };
    const responding = mahjongPlugin.reduce(
      state,
      { type: "mahjong.gang", payload: { kind: "gang", tileId: added.id } },
      eventContextFor(ids[0]!),
    );
    expect(responding.phase).toBe("responding");
    expect(responding.pendingResponse).toMatchObject({ source: "addedGang", stage: "hu" });
    expect(responding.currentParticipantId).toBe(ids[1]);

    const robbed = mahjongPlugin.reduce(
      responding,
      { type: "mahjong.hu", payload: { kind: "hu" } },
      eventContextFor(ids[1]!),
    );
    expect(robbed.winners[0]).toMatchObject({
      participantId: ids[1],
      method: "robKong",
      fan: 1,
      points: 2,
    });
    expect(robbed.winners[0]?.patterns).toContain("抢杠胡");
    expect(robbed.hands[ids[0]!]).toHaveLength(10);
    expect(robbed.melds[ids[0]!]![0]?.kind).toBe("peng");
    expect(robbed.scoreByParticipant[ids[0]!]).toBe(-2);
    expect(robbed.scoreByParticipant[ids[1]!]).toBe(2);
  });

  it("ends blood battle as soon as the third distinct player wins", () => {
    const winningHand = [
      tile("characters", 1, 0), tile("characters", 2, 0), tile("characters", 3, 0),
      tile("characters", 4, 0), tile("characters", 5, 0), tile("characters", 6, 0),
      tile("dots", 1, 0), tile("dots", 2, 0), tile("dots", 3, 0),
      tile("dots", 4, 0), tile("dots", 5, 0), tile("dots", 6, 0),
      tile("dots", 9, 0), tile("dots", 9, 1),
    ];
    const base = controlledPlayingState({
      [ids[0]!]: tiles("dots", 14),
      [ids[1]!]: tiles("characters", 14),
      [ids[2]!]: winningHand,
      [ids[3]!]: tiles("dots", 13, 3),
    });
    const previousWinners: MahjongState["winners"] = [ids[0]!, ids[1]!].map(
      (participantId, index) => ({
        participantId,
        method: "discard" as const,
        tile: tile("dots", 9, index),
        fan: 0,
        points: 1,
        patterns: ["平胡"],
        turn: index + 1,
      }),
    );
    const state: MahjongState = {
      ...base,
      currentParticipantId: ids[2]!,
      winners: previousWinners,
      drawnTileId: winningHand.at(-1)!.id,
    };
    const ended = mahjongPlugin.reduce(
      state,
      { type: "mahjong.hu", payload: { kind: "hu" } },
      eventContextFor(ids[2]!),
    );
    expect(ended.phase).toBe("ended");
    expect(ended.winners.map((winner) => winner.participantId)).toEqual(ids.slice(0, 3));
    expect(mahjongPlugin.getOutcome(ended)).toEqual({
      type: "winner",
      winners: ids.slice(0, 3),
    });
  });

  it("ends with a ranking when the wall cannot provide the next draw", () => {
    const discarded = tile("characters", 9, 3);
    const base = controlledPlayingState({
      [ids[0]!]: [discarded, ...tiles("dots", 13, 2)],
      [ids[1]!]: tiles("dots", 13),
      [ids[2]!]: tiles("dots", 13, 1),
      [ids[3]!]: tiles("dots", 13, 3),
    });
    const state = { ...base, wallIndex: base.wall.length };
    const ended = mahjongPlugin.reduce(
      state,
      { type: "mahjong.discard", payload: { kind: "discard", tileId: discarded.id } },
      eventContextFor(ids[0]!),
    );
    expect(ended.phase).toBe("ended");
    expect(mahjongPlugin.getOutcome(ended)).toEqual({ type: "ranking", order: ids });
  });

  it("runs start, exchange-three and dingque identically across four runtimes", async () => {
    const network = new FakeMeshNetwork();
    const runtimeParticipants = Array.from({ length: 4 }, (_, index) => ({
      id: participantId(`mahjong-participant-${index}`),
      peerId: peerId(`mahjong-peer-${index}`),
      displayName: `P${index + 1}`,
    }));
    const configuration = createSessionConfiguration({
      participantCount: 4,
      seatIds: ["south", "east", "north", "west"].map(seatId),
    });
    if (!configuration.ok) throw new Error(configuration.error);
    const runtimes = runtimeParticipants.map((participant, index) =>
      createMultiSession({
        gameId: gameId("mahjong-game"),
        localParticipant: participant,
        hostId: runtimeParticipants[0]!.id,
        hostPeerId: runtimeParticipants[0]!.peerId,
        configuration: configuration.value,
        plugin: mahjongPlugin,
        transport: network.createTransport(participant.peerId),
        idFactory: runtimeIds(`mahjong-${index}`),
      }),
    );

    await Promise.all(runtimes.map((runtime) => runtime.start()));
    for (const runtime of runtimes.slice(1)) {
      await runtime.actions.join();
      await pump(network, runtimes);
    }
    expect(runtimes.map((runtime) => runtime.observer.getSnapshot()!.state.phase)).toEqual([
      "seated", "seated", "seated", "seated",
    ]);

    for (const runtime of runtimes) {
      await runtime.actions.ready(true);
      await pump(network, runtimes);
    }
    await runtimes[0]!.actions.start();
    await pump(network, runtimes);

    const hostHistory = runtimes[0]!.observer.getSnapshot()!.history;
    const started = hostHistory.find((event) => event.type === "GAME_STARTED");
    expect(started?.actorId).toBe(runtimeParticipants[0]!.id);
    expect(Array.isArray((started?.payload as { wall?: unknown }).wall)).toBe(true);
    const wallIds = (started!.payload as { wall: readonly string[] }).wall;
    expect(wallIds).toHaveLength(108);
    expect(new Set(wallIds).size).toBe(108);

    for (const runtime of runtimes) {
      const snapshot = runtime.observer.getSnapshot()!;
      expect(snapshot.state.phase).toBe("playing");
      expect(snapshot.history).toEqual(hostHistory);
      expect(snapshot.game?.wall.map((tile) => tile.id)).toEqual(wallIds);
      expect(snapshot.game?.phase).toBe("exchange");
      expect(snapshot.game?.wallIndex).toBe(52);
    }

    for (let index = 0; index < 4; index += 1) {
      const game = runtimes[0]!.observer.getSnapshot()!.game!;
      const actorId = game.currentParticipantId;
      const actorIndex = runtimeParticipants.findIndex((item) => item.id === actorId);
      await runtimes[actorIndex]!.actions.move({
        kind: "exchange",
        tileIds: selectExchangeTiles(game.hands[actorId]!),
      });
      await pump(network, runtimes);
    }
    expect(runtimes[0]!.observer.getSnapshot()!.game?.phase).toBe("dingque");
    for (const id of runtimes[0]!.observer.getSnapshot()!.game!.order) {
      expect(runtimes[0]!.observer.getSnapshot()!.game!.hands[id]).toHaveLength(13);
    }

    for (let index = 0; index < 4; index += 1) {
      const game = runtimes[0]!.observer.getSnapshot()!.game!;
      const actorId = game.currentParticipantId;
      const actorIndex = runtimeParticipants.findIndex((item) => item.id === actorId);
      await runtimes[actorIndex]!.actions.move({
        kind: "chooseMissing",
        suit: chooseMissingSuit(game.hands[actorId]!),
      });
      await pump(network, runtimes);
    }

    const completedGames = runtimes.map((runtime) => runtime.observer.getSnapshot()!.game!);
    expect(completedGames.slice(1)).toEqual([
      completedGames[0],
      completedGames[0],
      completedGames[0],
    ]);
    const completed = completedGames[0]!;
    expect(completed.phase).toBe("playing");
    expect(Object.keys(completed.exchangeSelections)).toHaveLength(4);
    expect(Object.keys(completed.missingSuits)).toHaveLength(4);
    expect(completed.hands[completed.dealerId]).toHaveLength(14);
    for (const participantId of completed.order.filter((id) => id !== completed.dealerId)) {
      expect(completed.hands[participantId]).toHaveLength(13);
    }
    expect(completed.wallIndex).toBe(53);

    for (let actionIndex = 0; actionIndex < 100; actionIndex += 1) {
      const game = runtimes[0]!.observer.getSnapshot()!.game!;
      if (game.phase === "ended" || game.discards.length >= 8) break;
      const actorId = game.currentParticipantId;
      const actorIndex = runtimeParticipants.findIndex((item) => item.id === actorId);
      const actions = availableMahjongActions(game, actorId);
      const command: MahjongCommand = game.phase === "responding"
        ? { kind: "pass" }
        : { kind: "discard", tileId: actions.discardableTileIds[0]! };
      await runtimes[actorIndex]!.actions.move(command);
      await pump(network, runtimes);
      const games = runtimes.map((runtime) => runtime.observer.getSnapshot()!.game);
      expect(games.slice(1)).toEqual([games[0], games[0], games[0]]);
    }
    const replayed = runtimes[0]!.observer.getSnapshot()!.game!;
    expect(replayed.discards.length).toBeGreaterThanOrEqual(8);
    expect(mahjongPlugin.restoreSnapshot(
      mahjongPlugin.createSnapshot(replayed),
    )).toEqual({ ok: true, value: replayed });

    runtimes.forEach((runtime) => runtime.dispose());
  });
});
