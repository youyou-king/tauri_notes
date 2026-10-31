# Theme feature plugin

外观、主题和 `.tnlook` 外观包插件。

## 入口

```text
index.ts               activate(context) 与贡献注册
manifest.ts            typed manifest
feature.json           manifest / contributions / sdkVersion
ThemeToolbarItem.tsx   顶部主题菜单
AppearanceHost.tsx     壁纸、遮罩和装饰宿主
```

## 状态所有权

```text
ThemeProvider
  selection / resolved / customThemes
  基础 token、data-theme、data-theme-mode

appearanceRuntime
  applied pack manifest
  dark/light variant assets
  active variant
  data-appearance-pack
  data-appearance-mode

appearanceApplier
  低层 DOM 适配器
  CSS variables / rollback / appearance:applied
```

主题模式变化时由 `ThemeToolbarItem` 监听 `resolved`，调用
`syncAppearanceMode`，不重新加载页面。

## 外观包

```text
.tnlook = ZIP
├─ appearance.json
└─ assets/
```

支持：

- schema / id / version / modes 校验；
- 资源路径与 ZIP 大小限制；
- SHA-256 完整性；
- 可选 ECDSA P-256 发布者签名；
- publisher trust-on-first-use；
- 对比度警告；
- 导入、预览、应用、回退；
- dark / light variant 运行时切换。

运行时记录保存在 IndexedDB：

```text
tauri-notes-assets / appearance / runtime:v1
```

## 命令与贡献

```text
theme.open
theme.apply
settings section
toolbar item
```

主题菜单通过共享 `ToolbarMenu` 打开，点击外部或 `Esc` 收起。

## 测试

```text
src/plugins/theme/*.test.ts
e2e/smoke.spec.ts
  - signed pack trust
  - contrast warnings
  - pack apply / reload / rollback
  - dark/light variant switching
```
