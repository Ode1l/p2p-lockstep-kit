export type ParsedShareInput = {
  peerId: string;
  signalUrl: string;
};

const getParams = (url: URL) => {
  const hash = url.hash.replace(/^#/, "");
  return new URLSearchParams(hash || url.search);
};

export const buildShareUrl = (peerId: string, signalUrl: string, base?: string) => {
  if (!peerId) {
    return "";
  }
  const url = new URL(base ?? window.location.href);
  const params = new URLSearchParams();
  params.set("id", peerId);
  if (signalUrl) {
    params.set("url", signalUrl);
  }
  url.hash = params.toString();
  return url.toString();
};

export const parseShareInput = (value: string): ParsedShareInput | null => {
  const raw = value.trim();
  if (!raw || !raw.includes("://")) {
    return null;
  }
  try {
    const url = new URL(raw);
    const params = getParams(url);
    const peerId = params.get("id");
    if (!peerId) {
      return null;
    }
    return {
      peerId,
      signalUrl: params.get("url") ?? "",
    };
  } catch {
    return null;
  }
};

export const readShareLocation = () => {
  const url = new URL(window.location.href);
  const params = getParams(url);
  return {
    peerId: params.get("id") ?? "",
    signalUrl: params.get("url") ?? "",
  };
};
