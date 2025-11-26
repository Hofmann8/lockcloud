# LockAI - AI 对话模块

## 功能概述

LockAI 提供强大的 AI 对话功能，支持：
- 多模型对话（GPT-5.1-thinking 等）
- 对话历史管理
- Token 使用统计
- 费用追踪
- **网络搜索增强（Tavily）**

## 网络搜索功能

### 配置 Tavily API

1. 访问 [Tavily](https://tavily.com/) 注册账号
2. 获取 API Key
3. 在 `.env` 文件中配置：

```bash
TAVILY_API_KEY=your-tavily-api-key-here
```

### 使用网络搜索

LockAI 支持两种联网搜索模式：

#### 1. 自动模式（推荐）- GPT 自动决定

默认启用，GPT 会根据用户问题自动判断是否需要联网搜索：

```bash
POST /api/ai/chat
Content-Type: application/json
Authorization: Bearer <token>

{
  "conversation_id": 1,
  "message": "2024年诺贝尔物理学奖得主是谁？",
  "model": "gpt-5.1-thinking"
  # enable_tools: true (默认值，可省略)
}
```

GPT 会自动识别需要最新信息的问题并调用搜索工具。

#### 2. 手动模式 - 强制联网搜索

如果你想强制使用联网搜索，添加 `use_web_search` 参数：

```json
{
  "conversation_id": 1,
  "message": "帮我查一下最新的 AI 发展",
  "model": "gpt-5.1-thinking",
  "use_web_search": true
}
```

#### 3. 禁用自动搜索

如果不想让 GPT 自动联网（例如纯创意写作），可以禁用工具：

```json
{
  "message": "帮我写一首诗",
  "enable_tools": false
}
```

### 自定义搜索查询

手动模式下，可以自定义搜索查询：

```json
{
  "message": "帮我总结一下最新的 AI 发展",
  "use_web_search": true,
  "web_search_query": "2024 AI artificial intelligence latest developments"
}
```

### 响应格式

启用网络搜索后，响应会包含额外字段：

```json
{
  "conversation_id": 1,
  "message": {
    "id": 123,
    "content": "根据最新搜索结果，2024年诺贝尔物理学奖...",
    "role": "assistant",
    ...
  },
  "web_search_used": true,
  "search_results": {
    "answer": "简短答案摘要",
    "results": [
      {
        "title": "来源标题",
        "url": "https://example.com",
        "content": "相关内容摘要",
        "score": 0.95
      }
    ]
  }
}
```

## API 端点

### 1. 获取可用模型
```
GET /api/ai/models
```

### 2. 创建对话
```
POST /api/ai/conversations
{
  "model": "gpt-5.1-thinking"
}
```

### 3. 发送消息（支持网络搜索）
```
POST /api/ai/chat
{
  "conversation_id": 1,
  "message": "你的问题",
  "enable_tools": true,      // 可选，默认 true，启用 GPT 自动判断
  "use_web_search": false,   // 可选，默认 false，强制联网搜索
  "web_search_query": null   // 可选，自定义搜索查询
}
```

### 4. 获取对话历史
```
GET /api/ai/conversations/<conversation_id>
```

### 5. 获取使用统计
```
GET /api/ai/usage
```

## 网络搜索最佳实践

### GPT 如何判断是否需要联网

在**自动模式**下，GPT 会根据以下规则自动判断：

✅ **GPT 会自动联网的场景**：
- 询问最新新闻、事件（"2024年诺贝尔奖"）
- 需要实时数据（"今天北京天气"、"当前比特币价格"）
- 需要事实核查（"某某公司最新财报"）
- 技术文档查询（"Python 3.12 新特性"）
- 明确要求搜索（"帮我查一下..."、"搜索..."）

❌ **GPT 不会联网的场景**：
- 创意写作（"写一首诗"、"编一个故事"）
- 代码生成（"写一个排序算法"）
- 数学计算（"计算 123 * 456"）
- 个人意见（"你觉得怎么样"）
- 通用知识（"什么是机器学习"）

### 何时使用手动模式

建议在以下情况使用手动模式（`use_web_search: true`）：
- GPT 没有自动联网但你需要最新信息
- 需要自定义搜索查询
- 测试和调试搜索功能

### 搜索查询优化

好的搜索查询示例：
```
"2024 Nobel Prize Physics winner"
"latest Python 3.12 features"
"current weather Beijing"
```

不好的搜索查询：
```
"帮我写一首诗"
"你觉得怎么样"
"计算 123 + 456"
```

### 成本考虑

- 网络搜索会增加 token 使用量（搜索结果作为上下文）
- 建议仅在需要最新信息时启用
- 可以通过 `max_results` 参数控制结果数量

## 错误处理

### Tavily API 错误

| 错误代码 | 说明 | 解决方案 |
|---------|------|---------|
| 401 | API Key 无效 | 检查 TAVILY_API_KEY 配置 |
| 429 | 请求速率限制 | 等待后重试 |
| 402 | 配额不足 | 充值或升级账户 |

### 降级策略

如果 Tavily 服务不可用：
- 系统会自动降级到普通对话模式
- 不会影响正常的 AI 对话功能
- 日志中会记录警告信息

## 示例代码

### Python 客户端

```python
import requests

# 启用网络搜索的对话
response = requests.post(
    'http://localhost:5000/api/ai/chat',
    headers={'Authorization': f'Bearer {token}'},
    json={
        'message': '2024年最新的 AI 技术趋势是什么？',
        'use_web_search': True,
        'model': 'gpt-5.1-thinking'
    }
)

data = response.json()
print(data['message']['content'])

# 查看搜索结果
if data.get('web_search_used'):
    print('\n搜索来源：')
    for result in data['search_results']['results']:
        print(f"- {result['title']}: {result['url']}")
```

### JavaScript 客户端

```javascript
// 自动模式（推荐）- GPT 自动判断是否需要联网
const response = await fetch('/api/ai/chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: '2024年诺贝尔物理学奖得主是谁？',
    model: 'gpt-5.1-thinking'
    // enable_tools: true (默认值)
  })
});

const data = await response.json();
console.log(data.message.content);

// 显示搜索来源（如果 GPT 决定联网）
if (data.web_search_used) {
  console.log('GPT 自动使用了网络搜索');
  console.log('搜索来源：');
  data.search_results.results.forEach(result => {
    console.log(`- ${result.title}: ${result.url}`);
  });
}

// 手动模式 - 强制联网搜索
const response2 = await fetch('/api/ai/chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: '帮我查一下最新的 AI 发展',
    use_web_search: true,  // 强制联网
    model: 'gpt-5.1-thinking'
  })
});
```

## 监控和调试

### 日志

网络搜索相关日志：
```
INFO: 执行网络搜索: 2024年诺贝尔物理学奖...
INFO: 网络搜索完成，找到 5 条结果
WARNING: 网络搜索失败: API Key 无效，继续使用普通模式
```

### 使用统计

网络搜索会计入 token 使用量：
- 搜索结果作为上下文添加到对话中
- 增加的 token 数量取决于搜索结果的长度
- 可以通过 `/api/ai/usage` 查看详细统计

## 性能优化

1. **缓存搜索结果**（未来功能）
   - 相同查询在短时间内复用结果
   - 减少 API 调用次数

2. **智能搜索判断**（未来功能）
   - AI 自动判断是否需要搜索
   - 减少不必要的搜索调用

3. **结果精简**
   - 当前配置：`include_raw_content=False`
   - 只获取摘要，不获取完整网页内容
   - 节省 token 和响应时间

## 安全考虑

- API Key 存储在环境变量中，不提交到代码库
- 搜索结果经过过滤，移除敏感信息
- 支持域名白名单/黑名单（可配置）
- 请求日志记录，便于审计

## 未来计划

- [ ] 搜索结果缓存
- [ ] 智能搜索触发
- [ ] 多语言搜索优化
- [ ] 图片搜索支持
- [ ] 搜索历史记录
- [ ] 自定义搜索引擎
