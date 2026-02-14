export const createDesktopStyles = () => {
  const styleId = "p2p-lockstep-kit-desktop-shell";
  if (document.getElementById(styleId)) {
    return;
  }
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    :root {
      font-family: "Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .desktop-shell {
      display: grid;
      grid-template-columns: 360px minmax(520px, 1fr);
      min-height: 100vh;
      padding: 32px;
      box-sizing: border-box;
      background: linear-gradient(135deg, #1b1d21 0%, #23262d 45%, #111217 100%);
      color: #f6f7fb;
      gap: 32px;
    }
    .desktop-shell__sidebar {
      background: rgba(11, 12, 15, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
    }
    .desktop-shell__header {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .desktop-shell__title {
      font-size: 24px;
      font-weight: 600;
    }
    .desktop-shell__subtitle {
      font-size: 13px;
      color: rgba(246, 247, 251, 0.75);
      cursor: pointer;
      user-select: all;
    }
    .desktop-shell__field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .desktop-shell__field label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(246, 247, 251, 0.65);
    }
    .desktop-shell__inputs {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .desktop-shell__inputs input {
      flex: 1;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.04);
      color: #f6f7fb;
      font-size: 14px;
    }
    .desktop-shell__inputs button,
    .desktop-shell__btn {
      border: none;
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
      color: #0a0b0f;
      background: #f6c35c;
    }
    .desktop-shell__inputs button:disabled,
    .desktop-shell__btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .desktop-shell__share {
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 16px;
      display: grid;
      gap: 12px;
      background: rgba(255, 255, 255, 0.03);
    }
    .desktop-shell__share canvas {
      width: 210px;
      height: 210px;
      background: #fff;
      border-radius: 12px;
      margin: 0 auto;
    }
    .desktop-shell__status {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(246, 247, 251, 0.7);
    }
    .desktop-shell__status span {
      font-size: 14px;
      color: #f6f7fb;
      letter-spacing: normal;
      text-transform: none;
      font-weight: 600;
    }
    .desktop-shell__controls {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .desktop-shell__controls button.primary {
      background: #6dd5fa;
      color: #0a0b0f;
    }
    .desktop-shell__controls button.secondary {
      background: rgba(255, 255, 255, 0.08);
      color: #f6f7fb;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .desktop-shell__notice {
      min-height: 32px;
      font-size: 13px;
      color: #ffd966;
    }
    .desktop-shell__log {
      flex: 1;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.25);
      overflow: auto;
      font-size: 12px;
      max-height: 220px;
    }
    .desktop-shell__log.hidden {
      display: none;
    }
    .desktop-shell__log-body > div {
      padding: 4px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }
    .desktop-shell__board {
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      min-height: 600px;
      padding: 20px;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
    }
    .desktop-shell.single .desktop-shell__board {
      display: none;
    }
    .desktop-shell__modal {
      position: fixed;
      inset: 0;
      background: rgba(5, 6, 8, 0.75);
      display: grid;
      place-items: center;
      z-index: 10000;
    }
    .desktop-shell__modal.hidden {
      display: none;
    }
    .desktop-shell__modal-card {
      background: #1f2126;
      border-radius: 16px;
      padding: 28px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      min-width: 320px;
      display: grid;
      gap: 18px;
      text-align: center;
    }
    .desktop-shell__modal-actions {
      display: flex;
      justify-content: center;
      gap: 16px;
    }
    .desktop-shell__modal-actions button {
      flex: 1;
    }
  `;
  document.head.appendChild(style);
};
