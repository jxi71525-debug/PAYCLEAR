# PayClear Pro 💸

PayClear 是一款极简、智能的多人实时分账 PWA 应用，专为室友合租、朋友聚餐、团队旅行等场景设计。它拥有类微信的聊天交互界面，不仅支持手动记账，还支持通过聊天对话实现“AI 智能记账”。

## 🌟 核心特性

- **🚀 零构建，单文件前端**：整个前端应用主要由一个 `index.html` 驱动（借助 Babel Standalone 实时编译 React JSX），配合 Tailwind CSS，无需复杂的 Node.js/Webpack 构建流程。
- **📱 PWA 与原生级体验**：支持安装到手机桌面，深度适配 iOS 刘海屏/灵动岛安全区域（Safe Area）。内置点击触觉反馈（Haptic Feedback），提供原生的交互手势（左滑结清/删除群聊，上滑清除通知）。
- **⚡ 实时多端同步**：基于 Supabase Realtime，群组内的聊天消息和账单记录实现毫秒级多端同步。加入“乐观 UI（Optimistic UI）”更新策略，即便在弱网环境下也能秒发消息。
- **🤖 智能记账与聊天结合**：像在微信群里聊天一样，输入“打车花了50”，系统即可智能识别意图、金额和分类，自动生成账单。
- **🌐 多币种与实时汇率**：支持 CNY, USD, EUR, JPY 等多种主流货币，内置实时汇率 API，记账时自动折算主货币，也可以手动微调汇率。
- **📷 专属硬件调用**：深度集成底层的 `Html5Qrcode` API，提供全屏、流畅的自定义扫码加好友/加群界面（强制调用后置摄像头）。
- **🎮 趣味决策小游戏**：买单时不知道谁付？内置“幸运转盘”、“炸弹扑克”、“比大小”等小游戏，让随机决定谁买单。
- **📊 动态可视化报表**：集成 Apache ECharts，一键生成个人及群组的收支柱状图、折线图和分类饼图。
- **🌓 深色模式与多语言**：完美支持系统级深色模式（Dark Mode），支持中英双语一键切换。

## 🛠 技术栈

- **前端 UI**：React 18 (UMD), Tailwind CSS (CDN)
- **后端 & 数据库**：[Supabase](https://supabase.com/) (PostgreSQL, Realtime, Row Level Security)
- **数据可视化**：Apache ECharts
- **扫码库**：Html5Qrcode
- **图标**：FontAwesome 6

## 📂 核心文件结构

- `index.html`：项目核心主入口，包含了所有的 UI 组件、React 逻辑、状态管理以及与 Supabase 的通信。
- `supabase_setup_v2.sql`：最新的数据库表结构初始化脚本。包含 `users`, `friendships`, `groups`, `group_members`, `bills`, `messages` 等表的创建，以及外键、触发器、RLS 权限控制的设置。
- `manifest.json` / `sw.js`：用于 PWA 桌面安装支持与基本缓存。
- `package.json` / `vercel.json`：用于适配 Vercel 等平台部署的配置文件（目前主要推荐通过 GitHub Pages 部署）。

## 🚀 部署与运行

### 1. 数据库配置 (Supabase)
1. 注册并登录 Supabase，创建一个新的 Project。
2. 进入 SQL Editor，将 `supabase_setup_v2.sql` 文件中的所有内容复制进去并执行，完成数据库表的初始化。
3. 在 Supabase 的 Project Settings -> API 中，获取你的 `Project URL` 和 `anon public key`。
4. 打开 `index.html`，找到以下代码并替换为你的真实配置：
   ```javascript
   const SUPABASE_URL = '你的_Supabase_URL';
   const SUPABASE_KEY = '你的_Supabase_Anon_Key';
   ```

### 2. 本地开发与测试
- 由于使用了摄像头 API (`Html5Qrcode`) 和剪贴板等现代 Web API，**必须**在 `localhost` 或 `HTTPS` 环境下运行。
- 可以使用 VS Code 的 Live Server 插件，或者 Python 的简单 HTTP 服务器：
  ```bash
  python -m http.server 8000
  ```
- 然后在浏览器中访问 `http://localhost:8000`。

### 3. 线上部署 (GitHub Pages)
由于本项目是纯静态的 SPA 应用，非常适合部署在 GitHub Pages：
1. 将此文件夹作为一个 GitHub Repository 上传。
2. 确保 `index.html` 位于仓库的根目录。
3. 在仓库的 Settings -> Pages 中，选择 `Deploy from a branch`，选择 `main` 分支的 `/root` 目录。
4. 几分钟后，即可通过你的 GitHub Pages 域名访问该应用。

> **注意**：扫码加好友生成的专属链接依赖于当前的访问域名，部署后生成的二维码会自动适配线上的域名。

## 💡 常见问题排查

- **扫码界面黑屏/无法调用摄像头？**
  浏览器安全策略限制，摄像头只能在 `https://` 或 `http://localhost` 下被调用。如果是局域网 IP（如 `192.168.x.x`），请配置 HTTPS 代理或直接推送到线上测试。
- **iOS 桌面图标出现黑底？**
  iOS 系统会将带透明通道的 PNG 图片渲染为黑底，目前项目已更新为纯色背景的 PWA Icon 以修复此问题。
- **从外部链接（二维码）进入后反复弹出提示？**
  已修复 URL 状态处理逻辑，加入了 `processedUrlActionRef` 防抖处理，确保扫码或点击邀请链接后仅弹出一次提示，并自动清理 URL 后缀。

## 📄 许可

本项目供学习和交流使用。保留所有权利。