// Node's webcrypto is used only to exercise browser crypto code in tests.
// @ts-expect-error node builtin types are not part of the frontend tsconfig.
import { webcrypto } from "node:crypto";

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}
