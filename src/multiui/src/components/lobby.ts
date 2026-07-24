import type { JsonValue } from "p2p-lockstep-kit-multisession";
import { DISPLAY_NAME_MAX_LENGTH } from "../config.js";
import type { MultiTableView, MultiUiViewOptions } from "../types.js";
import { disabledAttribute, escapeHtml } from "../utils/html.js";
import { connectionLabel, formatEventLabel } from "./session-panel.js";

const lobbyStatus = <TGameSnapshot extends JsonValue>(
  view: MultiTableView<TGameSnapshot>,
): Readonly<{ eyebrow: string; title: string; detail: string }> => {
  const { state } = view.snapshot;
  const count = state.participants.size;
  const required = state.configuration.participantCount;
  const hasBrokenConnection = [...state.participants.values()].some(
    (participant) =>
      participant.id !== state.localParticipantId &&
      state.connections.get(participant.id) !== "connected",
  );
  if (state.phase === "protocol_error") {
    return {
      eyebrow: "会话异常",
      title: "游戏无法继续",
      detail: state.protocolError?.message ?? "请检查连接后重新进入。",
    };
  }
  if (
    state.phase === "offline" ||
    state.phase === "syncing" ||
    hasBrokenConnection
  ) {
    return {
      eyebrow: "连接未完成",
      title: "正在等待所有玩家上线",
      detail: "恢复全部连接后，准备和开始游戏会自动恢复可用。",
    };
  }
  if (count < required) {
    return {
      eyebrow: `大厅 · ${count}/${required}`,
      title: "邀请朋友加入游戏",
      detail: "成员到齐并建立完整连接后，所有人才可以准备。",
    };
  }
  if (!state.meshReady) {
    return {
      eyebrow: "成员已到齐",
      title: "正在建立玩家间连接",
      detail: "每位玩家都需要与其余玩家建立直接连接。",
    };
  }
  if (state.phase === "ready") {
    return {
      eyebrow: "全员已准备",
      title:
        state.localParticipantId === state.hostId
          ? "可以开始游戏"
          : "等待房主开始游戏",
      detail: "开始后由房主生成并发布同一份开局记录。",
    };
  }
  return {
    eyebrow: "连接已完成",
    title: "等待所有玩家准备",
    detail: "大厅只管理成员、连接和准备；开始后进入游戏界面。",
  };
};

