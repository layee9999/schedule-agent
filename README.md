# 课表服务智能体

对照设计稿（课表入口、AI 助手首页、对话解析、添加确认、添加成功、图片导入）实现的课程助手：本地可预览完整交互，也可挂到超星学习通教师课表，用自然语言或课表图片解析课程并写入真实课表。

当前油猴脚本版本：**1.8.1**。

## 能做什么

- 自然语言添加课程，例如：`周三下午两点上高等数学，张老师，A101，上16周`
- 图片识别课表，多门课确认后批量添加
- 修改已有课程、检查时间冲突
- 本地演示：数据存在浏览器 `localStorage`
- 学习通实写：在已登录的教师课表页调用超星接口读写课表

## 界面与流程

设计共 6 个界面，本地预览与学习通浮层共用同一套交互：

| 步骤 | 界面 | 说明 |
| --- | --- | --- |
| 1 | 课表页 | 周视图 + 右下角机器人入口 |
| 2 | AI 助手首页 | 问候语；添加课程 / 导入课表 / 修改课程 / 检查冲突 |
| 3 | 对话解析 | 用户输入 → 解析卡片 →「确认添加 / 修改信息」 |
| 4 | 添加确认 | 展示字段 + 冲突提示 → 取消 / 确认添加 |
| 5 | 添加成功 | 查看课表 / 继续添加 |
| 6 | 图片导入 | 识别多门课 → 暂不添加 / 全部添加 |

典型路径：课表入口 → 助手首页 → 对话解析 → 确认页 → 成功页。导入图片则从首页或对话进入识别列表，再进入确认页。

## 架构

```
浏览器（本地预览或学习通课表页）
        │
        │  POST /api/parse   （Tampermonkey 用 GM_xmlhttpRequest，避免 HTTPS 页请求 HTTP 被拦）
        ▼
Vite :5173
  ├─ React 移动端原型（/schedule、/assistant/*）
  ├─ /api/parse 自然语言 / 图片解析（真实模型或本地演示规则）
  └─ /chaoxing-schedule-agent.user.js  油猴脚本
        │
        │  同域 Cookie
        ▼
超星 kb.chaoxing.com
  GET  /pc/curriculum/getMyLessons
  POST /pc/curriculum/addOrUpdateLesson
```

三层职责：

1. **本地 React 原型**：还原设计稿，课程存在 `localStorage`，用于走通交互。
2. **解析服务**：`server/llm-proxy.ts` 提供 `/api/parse`。配置了可用的 OpenAI 兼容 Key 则走模型；`OPENAI_API_KEY=demo` 或未配置时走本地规则。
3. **学习通挂载**：Tampermonkey 脚本在教师课表页注入浮层，解析走本机 5173，读写走超星登录态。

MCP（`npm run mcp`）给 Cursor 等宿主调用解析工具，**不能**代替浏览器 Cookie，因此不能从 MCP 直接改学习通课表。

## 节次约定

产品课表按 10 节展示（与设计稿一致）：

| 节次 | 时间 | 节次 | 时间 |
| --- | --- | --- | --- |
| 1 | 08:00–08:50 | 6 | 15:00–15:50 |
| 2 | 08:55–09:45 | 7 | 16:00–16:50 |
| 3 | 10:00–10:50 | 8 | 17:00–17:50 |
| 4 | 11:00–11:50 | 9 | 19:00–19:50 |
| 5 | 14:00–14:50 | 10 | 20:00–20:50 |

解析特例：

- 「下午两点 / 下午 2 点」→ `14:30–16:10`，节次 **第 3–4 节**（按设计稿，不按学习通下午真实钟点改写成第 5–7 节）
- 「第 N 节 / 第 N–M 节」以用户说的节次为准
- 「上 16 周」→ 第 1–16 周
- 写入学习通时，`beginNumber` / `length` 使用解析出的节次，不再用钟点去映射超星格子

冲突检测会按待写入的周次拉取超星 `getMyLessons`，用 `dayOfWeek + beginNumber + length + 周次` 对照占课。确认页应在提交前标出「第 x 周，周 y，第 z 节已有课程」。

## 本地使用

环境：Node.js 18+（本仓库用 Vite 7 + React 19）。

```powershell
cd d:\agent_test
# 若 npm.ps1 被执行策略拦住，可用：
npx --yes npm@10 install
npx vite --port 5173 --strictPort
```

