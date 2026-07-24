import "./style.css";
import { P2PLockstepMultiAppElement } from "./app-shell.js";

export const defineP2PLockstepMultiUi = (): void => {
  if (
    typeof globalThis.customElements !== "undefined" &&
    !globalThis.customElements.get("p2p-lockstep-multi-app")
  ) {
    globalThis.customElements.define(
      "p2p-lockstep-multi-app",
      P2PLockstepMultiAppElement,
    );
  }
};

defineP2PLockstepMultiUi();

export { P2PLockstepMultiAppElement } from "./app-shell.js";
export { LiveTableController, selectRandomSeat } from "./runtime/controller.js";
export { DEFAULT_DISPLAY_NAME, DEFAULT_SIGNAL_URL, DISPLAY_NAME_MAX_LENGTH } from "./config.js";
export { buildInvitationUrl, readHostPeerIdFromUrl } from "./utils/share.js";
export { normalizeDisplayName, readStoredDisplayName, storeDisplayName } from "./utils/profile.js";
export type {
  MultiTableController,
  MultiTableView,
  MultiUiGame,
  MultiUiOptions,
  MultiUiRuntime,
} from "./types.js";
