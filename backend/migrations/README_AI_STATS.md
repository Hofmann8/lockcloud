# AI 用户级统计功能更新

## 更新日期
2025-11-19

## 更新内容

### 1. 数据库迁移
为 `users` 表添加了 AI 使用统计字段：

- `ai_total_prompt_tokens` - 用户总输入 token 数
- `ai_total_completion_tokens` - 用户总输出 token 数
- `ai_total_tokens` - 用户总 token 数
- `ai_total_cost` - 用户总消费（美元）
- `ai_conversation_count` - 用户对话总数

### 2. 后端更新

#### 新增功能
- 每次 AI 对话后自动更新用户统计数据
- 新增管理员接口 `/api/ai/admin/usage` 查看所有用户的 AI 使用情况
- 优化 `/api/ai/conversations/<id>` 接口，返回历史消息时包含定价信息

#### 修复问题
- 修复对话计数逻辑，确保新对话正确计数
- 修复历史对话加载后不显示消费的问题

### 3. 前端更新

#### 新增页面
- `/admin/ai-usage` - 管理员 AI 使用统计页面
  - 显示活跃用户数
  - 显示系统总 token 用量
  - 显示系统总消费
  - 显示每个用户的详细统计

#### 优化功能
- 管理员主页添加快捷入口
- AI 对话页面加载历史对话时正确显示消费信息

## 迁移步骤

### 1. 运行数据库迁移
```bash
cd backend
python migrations/add_user_ai_stats.py
```

### 2. 同步现有数据
```bash
python sync_user_ai_stats.py
```

### 3. 重启后端服务
```bash
# 如果使用 systemd
sudo systemctl restart lockcloud-backend

# 或者手动重启
# 停止现有进程，然后重新启动
```

## 注意事项

1. **数据安全**：迁移脚本只添加新字段，不会删除或修改现有数据
2. **向后兼容**：所有新字段都有默认值，不影响现有功能
3. **性能影响**：每次 AI 对话会额外更新用户表，但影响很小
4. **统计准确性**：运行 `sync_user_ai_stats.py` 可以重新计算所有用户的统计数据

## API 变更

### 新增接口
- `GET /api/ai/admin/usage` - 获取所有用户的 AI 使用统计（需要管理员权限）

### 修改接口
- `GET /api/ai/conversations/<id>` - 返回的消息现在包含 `model_name` 和 `pricing` 字段

## 文件清单

### 后端
- `backend/migrations/add_user_ai_stats.py` - 数据库迁移脚本
- `backend/sync_user_ai_stats.py` - 数据同步脚本
- `backend/auth/models.py` - 更新 User 模型
- `backend/ai/routes.py` - 更新 AI 路由

### 前端
- `lockcloud-frontend/app/(dashboard)/admin/ai-usage/page.tsx` - 新增管理页面
- `lockcloud-frontend/app/(dashboard)/admin/page.tsx` - 更新管理主页
- `lockcloud-frontend/app/(dashboard)/ai/page.tsx` - 优化对话页面
- `lockcloud-frontend/lib/api/ai.ts` - 更新 API 类型定义

## 测试建议

1. 测试新用户发送 AI 消息后统计是否正确
2. 测试加载历史对话是否显示消费信息
3. 测试管理员查看所有用户统计
4. 测试多个用户的统计是否独立