export const renderLobby = <TGameSnapshot extends JsonValue>(
  view: MultiTableView<TGameSnapshot>,
  options: MultiUiViewOptions<TGameSnapshot>,
): string => {
  const { state } = view.snapshot;
  const localReady = state.ready.get(state.localParticipantId) === true;
  const isHost = state.localParticipantId === state.hostId;
  const isOffline = state.phase === "offline" || state.phase === "syncing";
  const needsConnectionRepair = [...state.participants.values()].some(
    (participant) =>
      participant.id !== state.localParticipantId &&
      state.connections.get(participant.id) !== "connected",
  );
  const canReady =
    state.meshReady &&
    state.participants.size === state.configuration.participantCount &&
    (state.phase === "seated" || state.phase === "ready");
  const canStart = isHost && state.phase === "ready";
  const status = lobbyStatus(view);
  const members = [...state.participants.values()];
  const memberCards = Array.from(
    { length: state.configuration.participantCount },
    (_, index) => {
      const participant = members[index];
      if (!participant) {
        return `<li class="lobby-member is-empty">
          <span class="member-avatar">+</span>
          <span class="member-copy"><strong>等待加入</strong><small>空闲位置</small></span>
        </li>`;
      }
      const connection =
        state.connections.get(participant.id) ?? "disconnected";
      const ready = state.ready.get(participant.id) === true;
      const tags = [
        participant.id === state.hostId ? "房主" : "",
        participant.id === state.localParticipantId ? "你" : "",
      ]
        .filter(Boolean)
        .join(" · ");
      const name = participant.displayName ?? String(participant.id);
      return `<li class="lobby-member">
        <span class="member-avatar">${escapeHtml(name.trim().slice(0, 1) || "玩")}</span>
        <span class="member-copy">
          <span class="member-name"><strong>${escapeHtml(name)}</strong>${tags ? `<em>${escapeHtml(tags)}</em>` : ""}</span>
          <small class="status-${escapeHtml(connection)}">${escapeHtml(connectionLabel(connection))}</small>
        </span>
        <span class="member-ready${ready ? " is-ready" : ""}">${ready ? "已准备" : "未准备"}</span>
      </li>`;
    },
  ).join("");
  const events = view.events
    .slice(-8)
    .reverse()
    .map(
      (event) =>
        `<li><time>#${String(event.seq).padStart(2, "0")}</time><span>${escapeHtml(formatEventLabel(event, view.snapshot, options.eventLabel))}</span></li>`,
    )
    .join("");
  const showRecovery = isOffline || needsConnectionRepair;

  return `
    <main class="lobby-layout">
      <section class="lobby-main">
        <div class="lobby-intro">
          <p>${escapeHtml(status.eyebrow)}</p>
          <h1>${escapeHtml(status.title)}</h1>
          <span>${escapeHtml(status.detail)}</span>
        </div>
        <section class="lobby-members" aria-label="游戏成员">
          <header>
            <h2>游戏成员</h2>
            <div class="lobby-member-tools">
              <span>${state.participants.size}/${state.configuration.participantCount}</span>
              <button type="button" data-action="edit-display-name"${disabledAttribute(options.busy || options.displayNameEditor.open)}>修改姓名</button>
            </div>
          </header>
          ${
            options.displayNameEditor.open
              ? `<form class="display-name-editor" data-form="display-name">
                  <label for="display-name">我的姓名</label>
                  <input id="display-name" name="displayName" type="text" value="${escapeHtml(options.displayNameEditor.value)}" minlength="1" maxlength="${DISPLAY_NAME_MAX_LENGTH}" autocomplete="nickname" required autofocus>
                  ${options.displayNameEditor.error ? `<small role="alert">${escapeHtml(options.displayNameEditor.error)}</small>` : ""}
                  <div>
                    <button type="button" data-action="cancel-display-name">取消</button>
                    <button type="submit" class="button-primary"${disabledAttribute(options.busy)}>保存姓名</button>
                  </div>
                </form>`
              : ""
          }
          <ol>${memberCards}</ol>
        </section>
        <div class="lobby-controls">
          ${
            showRecovery
              ? `<button type="button" class="button-primary" data-action="resume"${disabledAttribute(options.busy)}>恢复全部连接</button>`
              : `<button type="button" data-action="ready"${disabledAttribute(options.busy || localReady || !canReady)}>${localReady ? "已准备" : "准备就绪"}</button>
                 <button type="button" class="button-primary" data-action="start"${disabledAttribute(options.busy || !canStart)}>${isHost ? "开始游戏" : "等待房主开始"}</button>`
          }
        </div>
      </section>
      <aside class="lobby-sidebar">
        <section class="lobby-card table-invite">
          <header><h2>邀请玩家</h2><span>可分享</span></header>
          <div class="invite-share">
            <div class="invitation-qr-stage">
              <div class="invitation-qr" aria-live="polite">
                ${
                  options.invitationQrDataUrl
                    ? `<img src="${escapeHtml(options.invitationQrDataUrl)}" alt="房主邀请二维码" width="184" height="184">`
                    : `<span>${options.invitationQrFailed ? "二维码生成失败" : "正在生成二维码…"}</span>`
                }
              </div>
            </div>
            <p class="invite-hint">扫码后直接加入房主的游戏</p>
            <button type="button" class="invite-primary" data-action="copy-invitation">复制邀请链接</button>
          </div>
          <details class="manual-invite">
            <summary>查看链接与手动连接信息</summary>
            <label>邀请链接</label>
            <code>${escapeHtml(options.invitationUrl)}</code>
            <label>房主 Peer ID</label>
            <code>${escapeHtml(view.hostPeerId)}</code>
            <button type="button" data-action="copy-host-peer">复制完整 Peer ID</button>
          </details>
          ${options.copyNotice ? `<p class="copy-notice">${escapeHtml(options.copyNotice)}</p>` : ""}
        </section>
        <section class="lobby-card lobby-events">
          <header><h2>大厅记录</h2><span>${view.events.length}</span></header>
          <ol>${events || "<li><span>等待玩家加入</span></li>"}</ol>
        </section>
      </aside>
    </main>`;
};
