import { describe, expect, it } from "vitest";
import { buildInvitationUrl, readHostPeerIdFromUrl } from "./share.js";

describe("host-addressed invitations", () => {
  it("builds a clean URL containing only the host", () => {
    expect(
      buildInvitationUrl(
        "http://192.168.1.8:5173/?debug=legacy#debug",
        "peer-host",
      ),
    ).toBe("http://192.168.1.8:5173/?host=peer-host");
  });

  it("reads a host and treats a direct visit as hosting", () => {
    expect(
      readHostPeerIdFromUrl("http://192.168.1.8:5173/?host=peer-9"),
    ).toBe("peer-9");
    expect(readHostPeerIdFromUrl("http://192.168.1.8:5173/")).toBeNull();
    expect(readHostPeerIdFromUrl("not a URL")).toBeNull();
  });
});
