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

  // === DOM-Elemente ===
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
  const startBroadcastBtn = document.getElementById('startBroadcastBtn');

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
  const bars = document.querySelectorAll('.bar');

  // === Hilfsfunktionen ===
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
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
    if (audioElem) { audioElem.pause(); audioElem.src = ''; audioElem = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
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
      audioElem.play().catch(e => console.error(e));
    };

    audioElem.onended = stopAll;

    sourceNode = audioCtx.createMediaElementSource(audioElem);
    sourceNode.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    animate();
  }

  function applyGenreColors(genre) {
    const g = document.querySelector('#g1');
    if (!g) return;
    const p = GENRE[genre] || GENRE.classic;
    g.children[0].setAttribute('stop-color', p.colorA);
    g.children[1].setAttribute('stop-color', p.colorB);
  }

  genreSelect.onchange = (e) => {
    fileRadio.checked = false;
    currentGenre = e.target.value;
    applyGenreColors(currentGenre);
    document.getElementById("genreDetected").textContent = currentGenre.toUpperCase();
    if (GENRE_SONGS[currentGenre]) setupAudio(GENRE_SONGS[currentGenre], false);
  };

  applyGenreColors(currentGenre);

  // === Audio-Analyse & Animation ===
  let beatHistory = [];
  let lastPeakTime = 0;

  function estimateBPM() {
    if (beatHistory.length < 2) return 0;
    const diffs = beatHistory.slice(1).map((t, i) => t - beatHistory[i]);
    return Math.round(60 / (diffs.reduce((a,b) => a+b) / diffs.length));
  }

  function detectBeat(avg) {
    const now = audioCtx.currentTime;
    if (avg > 0.25 && now - lastPeakTime > 0.25) {
      lastPeakTime = now;
      beatHistory.push(now);
      if (beatHistory.length > 20) beatHistory.shift();
    }
  }

  function classifyGenreByData(bpm, spectrum) {
    let bass = 0, mid = 0, high = 0;
    for (let i = 0; i < spectrum.length; i++) {
      const f = i * audioCtx.sampleRate / 2 / spectrum.length;
      if (f < 200) bass += spectrum[i];
      else if (f < 2000) mid += spectrum[i];
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
    if ((audioElem && !audioElem.paused) || (remoteStream && remoteStream.active)) {
      if (!isSeeking && audioElem) {
        currentTimeSpan.textContent = formatTime(audioElem.currentTime);
        progressBar.value = audioElem.currentTime;
      }

      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a,b) => a+b, 0) / dataArray.length / 255;

      detectBeat(avg);
      const bpm = estimateBPM();
      const detected = classifyGenreByData(bpm, dataArray);
      document.getElementById("genreDetected").textContent = detected + " (erkannt)";
      currentGenre = detected;
      applyGenreColors(currentGenre);

      const g = GENRE[currentGenre] || GENRE.classic;
      const amp = Math.min(1, avg * parseFloat(sensitivity.value) * g.growth * 1.4);
      const wobble = g.wobble * Math.sin(Date.now() / (250 + g.wobble * 40));
      const rotate = amp * 32 * g.wobble - 16;
      const swayX = wobble * 12;
      const scale = 1 + amp * (0.25 + g.growth * 0.2);
      const up = amp * (10 + g.growth * 16);

      leafGroup.style.transform = `translate(${100 + swayX}px, ${110 - up}px) rotate(${rotate}deg) scale(${scale})`;

      const step = Math.floor(dataArray.length / BAR_COUNT);
      bars.forEach((bar, i) => {
        const val = dataArray[i * step];
        bar.style.height = Math.max(6, (val / 255) * 80) + 'px';
      });
    }
  }

  // === Progress Bar ===
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

  // === Button Events  ===
  playBtn.addEventListener('click', async () => {
    if (audioElem && audioElem.paused && audioElem.src) {
      await audioElem.play();
      animate();
      return;
    }
    if (fileRadio.checked && fileInput.files[0]) {
      genreSelect.value = "";
      setupAudio(fileInput.files[0], true);
    } else if (genreSelect.value && GENRE_SONGS[genreSelect.value]) {
      currentGenre = genreSelect.value;
      applyGenreColors(currentGenre);
      document.getElementById("genreDetected").textContent = currentGenre.toUpperCase();
      setupAudio(GENRE_SONGS[currentGenre], false);
    } else {
      alert('Bitte wähle eine Audioquelle.');
    }
  });

  pauseBtn.onclick = () => audioElem?.pause();
  resetBtn.onclick = stopAll;
  sensitivity.oninput = () => sensVal.textContent = sensitivity.value;
  volume.oninput = () => {
    if (gainNode) gainNode.gain.value = volume.value;
    volVal.textContent = Number(volume.value).toFixed(2);
  };

  // === WebRTC: Einmalige Socket-Verbindung ===
  const ROOM_ID = 'synth-garden-live';
  const socket = io('http://localhost:3000'); // Später echte URL

  let isBroadcaster = false;
  let rtcPeers = {};
  let remoteStream = null;

  // Universelle Peer-Verbindung (für beide Rollen)
  function createPeerConnection(peerId, stream, isInitiator) {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    rtcPeers[peerId] = pc;

    if (stream) {
      stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));
    }

    pc.ontrack = (event) => {
      if (!remoteStream) remoteStream = new MediaStream();
      remoteStream.addTrack(event.track);
      stopAll(); // Lokale Quelle stoppen
      initAudioContext();
      sourceNode = audioCtx.createMediaStreamSource(remoteStream);
      sourceNode.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      animate();
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('ice-candidate', { target: peerId, candidate: e.candidate });
      }
    };

    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => socket.emit('offer', { target: peerId, offer: pc.localDescription }));
    }

    socket.on('answer', (data) => {
      if (data.sender === peerId) pc.setRemoteDescription(data.answer);
    });

    socket.on('offer', async (data) => {
      if (data.sender === peerId && !isInitiator) {
        await pc.setRemoteDescription(data.offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { target: peerId, answer: pc.localDescription });
      }
    });

    socket.on('ice-candidate', (data) => {
      if (data.sender === peerId && data.candidate) {
        pc.addIceCandidate(data.candidate).catch(() => {});
      }
    });
  }

  // Broadcaster starten
  async function startBroadcast() {
    if (isBroadcaster) {
      alert("Du streamst bereits.");
      return;
    }

    let streamToSend = null;
    if (audioElem && audioElem.src) {
      streamToSend = audioElem.captureStream?.() || audioElem.mozCaptureStream?.();
    } else if (stream) {
      streamToSend = stream;
    }

    if (!streamToSend || streamToSend.getAudioTracks().length === 0) {
      alert("Keine Audioquelle aktiv. Starte zuerst eine Wiedergabe.");
      return;
    }

    isBroadcaster = true;
    socket.emit('join-room', ROOM_ID);

    socket.on('peer-joined', (id) => createPeerConnection(id, streamToSend, true));
    socket.on('existing-peers', (peers) => peers.forEach(id => createPeerConnection(id, streamToSend, true)));

    alert("? Live-Stream gestartet!");
  }

  if (startBroadcastBtn) {
    startBroadcastBtn.addEventListener('click', startBroadcast);
  }

  // Viewer-Modus: Immer aktiv (außer wenn Broadcaster)
  socket.emit('join-room', ROOM_ID);
  socket.on('peer-joined', (id) => {
    if (!isBroadcaster) createPeerConnection(id, null, false);
  });
  socket.on('existing-peers', (peers) => {
    if (!isBroadcaster) peers.forEach(id => createPeerConnection(id, null, false));
  });
});