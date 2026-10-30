import { command } from "../infrastructure/tauri/client";
import { PLUGIN_SDK_VERSION } from "../kernel/sdk";

export function sdkMismatchMessage(remote: number): string | null {
  if (remote === PLUGIN_SDK_VERSION) {
    return null;
  }
  return `插件 SDK 版本不兼容：前端 ${PLUGIN_SDK_VERSION} / 后端 ${remote}`;
}

export async function checkPluginSdkVersion(): Promise<string | null> {
  try {
    const remote = await command<number>("plugin_sdk_version");
    return sdkMismatchMessage(remote);
  } catch (reason) {
    return `无法读取后端插件 SDK 版本：${String(reason)}`;
  }
}
