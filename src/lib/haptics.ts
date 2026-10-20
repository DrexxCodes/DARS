// Haptic feedback helper.
//  - Android (Chrome): navigator.vibrate
//  - iPhone (iOS 17.4+): WebKit plays a light haptic tick when an <input type="checkbox" switch>
//    is toggled, so we toggle a hidden one. Older iOS: silently does nothing.
let label: HTMLLabelElement | null = null;

function ensureSwitch() {
  if (label || typeof document === "undefined") return;
  label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  Object.assign(label.style, {
    position: "fixed", left: "0", bottom: "0", width: "1px", height: "1px",
    opacity: "0", pointerEvents: "none", overflow: "hidden",
  });
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
}

/** `pattern` is ms or a vibrate pattern (Android only; iPhone gets a single tick). */
export function haptic(pattern: number | number[] = 12) {
  if (typeof navigator === "undefined") return;
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
      return;
    }
  } catch {}
  try {
    ensureSwitch();
    label?.click();
  } catch {}
}
