/**
 * T1c helper: local-file `<Audio loop>` routed into the mix via
 * MediaElementAudioSourceNode (FFmpeg not required for local files).
 */
import { useEffect, useRef } from "react";
import {
  Audio,
  type AudioContext,
  type AudioNode,
  type AudioTagHandle,
  type GainNode,
} from "react-native-audio-api";
import { dbToGain } from "@intell/shared";

export type StreamBedLoopEvent = {
  via: "onEnded" | "positionWrap";
  positionSec: number;
  wallClockMs: number;
  loopIndex: number;
};

type Props = {
  context: AudioContext;
  destination: AudioNode;
  /** file://… or bare path to a local AAC/M4A */
  sourceUri: string;
  gainDb?: number;
  playing: boolean;
  onLoop?: (e: StreamBedLoopEvent) => void;
  onReady?: () => void;
  onError?: (err: Error) => void;
};

export function MediaElementBed(props: Props) {
  const {
    context,
    destination,
    sourceUri,
    gainDb = -10,
    playing,
    onLoop,
    onReady,
    onError,
  } = props;

  const audioRef = useRef<AudioTagHandle | null>(null);
  const mediaRef = useRef<{ me: AudioNode; gain: GainNode } | null>(null);
  const prevPosRef = useRef(0);
  const loopIndexRef = useRef(0);
  const durationRef = useRef(0);
  const lastLoopWallRef = useRef(0);
  const onLoopRef = useRef(onLoop);

  useEffect(() => {
    onLoopRef.current = onLoop;
  }, [onLoop]);

  const emitLoop = (via: StreamBedLoopEvent["via"], positionSec: number) => {
    const now = Date.now();
    // Native loop may fire both onEnded and a position wrap — keep one.
    if (now - lastLoopWallRef.current < 500) return;
    lastLoopWallRef.current = now;
    loopIndexRef.current += 1;
    onLoopRef.current?.({
      via,
      positionSec,
      wallClockMs: now,
      loopIndex: loopIndexRef.current,
    });
  };

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      try {
        audio?.pause();
      } catch {
        // ignore
      }
      try {
        mediaRef.current?.me.disconnect();
        mediaRef.current?.gain.disconnect();
      } catch {
        // ignore
      }
      mediaRef.current = null;
    };
  }, []);

  const ensureConnected = () => {
    const handle = audioRef.current;
    if (!handle || mediaRef.current) return;
    // M6: never connect from preload/onLoad alone — only when play is requested.
    const me = context.createMediaElementSource(handle);
    const gain = context.createGain();
    gain.gain.value = dbToGain(gainDb);
    me.connect(gain);
    gain.connect(destination);
    mediaRef.current = { me, gain };
    prevPosRef.current = 0;
    loopIndexRef.current = 0;
    onReady?.();
  };

  useEffect(() => {
    const handle = audioRef.current;
    if (!handle) return;
    if (playing) {
      try {
        ensureConnected();
        handle.play();
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    } else {
      try {
        handle.pause();
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- connect once per play arm
  }, [playing, onError]);

  return (
    <Audio
      ref={audioRef}
      context={context}
      source={{ uri: sourceUri }}
      loop
      volume={dbToGain(gainDb)}
      muted={false}
      autoPlay={false}
      preload="auto"
      onLoad={() => {
        // Deliberately do not connect into the live graph here (M6).
        if (playing) {
          try {
            ensureConnected();
            audioRef.current?.play();
          } catch (err) {
            onError?.(err instanceof Error ? err : new Error(String(err)));
          }
        }
      }}
      onError={(err) => {
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }}
      onEnded={() => {
        emitLoop("onEnded", durationRef.current);
        prevPosRef.current = 0;
      }}
      onPositionChange={(sec) => {
        const prev = prevPosRef.current;
        // Wrap: was near the end, now near the start.
        if (prev > 1 && sec + 0.35 < prev && sec < 1.5) {
          if (prev > durationRef.current) durationRef.current = prev;
          emitLoop("positionWrap", sec);
        }
        if (sec > durationRef.current) durationRef.current = sec;
        prevPosRef.current = sec;
      }}
    />
  );
}
