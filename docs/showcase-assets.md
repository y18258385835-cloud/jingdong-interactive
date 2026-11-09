# 官方示例：素材与创意说明

## 创意方向

作品名：潮汐之间。

用四幕讲述“让内容开始回应”：抵达、进入、编排、回应。摄影承担主视觉，短句承担叙事，点击与左右滑动承担场景推进；文字与照片按时间线先后进入。核心色为石墨黑、雾白和潮汐青。画面不把编辑器界面当成作品，也不使用图表插画来代替功能演示。

## 交互脚本

| 场景 | 用户操作 | 可见结果 |
| --- | --- | --- |
| 抵达 | 点击“向内走”或向左滑动 | 进入下一场景，摄影背景随转场切换 |
| 进入 | 点击“建筑的尺度”或“空间的节奏” | 分别跳转到对应叙事场景 |
| 编排 | 等待场景播放 | 文字与摄影图层依时间线先后出现；图像支持轻微视差 |
| 回应 | 点击“再走一遍” | 返回开场，形成可重复体验 |

## 摄影素材

当前使用的照片来自 Wikimedia Commons，并以 Vite `?inline` 嵌入项目数据，避免预览和离线导出依赖外部图床。两张照片采用 CC BY-SA 3.0，一张采用 CC BY-SA 4.0；再发布时需保留作者署名、来源链接、许可证链接，并按相同许可证分享改编内容。

| 本地文件 | 来源 | 用途 |
| --- | --- | --- |
| 本地文件 | 来源 / 作者 | 许可证与用途 |
| --- | --- | --- |
| `src/assets/showcase/soft-coral-komodo.jpg` | [Soft coral peach komodo](https://commons.wikimedia.org/wiki/File:Soft_coral_peach_komodo.jpg)，Nick Hobgood | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)，开场与收束 |
| `src/assets/showcase/reefscape.jpg` | [Moore Reef underwater ReefScape](https://commons.wikimedia.org/wiki/File:Moore_Reef_underwater_ReefScape.jpg)，Holobionics | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)，沉浸场景与编排背景 |
| `src/assets/showcase/reef-squid.jpg` | [Caribbean Reef Squid](https://commons.wikimedia.org/wiki/File:Sepioteuthis_sepioidea_(Caribbean_Reef_Squid).jpg)，Nick Hobgood；白平衡校正 Erik Bjers | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)，编排前景层 |

发布前应保留本说明与 Unsplash License 链接，以便后续维护者复核素材来源和使用条件。
