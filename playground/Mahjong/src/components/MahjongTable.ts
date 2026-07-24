import type { MultiSessionSnapshot, ParticipantId, SeatId } from "p2p-lockstep-kit-multisession";
import {
  availableMahjongActions,
  type MahjongSnapshot,
} from "../game/mahjong";
import { escapeHtml } from "./html";
import { renderMahjongTile, renderTileBack } from "./MahjongTile";

const seatNames: Record<string, string> = { south: "南", east: "东", north: "北", west: "西" };
const relativePositions = ["south", "east", "north", "west"] as const;

export const renderMahjongTable = (
  snapshot: MultiSessionSnapshot<MahjongSnapshot>,
  selectedTileIds: readonly string[],
): string => {
  const { state, game } = snapshot;
  const seatIds = [...state.seats.keys()];
  const localSeatIndex = seatIds.findIndex(
    (seatId) => state.seats.get(seatId) === state.localParticipantId,
  );
  const seats = relativePositions.map((position, offset) => {
    const index = localSeatIndex < 0 ? offset : (localSeatIndex + offset) % seatIds.length;
    const seatId = seatIds[index];
    return seatId ? renderSeat(snapshot, seatId, position) : "";
  }).join("");
  const opponentHands = relativePositions.slice(1).map((position, offset) => {
    const index = localSeatIndex < 0 ? offset + 1 : (localSeatIndex + offset + 1) % seatIds.length;
    const participantId = seatIds[index] ? state.seats.get(seatIds[index]!) : null;
    const count = participantId && game ? game.hands[participantId]?.length ?? 0 : 13;
    return `<div class="opponent-hand opponent-${position}" aria-label="对手 ${count} 张手牌">${Array.from({ length: count }, renderTileBack).join("")}</div>`;
  }).join("");
  const localHand = game?.hands[state.localParticipantId] ?? [];
  const actions = game
    ? availableMahjongActions(game, state.localParticipantId)
    : null;
  const selectable = state.phase === "playing" && !!actions &&
    (actions.canExchange || actions.canDiscard || actions.canGang);
  const hand = localHand.length > 0
    ? localHand.map((tile) => renderMahjongTile(tile, {
        selected: selectedTileIds.includes(tile.id),
        selectable,
      })).join("")
    : `<p class="hand-placeholder">${state.phase === "playing" ? "等待同步手牌" : "四人就座并准备后开始发牌"}</p>`;
  const discards = (game?.discards ?? []).filter((discard) => discard.claimedBy.length === 0).slice(-20)
    .map((discard) => renderMahjongTile(discard.tile, { compact: true }))
    .join("");
  const localMelds = (game?.melds[state.localParticipantId] ?? []).map((meld) =>
    `<span class="meld-group" title="${meld.kind === "peng" ? "碰" : meld.gangType === "concealed" ? "暗杠" : meld.gangType === "added" ? "补杠" : "直杠"}">${meld.tiles.map((tile) => renderMahjongTile(tile, { compact: true })).join("")}</span>`,
  ).join("");
  const wallRemaining = game ? game.wall.length - game.wallIndex : 108;
  const phaseLabel = game?.phase === "exchange" ? "换三张"
    : game?.phase === "dingque" ? "定缺"
      : game?.phase === "responding" ? "响应"
        : game?.phase === "ended" ? "本局结束" : `第 ${game?.turn ?? 1} 巡`;

  return `
    <section class="table-frame" aria-label="四人麻将桌">
      <div class="felt-table">
        ${seats}
        ${opponentHands}
        <div class="table-center">
          <div class="discard-river" aria-label="牌河">${discards}</div>
          <div class="round-dial"><strong>${phaseLabel}</strong><span>余 ${wallRemaining}</span></div>
        </div>
        <div class="local-melds" aria-label="你的副露">${localMelds}</div>
        <div class="local-hand" aria-label="你的手牌">${hand}</div>
      </div>
    </section>`;
};

const renderSeat = (
  snapshot: MultiSessionSnapshot<MahjongSnapshot>,
  seat: SeatId,
  position: typeof relativePositions[number],
): string => {
  const { state, game } = snapshot;
  const participantId = state.seats.get(seat);
  const participant = participantId ? state.participants.get(participantId) ?? null : null;
  const connection = participantId ? state.connections.get(participantId) ?? "disconnected" : "disconnected";
  const isCurrent = game?.currentParticipantId === participantId;
  const isLocal = participantId === state.localParticipantId;
  const dealerId = game?.order[0] ?? [...state.seats.values()].find((id) => id !== null);
  const isDealer = dealerId === participantId;
  const winner = participantId
    ? game?.winners.find((item) => item.participantId === participantId)
    : null;
  const missingSuit = participantId ? game?.missingSuits[participantId] : undefined;
  const missingLabel = missingSuit === "characters" ? "缺万"
    : missingSuit === "dots" ? "缺筒" : missingSuit === "bamboo" ? "缺索" : "";
  const score = participantId ? game?.scoreByParticipant[participantId] ?? 0 : 0;
  return `
    <div class="player-seat seat-${position}${isCurrent ? " is-current" : ""}${isLocal ? " is-local" : ""}${winner ? " is-winner" : ""}">
      <span class="wind-mark">${escapeHtml(seatNames[String(seat)] ?? seat)}</span>
      <span class="player-copy">
        <strong>${escapeHtml(participant?.displayName ?? "等待加入")}</strong>
        <small class="connection-${escapeHtml(connection)}">${participant ? (connection === "connected" ? "在线" : escapeHtml(connection)) : "空位"}</small>
        ${participant ? `<span class="seat-game-meta">${winner ? `已胡 ${winner.fan}番` : missingLabel || "未定缺"} · ${score >= 0 ? "+" : ""}${score}</span>` : ""}
      </span>
      ${isDealer ? '<span class="dealer-mark">庄</span>' : isLocal ? '<span class="dealer-mark">你</span>' : ""}
    </div>`;
};

export const currentParticipantName = (
  snapshot: MultiSessionSnapshot<MahjongSnapshot>,
): string => {
  const current = snapshot.game?.currentParticipantId as ParticipantId | undefined;
  return current ? snapshot.state.participants.get(current)?.displayName ?? String(current) : "等待开局";
};
