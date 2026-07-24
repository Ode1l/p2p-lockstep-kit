export const MAHJONG_SUITS = ["characters", "dots", "bamboo"] as const;

export type MahjongSuit = (typeof MAHJONG_SUITS)[number];

export interface MahjongTileShape {
  readonly id: string;
  readonly suit: MahjongSuit;
  readonly rank: number;
  readonly label: string;
}

export interface WinningShape {
  readonly winning: boolean;
  readonly standard: boolean;
  readonly sevenPairs: boolean;
}

export interface MeldShape {
  readonly kind: "peng" | "gang";
  readonly tiles: readonly MahjongTileShape[];
}

export interface WinningScore {
  readonly fan: number;
  readonly points: number;
  readonly patterns: readonly string[];
}

const numberLabels = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const suitLabels: Readonly<Record<MahjongSuit, string>> = {
  characters: "万",
  dots: "筒",
  bamboo: "索",
};

export const buildSichuanWall = (): MahjongTileShape[] => {
  const wall: MahjongTileShape[] = [];
  for (const suit of MAHJONG_SUITS) {
    for (let rank = 1; rank <= 9; rank += 1) {
      for (let copy = 0; copy < 4; copy += 1) {
        wall.push({
          id: `${suit}-${rank}-${copy}`,
          suit,
          rank,
          label: `${numberLabels[rank - 1]}${suitLabels[suit]}`,
        });
      }
    }
  }
  return wall;
};

export const isMahjongSuit = (value: unknown): value is MahjongSuit =>
  typeof value === "string" && MAHJONG_SUITS.includes(value as MahjongSuit);

export const tileTypeIndex = (tile: Pick<MahjongTileShape, "suit" | "rank">): number =>
  MAHJONG_SUITS.indexOf(tile.suit) * 9 + tile.rank - 1;

export const sortMahjongTiles = <T extends MahjongTileShape>(tiles: readonly T[]): T[] =>
  [...tiles].sort((left, right) =>
    tileTypeIndex(left) - tileTypeIndex(right) || left.id.localeCompare(right.id),
  );

export const hasSuit = (
  tiles: readonly Pick<MahjongTileShape, "suit">[],
  suit: MahjongSuit,
): boolean => tiles.some((tile) => tile.suit === suit);

export const isValidExchangeSelection = (
  hand: readonly MahjongTileShape[],
  tileIds: readonly string[],
): boolean => {
  if (tileIds.length !== 3 || new Set(tileIds).size !== 3) return false;
  const selected = tileIds.map((id) => hand.find((tile) => tile.id === id));
  return selected.every((tile) => tile !== undefined) &&
    selected.every((tile) => tile!.suit === selected[0]!.suit);
};

const removeSets = (counts: number[], setsRemaining: number): boolean => {
  if (setsRemaining === 0) return counts.every((count) => count === 0);
  const first = counts.findIndex((count) => count > 0);
  if (first < 0) return false;

  if (counts[first]! >= 3) {
    counts[first] = counts[first]! - 3;
    if (removeSets(counts, setsRemaining - 1)) return true;
    counts[first] = counts[first]! + 3;
  }

  const rank = first % 9;
  if (
    rank <= 6 &&
    counts[first + 1]! > 0 &&
    counts[first + 2]! > 0
  ) {
    counts[first] = counts[first]! - 1;
    counts[first + 1] = counts[first + 1]! - 1;
    counts[first + 2] = counts[first + 2]! - 1;
    if (removeSets(counts, setsRemaining - 1)) return true;
    counts[first] = counts[first]! + 1;
    counts[first + 1] = counts[first + 1]! + 1;
    counts[first + 2] = counts[first + 2]! + 1;
  }
  return false;
};

const tileCounts = (
  tiles: readonly Pick<MahjongTileShape, "suit" | "rank">[],
): number[] => {
  const counts = Array.from({ length: 27 }, () => 0);
  for (const tile of tiles) {
    const index = tileTypeIndex(tile);
    if (index >= 0 && index < counts.length) counts[index] = counts[index]! + 1;
  }
  return counts;
};

