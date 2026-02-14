import type { StartPayload } from "../../utils";

export const createStartHandler = (hooks: {
  startMatch: (myColor: 1 | 2) => void;
  setLastStartSenderColor: (color: 1 | 2) => void;
  getLastStartSenderColor: () => 1 | 2 | null;
  canStart: () => boolean;
  sendStart: (payload: StartPayload) => void;
}) => {
  const {
    startMatch,
    setLastStartSenderColor,
    getLastStartSenderColor,
    canStart,
    sendStart,
  } = hooks;

  return (payload: StartPayload, origin: "local" | "remote") => {
    if (origin === "local") {
      if (!canStart()) {
        return;
      }
      const last = getLastStartSenderColor();
      const senderColor = last ? (last === 1 ? 2 : 1) : Math.random() < 0.5 ? 1 : 2;
      const receiverColor = senderColor === 1 ? 2 : 1;
      setLastStartSenderColor(senderColor);
      sendStart({ senderColor, receiverColor, firstPlayer: 1 });
      startMatch(senderColor);
      return;
    }
    setLastStartSenderColor(payload.senderColor);
    startMatch(payload.receiverColor);
  };
};
