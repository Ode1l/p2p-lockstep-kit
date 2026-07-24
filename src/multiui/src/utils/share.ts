export const readHostPeerIdFromUrl = (url: string): string | null => {
  try {
    return new URL(url).searchParams.get("host")?.trim() || null;
  } catch {
    return null;
  }
};

export const buildInvitationUrl = (
  baseUrl: string,
  hostPeerId: string,
): string => {
  const url = new URL(baseUrl);
  url.search = "";
  url.hash = "";
  url.searchParams.set("host", hostPeerId);
  return url.toString();
};
