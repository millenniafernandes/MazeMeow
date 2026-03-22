const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const gridSize = 40;
const cols = 9;
const rows = 8;
const offsetY = 40; // Scoreboard area
const canvasWidth = cols * gridSize;
const canvasHeight = rows * gridSize + offsetY;

let cat = { col: 1, row: 1 };
let train = { col: 0, row: rows - 1 };
let office = { col: cols - 1, row: rows - 1 };
let stage = "maze";
let score = 0;

let trainX = train.col * gridSize;
let trainY = offsetY + train.row * gridSize;
let popupText = "";
let popupTimeout = null;

let flowers = [];
const flowerEmojis = ["🌻", "🌼", "🌸", "🌺"];

let hWalls = [];
let vWalls = [];

// Build a maze with many possible routes (free roam)
function initMaze() {
  hWalls = Array.from({ length: rows + 1 }, () => Array(cols).fill(true));
  vWalls = Array.from({ length: rows }, () => Array(cols + 1).fill(true));

  // Keep outer border closed, randomize interior walls for free roam.
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      hWalls[r][c] = Math.random() > 0.33; // ~67% walls
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 1; c < cols; c++) {
      vWalls[r][c] = Math.random() > 0.33;
    }
  }

  function openEdge(a, b) {
    if (a.col === b.col && a.row !== b.row) {
      const minRow = Math.min(a.row, b.row);
      hWalls[minRow + 1][a.col] = false;
    } else if (a.row === b.row && a.col !== b.col) {
      const minCol = Math.min(a.col, b.col);
      vWalls[a.row][minCol + 1] = false;
    }
  }

  function carvePath(from, to) {
    let current = { col: from.col, row: from.row };
    while (current.col !== to.col || current.row !== to.row) {
      const options = [];
      if (current.col < to.col) options.push({ col: current.col + 1, row: current.row });
      if (current.col > to.col) options.push({ col: current.col - 1, row: current.row });
      if (current.row < to.row) options.push({ col: current.col, row: current.row + 1 });
      if (current.row > to.row) options.push({ col: current.col, row: current.row - 1 });

      if (Math.random() < 0.25) {
        const alt = [];
        if (current.col > 0) alt.push({ col: current.col - 1, row: current.row });
        if (current.col < cols - 1) alt.push({ col: current.col + 1, row: current.row });
        if (current.row > 0) alt.push({ col: current.col, row: current.row - 1 });
        if (current.row < rows - 1) alt.push({ col: current.col, row: current.row + 1 });
        if (alt.length) options.push(alt[Math.floor(Math.random() * alt.length)]);
      }

      const next = options[Math.floor(Math.random() * options.length)];
      openEdge(current, next);
      current = next;
    }
  }

  carvePath(cat, train); // guarantee route to train
  carvePath(train, office); // optional path to office, not required by movement but good for continuity

  function getReachableCells() {
    const visited = new Set();
    const stack = [{ col: cat.col, row: cat.row }];
    visited.add(`${cat.col},${cat.row}`);

    while (stack.length) {
      const { col, row } = stack.pop();

      // Up
      if (row > 0 && !hWalls[row][col]) {
        const key = `${col},${row - 1}`;
        if (!visited.has(key)) {
          visited.add(key);
          stack.push({ col, row: row - 1 });
        }
      }
      // Down
      if (row < rows - 1 && !hWalls[row + 1][col]) {
        const key = `${col},${row + 1}`;
        if (!visited.has(key)) {
          visited.add(key);
          stack.push({ col, row: row + 1 });
        }
      }
      // Left
      if (col > 0 && !vWalls[row][col]) {
        const key = `${col - 1},${row}`;
        if (!visited.has(key)) {
          visited.add(key);
          stack.push({ col: col - 1, row });
        }
      }
      // Right
      if (col < cols - 1 && !vWalls[row][col + 1]) {
        const key = `${col + 1},${row}`;
        if (!visited.has(key)) {
          visited.add(key);
          stack.push({ col: col + 1, row });
        }
      }
    }

    return visited;
  }

  // Place flowers randomly on reachable cells only
  const reachable = Array.from(getReachableCells()).map((s) => {
    const [x, y] = s.split(",").map(Number);
    return { x, y };
  });

  flowers = [];
  while (flowers.length < 8 && reachable.length > 0) {
    const pickIndex = Math.floor(Math.random() * reachable.length);
    const cell = reachable.splice(pickIndex, 1)[0];

    if ((cell.x === cat.col && cell.y === cat.row) ||
        (cell.x === train.col && cell.y === train.row) ||
        (cell.x === office.col && cell.y === office.row)) continue;

    flowers.push({ x: cell.x, y: cell.y, emoji: flowerEmojis[Math.floor(Math.random() * flowerEmojis.length)] });
  }
}


// Detect if movement from current cat position in direction is blocked
function canMove(direction) {
  if (direction === "up") {
    if (cat.row === 0) return false;
    return !hWalls[cat.row][cat.col];
  }
  if (direction === "down") {
    if (cat.row === rows - 1) return false;
    return !hWalls[cat.row + 1][cat.col];
  }
  if (direction === "left") {
    if (cat.col === 0) return false;
    return !vWalls[cat.row][cat.col];
  }
  if (direction === "right") {
    if (cat.col === cols - 1) return false;
    return !vWalls[cat.row][cat.col + 1];
  }
  return false;
}

