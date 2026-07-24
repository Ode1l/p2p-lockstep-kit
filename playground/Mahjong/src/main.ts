import "p2p-lockstep-kit-multiui/style.css";
import {
  createSessionConfiguration,
  seatId,
  type MultiSessionSnapshot,
  type OrderedEvent,
} from "p2p-lockstep-kit-multisession";
import {
  defineP2PLockstepMultiUi,
  type P2PLockstepMultiAppElement,
} from "p2p-lockstep-kit-multiui";
import { mountMahjong } from "./mahjong-app.js";
import {
  mahjongPlugin,
  type MahjongCommand,
  type MahjongEventPayload,
  type MahjongSnapshot,
  type MahjongState,
} from "./game/mahjong.js";
import "./style.css";

const seats = ["south", "east", "north", "west"].map(seatId);
const configurationResult = createSessionConfiguration({
  participantCount: 4,
  seatIds: seats,
});
if (!configurationResult.ok) throw new Error(configurationResult.error);

const seatNames: Readonly<Record<string, string>> = {
  south: "南",
  east: "东",
  north: "北",
  west: "西",
};

const eventLabel = (
  event: OrderedEvent,
  snapshot: MultiSessionSnapshot<MahjongSnapshot>,
): string | null => {
  if (event.type !== "GAME_EVENT") return null;
  const actor =
    snapshot.state.participants.get(event.actorId)?.displayName ??
    String(event.actorId);
  const data = (event.payload as { data?: { kind?: unknown; suit?: unknown } })
    .data;
  if (data?.kind === "exchange") return `${actor} 完成换三张`;
  if (data?.kind === "chooseMissing") {
    const suit =
      data.suit === "characters" ? "万" : data.suit === "dots" ? "筒" : "索";
    return `${actor} 定缺${suit}`;
  }
  if (data?.kind === "discard") return `${actor} 打出一张牌`;
  if (data?.kind === "peng") return `${actor} 碰牌`;
  if (data?.kind === "gang") return `${actor} 杠牌`;
  if (data?.kind === "hu") return `${actor} 胡牌`;
  if (data?.kind === "pass") return `${actor} 选择过`;
  return `${actor} 完成牌局操作`;
};

const start = async (): Promise<void> => {
  await customElements.whenDefined("p2p-lockstep-multi-app");
  const app = document.querySelector<P2PLockstepMultiAppElement>(
    "#mahjong-app",
  );
  if (!app) throw new Error("麻将应用外壳不存在");
  const runtime = await app.configure<
    MahjongCommand,
    MahjongEventPayload,
    MahjongState,
    MahjongSnapshot
  >({
    game: {
      title: "Mahjong",
      mark: "南",
      configuration: configurationResult.value,
      plugin: mahjongPlugin,
      seatLabel: (seat) => seatNames[String(seat)] ?? String(seat),
      eventLabel,
    },
  });
  const unmount = mountMahjong({ mount: app.getBoardHost(), runtime });
  globalThis.addEventListener("pagehide", unmount, { once: true });
  import.meta.hot?.dispose(unmount);
};

defineP2PLockstepMultiUi();
void start();
