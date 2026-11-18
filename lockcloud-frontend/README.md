# LockCloud 前端

LockCloud 的网页端。设计方案（品牌、页面、播放器、组件清单）在上一级的 `FRONTEND_PLAN.md`，接口契约在 `CONTRACT.md`。

## 技术栈

- Next.js 16.3.6（App Router）、React 19。这一版 Next 和常见的写法有差别，动 Next 相关的代码前先看 `node_modules/next/dist/docs/`
- Tailwind CSS v4，颜色、字体、动效的 token 都在 `app/globals.css`
- TanStack Query（服务器数据）、Zustand（本地状态）
- hls.js + 自己写的播放器
- lucide-react 图标、thumbhash 占位图

所有页面都是客户端组件，数据在浏览器里取，没有服务端取数。

## 结构

```
app/
  layout.tsx              根布局：字体、主题、Providers
  (app)/                  登录后的页面，共用外壳（侧栏、命令面板、上传队列）
    page.tsx              资料库
    activity/             活动（?date=&type=&name=）
    f/[id]/               文件整页
    search/  people/  compare/  upload/  requests/  trash/  admin/
  auth/                   login、callback（LockAuth 登录回来）、dev-login（本地免密）
components/
  ui/                     Button、Dialog、Popover、Sheet、Toast、Tooltip、Field
  brand/                  PauseMark（标志和加载动画）、LuckyLocker（空状态）
  shell/                  Sidebar、MobileNav、CommandPalette、PageHeader
  media/                  Thumb、JustifiedGrid、FileGrid、SelectionBar
  viewer/                 FileViewer、ImageViewer、InfoPanel
  player/                 Player、ProgressBar、BeatRuler、节拍计算
  files/  library/  upload/   编辑对话框、筛选条、活动卡、上传
lib/
  api/                    client.ts（axios、统一错误）、files.ts、media.ts、types.ts
  urls.ts                 签名地址的批量获取和缓存、显示名、宽高比
  theme.tsx  hooks.ts  format.ts  permissions.ts  routes.ts
stores/                   authStore、uploadStore、selectionStore、uiStore
public/moves/             Lucky Locker 动作表情（16 个 GIF）
```

## 开发

```bash
npm install
npm run dev
```

接口地址读 `NEXT_PUBLIC_API_URL`：开发默认 `http://localhost:5000`（`.env.development`），生产默认 `https://cloud.funk-and.love`（`.env.production`）。要临时改就写在 `.env.local` 里。

本地登录：后端 `.env` 里开 `DEV_LOGIN_ENABLED=true`，打开 `/auth/dev-login`。

检查：

```bash
npx tsc --noEmit
npx eslint .
```

## 约定

- 接口都从 `lib/api/` 调，页面里不拼地址。类型手写在 `lib/api/types.ts`，和 `CONTRACT.md` 一一对应，契约改了两边一起改。
- 错误统一是 `ApiError`（`code` 做分支，`message` 是后端给的中文，直接显示）。查询和修改出错时由 `lib/providers.tsx` 统一弹提示，不想弹的加 `meta: { silent: true }`。401 统一跳登录页并带回原地址。
- 图片、视频地址都是后端签的：用 `useSignedUrl(id, 用途名)`，不自己拼存储参数。用途名有 `thumbnav`、`thumbmobile`、`thumbdesktop`、`previewdesktop` 等。
- 显示名永远是 `filename || original_filename`（`displayName`），不从文件名里解析日期、序号、活动。
- 文件的 `width` / `height` 是原始像素，`orientation` 为 5–8 时显示宽高要对调（`aspectOf`）。人脸框是原始坐标，画之前用 `lib/faces.ts` 的 `uprightBox` 换算。
- 上传者和管理员能直接改删，其他人点了走申请（`lib/permissions.ts`）。删除是进回收站。
- 看片的地方（查看器、播放器、对比页）用常暗的 `.stage` 色板，不跟随主题。
- 图标文件（favicon）不改。

## 构建和部署

```bash
npm run build
```

产物是 `output: 'standalone'`。上一级的 `deploy.py` 把 `.next/standalone`、`.next/static`、`public` 打成 `dist/lockcloud-frontend.zip`，服务器上解压后 `npm start`（实际是 `node server.js`，监听 `127.0.0.1:3001`）。构建里的接口地址如果是 `localhost:5000`，`deploy.py` 会报错拦下。上线步骤见 `DEPLOY.md`。
