import { describe, expect, it, vi } from "vitest";
import { WebAudioEngine } from "./webAudioEngine";

/** Minimal AudioContext stub for Node (no real speakers). */
function mockContext() {
  const now = { t: 0 };
  const param = () => {
    const p = {
      value: 1,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn((v: number) => {
        p.value = v;
      }),
      linearRampToValueAtTime: vi.fn(),
    };
    return p;
  };
  const nodes: { disconnect: ReturnType<typeof vi.fn> }[] = [];
  const makeNode = () => {
    const n = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: param(),
      pan: param(),
      start: vi.fn(),
      stop: vi.fn(),
      buffer: null as AudioBuffer | null,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      playbackRate: { value: 1 },
      onended: null as (() => void) | null,
    };
    nodes.push(n);
    return n;
  };
  const ctx = {
    currentTime: 0,
    state: "running" as AudioContextState,
    destination: {},
    createGain: () => makeNode(),
    createStereoPanner: () => makeNode(),
    createBufferSource: () => makeNode(),
    createBuffer: (channels: number, length: number, sampleRate: number) => {
      const chans = Array.from({ length: channels }, () => new Float32Array(length));
      return {
        duration: length / sampleRate,
        sampleRate,
        numberOfChannels: channels,
        length,
        getChannelData: (i: number) => chans[i]!,
      } as AudioBuffer;
    },
    decodeAudioData: async (bytes: ArrayBuffer) => {
      void bytes;
      return ctx.createBuffer(2, 4800, 48000);
    },
    resume: async () => {
      ctx.state = "running";
    },
    close: async () => {
      ctx.state = "closed";
    },
    get _nodes() {
      return nodes;
    },
    get _now() {
      return now;
    },
  };
  Object.defineProperty(ctx, "currentTime", {
    get: () => now.t,
  });
  return ctx as unknown as AudioContext & { _nodes: typeof nodes; _now: typeof now };
}

describe("WebAudioEngine", () => {
  it("creates moment bus and schedules oneshots on the audio clock", async () => {
    const ctx = mockContext();
    const engine = new WebAudioEngine({ createContext: () => ctx });
    await engine.init({ mixWithOthers: false });

    const buf = ctx.createBuffer(1, 4800, 48000);
    const handle = engine.loadDecoded("sha-test", buf);
    const when = 1.5;
    (ctx as unknown as { _now: { t: number } })._now.t = 1;
    engine.playOneShot(handle, {
      bus: "moment",
      gainDb: -8,
      pan: 0,
      rate: 1,
      whenSec: when,
    });
    const sources = (ctx as unknown as { _nodes: { start: ReturnType<typeof vi.fn> }[] })
      ._nodes;
    const started = sources.filter((n) => n.start?.mock?.calls?.length);
    expect(started.length).toBeGreaterThan(0);
    const lastStart = started.at(-1)!.start.mock.calls[0]![0];
    expect(lastStart).toBe(when);

    const diag = engine.getDiagnostics();
    expect(diag.route).toBe("headphones");
    expect(diag.decodedBytes).toBeGreaterThan(0);

    await engine.dispose();
  });

  it("fades before stop and disconnects", async () => {
    const ctx = mockContext();
    const engine = new WebAudioEngine({ createContext: () => ctx });
    await engine.init({ mixWithOthers: false });
    const buf = ctx.createBuffer(1, 4800, 48000);
    const handle = engine.loadDecoded("sha-stop", buf);
    const voice = engine.playOneShot(handle, {
      bus: "ui",
      gainDb: 0,
      pan: 0,
      rate: 1,
    });
    engine.stop(voice, 100);
    const stops = (ctx as unknown as { _nodes: { stop: ReturnType<typeof vi.fn> }[] })
      ._nodes.filter((n) => n.stop?.mock?.calls?.length);
    expect(stops.length).toBeGreaterThan(0);
    await engine.dispose();
  });
});
