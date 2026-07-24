import type { JsonValue } from "../utils/serialization/json";
import type {
  MultiSessionActions,
  MultiSessionObserverApi,
  MultiSessionOptions,
} from "./api";
import { Session } from "./session";

export interface MultiSession<
  TCommand extends JsonValue = JsonValue,
  TGameSnapshot extends JsonValue = JsonValue,
> {
  readonly actions: MultiSessionActions<TCommand>;
  readonly observer: MultiSessionObserverApi<TGameSnapshot>;
  readonly isHost: boolean;
  start(): Promise<void>;
  idle(): Promise<void>;
  dispose(): void;
}

export const createMultiSession = <
  TCommand extends JsonValue,
  TEventPayload extends JsonValue,
  TGameState,
  TGameSnapshot extends JsonValue,
>(
  options: MultiSessionOptions<
    TCommand,
    TEventPayload,
    TGameState,
    TGameSnapshot
  >,
): MultiSession<TCommand, TGameSnapshot> => {
  const session = new Session(options);
  return Object.freeze({
    actions: session.actions,
    observer: session.observer,
    isHost: session.isHost,
    start: () => session.start(),
    idle: () => session.idle(),
    dispose: () => session.dispose(),
  });
};

export * from "./ids";
export {
  parseJsonValue,
  type JsonArray,
  type JsonObject,
  type JsonPrimitive,
  type JsonValue,
} from "../utils/serialization";
export {
  failure,
  success,
  type Failure,
  type Result,
  type Success,
} from "../utils/result";
export * from "./state/types";
export * from "./state/configuration";
export * from "./plugin/types";
export * from "./state/events";
export * from "./transport/types";
export * from "./transport/fake";
export * from "./transport/endpoint";
export type { IdFactory } from "./host/idFactory";
export * from "./observer";
export * from "./api";
export { NetworkEndpoint } from "p2p-lockstep-kit-network";
export type {
  EndpointRtcPeer,
  EndpointRtcPeerFactory,
  EndpointRtcPeerFactoryInput,
  EndpointSignalingClient,
  NetworkEndpointOptions,
  PeerLink,
  PeerLinkState,
} from "p2p-lockstep-kit-network";
