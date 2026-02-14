import type { PanelRefs } from "./panel";

export type ShellLayout = {
  container: HTMLDivElement;
  boardWrap: HTMLDivElement;
  boardColumn: HTMLDivElement;
  statusRow: HTMLDivElement;
  actionsRow: HTMLDivElement;
  requestBar: HTMLDivElement;
  winnerModal: HTMLDivElement;
  noticeToast: HTMLDivElement;
  logPanel: HTMLDivElement;
  logBody: HTMLDivElement;
  configModal: HTMLDivElement;
  configInput: HTMLInputElement;
  configSave: HTMLButtonElement;
  configCancel: HTMLButtonElement;
  statusColor: HTMLSpanElement;
  statusTurn: HTMLSpanElement;
  readyBtn: HTMLButtonElement;
  startBtn: HTMLButtonElement;
  undoBtn: HTMLButtonElement;
  restartBtn: HTMLButtonElement;
  requestText: HTMLSpanElement;
  requestYes: HTMLButtonElement;
  requestNo: HTMLButtonElement;
  winnerText: HTMLDivElement;
  winnerOk: HTMLButtonElement;
  startOverlay: HTMLDivElement;
};

export const createShellLayout = (panel: { refs: PanelRefs }): ShellLayout => {
  const container = document.createElement("div");
  container.className = "app";
  const boardColumn = document.createElement("div");
  boardColumn.className = "board-column";
  const boardWrap = document.createElement("div");
  boardWrap.className = "board-wrapper";
  const startOverlay = document.createElement("div");
  startOverlay.className = "start-overlay";
  startOverlay.textContent = "Start";
  boardWrap.append(startOverlay);

  const statusRow = document.createElement("div");
  statusRow.className = "match-status";
  statusRow.innerHTML = `
    <span id="statusColor">Color: -</span>
    <span id="statusTurn">Turn: -</span>
  `;

  const requestBar = document.createElement("div");
  requestBar.className = "match-request";
  requestBar.innerHTML = `
    <div class="match-request-card">
      <div id="requestText">Request</div>
      <div class="match-request-actions">
        <button id="requestYes" class="btn btn-primary">Agree</button>
        <button id="requestNo" class="btn btn-ghost">No</button>
      </div>
    </div>
  `;

  const winnerModal = document.createElement("div");
  winnerModal.className = "match-request";
  winnerModal.innerHTML = `
    <div class="match-request-card">
      <div id="winnerText">Winner</div>
      <div class="match-request-actions">
        <button id="winnerOk" class="btn btn-primary">OK</button>
      </div>
    </div>
  `;

  const actionsRow = document.createElement("div");
  actionsRow.className = "match-actions";
  actionsRow.innerHTML = `
    <button id="readyBtn" class="btn btn-primary">Ready</button>
    <button id="startBtn" class="btn btn-primary">Start</button>
    <button id="undoBtn" class="btn btn-ghost">Undo</button>
    <button id="restartBtn" class="btn btn-ghost">Restart</button>
  `;

  boardColumn.append(boardWrap, statusRow, actionsRow);
  container.append(panel.refs.root, boardColumn);
  document.body.append(requestBar);
  document.body.append(winnerModal);

  statusRow.style.order = "1";
  boardWrap.style.order = "2";
  actionsRow.style.order = "3";

  const logPanel = document.createElement("div");
  logPanel.className = "debug-log hidden";
  logPanel.innerHTML = `
    <div class="debug-title">Debug</div>
    <div class="debug-body"></div>
  `;
  document.body.append(logPanel);
  const logBody = logPanel.querySelector(".debug-body") as HTMLDivElement;

  const noticeToast = document.createElement("div");
  noticeToast.className = "notice-toast";
  document.body.append(noticeToast);

  const configModal = document.createElement("div");
  configModal.className = "config-modal hidden";
  configModal.innerHTML = `
    <div class="config-card">
      <div class="config-title">Connection</div>
      <label>
        Signaling URL
        <input id="configSignalUrl" type="text" />
      </label>
      <div class="config-actions">
        <button id="configCancel" class="btn btn-ghost">Cancel</button>
        <button id="configSave" class="btn btn-primary">Save</button>
      </div>
    </div>
  `;
  document.body.append(configModal);

  const configInput = configModal.querySelector("#configSignalUrl") as HTMLInputElement;
  const configSave = configModal.querySelector("#configSave") as HTMLButtonElement;
  const configCancel = configModal.querySelector("#configCancel") as HTMLButtonElement;

  const statusColor = statusRow.querySelector("#statusColor") as HTMLSpanElement;
  const statusTurn = statusRow.querySelector("#statusTurn") as HTMLSpanElement;
  const readyBtn = actionsRow.querySelector("#readyBtn") as HTMLButtonElement;
  const startBtn = actionsRow.querySelector("#startBtn") as HTMLButtonElement;
  const undoBtn = actionsRow.querySelector("#undoBtn") as HTMLButtonElement;
  const restartBtn = actionsRow.querySelector("#restartBtn") as HTMLButtonElement;
  const requestText = requestBar.querySelector("#requestText") as HTMLSpanElement;
  const requestYes = requestBar.querySelector("#requestYes") as HTMLButtonElement;
  const requestNo = requestBar.querySelector("#requestNo") as HTMLButtonElement;
  const winnerText = winnerModal.querySelector("#winnerText") as HTMLDivElement;
  const winnerOk = winnerModal.querySelector("#winnerOk") as HTMLButtonElement;

  return {
    container,
    boardWrap,
    boardColumn,
    statusRow,
    actionsRow,
    requestBar,
    winnerModal,
    noticeToast,
    logPanel,
    logBody,
    configModal,
    configInput,
    configSave,
    configCancel,
    statusColor,
    statusTurn,
    readyBtn,
    startBtn,
    undoBtn,
    restartBtn,
    requestText,
    requestYes,
    requestNo,
    winnerText,
    winnerOk,
    startOverlay,
  };
};
