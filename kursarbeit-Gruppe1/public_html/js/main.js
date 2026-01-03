// main.js 
document.addEventListener('DOMContentLoaded', function() {
  /* Konfiguration */
  var GENRE_SONGS = {
    classic: 'musik/classic.mp3',
    jazz: 'musik/jazz.mp3',
    rock: 'musik/rock.mp3',
    techno: 'musik/techno.mp3',
    hiphop: 'musik/hiphop.mp3'
  };

  var GENRE = {
    classic: { growth: 0.4, wobble: 0.2, colorA: "#98edc1", colorB: "#52b5e6" },
    jazz: { growth: 0.6, wobble: 0.5, colorA: "#e6c200", colorB: "#6a0dad" },
    rock: { growth: 1.2, wobble: 1.4, colorA: "#28ff00", colorB: "#005eff" },
    techno: { growth: 0.9, wobble: 1.8, colorA: "#ff00ff", colorB: "#00ffff" },
    hiphop: { growth: 1.0, wobble: 1.2, colorA: "#ff8800", colorB: "#ff0044" }
  };

  /* DOM Elemente */
  var playBtn = document.getElementById('playBtn');
  var pauseBtn = document.getElementById('stopBtn');
  var resetBtn = document.getElementById('resetBtn');
  var fileInput = document.getElementById('fileInput');
  var sensitivity = document.getElementById('sensitivity');
  var sensVal = document.getElementById('sensVal');
  var fileRadio = document.getElementById('fileRadio');
  var genreSelect = document.getElementById('genreSelect');
  var leafGroup = document.getElementById('leafGroup');
  var barsContainer = document.getElementById('bars');
  var volume = document.getElementById('volume');
  var volVal = document.getElementById('volVal');
  var currentTimeSpan = document.getElementById('currentTime');
  var durationTimeSpan = document.getElementById('durationTime');
  var progressBar = document.getElementById('progressBar');
  var particlesContainer = document.getElementById('particles');
  var statusElement = document.getElementById('genreDetected');

  // === Particles ===
  if (particlesContainer) {
    for (var ii = 0; ii < 40; ii++) {
      var p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.top = Math.random() * 100 + '%';
      p.style.animationDelay = Math.random() * 6 + 's';
      p.style.animationDuration = (4 + Math.random() * 4) + 's';
      particlesContainer.appendChild(p);
    }
  }

  // === Bars ===
  var BAR_COUNT = 24;
  if (barsContainer) {
    for (var ii = 0; ii < BAR_COUNT; ii++) {
      var b = document.createElement('div');
      b.className = 'bar';
      barsContainer.appendChild(b);
    }
  }
  var bars = document.querySelectorAll('.bar');

  // === GLOBALE VARIABLEN ===
  var isSeeking = false;
  var audioCtx = null, analyser = null, dataArray = null, sourceNode = null, audioElem = null, rafId = null, stream = null, gainNode = null;
  var currentGenre = "classic";
  var beatHistory = [];
  var lastPeakTime = 0;

  // === PFLANZENSTATUS ===
  function plantStatus(bass, mid, high, bpm) {
    if (high > 0.70) return { text: "?Hohe Frequenzen schaden Blueten", status: "stress" };
    if (bpm > 140) return { text: "Zu schnell - Pflanze ueberfordert", status: "stress" };
    if (mid > 0.45 || (bpm > 40 && bpm < 140)) return { text: "Sanfte Toene - optimal fuer Wachstum", status: "optimal" };
    return { text: "Zu ruhig - wenig Wachstum", status: "warning" };
  }

  // === HILFSFUNKTIONEN ===
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return '0:00';
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' + s : s);
  }

  function initAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      var Uint8Array = window.Uint8Array || Array;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      gainNode = audioCtx.createGain();
      if (volume) gainNode.gain.value = parseFloat(volume.value) || 0.5;
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
      stream.getTracks().forEach(function(t) { t.stop(); });
      stream = null; 
    }
    if (leafGroup) {
      leafGroup.style.fill = "#ffaa00";  // Orange Reset
      var children = leafGroup.children;
      for (var ii = 0; ii < children.length; ii++) {
        children[ii].style.fill = "#ffaa00";
      }
      leafGroup.style.transform = 'translate(100px,110px) rotate(0) scale(1)';
    }
    for (var ii = 0; ii < bars.length; ii++) {
      bars[ii].style.height = '8px';
    }
    if (currentTimeSpan) currentTimeSpan.textContent = '0:00';
    if (durationTimeSpan) durationTimeSpan.textContent = '0:00';
    if (progressBar) { 
      progressBar.value = 0; 
      progressBar.max = 100; 
    }
    if (statusElement) statusElement.textContent = "-";
    currentGenre = 'classic';
    applyGenreColors(currentGenre);
  }

  function setupAudio(url, isFile) {
    stopAll();
    initAudioContext();
    audioElem = new Audio();
    audioElem.loop = true;
    audioElem.src = isFile ? URL.createObjectURL(url) : url;

    audioElem.onloadedmetadata = function() {
      if (durationTimeSpan) durationTimeSpan.textContent = formatTime(audioElem.duration);
      if (progressBar) progressBar.max = audioElem.duration;
      audioElem.play();
    };

    audioElem.onended = stopAll;
    sourceNode = audioCtx.createMediaElementSource(audioElem);
    sourceNode.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    animate();
  }

  function applyGenreColors(genre) {
    var g = document.querySelector('#g1');
    if (!g || !GENRE[genre]) return;
    var p = GENRE[genre];
    g.children[0].setAttribute('stop-color', p.colorA);
    g.children[1].setAttribute('stop-color', p.colorB);
  }

  // === EVENT LISTENER ===
  if (genreSelect) {
    genreSelect.onchange = function(e) {
      if (fileRadio) fileRadio.checked = false;
      currentGenre = e.target.value;
      applyGenreColors(currentGenre);
      if (statusElement) statusElement.textContent = currentGenre.toUpperCase();
      if (GENRE_SONGS[currentGenre]) setupAudio(GENRE_SONGS[currentGenre], false);
    };
  }
  applyGenreColors(currentGenre);

  // === ANIMATION ===
  function estimateBPM() {
    if (beatHistory.length < 2) return 0;
    var diffs = [];
    for (var ii = 1; ii < beatHistory.length; ii++) {
      diffs.push(beatHistory[ii] - beatHistory[ii-1]);
    }
    var avgDiff = 0;
    for (var ii = 0; ii < diffs.length; ii++) {
      avgDiff += diffs[ii];
    }
    avgDiff = avgDiff / diffs.length;
    return Math.round(60 / avgDiff);
  }

  function detectBeat(avg) {
    var now = audioCtx ? audioCtx.currentTime : 0;
    if (avg > 0.25 && now - lastPeakTime > 0.25) {
      lastPeakTime = now;
      beatHistory.push(now);
      if (beatHistory.length > 20) beatHistory.shift();
    }
  }

  function animate() {
    rafId = requestAnimationFrame(animate);
    if (!analyser || !dataArray) return;
    
    if (audioElem && !audioElem.paused) {
      if (!isSeeking && audioElem && currentTimeSpan && progressBar) {
        currentTimeSpan.textContent = formatTime(audioElem.currentTime);
        progressBar.value = audioElem.currentTime;
      }

      analyser.getByteFrequencyData(dataArray);
      
      // Bass/Mid/High/Avg Berechnung
      var bassLen = Math.min(32, dataArray.length);
      var bass = 0;
      for (var j = 0; j < bassLen; j++) { bass += dataArray[j]; }
      bass = bass / (bassLen * 255);
      
      var midEnd = Math.min(128, dataArray.length);
      var mid = 0;
      for (var k = 32; k < midEnd; k++) { mid += dataArray[k]; }
      mid = mid / ((midEnd-32) * 255);
      
      var high = 0;
      for (var l = midEnd; l < dataArray.length; l++) { high += dataArray[l]; }
      high = high / ((dataArray.length-midEnd) * 255);
      
      var avg = 0;
      for (var m = 0; m < dataArray.length; m++) { avg += dataArray[m]; }
      avg = avg / dataArray.length / 255;
      
      detectBeat(avg);
      var bpm = estimateBPM();
      
      // PFLANZENSTATUS + VISUELLE KOPPLUNG
      var plantResult = plantStatus(bass, mid, high, bpm);
      if (statusElement) {
        statusElement.textContent = plantResult.text;
        statusElement.className = plantResult.status;
      }

      var g = GENRE[currentGenre] || GENRE.classic;
      var sensValue = sensitivity ? parseFloat(sensitivity.value || "1") : 1;
      var amp = Math.min(1, avg * sensValue * g.growth * 1.4);

      // BONUS-SYSTEM
      var growthBonus = 1.0;
      if (plantResult.status === "optimal") {
        growthBonus = 1.6; // 60% MEHR Wachstum
      } else if (plantResult.status === "stress") {
        growthBonus = 0.4; // 60% WENIGER Wachstum
      } else if (plantResult.status === "warning") {
        growthBonus = 0.8; // Etwas gehemmt
      }

      // Animation MIT BONUS
      var wobble = g.wobble * Math.sin(Date.now() / (250 + g.wobble * 40));
      var rotate = amp * 32 * g.wobble - 16;
      var swayX = wobble * 12;
      var scale = 1 + amp * (0.25 + g.growth * 0.2) * growthBonus;
      var up = amp * (10 + g.growth * 16) * growthBonus;

      if (leafGroup) {
        // DIREKTE SVG-FARBUNG
        var leafColor = plantResult.status === "optimal" ? "#00ff88" : 
                        plantResult.status === "stress" ? "#ff4444" : "#ffaa00";
        
        // Faerbe Hauptgruppe + alle Kinder
        leafGroup.style.fill = leafColor;
        var children = leafGroup.children;
        for (var ii = 0; ii < children.length; ii++) {
          children[ii].style.fill = leafColor;
        }
        
        leafGroup.style.transform = 'translate(' + (100 + swayX) + 'px, ' + (110 - up) + 'px) rotate(' + rotate + 'deg) scale(' + scale + ')';
      }

      // Spektrumanalyse
      var step = Math.floor(dataArray.length / BAR_COUNT);
      for (var n = 0; n < bars.length; n++) {
        var v = dataArray[Math.floor(n * step)] / 255;
        bars[n].style.height = (8 + v * 120) + 'px';
      }
    }
  }

  // === BUTTONS ===
  if (playBtn) {
    playBtn.addEventListener('click', function() {
      if (audioElem && audioElem.paused && audioElem.src) {
        audioElem.play();
        return;
      }
      if (fileRadio && fileRadio.checked && fileInput && fileInput.files[0]) {
        if (genreSelect) genreSelect.value = "";
        setupAudio(fileInput.files[0], true);
      } else if (genreSelect && genreSelect.value && GENRE_SONGS[genreSelect.value]) {
        currentGenre = genreSelect.value;
        applyGenreColors(currentGenre);
        if (statusElement) statusElement.textContent = genreSelect.value.toUpperCase();
        setupAudio(GENRE_SONGS[currentGenre], false);
      } else {
        alert('Bitte waehle eine Audioquelle.');
      }
    });
  }

  if (pauseBtn) {
    pauseBtn.onclick = function() {
      if (audioElem) audioElem.pause();
    };
  }

  if (resetBtn) {
    resetBtn.onclick = stopAll;
  }

  if (sensitivity) {
    sensitivity.oninput = function() {
      if (sensVal) sensVal.textContent = sensitivity.value;
    };
  }

  if (volume) {
    volume.oninput = function() {
      if (gainNode) gainNode.gain.value = parseFloat(volume.value);
      if (volVal) volVal.textContent = Number(volume.value).toFixed(2);
    };
  }

  // === PROGRESS BAR ===
  if (progressBar) {
    progressBar.onmousedown = progressBar.ontouchstart = function() {
      isSeeking = true;
      if (audioElem && !audioElem.paused) audioElem.pause();
    };
    
    progressBar.oninput = function() {
      if (isSeeking && currentTimeSpan) {
        currentTimeSpan.textContent = formatTime(progressBar.value);
      }
    };
    
    progressBar.onmouseup = progressBar.ontouchend = function() {
      isSeeking = false;
      if (audioElem) {
        audioElem.currentTime = parseFloat(progressBar.value);
        if (audioElem.paused) audioElem.play();
      }
    };
  }
});
