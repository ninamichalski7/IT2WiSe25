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
    classic: { growth: 0.4, wobble: 0.2, colorA: "#98edc1", colorB: "#52b5e6" }, 
    jazz:    { growth: 0.6, wobble: 0.5, colorA: "#e6c200", colorB: "#6a0dad" }, 
    rock:    { growth: 1.2, wobble: 1.4, colorA: "#28ff00", colorB: "#005eff" }, 
    techno:  { growth: 0.9, wobble: 1.8, colorA: "#ff00ff", colorB: "#00ffff" }, 
    hiphop:  { growth: 1.0, wobble: 1.2, colorA: "#ff8800", colorB: "#ff0044" }  
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
  const pauseBtn = document.getElementById('stopBtn'); // Umbenannt, aber ID behalten
  const resetBtn = document.getElementById('resetBtn'); // NEU: für kompletten Stop/Reset
  const fileInput = document.getElementById('fileInput');
  const sensitivity = document.getElementById('sensitivity');
  const sensVal = document.getElementById('sensVal');
  const fileRadio = document.getElementById('fileRadio'); 
  const genreSelect = document.getElementById('genreSelect'); 
  const leafGroup = document.getElementById('leafGroup');
  const barsContainer = document.getElementById('bars');
  const volume = document.getElementById('volume');
  const volVal = document.getElementById('volVal');
  // NEU: Fortschrittsanzeigen
  const currentTimeSpan = document.getElementById('currentTime');
  const durationTimeSpan = document.getElementById('durationTime');
  const progressBar = document.getElementById('progressBar');

  let audioCtx, analyser, dataArray, sourceNode, audioElem, rafId, stream, gainNode;
  const BAR_COUNT = 24;

  // Bars erstellen
  for (let i = 0; i < BAR_COUNT; i++) {
    const b = document.createElement('div');
    b.className = 'bar';
    barsContainer.appendChild(b);
  }
  const bars = Array.from(document.querySelectorAll('.bar'));
  
  // NEU: Zeitformatierung (z.B. 3:45)
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
  
  // NEU: Setzt Audio und Visuals komplett zurück
  function stopAll() {
    if (rafId) cancelAnimationFrame(rafId);
    if (audioElem) { 
      audioElem.pause(); 
      audioElem.src = ''; 
    }
    if (stream) { stream.getTracks().forEach(t => t.stop()); }

    // WICHTIG: Visuals und Anzeigen zurücksetzen
    leafGroup.style.transform = 'translate(100px,110px) rotate(0) scale(1)';
    bars.forEach(b => b.style.height = '8px');
    currentTimeSpan.textContent = '0:00';
    durationTimeSpan.textContent = '0:00';
    progressBar.value = 0;
    document.getElementById("genreDetected").textContent = "–";
    
    // Setze Genre auf Default (classic) oder leer
    currentGenre = 'classic'; 
    applyGenreColors(currentGenre);
  }

  // Zentralisierte Audio-Setup-Funktion
  function setupAudio(url, isFile = false) {
    stopAll(); // Stoppt vorherigen Track und setzt Visuals zurück

    initAudioContext();
    audioElem = new Audio();
    audioElem.loop = true;
    audioElem.src = isFile ? URL.createObjectURL(url) : url;
    
    if (!isFile) {
      audioElem.onerror = () => alert(`Konnte Datei nicht finden: ${url}\nBitte prüfe den Ordner "musik" und die Dateinamen!`);
    }
    
    // Fortschrittsanzeige initialisieren
    audioElem.onloadedmetadata = () => {
      durationTimeSpan.textContent = formatTime(audioElem.duration);
      progressBar.max = audioElem.duration;
      audioElem.play();
    };

    // NEU: Reset, wenn Song zu Ende (wichtig, falls loop=false)
    audioElem.onended = () => {
      stopAll(); 
      alert("Song beendet.");
    };

    sourceNode = audioCtx.createMediaElementSource(audioElem);
    sourceNode.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    animate();
  }

  async function startFromFile(file) {
      setupAudio(file, true);
  }
  async function startFromGenre(url) {
      setupAudio(url, false);
  }
  
  // === GENRE LOGIK ===
  let currentGenre = "classic";

  // Wenn man im Dropdown etwas auswählt:
  genreSelect.onchange = (e) => {
    // 1. Setze Modus auf "Genre"
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


  // === ANALYSE LOGIK & ANIMATION ===
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

  function classifyGenreByData(bpm, spectrum) {
    // ... (Logik zur Genre-Erkennung, bleibt unverändert) ...
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

    if (bpm < 90 && high < 0.2) return "classic"; 
    if (bpm >= 70 && bpm <= 120 && mid > 0.4) return "jazz"; 
    if (bpm > 80 && bpm < 110 && bass > 0.45) return "hiphop"; 
    if (bpm > 120 && high > 0.25) return "techno"; 
    return "rock"; 
  }

  function animate() {
    rafId = requestAnimationFrame(animate);

    if (audioElem && !audioElem.paused) {
      // NEU: Aktualisiere Fortschrittsanzeige
      currentTimeSpan.textContent = formatTime(audioElem.currentTime);
      progressBar.value = audioElem.currentTime;
      
      analyser.getByteFrequencyData(dataArray);

      let avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
      detectBeat(avg);
      const currentBpm = estimateBPM();

      // Nur wenn WIRKLICH eine Datei hochgeladen ist, raten wir das Genre und zeigen es an.
      if (fileRadio.checked) {
        const detected = classifyGenreByData(currentBpm, dataArray);
        document.getElementById("genreDetected").textContent = detected + " (erkannt)";
      }

      // Visuelle Parameter abrufen
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

      // Bars visualisieren
      const step = Math.floor(dataArray.length / BAR_COUNT);
      for (let i = 0; i < BAR_COUNT; i++) {
        const val = dataArray[i * step];
        bars[i].style.height = Math.max(6, (val / 255) * 80) + 'px';
      }
    } else {
      // Wenn Musik pausiert ist, Visualisierung einfrieren
      // Optional: Man könnte die Bars hier auf Null setzen, aber Einfrieren ist dynamischer.
    }
  }

  // === BUTTON EVENTS ===
  // Play/Resume Logik
  playBtn.onclick = async () => {
    // 1. RESUME (wenn pausiert)
    if (audioElem && audioElem.paused && audioElem.src) {
      audioElem.play();
      animate(); // Startet die Animation neu, falls sie gestoppt war
      return;
    }

    // 2. START (wenn Datei gewählt)
    if (fileRadio.checked) {
      if (!fileInput.files[0]) return alert('Bitte Audiodatei wählen.');
      genreSelect.value = ""; // Genre-Auswahl neutralisieren
      await startFromFile(fileInput.files[0]);
      return;
    }
    
    // 3. START (wenn Genre gewählt, aber noch nichts spielt)
    if (genreSelect.value && GENRE_SONGS[genreSelect.value]) {
      currentGenre = genreSelect.value;
      applyGenreColors(currentGenre);
      document.getElementById("genreDetected").textContent = currentGenre.toUpperCase();
      await startFromGenre(GENRE_SONGS[currentGenre]);
    } else {
      alert('Bitte wähle ein Genre oder eine Audiodatei.');
    }
  };

  // Pause Logik
  pauseBtn.onclick = () => {
    if (audioElem && !audioElem.paused) {
      audioElem.pause();
    }
  };
  
  // NEU: Reset Logik für kompletten Stopp
  resetBtn.onclick = stopAll;


  // Weitere Event-Listener
  sensitivity.oninput = () => sensVal.textContent = sensitivity.value;
  
  volume.oninput = () => {
    if (gainNode) gainNode.gain.value = volume.value;
    volVal.textContent = Number(volume.value).toFixed(2);
  };
});