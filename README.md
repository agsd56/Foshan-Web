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
├── index.html              首页
├── foshan.html             城市志（档案、纪事、分区、市民）
├── ming.html               大明共和国
├── guide.html              新手指南（11 个章节）
├── join.html               加入我们
├── 404.html                404 页面
├── _headers                Cloudflare Pages 响应头（安全 + 缓存）
├── robots.txt
├── sitemap.xml
├── functions/
│   └── api/
│       └── stats.js        /api/stats — EarthMC 数据代理
└── assets/
    ├── css/style.css       全部样式
    ├── js/
    │   ├── placeholder.js  图片占位回退（必须最先加载）
    │   ├── main.js         导航 / 滚动动画 / 目录高亮 / 复制
    │   └── live.js         实时数据渲染
    └── img/
        ├── favicon.ico          站点图标（16/32/48/64）
        ├── foshan-logo-512.png  高清图标 / 分享图
        ├── foshan-logo-180.png  iOS 主屏图标
        ├── recipes/             16 张合成配方图（已提取）
        └── （城市图 / 风景图待补）
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

页面里所有图片都**已经写好了真实文件名**，只是文件还不存在。浏览器加载失败时会自动渲染一张同风格的占位图（显示"图片占位 · 待替换"和文件名）。

**替换方法：把真实图片按下面的文件名放进 `assets/img/`，刷新页面即可。不需要改任何 HTML。**

| 文件名 | 所在页面 | 建议尺寸 | 内容 |
|---|---|---|---|
| `league-hero.jpg` | 联盟首页首屏 | 1920 × 1080 | 联盟全景（同时作为分享封面） |
| `league-map.jpg` | 联盟首页 · 简介 | 1600 × 900 | 八城分布示意 / 地图截图 |
| `city-foshan.jpg` | 联盟首页 · 佛山主卡 | 1400 × 1000 | 佛山城市全景 |
| `city-shaoguan.jpg` | 联盟首页 · 韶关 | 1200 × 675 | 韶关（丹霞、北江） |
| `city-qingyuan.jpg` | 联盟首页 · 清远 | 1200 × 675 | 清远（北江、峡谷） |
| `city-yingde.jpg` | 联盟首页 · 英德 | 1200 × 675 | 英德（英西峰林） |
| `city-fengxigu.jpg` | 联盟首页 · 风溪谷 | 1200 × 675 | 风溪谷（城景） |
| `city-shantou.jpg` | 联盟首页 · 汕头 | 1200 × 675 | 汕头（内海湾） |
| `city-sihui.jpg` | 联盟首页 · 四会 | 1200 × 675 | 四会（贞山、绥江） |
| `city-shixing.jpg` | 联盟首页 · 始兴 | 1200 × 675 | 始兴（客家围楼） |
| `history-founding.jpg` | 城市志 · 纪事 | 1600 × 900 | 建城初期的佛山 |
| `history-shop.jpg` | 城市志 · 纪事 | 1000 × 1000 | 佛山商店 |
| `history-gate.jpg` | 城市志 · 纪事 | 1000 × 1000 | 城市门禁 |
| `ming-capital.jpg` | 明国页 · 历史 | 1600 × 900 | 南京 · 大明首都 |

> 早期版本的 `hero-foshan.jpg`、`city-zumiao.jpg`、`scene-01~04.jpg` 已不再被引用，可以忽略。
>
> `assets/img/recipes/` 下的 16 张合成配方图已从官方《城镇指南》PDF 中提取，随仓库一并提交，**不需要替换**。

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
- 国家历史与行政区划：[EarthMC Wiki · 大明共和国](https://wiki.earthmc.net/wiki/Nostra:Republic_of_Ming)
- 佛山现实文化背景：公开资料（祖庙、南风古灶、千灯湖、醒狮、石湾陶艺等）

本站为非官方粉丝站点，与 Mojang Studios、Microsoft 及 EarthMC 官方无隶属关系。
Minecraft 是 Mojang Studios 的商标。
