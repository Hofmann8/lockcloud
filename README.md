# 🔒 LockCloud

浙江大学 DFM Locking 舞队私有云存储服务

一个安全、易用的团队文件管理系统，支持文件上传、下载、预览和管理员权限控制。

## ✨ 特性

- 🔐 **安全认证** - JWT + 邮箱验证双重保障
- 📁 **文件管理** - 上传、下载、删除、预览
- 🏷️ **标签系统** - 灵活的文件分类和搜索
- 📱 **多端支持** - Web + 移动端 App
- 👥 **权限控制** - 普通用户和管理员角色
- 📊 **操作日志** - 完整的审计追踪
- 🌐 **中文界面** - 完全本地化

## 🏗️ 技术架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Web Frontend   │     │  Mobile App     │     │                 │
│  Next.js 16     │     │  Expo / RN      │     │  Flask Backend  │
│  React 19       │     │  React Native   │     │  Python 3.9+    │
│  TypeScript     │     │  TypeScript     │     │  SQLAlchemy     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  PostgreSQL 13  │
                        │  AWS S3 存储     │
                        └─────────────────┘
```

## 📁 项目结构

```
lockcloud/
├── backend/                 # Flask 后端 API
│   ├── auth/               # 认证模块
│   ├── files/              # 文件管理
│   ├── tags/               # 标签系统
│   ├── file_requests/      # 文件请求
│   ├── services/           # S3 服务
│   └── ...
│
├── lockcloud-frontend/     # Next.js Web 前端
│   ├── app/               # 页面路由
│   ├── components/        # UI 组件
│   ├── lib/               # 工具库
│   └── ...
│
├── LockCloud-app/          # Expo 移动端 App
│   ├── app/               # 页面路由 (Expo Router)
│   ├── components/        # UI 组件
│   ├── hooks/             # 自定义 Hooks
│   ├── stores/            # Zustand 状态管理
│   └── ...
│
└── README.md
```

## 🚀 快速开始

### 环境要求

- Node.js 18+
- Python 3.9+
- PostgreSQL 13+
- S3 兼容存储

### 后端

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # 配置环境变量
python app.py
```

### Web 前端

```bash
cd lockcloud-frontend
npm install
cp .env.example .env.local  # 配置环境变量
npm run dev
```

### 移动端 App

```bash
cd LockCloud-app
npm install
cp .env.example .env        # 配置环境变量
npx expo start
```

## 🔑 核心功能

| 功能 | Web | App |
|------|-----|-----|
| 用户注册/登录 | ✅ | ✅ |
| 文件上传 | ✅ | ✅ |
| 文件浏览/搜索 | ✅ | ✅ |
| 文件预览/下载 | ✅ | ✅ |
| 标签管理 | ✅ | ✅ |
| 批量操作 | ✅ | ✅ |
| 离线支持 | - | ✅ |
| 管理员功能 | ✅ | - |

## 📖 详细文档

- [后端 API 文档](./backend/README.md)
- [Web 前端文档](./lockcloud-frontend/README.md)
- [移动端 App 文档](./LockCloud-app/README.md)

## 🔒 安全特性

- JWT 身份认证
- Bcrypt 密码加密
- 邮箱验证机制
- 请求频率限制
- CORS 跨域保护
- 文件类型和大小验证

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
```

### Web 前端 (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_S3_BASE_URL=https://your-bucket.s3.bitiful.net
```

### 移动端 App (.env)
```bash
EXPO_PUBLIC_API_URL=http://localhost:5000
EXPO_PUBLIC_S3_BASE_URL=https://your-bucket.s3.bitiful.net
```

## 👨‍💻 维护者

**Hofmann** - Funk & Love

---

<p align="center">Made with ❤️ for Funk & Love</p>
