# p2p-kit 实现规划与规格说明（v0.1）

> 目标：实现一个面向浏览器（Web/PWA）的 **P2P 会话与消息协议层**（p2p-kit），基于 **WebRTC DataChannel** 作为数据面传输，基于 **WebSocket** 作为控制面/信令通道。该 kit 将被五子棋、国际象棋、麻将、三国杀等回合制/策略类游戏复用。

---

## 1. 设计边界与总原则

### 1.1 不做的事情（明确排除）
- 不实现 NAT 打洞（ICE/STUN/TURN 由 WebRTC 内部完成）。
- 不实现 DHT / PubSub / IPFS（除非后续版本明确引入）。
- 不实现具体游戏规则（五子棋/麻将/三国杀规则都不属于 p2p-kit）。
- 不把服务器作为权威裁决者（server 仅控制面/信令/房间协调）。

### 1.2 要做的事情（p2p-kit 核心价值）
- **会话 Session**：房间/成员/状态机（lobby/playing/reconnecting/ended）。
- **消息协议层**：统一 Envelope、序列号、去重、防重放、流（control/game/sync）多路复用。
- **连接编排**：WebRTC 建连流程管理（通过信令交换 SDP/ICE）、连接状态监控、自动重连与重新协商策略。
- **一致性支持**：状态哈希校验、快照同步（断线恢复）、desync 检测。
- **可复用接口**：IGameAdapter 抽象，使游戏侧只处理“动作/状态”，不处理网络细节。

---

## 2. 分层架构（Control Plane vs Data Plane）

### 2.1 控制面（Control Plane）—— WebSocket / Signaling
职责：
- CreateRoom / JoinRoom / LeaveRoom
- Seat/Role 分配（例如房主/先手）
- 交换 WebRTC SDP offer/answer
- 转发 ICE candidates
- 心跳与在线状态（可选，但建议 v0.1 实现基础版本）

### 2.2 数据面（Data Plane）—— WebRTC DataChannel (P2P)
职责：
- 游戏动作消息（GAME_*）
- 同步/校验消息（SYNC_*）
- 重连后的状态恢复

---

## 3. 工程组织（推荐 monorepo 起步）

### 3.1 仓库结构（v0.1）
```
/ts-p2p-kit
  /src
    /core
    /session
    /transport
    /signaling
    /codec
    index.ts
  /playground
    /playground-webrtc       # 最小连接实验
    /playground-signaling    # 信令流程实验
    /gomoku-demo             # 五子棋 demo（用于验收 p2p-kit）
  package.json
  tsconfig.json
  tsup.config.ts
  pnpm-workspace.yaml
```

### 3.2 构建与输出
- p2p-kit：ESM only（v0.1），输出：
  - `dist/index.js`
  - `dist/index.d.ts`
- 打包工具建议：tsup（配置轻、输出稳定）。
- demo/playground：Vite 作为 dev server。

---

## 4. 模块划分与职责清单

### 4.1 core（纯逻辑，不依赖浏览器）
- Envelope 类型
- 序列号（seq）与去重窗口
- 重放保护（可先实现轻量：last-seq + sliding window）
- stream 多路复用（control/game/sync/chat 逻辑通道）
- 事件系统（typed events）

### 4.2 transport（薄封装 WebRTC）
目标：把 WebRTC DataChannel 适配成统一 ITransport。
- `ITransport` 接口
- `WebRtcTransport` 实现：
  - createPeerConnection
  - createDataChannel / ondatachannel
  - send/receive bytes
  - connection state 统一映射

### 4.3 signaling（WebSocket 信令客户端）
- `ISignalingClient` 接口
- `WebSocketSignalingClient` 实现：
  - connect
  - createRoom/joinRoom
  - exchange offer/answer/candidate
  - room events（peer joined/left）

### 4.4 session（会话层：核心资产）
- `Session`：
  - lifecycle：create/join/start/leave/end
  - peers/seats/roles
  - state machine：lobby/playing/reconnecting/ended
  - attachAdapter（绑定 IGameAdapter）
  - sendGameAction
  - desync 检测与触发 sync
- 连接管理：
  - 2 人拓扑（v0.1）
  - 多人拓扑（v0.2+）

### 4.5 codec（序列化/反序列化）
- v0.1：JSON
- 预留：msgpack/protobuf（v1+）

---

## 5. 公共 API（p2p-kit 对使用者的契约）

### 5.1 IGameAdapter（游戏适配接口）
> 游戏逻辑必须实现；p2p-kit 不关心具体规则。

