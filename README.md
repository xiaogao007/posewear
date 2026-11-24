<div align="center">

<img src="docs/banner.jpg" alt="人像 + 姿势 + 服饰 = 成品" width="900">

<sub>成品为用站内人像、姿势、服装作参考的 AI 生成示例；素材版权归原作者，见<a href="#致谢">致谢</a>。</sub>

<img src="docs/logo.svg" width="72" alt="衣姿 PoseWear">

# 衣姿 PoseWear

姿势、服装、人像参考图库，附中英文提示词；用自己的 API Key，在浏览器里直接 AI 试穿。

[![License: MIT](https://img.shields.io/badge/license-MIT-black)](LICENSE)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-f38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![在线体验](https://img.shields.io/badge/demo-posewear.pages.dev-ff2442)](https://posewear.pages.dev)
[![GitHub stars](https://img.shields.io/github/stars/atuizz/posewear?style=flat&color=black)](https://github.com/atuizz/posewear/stargazers)

[在线体验](https://posewear.pages.dev) · [功能](#功能) · [快速开始](#快速开始) · [部署](#部署) · [常见问题](#常见问题) · [English](README.en.md)

<img src="docs/home.jpg" alt="首页截图" width="900">

</div>

## 简介

衣姿是一个纯静态的参考图站点：三套素材库都能直接浏览、搜索和复制提示词。挑中的服装和姿势可以带到试穿工作台，配上你自己的照片和模型 API，生成试穿图。

不需要注册，也没有后端数据库。密钥、收藏和生成记录都只保存在你的浏览器里。

## 功能

| | |
|---|---|
| **素材库** | 姿势（多角度线稿）、深度姿势（热链原站深度图）、服装（按季节和类型分类）、人像（脸模参考，CC0）。每张图都有中文描述；深度姿势另附日文原名 |
| **搜索与筛选** | 中英文关键词、分类、排序、随机一张；每个素材有独立详情页，方便分享 |
| **试穿工作台** | 上传人物照，选服装和姿势，生成试穿图，或不用照片直接出图；一次可出多张，有前后对比、单张下载和打包下载 |
| **多家服务商** | OpenAI、Gemini、豆包 Seedream、OpenAI 兼容的自定义中转，见下表 |
| **模型下拉选择** | 填写服务商的 API Key 后自动获取生图模型，可刷新、切换；失败时可用标明未核验的预设，或手动填写中转别名。保存后在本机记住所选模型 |
| **图片放大预览** | 点击生成结果或「放大预览」，在大图窗口查看；可切换原始大小、滚动检查细节、下载原图，Esc 返回 |
| **穿搭出片风格** | 清透日常、温柔通勤、周末出街、约会氛围、轻甜学院、穿搭画报，附简短说明并同步中英文提示词；原片、白底、胶片色调和动漫可在「更多风格」选择 |
| **生成记录** | 保存在本机 IndexedDB，可查看、删除、清空，并可撤销 |
| **清楚的报错** | 密钥无效、限流、超时、被安全审核拦截等情况会分别说明，并给出下一步可以怎么做 |
| **减少误拦截** | 默认开启。发送前把提示词改写成中性的电商试穿描述，不改变服装和姿势；关闭后按原样发送 |
| **收藏 / 最近 / 组合** | 本机保存，可导入导出，删除可撤销；可以把多个素材拼成一段提示词 |
| **18+ 开关** | 成人向分类默认隐藏，打开前需要确认年龄 |
| **PWA 与深色模式** | 可安装，看过的内容离线也能打开；深色模式跟随系统，也可手动切换 |
| **中文 / English 界面** | 默认中文，右上角切换 |

### 支持的服务商

| 服务商 | 需要准备 | 默认模型 | 说明 |
|---|---|---|---|
| OpenAI | API Key（gpt-image 需已验证组织） | gpt-image-1 | 走 images/edits，多张参考图；安全审核最严 |
| Gemini | Google AI Studio 的 API Key | gemini-2.5-flash-image | 即 Nano Banana |
| 豆包 Seedream | 火山方舟 API Key | doubao-seedream-4-0-250828 | 国内直连，默认经本站代理以解决跨域 |
| 自定义中转 | Base URL + Key + 模型名 | 自填 | OpenAI 兼容；可选 edits（multipart）或 generations（JSON） |

### 分辨率与渲染质量

工作台的「画幅」「分辨率」「渲染质量」会保存在当前浏览器。默认使用标准分辨率；GPT Image 模型明确请求 `quality=medium`。高清、超清和高质量通常会增加费用与耗时，实际价格以服务商为准。不会自动更换模型。

以 `gpt-image-2` 的竖 3:4 为例：

| 档位 | 请求原生尺寸 |
|---|---|
| 标准 | 960×1280 |
| 高清 | 1536×2048 |
| 超清 | 1920×2560 |

其他画幅按相同比例提供合法尺寸。自动画幅由模型决定宽高，GPT Image 的高清、超清需先选择明确画幅。尺寸遵循 [OpenAI 官方规则](https://developers.openai.com/api/docs/guides/image-generation)：两边为 16 的倍数，长边不超过 3840，总像素不超过 8,294,400；2880×3840 不符合像素上限。本功能不进行后期放大，也不会把 1K 放大图标成原生高清。

`gpt-image-2.6-sunburst` / `gpt-image-2.6-flare` 及 2.5 的 Sunburst / Flare 支持自动画幅、以上原生尺寸档位，以及低、中等、高、极高（`xhigh`）、最高（`max`）、自动（`auto`）质量。工作台仍默认中等质量；更高质量可能增加费用与耗时。2.5 超过 2560×1440 的分辨率属于实验性支持。切回不支持已选质量的模型时，保留选择并提示调整，不静默替换质量。

`gpt-image-1` / mini / 1.5 仅提供标准尺寸与支持的画幅，可单独选低、中等或高质量；DALL·E 2 仅提供方形标准尺寸。Gemini 2.5 Flash Image 仅标准档，Gemini 3 Pro Image / 3.1 Flash Image 使用模型的 `imageConfig.imageSize`（1K / 2K / 4K），界面宽高标为文档参考值。Seedream 4.0 / 4.5 使用各自支持的像素尺寸，提供标准与高清。Gemini、Seedream 不发送 OpenAI 的 `quality`。未确认的 Seedream 模型使用服务商默认尺寸，未知兼容模型仅提供常用标准尺寸，高清不可用。

自定义中转按模型及所选协议发送参数，需中转实际支持；edits 的图片字段重试及 generations 回退保留同一尺寸与质量，不因参数失败而自动降档。当前模型不支持已保存的画幅或档位时，生成按钮禁用并提示调整。`gpt-image-2` 不发送 `input_fidelity`。

结果显示从图片文件读取的实际宽高、请求设置与尺寸不符提示，历史记录保留这些信息。单张下载与打包下载均保留服务商返回的原始字节。本站能核对返回尺寸，但无法证明中转内部是否进行过放大。

## 截图

| 试穿工作台 | 深色模式 | 手机 |
|:---:|:---:|:---:|
| <img src="docs/studio.jpg" alt="试穿工作台" width="420"> | <img src="docs/dark.jpg" alt="深色模式" width="420"> | <img src="docs/mobile.jpg" alt="手机" width="180"> |

## 快速开始

需要 Python 3.9+ 和 Pillow；当前锁定的测试与部署依赖需要 Node.js 22.12+。

```bash
git clone https://github.com/atuizz/posewear.git && cd posewear
pip install pillow

# 1. 从原作者的图库下载数据和图片到 ./assets-raw（数 GB，耗时较长）
python3 scripts/fetch-assets.py            # 也可只下部分：pose costume portrait

# 2. 构建到 dist/
python3 build.py

# 3. 本地预览 http://localhost:8787
python3 -m http.server 8787 -d dist
```

| 环境变量 | 作用 | 默认 |
|---|---|---|
| `POSEWEAR_RAW` | 原始素材目录 | `assets-raw` |
| `POSEWEAR_SITE` | 站点地址，用于 sitemap 和分享链接 | `https://posewear.pages.dev` |

### Windows 本机启动

安装好 Python、Node.js 和 Git 后，在项目目录运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-local.ps1
```

脚本会准备项目内的 Python 虚拟环境、安装依赖，在首次启动时下载完整素材并构建，随后启动包含 `/api/proxy` 的本地服务。打开 http://localhost:8787；按 Ctrl+C 停止。素材下载量较大，已下载的文件会保留，重新执行会跳过。

修改源码后加 `-Rebuild`；需要补全素材时加 `-FetchAssets`；端口可用 `-Port 8789` 指定。运行状态和日志保存在项目的 `.local/` 和 `.wrangler/`，不提交到仓库。AI 生成需要在网页设置中填入自己的服务商和 API Key。

本次配置的后台进程记录在 `.local/server-process.json`；可用 `powershell -NoProfile -ExecutionPolicy Bypass -File .\stop-local.ps1` 停止这组进程。脚本会先校验进程身份。手动在终端启动的服务用 Ctrl+C 停止。

部署到 Linux 云服务器时，需要同时承载 `dist/` 静态文件和 `/api/proxy`。`server/proxy.cjs` 提供 Node.js 生产运行适配，复用原代理逻辑，并在建立连接时校验 DNS、阻止内网目标和服务器元数据地址。生产依赖可用 `npm ci --omit=dev` 安装。`deploy/` 提供当前服务器的构建脚本、systemd 服务和 Caddy 模板；`POSEWEAR_SITE` 应设为正式域名后重新构建。素材来源和作者声明需保留。

## 部署

仓库不带素材，所以需要先在本地构建，再上传 `dist/` 到 Cloudflare Pages：

```bash
npm install
npx wrangler login
POSEWEAR_SITE=https://<你的项目名>.pages.dev python3 build.py
npx wrangler pages deploy dist --project-name <你的项目名>
```

- 第一次运行时，wrangler 会提示创建项目；之后同一条命令就是更新。
- `functions/api/proxy.js` 会作为 Pages Function 一起部署，只用于转发 API 请求。建议在 Cloudflare 控制台给 `/api/proxy` 加一条限流规则。
- CSP 等响应头由 `post.py` 生成在 `dist/_headers` 里。

## 测试

测试用 Playwright 拦截各服务商的接口，模拟成功、密钥错误、限流、5xx、超时、取消、安全拦截、多张输出等情况，不需要真实的 Key。

```bash
npm install && npx playwright install chromium
python3 -m http.server 8787 -d dist &
node tests/v12.js      # 图库、收藏、灯箱、路由、移动端
node tests/v13.js      # 试穿工作台全流程、深色模式、长文本
npm run test:studio-resolution # 独立本机测试服务；分辨率、质量、回退、持久化和原文件下载，无需图库素材或真实 Key
U=https://posewear.pages.dev node tests/v12.js   # 直接测线上
```

分辨率测试也可用 `CHROME_PATH` 指定本机 Chrome 可执行文件，截图和结果写入 `output/playwright/studio-resolution/`。

## 目录结构

```
src/                    前端源码，无框架
  app.js                图库、搜索筛选、收藏最近、灯箱、路由
  studio.js             试穿工作台：服务商适配、进度、结果、历史、减少误拦截
  extras.js             批量操作、导入导出
  style.css             样式（含深色模式）
  sw.js / zip.js        离线缓存 / 打包下载
functions/api/proxy.js  Pages Function，转发 API 请求
build.py / post.py      生成缩略图、数据、详情页、sitemap、_headers
costume_text.py         服装中英文描述
words.txt, tr_*.txt     词表与中英文翻译
depth/                  深度姿势素材包（只有文本，图片热链原站）
depthpack.py            把素材包编成可替换的 depths.json
scripts/                fetch-assets.py 下载素材，make-icons.js 生成图标
tests/                  Playwright 测试
docs/                   README 用图
```

## 常见问题

<details>
<summary><b>API Key 安全吗？</b></summary>

Key 只存在你浏览器的 localStorage 里，可在设置里清除。默认由浏览器直接请求服务商的官方接口。只有两种情况会经过本站的 `/api/proxy`：开启了「通过本站代理转发」，或使用自定义中转。这时它只按原样转发，不记录、不保存密钥和图片，并拒绝转发到内网地址。在公共电脑上用完记得清除。如果不放心，可以自己部署一份。
</details>

<details>
<summary><b>为什么会被「安全审核」拦下？</b></summary>

各家服务商都会审核输入的照片和生成的结果。真人照片配上泳装、内衣、露背等比较暴露的服装，最容易被拦，OpenAI 最严，Gemini 和 Seedream 相对宽松。「减少误拦截」可以降低正常穿搭被误判的概率，但不会、也不应该绕过对违规内容的审核。被拦时可以换一家服务商，或换一套服装。
</details>

<details>
<summary><b>素材可以商用吗？</b></summary>

本仓库不包含任何图片，素材版权归原作者所有，请以各原站的说明为准。人像库作者声明为 CC0。本仓库的 MIT 许可只覆盖代码和文案。
</details>

<details>
<summary><b>生成要多久、花多少钱？</b></summary>

通常每张半分钟左右，费用按你所用服务商的价格从你的账户扣除，本站不收费。
</details>

## 路线图

### 自建服务器：账号与受限资源（access-v1）

此版本普通姿势、服装、人像图库仍可匿名使用。深度姿势整库与成人向参考需要同时满足：站点开关开启、账号拥有 `content.adult.view`、已登录，且当前会话中主动确认开启。入口位于「更多 → 内容偏好」；只有获授权账号显示该选项，深度姿势菜单也随受限模式开启而出现。`users.permissions.manage` 用于账号邀请与内容查看权限管理。

- 运行环境：Node.js 24.15+，Python/Pillow 用于离线构建；`npm ci` 后执行 `npm run build`、`npm run dev`。Windows 也可运行 `start-local.ps1`。
- `dist/` 仅包含公开内容；`private/` 必须位于站点根目录之外。生产使用 `deploy/posewear.caddy.in` 的逐请求鉴权规则，不能只用静态 Pages 部署此版本。
- 首次启动的初始化码存储在服务的状态目录 `bootstrap-code` 文件中。通过「更多 → 登录 → 初始化管理员」设置自己的邮箱和密码；完成后初始化码立即作废。不会预置管理员密码。
- 管理员生成绑定邮箱、24 小时有效、单次使用的邀请码。新账号默认没有成人素材查看权限；邀请时可明确勾选授权。账号管理可随时授予、撤销或全站关闭。
- 生产 SQLite、签名密钥与审计记录保存在 systemd `StateDirectory=posewear-auth`，独立于发布目录；不要删除或仅备份单个正在写入的 SQLite 主文件。服务同时使用 WAL/SHM。不要把状态目录、私有资源、初始化码加入 Git、Web 根目录或公开备份。
- 更新请在新的 release 目录构建并切换软链接，不要在正在对外服务的 `dist` 内构建。构建过程会临时恢复图片缓存。
- 安全验证：`npm run test:access`，`python -X utf8 tests/access-build.py`。
- 本站无法撤回用户已下载的文件，也无法控制原始公开图库。受限深度图片在本站鉴权后转发；原站的公开性不受本站权限影响。此版的年龄确认是用户自我声明。

界面约定见 `DESIGN.md` / `UX-CONTRACT.md`，权限边界见 `ACCESS-POLICY.md`。现有静态审计器仅识别内联 onclick，会把此项目 CSP 下的外部 JS 绑定误报为无动作按钮；应保留原始审计结果，并结合实际绑定和浏览器操作核实，不能用添加内联脚本的方式消除误报。

### 公众号引流与自动发码（access-v2）

公开领取页位于 `/invite/`，使用提供的「404星球的猫」二维码，默认回复关键词「邀请码」。后台入口：更多 → 账号管理 → 公众号自动发码设置。

1. 填写公众号 AppID、服务器 Token（16–32 位字母数字）和 EncodingAESKey（43 位）；原始 ID 可选。无需 AppSecret。密钥留空表示保留现有值，读取配置不会返回密钥。
2. 选择是否开启自动发放、领取人数上限（0 不限），以及新邀请码是否授予 18+ 查看权限。默认不自动授予查看权限，永不自动授予管理权限。
3. 在微信公众平台服务器配置中填入 `https://posewear.xiaogao.xyz/api/wechat/callback` 和相同 Token/AESKey，消息加解密选择「安全模式」，由公众号所有者完成验证和启用。未通过验证前，引流页显示领取尚未开放。
4. 用户回复关键词后，服务器被动回复邀请码和带自动填码的注册链接。每个微信只保留一个当前有效码；重复消息不会多发码，已注册后不再发新码，未使用的过期码可重新领取。

仅保存微信标识的哈希以防重复领取，不保存 OpenID 明文或聊天正文。注册链接使用 fragment 并由页面立即移除；邀请码不进入请求查询参数、本机存储或访问日志。暂停发放不撤销已发有效码。接入说明与参数以公众号后台和 [微信接入文档](https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/Access_Overview.html) 为准；消息加解密使用 [wechat-crypto](https://github.com/node-webot/wechat-crypto)。

- [ ] 更多服务商与模型预设
- [ ] 生成记录导出
- [ ] 增量更新素材（只下载新增内容）
- [ ] 更完整的英文界面文案

欢迎在 [Issues](https://github.com/atuizz/posewear/issues) 里提建议。

## 参与贡献

欢迎提 Issue 和 PR：

1. Fork 后新建分支；
2. 改动前端后运行 `python3 build.py` 和 `node tests/v12.js && node tests/v13.js`；
3. PR 里说明改了什么，界面改动附截图。

文案请保持口语、简洁；不提交任何素材图片或密钥。

## 致谢

- [AI Pose Gallery](https://ai-pose-gallery.pages.dev/)：姿势线稿
- [AI Pose Depth Gallery](https://ai-pose-depth-gallery.pages.dev/)：深度姿势，作者 [ギア / @giaaibusi](https://x.com/giaaibusi)。页面热链原图，非官方汉化；图片不进本仓库
- [AI Costume Gallery](https://ai-costume-gallery.pages.dev/)：服装图，作者 [@giaaibusi](https://x.com/giaaibusi)
- [AI Portrait Gallery](https://ai-portrait-gallery.pages.dev/)：人像，作者 [@agi_aibusi](https://x.com/agi_aibusi)，CC0
- [wzc520pyfm/gen-ai-pose-image](https://github.com/wzc520pyfm/gen-ai-pose-image)、[paipiange/nvzhuang](https://github.com/paipiange/nvzhuang)：给了很多思路的同类项目

## 许可与素材边界

| 内容 | 是否在本仓库 | 许可 |
|---|---|---|
| 代码、页面文案、构建脚本 | 是 | [MIT](LICENSE) |
| 姿势、服装图片和原始数据 | 否，由 `fetch-assets.py` 从原站下载 | 归原作者 [@giaaibusi](https://x.com/giaaibusi) 所有（[AI Pose Gallery](https://ai-pose-gallery.pages.dev/) / [AI Costume Gallery](https://ai-costume-gallery.pages.dev/)），原站未标明开放许可 |
| 人像图片 | 否，同上 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.zh-hans)，作者 [@agi_aibusi](https://x.com/agi_aibusi)（[AI Portrait Gallery](https://ai-portrait-gallery.pages.dev/)） |
| 深度姿势图片 | 否，页面 `<img>` 热链 [AI Pose Depth Gallery](https://ai-pose-depth-gallery.pages.dev/) | 归作者 [ギア / @giaaibusi](https://x.com/giaaibusi)。本仓库只有文本元数据和译名 |
| 深度姿势文本元数据 | 是，`depth/packs/` | 日文原文归原作者，中文译名为本站 |
| README 截图 | 是 | 截图里的图片素材同上，归各自作者 |

- MIT 只覆盖代码，不覆盖任何图片和数据。
- 想转载、商用或二次分发姿势、服装图片，请先联系原作者 @giaaibusi，以原站说明为准。
- 人像为 CC0，可商用、可修改、无需署名；均为 AI 生成的虚构人物，不要用来冒充真人。原作者希望不要原样批量转载。
- 自己部署时，请保留页面里的来源与作者说明。
