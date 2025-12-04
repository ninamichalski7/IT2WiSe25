// p5-sketch.js

let mic, fft;
let leaves = [];
let particles = [];
const NUM_LEAVES = 5;
const NUM_PARTICLES = 50;

function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);

  // -----------------------------
  // Audio Setup (fix für Chrome)
  // -----------------------------
  mic = new p5.AudioIn();
  mic.start(() => {
    console.log("Microphone ready.");
  });

  fft = new p5.FFT(0.8, 1024);
  fft.setInput(mic);

  // -----------------------------
  // Blätter erzeugen
  // -----------------------------
  for (let i = 0; i < NUM_LEAVES; i++) {
    leaves.push({
      x: random(width * 0.2, width * 0.8),
      y: random(height * 0.5, height * 0.9),
      size: random(50, 100),
      angle: random(-15, 15),
      color: [
        random(50, 200),
        random(150, 255),
        random(100, 255)
      ]
    });
  }

  // -----------------------------
  // Partikel erzeugen
  // -----------------------------
  for (let i = 0; i < NUM_PARTICLES; i++) {
    particles.push({
      x: random(width),
      y: random(height),
      size: random(5, 20),
      speed: random(1, 3),
      drift: random(0.3, 1.0),
      phase: random(360),
      color: [
        random(100, 255),
        random(100, 255),
        random(100, 255),
        150
      ]
    });
  }
}

function draw() {
  background(240, 240, 255, 40);

  // -----------------------------
  // FFT-Daten holen
  // -----------------------------
  let spectrum = fft.analyze();
  let bass = fft.getEnergy("bass") || 0; // fallback schützt vor NaN

  // -----------------------------
  // Partikel animieren
  // -----------------------------
  particles.forEach(p => {
    p.y -= p.speed;
    p.x += sin(frameCount * p.drift + p.phase) * 1.5;

    if (p.y < -p.size) p.y = height + p.size;

    noStroke();
    fill(...p.color);
    ellipse(p.x, p.y, p.size);
  });

  // -----------------------------
  // Blätter zeichnen (Bass-Reaktion)
  // -----------------------------
  leaves.forEach(l => {
    push();
    translate(l.x, l.y);

    let shake = map(bass, 0, 255, -10, 10);
    rotate(l.angle + shake);

    fill(...l.color);
    noStroke();

    beginShape();
    vertex(0, 0);
    bezierVertex(
      -l.size / 2, -l.size,
       l.size / 2, -l.size,
       0, 0
    );
    endShape(CLOSE);

    pop();
  });
}

// -----------------------------
// Canvas mit Fenstergröße anpassen
// -----------------------------
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
