// main.js

document.addEventListener('DOMContentLoaded', () => {
	

  // === Floating Particles auf der Startseite ===
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

  // === Blatt-Demo Setup ===
  const playBtn = document.getElementById('playBtn');
  const stopBtn = document.getElementById('stopBtn');
  const fileInput = document.getElementById('fileInput');
  const sensitivity = document.getElementById('sensitivity');
  const sensVal = document.getElementById('sensVal');
  const fileRadio = document.getElementById('fileRadio');
  const leafGroup = document.getElementById('leafGroup');
  const barsContainer = document.getElementById('bars');

  let audioCtx, analyser, dataArray, sourceNode, audioElem, rafId, stream;
  const BAR_COUNT = 24;

  // Bars erstellen
  for (let i = 0; i < BAR_COUNT; i++) {
    const b = document.createElement('div');
    b.className = 'bar';
    barsContainer.appendChild(b);
  }
  const bars = Array.from(document.querySelectorAll('.bar'));

  function initAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
    }
	  gainNode = audioCtx.createGain();
	  gainNode.gain.value = 1; // Start-Lautstärke

  }

	
  async function startFromFile(file) {
    stopAll();
    initAudioContext();
    audioElem = new Audio();
    audioElem.loop = true;
    audioElem.src = URL.createObjectURL(file);
    await audioElem.play();
    sourceNode = audioCtx.createMediaElementSource(audioElem);
    sourceNode.connect(analyser);
	analyser.connect(gainNode);
	gainNode.connect(audioCtx.destination);

    animate();
  }


  function stopAll() {
    if (rafId) cancelAnimationFrame(rafId);
    if (audioElem) { audioElem.pause(); audioElem.src = ''; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); }
    leafGroup.style.transform = 'translate(100px,110px) rotate(0) scale(1)';
    bars.forEach(b => b.style.height = '8px');
    document.getElementById("genreDetected").textContent = "–";
  }

  // GENRE Parameter
  const GENRE = {
    classic: { growth: 0.4, wobble: 0.2, colorA: "#98edc1", colorB: "#52b5e6" },
    hiphop:  { growth: 1.0, wobble: 1.2, colorA: "#ff8800", colorB: "#ff0044" },
    techno:  { growth: 0.9, wobble: 1.8, colorA: "#ff00ff", colorB: "#00ffff" },
    rock:    { growth: 1.2, wobble: 1.4, colorA: "#28ff00", colorB: "#005eff" },
    pop:     { growth: 0.7, wobble: 0.8, colorA: "#ffd700", colorB: "#ff69b4" }
  };

  let currentGenre = "classic";
  document.getElementById("genreSelect").onchange = (e) => {
    currentGenre = e.target.value;
    applyGenreColors(currentGenre);
  };

  function applyGenreColors(genre) {
    const g = document.querySelector('#g1');
    g.children[0].setAttribute("stop-color", GENRE[genre].colorA);
    g.children[1].setAttribute("stop-color", GENRE[genre].colorB);
  }

  // --- Einfaches BPM & Genre Setup ---
  let beatHistory = [];
  let lastPeakTime = 0;

  function estimateBPM() {
    if (beatHistory.length < 2) return 0;
    const diffs = [];
    for (let i = 1; i < beatHistory.length; i++) {
      diffs.push(beatHistory[i] - beatHistory[i-1]);
    }
    const avgDiff = diffs.reduce((a,b)=>a+b,0)/diffs.length;
    return 60 / avgDiff; // BPM
  }

  function detectBeat(avgAmp) {
    const now = audioCtx.currentTime;
    if(avgAmp > 0.25 && (now - lastPeakTime) > 0.25) {
      lastPeakTime = now;
      beatHistory.push(now);
      if(beatHistory.length > 20) beatHistory.shift();
    }
  }

  function classifyGenre(bpm, spectrum) {
    // einfache spektrale Schätzungen
    let bass = 0, mid = 0, high = 0;
    const len = spectrum.length;
    for (let i = 0; i < len; i++) {
      const freq = i * (audioCtx.sampleRate / 2) / len;
      if (freq < 200) bass += spectrum[i];
      else if (freq < 2000) mid += spectrum[i];
      else high += spectrum[i];
    }
    const total = bass + mid + high;
    bass /= total; mid /= total; high /= total;

    if (bpm < 90 && mid > bass && high < 0.2) return "classic";
    if (bass > 0.45 && bpm >= 70 && bpm <= 110) return "hiphop";
    if (bpm > 120 && bass < 0.35 && high > 0.25) return "techno";
    if (mid > 0.45 && bpm >= 100 && bpm <= 150) return "rock";
    return "pop"; // fallback
  }

  function animate() {
    rafId = requestAnimationFrame(animate);

    analyser.getByteFrequencyData(dataArray);

    let avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
    detectBeat(avg);
    const currentBpm = estimateBPM();

    // Genre erkennen
    const detectedGenre = classifyGenre(currentBpm, dataArray);
    document.getElementById("genreDetected").textContent = detectedGenre;
    currentGenre = detectedGenre;
    applyGenreColors(currentGenre);

    const baseAmp = avg * parseFloat(sensitivity.value);
    const g = GENRE[currentGenre];
    const amplitude = Math.min(1, baseAmp * g.growth * 1.4);
    const wobble = g.wobble * Math.sin(Date.now() / (250 + g.wobble * 40));
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

  // Event-Listener für Buttons & Sensitivity
  playBtn.onclick = async () => {
  if (!fileInput.files[0]) return alert('Bitte Audiodatei wählen.');
  await startFromFile(fileInput.files[0]);
};

  stopBtn.onclick = stopAll;
  sensitivity.oninput = () => sensVal.textContent = sensitivity.value;
	
	const volume = document.getElementById('volume');
	const volVal = document.getElementById('volVal');
	
	volume.oninput = () => {
  gainNode.gain.value = volume.value;
  volVal.textContent = Number(volume.value).toFixed(2);
};

	
});
