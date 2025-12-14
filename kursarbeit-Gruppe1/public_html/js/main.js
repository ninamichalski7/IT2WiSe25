// main.js
document.addEventListener('DOMContentLoaded', () => {
  // === KONFIGURATION DER GENRE-SONGS ===
  const GENRE_SONGS = {
    classic: 'musik/classic.mp3',
    jazz: 'musik/jazz.mp3',
    rock: 'musik/rock.mp3',
    techno: 'musik/techno.mp3',
    hiphop: 'musik/hiphop.mp3'
  };

  // === VISUELLE PARAMETER FÜR DIE GENRES ===
  const GENRE = {
    classic: { growth: 0.4, wobble: 0.2, colorA: "#98edc1", colorB: "#52b5e6" },
    jazz: { growth: 0.6, wobble: 0.5, colorA: "#e6c200", colorB: "#6a0dad" },
    rock: { growth: 1.2, wobble: 1.4, colorA: "#28ff00", colorB: "#005eff" },
    techno: { growth: 0.9, wobble: 1.8, colorA: "#ff00ff", colorB: "#00ffff" },
    hiphop: { growth: 1.0, wobble: 1.2, colorA: "#ff8800", colorB: "#ff0044" }
  };

  // === Floating Particles ===
  const particlesContainer = document.getElementById('particles');
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.top = Math.random() * 100 + '%';
    p.style.animationDelay = Math.random() * 6 + 's';
    p.style.animationDuration = (4 + Math.random() * 4) + 's';
    particlesContainer.appendChild(p);
  }

  // === Elemente aus dem DOM ===
  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('stopBtn');
  const resetBtn = document.getElementById('resetBtn');
  const fileInput = document.getElementById('fileInput');
  const sensitivity = document.getElementById('sensitivity');
  const sensVal = document.getElementById('sensVal');
  const fileRadio = document.getElementById('fileRadio');
  const genreSelect = document.getElementById('genreSelect');
  const leafGroup = document.getElementById('leafGroup');
  const barsContainer = document.getElementById('bars');
  const volume = document.getElementById('volume');
  const volVal = document.getElementById('volVal');
  const currentTimeSpan = document.getElementById('currentTime');
  const durationTimeSpan = document.getElementById('durationTime');
  const progressBar = document.getElementById('progressBar');
  const startBroadcastBtn = document.getElementById('startBroadcastBtn'); // Neuer Button

  // === Globale Variablen ===
  let isSeeking = false;
  let audioCtx, analyser, dataArray, sourceNode, audioElem, rafId, stream, gainNode;
  let currentGenre = "classic";
  const BAR_COUNT = 24;

  // Bars erstellen
  for (let i = 0; i < BAR_COUNT; i++) {
    const b = document.createElement('div');
    b.className = 'bar';
    barsContainer.appendChild(b);
  }
  const bars = Array.from(document.querySelectorAll('.bar'));

  // === Hilfsfunktionen ===
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  }

  function initAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      gainNode = audioCtx.createGain();
      gainNode.gain.value = volume.value;
    }
  }

  function stopAll() {
    if (rafId) cancelAnimationFrame(rafId);
    if (audioElem) {
      audioElem.pause();
      audioElem.src = '';
      audioElem = null;
    }
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    leafGroup.style.transform = 'translate(100px,110px) rotate(0) scale(1)';
    bars.forEach(b => b.style.height = '8px');
    currentTimeSpan.textContent = '0:00';
    durationTimeSpan.textContent = '0:00';
    progressBar.value = 0;
    progressBar.max = 100;
    document.getElementById("genreDetected").textContent = "–";
    currentGenre = 'classic';
    applyGenreColors(currentGenre);
  }

  function setupAudio(url, isFile = false) {
    stopAll();
    initAudioContext();
    audioElem = new Audio();
    audioElem.loop = true;
    audioElem.src = isFile ? URL.createObjectURL(url) : url;

    audioElem.onloadedmetadata = () => {
      durationTimeSpan.textContent = formatTime(audioElem.duration);
      progressBar.max = audioElem.duration;
      audioElem.play().catch(e => console.error("Play error:", e));
    };

    audioElem.onended = () => stopAll();

    sourceNode = audioCtx.createMediaElementSource(audioElem);
    sourceNode.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    animate();
  }

  // === Genre-Funktionen ===
  function applyGenreColors(genre) {
    const gElement = document.querySelector('#g1');
    if (!gElement) return;
    const params = GENRE[genre] || GENRE.classic;
    gElement.children[0].setAttribute("stop-color", params.colorA);
    gElement.children[1].setAttribute("stop-color", params.colorB);
  }

  genreSelect.onchange = (e) => {
    fileRadio.checked = false;
    currentGenre = e.target.value;
    applyGenreColors(currentGenre);
    document.getElementById("genreDetected").textContent = currentGenre.toUpperCase();
    const songUrl = GENRE_SONGS[currentGenre];
    if (songUrl) setupAudio(songUrl, false);
  };

  applyGenreColors(currentGenre);

  // === Audio-Analyse ===
  let beatHistory = [];
  let lastPeakTime = 0;

  function estimateBPM() {
    if (beatHistory.length < 2) return 0;
    const diffs = [];
    for (let i = 1; i < beatHistory.length; i++) {
      diffs.push(beatHistory[i] - beatHistory[i - 1]);
    }
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    return Math.round(60 / avgDiff);
  }

  function detectBeat(avgAmp) {
    const now = audioCtx.currentTime;
    if (avgAmp > 0.25 && (now - lastPeakTime) > 0.25) {
      lastPeakTime = now;
      beatHistory.push(now);
      if (beatHistory.length > 20) beatHistory.shift();
    }
  }

  function classifyGenreByData(bpm, spectrum) {
    let bass = 0, mid = 0, high = 0;
    const len = spectrum.length;
    for (let i = 0; i < len; i++) {
      const freq = i * (audioCtx.sampleRate / 2) / len;
      if (freq < 200) bass += spectrum[i];
      else if (freq < 2000) mid += spectrum[i];
      else high += spectrum[i];
    }
    const total = bass + mid + high || 1;
    bass /= total; mid /= total; high /= total;

    if (bpm < 90 && high < 0.2) return "classic";
    if (bpm >= 70 && bpm <= 120 && mid > 0.4) return "jazz";
    if (bpm > 80 && bpm < 110 && bass > 0.45) return "hiphop";
    if (bpm > 120 && high > 0.25) return "techno";
    return "rock";
  }

  function animate() {
    rafId = requestAnimationFrame(animate);
    if (audioElem && !audioElem.paused) {
      if (!isSeeking) {
        currentTimeSpan.textContent = formatTime(audioElem.currentTime);
        progressBar.value = audioElem.currentTime;
      }

      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;

      detectBeat(avg);
      const currentBpm = estimateBPM();

      const detected = classifyGenreByData(currentBpm, dataArray);
      document.getElementById("genreDetected").textContent = detected + " (erkannt)";
      currentGenre = detected;
      applyGenreColors(currentGenre);

      const g = GENRE[currentGenre] || GENRE.classic;
      const baseAmp = avg * parseFloat(sensitivity.value);
      const amplitude = Math.min(1, baseAmp * g.growth * 1.4);
      const timeFactor = Date.now() / (250 + g.wobble * 40);
      const wobble = g.wobble * Math.sin(timeFactor);
      const rotate = (amplitude * 32 * g.wobble) - 16;
      const swayX = wobble * 12;
      const scale = 1 + amplitude * (0.25 + g.growth * 0.2);
      const up = amplitude * (10 + g.growth * 16);

      leafGroup.style.transform = `translate(${100 + swayX}px, ${110 - up}px) rotate(${rotate}deg) scale(${scale})`;

      const step = Math.floor(dataArray.length / BAR_COUNT);
      for (let i = 0; i < BAR_COUNT; i++) {
        const val = dataArray[i * step];
        bars[i].style.height = Math.max(6, (val / 255) * 80) + 'px';
      }
    }
  }

  // === Progress Bar (Spulen) ===
  progressBar.onmousedown = progressBar.ontouchstart = () => {
    isSeeking = true;
    if (audioElem && !audioElem.paused) audioElem.pause();
  };
  progressBar.oninput = () => {
    if (isSeeking) currentTimeSpan.textContent = formatTime(progressBar.value);
  };
  progressBar.onmouseup = progressBar.ontouchend = () => {
    isSeeking = false;
    if (audioElem) {
      audioElem.currentTime = parseFloat(progressBar.value);
      if (audioElem.paused) audioElem.play();
    }
  };

  // === Button Events ===
  playBtn.onclick = async () => {
    if (audioElem && audioElem.paused && audioElem.src) {
      audioElem.play();
      animate();
      return;
    }
    if (fileRadio.checked) {
      if (!fileInput.files[0]) return alert('Bitte Audiodatei wählen.');
      genreSelect.value = "";
      setupAudio(fileInput.files[0], true);
      return;
    }
    if (genreSelect.value && GENRE_SONGS[genreSelect.value]) {
      currentGenre = genreSelect.value;
      applyGenreColors(currentGenre);
      document.getElementById("genreDetected").textContent = currentGenre.toUpperCase();
      setupAudio(GENRE_SONGS[currentGenre], false);
    } else {
      alert('Bitte wähle ein Genre oder eine Audiodatei.');
    }
  };

  pauseBtn.onclick = () => {
    if (audioElem && !audioElem.paused) audioElem.pause();
  };

  resetBtn.onclick = stopAll;

  sensitivity.oninput = () => sensVal.textContent = sensitivity.value;
  volume.oninput = () => {
    if (gainNode) gainNode.gain.value = volume.value;
    volVal.textContent = Number(volume.value).toFixed(2);
  };

  // === WebRTC BROADCASTER ===
  let rtcPeers = {};
  const ROOM_ID = 'synth-garden-live';
  const socket = io('http://localhost:3000'); // Später: deine echte Server-URL

  async function startBroadcast() {
    let broadcastStream = null;

    // Welche Audioquelle ist aktiv?
    if (audioElem && audioElem.src) {
      // Aus <audio>-Element (Datei oder Genre-Song)
      if (typeof audioElem.captureStream === 'function') {
        broadcastStream = audioElem.captureStream();
      } else if (typeof audioElem.mozCaptureStream === 'function') {
        broadcastStream = audioElem.mozCaptureStream();
      }
    } else if (stream) {
      // Mikrofon
      broadcastStream = stream;
    }

    if (!broadcastStream) {
      alert("Keine aktive Audioquelle. Starte zuerst eine Wiedergabe.");
      return;
    }

    socket.emit('join-room', ROOM_ID);

    socket.on('peer-joined', (viewerId) => createPeerConnection(viewerId, broadcastStream, true));
    socket.on('existing-peers', (peers) => peers.forEach(id => createPeerConnection(id, broadcastStream, true)));

    alert("🔴 Live-Stream gestartet! Zuschauer können jetzt beitreten.");
  }

  function createPeerConnection(peerId, stream, isInitiator) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    rtcPeers[peerId] = pc;

    stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('ice-candidate', { target: peerId, candidate: e.candidate });
    };

    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => socket.emit('offer', { target: peerId, offer: pc.localDescription }));
    }

    socket.on('answer', (data) => {
      if (data.sender === peerId) pc.setRemoteDescription(data.answer);
    });

    socket.on('ice-candidate', (data) => {
      if (data.sender === peerId && data.candidate) {
        pc.addIceCandidate(data.candidate).catch(e => console.error("ICE Fehler:", e));
      }
    });

    socket.on('peer-left', (leftId) => {
      if (rtcPeers[leftId]) {
        rtcPeers[leftId].close();
        delete rtcPeers[leftId];
      }
    });
  }

  // Button zum Starten des Streams
  if (startBroadcastBtn) {
    startBroadcastBtn.addEventListener('click', startBroadcast);
  }
});