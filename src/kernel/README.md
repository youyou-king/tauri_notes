# Kernel boundary

This directory is the stable kernel of the application.

Allowed:

- kernel modules importing other kernel modules;
- kernel importing domain types and application ports;
- framework-agnostic utilities.

Forbidden:

- importing `src/ui/**`;
- importing `src/app/**`;
- importing `src/components/**`;
- importing `src/plugins/**`;
- importing a concrete feature service.

Kernel modules must expose contracts, not feature implementations.

Current modules:

```text
appearance/  theme + surface token mapping
command/     command definitions, execution results, events
event/       typed cross-panel event bus
input/       input intents and pointer/keyboard adapters
panel/       panel identity, metadata and board port
plugin/      plugin manifest, lifecycle, contribution points
sdk/         the only public kernel facade for plugins
ui/          UI renderer registry
```

Plugins must import kernel contracts from `kernel/sdk` only. Direct imports
from other `kernel/*` modules fail the architecture test.
