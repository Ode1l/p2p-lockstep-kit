import "./index";
import type { P2PLockstepAppElement } from "./app-shell";

window.addEventListener("DOMContentLoaded", () => {
  const app = document.querySelector("p2p-lockstep-app") as P2PLockstepAppElement | null;
  const mount = app?.getBoardHost();
  if (!mount || mount.childElementCount > 0) {
    return;
  }

  const placeholder = document.createElement("div");
  placeholder.className =
    "flex h-full min-h-[22rem] items-center justify-center px-6 text-center text-sm text-slate-300";
  placeholder.textContent = "Board logic will mount here once the actual game plugin is wired in.";
  mount.append(placeholder);
});
