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
  const micRadio = document.getElementById('micRadio');
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
    analyser.connect(audioCtx.destination);
    animate();
  }

  async function startFromMic() {
    stopAll();
    initAudioContext();
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      sourceNode = audioCtx.createMediaStreamSource(stream);
      sourceNode.connect(analyser);
      animate();
    } catch (e) {
      alert('Mikrofonzugriff verweigert.');
    }
  }

  function stopAll() {
    if (rafId) cancelAnimationFrame(rafId);
    if (audioElem) { audioElem.pause(); audioElem.src = ''; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); }
    leafGroup.style.transform = 'translate(100px,110px) rotate(0) scale(1)';
    bars.forEach(b => b.style.height = '8px');
  }

  // GENRE Parameter
  const GENRE = {
    classic: { growth: 0.4, wobble: 0.2, colorA: "#98edc1", colorB: "#52b5e6" },
    rock:    { growth: 1.2, wobble: 1.4, colorA: "#28ff00", colorB: "#005eff" },
    electro: { growth: 0.9, wobble: 1.8, colorA: "#ff00ff", colorB: "#00ffff" },
    ambient: { growth: 0.2, wobble: 0.1, colorA: "#d7ffb2", colorB: "#9edbb7" }
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

  function animate() {
    rafId = requestAnimationFrame(animate);

    analyser.getByteFrequencyData(dataArray);

    let avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
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
    if (fileRadio.checked) {
      if (!fileInput.files[0]) return alert('Bitte Audiodatei wählen.');
      await startFromFile(fileInput.files[0]);
    } else {
      await startFromMic();
    }
  };

  stopBtn.onclick = stopAll;
  sensitivity.oninput = () => sensVal.textContent = sensitivity.value;

});
