/** Paints the iOS standalone status-bar area (black-translucent mode) brand green. */
export default function StatusBarFill() {
  return (
    <div
      aria-hidden
      className="fixed top-0 inset-x-0 z-[60] bg-brand-600 pointer-events-none"
      style={{ height: "env(safe-area-inset-top)" }}
    />
  );
}
