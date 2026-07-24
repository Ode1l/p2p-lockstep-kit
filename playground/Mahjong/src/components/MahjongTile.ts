import type { MahjongTile as Tile } from "../game/mahjong";
import { escapeHtml } from "./html";

interface MahjongTileOptions {
  readonly selected?: boolean;
  readonly compact?: boolean;
  readonly selectable?: boolean;
}

export const renderMahjongTile = (
  tile: Tile,
  options: MahjongTileOptions = {},
): string => {
  const { selected = false, compact = false, selectable = false } = options;
  const className = [
    "mahjong-tile",
    `tile-${tile.suit}`,
    selected ? "is-selected" : "",
    compact ? "is-compact" : "",
  ].filter(Boolean).join(" ");
  const content = `<span class="tile-label">${escapeHtml(tile.label)}</span><span class="tile-index">${escapeHtml(tile.rank)}</span>`;
  if (!selectable) return `<span class="${className}">${content}</span>`;
  return `<button type="button" class="${className}" aria-pressed="${selected}" aria-label="选择 ${escapeHtml(tile.label)}" data-action="select-tile" data-tile-id="${escapeHtml(tile.id)}">${content}</button>`;
};

export const renderTileBack = (): string =>
  '<span class="tile-back is-compact" aria-hidden="true"><span></span></span>';