function moveCat(direction) {
  if (stage !== "maze") return;
  if (!canMove(direction)) return;

  if (direction === "up") cat.row -= 1;
  if (direction === "down") cat.row += 1;
  if (direction === "left") cat.col -= 1;
  if (direction === "right") cat.col += 1;

  checkCollision();
}

function showPopup(text, duration = 1200) {
  popupText = text;
  const popup = document.getElementById("popup");
  if (popup) {
    popup.innerText = text;
    popup.classList.remove("hidden");
  }

  if (popupTimeout) clearTimeout(popupTimeout);
  popupTimeout = setTimeout(() => {
    popupText = "";
    if (popup) popup.classList.add("hidden");
  }, duration);
}

function checkCollision() {
  flowers = flowers.filter((flower) => {
    if (flower.x === cat.col && flower.y === cat.row) {
      score += 10;
      return false;
    }
    return true;
  });

  if (flowers.length === 0) {
    showPopup("All flowers collected! Go to the train at bottom.", 1400);
  }

  if (flowers.length === 0 && cat.col === train.col && cat.row === train.row && stage === "maze") {
    stage = "train";
    showPopup("Choo Choo, the train started.", 1200);
    setTimeout(() => {
      animateTrain();
    }, 1200);
  }
}

function animateTrain() {
  trainX = train.col * gridSize;
  trainY = offsetY + train.row * gridSize;
  const targetX = office.col * gridSize;
  const speed = 4;
  const direction = targetX > trainX ? 1 : -1;

  const interval = setInterval(() => {
    trainX += speed * direction;

    if ((direction > 0 && trainX >= targetX) || (direction < 0 && trainX <= targetX)) {
      trainX = targetX;
      clearInterval(interval);
      stage = "office";
      showPopup("🐱 Millimeow reached office! 🏢 Final Score: " + score, 1800);
    }

    draw();
  }, 20);
}

function draw() {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Scoreboard
  ctx.fillStyle = "rgba(100, 150, 200, 0.9)";
  ctx.fillRect(0, 0, canvasWidth, offsetY);
  ctx.fillStyle = "white";
  ctx.font = "bold 20px Arial";
  ctx.fillText("💰 Score: " + score, 20, 28);

  // Maze walls
  ctx.strokeStyle = "black";
  ctx.lineWidth = 6;

  // horiz
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (hWalls[r][c]) {
        const y = offsetY + r * gridSize;
        ctx.beginPath();
        ctx.moveTo(c * gridSize, y);
        ctx.lineTo((c + 1) * gridSize, y);
        ctx.stroke();
      }
    }
  }

  // vert
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols; c++) {
      if (vWalls[r][c]) {
        const x = c * gridSize;
        const y1 = offsetY + r * gridSize;
        const y2 = offsetY + (r + 1) * gridSize;
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.stroke();
      }
    }
  }

  // Draw flowers
  ctx.font = "24px Arial";
  flowers.forEach((flower) => {
    const px = flower.x * gridSize + 8;
    const py = offsetY + flower.y * gridSize + 30;
    ctx.fillText(flower.emoji, px, py);
  });

  // Draw player
  if (stage === "maze") {
    ctx.font = "32px Arial";
    const px = cat.col * gridSize + 6;
    const py = offsetY + cat.row * gridSize + 30;
    ctx.fillText("🐱", px, py);
  }

  // draw train and office
  ctx.font = "32px Arial";
  let drawTrainX = trainX;
  let drawTrainY = trainY;
  if (stage === "maze") {
    drawTrainX = train.col * gridSize;
    drawTrainY = offsetY + train.row * gridSize;
  }

  ctx.fillText("🚆", drawTrainX + 6, drawTrainY + 30);
  ctx.fillText("🏢", office.col * gridSize + 6, offsetY + office.row * gridSize + 30);
}

function setupInput() {
  document.addEventListener("keydown", (e) => {
    const mapping = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    if (mapping[e.key]) {
      e.preventDefault();
      moveCat(mapping[e.key]);
    }
  });

  ["upBtn", "downBtn", "leftBtn", "rightBtn"].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const dir = id.replace("Btn", "");
    btn.addEventListener("click", () => moveCat(dir));
    btn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      moveCat(dir);
    }, { passive: false });
  });

  let touchStartX = null;
  let touchStartY = null;

  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  canvas.addEventListener("touchend", (e) => {
    if (touchStartX === null || touchStartY === null) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
      if (Math.abs(dx) > Math.abs(dy)) {
        moveCat(dx > 0 ? "right" : "left");
      } else {
        moveCat(dy > 0 ? "down" : "up");
      }
    }

    touchStartX = null;
    touchStartY = null;
  }, { passive: true });
}

function gameLoop() {
  draw();
  requestAnimationFrame(gameLoop);
}

initMaze();
setupInput();
canvas.width = canvasWidth;
canvas.height = canvasHeight;
gameLoop();