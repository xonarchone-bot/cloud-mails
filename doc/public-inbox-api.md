# 匿名收件 API 文档

本文档描述 `cloud-mail` 匿名收件功能的公开 API。相关接口由 `mail-worker/src/api/public-inbox-api.js` 注册，路径前缀为 `/public-inbox`。

## 1. 基本说明

- Base URL：部署后的 Worker 域名，例如 `https://<your-worker-domain>`
- 请求方式：全部为 `GET`
- 认证方式：公开接口，无需 `Authorization` token
- 返回格式：统一 JSON 包装
- 邮箱地址处理：服务端会对 `address` 执行 `trim()` 和小写化
- 访问范围：只返回收件类型、未删除、非保存中的邮件
- 黑名单规则：命中黑名单时不会抛错，列表返回空数组，详情返回 `null`

成功响应格式：

```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

失败响应格式：

```json
{
  "code": 403,
  "message": "匿名收件已关闭"
}
```

注意：当前错误处理通过 JSON 中的 `code` 表达业务状态，HTTP 状态码不一定等于业务 `code`。

## 2. 后台配置

匿名收件由系统设置控制：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `anonymousReceive` | number | `0` | 是否开启匿名收件。`0` 开启，`1` 关闭 |
| `anonymousReceiveCount` | number | `10` | 每个邮箱允许公开查看的最近邮件数量。`-1` 表示不限制，最大分页大小仍建议按 50 请求 |
| `anonymousReceiveRefresh` | number | `10` | 前端自动刷新间隔，单位秒 |
| `anonymousReceiveRegisteredUser` | number | `0` | 是否允许已注册/已添加邮箱匿名收件。`0` 允许，`1` 禁止 |
| `anonymousReceiveDomains` | string | `""` | 允许匿名收件的邮箱域名，英文逗号分隔；为空时使用全部可用邮箱域名 |
| `anonymousReceiveBlacklist` | string | `""` | 黑名单，英文逗号分隔，支持精确邮箱和通配符 |

黑名单示例：

```text
test@example.com,*@example.org,admin@*,*@internal.local
```

通配符规则：

- `*` 匹配任意长度字符
- `?` 匹配单个字符
- 不含通配符时按完整邮箱精确匹配

## 3. 邮件对象

列表接口和最新邮件接口返回的是公开列表字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `emailId` | number | 邮件 ID，按时间递增 |
| `sendEmail` | string | 发件人邮箱 |
| `name` | string | 发件人名称 |
| `subject` | string | 邮件标题 |
| `code` | string | 邮件验证码/提取码字段 |
| `text` | string | 邮件纯文本内容 |
| `toEmail` | string | 收件邮箱 |
| `toName` | string | 收件名称 |
| `recipient` | string | 原始收件人信息 |
| `type` | number | 邮件类型 |
| `status` | number | 邮件状态 |
| `unread` | number | 未读状态 |
| `createTime` | string | 创建时间 |
| `isDel` | number | 删除状态 |
| `attList` | array | 附件列表 |

详情接口会额外返回 `content`、`cc`、`bcc`、`inReplyTo`、`relation`、`messageId`、`message` 等完整邮件字段。

## 4. 获取邮件列表

```http
GET /public-inbox/list
```

查询参数：

| 参数 | 必填 | 类型 | 说明 |
| --- | --- | --- | --- |
| `address` | 是 | string | 要公开查看的邮箱地址 |
| `emailId` | 否 | number | 游标邮件 ID。首次请求可传 `0` 或不传 |
| `timeSort` | 否 | number | 排序/翻页方向。`0` 或不传表示向旧邮件翻页；`1` 表示查询比 `emailId` 更新的邮件 |
| `size` | 否 | number | 本次返回数量。默认取系统限制；最大不超过系统限制或 50 |

请求示例：

```bash
curl "https://<your-worker-domain>/public-inbox/list?address=demo@example.com&emailId=0&timeSort=0&size=20"
```

成功响应示例：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [
      {
        "emailId": 123,
        "sendEmail": "sender@example.net",
        "name": "Sender",
        "subject": "Your verification code",
        "code": "123456",
        "text": "Your code is 123456",
        "toEmail": "demo@example.com",
        "toName": "demo",
        "recipient": "demo@example.com",
        "type": 1,
        "status": 1,
        "unread": 0,
        "createTime": "2026-05-13 20:00:00",
        "isDel": 0,
        "attList": []
      }
    ],
    "total": 1,
    "latestEmail": {
      "emailId": 123
    }
  }
}
```

