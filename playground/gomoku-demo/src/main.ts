import { createShell } from "../../../src/shell";
import { createShellUi } from "../../../src/shell/ui";
import { gomokuPlugin } from "./gomoku-plugin";
import signalingConfig from "../../signaling-server/configuration.json";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app");
}

const defaultHost =
  signalingConfig.signalingHost === "0.0.0.0"
    ? window.location.hostname || "localhost"
    : signalingConfig.signalingHost;
const defaultSignalUrl = `ws://${defaultHost}:${signalingConfig.signalingPort}`;
const shellUi = createShellUi({ defaultSignalUrl });
app.append(shellUi.elements.container);

const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
const urlParam = hashParams.get("url");
const idParam = hashParams.get("id");
if (urlParam) {
  shellUi.panel.refs.signalUrl.value = urlParam;
}
if (idParam) {
  shellUi.panel.refs.targetId.value = idParam;
}

const shell = createShell({
  mount: shellUi.elements.boardWrap,
  plugin: gomokuPlugin,
  ui: {
    updatePanel: shellUi.updatePanel,
  },
});

shellUi.panel.bindEvents({
  onConnect: shell.onConnect,
  onShare: async () =>
    shellUi.shareLink({
      peerId: shellUi.panel.refs.peerId.textContent || "",
      signalUrl: shellUi.panel.refs.signalUrl.value,
      title: "Gomoku",
    }),
});

shell.start({
  autoRegisterUrl: shellUi.panel.refs.signalUrl.value,
  autoConnectId: idParam ?? undefined,
});
