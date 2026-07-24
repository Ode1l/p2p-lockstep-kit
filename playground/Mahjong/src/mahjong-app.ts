import type { MultiSessionSnapshot } from "p2p-lockstep-kit-multisession";
import type { MultiUiRuntime } from "p2p-lockstep-kit-multiui";
import { renderActionBar } from "./components/ActionBar";
import {
  currentParticipantName,
  renderMahjongTable,
} from "./components/MahjongTable";
import { escapeHtml } from "./components/html";
import {
  availableMahjongActions,
  type MahjongCommand,
  type MahjongSnapshot,
  type MahjongSuit,
} from "./game/mahjong";

export type MahjongRuntime = MultiUiRuntime<MahjongCommand, MahjongSnapshot>;

export const mountMahjong = ({
  mount,
  runtime,
}: {
  mount: HTMLElement;
  runtime: MahjongRuntime;
}): (() => void) => {
  const root = document.createElement("div");
  root.className = "mahjong-game";
  let snapshot = runtime.observer.getSnapshot();
  let selectedTileIds: string[] = [];
  let busy = false;
  let error: string | null = null;

  const render = (): void => {
    if (!snapshot?.game) {
      root.innerHTML = '<div class="mahjong-waiting">等待房主开始游戏…</div>';
      return;
    }
    const status =
      error ??
      (snapshot.state.phase === "offline" || snapshot.state.phase === "syncing"
        ? "有玩家掉线，全桌暂停；连接恢复后继续当前操作"
        : availableMahjongActions(
            snapshot.game,
            snapshot.state.localParticipantId,
          ).prompt);
    root.innerHTML = `
      <div class="turn-banner">
        <span>${snapshot.game.phase === "ended" ? "本局已经结束" : `轮到 ${escapeHtml(currentParticipantName(snapshot))}`}</span>
        <small>${escapeHtml(status)}</small>
      </div>
      ${renderMahjongTable(snapshot, selectedTileIds)}
      ${renderSettlement(snapshot)}
      ${renderActionBar(snapshot, selectedTileIds, busy)}`;
  };

  const move = async (command: MahjongCommand): Promise<void> => {
    busy = true;
    error = null;
    render();
    try {
      await runtime.actions.move(command);
    } catch (reason) {
      error = reason instanceof Error ? reason.message : "操作失败";
    } finally {
      busy = false;
      render();
    }
  };

  const handleClick = (event: MouseEvent): void => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-action]")
        : null;
    if (!target || !root.contains(target) || !snapshot?.game || busy) return;
    switch (target.dataset.action) {
      case "select-tile":
        toggleTileSelection(
          snapshot,
          selectedTileIds,
          target.dataset.tileId ?? null,
        );
        render();
        break;
      case "exchange":
        if (selectedTileIds.length === 3) {
          const tileIds = [...selectedTileIds];
          selectedTileIds = [];
          void move({ kind: "exchange", tileIds });
        }
        break;
      case "choose-missing": {
        const suit = target.dataset.suit as MahjongSuit | undefined;
        if (suit) void move({ kind: "chooseMissing", suit });
        break;
      }
      case "discard":
        if (selectedTileIds[0]) {
          const tileId = selectedTileIds[0];
          selectedTileIds = [];
          void move({ kind: "discard", tileId });
        }
        break;
      case "peng":
        void move({ kind: "peng" });
        break;
      case "gang": {
        const actions = availableMahjongActions(
          snapshot.game,
          snapshot.state.localParticipantId,
        );
        const selected = selectedTileIds[0];
        const gangTileId =
          selected && actions.gangTileIds.includes(selected)
            ? selected
            : actions.gangTileIds.length === 1
              ? actions.gangTileIds[0]
              : undefined;
        if (snapshot.game.phase !== "responding" && !gangTileId) break;
        selectedTileIds = [];
        void move(
          snapshot.game.phase === "responding"
            ? { kind: "gang" }
            : { kind: "gang", tileId: gangTileId! },
        );
        break;
      }
      case "hu":
        void move({ kind: "hu" });
        break;
      case "pass":
        void move({ kind: "pass" });
        break;
    }
  };

  root.addEventListener("click", handleClick);
  mount.replaceChildren(root);
  const unsubscribe = runtime.observer.subscribe({
    onStateChange(next) {
      snapshot = next;
      const hand = next.game?.hands[next.state.localParticipantId] ?? [];
      selectedTileIds = selectedTileIds.filter((tileId) =>
        hand.some((tile) => tile.id === tileId),
      );
      render();
    },
  });
  render();

  return () => {
    unsubscribe();
    root.removeEventListener("click", handleClick);
    root.remove();
  };
};

const toggleTileSelection = (
  snapshot: MultiSessionSnapshot<MahjongSnapshot>,
  selectedTileIds: string[],
  tileId: string | null,
): void => {
  if (!tileId || !snapshot.game) return;
  const selectedIndex = selectedTileIds.indexOf(tileId);
  if (selectedIndex >= 0) {
    selectedTileIds.splice(selectedIndex, 1);
    return;
  }
  if (snapshot.game.phase !== "exchange") {
    selectedTileIds.splice(0, selectedTileIds.length, tileId);
    return;
  }
  const hand = snapshot.game.hands[snapshot.state.localParticipantId] ?? [];
  const tile = hand.find((item) => item.id === tileId);
  const first = hand.find((item) => item.id === selectedTileIds[0]);
  if (!tile) return;
  if (first && first.suit !== tile.suit) selectedTileIds.splice(0);
  if (selectedTileIds.length < 3) selectedTileIds.push(tileId);
};

const renderSettlement = (
  snapshot: MultiSessionSnapshot<MahjongSnapshot>,
): string => {
  const game = snapshot.game;
  if (!game || (game.winners.length === 0 && game.settlements.length === 0)) {
    return "";
  }
  const winners = game.winners
    .map((winner) => {
      const name =
        snapshot.state.participants.get(winner.participantId)?.displayName ??
        String(winner.participantId);
      const method =
        winner.method === "selfDraw"
          ? "自摸"
          : winner.method === "robKong"
            ? "抢杠胡"
            : "点炮胡";
      return `<span><strong>${escapeHtml(name)}</strong>${escapeHtml(method)} · ${winner.fan} 番</span>`;
    })
    .join("");
  return `<div class="settlement-strip" aria-label="本局结算">${winners || `<span>本局累计 ${game.settlements.length} 次结算</span>`}</div>`;
};
