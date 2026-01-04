/* global Peer */
/* eslint no-undef: "off" */

document.addEventListener('DOMContentLoaded', function() {
  
  /* KONFIGURATION */
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

  /* DOM ELEMENTE */
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

  /* PARTICLES ERSTELLEN */
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

  /* BARS ERSTELLEN */
  var BAR_COUNT = 24;
  var bars = [];
  if (barsContainer) {
    for (var iii = 0; iii < BAR_COUNT; iii++) {
      var b = document.createElement('div');
      b.className = 'bar';
      barsContainer.appendChild(b);
      bars.push(b);
    }
  }

  /* GLOBALE VARIABLEN */
  var isSeeking = false;
  var audioCtx = null, analyser = null, dataArray = null;
  var sourceNode = null, audioElem = null, rafId = null;
  var stream = null, gainNode = null;
  var currentGenre = "classic";
  var currentSourceType = "none";
  var beatHistory = [];
  var lastPeakTime = 0;
  var statusHistory = [];
  var STATUS_WINDOW = 30;
  var localStream = null;
  var peer = null;
  var currentCall = null;
  var isStreaming = false;

  /* Pflanzenstatus */
  function plantStatus(bass, mid, high, bpm) {
    if (currentGenre === "techno" && (bass > 0.45 || bpm > 130)) {
      return { text: "Techno zu aggressiv für Blüten", status: "stress" };
    }
    if (high > 0.70) return { text: "Hohe Frequenzen schaden Blüten", status: "stress" };
    if (bpm > 140) return { text: "Zu schnell - Pflanze überfordert", status: "stress" };
    if (bass > 0.65) return { text: "Basslastig – Wurzeln überfordert", status: "stress" };
    if (mid > 0.45 || (bpm < 140)) return { text: "Sanfte Töne - optimal für Wachstum", status: "optimal" };
    return { text: "Zu ruhig - wenig Wachstum", status: "warning" };
  }

  /* Zeit formatieren */
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return '0:00';
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' + s : s);
  }

  /* AudioContext */
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

  /* Alles zurücksetzen */
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
      leafGroup.style.fill = "#ffaa00";
      var children = leafGroup.children;
      for (var ii = 0; ii < children.length; ii++) {
        children[ii].style.fill = "#ffaa00";
      }
      leafGroup.style.transform = 'translate(100px,110px) rotate(0) scale(1)';
    }
    
    for (var iiii = 0; iiii < bars.length; iiii++) {
      bars[iiii].style.height = '8px';
    }
    
    if (currentTimeSpan) currentTimeSpan.textContent = '0:00';
    if (durationTimeSpan) durationTimeSpan.textContent = '0:00';
    if (progressBar) { 
      progressBar.value = 0; 
      progressBar.max = 100; 
    }
    if (statusElement) statusElement.textContent = "-";
    
    currentGenre = 'classic';
    currentSourceType = "none";
    applyGenreColors(currentGenre);
  }

  /* AUDIO SETUP */
  function setupAudio(url, isFile) {
    currentSourceType = 'genre';
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

  /* === MIKROFON STREAM TOGGLE === */
  function toggleMicrophoneStream() {
    if (isStreaming) {
      stopMicrophoneStream();
    } else {
      startMicrophoneStream();
    }
  }

  function startMicrophoneStream() {
    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 44100,
        channelCount: 1
      }
    }).then(function(stream) {
      localStream = stream;
      currentSourceType = 'mic';
      
      peer = new Peer();
      
      peer.on('open', function(id) {
        document.getElementById('peerIdDisplay').textContent = id;
        document.getElementById('peerIdDisplay').style.display = 'block';
        updateStreamStatus("🟢 LIVE - Peer-ID: Kopiere für Zuschauer");
      });
      
      peer.on('call', function(call) {
        currentCall = call;
        call.answer(localStream);
        updateStreamStatus("🟢 Zuschauer verbunden!");
      });
      
      if (!audioCtx) initAudioContext();
      var micSource = audioCtx.createMediaStreamSource(localStream);
      if (sourceNode) sourceNode.disconnect();
      sourceNode = micSource;
      sourceNode.connect(analyser);
      
      isStreaming = true;
      document.getElementById('startBroadcastBtn').innerHTML = '⏹️ Stream stoppen';
      
    }).catch(function(err) {
      alert("Mikrofon Fehler: " + err.message + "\nTipp: Mikrofon freigeben!");
    });
  }

  function stopMicrophoneStream() {
    if (localStream) {
      localStream.getTracks().forEach(function(track) { 
        track.stop(); 
      });
      localStream = null;
    }
    if (currentCall) {
      currentCall.close();
      currentCall = null;
    }
    if (peer) {
      peer.destroy();
      peer = null;
    }
    
    isStreaming = false;
    document.getElementById('startBroadcastBtn').innerHTML = '⏺️ Live streamen';
    document.getElementById('peerIdDisplay').style.display = 'none';
    updateStreamStatus("Stream: Gestoppt");
  }

  function updateStreamStatus(text) {
    var statusEl = document.getElementById('streamStatus');
    if (statusEl) statusEl.textContent = text;
  }

  /* === GENRE FARBEN ANWENDEN === */
  function applyGenreColors(genre) {
    var g = document.querySelector('#g1');
    if (!g || !GENRE[genre]) return;
    var p = GENRE[genre];
    g.children[0].setAttribute('stop-color', p.colorA);
    g.children[1].setAttribute('stop-color', p.colorB);
  }

  /* BPM SCHÄTZEN */
  function estimateBPM() {
    if (beatHistory.length < 2) return 0;
    var diffs = [];
    for (var ii = 1; ii < beatHistory.length; ii++) {
      diffs.push(beatHistory[ii] - beatHistory[ii-1]);
    }
    var avgDiff = diffs.reduce(function(a, b) { return a + b; }, 0) / diffs.length;
    return Math.round(60 / avgDiff);
  }

  /* Beat erkennen */
  function detectBeat(avg) {
    var now = audioCtx ? audioCtx.currentTime : 0;
    if (avg > 0.25 && now - lastPeakTime > 0.25) {
      lastPeakTime = now;
      beatHistory.push(now);
      if (beatHistory.length > 20) beatHistory.shift();
    }
  }

  /* Hauptanimation */
  function animate() {
    rafId = requestAnimationFrame(animate);
    if (!analyser || !dataArray || (!audioElem && !sourceNode)) return;
    
    if (!isSeeking && currentTimeSpan && progressBar && audioElem) {
      currentTimeSpan.textContent = formatTime(audioElem.currentTime);
      progressBar.value = audioElem.currentTime;
    }

    analyser.getByteFrequencyData(dataArray);
    
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
    var plantResult = plantStatus(bass, mid, high, bpm);
    
    /* Status update mit Quelle */
    if (statusElement) {
      statusElement.textContent = plantResult.text + " (" + currentSourceType + ")";
      statusElement.className = plantResult.status;
    }
    
    statusHistory.push(plantResult.status);
    if (statusHistory.length > STATUS_WINDOW) statusHistory.shift();

    var optimalCount = statusHistory.filter(function(s) { return s === "optimal"; }).length;
    var stabilityPct = Math.round((optimalCount / Math.max(1, statusHistory.length)) * 100);

    var stabilityFill = document.getElementById('stabilityFill');
    var stabilityText = document.getElementById('stabilityText');
    if (stabilityFill && stabilityText) {
      stabilityFill.style.width = stabilityPct + '%';
      stabilityText.textContent = 'Stabilität: ' + stabilityPct + '%';
      
      if (stabilityPct >= 70) {
        stabilityFill.style.background = 'linear-gradient(90deg,#10b981,#34d399)';
        stabilityFill.style.boxShadow = '0 0 10px rgba(16,185,129,0.5)';
      } else if (stabilityPct >= 35) {
        stabilityFill.style.background = 'linear-gradient(90deg,#f59e0b,#fbbf24)';
        stabilityFill.style.boxShadow = '0 0 10px rgba(245,158,11,0.5)';
      } else {
        stabilityFill.style.background = 'linear-gradient(90deg,#ef4444,#f87171)';
        stabilityFill.style.boxShadow = '0 0 10px rgba(239,68,68,0.5)';
      }
    }

    var g = GENRE[currentGenre] || GENRE.classic;
    var sensValue = sensitivity ? parseFloat(sensitivity.value || "1") : 1;
    var amp = Math.min(1, avg * sensValue * g.growth * 1.4);

    var growthBonus = 1.0;
    if (plantResult.status === "optimal") growthBonus = 1.6;
    else if (plantResult.status === "stress") growthBonus = 0.4;
    else if (plantResult.status === "warning") growthBonus = 0.8;

    var wobble = g.wobble * Math.sin(Date.now() / (250 + g.wobble * 40));
    var rotate = amp * 32 * g.wobble - 16;
    var swayX = wobble * 12;
    var scale = 1 + amp * (0.25 + g.growth * 0.2) * growthBonus;
    var up = amp * (10 + g.growth * 16) * growthBonus;

    if (leafGroup) {
      var leafColor = plantResult.status === "optimal" ? "#00ff88" : 
                      plantResult.status === "stress" ? "#ff4444" : "#ffaa00";
      
      leafGroup.style.fill = leafColor;
      var children = leafGroup.children;
      for (var ii = 0; ii < children.length; ii++) {
        children[ii].style.fill = leafColor;
      }
      
      leafGroup.style.transform = 'translate(' + (100 + swayX) + 'px, ' + (110 - up) + 'px) rotate(' + rotate + 'deg) scale(' + scale + ')';
    }

    var step = Math.floor(dataArray.length / BAR_COUNT);
    for (var n = 0; n < bars.length; n++) {
      var v = dataArray[Math.floor(n * step)] / 255;
      bars[n].style.height = (8 + v * 120) + 'px';
    }
  }

  /* EVENT HANDLER */
  if (playBtn) {
    playBtn.addEventListener('click', function() {
      if (audioElem && audioElem.paused && audioElem.src) {
        audioElem.play();
        return;
      }
      
      if (fileRadio && fileRadio.checked && fileInput && fileInput.files[0]) {
        if (genreSelect) genreSelect.value = "";
        currentSourceType = 'file';
        setupAudio(fileInput.files[0], true);
      }
      else if (genreSelect && genreSelect.value && GENRE_SONGS[genreSelect.value]) {
        currentGenre = genreSelect.value;
        currentSourceType = 'genre';
        applyGenreColors(currentGenre);
        if (statusElement) statusElement.textContent = genreSelect.value.toUpperCase();
        setupAudio(GENRE_SONGS[currentGenre], false);
      } 
      else {
        alert('Bitte wähle eine Audioquelle.');
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

  if (progressBar) {
    var handleStart = function() {
      isSeeking = true;
      if (audioElem && !audioElem.paused) audioElem.pause();
    };
    
    var handleMove = function() {
      if (isSeeking && currentTimeSpan) {
        currentTimeSpan.textContent = formatTime(progressBar.value);
      }
    };
    
    var handleEnd = function() {
      isSeeking = false;
      if (audioElem) {
        audioElem.currentTime = parseFloat(progressBar.value);
        if (audioElem.paused) audioElem.play();
      }
    };
    
    progressBar.onmousedown = progressBar.ontouchstart = handleStart;
    progressBar.oninput = handleMove;
    progressBar.onmouseup = progressBar.ontouchend = handleEnd;
  }

  if (genreSelect) {
    genreSelect.onchange = function(e) {
      if (fileRadio) fileRadio.checked = false;
      currentGenre = e.target.value;
      applyGenreColors(currentGenre);
      if (statusElement) statusElement.textContent = currentGenre.toUpperCase();
      if (GENRE_SONGS[currentGenre]) setupAudio(GENRE_SONGS[currentGenre], false);
    };
  }

  /* === STREAM BUTTON === */
  var broadcastBtn = document.getElementById('startBroadcastBtn');
  if (broadcastBtn) {
    broadcastBtn.addEventListener('click', toggleMicrophoneStream);
  }

  /* === ZUSCHAUER AUTO-CONNECT === */
  function connectAsViewer() {
    var peerId = window.location.hash.slice(1);
    if (peerId && !isStreaming) {
      currentSourceType = 'remoteMic';
      updateStreamStatus("🔄 Verbinde mit Streamer...");
      
      var PeerClass = (typeof Peer !== 'undefined') ? Peer : null;
      if (!PeerClass) {
        updateStreamStatus("PeerJS nicht verfügbar");
        return;
      }
      
      peer = new PeerClass();
      
      peer.on('open', function() {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function(viewerStream) {
          var call = peer.call(peerId, viewerStream);
          
          call.on('stream', function(remoteStream) {
            if (!audioCtx) initAudioContext();
            var remoteSource = audioCtx.createMediaStreamSource(remoteStream);
            if (sourceNode) sourceNode.disconnect();
            sourceNode = remoteSource;
            sourceNode.connect(analyser);
            
            updateStreamStatus("✅ Mit Streamer verbunden");
            isStreaming = true;
            animate();
          });
        }).catch(function(err) {
          updateStreamStatus("Viewer Fehler: " + err.message);
        });
      });
    }
  }

  applyGenreColors(currentGenre);
  connectAsViewer();
});
