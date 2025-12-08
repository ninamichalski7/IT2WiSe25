// main.js

document.addEventListener('DOMContentLoaded', () => {

  // === 1. KONFIGURATION DER GENRE-SONGS ===
  const GENRE_SONGS = {
    classic: 'musik/classic.mp3',
    jazz:    'musik/jazz.mp3',
    rock:    'musik/rock.mp3',
    techno:  'musik/techno.mp3',
    hiphop:  'musik/hiphop.mp3'
  };

  // === 2. VISUELLE PARAMETER FÜR DIE GENRES ===
  const GENRE = {
    classic: { growth: 0.4, wobble: 0.2, colorA: "#98edc1", colorB: "#52b5e6" }, // Sanftes Blau-Grün
    jazz:    { growth: 0.6, wobble: 0.5, colorA: "#e6c200", colorB: "#6a0dad" }, // Gold & Lila (Smooth)
    rock:    { growth: 1.2, wobble: 1.4, colorA: "#28ff00", colorB: "#005eff" }, // Energievolles Grün-Blau
    techno:  { growth: 0.9, wobble: 1.8, colorA: "#ff00ff", colorB: "#00ffff" }, // Neon Pink-Cyan
    hiphop:  { growth: 1.0, wobble: 1.2, colorA: "#ff8800", colorB: "#ff0044" }  // Orange-Rot
  };


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
  const fileRadio = document.getElementById('fileRadio'); // Radio Button
  const genreSelect = document.getElementById('genreSelect'); // Dropdown
  const leafGroup = document.getElementById('leafGroup');
  const barsContainer = document.getElementById('bars');
  const volume = document.getElementById('volume');
  const volVal = document.getElementById('volVal');

  let audioCtx, analyser, dataArray, sourceNode, audioElem, rafId, stream, gainNode;
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
      
      gainNode = audioCtx.createGain();
      gainNode.gain.value = volume.value;
    }
  }

  // Start über Datei-Upload
  async function startFromFile(file) {
    stopAll();
    initAudioContext();
    audioElem = new Audio();
    audioElem.loop = true;
    audioElem.src = URL.createObjectURL(file);
    await audioElem.play();
    sourceNode = audioCtx.createMediaElementSource(audioElem);
    setupAudioChain();
    animate();
  }

  // Start über Genre-Auswahl
  async function startFromGenre(url) {
    stopAll();
    initAudioContext();
    audioElem = new Audio();
    audioElem.loop = true;
    audioElem.src = url;
    
    // Fehler abfangen, falls Datei fehlt (angepasster Text)
    audioElem.onerror = () => alert(`Konnte Datei nicht finden: ${url}\nBitte prüfe den Ordner "musik" und die Dateinamen!`);
    
    await audioElem.play();
    sourceNode = audioCtx.createMediaElementSource(audioElem);
    setupAudioChain();
    animate();
  }

  function setupAudioChain() {
    sourceNode.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(audioCtx.destination);
  }

  function stopAll() {
    if (rafId) cancelAnimationFrame(rafId);
    if (audioElem) { 
      audioElem.pause(); 
      audioElem.src = ''; 
    }
    // Falls Mikronfon-Stream aktiv war
    if (stream) { stream.getTracks().forEach(t => t.stop()); }

    // Reset Visuals
    leafGroup.style.transform = 'translate(100px,110px) rotate(0) scale(1)';
    bars.forEach(b => b.style.height = '8px');
    document.getElementById("genreDetected").textContent = "–";
  }

  // === GENRE LOGIK ===
  let currentGenre = "classic";

  // Wenn man im Dropdown etwas auswählt:
  genreSelect.onchange = (e) => {
    // 1. Setze Modus auf "Genre" (visuell kein Radio-Button, aber logisch)
    if(fileRadio) fileRadio.checked = false; 
    
    // 2. Genre setzen
    currentGenre = e.target.value;
    applyGenreColors(currentGenre);
    document.getElementById("genreDetected").textContent = currentGenre.toUpperCase(); 

    // 3. Song abspielen
    const songUrl = GENRE_SONGS[currentGenre];
    if (songUrl) {
      startFromGenre(songUrl);
    }
  };

  function applyGenreColors(genre) {
    const gElement = document.querySelector('#g1');
    const params = GENRE[genre] || GENRE.classic; 
    gElement.children[0].setAttribute("stop-color", params.colorA);
    gElement.children[1].setAttribute("stop-color", params.colorB);
  }

  // Initial Farben setzen
  applyGenreColors(currentGenre);


  // === ANALYSE LOGIK (BPM etc.) ===
  let beatHistory = [];
  let lastPeakTime = 0;

  function estimateBPM() {
    if (beatHistory.length < 2) return 0;
    const diffs = [];
    for (let i = 1; i < beatHistory.length; i++) {
      diffs.push(beatHistory[i] - beatHistory[i-1]);
    }
    const avgDiff = diffs.reduce((a,b)=>a+b,0)/diffs.length;
    return 60 / avgDiff; 
  }

  function detectBeat(avgAmp) {
    const now = audioCtx.currentTime;
    if(avgAmp > 0.25 && (now - lastPeakTime) > 0.25) {
      lastPeakTime = now;
      beatHistory.push(now);
      if(beatHistory.length > 20) beatHistory.shift();
    }
  }

  // Automatische Erkennung (Nur relevant, wenn eigene Datei hochgeladen wird)
  function classifyGenreByData(bpm, spectrum) {
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

    // Einfache Heuristik für die 5 Genres
    if (bpm < 90 && high < 0.2) return "classic"; 
    if (bpm >= 70 && bpm <= 120 && mid > 0.4) return "jazz"; 
    if (bpm > 80 && bpm < 110 && bass > 0.45) return "hiphop"; 
    if (bpm > 120 && high > 0.25) return "techno"; 
    return "rock"; 
  }

  function animate() {
    rafId = requestAnimationFrame(animate);

    analyser.getByteFrequencyData(dataArray);

    let avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
    detectBeat(avg);
    const currentBpm = estimateBPM();

    // Nur wenn WIRKLICH eine Datei hochgeladen ist (fileInput aktiv), versuchen wir zu raten.
    if (fileRadio.checked) {
       const detected = classifyGenreByData(currentBpm, dataArray);
       document.getElementById("genreDetected").textContent = detected + " (erkannt)";
    }

    // Visuelle Parameter abrufen
    const g = GENRE[currentGenre] || GENRE.classic;
    
    const baseAmp = avg * parseFloat(sensitivity.value);
    const amplitude = Math.min(1, baseAmp * g.growth * 1.4);
    
    // Wobble-Berechnung
    const timeFactor = Date.now() / (250 + g.wobble * 40);
    const wobble = g.wobble * Math.sin(timeFactor);
    
    const rotate = (amplitude * 32 * g.wobble) - 16;
    const swayX = wobble * 12;
    const scale = 1 + amplitude * (0.25 + g.growth * 0.2);
    const up = amplitude * (10 + g.growth * 16);

    leafGroup.style.transform = `translate(${100 + swayX}px, ${110 - up}px) rotate(${rotate}deg) scale(${scale})`;

    // Bars visualisieren
    const step = Math.floor(dataArray.length / BAR_COUNT);
    for (let i = 0; i < BAR_COUNT; i++) {
      const val = dataArray[i * step];
      bars[i].style.height = Math.max(6, (val / 255) * 80) + 'px';
    }
  }

  // === BUTTON EVENTS ===
  playBtn.onclick = async () => {
    if (!fileInput.files[0]) return alert('Bitte Audiodatei wählen.');
    
    // Zurücksetzen auf Datei-Modus
    fileRadio.checked = true;
    genreSelect.value = ""; 
    
    await startFromFile(fileInput.files[0]);
  };

  stopBtn.onclick = stopAll;
  
  sensitivity.oninput = () => sensVal.textContent = sensitivity.value;
  
  volume.oninput = () => {
    if (gainNode) gainNode.gain.value = volume.value;
    volVal.textContent = Number(volume.value).toFixed(2);
  };
});