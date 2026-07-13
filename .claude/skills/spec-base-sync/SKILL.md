---
name: spec-base-sync
description: Use when 新增或变更 spec 需求 / bug，需要把开发进度同步到团队飞书多维表格（Base），或要查询、更新 Spec 需求表 / Bug 清单，或用户提到 spec 同步飞书、需求池、进度看板、bug 清单同步时。本仓库 skill-team-share 专属约定。
---

# Spec / Bug 飞书多维表格同步规范

## Overview

本仓库已进入多人协作开发模式。**所有 spec 需求与 bug 的进度，统一在飞书多维表格（Base）中维护，作为团队唯一进度看板。** 本 skill 是该同步流程的强制约定，触发任一「触发时机」时必须执行对应同步动作。

## Base 坐标

- Base 名称：`SkillStack 研发协作表`（位于知识库「内部需求池管理」节点下）
- Base 链接（Wiki）：`https://fl2x3d4eo2.feishu.cn/wiki/R7uowIr4ZiGS7akZj6ycua26nbd`
- `--base-token`：`Pc3Ub9aBEaYpPssUzXdcfuUVnGf`（即 obj_token，CLI 操作统一用它，不要用 wiki node token）
- Spec 需求表 `--table-id`：`tblsgK4S0Oms5FNU`
- Bug 清单表 `--table-id`：`tblIfc2NtjxTjaqZ`
- 两表通过 Spec 表 `关联需求`/`关联Bug` 双向关联字段打通：bug 必须挂到对应需求上。

## 操作工具

统一使用 `lark-cli base +...`（飞书 `lark-base` skill 提供的原子命令），不要改走裸 API。写记录前先 `+field-list` 确认字段结构，再按 `lark-base-cell-value` 规范构造 CellValue。人员字段不知道 `open_id` 时，先用 `lark-cli contact +search-user --query "<姓名/邮箱>" --as user` 解析。

## 触发时机（强制）

1. **新增 spec**：每次在 `docs/superpowers/specs/` 产出新的设计 / spec 文档（含 brainstorming 流程产出），或开始一个新功能点开发前，必须在 Spec 需求表新增一行。
2. **状态变更**：开发状态推进（待开发 → 开发中 → 联调中 → 测试中 → 已上线 / 已暂停）时，同步更新对应记录的 `开发状态` 字段。
3. **新增 bug**：发现 bug 时在 Bug 清单表新增一行，并尽量用 `关联需求` 关联到对应 spec。
4. **bug 流转**：修复进度变化时更新 `Bug状态`（待处理 → 处理中 → 已修复 → 已验证；或 不修复 / 无法复现）。

## Spec 需求表字段映射

| 字段 | 类型 | 填写约定 |
|------|------|----------|
| 功能点 | 文本（主字段） | 一句话描述这条需求做什么 |
| 需求编号 | 自动编号（`SPEC-0001`） | 系统生成，勿手填 |
| 功能模块 | 单选 | `frontend` / `backend` / `cli` / `全栈` / `基础设施` |
| 开发人员 | 人员 | 写 `open_id`；用 `lark-contact` 把姓名解析成 `open_id` |
| 需求提出人 | 人员 | 同上 |
| 开发状态 | 单选 | `待开发` / `开发中` / `联调中` / `测试中` / `已上线` / `已暂停` |
| 优先级 | 单选 | `P0` / `P1` / `P2` |
| spec仓库路径 | 文本 | 仓库内相对路径，如 `docs/superpowers/specs/2026-06-01-xxx-design.md` |
| spec文档链接 | 超链接 | 飞书在线文档 URL（如有） |
| 提出时间 | 日期 | 需求提出当天 |
| 预计完成时间 | 日期 | 排期 deadline |
| 关联分支/PR | 文本 | 开发分支名或 PR 链接 |
| 备注 | 文本 | 阻塞原因 / 验收口径等 |

## Bug 清单表字段映射

| 字段 | 类型 | 填写约定 |
|------|------|----------|
| Bug标题 | 文本（主字段） | 一句话描述现象 |
| 关联需求 | 双向关联 → Spec 表 | 关联到对应需求记录；无对应 spec 时可留空 |
| 功能模块 | 单选 | 与 Spec 表同选项 |
| 严重程度 | 单选 | `阻塞` / `严重` / `一般` / `轻微` |
| 复现步骤 | 文本 | 可复现的步骤 |
| 报告人 | 人员 | 写 `open_id` |
| 处理人 | 人员 | 写 `open_id` |
| Bug状态 | 单选 | `待处理` / `处理中` / `已修复` / `已验证` / `不修复` / `无法复现` |
| 环境 | 单选 | `dev` / `staging` / `prod` |
| 提出时间 | 日期 | bug 提出当天 |
| 修复时间 | 日期 | 修复完成日 |
| 截图附件 | 附件 | 走 `+record-upload-attachment` 上传，不要当普通字段写 |

## 写入示例

新增一条 spec（人员字段需先用 `lark-contact` 解析 `open_id`）：

```bash
lark-cli base +record-upsert --as user \
  --base-token Pc3Ub9aBEaYpPssUzXdcfuUVnGf \
  --table-id tblsgK4S0Oms5FNU \
  --json '{"功能点":"团队 skill tab 分类筛选","功能模块":"frontend","开发状态":"开发中","优先级":"P1","spec仓库路径":"docs/superpowers/specs/2026-06-01-xxx-design.md","开发人员":[{"id":"ou_xxx"}]}'
```

新增一条关联到 spec 的 bug（`关联需求` 传目标 spec 的 `record_id`）：

```bash
lark-cli base +record-upsert --as user \
  --base-token Pc3Ub9aBEaYpPssUzXdcfuUVnGf \
  --table-id tblIfc2NtjxTjaqZ \
  --json '{"Bug标题":"xxx","关联需求":[{"id":"<spec_record_id>"}],"严重程度":"一般","Bug状态":"待处理","环境":"dev"}'
```

## Common Mistakes

- ❌ `--json` 外层套 `{"fields":{...}}`。✅ `+record-upsert` 顶层直接传字段映射 `{"字段名": 值}`，不要包 `fields`。
- ❌ 人员字段写姓名字符串。✅ 写 `[{"id":"ou_xxx"}]`，先用 `lark-contact` 解析。
- ❌ 写 `需求编号` / `创建时间` 等系统字段。✅ 只写存储字段，自动编号由平台生成。
- ❌ 把附件当普通字段写进 `--json`。✅ 用 `+record-upload-attachment`。
- ❌ 用 wiki node token 当 `--base-token`。✅ 统一用 obj_token `Pc3Ub9aBEaYpPssUzXdcfuUVnGf`。
- ❌ select 传近义词导致平台自动新建选项。✅ 选项名严格用上表枚举值。
