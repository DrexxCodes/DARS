import type { DeviceSignals } from "@/types/device";

const DEVICE_ID_KEY = "dars:did";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Array.from({ length: 4 }, () => Math.random().toString(16).slice(2, 10)).join("");
}

/** Stable per-browser-profile ID. A fresh one is created in incognito or after site data is cleared. */
function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return randomId(); // storage blocked: server falls back to the fingerprint + IP rule
  }
}

async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Non-secure context fallback (plain http on a LAN IP): FNV-1a repeated to fill 64 hex chars
  let out = "";
  for (let round = 0; out.length < 64; round++) {
    let h = 2166136261 ^ round;
    for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619);
    out += (h >>> 0).toString(16).padStart(8, "0");
  }
  return out.slice(0, 64);
}

function gpuInfo(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    if (!gl || !ext) return "";
    return `${gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)}|${gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)}`;
  } catch {
    return "";
  }
}

/**
 * Only traits that stay the same between a normal tab, a private tab and the installed app.
 * Canvas/audio hashes and window size are left out on purpose: Safari adds noise to canvas in private mode and
 * the window size changes between standalone and browser, either of which would let incognito slip through.
 */
async function computeFingerprint(): Promise<string> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const traits = [
    nav.platform,
    nav.languages?.[0] ?? nav.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    Math.max(screen.width, screen.height),
    Math.min(screen.width, screen.height),
    screen.colorDepth,
    window.devicePixelRatio,
    nav.hardwareConcurrency,
    nav.maxTouchPoints,
    nav.deviceMemory ?? "",
    gpuInfo(),
  ];
  return sha256Hex(traits.join("||"));
}

let cached: Promise<DeviceSignals> | null = null;

/** Memoised. Call it early (e.g. on mount) so tapping "Mark" never waits on it. */
export function getDeviceSignals(): Promise<DeviceSignals> {
  if (!cached) {
    cached = computeFingerprint()
      .then((fingerprint) => ({ fingerprint, deviceId: getDeviceId() }))
      .catch((e) => {
        cached = null;
        throw e;
      });
  }
  return cached;
}
