export const createStyles = () => {
  const style = document.createElement("style");
  style.textContent = `
    :root {
      color-scheme: light;
      font-family: "Space Grotesk", "IBM Plex Sans", "Segoe UI", sans-serif;
      background: #f6f1e7;
      color: #1f1b16;
    }
    html, body {
      margin: 0;
      padding: 0;
      min-height: 100%;
    }
    html {
      -webkit-text-size-adjust: 100%;
    }
    #app {
      min-height: 100dvh;
    }
    body {
      padding: 24px;
      background:
        radial-gradient(1200px 600px at 12% 10%, rgba(255, 255, 255, 0.7), transparent 60%),
        radial-gradient(900px 500px at 90% 20%, rgba(235, 214, 180, 0.6), transparent 55%),
        radial-gradient(700px 700px at 30% 85%, rgba(210, 190, 160, 0.5), transparent 60%),
        linear-gradient(180deg, #f9f3e8 0%, #efe3ce 100%);
      background-attachment: fixed;
    }
    .app {
      display: grid;
      grid-template-columns: minmax(320px, 420px) minmax(520px, 1fr);
      gap: 28px;
      align-items: start;
    }
    .panel {
      background: linear-gradient(165deg, rgba(255, 255, 255, 0.58), rgba(250, 245, 235, 0.42));
      border: 1px solid rgba(255, 255, 255, 0.6);
      border-radius: 22px;
      padding: 16px;
      box-shadow: 0 18px 40px rgba(15, 12, 8, 0.12);
      backdrop-filter: blur(18px) saturate(140%);
      -webkit-backdrop-filter: blur(18px) saturate(140%);
      display: grid;
      gap: 14px;
    }
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .panel-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .panel-title {
      display: grid;
      gap: 4px;
    }
    .game-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: rgba(31, 27, 22, 0.55);
      font-weight: 600;
    }
    .game-title {
      font-size: 22px;
      font-weight: 700;
    }
    .game-subtitle {
      font-size: 12px;
      color: rgba(31, 27, 22, 0.55);
      letter-spacing: 0.04em;
      word-break: break-all;
      cursor: pointer;
    }
    .icon-btn {
      border: 1px solid rgba(31, 27, 22, 0.2);
      background: rgba(255, 255, 255, 0.55);
      color: #1f1b16;
      font-size: 14px;
      font-weight: 700;
      padding: 6px 10px;
      border-radius: 999px;
      cursor: pointer;
      display: grid;
      place-items: center;
      min-width: 34px;
      min-height: 34px;
    }
    .icon {
      width: 16px;
      height: 16px;
    }
    .icon-refresh {
      opacity: 0.75;
    }
    .icon-dots {
      font-size: 18px;
      line-height: 1;
      letter-spacing: 2px;
      transform: translateY(-1px);
    }
    .panel-grid {
      display: grid;
      gap: 12px;
      grid-template-columns: 1fr;
    }
    .panel-card {
      background: rgba(255, 255, 255, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.45);
      border-radius: 16px;
      padding: 14px;
      display: grid;
      gap: 12px;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }
    .card-primary {
      border: 1px solid rgba(255, 255, 255, 0.7);
      background: rgba(255, 255, 255, 0.62);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.8);
    }
    .panel input {
      border: 1px solid rgba(31, 27, 22, 0.2);
      background: #fff;
      padding: 10px 12px;
      border-radius: 12px;
      font-size: 14px;
      min-width: 0;
    }
    .config-card input {
      font-size: 16px;
    }
    .btn {
      border: none;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-primary {
      background: rgba(31, 27, 22, 0.85);
      color: #fff;
    }
    .btn-ghost {
      background: rgba(255, 255, 255, 0.55);
      color: #1f1b16;
      border: 1px solid rgba(31, 27, 22, 0.12);
    }
    .card-primary canvas {
      width: 180px;
      height: 180px;
      background: #fff;
      border-radius: 14px;
      border: none;
      place-self: center;
    }
    .panel-advanced {
      display: grid;
      gap: 6px;
      opacity: 0.7;
      display: none;
    }
    .advanced-label {
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(31, 27, 22, 0.5);
    }
    .panel.show-advanced .panel-advanced {
      display: grid;
    }
    .config-modal {
      position: fixed;
      inset: 0;
      background: rgba(18, 16, 12, 0.35);
      display: grid;
      place-items: center;
      z-index: 9999;
      backdrop-filter: blur(10px);
      padding: 16px;
      box-sizing: border-box;
    }
    .config-modal.hidden {
      display: none;
    }
    .config-card {
      width: min(420px, 92vw);
      max-width: calc(100vw - 32px);
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.7);
      border-radius: 18px;
      padding: 18px;
      display: grid;
      gap: 12px;
      box-shadow: 0 24px 60px rgba(12, 10, 8, 0.25);
      backdrop-filter: blur(18px);
      box-sizing: border-box;
    }
    .config-title {
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-size: 12px;
      color: rgba(31, 27, 22, 0.6);
    }
    .config-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    .board-wrapper {
      background: radial-gradient(circle at top, #f5d9a6 0%, #e5bf7b 40%, #d8aa63 100%);
      padding: 18px;
      border-radius: 24px;
      box-shadow: inset 0 0 0 2px rgba(90, 70, 40, 0.2);
      display: inline-block;
      justify-self: start;
      width: fit-content;
      max-width: 100%;
      position: relative;
    }
    .board-column {
      display: flex;
      flex-direction: column;
      gap: 14px;
      align-items: flex-start;
    }
    .match-status {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 13px;
      color: rgba(31, 27, 22, 0.7);
    }
    .match-status strong {
      color: #1f1b16;
    }
    .match-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: center;
      align-items: center;
      width: 100%;
    }
    .match-actions .btn {
      text-transform: none;
      font-size: 14px;
      letter-spacing: 0.02em;
      padding: 10px 16px;
    }
    .match-request {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(10, 10, 10, 0.35);
      backdrop-filter: blur(8px);
      z-index: 9998;
      padding: 16px;
      box-sizing: border-box;
    }
    .match-request.show {
      display: flex;
    }
    .match-request-card {
      display: grid;
      gap: 12px;
      padding: 16px 18px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(31, 27, 22, 0.12);
      box-shadow: 0 16px 40px rgba(12, 10, 8, 0.2);
      width: min(360px, 92vw);
      max-height: 80vh;
      overflow: auto;
    }
    .match-request-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    .start-overlay {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #1f1b16;
      background: rgba(255, 255, 255, 0.6);
      opacity: 0;
      pointer-events: none;
    }
    .start-overlay.play {
      animation: start-pop 1.2s ease-out forwards;
    }
    .notice-toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(31, 27, 22, 0.92);
      color: #fff;
      font-size: 13px;
      letter-spacing: 0.02em;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      z-index: 9999;
    }
    .notice-toast.show {
      opacity: 1;
    }
    @keyframes start-pop {
      0% { opacity: 0; transform: scale(0.96); }
      30% { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.02); }
    }
    .board-wrapper canvas {
      display: block;
      width: 100%;
      height: auto;
      touch-action: none;
    }
    @media (max-width: 1024px) {
      .app { grid-template-columns: 1fr; }
      .panel { order: 1; }
      .board-wrapper { order: 2; }
    }
    @media (max-width: 760px) and (orientation: portrait) {
      body { padding: 16px; }
      .panel-grid { grid-template-columns: 1fr; }
      .panel-card { padding: 14px; }
      .card-primary canvas { width: 150px; height: 150px; }
      .app {
        grid-template-columns: 1fr;
        gap: 18px;
      }
      .config-card {
        width: 100%;
        max-width: 100%;
      }
      .panel input {
        font-size: 16px;
      }
      .game-title {
        font-size: 18px;
      }
      .game-subtitle {
        font-size: 11px;
      }
      .btn {
        font-size: 12px;
        padding: 9px 12px;
      }
      .match-status {
        font-size: 12px;
      }
    }
    @media (max-width: 900px) and (orientation: landscape) {
      body { padding: 16px; }
      .app { grid-template-columns: minmax(260px, 340px) 1fr; }
      .panel-grid { grid-template-columns: 1fr; }
    }
    @media (min-width: 900px) {
      .panel-grid {
        grid-template-columns: 1fr 1fr;
      }
      .card-primary {
        grid-column: span 1;
      }
      .card-join {
        grid-column: span 1;
      }
      .card-id {
        grid-column: span 2;
      }
    }
    .debug-log {
      position: fixed;
      bottom: 12px;
      left: 12px;
      right: 12px;
      max-height: 40vh;
      background: rgba(10, 10, 10, 0.7);
      color: #f5f5f5;
      font-size: 12px;
      border-radius: 12px;
      padding: 10px;
      overflow: auto;
      z-index: 9999;
      backdrop-filter: blur(8px);
    }
    .debug-log.hidden {
      display: none;
    }
    .debug-title {
      font-weight: 700;
      margin-bottom: 6px;
    }
    .debug-body div {
      margin-bottom: 4px;
      opacity: 0.9;
    }
  `;
  document.head.append(style);
};
