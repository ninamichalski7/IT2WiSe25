// viewer.js 

var peer = null;
var call = null;

var audioCtx = null;
var analyser = null;
var dataArray = null;
var sourceNode = null;
var rafId = null;



function createSilentAudioStream() {
  var AudioContextClass = window.AudioContext || window.webkitAudioContext;
  var ctx = new AudioContextClass();

  // Stummer Oscillator (Gain = 0)
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  gain.gain.value = 0;

  var dest = ctx.createMediaStreamDestination();
  osc.connect(gain);
  gain.connect(dest);
  osc.start();

  return { stream: dest.stream, ctx: ctx, osc: osc };
}

function $(id) { return document.getElementById(id); }

function setStatus(txt) {
  var el = $("viewerStatus");
  if (el) el.textContent = "Status: " + txt;
}


function initAudioGraphFromStream(mediaStream) {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
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


function startAnimation() {
  if (rafId) cancelAnimationFrame(rafId);

  var leafGroup = $("leafGroup");

  function animate() {
    rafId = requestAnimationFrame(animate);
    if (!analyser || !dataArray) return;

    analyser.getByteFrequencyData(dataArray);

    // Bass-Energie (0..1)
    var bassLen = Math.min(32, dataArray.length);
    var bass = 0;
    for (var i = 0; i < bassLen; i++) bass += dataArray[i];
    bass = bass / (bassLen * 255);  
	/* Visuals global verfügbar machen */
	window.audioFeatures = window.audioFeatures || {};
	window.audioFeatures.bass = bass;
	/* mid/high simple */
	var midStart = Math.min(32, dataArray.length);
	var midEnd = Math.min(128, dataArray.length);

	var mid = 0;
	for (var m = midStart; m < midEnd; m++) mid += dataArray[m];
	mid = mid / (Math.max(1, (midEnd - midStart)) * 255);

	var high = 0;
	for (var h = midEnd; h < dataArray.length; h++) high += dataArray[h];
	high = high / (Math.max(1, (dataArray.length - midEnd)) * 255);

	window.audioFeatures.mid = mid;
	window.audioFeatures.high = high;



    // Leaf Animation
    if (leafGroup) {
      var swayX = (bass - 0.5) * 20;
      var up = bass * 25;
      var rotate = (bass - 0.5) * 10;
      var scale = 1 + bass * 0.15;

      // keine Backticks -> String-Konkatenation
      leafGroup.style.transform =
        "translate(" + (100 + swayX) + "px, " + (10 - up) + "px) " +
        "rotate(" + rotate + "deg) " +
        "scale(" + scale + ")";

      var col = Math.floor(120 + bass * 100);
      var leafColor = "rgb(50," + col + ",80)";

      // kein for..of -> klassischer Loop
      var kids = leafGroup.children;
      for (var k = 0; k < kids.length; k++) {
        if (kids[k].tagName && kids[k].tagName.toLowerCase() === "path") {
          kids[k].style.fill = leafColor;
        }
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
    peer = new Peer({
  host: location.hostname,
  port: 9000,
  path: "/peerjs"
});


    peer.on("open", function () {
      setStatus("Viewer bereit. Verbinde…");
      startCall(hostPeerId);
    });

    peer.on("error", function (err) {
      console.error(err);
      setStatus("Peer Fehler: " + ((err && (err.type || err.message)) || "unbekannt"));
    });
  } else {
    startCall(hostPeerId);
  }
}

function startCall(hostPeerId) {
  setStatus("Rufe Host an…");

var silent = createSilentAudioStream();

// Wichtig: manche Browser starten AudioContext erst nach User-Geste (dein Klick zählt)
if (silent.ctx && silent.ctx.state === "suspended") {
  silent.ctx.resume();
}

call = peer.call(hostPeerId, silent.stream);


  if (!call) {
    setStatus("Call konnte nicht gestartet werden.");
    return;
  }

  call.on("stream", function (remoteStream) {
    setStatus("✅ Verbunden – Stream empfangen.");

    var audioEl = $("remoteAudio");
    if (audioEl) {
      audioEl.srcObject = remoteStream;
      var p = audioEl.play();
      if (p && p.catch) {
        p.catch(function () {
          setStatus("Audio Autoplay blockiert – bitte einmal klicken.");
        });
      }
    }

    initAudioGraphFromStream(remoteStream);
  });

  call.on("close", function () {
    setStatus("Verbindung geschlossen.");
  });

  call.on("error", function (err) {
    console.error(err);
    setStatus("Call Fehler: " + ((err && (err.type || err.message)) || "unbekannt"));
  });
}

document.addEventListener("DOMContentLoaded", function () {

  var btn = $("connectBtn");
  if (btn) {
    btn.addEventListener("click", function () {
      var hostIdEl = $("hostPeerId");
      var hostId = hostIdEl ? hostIdEl.value.trim() : "";
      connectToHost(hostId);
    });
  }
});
