# 佛山 · FOSHAN — EarthMC 城市官网

EarthMC 大明共和国广东省佛山市的城市网站。纯静态站点，无构建步骤，可直接部署到 Cloudflare Pages。

---

## 技术说明

| 项目 | 说明 |
|---|---|
| 前端 | 原生 HTML + CSS + JavaScript，**无框架、无构建** |
| 后端 | 一个 Cloudflare Pages Function（`functions/api/stats.js`），代理 EarthMC 官方 API |
| 依赖 | 零。不需要 `npm install` |
| 部署 | GitHub 仓库 → Cloudflare Pages 自动构建 |

设计语言：深墨底 / 鎏金 / 岭南青，中文衬线标题 + 等宽数据字体，无外部字体与 CDN 请求。

---

## 目录结构

```
.
├── index.html              首页（城市卡片由 site.json 渲染）
├── photos.html             精选照片（相册 + 灯箱）
├── guide.html              新手指南
├── join.html               加入我们
├── admin.html              后台管理（不参与公开导航）
├── 404.html
├── content/
│   ├── site.json           城市 / 相册 / 首屏数据
│   ├── guide-body.html     新手指南正文（后台可编辑）
│   └── join-body.html      加入我们正文（后台可编辑）
├── _headers
├── robots.txt
├── sitemap.xml
├── functions/
│   └── api/
│       └── stats.js        /api/stats — EarthMC 数据代理
└── assets/
    ├── css/
    │   ├── style.css       全站样式
    │   └── admin.css       后台专用样式
    ├── js/
    │   ├── placeholder.js  图片占位回退（必须最先加载）
    │   ├── main.js         导航 / 滚动动画 / 复制
    │   ├── live.js         EarthMC 实时数据
    │   ├── site.js         读取 site.json 渲染首页与相册
    │   └── admin.js        后台逻辑（GitHub API）
    └── img/
        ├── favicon.ico          站点图标
        ├── foshan-logo-512.png  高清图标
        ├── foshan-logo-180.png  iOS 主屏图标
        ├── recipes/             16 张合成配方图
        └── uploads/             后台上传的图片（自动创建）
```

---

## 本地预览

不用装任何东西。在项目根目录执行：

```bash
python -m http.server 8000
```

然后打开 `http://localhost:8000`。

> 直接双击 `index.html` 也能看页面，但 `/api/stats` 实时数据会失效（`file://` 协议下没有后端），页面会显示 HTML 里的静态数据，不影响浏览。

---

## 部署到 Cloudflare Pages

### 1. 推送到 GitHub

```bash
git init
git add .
git commit -m "init: foshan city site"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

### 2. 在 Cloudflare 创建项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → 左侧 **Workers & Pages**
2. 点击 **Create** → **Pages** → **Connect to Git**
3. 授权 GitHub，选择刚推送的仓库
4. 构建设置：

   | 字段 | 填写 |
   |---|---|
   | Framework preset | **None** |
   | Build command | **留空** |
   | Build output directory | **留空**（或填 `/`） |

5. 点击 **Save and Deploy**

约 30 秒后站点上线，地址形如 `https://<项目名>.pages.dev`。

### 3. 关于 Functions

`functions/` 目录会被 Cloudflare 自动识别，无需额外配置。
部署后访问 `/api/stats` 应返回 JSON：

```json
{ "ok": true, "town": { "name": "Foshan", "mayor": "bbdqz", ... } }
```

若返回 502，说明上游 API 暂时不可用，页面会自动回退到内置静态数据，不会白屏。

### 4. 绑定自定义域名（可选）

Pages 项目 → **Custom domains** → **Set up a custom domain**。
如果域名已经托管在 Cloudflare，DNS 会自动配置；否则按提示添加 CNAME 记录。

绑定后，请同步修改这两处的域名：

- `sitemap.xml` 里的 5 个 `<loc>`
- `robots.txt` 里的 `Sitemap:` 一行

---

## 替换占位图片

完整清单见 **[图片清单.md](图片清单.md)**：每张图的文件名、所在页面、建议尺寸、上传注意事项都在里面。

核心规则：把图片按清单里的文件名放进 `assets/img/`，刷新页面即可生效，**不需要修改任何 HTML**。
文件不存在时，页面会自动渲染同风格的占位图。

**注意事项**

- 格式用 `.jpg`（或 `.webp`，但需要同步改 HTML 里的扩展名）。
- 单张建议压缩到 **300KB 以内**，首屏图不超过 **500KB**，否则移动端加载慢。
- 图片会按容器比例裁切（`object-fit: cover`），构图时把主体放中间。
- 游戏截图建议：按 `F2` 截图，关闭 HUD（`F1`）会更干净；光影包能显著提升观感。

> 想加新图片：复制任意一个 `<figure class="photo photo--wide">` 块，改 `src`、`data-label`、`data-hint` 即可。`data-label` 是占位图上的文字，`data-hint` 是建议尺寸提示。

---

## 内容维护

### 修改城市数据

页面里的数字（居民数、区块数、市长）默认是**静态兜底值**，页面加载时会由 `/api/stats` 自动覆盖成最新数据。所以正常情况下**不需要手动改**。

如果 API 挂了想手动更新，搜索 `data-live="residents"` 这类标记即可。

### 添加公告

