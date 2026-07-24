import type {
  JsonValue,
  MultiSessionSnapshot,
  OrderedEvent,
  Participant,
  ParticipantId,
} from "p2p-lockstep-kit-multisession";
import type { MultiTableView, MultiUiViewOptions } from "../types.js";
import { disabledAttribute, escapeHtml } from "../utils/html.js";

const participantLabel = (
  participantId: ParticipantId,
  participants: ReadonlyMap<ParticipantId, Participant>,
): string =>
  participants.get(participantId)?.displayName ?? String(participantId);

export const connectionLabel = (connection: string): string => {
  if (connection === "connected") return "在线";
  if (connection === "disconnected") return "离线";
  if (connection === "reconnecting") return "重连中";
  if (connection === "connecting") return "连接中";
  return "失败";
};

export const formatEventLabel = <TGameSnapshot extends JsonValue>(
  event: OrderedEvent,
  snapshot: MultiSessionSnapshot<TGameSnapshot>,
  customLabel?: MultiUiViewOptions<TGameSnapshot>["eventLabel"],
): string => {
  const custom = customLabel?.(event, snapshot);
  if (custom) return custom;
  const participants = snapshot.state.participants;
  const actor = participantLabel(event.actorId, participants);
  if (event.type === "MEMBERSHIP_JOINED") {
    const payload = event.payload as {
      participantId?: ParticipantId;
      displayName?: unknown;
    };
    const joined =
      typeof payload.displayName === "string"
        ? payload.displayName
        : payload.participantId
          ? participantLabel(payload.participantId, participants)
          : actor;
    return `${joined} 进入大厅`;
  }
  if (event.type === "DISPLAY_NAME_CHANGED") {
    const payload = event.payload as { displayName?: unknown };
    return `${typeof payload.displayName === "string" ? payload.displayName : actor} 修改了姓名`;
  }
  if (event.type === "READY_CHANGED") return `${actor} 更新准备状态`;
  if (event.type === "GAME_STARTED") return "所有玩家就绪，游戏开始";
  if (event.type === "GAME_EVENT") return `${actor} 完成游戏操作`;
  if (event.type === "RESTART_PROPOSED") return `${actor} 提议重开`;
  if (event.type === "RESTART_VOTED") return `${actor} 同意重开`;
  if (event.type === "GAME_RESTARTED") return "新一局已创建";
  if (event.type === "GAME_ENDED") return "本局结束";
  return event.type;
};

export const renderSessionPanel = <TGameSnapshot extends JsonValue>(
  view: MultiTableView<TGameSnapshot>,
  options: Pick<
    MultiUiViewOptions<TGameSnapshot>,
    "busy" | "seatLabel" | "eventLabel"
  >,
): string => {
  const { snapshot } = view;
  const { state } = snapshot;
  const isHost = state.localParticipantId === state.hostId;
  const isOffline = state.phase === "offline" || state.phase === "syncing";
  const needsConnectionRepair = [...state.participants.values()].some(
    (participant) =>
      participant.id !== state.localParticipantId &&
      state.connections.get(participant.id) !== "connected",
  );
  const canRestart = state.phase === "playing" || state.phase === "ended";
  const participants = [...state.seats.entries()]
    .map(([seat, participantId]) => {
      const participant = participantId
        ? state.participants.get(participantId)
        : null;
      const connection = participantId
        ? (state.connections.get(participantId) ?? "disconnected")
        : "disconnected";
      const ready = participantId
        ? state.ready.get(participantId) === true
        : false;
      return `<li>
        <span class="roster-seat">${escapeHtml(options.seatLabel?.(seat) ?? seat)}</span>
        <span class="roster-name">${escapeHtml(participant?.displayName ?? "等待加入")}</span>
        <span class="roster-status status-${escapeHtml(connection)}">${participant ? connectionLabel(connection) : "空位"}</span>
        <span class="ready-dot${ready ? " is-ready" : ""}">${ready ? "已准备" : ""}</span>
      </li>`;
    })
    .join("");
  const events = view.events
    .slice(-12)
    .reverse()
    .map(
      (event) =>
        `<li><time>#${String(event.seq).padStart(2, "0")}</time><span>${escapeHtml(formatEventLabel(event, snapshot, options.eventLabel))}</span></li>`,
    )
    .join("");

  return `
    <aside class="session-panel">
      <section class="panel-section session-summary">
        <header><h2>会话信息</h2><span>P2P</span></header>
        <dl>
          <div><dt>房主 Peer</dt><dd title="${escapeHtml(view.hostPeerId)}">${escapeHtml(String(view.hostPeerId).slice(0, 16))}</dd></div>
          <div><dt>本机 Peer</dt><dd title="${escapeHtml(view.localPeerId)}">${escapeHtml(String(view.localPeerId).slice(0, 16))}</dd></div>
          <div><dt>阶段</dt><dd>${escapeHtml(state.phase)}</dd></div>
          <div><dt>事件序号</dt><dd>#${state.lastAppliedSeq}</dd></div>
        </dl>
      </section>
      <section class="panel-section participants-panel">
        <header><h2>参与者</h2><span>${state.participants.size}/${state.configuration.participantCount}</span></header>
        <ul>${participants}</ul>
      </section>
      <section class="panel-section control-panel">
        <header><h2>控制</h2><span>${isHost ? "房主" : "参与者"}</span></header>
        <button type="button" data-action="restart"${disabledAttribute(options.busy || !canRestart)}>全员同意重开</button>
        ${isOffline || needsConnectionRepair ? `<button type="button" class="button-quiet" data-action="resume"${disabledAttribute(options.busy)}>恢复全部连接</button>` : ""}
      </section>
      <section class="panel-section event-panel">
        <header><h2>事件记录</h2><span>${view.events.length}</span></header>
        <ol>${events}</ol>
      </section>
    </aside>`;
};
