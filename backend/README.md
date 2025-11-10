# LockCloud Backend

浙江大学 DFM Locking 舞队私有云存储服务 - 后端 API

## 技术栈

- **Flask 3.0** - Python Web 框架
- **PostgreSQL** - 关系型数据库
- **SQLAlchemy** - ORM
- **JWT** - 身份认证
- **Boto3** - AWS S3 对象存储
- **Flask-Mail** - 邮件服务
- **Flask-Limiter** - 请求限流
- **Bcrypt** - 密码加密

## 项目结构

```
backend/
├── app.py                 # 应用入口和配置
├── config.py             # 环境配置
├── exceptions.py         # 自定义异常
├── validators.py         # 全局验证器
├── requirements.txt      # Python 依赖
├── auth/                 # 认证模块
│   ├── models.py        # 用户和验证码模型
│   ├── routes.py        # 认证路由
│   ├── decorators.py    # 权限装饰器
│   ├── email_service.py # 邮件服务
│   └── templates/       # 邮件模板
├── files/               # 文件管理模块
│   ├── models.py       # 文件模型
│   ├── routes.py       # 文件路由
│   └── validators.py   # 文件验证器
├── logs/               # 日志模块
│   ├── models.py      # 日志模型
│   ├── routes.py      # 日志路由
│   └── service.py     # 日志服务
├── services/          # 外部服务
│   └── s3_service.py # S3 存储服务
└── migrations/        # 数据库迁移脚本
    └── add_is_admin_to_users.sql
```

## 快速开始

### 1. 环境要求

- Python 3.9+
- PostgreSQL 13+
- AWS S3 兼容存储（或 Bitiful S3）

### 2. 安装依赖

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 3. 配置环境变量

复制示例文件并编辑：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置以下关键参数：

```bash
# Flask 配置
FLASK_ENV=development
SECRET_KEY=your-secret-key-here

# 数据库配置
DATABASE_URL=postgresql://username:password@localhost:5432/lockcloud

# JWT 配置
JWT_SECRET_KEY=your-jwt-secret-key

# S3 存储配置
S3_ENDPOINT_URL=https://s3.bitiful.net
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=funkandlove-cloud
S3_MAIN_BUCKET_NAME=funkandlove-main

# 邮件配置
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_DEFAULT_SENDER=your-email@gmail.com

# CORS 配置
CORS_ORIGINS=http://localhost:3000,https://cloud.funk-and.love
```

### 4. 初始化数据库

```bash
# 创建数据库表
python init_db.py

# 添加管理员权限（可选）
python migrate_add_admin.py

# 设置用户为管理员
python set_admin.py user@example.com
```

### 5. 启动开发服务器

```bash
python app.py
```

服务器将在 `http://localhost:5000` 启动

## API 文档

### 认证接口

#### 注册
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "username": "用户名"
}
```

#### 发送验证码
```http
POST /api/auth/send-verification
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### 验证邮箱
```http
POST /api/auth/verify-email
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456"
}
```

#### 登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

#### 获取当前用户
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### 文件接口

#### 获取文件列表
```http
GET /api/files?directory=/path&search=keyword
Authorization: Bearer <token>
```

#### 上传文件
```http
POST /api/files/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary>
directory: /path
```

#### 删除文件
```http
DELETE /api/files/<file_id>
Authorization: Bearer <token>
```

#### 获取文件统计
```http
GET /api/files/stats
Authorization: Bearer <token>
```

### 日志接口（管理员）

#### 获取操作日志
```http
GET /api/logs?page=1&per_page=50&action=upload
Authorization: Bearer <admin-token>
```

## 数据库模型

### User（用户）
- `id`: 主键
- `email`: 邮箱（唯一）
- `username`: 用户名
- `password_hash`: 密码哈希
- `is_verified`: 是否验证邮箱
- `is_admin`: 是否管理员
- `created_at`: 创建时间

### File（文件）
- `id`: 主键
- `filename`: 文件名
- `original_filename`: 原始文件名
- `file_size`: 文件大小
- `file_type`: 文件类型
- `directory`: 目录路径
- `s3_key`: S3 存储键
- `user_id`: 上传用户
- `uploaded_at`: 上传时间

### FileLog（操作日志）
- `id`: 主键
- `user_id`: 操作用户
- `file_id`: 文件 ID
- `action`: 操作类型（upload/delete/download）
- `ip_address`: IP 地址
- `user_agent`: 用户代理
- `created_at`: 操作时间

## 安全特性

- ✅ JWT 身份认证
- ✅ 密码 Bcrypt 加密
- ✅ 邮箱验证机制
- ✅ 请求频率限制
- ✅ CORS 跨域保护
- ✅ 安全响应头（HSTS, CSP, X-Frame-Options）
- ✅ SQL 注入防护（SQLAlchemy ORM）
- ✅ 文件类型验证
- ✅ 文件大小限制
- ✅ 管理员权限控制

## 部署

### 生产环境配置

```bash
# 设置环境变量
export FLASK_ENV=production
export SECRET_KEY=<strong-random-key>
export DATABASE_URL=<production-db-url>

# 使用 Gunicorn 启动
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Docker 部署（推荐）

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name api.cloud.funk-and.love;
    
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 工具脚本

### 初始化数据库
```bash
python init_db.py
```

### 列出所有用户
```bash
python list_users.py
```

### 设置管理员
```bash
python set_admin.py user@example.com
```

### 数据库迁移
```bash
python migrate_add_admin.py
```

## 开发指南

### 添加新的 API 端点

1. 在对应模块的 `routes.py` 中添加路由
2. 使用 `@jwt_required()` 保护需要认证的端点
3. 使用 `@admin_required` 保护管理员端点
4. 使用 `@limiter.limit()` 添加请求限流
5. 返回统一的 JSON 格式

### 错误处理

所有错误使用自定义异常类：

```python
from exceptions import LockCloudException

raise LockCloudException(
    code='FILE_001',
    message='文件不存在',
    status_code=404
)
```

### 日志记录

```python
from logs.service import log_file_operation

log_file_operation(
    user_id=user.id,
    file_id=file.id,
    action='upload',
    ip_address=request.remote_addr,
    user_agent=request.user_agent.string
)
```

## 测试

```bash
# 运行测试（待实现）
pytest

# 代码覆盖率
pytest --cov=.
```

## 许可证

内部项目 - 仅供 Funk & Love 使用

## 维护者

Hofmann - Funk & Love