或在允许脚本的终端里：

```powershell
npm install
npm run dev
```

打开 <http://127.0.0.1:5173/schedule>。

可选：复制 `.env.example` 为 `.env`，填入 OpenAI 兼容接口：

```
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

不填或设为 `demo` 时，解析为本地演示模式，不调用公网模型。也可在应用内「模型设置」页填写。

| 地址 | 用途 |
| --- | --- |
| `/schedule` | 课表周视图 |
| `/assistant` | AI 助手首页 |
| `/assistant/chat` | 对话解析 |
| `/assistant/confirm` | 添加确认 |
| `/assistant/success` | 添加成功 |
| `/assistant/import` | 图片导入 |
| `/assistant/settings` | 模型设置 |
| `/assistant/deploy` | 部署到学习通说明 |

## 部署到学习通

学习通课表是 HTTPS，浏览器禁止页面直接请求本机 HTTP。因此用 **Tampermonkey + 油猴脚本**，由脚本用 `GM_xmlhttpRequest` 访问 `http://127.0.0.1:5173/api/parse`。

1. 本机保持 `npm run dev`（`http://127.0.0.1:5173`）。
2. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/)。
3. 打开安装链接：<http://127.0.0.1:5173/chaoxing-schedule-agent.user.js>
4. 用已登录账号打开 [教师课表](https://kb.chaoxing.com/res/pc/curriculum/schedule.html?role=1)
5. 点右上角机器人：对话添加 → 确认页看冲突 → 确认后写入超星，课表会刷新

Edge 若看不到入口：

1. `edge://extensions` 打开「开发人员模式」
2. Tampermonkey「详细信息」里打开 **允许运行用户脚本 / Allow User Scripts**
3. 仪表盘确认脚本版本为 1.8.1，否则重新打开安装链接覆盖安装
4. 课表页 Ctrl+F5；控制台应出现 `[课表智能体] 1.8.1 已执行`

脚本匹配 `*://kb.chaoxing.com/*`，需要允许 Tampermonkey 访问 localhost。

## 超星接口（需登录 Cookie）

| 用途 | 接口 |
| --- | --- |
| 拉课表 | `GET /pc/curriculum/getMyLessons?curTime=&week=` |
| 新增/编辑 | `POST /pc/curriculum/addOrUpdateLesson` |
| 图片导入 | `POST /pc/import/importImageLesson` |
| Excel 导入 | `POST /pc/import/importExcelLesson` |
| 单课详情 | `GET /pc/curriculum/getOneLesson` |

写入字段主要包括：`name`、`teacherName`、`dayOfWeek`（周一=1）、`beginNumber`、`length`、`location`、`weeks`、`weekType`（2=全部周）、`curriculumUuid`、`lessonConfigUuid`、`role=1`。

## 目录

```
src/                 React 页面、冲突检测、本地课表状态
public/
  chaoxing-schedule-agent.user.js   学习通浮层（解析 + 读写 + 占课检测）
  overlay-bridge.js                 iframe 嵌入时的 postMessage 桥
server/
  llm-proxy.ts       /api/parse
  mcp.ts             MCP 工具
```

## 常见问题

**浮层不出现**  
脚本未注入或跑在隐藏 iframe 里。按上面 Edge 步骤打开「允许运行用户脚本」，Ctrl+F5，看控制台是否有 `[课表智能体] 1.8.1 已执行`。

**解析失败 / 连不上本地智能体**  
先确认 5173 在跑。HTTPS 课表页必须用油猴脚本，不能靠页面自己 `fetch` HTTP。

**确认页显示无冲突，提交却提示「第 x 节已有课程」**  
超星按整段周次校验占课，不能只看当前周。1.8.1 会按待写入周次逐周拉取 `getMyLessons`，用原始 `dayOfWeek` / `beginNumber` 建占课表。控制台 `[课表智能体] 占课已同步` 中的 `weekParamWorks`、`rawSample` 用于核对接口是否按周返回、字段是否齐全。

**「下午两点」写成第 5–7 节**  
那是按学习通下午钟点重映射的旧逻辑。现约定与设计稿一致：第 3–4 节、14:30–16:10。

密钥不要提交到 Git。`.env` 已在 `.gitignore` 中。
