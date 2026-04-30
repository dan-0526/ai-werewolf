# AI 狼人杀

让不同 AI 模型互相对战狼人杀。经典 9 人局：3 狼人 + 预言家 + 女巫 + 猎人 + 3 村民。

## 支持的模型

| 模型 | Provider | 说明 |
|------|----------|------|
| Claude Opus 4.6 | Anthropic | 需要 ANTHROPIC_AUTH_TOKEN |
| Claude Sonnet 4.6 | Anthropic | 需要 ANTHROPIC_AUTH_TOKEN |
| DeepSeek V4 | DeepSeek | 需要 DEEPSEEK_API_KEY |
| DeepSeek R1 | DeepSeek | 需要 DEEPSEEK_API_KEY |
| Kimi K2.6 | SiliconFlow | 需要 SILICONFLOW_API_KEY |
| Qwen 3.5 | SiliconFlow | 需要 SILICONFLOW_API_KEY |
| GLM 5.1 | SiliconFlow | 需要 SILICONFLOW_API_KEY |
| Custom A | OpenAI-compatible | 需要 CUSTOM_LLM_API_KEY |
| Custom B | OpenAI-compatible | 需要 CUSTOM_LLM_API_KEY |

## 快速开始

```bash
# 安装依赖
npm install

# 配置 API keys（参考 .env.example）
cp .env.example .env
# 编辑 .env 填入你的 API keys

# 运行（默认 9 模型全明星）
npx tsx src/index.ts
```

## 运行方式

```bash
# 默认：使用 game.config.yaml 中 players 段的模型
npx tsx src/index.ts

# 自选阵容：命令行传 9 个模型名
npx tsx src/index.ts claude-opus claude-sonnet deepseek-v4 deepseek-r1 kimi qwen doubao-character doubao-pro glm

# 从文件读取阵容（每行一个模型名，# 开头为注释）
npx tsx src/index.ts --file lineup.txt

# 查看所有可用模型
npx tsx src/index.ts --list
```

模型名对应 `game.config.yaml` 中 `models` 段的 key。要添加新模型，在 yaml 里加配置即可。

## 游戏规则

- 屠边制：3 名平民全死或 3 名神职全死，狼人获胜
- 女巫首夜可自救，解药毒药不能同夜使用
- 猎人被毒死不能开枪
- 平票重投一次，再平则无人出局
- 死亡不公开身份
- 座位随机分配，角色随机分配

规则可在 `game.config.yaml` 的 `rules` 段调整。

## 日志

每局游戏生成三层日志，保存在 `logs/` 目录：

- `*.public.log` — 观众视角（公开发言、投票、死亡）
- `*.god.jsonl` — 上帝视角（含角色、查验结果、内心独白）
- `*.raw.jsonl` — 原始 API 调用记录

## 复盘模式

游戏结束后自动进入复盘：揭晓所有身份，每个 AI 评选 MVP 和最差玩家。

## 项目结构

```
src/
├── index.ts              # 入口 + CLI 参数解析
├── ai/                   # AI Provider 抽象层
│   ├── AIProvider.ts     # 统一接口
│   ├── ClaudeFetchProvider.ts  # Claude（SSE streaming）
│   ├── OpenAICompatProvider.ts # DeepSeek/Kimi/Qwen/豆包/GLM/GPT
│   └── ProviderFactory.ts      # 根据配置创建实例
├── game/
│   ├── GameMaster.ts     # 状态机 + 流程编排
│   ├── GameState.ts      # 数据结构
│   └── WinChecker.ts     # 胜负判定
├── prompt/
│   ├── SystemPrompts.ts  # 角色 prompt 模板
│   └── ResponseParser.ts # JSON 解析 + 兜底
├── server/
│   └── GameEventBus.ts   # 事件总线
└── utils/
    ├── GameLogger.ts     # 三层日志
    └── helpers.ts        # 工具函数
```
