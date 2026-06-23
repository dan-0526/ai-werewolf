# AI 中国象棋对弈系统设计

## 概述

在 ai-arena 平台中新增中国象棋模块，让 Claude Opus 4.6 与 GPT 5.5 进行 Bo3 三局两胜的中国象棋对弈。提供实时观战的 Web 可视化界面，支持实况和回放两种模式。

## 核心需求

- Claude (Opus 4.6) vs GPT (5.5) 中国象棋对弈
- Bo3 三局两胜，轮换先手，连续上下文（AI 可跨局学习）
- 两种模式：实况（实时对弈）+ 回放（暂停/继续/步进）
- 棋盘可视化：经典木纹（默认）+ 极简现代（可切换主题），棋子均为圆形
- 右侧棋谱面板，可选显示 AI 思考内容
- 非法走法重试 3 次，超过判负
- 局间简洁分隔（不重复棋谱），依赖连续上下文保持记忆
- 可扩展支持国际象棋

## 架构

### 目录结构

```
src/chess/
├── shared/                  ← 棋类游戏共用
│   ├── GameMaster.ts            # Bo3 对局主控（赛制、轮换、WebSocket 推送）
│   ├── AIPlayer.ts              # AI 调用 + 重试逻辑
│   ├── GameLogger.ts            # 三层日志
│   └── types.ts                 # 共享类型定义
├── chinese/                 ← 中国象棋规则
│   ├── rules.ts                 # 合法性校验（含蹩马腿、塞象眼、将帅对面等）
│   ├── board.ts                 # 棋盘状态（10x9 二维数组）
│   ├── notation.ts              # 棋谱格式转换（坐标 ↔ 中文棋谱）
│   └── prompts.ts               # AI system prompt
└── index.ts                 # CLI 入口

public/chess/
├── shared/                  ← 前端共用模块
│   ├── ws-client.js             # WebSocket 客户端
│   ├── game-controls.js         # 暂停/继续/步进/回放控制
│   ├── move-panel.js            # 棋谱面板
│   └── theme.js                 # 主题切换
├── chinese/                 ← 中国象棋前端
│   ├── index.html               # 入口页面
│   ├── board.js                 # Canvas 棋盘渲染
│   └── pieces.js                # 棋子定义与绘制
└── assets/
    └── themes.css               # 主题 CSS 变量
```

### 后端设计

#### 对局生命周期

```
启动 → 加载配置 → 创建 Bo3 Match → 启动 HTTP + WebSocket 服务器
→ 循环 3 局（先胜 2 局结束）{
    初始化棋盘 → 分配先后手（第1局随机，之后轮换）→
    循环走棋 {
      构建 prompt（当前局面 + 完整对话历史）→
      调 AI API → 解析走法 →
      合法？→ 是：更新棋盘，WebSocket 推送 move 事件
           → 否：重试（告知原因，最多3次）→ 超限判负
      检查胜负（将死 / 困毙）
    } →
    推送 game_end 事件 →
    追加局间分隔消息到对话历史 →
    轮换先手
  } → 推送 match_end 事件 → 输出结果
```

#### AI 调用设计

每步给 AI 的消息结构：

- **System prompt**：你是中国象棋手，执红/黑方，规则说明，返回格式要求
- **对话历史**：之前所有走棋消息（双方的），跨局保留在同一对话中
- **当前步消息**：对手的走法 + 当前棋盘局面（文字描述各子位置）+ 要求返回走法

走法返回格式：
```json
{ "move": "炮二平五", "thinking": "开局中炮控制中路..." }
```
或坐标格式：
```json
{ "from": [7, 7], "to": [7, 4], "thinking": "..." }
```

两种格式都接受，内部统一转为坐标处理。

#### 规则引擎

- 棋盘状态：`number[][]`（10行9列），0 为空，正数红方，负数黑方
- 棋子编码：帅1 仕2 相3 马4 车5 炮6 兵7
- 合法走法生成：每种棋子独立实现，含特殊规则
  - 马：蹩腿检测
  - 象：塞眼检测 + 不过河
  - 仕/将：九宫限制
  - 将帅：不能对面（同列无子阻隔）
  - 兵：过河前只能前进，过河后可左右
- 将军检测：走完后己方将帅是否被攻击
- 将死判定：无合法走法且被将军
- 困毙判定：无合法走法但未被将军
- 第一版不实现：长将/长捉判和

#### 日志系统

复用现有三层日志体系：

```
logs/chess-{timestamp}/
├── public.log      ← 人类可读棋谱
│                     格式：第1局 Claude(红) vs GPT(黑)
│                           1. 炮二平五  马8进7
│                           2. 马二进三  车9平8
│                           ...
│                           结果：红方胜（将死）
├── god.jsonl       ← 完整事件流（含 AI thinking、非法走法重试）
└── raw.jsonl       ← 原始 API 请求/响应
```

