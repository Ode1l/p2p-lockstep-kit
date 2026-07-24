import {
  gameId,
  participantId,
  peerId,
  seatId,
  type MultiSessionSnapshot,
  type Participant,
} from "p2p-lockstep-kit-multisession";
import { describe, expect, it } from "vitest";
import {
  mahjongPlugin,
  type MahjongSnapshot,
  type MahjongState,
} from "../game/mahjong";
import { MAHJONG_SUITS } from "../game/mahjongRules";
import { renderActionBar } from "./ActionBar";

const ids = [0, 1, 2, 3].map((index) => participantId(`player-${index}`));
const participants = new Map(ids.map((id, index) => [id, {
  id,
  peerId: peerId(`peer-${index}`),
  joinedAtSeq: index,
} satisfies Participant]));
const seats = new Map(ids.map((id, index) => [seatId(`seat-${index}`), id]));

const initial = (): MahjongState => mahjongPlugin.createInitialState({
  hostPeerId: peerId("peer-0"),
  gameId: gameId("game-ui"),
  participantCount: 4,
  participants,
  seats,
});

const snapshot = (game: MahjongState): MultiSessionSnapshot<MahjongSnapshot> => ({
  state: {
    phase: "playing",
    localParticipantId: ids[0]!,
  },
  game,
} as unknown as MultiSessionSnapshot<MahjongSnapshot>);

describe("mahjong action bar", () => {
  it("enables exchange confirmation only after three tiles are selected", () => {
    const game = initial();
    const hand = game.hands[ids[0]!]!;
    const suit = MAHJONG_SUITS.find(
      (candidate) => hand.filter((tile) => tile.suit === candidate).length >= 3,
    )!;
    const selected = hand.filter((tile) => tile.suit === suit)
      .slice(0, 3).map((tile) => tile.id);
    expect(renderActionBar(snapshot(game), selected.slice(0, 2), false))
      .toContain('data-action="exchange" disabled');
    expect(renderActionBar(snapshot(game), selected, false))
      .toContain('data-action="exchange">确认换牌');
  });

  it("renders the three dingque choices for the current player", () => {
    const game: MahjongState = { ...initial(), phase: "dingque" };
    const html = renderActionBar(snapshot(game), [], false);
    expect(html).toContain('data-suit="characters"');
    expect(html).toContain('data-suit="dots"');
    expect(html).toContain('data-suit="bamboo"');
    expect(html).not.toContain('data-action="choose-missing" data-suit="characters" disabled');
  });

  it("only enables actions offered by the current response window", () => {
    const base = initial();
    const game: MahjongState = {
      ...base,
      phase: "responding",
      currentParticipantId: ids[0]!,
      pendingResponse: {
        source: "discard",
        stage: "claim",
        discardedBy: ids[3]!,
        tile: base.hands[ids[3]!]![0]!,
        offers: [{ participantId: ids[0]!, canHu: false, canPeng: true, canGang: false }],
        offerIndex: 0,
        acceptedHu: [],
        addedGangMeldIndex: null,
      },
    };
    const html = renderActionBar(snapshot(game), [], false);
    expect(html).toContain('data-action="peng">碰');
    expect(html).toContain('data-action="pass">过');
    expect(html).toContain('data-action="gang" disabled');
    expect(html).toContain('data-action="hu" disabled');
  });
});
