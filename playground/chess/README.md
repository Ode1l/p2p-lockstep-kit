# Chess

一款运行在浏览器中的双人国际象棋。双方通过 WebRTC 直接连接，棋局由两端按照同一份操作历史确定性重放，不依赖中心服务器保存棋盘状态。

[在线体验](https://chess.jiahengli.xyz) · [GPL-3.0-only](./LICENSE)

## 功能

- 通过 Peer ID、分享链接或二维码建立一对一连接
- Ready / Start 对局流程与先后手分配
- 完整的基础国际象棋走法校验，包括王车易位、吃过路兵和升变
- 将军、将死、合法落点、上一步和已吃棋子的可视化
- 悔棋和重新开始的双端申请/确认流程
- 请求和棋与投子认负
- 断线重连与棋局历史同步
- 针对桌面和手机触控操作的响应式界面
- 日间/夜间主题

## 当前规则范围

将死会自动产生胜负结果，请求和棋和认输会通过 Session 同步给双方。

目前能够识别并显示无合法走法的局面，但以下规则尚未自动写入 Session 作为终局结果：

- 逼和（stalemate）
- 三次重复局面
- 五十步规则
- 子力不足和棋

在这些自动判定补完之前，双方可以使用“Offer draw”结束和棋。

## 开始对局

1. 双方分别打开在线页面。
2. 页面会向默认信令服务注册并生成本机 Peer ID。
3. 一方复制分享链接或二维码并发给另一方。
4. 另一方打开分享链接，或粘贴 Peer ID 后选择 **Connect**。
5. 连接成功后双方选择 **Ready**，由获得启动权的一方选择 **Start**。

信令服务仅用于注册和建立连接；对局操作通过 WebRTC DataChannel 在双方之间传输。项目当前是严格的一对一模型，不包含大厅、房间列表或自动匹配。

## 本地开发

环境要求：

- Node.js `^20.19.0` 或 `>=22.12.0`
- pnpm `10.32.0`（由 `packageManager` 声明）

```bash
git clone https://github.com/Ode1l/chess.git
cd chess
corepack enable
pnpm install
pnpm dev
```

Vite 默认监听所有网络接口。终端会显示本地访问地址。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动开发服务器 |
| `pnpm test` | 运行棋规与历史重放测试 |
| `pnpm typecheck` | 执行 TypeScript 类型检查 |
| `pnpm build` | 类型检查并生成生产构建 |
| `pnpm preview` | 本地预览 `dist/` 构建产物 |

提交修改前建议运行：

```bash
pnpm test
pnpm typecheck
pnpm build
```

## 项目结构

```text
index.html              应用外壳及 lockstep 功能开关
src/main.ts             初始化 UI shell 并挂载棋盘
src/demo.ts             Session 快照与棋盘交互适配
src/chess-game.ts       可序列化走法、历史重放和规则插件
src/board-view.ts       DOM 棋盘及升变界面
src/chess-game.test.ts  棋规和确定性重放测试
style.css               棋盘主题与响应式布局
```

通用的配对、Ready/Start、悔棋、重开、和棋、认输、重连和同步界面由 `p2p-lockstep-kit-ui` 与 `p2p-lockstep-kit-session` 提供。本项目只负责国际象棋规则、棋盘渲染以及两者之间的适配。

棋局的唯一事实来源是 Session 中有序的 `history`。每次渲染、合法性校验、悔棋或重连同步都会从历史重新构建完整局面；升变选择也包含在序列化走法中。

## 部署

该项目会生成纯静态 Vite 站点，可部署到 Cloudflare Pages 或其他静态托管平台。

Cloudflare Pages 配置：

```text
Build command: pnpm build
Build output directory: dist
Root directory: repository root
```

默认信令地址由 `p2p-lockstep-kit-ui` 提供。如需自建信令服务，可在 `index.html` 的 `<p2p-lockstep-app>` 上设置 `signal-url`：

```html
<p2p-lockstep-app
  game-title="Chess"
  session-id="international-chess"
  signal-url="wss://signal.example.com"
  allow-draw
  allow-resign
></p2p-lockstep-app>
```

## 许可证

本项目依据 [GNU General Public License v3.0 only](./LICENSE) 发布。
