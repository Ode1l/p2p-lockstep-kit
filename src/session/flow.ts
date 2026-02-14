import type { NetAdapter } from "./net";
import type { ShellUi } from "../game/types";
import type { Logger } from '../utils';
import type { RegisterPolicy } from "./policy";

// Session Flow (flow): owns register/connect/disconnect orchestration.
// Responsibilities:
// - Handle register lifecycle + retry policy integration.
// - Initiate outbound connections and assign caller role.
// - Provide a minimal imperative API for the shell.
export type SessionFlow = {
  start: (options?: { autoRegisterUrl?: string; autoConnectId?: string }) => void;
  register: (url: string) => void;
  connect: (targetId: string) => Promise<void>;
};

type FlowState = {
  peer: {
    setId: (id: string) => void;
  };
  render: () => void;
};

export const createSessionFlow = (deps: {
  net: NetAdapter;
  state: FlowState;
  ui: ShellUi;
  logger: Logger;
  registerPolicy: RegisterPolicy;
  shouldRetry?: (error: unknown) => boolean;
}): SessionFlow => {
  const { net, state, ui, logger, registerPolicy, shouldRetry } = deps;

  let pendingAutoConnectId: string | null = null;

  const register = (url: string) => {
    logger.info("[shell] register start", url);
    ui.log?.(`[shell] register start ${url}`);
    registerPolicy.run(url, {
      register: net.register,
      onSuccess: (id) => {
        state.peer.setId(id);
        logger.info("[shell] registered", id);
        ui.log?.(`[shell] registered ${id}`);
        state.render();
        if (pendingAutoConnectId) {
          void connect(pendingAutoConnectId);
          pendingAutoConnectId = null;
        }
      },
      onFailure: (error) => {
        logger.warn("[shell] register failed", error);
        ui.log?.("[shell] register failed, retrying");
        state.peer.setId("");
        state.render();
      },
      onRetry: (delayMs, error) => {
        logger.info("[shell] register retry scheduled", { delayMs, error });
      },
      shouldRetry,
    });
  };

  const connect = async (targetId: string) => {
    if (!targetId) {
      return;
    }
    await net.connect(targetId);
    logger.info("[shell] connecting", targetId);
    ui.log?.(`[shell] connecting ${targetId}`);
  };

  const start = (options?: { autoRegisterUrl?: string; autoConnectId?: string }) => {
    if (options?.autoConnectId) {
      pendingAutoConnectId = options.autoConnectId;
    }
    if (options?.autoRegisterUrl) {
      register(options.autoRegisterUrl);
    }
  };

  return {
    start,
    register,
    connect,
  };
};
