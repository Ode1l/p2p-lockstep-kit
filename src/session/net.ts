import type { NetworkClient } from 'p2p-lockstep-kit-network';
import { parseSessionMessage, type SessionMessage } from '../utils';
import type { BusMessageType, CommandBus } from './commandBus';

/**
 * Network client wrapper that bridges NetworkClient with CommandBus
 * Handles message encoding/decoding and connection state monitoring
 */
export class NetClient {
  private localPeerId: string | null;
  private remotePeerId: string | null;
  private isConnected: boolean = false;
  private connectionChangeListener: (isConnected: boolean) => void = () => {};
  private mediaStateListener: (active: boolean) => void = () => {};

  public constructor(
    private readonly client: NetworkClient,
    private readonly bus: CommandBus,
    peerId: string | null,
  ) {
    this.localPeerId = peerId ?? null;
    this.remotePeerId = null;

    // Forward incoming messages to the command bus
    this.client.onMessage((data) => {
      const message = parseSessionMessage(data);
      if (!message || typeof message !== 'object' || !message.type) {
        return;
      }
      this.bus.dispatch({
        ...(message as SessionMessage),
        type: message.type as BusMessageType,
        from: 'remote',
      });
    });

    // Monitor connection state and emit ONLINE/OFFLINE events
    this.client.onStateChange((state) => {
      const wasConnected = this.isConnected;
      this.isConnected = state === 'connected';

      // Notify listeners of connection state change
      this.connectionChangeListener(this.isConnected);

      // Only emit ONLINE/OFFLINE once when state changes
      if (this.isConnected && !wasConnected) {
        this.bus.emit('ONLINE', undefined, 'local');
      } else if (!this.isConnected && wasConnected) {
        this.bus.emit('OFFLINE', undefined, 'local');
      }
    });

    // Monitor remote media stream availability
    this.client.onRemoteStream((stream) => {
      const active =
        !!stream &&
        stream.getTracks().some((track) => track.readyState === 'live');
      this.mediaStateListener(active);
    });
  }

  /**
   * Send a message to the remote peer
   * Drops message if not connected and logs warning
   */
  public send(message: SessionMessage) {
    if (!this.isConnected) {
      console.warn(
        '[NetClient] Cannot send message: not connected',
        message.type,
      );
      return;
    }

    const enriched: SessionMessage = {
      ...message,
      from: message.from ?? this.localPeerId ?? '',
    };
    this.client.send(enriched);
  }

  /**
   * Update local and remote peer IDs
   */
  public setPeerIds(ids: { local?: string | null; remote?: string | null }) {
    if (ids.local !== undefined) {
      this.localPeerId = ids.local;
    }
    if (ids.remote !== undefined) {
      this.remotePeerId = ids.remote;
    }
  }

  /**
   * Get current peer IDs
   */
  public getPeerIds() {
    return { local: this.localPeerId, remote: this.remotePeerId };
  }

  /**
   * Check if currently connected to peer
   */
  public getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Monitor connection state changes
   * @param handler Called when connection state changes (true=connected, false=disconnected)
   */
  public onConnectionChange(handler: (isConnected: boolean) => void) {
    this.connectionChangeListener = handler;
    // Immediately call with current state if already have a state
    handler(this.isConnected);
  }

  /**
   * Monitor remote media stream state changes
   * @param handler Called when remote media becomes available or unavailable
   */
  public onMediaStateChange(handler: (active: boolean) => void) {
    this.mediaStateListener = handler;
  }
}

export const createNetClient = (
  client: NetworkClient,
  bus: CommandBus,
  peerId: string | null,
) => new NetClient(client, bus, peerId);
