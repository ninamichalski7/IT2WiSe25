// JavaScript Document

let peer = null;
let call = null;

let audioCtx = null;
let analyser = null;
let dataArray = null;
let sourceNode = null;
let rafId = null;

const BAR_COUNT = 24;
let bars = [];

function $(id) { return document.getElementById(id); }

function setStatus(txt) {
  const el = $("viewerStatus");
  if (el) el.textContent = "Status: " + txt;
}

function initBars() {
  const barsContainer = $("barsContainer");
  if (!barsContainer) return;

  barsContainer.innerHTML = "";
  bars = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const b = document.createElement("div");
    b.className = "bar";
    barsContainer.appendChild(b);
    bars.push(b);
  }
}

function initAudioGraphFromStream(mediaStream) {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    // muss durch User-Geste "resumed" werden → Connect-Button ist die Geste
    audioCtx.resume();
  }

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  dataArray = new Uint8Array(analyser.frequencyBinCount);

  if (sourceNode) {
    try { sourceNode.disconnect(); } catch (e) {}
  }
  sourceNode = audioCtx.createMediaStreamSource(mediaStream);
  sourceNode.connect(analyser);

  initBars();
  startAnimation();
}

function startAnimation() {
  if (rafId) cancelAnimationFrame(rafId);

  const leafGroup = $("leafGroup");

  function animate() {
    rafId = requestAnimationFrame(animate);
    if (!analyser || !dataArray) return;

    analyser.getByteFrequencyData(dataArray);

    // Bass-Energie (0..1)
    const bassLen = Math.min(32, dataArray.length);
    let bass = 0;
    for (let i = 0; i < bassLen; i++) bass += dataArray[i];
    bass = bass / (bassLen * 255);

    // Leaf Animation
    if (leafGroup) {
      const swayX = (bass - 0.5) * 20;
      const up = bass * 25;
      const rotate = (bass - 0.5) * 10;
      const scale = 1 + bass * 0.15;

      leafGroup.style.transform =
        `translate(${100 + swayX}px, ${10 - up}px) rotate(${rotate}deg) scale(${scale})`;

      // optional: Farbe leicht modulieren
      const col = Math.floor(120 + bass * 100);
      const leafColor = `rgb(${50}, ${col}, ${80})`;
      for (const child of leafGroup.children) child.style.fill = leafColor;
    }

    // Bars
    const step = Math.floor(dataArray.length / BAR_COUNT);
    for (let i = 0; i < bars.length; i++) {
      const v = dataArray[Math.floor(i * step)] / 255;
      bars[i].style.height = (8 + v * 120) + "px";
    }
  }

  animate();
}

function connectToHost(hostPeerId) {
  if (!hostPeerId) {
    setStatus("Bitte Peer-ID eingeben.");
    return;
  }

  if (!window.Peer) {
    setStatus("PeerJS nicht geladen.");
    return;
  }

  if (!peer) {
    peer = new Peer();
    peer.on("open", () => {
      setStatus("Viewer bereit. Verbinde…");
      startCall(hostPeerId);
    });
    peer.on("error", (err) => setStatus("Peer Fehler: " + err.type));
  } else {
    startCall(hostPeerId);
  }
}

function startCall(hostPeerId) {
  // Nur Audio-Track anfordern (bei PeerJS läuft das über stream-Call)
  setStatus("Rufe Host an…");

  call = peer.call(hostPeerId, null); // wir senden keinen eigenen Stream
  if (!call) {
    setStatus("Call konnte nicht gestartet werden.");
    return;
  }

  call.on("stream", (remoteStream) => {
    setStatus("✅ Verbunden – Stream empfangen.");

    // Audio abspielen
    const audioEl = $("remoteAudio");
    audioEl.srcObject = remoteStream;
    audioEl.play().catch(() => {
      // falls Autoplay blockiert → User muss nochmal klicken
      setStatus("Audio Autoplay blockiert – bitte einmal klicken.");
    });

    // Visualisierung lokal aus remoteStream
    initAudioGraphFromStream(remoteStream);
  });

  call.on("close", () => setStatus("Verbindung geschlossen."));
  call.on("error", () => setStatus("Call Fehler."));
}

document.addEventListener("DOMContentLoaded", () => {
  initBars();

  $("connectBtn").addEventListener("click", () => {
    const hostId = $("hostPeerId").value.trim();
    connectToHost(hostId);
  });
});
