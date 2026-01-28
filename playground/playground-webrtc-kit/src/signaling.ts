export type SignalType = "offer" | "answer" | "ice";

export type SignalMessage = {
  from: string;
  to: string;
  type: SignalType;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
};

export type SignalHandler = (message: SignalMessage) => void;

export const createLocalSignaling = () => {
  const handlers = new Map<string, SignalHandler>();

  const register = (peerId: string, handler: SignalHandler) => {
    handlers.set(peerId, handler);
  };

  const send = (message: SignalMessage) => {
    const target = handlers.get(message.to);
    if (!target) {
      // eslint-disable-next-line no-console
      console.warn(`[signal] target not found: ${message.to}`);
      return;
    }
    target(message);
  };

  return { register, send };
};
