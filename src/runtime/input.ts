export interface Controls {
  go(i: number): void;
  step(delta: number): void;
  first(): void;
  last(): void;
  lens(index: number): void;
  exit(): void;
  activate(el: Element): void;
}

export function bindInput(c: Controls, swipeMin: number) {
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    const focused = document.activeElement;
    if ((k === 'Enter' || k === ' ') && focused?.classList.contains('zoomable')) {
      e.preventDefault();
      c.activate(focused);
    } else if (k === 'Escape') c.exit();
    else if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || (k === 'Enter' && document.activeElement === document.body)) {
      e.preventDefault();
      c.step(1);
    } else if (k === 'ArrowLeft' || k === 'PageUp') {
      e.preventDefault();
      c.step(-1);
    } else if (k === 'Home') c.first();
    else if (k === 'End') c.last();
    else if (/^[1-9]$/.test(k)) c.lens(Number(k) - 1);
    else if (k === 'f' || k === 'F') toggleFullscreen();
  });

  const main = document.querySelector('main')!;
  let tx: number | null = null;
  main.addEventListener('touchstart', (e) => (tx = e.touches[0]!.clientX), { passive: true });
  main.addEventListener('touchend', (e) => {
    if (tx === null) return;
    const dx = e.changedTouches[0]!.clientX - tx;
    tx = null;
    if (Math.abs(dx) > swipeMin) c.step(dx < 0 ? 1 : -1);
  }, { passive: true });

  const fs = document.getElementById('fs') as HTMLButtonElement;
  if (!document.fullscreenEnabled) fs.hidden = true;
  else fs.addEventListener('click', toggleFullscreen);
}

function toggleFullscreen() {
  try {
    if (document.fullscreenElement) void document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  } catch {
    // Fullscreen can throw in sandboxed frames; the button simply does nothing there.
  }
}
