import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "ranch.ambient.enabled";

export function useAmbientToggle() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  }, [enabled]);
  return { enabled, setEnabled, toggle: () => setEnabled((v) => !v) };
}

interface Props {
  enabled: boolean;
}

/**
 * Procedural wind + low mystery drone built with Web Audio.
 * No external assets — pure synth so it can be toggled instantly.
 */
export function AmbientSound({ enabled }: Props) {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (!enabled) {
      nodesRef.current?.stop();
      nodesRef.current = null;
      return;
    }
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!AC) return;
    const ctx = ctxRef.current ?? new AC();
    ctxRef.current = ctx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    // ── Pink-ish noise buffer ────────────────────────────────
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99 * b0 + 0.0555 * white;
      b1 = 0.96 * b1 + 0.0750 * white;
      b2 = 0.85 * b2 + 0.1538 * white;
      data[i] = (b0 + b1 + b2) * 0.25;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    // Wind: band-pass filtered noise with gentle LFO sweep on cutoff & gain
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 600;
    windFilter.Q.value = 0.7;

    const windGain = ctx.createGain();
    windGain.gain.value = 0.0;

    // LFO for breathing wind
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain).connect(windGain.gain);

    const lfoFilter = ctx.createOscillator();
    lfoFilter.frequency.value = 0.05;
    const lfoFilterGain = ctx.createGain();
    lfoFilterGain.gain.value = 350;
    lfoFilter.connect(lfoFilterGain).connect(windFilter.frequency);

    // Mystery drone: two detuned low sines
    const drone1 = ctx.createOscillator();
    drone1.type = "sine";
    drone1.frequency.value = 55;
    const drone2 = ctx.createOscillator();
    drone2.type = "sine";
    drone2.frequency.value = 82.5;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.0;

    const droneLfo = ctx.createOscillator();
    droneLfo.frequency.value = 0.03;
    const droneLfoGain = ctx.createGain();
    droneLfoGain.gain.value = 0.025;
    droneLfo.connect(droneLfoGain).connect(droneGain.gain);

    // Master
    const master = ctx.createGain();
    master.gain.value = 0.0;

    noise.connect(windFilter).connect(windGain).connect(master);
    drone1.connect(droneGain);
    drone2.connect(droneGain);
    droneGain.connect(master);
    master.connect(ctx.destination);

    const now = ctx.currentTime;
    windGain.gain.setValueAtTime(0.08, now);
    droneGain.gain.setValueAtTime(0.035, now);
    master.gain.linearRampToValueAtTime(0.55, now + 1.5);

    noise.start();
    lfo.start();
    lfoFilter.start();
    drone1.start();
    drone2.start();
    droneLfo.start();

    nodesRef.current = {
      stop: () => {
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.linearRampToValueAtTime(0, t + 0.6);
        setTimeout(() => {
          try { noise.stop(); lfo.stop(); lfoFilter.stop(); drone1.stop(); drone2.stop(); droneLfo.stop(); } catch { /* noop */ }
        }, 800);
      },
    };

    return () => {
      nodesRef.current?.stop();
      nodesRef.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, []);

  return null;
}
