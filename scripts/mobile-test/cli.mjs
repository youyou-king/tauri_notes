#!/usr/bin/env node
/**
 * Cross-platform Android emulator helper for manual mobile checks.
 *
 * Usage:
 *   node scripts/mobile-test/cli.mjs doctor
 *   node scripts/mobile-test/cli.mjs start
 *   node scripts/mobile-test/cli.mjs up
 *   node scripts/mobile-test/cli.mjs launch
 *   node scripts/mobile-test/cli.mjs screenshot
 *
 * Only Node.js APIs are used so the same commands work on Windows, macOS and
 * Linux. The Android SDK is discovered from environment variables or common
 * installation directories.
 */
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const IS_WIN = process.platform === "win32";
const EXE = IS_WIN ? ".exe" : "";
const DEFAULT_AVD = process.env.TAURI_ANDROID_AVD ?? "tn_test";
const DEFAULT_PACKAGE =
  process.env.TAURI_ANDROID_PACKAGE ?? "com.youyou.taurinotes";
const DEFAULT_ACTIVITY = ".MainActivity";
const SCREENSHOT_DIR = join(ROOT, "test-artifacts", "mobile");

function parseArgs(argv) {
  const options = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      options._.push(arg);
      continue;
    }
    const [key, inline] = arg.slice(2).split("=", 2);
    if (inline !== undefined) {
      options[key] = inline;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = true;
    }
  }
  return options;
}

function sdkCandidates() {
  const home = homedir();
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_SDK,
    IS_WIN ? process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Android", "Sdk") : null,
    join(home, "AppData", "Local", "Android", "Sdk"),
    join(home, "Library", "Android", "sdk"),
    join(home, "Android", "Sdk"),
    "/usr/local/lib/android/sdk",
    "/opt/android-sdk",
  ];
  return [...new Set(candidates.filter(Boolean).map((item) => resolve(item)))];
}

function findSdk(override) {
  const candidates = override ? [resolve(override), ...sdkCandidates()] : sdkCandidates();
  const sdk = candidates.find((candidate) =>
    existsSync(join(candidate, "platform-tools", `adb${EXE}`)),
  );
  if (!sdk) {
    throw new Error(
      "未找到 Android SDK。请设置 ANDROID_HOME，或把 platform-tools 安装到常见目录。",
    );
  }
  return sdk;
}

function findEmulator(sdk) {
  const candidate = join(sdk, "emulator", `emulator${EXE}`);
  if (!existsSync(candidate)) {
    throw new Error(
      `未找到 emulator：${candidate}\n请先在 SDK Manager 中安装 "Android Emulator"。`,
    );
  }
  return candidate;
}

function adbPath(sdk) {
  return join(sdk, "platform-tools", `adb${EXE}`);
}

function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, {
    cwd: ROOT,
    encoding: options.binary ? null : "utf8",
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.toString().trim();
    const stdout = result.stdout?.toString().trim();
    throw new Error(
      `${binary} ${args.join(" ")} 失败（${result.status}）${
        stderr || stdout ? `\n${stderr || stdout}` : ""
      }`,
    );
  }
  return result.stdout;
}

function listDevices(sdk) {
  const output = run(adbPath(sdk), ["devices"]);
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial, state] = line.split(/\s+/);
      return { serial, state };
    });
}

function chooseDevice(sdk, options) {
  const devices = listDevices(sdk);
  if (options.device) {
    const found = devices.find((device) => device.serial === options.device);
    if (!found) {
      throw new Error(`没有找到设备 ${options.device}。\n${formatDevices(devices)}`);
    }
    return found.serial;
  }
  const ready = devices.filter((device) => device.state === "device");
  if (ready.length === 0) {
    throw new Error(
      `没有可用设备。\n${formatDevices(devices)}\n先执行：node scripts/mobile-test/cli.mjs start`,
    );
  }
  if (ready.length > 1) {
    throw new Error(
      `检测到多个设备，请用 --device 指定：\n${formatDevices(devices)}`,
    );
  }
  return ready[0].serial;
}

function formatDevices(devices) {
  return devices.length === 0
    ? "（无）"
    : devices.map((device) => `  ${device.serial}\t${device.state}`).join("\n");
}