### 前端设计

#### 页面布局

```
┌──────────────────────────────────────────────────┐
│  [Claude Opus 4.6] vs [GPT 5.5]   Bo3: 1-0      │  ← 顶栏
├──────────────────────────────┬───────────────────┤
│                              │ 1. 炮二平五       │
│                              │ 2. 马8进7         │
│          棋 盘               │ 3. 马二进三       │
│         (Canvas)             │ 4. 车9平8         │
│                              │ ...              │
│                              │                  │
│                              │ [💭 AI思考] 可选  │
├──────────────────────────────┴───────────────────┤
│  ⏸ 暂停  ▶ 继续  ⏭ 下一步   🎨 主题    局1/3   │  ← 控制栏
└──────────────────────────────────────────────────┘
```

#### 两种模式

| | 实况模式 | 回放模式 |
|---|---|---|
| 数据源 | WebSocket 实时推送 | 加载 god.jsonl 文件 |
| 控制 | 暂停 / 继续 | 暂停 / 继续 / 步进 / 进度拖动 |
| 入口 | `npm run chess` 启动时自动打开 | `npm run chess:replay <日志目录>` |

#### 棋盘渲染（Canvas）

- 棋盘：9 纵线 × 10 横线，中间楚河汉界
- 棋子：圆形，两种主题下都是圆形
  - 经典木纹：实心圆 + 汉字，红方 `#c00`，黑方 `#000`，底色 `#f5e6c8`
  - 极简现代：白底圆形 + 轻阴影，红方 `#e53935`，黑方 `#212121`，页面白底
- 走子动画：requestAnimationFrame 平滑移动
- 最后一步高亮：起点虚线圈 + 终点实线圈
- 吃子效果：被吃棋子淡出

#### 主题系统

用 CSS 变量控制，切换时替换变量组：

```css
:root[data-theme="classic"] {
  --board-bg: #f5e6c8;
  --board-line: #8b4513;
  --piece-red: #c00;
  --piece-black: #000;
  --piece-bg: #f5e6c8;
  --piece-border: currentColor;
}

:root[data-theme="minimal"] {
  --board-bg: #fafafa;
  --board-line: #e0e0e0;
  --piece-red: #e53935;
  --piece-black: #212121;
  --piece-bg: #ffffff;
  --piece-border: transparent;
  --piece-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
```

### WebSocket 协议

```typescript
// 服务端 → 客户端 事件类型

{ type: "match_start", bo: 3, players: { red: string, black: string } }

{ type: "game_start", game: number, red: string, black: string }

{ type: "move", player: "red" | "black", from: [number, number], to: [number, number],
  piece: string, notation: string, thinking?: string }

{ type: "illegal_move", player: "red" | "black", attempt: string,
  reason: string, retry: number }

{ type: "game_end", game: number, winner: "red" | "black" | "draw",
  reason: "checkmate" | "stalemate" | "illegal_exceeded",
  score: { claude: number, gpt: number } }

{ type: "match_end", winner: string, final_score: { claude: number, gpt: number } }
```

### 配置

`chess.config.yaml`：

```yaml
game:
  name: "AI 中国象棋 Bo3"
  mode: chinese
  bo: 3
  move_delay_ms: 1500
  max_retries: 3
  language: "zh-CN"

models:
  claude:
    provider: claude
    model: claude-opus-4-6
    api_key_env: ANTHROPIC_AUTH_TOKEN
    base_url_env: ANTHROPIC_BASE_URL
    auth_mode: bearer

  gpt:
    provider: gpt
    model: gpt-5.5
    api_key_env: GPT_API_KEY
    base_url_env: GPT_BASE_URL
    wire_api: responses
    timeout_ms: 60000

players:
  red: { model: claude }
  black: { model: gpt }

server:
  port: 3001
  open_browser: true
```

### 启动命令

```json
{
  "chess": "tsx src/chess/index.ts",
  "chess:replay": "tsx src/chess/index.ts --replay"
}
```

```bash
npm run chess                              # 实况对弈
npm run chess:replay logs/chess-xxx        # 回放
```

## 扩展性

添加国际象棋时：
1. 新增 `src/chess/western/`（rules、board、notation、prompts）
2. 新增 `public/chess/western/`（board.js、pieces.js、index.html）
3. 配置文件 `mode: western`
4. 共享层（GameMaster、AIPlayer、WebSocket、控制面板）无需修改

## 不做的事（第一版）

- 长将 / 长捉判和规则
- 人类玩家参与（纯 AI vs AI）
- 开局库 / 残局库
- ELO 评分系统
- 多场次统计
