import "../style.css";
import "p2p-lockstep-kit-ui";
import "p2p-lockstep-kit-ui/style.css";
import type { P2PLockstepAppElement } from "p2p-lockstep-kit-ui";
import { mountGomokuDemo } from "./demo.js";
import { shouldShowPairingScreen } from "./screen-routing.js";

type ResumableLockstepAppElement = P2PLockstepAppElement & {
  resumeConnection?: () => void;
};

const installPageResumeRecovery = (
  app: ResumableLockstepAppElement,
  runtime: NonNullable<ReturnType<P2PLockstepAppElement["getRuntime"]>>,
) => {
  let pageWasHidden = false;

  const hasActiveSession = () => {
    const snapshot = runtime.observer.getSnapshot();
    return Boolean(
      snapshot &&
        (snapshot.connected ||
          snapshot.lastStart ||
          snapshot.history.length > 0 ||
          snapshot.localState !== "idle" ||
          snapshot.remoteState !== "idle"),
    );
  };

  const recover = () => {
    if (!hasActiveSession()) {
      return;
    }
    if (typeof app.resumeConnection === "function") {
      app.resumeConnection();
      return;
    }

    // UI versions before resumeConnection relied on a fresh page bootstrap.
    window.location.reload();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      pageWasHidden = true;
      return;
    }
    if (!pageWasHidden) {
      return;
    }
    pageWasHidden = false;
    recover();
  };

  const handlePageShow = (event: PageTransitionEvent) => {
    if (event.persisted) {
      recover();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pageshow", handlePageShow);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("pageshow", handlePageShow);
  };
};

const installLegacyConnectionScreenGuard = (
  app: ResumableLockstepAppElement,
  runtime: NonNullable<ReturnType<P2PLockstepAppElement["getRuntime"]>>,
) => {
  if (typeof app.resumeConnection === "function") {
    return () => {};
  }

  const syncScreen = (
    snapshot: ReturnType<typeof runtime.observer.getSnapshot>,
    connected = snapshot?.connected ?? false,
  ) => {
    const pairingPage = app.querySelector("p2p-lockstep-pairing-page");
    const gamePage = app.querySelector("p2p-lockstep-game-page");
    if (!pairingPage || !gamePage) {
      return;
    }

    const showPairing = shouldShowPairingScreen(snapshot, connected);

    pairingPage.toggleAttribute("hidden", !showPairing);
    gamePage.toggleAttribute("hidden", showPairing);
  };

  syncScreen(runtime.observer.getSnapshot());

  return runtime.observer.subscribe({
    onStateChange: syncScreen,
    onConnectionChange: (connected: boolean) => {
      syncScreen(runtime.observer.getSnapshot(), connected);
    },
  });
};

const start = async () => {
  await customElements.whenDefined("p2p-lockstep-app");

  const app = document.querySelector<P2PLockstepAppElement>(
    "p2p-lockstep-app",
  );
  const mount = app?.getBoardHost();
  const runtime = app?.getRuntime();

  if (!mount || !runtime) {
    throw new Error("Unable to initialize the Gomoku application shell.");
  }

  const unmount = mountGomokuDemo({ mount, runtime });
  const removePageResumeRecovery = installPageResumeRecovery(app, runtime);
  const removeLegacyConnectionScreenGuard =
    installLegacyConnectionScreenGuard(app, runtime);
  import.meta.hot?.dispose(() => {
    removeLegacyConnectionScreenGuard();
    removePageResumeRecovery();
    unmount();
  });
};

void start();