最低方法集（v0.1）：
- `onLocalAction(action): OutgoingMessage[] | OutgoingMessage`
- `onRemoteMessage(msg): void`
- `getSnapshot(): Snapshot`
- `applySnapshot(snapshot: Snapshot): void`
- `getStateHash(): string`

备注：
- v0.1 可以把 `OutgoingMessage` 简化为 `Envelope`。
- v0.2 可增加 `validateRemoteAction`（防作弊/规则校验）。

### 5.2 Session（会话 API）
- `createRoom()` / `joinRoom(invite)`
- `start()`
- `leave()`
- `send(stream, type, payload)`（底层通用）
- `sendGameAction(action)`（语义化封装）
- `requestSync()`

事件：
- `on("stateChanged", ...)`
- `on("peerJoined", ...)`
- `on("peerLeft", ...)`
- `on("connected", ...)`
- `on("disconnected", ...)`
- `on("desync", ...)`

---

## 6. 消息协议（v0.1）

### 6.1 通用 Envelope
```json
{
  "v": 1,
  "sid": "sessionId",
  "stream": "control|game|sync",
  "t": "MSG_TYPE",
  "seq": 12,
  "from": "peerId",
  "ts": 1730000000000,
  "payload": {}
}
```

字段说明：
- `v`：协议版本
- `sid`：sessionId
- `stream`：逻辑通道
- `t`：消息类型
- `seq`：发送方递增序号（去重/重放保护基础）
- `from`：peerId
- `ts`：毫秒时间戳
- `payload`：业务负载

### 6.2 控制流（control）建议类型
- `CONTROL_HELLO`：能力/版本协商（可选）
- `CONTROL_READY`：准备就绪（可选）
- `CONTROL_PING` / `CONTROL_PONG`：心跳

### 6.3 游戏流（game）建议类型
- `GAME_ACTION`：统一动作消息（落子/走棋/出牌等）
  - payload 建议包含：`turn`、`action`、`stateHashAfter`

### 6.4 同步流（sync）建议类型
- `SYNC_REQUEST`：请求快照
- `SYNC_STATE`：返回快照
- `SYNC_HASH`：周期性哈希校验（可选）

---

## 7. 一致性与恢复策略（v0.1 约束）

### 7.1 同步模型（建议 v0.1 统一为 lockstep）
- 回合制/动作驱动
- 每次只接受“当前应行动方”的 action
- 收到 action → 应用到本地 → 校验 hash

### 7.2 hash 校验
- 每个 `GAME_ACTION` 必带 `stateHashAfter`
- 本地计算 hash 并比对
- 不一致 → 触发 desync

### 7.3 desync 处理
- 触发 `SYNC_REQUEST`
- 对端返回 `SYNC_STATE`
- 应用快照后恢复

### 7.4 重连
- transport state 进入 `disconnected` → session state = `reconnecting`
- 重新协商 WebRTC（offer/answer）
- 成功后自动 `SYNC_REQUEST` 以恢复一致状态

---

## 8. 里程碑与验收标准

### Milestone 0：Playground 跑通（最小 WebRTC）
- 同一房间 2 人能建 DataChannel
- 能互发字符串

### Milestone 1：p2p-kit v0.1 核心可用
- Session create/join/start/leave
- 2 人会话稳定收发 Envelope
- seq 去重基本可用

### Milestone 2：一致性与重连
- GAME_ACTION + stateHashAfter 校验
- desync → SYNC_REQUEST/STATE
- 断线重连后可恢复到同一状态

### Milestone 3：五子棋 demo 验收（作为 kit 的集成测试）
- 创建邀请链接
- 加入房间
- 轮流落子同步
- 胜负判定由游戏 core 负责
- 任一方断线 → 重连 → 盘面一致

---

## 9. v0.2+ 预留（后续扩展方向）
- 多人拓扑（4 人 mesh 或 star+relay）
- 数据通道可靠性策略（分片/大包/背压）
- 消息签名与身份绑定（PeerId = pubkey hash）
- 更丰富的协商（能力/版本/feature flags）
- 编码升级（msgpack/protobuf）
- 游戏同步策略扩展（rollback、事件日志、快照压缩）

---

## 10. 使用方式（目标形态）

游戏侧希望只做：
- 创建/加入 Session
- 绑定 Adapter
- 触发本地 action

p2p-kit 负责：
- 信令 + WebRTC 建连
- 消息收发与去重
- 状态机与重连
- 同步与校验

（完）