编辑 `index.html` 里 `<!-- ============ NEWS ============ -->` 下方的三个 `<article class="card">`，复制一块改日期和文字。

### 修改市民名录

`foshan.html` 中 `id="citizens"` 一节，每位居民一个 `<div class="card">`。

### 调整配色

全部颜色集中在 `assets/css/style.css` 顶部的 `:root` 变量里：

```css
--gold:        #d8b45a;   /* 主色，明国旗帜色系 */
--jade:        #5fa08c;   /* 辅助色，岭南青 */
--bg:          #0b0e0d;   /* 背景 */
--text:        #eae6dc;   /* 正文 */
```

改这几个值，全站同步变化。

---

## 上线前待补充

- [ ] **社区群组**：`join.html` 里「QQ 群与 Discord 频道正在筹备中」一段，拿到群号/邀请链接后替换。
- [ ] **自定义域名**：改 `sitemap.xml`、`robots.txt`。
- [ ] **真实截图**：按上表放入 `assets/img/`。
- [ ] **城市公告**：`index.html` 的三条动态按实际情况改写。
- [ ] **数据核对**：居民数、区块数由 API 自动同步，但「规划中」的片区描述属于设定，可按实际建设进度调整。

---

## 内容来源

- 城镇与国家实时数据：[EarthMC API v4](https://api.earthmc.net/ui)
- 佛山现实文化背景：公开资料（祖庙、南风古灶、千灯湖、醒狮、石湾陶艺等）

本站为非官方粉丝站点，与 Mojang Studios、Microsoft 及 EarthMC 官方无隶属关系。
Minecraft 是 Mojang Studios 的商标。

---

## 本地后台（推荐）

不想折腾 Token 和部署，用这个：

1. 双击 `本地后台/启动.bat`
2. 浏览器会自动打开 `http://127.0.0.1:8765/`
3. 改内容 → 点右上角「保存到本地」
4. 关掉黑色窗口，把网站文件传上去

它**直接读写硬盘**上的 `content/` 和 `assets/img/uploads/`，不联网、不需要 Token、不依赖 GitHub。
每次保存前自动备份到 `本地后台/backups/`（保留最近 30 份）。

上传网站时**不要带上 `本地后台/` 文件夹**，它只是本地工具。

详见 [`本地后台/README.md`](本地后台/README.md)。

---

## 在线后台（GitHub）

访问 `/admin.html`，用 GitHub Token 连接仓库后，就能在浏览器里增删城市、上传照片、改首屏图。

### 1. 创建 Token

GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens**

- Repository access：只勾选这个网站仓库
- Permissions → Contents：**Read and write**
- 生成后立刻复制（只显示一次）

### 2. 连接

在 `/admin.html` 填入用户名、仓库名、分支（main）、Token，点「连接」。
配置保存在这台电脑的浏览器里，下次打开自动连接。

### 3. 编辑

| 标签 | 能做什么 |
|---|---|
| 城市 | 改名称 / 市长 / 居民 / 区块 / 标签 / 介绍，换图，拖拽排序，增删 |
| 相册 | 新建 / 删除相册，进入相册上传照片（自动压缩转 JPG），设封面，批量删除，拖拽排序 |
| 教程 | 编辑新手指南正文（HTML 片段），支持预览与重新读取 |
| 加入 | 编辑「加入我们」正文（HTML 片段） |
| 站点 | 更换首屏大图与标题 |

**其他功能**

- 改动会自动存到浏览器草稿，刷新或误关不会丢，重新连接时可选择恢复
- 「导出」把当前内容存成 JSON 备份，「导入」可整体恢复或批量改
- 点缩略图看大图
- `Ctrl / Cmd + S` 直接发布
- 标题旁的「未保存」标记提示还有改动没提交

### 相册结构

照片按相册分组，存在 `content/site.json` 的 `albums` 数组里：

```json
{
  "albums": [
    {
      "id": "album-xxx",
      "title": "佛山夜景",
      "desc": "城市灯光与河岸",
      "cover": "assets/img/uploads/photo-xxx.jpg",
      "photos": [
        { "id": "p1", "src": "assets/img/uploads/photo-xxx.jpg", "title": "千灯湖", "caption": "2026.10" }
      ]
    }
  ]
}
```

前台 `/photos.html` 先显示相册封面墙，点进去看该相册的照片，地址栏会变成 `#album/<id>`，可以直接分享。

### 教程与加入页

这两个页面的正文单独存在 `content/guide-body.html` 和 `content/join-body.html`，
页面骨架（导航、页脚）仍在 HTML 里。后台「教程」「加入」标签编辑的就是这两个文件。

保存后 Cloudflare 重新部署，前台会自动加载新正文。改坏了点「重新读取」可以还原成仓库里的版本。

### 4. 发布

点右上角「保存并发布」。图片先上传，再提交 `content/site.json`，Cloudflare 约 30 秒后自动重新部署。

### 注意

- **Token 等于仓库写权限**，不要在公共电脑上保存，用完点「断开」并清除浏览器数据。
- 图片会自动压成 JPG，单张控制在 1MB 以内（GitHub API 限制）。
- 后台是纯静态页面，没有服务端，Token 不会发往任何第三方。
- `/admin.html` 已加 `noindex`，不会被搜索引擎收录，但知道地址的人仍能打开——安全性依赖 Token 本身。