const isAllTriplets = (
  concealedTiles: readonly Pick<MahjongTileShape, "suit" | "rank">[],
  meldCount: number,
): boolean => {
  const requiredSets = 4 - meldCount;
  const counts = tileCounts(concealedTiles);
  for (let pairIndex = 0; pairIndex < counts.length; pairIndex += 1) {
    if (counts[pairIndex]! < 2) continue;
    const remaining = [...counts];
    remaining[pairIndex] = remaining[pairIndex]! - 2;
    const triplets = remaining.reduce(
      (total, count) => total + (count > 0 && count % 3 === 0 ? count / 3 : 0),
      0,
    );
    if (remaining.every((count) => count % 3 === 0) && triplets === requiredSets) {
      return true;
    }
  }
  return false;
};

export const analyzeWinningHand = (
  concealedTiles: readonly Pick<MahjongTileShape, "suit" | "rank">[],
  meldCount = 0,
): WinningShape => {
  const requiredSets = 4 - meldCount;
  if (
    requiredSets < 0 ||
    concealedTiles.length !== requiredSets * 3 + 2
  ) {
    return { winning: false, standard: false, sevenPairs: false };
  }

  const counts = Array.from({ length: 27 }, () => 0);
  for (const tile of concealedTiles) {
    const index = tileTypeIndex(tile);
    if (index < 0 || index >= counts.length) {
      return { winning: false, standard: false, sevenPairs: false };
    }
    counts[index] = counts[index]! + 1;
    if (counts[index]! > 4) {
      return { winning: false, standard: false, sevenPairs: false };
    }
  }

  const sevenPairs = meldCount === 0 &&
    counts.reduce((pairs, count) => pairs + Math.floor(count / 2), 0) === 7;
  let standard = false;
  for (let index = 0; index < counts.length; index += 1) {
    if (counts[index]! < 2) continue;
    const remaining = [...counts];
    remaining[index] = remaining[index]! - 2;
    if (removeSets(remaining, requiredSets)) {
      standard = true;
      break;
    }
  }
  return { winning: standard || sevenPairs, standard, sevenPairs };
};

export const scoreWinningHand = (
  concealedTiles: readonly MahjongTileShape[],
  melds: readonly MeldShape[],
  options: {
    readonly selfDraw?: boolean;
    readonly gangAfterDraw?: boolean;
    readonly robbedKong?: boolean;
  } = {},
): WinningScore => {
  const shape = analyzeWinningHand(concealedTiles, melds.length);
  if (!shape.winning) return { fan: 0, points: 0, patterns: [] };

  const allTiles = [...concealedTiles, ...melds.flatMap((meld) => meld.tiles)];
  const counts = tileCounts(allTiles);
  const roots = counts.filter((count) => count === 4).length;
  const pureSuit = new Set(allTiles.map((tile) => tile.suit)).size === 1;
  const longSevenPairs = shape.sevenPairs &&
    tileCounts(concealedTiles).some((count) => count === 4);
  const patterns: string[] = [];
  let fan = 0;

  if (longSevenPairs) {
    fan += 3;
    patterns.push("龙七对");
  } else if (shape.sevenPairs) {
    fan += 2;
    patterns.push("七对");
  } else if (isAllTriplets(concealedTiles, melds.length)) {
    fan += 1;
    patterns.push("对对胡");
  } else {
    patterns.push("平胡");
  }
  if (pureSuit) {
    fan += 2;
    patterns.push("清一色");
  }
  if (roots > 0) {
    fan += roots;
    patterns.push(`${roots}根`);
  }
  if (options.selfDraw) {
    fan += 1;
    patterns.push("自摸");
  }
  if (options.gangAfterDraw) {
    fan += 1;
    patterns.push("杠上花");
  }
  if (options.robbedKong) {
    fan += 1;
    patterns.push("抢杠胡");
  }
  const cappedFan = Math.min(4, fan);
  return { fan: cappedFan, points: 2 ** cappedFan, patterns };
};
