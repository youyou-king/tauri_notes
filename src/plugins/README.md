# Feature plugins

Each feature plugin lives in its own directory:

```text
src/plugins/<id>/
├─ feature.json
├─ manifest.ts
├─ index.ts
├─ ui/
└─ *.test.ts
```

Rules:

- a plugin imports kernel contracts from `src/kernel/sdk` only;
- a plugin may import domain and infrastructure ports;
- a plugin must not import another plugin's implementation;
- a plugin must not import `src/app/**` or `src/components/**`;
- shell UI is available through `src/ui/sdk`;
- cross-plugin communication goes through commands, events, or ports;
- every contribution must be declared in `feature.json`;
- `feature.json` must declare the current `sdkVersion`;
- architecture tests in `src/architecture.test.ts` enforce these rules.

Current plugins:

```text
theme
board
reference
search
help
import
viewport
manager
```

`src/kernel/sdk` is the stable plugin API facade. Kernel internals may change;
the facade and `PLUGIN_SDK_VERSION` define compatibility.
