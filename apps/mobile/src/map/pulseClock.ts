import { PULSE_FRAMES } from "./markerArt";

type Listener = () => void;

let frame = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let subscribers = 0;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

function start(): void {
  if (timer) return;
  timer = setInterval(() => {
    frame = Math.floor((Date.now() % 1000) / (1000 / PULSE_FRAMES));
    emit();
  }, 1000 / PULSE_FRAMES);
}

function stop(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

export function getPulseFrame(): number {
  return frame;
}

export function subscribePulse(listener: Listener): () => void {
  listeners.add(listener);
  subscribers += 1;
  if (subscribers === 1) start();
  return () => {
    listeners.delete(listener);
    subscribers -= 1;
    if (subscribers === 0) stop();
  };
}

