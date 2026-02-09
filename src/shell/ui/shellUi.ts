import { createPanel } from "./panel";
import QRCode from "qrcode";

type PanelInfo = {
  peerId: string;
  connected: boolean;
  gameTitle: string;
};

export type ShellUiBundle = {
  elements: {
    container: HTMLDivElement;
    boardWrap: HTMLDivElement;
  };
  panel: ReturnType<typeof createPanel>;
  updatePanel: (info: PanelInfo) => void;
  shareLink: (options: { peerId: string; signalUrl: string; title?: string }) => Promise<void>;
};

const createStyles = () => {
  const style = document.createElement("style");
  style.textContent = `
    :root {
      color-scheme: light;
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      background: #f3efe8;
      color: #2a2621;
    }
    body { margin: 0; padding: 24px; }
    .app {
      display: grid;
      grid-template-columns: minmax(320px, 380px) minmax(480px, 1fr);
      gap: 24px;
      align-items: start;
    }
    .panel {
      background: #fff8ec;
      border: 1px solid #d7c9b2;
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 12px 30px rgba(25, 20, 15, 0.08);
    }
    .panel-section { margin-bottom: 16px; }
    .panel-row {
      display: grid;
      grid-template-columns: 120px minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .panel-row label { font-weight: 600; }
    .panel input {
      border: 1px solid #cbbba3;
      background: #fffdf8;
      padding: 6px 8px;
      border-radius: 8px;
      font-size: 13px;
      min-width: 0;
    }
    .panel button {
      border: none;
      padding: 8px 12px;
      border-radius: 8px;
      background: #3f352c;
      color: #fff;
      font-size: 13px;
      cursor: pointer;
      margin-right: 4px;
      justify-self: start;
    }
    .panel button:focus-visible {
      outline: 2px solid #2a2621;
      outline-offset: 2px;
    }
    .panel button:focus {
      outline: none;
    }
    .board-wrapper {
      background: linear-gradient(135deg, #f0d6a3, #e4c58d);
      padding: 16px;
      border-radius: 20px;
      box-shadow: inset 0 0 0 2px rgba(90, 70, 40, 0.2);
      display: inline-block;
      justify-self: start;
      width: fit-content;
      max-width: 100%;
      position: relative;
    }
    .board-wrapper canvas {
      display: block;
      width: 100%;
      height: auto;
      touch-action: none;
    }
    @media (max-width: 900px) {
      .app { grid-template-columns: 1fr; }
      .panel-row { grid-template-columns: 1fr; }
      .panel-row button { width: 100%; }
    }
  `;
  document.head.append(style);
};

export const createShellUi = (options?: { defaultSignalUrl?: string }): ShellUiBundle => {
  createStyles();

  const panel = createPanel();
  if (options?.defaultSignalUrl) {
    panel.refs.signalUrl.value = options.defaultSignalUrl;
  }

  const container = document.createElement("div");
  container.className = "app";
  const boardWrap = document.createElement("div");
  boardWrap.className = "board-wrapper";
  container.append(panel.refs.root, boardWrap);

  let lastPeerId = "";

  const updatePanel = (info: PanelInfo) => {
    lastPeerId = info.peerId || "";
    panel.refs.peerId.textContent = info.peerId || "-";
    panel.refs.gameTitle.textContent = info.gameTitle || "-";
    panel.refs.status.textContent = info.connected ? "connected" : "idle";
    void updateQr();
  };

  const buildShareUrl = (peerId: string, signalUrl: string) => {
    const url = new URL(window.location.href);
    const shareParams = new URLSearchParams();
    shareParams.set("id", peerId);
    shareParams.set("url", signalUrl);
    url.hash = shareParams.toString();
    return url.toString();
  };

  const updateQr = async () => {
    const peerId = lastPeerId;
    const signalUrl = panel.refs.signalUrl.value;
    const canvas = panel.refs.shareQr;
    const ctx = canvas.getContext("2d");
    if (!peerId || peerId === "-") {
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    const shareUrl = buildShareUrl(peerId, signalUrl);
    try {
      await QRCode.toCanvas(canvas, shareUrl, { width: 160, margin: 1 });
    } catch (err) {
      console.log("[shell-ui] QR render failed", err);
    }
  };

  panel.refs.signalUrl.addEventListener("input", () => {
    void updateQr();
  });

  const shareLink = async (options: { peerId: string; signalUrl: string; title?: string }) => {
    const { peerId, signalUrl, title } = options;
    if (!peerId || peerId === "-") {
      console.log("[shell-ui] Register first to get a peer id.");
      return;
    }
    const shareUrl = buildShareUrl(peerId, signalUrl);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        console.log("[shell-ui] Share link copied.");
        return;
      }
    } catch {
      // fall through to manual copy
    }
    window.prompt(title ?? "Copy link", shareUrl);
  };

  return {
    elements: { container, boardWrap },
    panel,
    updatePanel,
    shareLink,
  };
};
