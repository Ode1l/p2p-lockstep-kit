# 项目上下文摘要（p2p-lockstep-kit）

## 目标与现状
- 当前重点在 P2P signaling + WebRTC DC 链路，协议简化为 `REGISTER / REGISTERED / RELAY / ERROR`。
- signaling-server 只负责注册生成 UUID + 转发 RELAY，不做房间。

## 协议
- Signal envelope：`type / from / to / payload`
- `payload` 内部结构为 `{ id, data }`（例如 `id: "offer"`，`data: offerObj`）
- ERROR 信息也放 `payload`

## Signaling Server
- 位置：`playground/signaling-server/src/server.ts`
- `REGISTER` -> 返回 `REGISTERED`（to=peerId），payload `{ id:"iceServers", data:[...] }`
- `RELAY` -> 原样转发 `payload`
- 配置：`playground/signaling-server/configuration.json`（含 `signalingPort`、`iceServers`）

## playground 项目
### 1) playground-webrtc-kit
- 本地信令版本（local signaling）
- 状态机：`passive / requesting / connected`
- `disconnect` 只关闭 DC，不关闭 PC
- `dc.onclose -> DISCONNECT`
- 暴露 `getState()`

### 2) playground-signaling-webrtc
- 走真实 signaling-server，register 获取 peerId & iceServers
- `src/signaling.ts`：WS + serialization + protocol
- `src/peer.ts`：状态机驱动、自动 offer/answer/ice
- 已添加 `send()`、`getState()`、`dc.onclose -> DISCONNECT`
- `src/main.ts` 示例注释包含 connect/send/disconnect/pc 状态查看
- 事件系统使用 Emitter（Observer）

### 3) playground-signaling
- 仅 WS register/relay 调试
- `register()` 自动 connect
- `relay(to, id, data)` 自动包装为 `{ id, data }`
- 配置：`playground/playground-signaling/configuration.json`

## src 结构（新的分层命名）
- `src/state/peerState.ts`（pc/dc 状态机）
- `src/signaling/`
  - `emitter.ts`（功能注释已加）
  - `client.ts`（WS signaling client，使用 encode/decodeSafe + protocol）
- `src/transport/rtcPeer.ts`（已分块注释，Strategy/State 标注）
- `src/serialization/`（encode/decode/decodeSafe）
- `src/protocol/`（signaling/game 类型）
- `src/index.ts`（Facade：register/connect/send/disconnect + pcState）

## 命名/决策
- `state` 目录用于 pc/dc 状态（非 lockstep）
- `wire` 不动
- transport 旧文件已删除，仅保留 `rtcPeer.ts` + `configuration.ts`

## 待办
- 继续按需加注释或优化耦合

