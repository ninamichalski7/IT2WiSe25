// JavaScript Document

const audio = document.getElementById("audio");
const svg = document.getElementById("blatt");

// Web Audio API Setup
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const source = audioContext.createMediaElementSource(audio);
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;

source.connect(analyser);
analyser.connect(audioContext.destination);

const dataArray = new Uint8Array(analyser.frequencyBinCount);

// Animation Loop
function animate() {
  requestAnimationFrame(animate);
  analyser.getByteFrequencyData(dataArray);

  // Durchschnittliche Lautstärke berechnen
  const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

  // Mappe Lautstärke auf Skalierung (z. B. 0.9 bis 1.2)
  const scale = 0.9 + (average / 255) * 0.3;

  // Leichte Rotation dazu (optional)
  const rotation = (average / 255) * 10 - 5; // zwischen -5° und +5°

  // Transformation anwenden
  svg.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
}

// Erst starten, wenn Audio läuft
audio.addEventListener("play", () => {
  audioContext.resume().then(() => {
    animate();
  });
});
 
    console.log("Blatt und Audio geladen");