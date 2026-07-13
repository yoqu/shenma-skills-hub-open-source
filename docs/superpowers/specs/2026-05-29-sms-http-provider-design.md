# SMS Provider Design

> Status: 根据本轮讨论修订。本文以当前确认需求为准，覆盖通用 HTTP 自定义供应商和内置瓴羊超信供应商。

## 背景

项目已有短信验证码登录流程，但验证码只保存在后端内存中，并通过 debug 日志输出，没有接入真实短信供应商。现在需要在后台“登录方式”页面配置短信登录供应商，同时保留后续扩展自定义供应商的能力。

阿里云帮助中心确认瓴羊超信属于 Quick Audience 的短信触达能力，签名和模板需要在平台侧准备。本项目内置发送逻辑以 luxelakes `CommonService.sendValidateCode` 调用链为参考：验证码模板参数使用 `code`，最终调用瓴羊超信 HTTP 接口发送。

## 目标

- 在后台“登录方式”页面新增“短信验证码”配置项。
- 支持两类 `providerType`：`HTTP`、`LINGYANG_CHAOXIN`。
- 通用 HTTP 供应商只使用一个 `headersJson` 字段；页面以 Header 列表维护，并区分普通请求头、敏感请求头。
- 敏感 Header 保存后不回显明文；编辑时显示“已设置”，留空保存时保留原值，用户显式清空时删除。
- 内置瓴羊超信发送验证码，只实现当前可用接口，不在字段名、枚举值、页面或文档面向用户处暴露版本概念。
- 真实供应商启用后，发送成功才保存验证码，避免供应商失败但验证码仍可用。
- 未启用真实供应商时保留当前开发行为。

## 非目标

- 不实现供应商多实例列表。
- 不实现短信签名、模板、发送记录管理。
- 不引入 Redis。验证码存储仍沿用当前内存实现，作为待确认风险保留。
- 不实现不可用接口或备用协议。

## 数据模型

后端新增独立 `sms_provider_config` 表，而不是复用 `oauth_providers`。短信发送不是 OAuth 登录，字段、配置校验和运行链路不同，独立模型更清晰。

一条默认配置：

- `code`: `sms_login`
- `display_name`: `短信验证码`
- `provider_type`: `HTTP` 或 `LINGYANG_CHAOXIN`
- `enabled`: 是否启用真实发送
- `endpoint_url`: HTTP 自定义供应商请求地址；瓴羊超信为接口地址
- `method`: HTTP 自定义供应商请求方法，默认 `POST`
- `headers_json`: HTTP 自定义供应商 Header 列表
- `body_template`: HTTP 自定义供应商请求体模板
- `success_status`: HTTP 自定义供应商成功 HTTP 状态码，默认 `200`
- `success_json_path` / `success_expected_value`: HTTP 自定义供应商可选响应体成功判断
- `extra_json`: 内置供应商普通配置
- `secret_json`: 内置供应商敏感配置

`headersJson` 存储数组，不再拆出敏感请求头字段：

```json
[
  {
    "name": "Authorization",
    "value": "Bearer xxx",
    "secret": true,
    "description": "供应商鉴权"
  },
  {
    "name": "Content-Type",
    "value": "application/json",
    "secret": false
  }
]
```

管理接口读取时，敏感项返回：

```json
{
  "name": "Authorization",
  "value": "",
  "secret": true,
  "valueSet": true
}
```

## 瓴羊超信配置

页面显示为“瓴羊超信”，请求字段仍复用通用接口：

- `endpointUrl`: 接口地址，例如 `https://...`
- `extraJson.appId`: 应用 ID
- `extraJson.accessKey`: AccessKey
- `secretJson.accessSecret`: AccessSecret
- `extraJson.signName`: 短信签名
- `extraJson.templateCode`: 模板编码
- `extraJson.templateParamKey`: 验证码模板变量名，默认 `code`
- `extraJson.smsReport`: 可选回执地址
- `extraJson.timeout`: 可选超时时间毫秒
- `extraJson.maxRetry`: 可选重试次数

发送请求：

1. 请求地址：`{endpointUrl}/openapi/cloud/userMarketing/sendSms`。
2. Query：`appId`、`accessKey`、`timestamp`。
3. Header：`Authorization` 为按参数名排序后的 `appId`、`accessKey`、`accessSecret`、`timestamp` 拼接字符串的 MD5。
4. Body：`phoneNumbers`、`signName`、`templateCode`、`templateParam`，其中 `templateParam[templateParamKey] = code`。
5. 响应：外层 JSON 读取 `data` 字符串，再解析内层 JSON；内层 `code == "OK"` 视为发送成功。

## 发送流程

1. 归一化手机号。
2. 按 `purpose` 做已有的手机号存在性预校验。
3. 生成 6 位验证码。
4. 查询启用的短信配置。
5. 未启用：保持当前开发日志行为。
6. 已启用：按 `providerType` 分发给对应 sender。
7. 发送成功后写入验证码缓存。
8. 返回 `ttl`。

## 管理接口

- `GET /api/admin/sms-provider`
- `PUT /api/admin/sms-provider`

接口只面向 SUPER_ADMIN，复用现有 `@RequireSuperAdmin` 和 JWT 鉴权。响应不返回任何敏感明文；审计 payload 只记录是否已设置或是否变更。

## 前端

在 `/admin/oauth` 对应的“登录方式”页面新增短信验证码行。

- 供应商选项：`HTTP 自定义`、`瓴羊超信`。
- HTTP 自定义：接口地址、Method、Header 列表、Body 模板、成功判断。
- 瓴羊超信：接口地址、AppId、AccessKey、AccessSecret、短信签名、模板编码、验证码变量名、回执地址、超时和重试。
- 敏感字段保存后不展示明文；编辑时可保留、替换或清空。

## 错误处理

- 启用时缺少必要配置：返回业务错误“短信供应商配置不完整”。
- HTTP 请求失败、状态码不匹配、响应 JSON 判断失败：返回“短信发送失败，请稍后重试”。
- 瓴羊超信返回非成功响应或响应解析失败：返回“短信发送失败，请稍后重试”。

## 测试

- `SmsProviderServiceTest`: 默认初始化、HTTP 敏感 Header 掩码、敏感 Header 保留/替换/清空、内置供应商敏感配置掩码、启用配置校验。
- `HttpSmsSenderTest`: Header 列表渲染、Body 模板渲染、响应成功判断。
- `LingyangChaoxinSmsSenderTest`: 签名生成、请求 URL/Header/Body、响应解析。
- `AuthServiceTest`: 启用供应商时先发送再保存验证码；发送失败时不保存验证码。

## 待确认风险

- 当前验证码仍为内存存储，重启或多实例部署时会失效或不一致。这个是历史实现延续，不在本次范围内修改；生产部署前应确认是否追加 Redis 化。
- 通用 HTTP 模板只做简单变量替换，不支持脚本化动态签名；需要动态签名的供应商应通过内置 provider adapter 扩展。
