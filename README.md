# 🔒 LockCloud

浙江大学 DFM Locking 舞队私有云存储服务

一个安全、易用的团队文件管理系统，支持文件上传、下载、预览和管理员权限控制。

## ✨ 特性

- 🔐 **安全认证** - JWT + 邮箱验证双重保障
- 📁 **文件管理** - 上传、下载、删除、预览
- 🎨 **手绘风格** - 独特的 UI 设计
- 👥 **权限控制** - 普通用户和管理员角色
- 📊 **操作日志** - 完整的审计追踪
- 🌐 **中文界面** - 完全本地化

## 🏗️ 技术架构

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Next.js 16    │ ───▶ │   Flask 3.0     │ ───▶ │  PostgreSQL 13  │
│   React 19      │      │   Python 3.9+   │      │                 │
│   TypeScript    │      │   SQLAlchemy    │      └─────────────────┘
└─────────────────┘      └─────────────────┘               │
                                  │                         │
                                  ▼                         ▼
                         ┌─────────────────┐      ┌─────────────────┐
                         │   AWS S3 / 比特  │      │   操作日志系统   │
                         │   对象存储       │      │                 │
                         └─────────────────┘      └─────────────────┘
```

### 前端技术栈
- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4
- React Query + Zustand
- Axios + React Hot Toast

### 后端技术栈
- Flask 3.0
- PostgreSQL + SQLAlchemy
- JWT + Bcrypt
- Boto3 (S3)
- Flask-Mail + Flask-Limiter

## 🚀 快速开始

### 环境要求

- Node.js 18+
- Python 3.9+
- PostgreSQL 13+
- S3 兼容存储

### 1. 克隆项目

```bash
git clone https://github.com/Hofmann8/lockcloud.git
cd lockcloud
```

### 2. 启动后端

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入数据库、S3、邮件等配置

# 初始化数据库
python init_db.py

# 启动服务
python app.py
```

后端将在 `http://localhost:5000` 启动

### 3. 启动前端

```bash
cd lockcloud-frontend

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，配置 API 地址

# 启动开发服务器
npm run dev
```

前端将在 `http://localhost:3000` 启动

## 📁 项目结构

```
lockcloud/
├── backend/                 # Flask 后端
│   ├── auth/               # 认证模块
│   ├── files/              # 文件管理
│   ├── logs/               # 日志系统
│   ├── services/           # S3 服务
│   ├── app.py             # 应用入口
│   ├── config.py          # 配置文件
│   └── requirements.txt   # Python 依赖
│
├── lockcloud-frontend/     # Next.js 前端
│   ├── app/               # 页面路由
│   ├── components/        # UI 组件
│   ├── lib/               # 工具库
│   │   ├── api/          # API 客户端
│   │   └── utils/        # 工具函数
│   ├── stores/           # 状态管理
│   ├── types/            # 类型定义
│   └── package.json      # Node 依赖
│
└── README.md             # 项目文档
```

## 🔑 核心功能

### 用户功能
- ✅ 邮箱注册和验证
- ✅ 安全登录（JWT）
- ✅ 文件上传（拖拽支持）
- ✅ 文件浏览和搜索
- ✅ 文件预览和下载
- ✅ 文件删除

### 管理员功能
- ✅ 查看所有用户文件
- ✅ 操作日志审计
- ✅ 系统统计数据
- ✅ 用户管理

## 🔒 安全特性

- JWT 身份认证
- Bcrypt 密码加密
- 邮箱验证机制
- 请求频率限制
- CORS 跨域保护
- 安全响应头（HSTS, CSP）
- SQL 注入防护
- 文件类型和大小验证

## 📖 API 文档

### 认证接口
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/send-verification` - 发送验证码
- `POST /api/auth/verify-email` - 验证邮箱
- `GET /api/auth/me` - 获取当前用户

### 文件接口
- `GET /api/files` - 获取文件列表
- `POST /api/files/upload` - 上传文件
- `DELETE /api/files/:id` - 删除文件
- `GET /api/files/stats` - 文件统计

### 日志接口（管理员）
- `GET /api/logs` - 获取操作日志

详细文档请查看：
- [后端 API 文档](./backend/README.md)
- [前端开发文档](./lockcloud-frontend/README.md)

## 🚢 部署

### 后端部署

```bash
# 使用 Gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app

# 或使用 Docker
docker build -t lockcloud-backend .
docker run -p 5000:5000 lockcloud-backend
```

### 前端部署

```bash
# 构建生产版本
npm run build
npm start

# 或部署到 Vercel
vercel --prod
```

### Nginx 配置示例

```nginx
# 前端
server {
    listen 80;
    server_name cloud.funk-and.love;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
    }
}

# 后端 API
server {
    listen 80;
    server_name api.cloud.funk-and.love;
    
    location / {
        proxy_pass http://127.0.0.1:5000;
    }
}
```

## 🛠️ 开发工具

### 后端工具脚本

```bash
# 初始化数据库
python init_db.py

# 列出所有用户
python list_users.py

# 设置管理员
python set_admin.py user@example.com
```

### 前端开发命令

```bash
# 开发模式
npm run dev

# 构建
npm run build

# 代码检查
npm run lint
```

## 📝 环境变量

### 后端 (.env)
```bash
FLASK_ENV=development
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://user:pass@localhost/lockcloud
JWT_SECRET_KEY=your-jwt-secret
S3_ENDPOINT_URL=https://s3.bitiful.net
S3_ACCESS_KEY_ID=your-key
S3_SECRET_ACCESS_KEY=your-secret
MAIL_SERVER=smtp.gmail.com
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-password
```

### 前端 (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_S3_BASE_URL=https://funkandlove-cloud2.s3.bitiful.net
```

## 🤝 贡献

本项目为内部项目，仅供 Funk & Love 团队使用。

## 📄 许可证

内部项目 - 保留所有权利

## 👨‍💻 维护者

**Hofmann** - Funk & Love

---

<p align="center">Made with ❤️ for Funk & Love</p>
