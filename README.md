# LLM 与 Agent 工程架构学习

与 leo 一起，以权威材料、原始论文和 GitHub 项目为依据，结合理论、实现与评估，学习 LLM Agent 工程架构。

## HTML 学习 Wiki

浏览入口：[index.html](./index.html)。直接用浏览器打开即可，无需启动服务或安装依赖。

每个方向按子方向展示表格：每行集中学习范围、资料说明、开源项目、最佳实践与官方参考、练手项目及状态。论文和资料说明直接放在所属子方向或分类页面，避免进入单独的 papers 页面；跨子方向的综合项目和全方向参考单独保留。综合实践与 bad cases 可从总入口导航；学习记录保存在 `wiki/content.json` 和 `wiki/learning-log.md`，不在 HTML 页面展示。

学习内容与进展保存在 `wiki/content.json`，由 leo 随学习更新并保存到仓库。HTML 为生成页面：

```sh
node scripts/build-wiki.mjs
node scripts/check-wiki.mjs
node scripts/test-wiki.mjs
```

记录规范与协作约定统一见 [AGENTS.md](./AGENTS.md)，不单独生成记录约定或学习日志页面。资料收录与计划建档不计为学习完成。

## 学习目录

| 目录 | 方向 |
| --- | --- |
| [01-agent-control-and-orchestration](./01-agent-control-and-orchestration/index.html) | Agent 控制循环与工作流编排 |
| [02-tool-use-and-protocols](./02-tool-use-and-protocols/index.html) | Tool Use 与工具协议 |
| [03-context-rag-and-memory](./03-context-rag-and-memory/index.html) | 上下文管理、RAG 与记忆 |
| [04-planning-reasoning-and-reflection](./04-planning-reasoning-and-reflection/index.html) | 规划、推理与自我修正 |
| [05-environment-interaction](./05-environment-interaction/index.html) | Agent 与真实环境交互 |
| [06-multi-agent-collaboration](./06-multi-agent-collaboration/index.html) | 多 Agent 协作 |
| [07-evaluation-and-observability](./07-evaluation-and-observability/index.html) | 评估、可观测性与持续改进 |
| [08-security-and-permissions](./08-security-and-permissions/index.html) | 安全与权限控制 |
| [09-data-prompts-and-model-adaptation](./09-data-prompts-and-model-adaptation/index.html) | 数据、提示和模型适配 |
| [10-production-and-reliability](./10-production-and-reliability/index.html) | 生产系统与可靠性工程 |

## 理论与实践

- 论文及权威材料的阅读笔记、来源和局限分析写在所属子方向或分类页面，并保存在 `wiki/content.json`；不再创建分类 `papers/` 子目录或独立论文 HTML 页面。
- 单一子方向的练手项目及实验记录放在该子方向内；07 的理论页为 `subtopics/07-N.html`，其 `subtopics/07-N/projects/` 保存项目列表和独立项目页面。左侧导航直接进入具体项目。其他分类保留在所属子方向的表格行内。
- 每个分类的 `projects/` 只保存跨越该分类多个子方向的项目；左侧菜单可在各分类下展开 Projects 入口。
- 根目录 [projects/](./projects/README.md) 只保存跨分类的综合项目；独立根目录项目位置由用户明确指定。
- 阅读论文时关联对应的代码实现；实践时记录任务、环境、步骤、结果和失败原因。
- 分类之间通过相对链接关联资料和项目，避免重复保存同一份内容。

当前已初始化学习计划、资料队列与练习计划，全文阅读和实验尚未开始。后续以实际证据更新进展。第七类覆盖上线前后效果评估与 bad-case 闭环；第十类关注运行可靠性。

## 协作约定

见 [AGENTS.md](./AGENTS.md)。后续回答以可核查的权威材料、论文和 GitHub 项目为依据，并明确区分已有证据、工程判断和待验证假设。

