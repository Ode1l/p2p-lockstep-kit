import type { PeerEvent, PeerState } from "./state";
import { nextState } from "./state";
import type { SignalMessage } from "./signaling";

type Signaling = {
  send: (message: SignalMessage) => void;
  register: (peerId: string, handler: (message: SignalMessage) => void) => void;
};

export type PeerApi = {
  connect: (targetId: string) => Promise<void>;
  disconnect: () => void;
};

export class RtcPeer {
  private readonly id: string;
  private readonly pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;
  private remoteId: string | null = null;
  private requestedId: string | null = null;
  private state: PeerState = "passive";
  private readonly signaling: Signaling;

  public constructor(id: string, pc: RTCPeerConnection, signaling: Signaling) {
    this.id = id;
    this.pc = pc;
    this.signaling = signaling;
    this.signaling.register(id, (message) => {
      void this.handleSignal(message);
    });

    this.pc.addEventListener("connectionstatechange", () => {
      // eslint-disable-next-line no-console
      console.log(`[rtc:${this.id}] state=${this.pc.connectionState}`);
      if (this.pc.connectionState === "connected") {
        this.dispatch("CONNECTED");
      }
    });

    this.pc.addEventListener("icecandidate", (event) => {
      if (!event.candidate || !this.remoteId) {
        return;
      }
      const msg: SignalMessage = {
        from: this.id,
        to: this.remoteId,
        type: "ice",
        payload: event.candidate.toJSON(),
      };
      // eslint-disable-next-line no-console
      console.log(`[rtc:${this.id}] ice ->`, msg);
      this.signaling.send(msg);
    });

    this.pc.ondatachannel = (event) => {
      this.dc = event.channel;
      this.bindDataChannel();
    };
  }

  public connect = async (targetId: string) => {
    if (this.state !== "passive") {
      this.requestedId = targetId;
      this.disconnect();
      return;
    }
    this.remoteId = targetId;
    this.requestedId = null;
    this.dispatch("CONNECT");
  };

  public disconnect = () => {
    this.dispatch("DISCONNECT");
  };

  private bindDataChannel = () => {
    if (!this.dc) {
      return;
    }
    this.dc.onopen = () => {
      // eslint-disable-next-line no-console
      console.log(`[rtc:${this.id}] dc open`);
    };
    this.dc.onmessage = (event) => {
      // eslint-disable-next-line no-console
      console.log(`[rtc:${this.id}] message:`, event.data);
    };
  };

  private handleSignal = async (message: SignalMessage) => {
    const handlers: Record<SignalMessage["type"], () => Promise<void>> = {
      offer: async () => {
        this.remoteId = message.from;
        // eslint-disable-next-line no-console
        console.log(`[rtc:${this.id}] offer <-`, message);
        await this.pc.setRemoteDescription(
          message.payload as RTCSessionDescriptionInit,
        );
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        const reply: SignalMessage = {
          from: this.id,
          to: message.from,
          type: "answer",
          payload: answer,
        };
        // eslint-disable-next-line no-console
        console.log(`[rtc:${this.id}] answer ->`, reply);
        this.signaling.send(reply);
        this.dispatch("CONNECTED");
      },
      answer: async () => {
        await this.pc.setRemoteDescription(
          message.payload as RTCSessionDescriptionInit,
        );
        // eslint-disable-next-line no-console
        console.log(`[rtc:${this.id}] answer <-`, message);
        this.dispatch("CONNECTED");
      },
      ice: async () => {
        // eslint-disable-next-line no-console
        console.log(`[rtc:${this.id}] ice <-`, message);
        await this.pc.addIceCandidate(message.payload as RTCIceCandidateInit);
      },
    };

    await handlers[message.type]();
  };

  private dispatch = (event: PeerEvent) => {
    const next = nextState(this.state, event);
    if (this.state === next) {
      return;
    }
    this.state = next;
    // eslint-disable-next-line no-console
    console.log(`[rtc:${this.id}] state -> ${next}`);

    if (next === "requesting") {
      if (this.requestedId) {
        this.remoteId = this.requestedId;
        this.requestedId = null;
      }
      void this.startOffer();
      return;
    }

    if (next === "connected") {
      this.bindDataChannel();
    }

    if (next === "passive") {
      this.closeConnection();
      if (this.requestedId) {
        this.remoteId = this.requestedId;
        this.requestedId = null;
        this.dispatch("CONNECT");
      }
    }
  };

  private startOffer = async () => {
    if (!this.remoteId) {
      return;
    }
    this.dc = this.pc.createDataChannel("game", { ordered: true });
    this.bindDataChannel();

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    const msg: SignalMessage = {
      from: this.id,
      to: this.remoteId,
      type: "offer",
      payload: offer,
    };
    // eslint-disable-next-line no-console
    console.log(`[rtc:${this.id}] offer ->`, msg);
    this.signaling.send(msg);
  };

  private closeConnection = () => {
    this.dc?.close();
    this.dc = null;
    this.remoteId = null;
  };
}

export const createPeer = (
  id: string,
  pc: RTCPeerConnection,
  signaling: Signaling,
): PeerApi => {
  const peer = new RtcPeer(id, pc, signaling);
  return { connect: peer.connect, disconnect: peer.disconnect };
};
