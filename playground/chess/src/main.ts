import "../style.css";
import "p2p-lockstep-kit-ui";
import "p2p-lockstep-kit-ui/style.css";
import type { P2PLockstepAppElement } from "p2p-lockstep-kit-ui";
import { mountChess } from "./demo.js";

const start = async () => {
  await customElements.whenDefined("p2p-lockstep-app");
  const app = document.querySelector<P2PLockstepAppElement>("p2p-lockstep-app");
  const mount = app?.getBoardHost();
  const runtime = app?.getRuntime();
  if (!mount || !runtime) throw new Error("Unable to initialize the chess application shell.");
  const unmount = mountChess({ mount, runtime });
  import.meta.hot?.dispose(unmount);
};

void start();