空列表响应：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [],
    "total": 0,
    "latestEmail": {
      "emailId": 0
    }
  }
}
```

分页说明：

- 首次加载：`emailId=0&timeSort=0`
- 加载更旧邮件：传当前列表最后一封邮件的 `emailId`，并保持 `timeSort=0`
- 查询更新邮件：传当前列表最新邮件的 `emailId`，并设置 `timeSort=1`

## 5. 获取最新邮件

```http
GET /public-inbox/latest
```

用于轮询指定邮箱的新邮件。

查询参数：

| 参数 | 必填 | 类型 | 说明 |
| --- | --- | --- | --- |
| `address` | 是 | string | 要公开查看的邮箱地址 |
| `emailId` | 否 | number | 当前客户端已知的最新邮件 ID，接口返回比它更新的邮件 |

请求示例：

```bash
curl "https://<your-worker-domain>/public-inbox/latest?address=demo@example.com&emailId=123"
```

成功响应示例：

```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "emailId": 124,
      "sendEmail": "sender@example.net",
      "name": "Sender",
      "subject": "New message",
      "code": "",
      "text": "Hello",
      "toEmail": "demo@example.com",
      "toName": "demo",
      "recipient": "demo@example.com",
      "type": 1,
      "status": 1,
      "unread": 0,
      "createTime": "2026-05-13 20:01:00",
      "isDel": 0,
      "attList": []
    }
  ]
}
```

## 6. 随机获取一个可公开邮箱

```http
GET /public-inbox/random
```

从未删除账号中随机返回一个邮箱地址，并排除匿名收件黑名单命中的账号。

请求示例：

```bash
curl "https://<your-worker-domain>/public-inbox/random"
```

成功响应示例：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "address": "demo@example.com"
  }
}
```

没有可用邮箱时：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "address": ""
  }
}
```

## 7. 获取邮件详情

```http
GET /public-inbox/detail
```

查询参数：

| 参数 | 必填 | 类型 | 说明 |
| --- | --- | --- | --- |
| `address` | 是 | string | 要公开查看的邮箱地址 |
| `emailId` | 是 | number | 邮件 ID |

请求示例：

```bash
curl "https://<your-worker-domain>/public-inbox/detail?address=demo@example.com&emailId=123"
```

成功响应示例：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "emailId": 123,
    "sendEmail": "sender@example.net",
    "name": "Sender",
    "accountId": 1,
    "userId": 1,
    "subject": "Your verification code",
    "code": "123456",
    "text": "Your code is 123456",
    "content": "<p>Your code is 123456</p>",
    "cc": "[]",
    "bcc": "[]",
    "recipient": "demo@example.com",
    "toEmail": "demo@example.com",
    "toName": "demo",
    "inReplyTo": "",
    "relation": "",
    "messageId": "",
    "type": 1,
    "status": 1,
    "resendEmailId": null,
    "message": null,
    "unread": 0,
    "createTime": "2026-05-13 20:00:00",
    "isDel": 0,
    "attList": []
  }
}
```

黑名单命中或公开数量限制为 `0` 时：

```json
{
  "code": 200,
  "message": "success",
  "data": null
}
```

## 8. 常见错误

| 业务 `code` | 场景 | `message` 示例 |
| --- | --- | --- |
| `501` | `address` 不是合法邮箱 | `非法邮箱` / `Invalid email` |
| `403` | 后台关闭匿名收件 | `匿名收件已关闭` / `Anonymous inbox is disabled` |
| `501` | `detail` 未传有效 `emailId` | `邮件不存在无法回复` |
| `404` | 请求的邮件不存在或不在公开范围内 | `邮件不存在无法回复` |
| `502` | Worker 未绑定 KV 或 D1 | `KV database not bound` / `D1 database not bound` |

## 9. 调用建议

- 公开页面初次加载时先调用 `/public-inbox/list`。
- 页面轮询新邮件时调用 `/public-inbox/latest`，轮询间隔使用后台设置的 `anonymousReceiveRefresh`。
- 加载更多旧邮件时继续调用 `/public-inbox/list`，`emailId` 使用当前列表最后一封邮件 ID。
- 如果需要给用户一个可直接查看的邮箱，可调用 `/public-inbox/random`。
- 客户端应以响应体里的 `code` 判断业务结果，不要只依赖 HTTP 状态码。
