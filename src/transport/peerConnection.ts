import { Configuration } from "./configuration.ts";
import { createDataChannel, listenChannel, sendOnChannel } from "./dataChannel";
import { attachIceHandlers, addRemoteIceCandidate } from "./iceCandidate";
import { createSdpHandlers } from "./sdp";
import type { rtcPeer, rtcPeerCore, SignalMessage, SignalSender } from "./peerTypes.ts";

export class RtcPeer implements rtcPeer {
  public readonly id: string;
  public readonly pc: RTCPeerConnection;
  public readonly inbox: string[];
  public dc: RTCDataChannel | null = null;
  private core: rtcPeerCore;
  private sdp: ReturnType<typeof createSdpHandlers>;
  private makingOffer = false;
  private ignoreOffer = false;
  private polite = false;
  private signalSend: SignalSender | null = null;

  public constructor(id: string) {
    this.id = id;
    this.pc = new RTCPeerConnection(Configuration);
    this.inbox = [];
    this.core = {
      id,
      pc: this.pc,
      dc: null,
      inbox: this.inbox,
    };

    this.sdp = createSdpHandlers(this.core, () => {
      createDataChannel(this.core, this.setDc);
    });

    this.pc.addEventListener("negotiationneeded", async () => {
      if (!this.signalSend) {
        return;
      }
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription(await this.pc.createOffer());
        this.signalSend({ description: this.pc.localDescription ?? undefined });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[rtc] negotiationneeded failed", err);
      } finally {
        this.makingOffer = false;
      }
    });

    this.pc.addEventListener("connectionstatechange", () => {
      console.log(`[rtc:${id}] pc change. state: ${this.pc.connectionState}`);
      if (this.pc.connectionState === "connected") {
        // eslint-disable-next-line no-console
        console.log(`[rtc:${id}] peers connected`);
      }
    });
  }

  private setDc = (channel: RTCDataChannel) => {
    this.dc = channel;
    this.core.dc = channel;
  };

  public listenChannel = () => listenChannel(this.core, this.setDc);

  public setSignaling = (sender: SignalSender, polite: boolean) => {
    this.signalSend = sender;
    this.polite = polite;
    this.pc.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        sender({ candidate: event.candidate.toJSON() });
      }
    });
  };

  public handleSignalMessage = async (message: SignalMessage) => {
    if (message.description) {
      const description = message.description;
      const offerCollision =
        description.type === "offer" &&
        (this.makingOffer || this.pc.signalingState !== "stable");
      this.ignoreOffer = !this.polite && offerCollision;
      if (this.ignoreOffer) {
        return;
      }
      if (description.type === "offer" && this.pc.signalingState !== "stable") {
        await this.pc.setLocalDescription({ type: "rollback" });
      }
      await this.pc.setRemoteDescription(description);
      if (description.type === "offer") {
        await this.pc.setLocalDescription(await this.pc.createAnswer());
        this.signalSend?.({ description: this.pc.localDescription ?? undefined });
      }
    } else if (message.candidate) {
      try {
        await this.pc.addIceCandidate(message.candidate);
      } catch (err) {
        if (!this.ignoreOffer) {
          throw err;
        }
      }
    }
  };

  public linkIce = (target: rtcPeer) => {
    attachIceHandlers(this.pc, (candidate) => {
      void target.receiveIce(candidate);
    });
  };

  public receiveIce = async (candidate: RTCIceCandidate) => {
    await addRemoteIceCandidate(this.pc, candidate);
  };

  public createOffer = () => this.sdp.createOffer();

  public acceptOffer = (offer: RTCSessionDescriptionInit) =>
    this.sdp.acceptOffer(offer);

  public acceptAnswer = (answer: RTCSessionDescriptionInit) =>
    this.sdp.acceptAnswer(answer);

  public send = (data: string) => {
    this.core.dc = this.dc;
    sendOnChannel(this.core, data);
  };

  public close = () => {
    this.dc?.close();
    this.pc.close();
    // eslint-disable-next-line no-console
    console.log(`[rtc:${this.id}] closed`);
  };
}

export const createRtcPeer = (id: string): rtcPeer => new RtcPeer(id);