function adb(sdk, serial, args, options = {}) {
  return run(adbPath(sdk), ["-s", serial, ...args], options);
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function waitForDevice(sdk, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const devices = listDevices(sdk);
    const ready = devices.find((device) => device.state === "device");
    if (ready) {
      return ready.serial;
    }
    await sleep(1500);
  }
  throw new Error("等待模拟器连接超时。");
}

async function waitForBoot(sdk, serial, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  while (Date.now() < deadline) {
    try {
      last = adb(sdk, serial, ["shell", "getprop", "sys.boot_completed"]).trim();
      if (last === "1") {
        return;
      }
    } catch {
      // ADB can be connected before the property service is ready.
    }
    await sleep(2000);
  }
  throw new Error(
    `等待 Android 启动超时（最后状态：${last || "unknown"}）。`,
  );
}

async function startEmulator(sdk, options) {
  const emulator = findEmulator(sdk);
  const avd = options.avd ?? DEFAULT_AVD;
  const devices = listDevices(sdk);
  if (devices.some((device) => device.state === "device") && !options.force) {
    console.log(`已有可用设备，跳过启动：\n${formatDevices(devices)}`);
    return Promise.resolve(chooseDevice(sdk, options));
  }
  if (options.force && devices.length > 0) {
    console.log("--force：关闭已有模拟器…");
    stop(sdk);
    await sleep(3000);
  }

  const args = [
    "-avd",
    avd,
    "-no-audio",
    "-no-boot-anim",
    "-gpu",
    options.gpu ?? "swiftshader_indirect",
    "-accel",
    "on",
  ];
  if (!options.snapshot) {
    args.push("-no-snapshot");
  }
  if (options.headless) {
    args.push("-no-window");
  }

  console.log(`启动 AVD ${avd}${options.headless ? "（无窗口）" : ""}…`);
  const child = spawn(emulator, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: Boolean(options.headless),
  });
  child.unref();

  return waitForDevice(sdk, Number(options.timeout ?? 180000)).then((serial) =>
    waitForBoot(sdk, serial, Number(options.timeout ?? 180000)).then(
      () => serial,
    ),
  );
}

function launch(sdk, options) {
  const serial = chooseDevice(sdk, options);
  const activity = options.activity ?? `${DEFAULT_PACKAGE}/${DEFAULT_ACTIVITY}`;
  console.log(`启动 ${activity}（${serial}）…`);
  adb(sdk, serial, ["shell", "am", "start", "-W", "-n", activity]);
  console.log("应用已启动。");
}

function stop(sdk) {
  const devices = listDevices(sdk);
  if (devices.length === 0) {
    console.log("没有运行中的模拟器。");
    return;
  }
  for (const device of devices) {
    try {
      adb(sdk, device.serial, ["emu", "kill"]);
      console.log(`已关闭 ${device.serial}。`);
    } catch {
      console.log(`关闭 ${device.serial} 失败（可能不是 emulator）。`);
    }
  }
}

function findLatestApk() {
  const base = join(ROOT, "src-tauri", "gen", "android", "app", "build", "outputs", "apk");
  if (!existsSync(base)) {
    return null;
  }
  const apks = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".apk")) {
        apks.push({ path: full, mtime: statSync(full).mtimeMs });
      }
    }
  };
  walk(base);
  apks.sort((left, right) => right.mtime - left.mtime);
  return apks[0]?.path ?? null;
}

function install(sdk, options) {
  const serial = chooseDevice(sdk, options);
  let apk = options.apk;
  if (apk && !existsSync(apk)) {
    apk = resolve(ROOT, apk);
  }
  apk ??= findLatestApk();
  if (!apk || !existsSync(apk)) {
    throw new Error(
      "未找到 APK。请用 --apk 指定路径，或先构建 Android 工程。",
    );
  }
  console.log(`安装 ${apk}（${serial}）…`);
  adb(sdk, serial, ["install", "-r", apk]);
  console.log("安装完成。");
}

function screenshot(sdk, options) {
  const serial = chooseDevice(sdk, options);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const output = resolve(
    options.out ?? join(SCREENSHOT_DIR, `mobile-${stamp}.png`),
  );
  mkdirSync(dirname(output), { recursive: true });
  const buffer = adb(sdk, serial, ["exec-out", "screencap", "-p"], {
    binary: true,
  });
  writeFileSync(output, buffer);
  console.log(output);
}

