# ADR-008：Android identifier 使用合法包名

> 状态：已接受  
> 日期：2026-11-01  
> 关联：Phase 5 Android 初始化

## 背景

桌面配置使用：

```json
"identifier": "com.youyou.tauri-notes"
```

该标识符中的 `tauri-notes` 含连字符，不能直接作为 Java/Kotlin 包名。Tauri Android 初始化会把项目生成到：

```text
com.youyou.taurinotes
```

如果 Android 运行时仍使用桌面 identifier 推导 App 私有目录，会出现包名与数据键不一致。

## 决策

新增平台配置文件：

```text
src-tauri/tauri.android.conf.json
```

```json
{
  "identifier": "com.youyou.taurinotes"
}
```

- 桌面继续使用原 identifier，避免迁移现有桌面数据；
- Android 使用合法包名；
- Android 数据目录以 `com.youyou.taurinotes` 为准；
- 不改动 `.note` 文件格式。

## 后果

- Android 包名与 Tauri identifier 一致；
- 以后若桌面迁移 identifier，需要单独的数据迁移 ADR；
- iOS identifier 仍需在 macOS 环境验证；
- 发布签名、商店包名以后以本 ADR 的 Android identifier 为准。