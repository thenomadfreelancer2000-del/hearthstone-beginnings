export function RotateDevicePrompt() {
  return (
    <div className="rotate-prompt fixed inset-0 z-[9999] bg-coal text-parchment flex-col items-center justify-center text-center px-6 gap-4 hidden">
      <div className="text-5xl animate-pulse">📱↻</div>
      <h2 className="ranch-display text-xl text-amber">Please Rotate Your Device</h2>
      <p className="ranch-body text-sm text-dust max-w-xs">
        The Ranch is best played in landscape. Turn your phone sideways to continue.
      </p>
    </div>
  );
}