async function smoke(sdk, options) {
  const serial = chooseDevice(sdk, options);
  launch(sdk, { ...options, device: serial });
  await sleep(Number(options.wait ?? 2500));
  const output = adb(sdk, serial, ["shell", "dumpsys", "activity", "activities"]);
  const resumed = output
    .split(/\r?\n/)
    .find(
      (line) =>
        line.includes("topResumedActivity") || line.includes("mResumedActivity"),
    );
  if (!resumed?.includes(DEFAULT_PACKAGE)) {
    throw new Error(
      `应用未成为前台 Activity。\n${resumed ?? "未找到 resumed activity"}`,
    );
  }
  console.log(`前台 Activity：${resumed.trim()}`);
  screenshot(sdk, { ...options, device: serial });
}

function reset(sdk, options) {
  const serial = chooseDevice(sdk, options);
  adb(sdk, serial, ["shell", "pm", "clear", DEFAULT_PACKAGE]);
  console.log(`已清除 ${DEFAULT_PACKAGE} 的应用数据。`);
}

function doctor(options) {
  console.log(`platform: ${process.platform}`);
  try {
    const sdk = findSdk(options.sdk);
    console.log(`sdk: ${sdk}`);
    console.log(`adb: ${adbPath(sdk)}`);
    console.log(`emulator: ${findEmulator(sdk)}`);
    console.log(`devices:\n${formatDevices(listDevices(sdk))}`);
    console.log(`avds:\n${run(findEmulator(sdk), ["-list-avds"]).trim() || "（无）"}`);
    const latest = findLatestApk();
    console.log(`latest apk: ${latest ?? "（未找到，需先构建）"}`);
  } catch (error) {
    console.error(`检查失败：${error.message}`);
    process.exitCode = 1;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const command = options._[0] ?? "help";

  switch (command) {
    case "doctor":
      doctor(options);
      return;
    case "devices": {
      const sdk = findSdk(options.sdk);
      console.log(formatDevices(listDevices(sdk)));
      return;
    }
    case "start": {
      const sdk = findSdk(options.sdk);
      const serial = await startEmulator(sdk, options);
      console.log(`模拟器就绪：${serial}`);
      if (options.launch) {
        launch(sdk, { ...options, device: serial });
      }
      return;
    }
    case "up": {
      const sdk = findSdk(options.sdk);
      const serial = await startEmulator(sdk, options);
      launch(sdk, { ...options, device: serial });
      return;
    }
    case "launch":
      launch(findSdk(options.sdk), options);
      return;
    case "stop":
      stop(findSdk(options.sdk));
      return;
    case "install":
      install(findSdk(options.sdk), options);
      return;
    case "screenshot":
      screenshot(findSdk(options.sdk), options);
      return;
    case "smoke":
      await smoke(findSdk(options.sdk), options);
      return;
    case "reset":
      reset(findSdk(options.sdk), options);
      return;
    case "help":
    default:
      console.log(`Android 模拟器测试辅助

用法：
  node scripts/mobile-test/cli.mjs doctor [--sdk path]
  node scripts/mobile-test/cli.mjs start [--sdk path] [--avd tn_test] [--headless] [--launch]
  node scripts/mobile-test/cli.mjs up [--avd tn_test]
  node scripts/mobile-test/cli.mjs launch [--device emulator-5554]
  node scripts/mobile-test/cli.mjs install [--apk path/to.apk]
  node scripts/mobile-test/cli.mjs screenshot [--out path.png]
  node scripts/mobile-test/cli.mjs smoke
  node scripts/mobile-test/cli.mjs reset
  node scripts/mobile-test/cli.mjs stop
  node scripts/mobile-test/cli.mjs devices

说明：
  - 默认包名：${DEFAULT_PACKAGE}
  - 默认 AVD：${DEFAULT_AVD}
  - 截图默认写入：test-artifacts/mobile/
  - SDK 从 --sdk、ANDROID_HOME / ANDROID_SDK_ROOT 或常见安装目录发现
`);
      return;
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});