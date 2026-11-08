export type HostPlatform = "desktop" | "android" | "ios";

/**
 * WebView host detection at the composition boundary. Android/iOS are
 * mobile products even when a tablet viewport is wider than the desktop
 * breakpoint; width only chooses the mobile layout, not the runtime family.
 */
export function resolveHostPlatform(): HostPlatform {
  const userAgent = navigator.userAgent;
  if (/android/i.test(userAgent)) {
    return "android";
  }
  if (/iphone|ipad|ipod/i.test(userAgent)) {
    return "ios";
  }
  return "desktop";
}