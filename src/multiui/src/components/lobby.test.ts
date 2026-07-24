import {
  participantId,
  peerId,
  seatId,
  type JsonValue,
  type Participant,
  type PeerConnectionState,
  type SessionPhase,
} from "p2p-lockstep-kit-multisession";
import { describe, expect, it } from "vitest";
import type { MultiTableView, MultiUiViewOptions } from "../types.js";
import { renderLobby } from "./lobby.js";

const participant = (name: string, index: number): Participant => ({
  id: participantId(`participant-${index}`),
  peerId: peerId(`peer-${index}`),
  displayName: name,
  joinedAtSeq: index,
});

const createView = (input: {
  names: readonly string[];
  phase: SessionPhase;
  meshReady: boolean;
  ready?: boolean;
  connection?: PeerConnectionState;
  localIndex?: number;
}): MultiTableView<JsonValue> => {
  const participants = input.names.map(participant);
  const host = participants[0]!;
  const local = participants[input.localIndex ?? 0]!;
  return {
    localPeerId: local.peerId,
    hostPeerId: host.peerId,
    error: null,
    events: [],
    snapshot: {
      game: null,
      history: [],
      historyLength: 0,
      state: {
        hostPeerId: host.peerId,
        gameId: "game-1" as never,
        phase: input.phase,
        phaseBeforeOffline: null,
        localParticipantId: local.id,
        hostId: host.id,
        configuration: {
          participantCount: 4,
          seatIds: ["south", "east", "north", "west"].map(seatId),
        },
        participants: new Map(participants.map((item) => [item.id, item])),
        connections: new Map(
          participants.map((item) => [
            item.id,
            input.connection ?? "connected",
          ]),
        ),
        seats: new Map(),
        ready: new Map(
          participants.map((item) => [item.id, input.ready ?? false]),
        ),
        meshReady: input.meshReady,
        lastAppliedSeq: 0,
        pendingDecisionWindow: null,
        pendingRestart: null,
        sync: { status: "idle" },
        outcome: null,
        protocolError: null,
      },
    },
  };
};

const options: MultiUiViewOptions<JsonValue> = {
  busy: false,
  copyNotice: null,
  invitationUrl: "http://192.168.1.8:5173/?host=peer-0",
  invitationQrDataUrl: "data:image/png;base64,host-invitation",
  invitationQrFailed: false,
  displayNameEditor: { open: false, value: "房主", error: null },
};

const button = (html: string, action: string): string =>
  html.match(new RegExp(`<button[^>]*data-action="${action}"[^>]*>`))?.[0] ??
  "";

describe("generic multiplayer lobby", () => {
  it("shows members and keeps seats hidden before start", () => {
    const html = renderLobby(
      createView({
        names: ["房主", "玩家甲"],
        phase: "mesh_connecting",
        meshReady: false,
      }),
      options,
    );
    expect(html).toContain("玩家甲");
    expect(html.match(/等待加入/g)).toHaveLength(2);
    expect(html).not.toContain("roster-seat");
  });

  it("enables Ready only after the complete mesh", () => {
    const waiting = renderLobby(
      createView({
        names: ["房主", "甲", "乙"],
        phase: "mesh_connecting",
        meshReady: false,
      }),
      options,
    );
    const seated = renderLobby(
      createView({
        names: ["房主", "甲", "乙", "丙"],
        phase: "seated",
        meshReady: true,
      }),
      options,
    );
    expect(button(waiting, "ready")).toContain("disabled");
    expect(button(seated, "ready")).not.toContain("disabled");
  });

  it("keeps every guest invitation addressed to the host", () => {
    const html = renderLobby(
      createView({
        names: ["房主", "房客"],
        phase: "mesh_connecting",
        meshReady: false,
        localIndex: 1,
      }),
      options,
    );
    expect(html).toContain("?host=peer-0");
    expect(html).not.toContain("?host=peer-1");
  });
});
