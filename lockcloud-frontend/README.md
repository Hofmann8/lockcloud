# LockCloud Frontend

浙江大学 DFM Locking 舞队私有云存储服务 - 前端应用

## 技术栈

- **Next.js 16.0.1** - React 框架（App Router）
- **React 19.2.0** - UI 库
- **TypeScript 5+** - 类型安全
- **Tailwind CSS 4** - 样式框架
- **Axios** - HTTP 客户端
- **React Query (TanStack Query)** - 数据获取和缓存
- **Zustand** - 轻量级状态管理
- **React Hot Toast** - 通知提示
- **date-fns** - 日期格式化

## 项目结构

```
lockcloud-frontend/
├── app/                    # Next.js App Router 页面
│   ├── layout.tsx         # 根布局
│   └── page.tsx           # 首页
├── components/            # React 组件
├── lib/                   # 工具库
│   ├── api/              # API 客户端
│   │   └── client.ts     # Axios 配置
│   ├── utils/            # 工具函数
│   │   ├── format.ts     # 格式化函数
│   │   └── validation.ts # 验证函数
│   └── constants.ts      # 常量定义
├── stores/               # Zustand 状态管理
│   ├── authStore.ts     # 认证状态
│   └── fileStore.ts     # 文件状态
├── types/               # TypeScript 类型定义
│   └── index.ts
├── locales/             # 国际化（中文）
│   ├── zh-CN.ts        # 中文翻译
│   └── index.ts
└── public/             # 静态资源
```

## 快速开始

### 1. 安装依赖

确保已安装 Node.js 18+ 和 npm:

```bash
# 检查版本
node --version  # 应该 >= 18.0.0
npm --version

# 安装依赖
npm install
```

### 2. 配置环境变量

复制示例文件并编辑:

```bash
cp .env.example .env.local
```

编辑 `.env.local` 文件：

```bash
# API 配置
NEXT_PUBLIC_API_URL=http://localhost:5000

# S3 配置
NEXT_PUBLIC_S3_BASE_URL=https://funkandlove-cloud2.s3.bitiful.net
NEXT_PUBLIC_S3_MAIN_URL=https://funkandlove-main.s3.bitiful.net
```

**注意:** 
- 开发环境使用 `http://localhost:5000`
- 生产环境使用实际的 API 域名，如 `https://api.cloud.funk-and.love`

### 3. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

前端将自动连接到后端 API (确保后端已启动)。

## 开发指南

### 构建生产版本

```bash
npm run build
npm start
```

### 代码检查

```bash
npm run lint
```

### 清理缓存

```bash
# 清理 Next.js 缓存
rm -rf .next

# 重新安装依赖
rm -rf node_modules package-lock.json
npm install
```

## 功能特性

### 已实现

- ✅ 用户认证（注册、登录、邮箱验证）
- ✅ 文件浏览和搜索
- ✅ 文件上传（拖拽上传）
- ✅ 文件删除和预览
- ✅ 文件过滤（类型、排序）
- ✅ 管理员日志查看
- ✅ 管理员统计面板
- ✅ 响应式设计
- ✅ 错误边界和加载状态
- ✅ 中文本地化
- ✅ 手绘风格 UI 组件

### 核心组件

- **认证页面**: 登录、注册、邮箱验证
- **文件管理**: 上传区、文件网格、文件卡片
- **管理员面板**: 操作日志、统计数据
- **通用组件**: 按钮、输入框、模态框、加载动画

## 设计系统

### 颜色方案

- 主色：黑色 (#1a1a1a)、白色 (#fafafa)
- 强调色：橙色 (#ff8c42)、绿色 (#7bc96f)、蓝色 (#5fa8d3)、灰色 (#95a5a6)

### 字体

- 主字体：Inter
- 手写字体：Caveat（用于标题）

### 设计风格

- 手绘风格边框和线条
- 轻微的元素旋转
- 宽松的留白
- 非对称平衡

## API 集成

所有 API 调用通过 `lib/api/client.ts` 中配置的 Axios 实例进行：

- 自动添加 JWT token
- 统一错误处理
- 401 自动跳转登录
- 中文错误消息

## 状态管理

### Auth Store

```typescript
const { user, token, isAuthenticated, setAuth, clearAuth } = useAuthStore();
```

### File Store

```typescript
const { files, currentDirectory, setFiles, setCurrentDirectory } = useFileStore();
```

## 本地化

所有 UI 文本使用中文，通过 `locales/zh-CN.ts` 管理：

```typescript
import { t } from '@/locales';

// 使用翻译
<button>{t.common.submit}</button>
```

## 部署

### Vercel 部署（推荐）

1. 连接 GitHub 仓库
2. 配置环境变量
3. 自动部署

### 自托管部署

```bash
npm run build
npm start
```

使用 Nginx 反向代理：

```nginx
server {
    listen 80;
    server_name cloud.funk-and.love;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 开发指南

### 添加新页面

```typescript
// app/new-page/page.tsx
export default function NewPage() {
  return <div>新页面</div>
}
```

### 添加新组件

```typescript
// components/NewComponent.tsx
interface NewComponentProps {
  title: string;
}

export default function NewComponent({ title }: NewComponentProps) {
  return <div>{title}</div>
}
```

### 使用 API

```typescript
import { useQuery } from '@tanstack/react-query';
import { filesApi } from '@/lib/api/files';

const { data, isLoading } = useQuery({
  queryKey: ['files'],
  queryFn: () => filesApi.getFiles()
});
```

### 状态管理

```typescript
import { useAuthStore } from '@/stores/authStore';

const { user, isAuthenticated, setAuth } = useAuthStore();
```

## 性能优化

- 使用 Next.js 图片优化
- React Query 自动缓存
- 懒加载组件
- 代码分割

## 浏览器支持

- Chrome/Edge (最新版)
- Firefox (最新版)
- Safari (最新版)

## 故障排除

### 端口被占用
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill
```

### 依赖问题
```bash
rm -rf node_modules package-lock.json
npm install
```

### 构建失败
```bash
rm -rf .next
npm run build
```

## 许可证

内部项目 - 仅供 Funk & Love 使用

## 维护者

Hofmann - Funk & Love
