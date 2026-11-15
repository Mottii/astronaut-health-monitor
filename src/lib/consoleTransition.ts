/** Animation completion and the timeout share a single, cancellable navigation. */
export function startConsoleTransition(onComplete: () => void, playSound: () => void, delay: number) {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    onComplete();
  };
  // Schedule navigation before audio: a blocked AudioContext must never strand the page.
  const timer = setTimeout(finish, delay);
  try { playSound(); } catch { /* Navigation remains available without audio. */ }
  return {
    finish,
    cancel() { finished = true; clearTimeout(timer); },
  };
}
