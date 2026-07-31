"use client";
/* eslint-disable @next/next/no-img-element, react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from "react";

type Theme = "dialup" | "vhs" | "arcade";
type Wallet = { tokens: number; globalPets: number; globalTreats: number };

const themes: Array<{ id: Theme; label: string; short: string }> = [
  { id: "dialup", label: "Dial-Up Dogstar", short: "DIAL-UP" },
  { id: "vhs", label: "Pet-O-Thon After Dark", short: "PET-O-THON" },
  { id: "arcade", label: "Nia Pocket Arcade", short: "ARCADE" },
];

const packs = [
  { id: "snack-pack", tokens: 10, price: "$2.99", note: "A respectable number of boops" },
  { id: "good-girl-pack", tokens: 25, price: "$4.99", note: "Most popular", featured: true },
  { id: "nia-whale", tokens: 50, price: "$7.99", note: "Unreasonable generosity" },
];

const arcadeBeat = 0.22;
const arcadeMelody = [
  523.25, 659.25, 783.99, 1046.5, 783.99, 659.25, 587.33, 659.25,
  698.46, 880, 1046.5, 1174.66, 1046.5, 880, 783.99, 698.46,
  659.25, 783.99, 987.77, 1318.51, 1174.66, 987.77, 880, 783.99,
  698.46, 783.99, 880, 1046.5, 880, 783.99, 698.46, 587.33,
  523.25, 659.25, 783.99, 880, 987.77, 880, 783.99, 659.25,
  587.33, 698.46, 783.99, 1046.5, 880, 783.99, 659.25, 523.25,
];
const arcadeBass = [130.81, 174.61, 146.83, 196, 164.81, 220, 146.83, 196, 130.81, 174.61, 146.83, 130.81];
const arcadePhraseMilliseconds = arcadeMelody.length * arcadeBeat * 1000;

function scheduleNote(context: AudioContext, destination: AudioNode, frequency: number, start: number, duration: number, volume: number, type: OscillatorType) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.01);
}

function playArcadePhrase(context: AudioContext, destination: AudioNode) {
  const start = context.currentTime + 0.04;
  arcadeMelody.forEach((frequency, index) => {
    scheduleNote(context, destination, frequency, start + index * arcadeBeat, arcadeBeat * 0.82, 0.042, index % 4 === 3 ? "square" : "triangle");
    if (index % 8 === 4) scheduleNote(context, destination, frequency / 2, start + index * arcadeBeat, arcadeBeat * 1.7, 0.018, "sine");
  });
  arcadeBass.forEach((frequency, index) => {
    scheduleNote(context, destination, frequency, start + index * arcadeBeat * 4, arcadeBeat * 2.8, 0.025, "square");
  });
}

function playUnlockPulse(context: AudioContext) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  gain.gain.value = 0.0001;
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.01);
}

function createAudioContext() {
  const SafariAudioContext = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!SafariAudioContext) throw new Error("Audio is not supported in this browser");
  return new SafariAudioContext();
}

function scheduleArcadeLoop(context: AudioContext, destination: AudioNode, timerRef: { current: number | null }) {
  playArcadePhrase(context, destination);
  timerRef.current = window.setTimeout(() => scheduleArcadeLoop(context, destination, timerRef), arcadePhraseMilliseconds);
}

function stopArcadeLoop(timerRef: { current: number | null }) {
  if (timerRef.current) window.clearTimeout(timerRef.current);
  timerRef.current = null;
}

function playBark(context: AudioContext, delay = 0, pitch = 150) {
  const start = context.currentTime + delay;
  const duration = 0.18;
  const oscillator = context.createOscillator();
  const oscillatorGain = context.createGain();
  const noise = context.createBufferSource();
  const noiseFilter = context.createBiquadFilter();
  const noiseGain = context.createGain();
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1;

  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(pitch * 1.65, start);
  oscillator.frequency.exponentialRampToValueAtTime(pitch, start + duration);
  oscillatorGain.gain.setValueAtTime(0.0001, start);
  oscillatorGain.gain.exponentialRampToValueAtTime(0.16, start + 0.012);
  oscillatorGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  noise.buffer = buffer;
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 620;
  noiseFilter.Q.value = 0.8;
  noiseGain.gain.setValueAtTime(0.0001, start);
  noiseGain.gain.exponentialRampToValueAtTime(0.28, start + 0.008);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(oscillatorGain).connect(context.destination);
  noise.connect(noiseFilter).connect(noiseGain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
  noise.start(start);
  noise.stop(start + duration);
}

export default function Home() {
  const [theme, setTheme] = useState<Theme>("arcade");
  const [wallet, setWallet] = useState<Wallet>({ tokens: 0, globalPets: 0, globalTreats: 0 });
  const [reaction, setReaction] = useState<"idle" | "pet" | "treat" | "rest">("idle");
  const [shopOpen, setShopOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("NIA IS ONLINE");
  const [musicOn, setMusicOn] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const musicTimerRef = useRef<number | null>(null);

  const unlockAudio = useCallback(async () => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") audioContextRef.current = createAudioContext();
    const context = audioContextRef.current;
    playUnlockPulse(context);
    if (context.state !== "running") await context.resume();
    return context;
  }, []);

  const loadWallet = useCallback(async () => {
    try {
      const response = await fetch("/api/wallet", { cache: "no-store" });
      if (response.ok) setWallet(await response.json());
    } catch {
      setToast("THE INTERNET ATE THE WALLET");
    }
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("nia-theme") as Theme | null;
    if (saved && themes.some((item) => item.id === saved)) queueMicrotask(() => setTheme(saved));
    queueMicrotask(() => void loadWallet());

    const sessionId = new URLSearchParams(window.location.search).get("checkout_session_id");
    if (sessionId) {
      setBusy(true);
      fetch("/api/checkout/credit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Could not credit tokens");
          setWallet(result.wallet);
          setToast(`CHA-CHING! +${result.added} NIA TOKENS`);
          window.history.replaceState({}, "", window.location.pathname);
        })
        .catch((error) => setToast(error.message.toUpperCase()))
        .finally(() => setBusy(false));
    }
  }, [loadWallet]);

  useEffect(() => () => {
    stopArcadeLoop(musicTimerRef);
    musicGainRef.current?.disconnect();
    void audioContextRef.current?.close();
  }, []);

  async function toggleMusic() {
    if (musicOn) {
      stopArcadeLoop(musicTimerRef);
      musicGainRef.current?.disconnect();
      musicGainRef.current = null;
      setMusicOn(false);
      setToast("ARCADE RADIO MUTED");
      return;
    }

    setToast("TUNING BARKWAVE FM...");
    try {
      const context = await unlockAudio();
      const musicGain = context.createGain();
      musicGain.gain.value = 0.8;
      musicGain.connect(context.destination);
      musicGainRef.current = musicGain;
      scheduleArcadeLoop(context, musicGain, musicTimerRef);
      setMusicOn(true);
      setToast("ARCADE RADIO: BARKWAVE FM");
    } catch {
      setToast("TAP AGAIN TO UNLOCK THE ARCADE RADIO");
    }
  }

  function playNiaReaction(kind: "pet" | "treat", context: AudioContext) {
    if (kind === "pet") {
      playBark(context, 0, 155);
      playBark(context, 0.25, 175);
      playBark(context, 0.48, 165);
    } else {
      playBark(context, 0, 185);
      playBark(context, 0.22, 145);
    }
  }

  function changeTheme(next: Theme) {
    setTheme(next);
    window.localStorage.setItem("nia-theme", next);
    const label = themes.find((item) => item.id === next)?.label;
    setToast(`NOW TUNED TO ${label?.toUpperCase()}`);
  }

  async function spend(kind: "pet" | "treat") {
    const cost = kind === "pet" ? 1 : 3;
    if (wallet.tokens < cost) {
      setToast("OUT OF TOKENS! NIA REMAINS HOPEFUL.");
      setShopOpen(true);
      return;
    }

    const audioContextPromise = unlockAudio();
    setBusy(true);
    setReaction(kind);
    try {
      const response = await fetch("/api/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Nia action failed");
      setWallet(result.wallet);
      setToast(kind === "pet" ? "YOU PET NIA!!! EXCELLENT FORM." : "CRONCH ACHIEVED. GOOD HUMAN.");
      playNiaReaction(kind, await audioContextPromise);
    } catch (error) {
      setToast(error instanceof Error ? error.message.toUpperCase() : "PLEASE TRY AGAIN");
    } finally {
      window.setTimeout(() => setReaction("idle"), 1300);
      setBusy(false);
    }
  }

  async function buyPack(packId: string) {
    setBusy(true);
    setToast("CONNECTING TO THE TOKEN MOTHERSHIP...");
    try {
      const response = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Checkout unavailable");
      window.location.assign(result.url);
    } catch (error) {
      setToast(error instanceof Error ? error.message.toUpperCase() : "CHECKOUT UNAVAILABLE");
      setBusy(false);
    }
  }

  return (
    <main className={`nia-site theme-${theme}`}>
      <div className="scanlines" aria-hidden="true" />
      <header className="topbar">
        <a className="logo" href="#top" aria-label="Pet Nia home">NIA<span>.NET</span></a>
        <div className="live-pill"><i /> LIVE NOW: THE INTERNET&apos;S VERY GOOD GIRL</div>
        <button className="wallet" onClick={() => setShopOpen(true)} aria-label={`${wallet.tokens} tokens. Buy more tokens.`}>
          <span className="coin">N</span> {wallet.tokens} TOKENS
        </button>
        <button className="sound-toggle" onClick={toggleMusic} aria-pressed={musicOn} aria-label={`${musicOn ? "Mute" : "Play"} arcade music`}>
          {musicOn ? "♫ MUSIC ON" : "♪ PLAY MUSIC"}
        </button>
        <button className="buy-top" onClick={() => setShopOpen(true)}>BUY TOKENS</button>
      </header>

      <nav className="channel-switcher" aria-label="Choose a Nia channel">
        <span>CHANGE CHANNEL:</span>
        {themes.map((item, index) => (
          <button
            key={item.id}
            className={theme === item.id ? "active" : ""}
            onClick={() => changeTheme(item.id)}
            aria-pressed={theme === item.id}
          >
            <b>CH {index + 1}</b> {item.short}
          </button>
        ))}
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="new-burst">NEW!</span>
          <p className="eyebrow">LIVE FROM SAN FRANCISCO</p>
          <h1><span>PET</span> NIA!!!</h1>
          <p className="tagline">the internet&apos;s <em>very good girl</em></p>

          <div className="counter-card">
            <span>GLOBAL PET-O-METER</span>
            <strong>{wallet.globalPets.toLocaleString("en-US").padStart(7, "0")}</strong>
            <small>PETS &amp; COUNTING...</small>
          </div>
        </div>

        <div className={`nia-stage reaction-${reaction}`}>
          <div className="toy-shell" aria-hidden="true" />
          <div className="spark spark-one">✦</div>
          <div className="spark spark-two">✧</div>
          <div className="spark spark-three">★</div>
          <div className="reaction-word" aria-live="polite">
            {reaction === "pet" ? "GOOD GIRL!" : reaction === "treat" ? "CRONCH!" : ""}
          </div>
          <img
            className="nia-photo"
            src={reaction === "rest" ? "/nia-rest-full.png" : "/nia-sit-full.png"}
            alt="Nia, a very good German shepherd"
          />
          <div className="heart-pop" aria-hidden="true">♥ ♥ ♥</div>
          <div className="bone-pop" aria-hidden="true">🦴</div>
        </div>

        <aside className="status-panel">
          <div className="meter happy">
            <span>HAPPY</span><b>♥ ♥ ♥ ♥ ♥</b><i><u /></i>
          </div>
          <div className="meter snacky">
            <span>SNACKY</span><b>🦴 🦴 🦴</b><i><u /></i>
          </div>
          <button className="rest-button" onClick={() => setReaction(reaction === "rest" ? "idle" : "rest")}>SECRET NAP CAM</button>
        </aside>
      </section>

      <section className="action-dock" aria-label="Interact with Nia">
        <button className="action pet-action" disabled={busy} onClick={() => spend("pet")}>
          <span>♥</span><b>PET NIA</b><small>1 TOKEN</small>
        </button>
        <div className="now-playing" role="status"><i /> {toast}</div>
        <button className="action treat-action" disabled={busy} onClick={() => spend("treat")}>
          <span>🦴</span><b>GIVE TREAT</b><small>3 TOKENS</small>
        </button>
      </section>

      <section className="marquee" aria-label="Nia facts">
        <div>★ 100% REAL NIA ★ NO AI DOGS ★ ONE VERY GOOD GIRL ★ {wallet.globalTreats.toLocaleString()} TREATS DISPENSED ★ BOOPS AVAILABLE 24/7 ★</div>
      </section>

      <section className="how-it-works">
        <p className="section-kicker">WELCOME TO THE WORLD WIDE WOOF</p>
        <h2>Insert coin. Make Nia happy.</h2>
        <p className="real-world-good">Every token purchase helps turn internet clicks into <strong>real-life pets and real treats for Nia.</strong></p>
        <div className="steps">
          <article><span>01</span><h3>GET TOKENS</h3><p>Choose a token pack using secure checkout.</p></article>
          <article><span>02</span><h3>PET OR TREAT</h3><p>Spend tokens to trigger a certified Nia reaction.</p></article>
          <article><span>03</span><h3>INTERNET HISTORY</h3><p>Your act of goodness joins the global counter forever.</p></article>
        </div>
      </section>

      <footer>© 1999–FOREVER <a href="https://hizach.com">HIZACH.COM</a> · BEST VIEWED WITH LOVE · <button onClick={() => setShopOpen(true)}>TOKEN SHOP</button></footer>

      {shopOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShopOpen(false)}>
          <section className="shop-modal" role="dialog" aria-modal="true" aria-labelledby="shop-title">
            <button className="modal-close" onClick={() => setShopOpen(false)} aria-label="Close token shop">×</button>
            <p className="section-kicker">NIA TOKEN MOTHERSHIP</p>
            <h2 id="shop-title">Choose your boop budget</h2>
            <p>Tokens live on this device. Each pet costs 1; each treat costs 3.</p>
            <p className="token-good-note">♥ Your purchase helps fund actual pets and actual treats for the very real Nia.</p>
            <div className="packs">
              {packs.map((pack) => (
                <button key={pack.id} className={pack.featured ? "featured" : ""} disabled={busy} onClick={() => buyPack(pack.id)}>
                  {pack.featured && <em>MOST POPULAR</em>}
                  <strong>{pack.tokens}<small>TOKENS</small></strong>
                  <b>{pack.price}</b>
                  <span>{pack.note}</span>
                </button>
              ))}
            </div>
            <small className="fine-print">Secure one-time payment. Tokens are digital entertainment credits and have no cash value.</small>
          </section>
        </div>
      )}
    </main>
  );
}
