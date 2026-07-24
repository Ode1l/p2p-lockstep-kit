import type { MultiSessionSnapshot } from "p2p-lockstep-kit-multisession";
import {
  availableMahjongActions,
  type MahjongSnapshot,
} from "../game/mahjong";
import { disabledAttribute } from "./html";

export const renderActionBar = (
  snapshot: MultiSessionSnapshot<MahjongSnapshot>,
  selectedTileIds: readonly string[],
  busy: boolean,
): string => {
  const game = snapshot.game;
  if (!game) return "";
  const enabled = snapshot.state.phase === "playing" && !busy;
  const actions = availableMahjongActions(game, snapshot.state.localParticipantId);
  if (game.phase === "exchange") {
    return `
      <div class="action-bar phase-actions" aria-label="换三张">
        <span>已选择 ${selectedTileIds.length}/3</span>
        <button type="button" class="action-primary" data-action="exchange"${disabledAttribute(!enabled || !actions.canExchange || selectedTileIds.length !== 3)}>确认换牌</button>
      </div>`;
  }
  if (game.phase === "dingque") {
    return `
      <div class="action-bar phase-actions dingque-actions" aria-label="定缺">
        <span>选择缺门</span>
        <button type="button" data-action="choose-missing" data-suit="characters"${disabledAttribute(!enabled || !actions.canChooseMissing)}>缺万</button>
        <button type="button" data-action="choose-missing" data-suit="dots"${disabledAttribute(!enabled || !actions.canChooseMissing)}>缺筒</button>
        <button type="button" data-action="choose-missing" data-suit="bamboo"${disabledAttribute(!enabled || !actions.canChooseMissing)}>缺索</button>
      </div>`;
  }
  const selectedTileId = selectedTileIds[0];
  const canDiscard = enabled && actions.canDiscard &&
    !!selectedTileId && actions.discardableTileIds.includes(selectedTileId);
  const canGang = enabled && actions.canGang && (
    game.phase === "responding" ||
    actions.gangTileIds.length === 1 ||
    (!!selectedTileId && actions.gangTileIds.includes(selectedTileId))
  );
  return `
    <div class="action-bar" aria-label="牌局操作">
      <button type="button" class="action-primary" data-action="discard"${disabledAttribute(!canDiscard)}>出牌</button>
      <button type="button" data-action="peng"${disabledAttribute(!enabled || !actions.canPeng)}>碰</button>
      <button type="button" data-action="gang"${disabledAttribute(!canGang)}>${game.phase === "playing" && actions.gangTileIds.length > 1 ? "选牌杠" : "杠"}</button>
      <button type="button" data-action="hu"${disabledAttribute(!enabled || !actions.canHu)}>胡</button>
      <button type="button" data-action="pass"${disabledAttribute(!enabled || !actions.canPass)}>过</button>
    </div>`;
};
