// sketch.js (p5 Visuals für Variante B – Bass kommt aus viewer.js)

let leaves = [];
let particles = [];
const NUM_LEAVES = 5;
const NUM_PARTICLES = 50;

function setup() {
  const c = createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);

  // Optional: Canvas “hinter” dein UI legen (falls nötig)
  // c.position(0, 0);
  // c.style('position', 'fixed');
  // c.style('top', '0');
  // c.style('left', '0');
  // c.style('z-index', '0');
  // c.style('pointer-events', 'none');

  // Blätter erzeugen
  for (let i = 0; i < NUM_LEAVES; i++) {
    leaves.push({
      x: random(width * 0.2, width * 0.8),
      y: random(height * 0.5, height * 0.9),
      size: random(50, 100),
      angle: random(-15, 15),
      color: [random(50, 200), random(150, 255), random(100, 255)]
    });
  }

  // Partikel erzeugen
  for (let i = 0; i < NUM_PARTICLES; i++) {
    particles.push({
      x: random(width),
      y: random(height),
      size: random(5, 20),
      speed: random(1, 3),
      drift: random(0.3, 1.0),
      phase: random(360),
      color: [random(100, 255), random(100, 255), random(100, 255), 150]
    });
  }
}

function draw() {
  background(240, 240, 255, 40);

  // Bass aus viewer.js (0..1)
  const bass01 = (window.audioFeatures && typeof window.audioFeatures.bass === "number")
    ? window.audioFeatures.bass
    : 0;

  // Partikel animieren (optional: Bass beeinflusst Speed leicht)
  const speedBoost = map(bass01, 0, 1, 0, 2);

  particles.forEach(p => {
    p.y -= (p.speed + speedBoost * 0.3);
    p.x += sin(frameCount * p.drift + p.phase) * (1.5 + speedBoost * 0.2);

    if (p.y < -p.size) p.y = height + p.size;

    noStroke();
    fill(...p.color);
    const s = p.size * (1 + bass01 * 0.4); // optional: etwas “pumpen”
    ellipse(p.x, p.y, s);
  });

  // Blätter (Bass-Reaktion)
  leaves.forEach(l => {
    push();
    translate(l.x, l.y);

    const shake = map(bass01, 0, 1, -10, 10);
    rotate(l.angle + shake);

    fill(...l.color);
    noStroke();

    beginShape();
    vertex(0, 0);
    bezierVertex(-l.size / 2, -l.size, l.size / 2, -l.size, 0, 0);
    endShape(CLOSE);

    pop();
  });

  // Optional: kleines Debug-Overlay
  // fill(0); noStroke(); textSize(14);
  // text("bass: " + bass01.toFixed(2), 20, 30);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
