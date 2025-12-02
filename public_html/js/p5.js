// p5.js mit WebRTC-Streaming 
let mic, fft;
let leaves = [];
let particles = [];
const NUM_LEAVES = 5;
const NUM_PARTICLES = 50;
let liveMedia; 
let remoteVideo; // Für den Stream 

function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);

  // Audio einrichten 
  mic = new p5.AudioIn();
  mic.start();
  fft = new p5.FFT();
  fft.setInput(mic);

  // Blätter erstellen 
  for (let i = 0; i < NUM_LEAVES; i++) {
    leaves.push({
      x: random(width * 0.2, width * 0.8),
      y: random(height * 0.5, height * 0.9),
      size: random(50, 100),
      angle: random(-15, 15),
      color: [random(50, 200), random(150, 255), random(100, 255)]
    });
  }

  // Partikel erstellen 
  for (let i = 0; i < NUM_PARTICLES; i++) {
    particles.push({
      x: random(width),
      y: random(height),
      size: random(5, 20),
      speed: random(1, 3),
      color: [random(100, 255), random(100, 255), random(100, 255), 150]
    });
  }

  // WebRTC einrichten mit p5LiveMedia 
  liveMedia = new p5LiveMedia(this, "CAPTURE", null, "https://your-signaling-server.com"); 
  liveMedia.on('stream', gotStream); // Callback, wenn ein Stream empfangen wird (für Zuschauer)

  // Starte das Streaming des Canvas + Audio
  liveMedia.addLocalMedia({ audio: true, video: { facingMode: "user" } }); // Hier audio: true für Mikrofon/Synth
}

function draw() {
  background(240, 240, 255, 50);

  // FFT-Daten holen 
  let spectrum = fft.analyze();
  let bass = fft.getEnergy("bass"); // Wert von 0-255

  // Partikel zeichnen (Kasia)
  particles.forEach(p => {
    p.y -= p.speed;
    p.x += sin(frameCount * 0.05) * 1.5;
    if (p.y < -p.size) p.y = height + p.size;
    noStroke();
    fill(...p.color);
    ellipse(p.x, p.y, p.size);
  });

  // Blätter zeichnen und auf Audio reagieren 
  leaves.forEach(l => {
    push();
    translate(l.x, l.y);
    rotate(l.angle + map(bass, 0, 255, -10, 10)); // Blätter wackeln bei Bass
    fill(...l.color);
    noStroke();
    beginShape();
    vertex(0, 0);
    bezierVertex(-l.size / 2, -l.size, l.size / 2, -l.size, 0, 0);
    endShape(CLOSE);
    pop();
  });

  // Der Canvas wird automatisch als Stream gesendet via p5LiveMedia
}

// Callback für empfangenen Stream 
function gotStream(stream, id) {
  remoteVideo = createVideo();
  remoteVideo.elt.srcObject = stream; // Zeige den empfangenen Stream (Audio + Visuals)
  remoteVideo.size(640, 480); // Passe an
  remoteVideo.position(0, 0); // Positioniere im Sketch
  remoteVideo.play();
}

// Fenstergröße anpassen 
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}