(() => {
  "use strict";
  const canvas = document.getElementById("playfield");
  const ctx = canvas.getContext("2d");
  const ui = {
    lives: document.getElementById("lives"), score: document.getElementById("score"), time: document.getElementById("time"),
    startOverlay: document.getElementById("start-overlay"), resultOverlay: document.getElementById("result-overlay"),
    start: document.getElementById("start-button"), replay: document.getElementById("replay-button"),
    resultTitle: document.getElementById("result-title"), resultMessage: document.getElementById("result-message"),
    finalGood: document.getElementById("final-good"), finalChaos: document.getElementById("final-chaos"), finalPercent: document.getElementById("final-percent"), secret: document.getElementById("secret-note")
  };
  const W = 860, H = 500, DURATION = 45;
  const goodItems = ["❤️", "☕", "🍿", "🎁", "🫂", "✈️", "🍕", "😴"];
  const goodLabels = ["любовь", "кофе", "кино", "подарок", "обнимашка", "поездка", "пицца", "отдых"];
  const badItems = ["💸", "📱", "⏰", "🧹", "🫠"];
  const badLabels = ["расход", "работа", "подъём", "уборка", "усталость"];
  let state = "menu", lastFrame = 0, elapsed = 0, timeLeft = DURATION, score = 0, lives = 3, goodCaught = 0, chaosCaught = 0, goodMissed = 0;
  let spawnClock = 0, items = [], particles = [], stars = [], keys = new Set(), lastSecond = -1;
  let player = { x: W / 2, targetX: W / 2, y: H - 58, radius: 27, blink: 0, bounce: 0 };
  let shake = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * ratio), height = Math.round(rect.height * ratio);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    ctx.setTransform(width / W, 0, 0, height / H, 0, 0);
  }
  function makeStars() {
    stars = Array.from({ length: 48 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.6 + .3, a: Math.random() * .48 + .12, phase: Math.random() * 6 }));
  }
  function reset() {
    elapsed = 0; timeLeft = DURATION; score = 0; lives = 3; goodCaught = 0; chaosCaught = 0; goodMissed = 0;
    spawnClock = 0; items = []; particles = []; lastSecond = -1; shake = 0; keys.clear();
    player.x = W / 2; player.targetX = W / 2; player.blink = 0; player.bounce = 0;
    updateHud();
  }
  function updateHud() {
    ui.lives.textContent = Array.from({ length: 3 }, (_, i) => i < lives ? "♥" : "♡").join(" ");
    ui.score.textContent = String(score).padStart(3, "0");
    ui.time.textContent = String(Math.ceil(timeLeft));
  }
  function startGame() {
    reset(); state = "playing"; ui.startOverlay.classList.add("hidden"); ui.resultOverlay.classList.add("hidden");
    lastFrame = performance.now(); resize(); canvas.focus({ preventScroll: true }); requestAnimationFrame(loop);
  }
  function finishGame() {
    if (state !== "playing") return;
    state = "result";
    const opportunities = goodCaught + chaosCaught + goodMissed;
    const percent = opportunities ? Math.round(goodCaught / opportunities * 100) : 0;
    ui.finalGood.textContent = String(goodCaught); ui.finalChaos.textContent = String(chaosCaught); ui.finalPercent.textContent = `${percent}%`;
    ui.secret.classList.toggle("hidden", percent < 95 || goodCaught < 12);
    if (percent >= 82) {
      ui.resultTitle.textContent = "ВЕЧЕР СПАСЁН";
      ui.resultMessage.textContent = "Ксюша спасла вечер. Алексей пока под наблюдением.";
    } else if (percent >= 50) {
      ui.resultTitle.textContent = "ВЕЧЕР ЕЩЁ ДЕРЖИТСЯ";
      ui.resultMessage.textContent = "Вечер спасён, но Алексей снова что-то натворил.";
    } else {
      ui.resultTitle.textContent = "ВЕЧЕР ЕЛЕ ВЫЖИЛ";
      ui.resultMessage.textContent = "Вечер почти не пережил произошедшее. Алексей делает вид, что так и задумал.";
    }
    ui.resultOverlay.classList.remove("hidden");
  }
  function spawnItem() {
    const isGood = Math.random() < .69;
    const list = isGood ? goodItems : badItems;
    const index = Math.floor(Math.random() * list.length);
    const radius = isGood ? 25 : 26;
    items.push({ x: 34 + Math.random() * (W - 68), y: -34, vy: 105 + Math.random() * 38 + elapsed * 2.35, vx: (Math.random() - .5) * 12,
      radius, isGood, emoji: list[index], label: isGood ? goodLabels[index] : badLabels[index], wobble: Math.random() * 6.28, hue: isGood ? 150 + Math.random() * 60 : 335 + Math.random() * 30 });
  }
  function burst(x, y, good) {
    const colors = good ? ["#9ef4d5", "#f9db92", "#ffa7c0", "#ffffff"] : ["#ff879e", "#ffc0ab", "#f4cf7c"];
    for (let i = 0; i < 17; i++) {
      const angle = Math.random() * Math.PI * 2, speed = 55 + Math.random() * 150;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .55 + Math.random() * .42, max: .97, size: 2 + Math.random() * 3.5, color: colors[Math.floor(Math.random() * colors.length)], sparkle: Math.random() > .5 });
    }
    player.bounce = .24;
    if (!good) shake = .22;
  }
  function setPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    player.targetX = Math.max(36, Math.min(W - 36, (event.clientX - rect.left) * scaleX));
  }
  canvas.addEventListener("pointermove", setPointer);
  canvas.addEventListener("pointerdown", (event) => { setPointer(event); canvas.setPointerCapture?.(event.pointerId); });
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "a", "d", " "].includes(key)) event.preventDefault();
    keys.add(key);
  });
  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());
  window.addEventListener("resize", resize);
  ui.start.addEventListener("click", startGame);
  ui.replay.addEventListener("click", startGame);

  function update(dt) {
    elapsed += dt; timeLeft = Math.max(0, DURATION - elapsed);
    const speed = 385;
    if (keys.has("arrowleft") || keys.has("a")) player.targetX -= speed * dt;
    if (keys.has("arrowright") || keys.has("d")) player.targetX += speed * dt;
    player.targetX = Math.max(player.radius + 7, Math.min(W - player.radius - 7, player.targetX));
    player.x += (player.targetX - player.x) * Math.min(1, dt * 13);
    player.bounce = Math.max(0, player.bounce - dt); player.blink += dt;
    spawnClock += dt;
    const interval = Math.max(.39, .88 - elapsed * .0085);
    if (spawnClock >= interval) { spawnClock -= interval; spawnItem(); }
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i]; item.y += item.vy * dt; item.x += item.vx * dt + Math.sin(elapsed * 2 + item.wobble) * 10 * dt;
      if (Math.abs(item.x - player.x) < item.radius + 23 && Math.abs(item.y - player.y) < item.radius + 23) {
        burst(item.x, item.y, item.isGood);
        if (item.isGood) { goodCaught++; score += 10; } else { chaosCaught++; lives = Math.max(0, lives - 1); score = Math.max(0, score - 5); }
        items.splice(i, 1); updateHud();
        if (!lives) { finishGame(); return; }
      } else if (item.y > H + 35) {
        if (item.isGood) goodMissed++;
        items.splice(i, 1);
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 105 * dt; p.vx *= .986;
      if (p.life <= 0) particles.splice(i, 1);
    }
    shake = Math.max(0, shake - dt);
    const second = Math.ceil(timeLeft);
    if (second !== lastSecond) { lastSecond = second; updateHud(); }
    if (timeLeft <= 0) finishGame();
  }
  function roundedRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  }
  function drawBackground(now) {
    const gradient = ctx.createLinearGradient(0, 0, 0, H); gradient.addColorStop(0, "#1a2032"); gradient.addColorStop(.68, "#171c2c"); gradient.addColorStop(1, "#202536");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W * .5, H * .52, 35, W * .5, H * .52, 430); glow.addColorStop(0, "#4439512c"); glow.addColorStop(1, "#181c2a00"); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    for (const star of stars) { const alpha = star.a * (.72 + Math.sin(now * .0013 + star.phase) * .28); ctx.globalAlpha = alpha; ctx.fillStyle = "#e4e7ff"; ctx.beginPath(); ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#dbe5f008"; ctx.fillRect(0, H - 13, W, 13);
    ctx.strokeStyle = "#a2b7cb16"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, H - 13); ctx.lineTo(W, H - 13); ctx.stroke();
  }
  function drawItem(item, now) {
    const bob = Math.sin(now * .003 + item.wobble) * 2.5, y = item.y + bob;
    const color = item.isGood ? `hsla(${item.hue}, 65%, 62%, .18)` : "#ff829d20";
    ctx.save(); ctx.shadowColor = item.isGood ? "#8ce6c566" : "#ff829d77"; ctx.shadowBlur = 19;
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(item.x, y, item.radius + 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = item.isGood ? "#253c43" : "#472f42"; ctx.strokeStyle = item.isGood ? "#86dcc277" : "#ff91a877"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(item.x, y, item.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = "23px 'Segoe UI Emoji','Apple Color Emoji',sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(item.emoji, item.x, y + 1);
    ctx.fillStyle = item.isGood ? "#bdcfcf" : "#ddacb8"; ctx.font = "9px 'Segoe UI',sans-serif"; ctx.fillText(item.label, item.x, y + item.radius + 13);
    ctx.restore();
  }
  function drawPlayer(now) {
    const x = player.x, y = player.y - (player.bounce > 0 ? Math.sin(player.bounce / .24 * Math.PI) * 12 : 0);
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "#8ce6c51a"; ctx.beginPath(); ctx.ellipse(0, 15, 37, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = "#8ce6c577"; ctx.shadowBlur = 24;
    const body = ctx.createLinearGradient(0, -3, 0, 34); body.addColorStop(0, "#c3ffe8"); body.addColorStop(1, "#68caa8");
    ctx.fillStyle = body; roundedRect(-17, -4, 34, 38, 15); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = "#f6d9d1"; ctx.beginPath(); ctx.arc(0, -19, 23, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#533a50"; ctx.beginPath(); ctx.arc(0, -22, 24, Math.PI, 0); ctx.quadraticCurveTo(20, -27, 17, -9); ctx.quadraticCurveTo(7, -21, 0, -19); ctx.quadraticCurveTo(-8, -20, -19, -10); ctx.quadraticCurveTo(-26, -31, 0, -46); ctx.fill();
    ctx.fillStyle = "#503547"; const blink = Math.sin(player.blink * .9) > .995;
    if (!blink) { ctx.beginPath(); ctx.ellipse(-8, -18, 2.2, 3.2, 0, 0, Math.PI * 2); ctx.ellipse(8, -18, 2.2, 3.2, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.strokeStyle = "#503547"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-11, -18); ctx.lineTo(-5, -18); ctx.moveTo(5, -18); ctx.lineTo(11, -18); ctx.stroke(); }
    ctx.strokeStyle = "#b66e78"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -11, 4, .15, Math.PI - .15); ctx.stroke();
    ctx.fillStyle = "#ff9aa344"; ctx.beginPath(); ctx.ellipse(-13, -11, 4, 2.5, 0, 0, Math.PI * 2); ctx.ellipse(13, -11, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f8c7e5"; ctx.font = "12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("♥", 0, 12);
    ctx.restore();
  }
  function drawParticles() {
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; if (p.sparkle) { ctx.font = `${p.size * 2.1}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("✦", p.x, p.y); } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); } }
    ctx.globalAlpha = 1;
  }
  function draw(now) {
    resize(); ctx.save();
    if (shake > 0) ctx.translate((Math.random() - .5) * 7 * shake / .22, (Math.random() - .5) * 6 * shake / .22);
    drawBackground(now); for (const item of items) drawItem(item, now); drawPlayer(now); drawParticles(); ctx.restore();
  }
  function loop(now) {
    if (state !== "playing") return;
    const dt = Math.min((now - lastFrame) / 1000, .05); lastFrame = now;
    update(dt); draw(now);
    if (state === "playing") requestAnimationFrame(loop);
  }
  makeStars(); resize(); draw(0);
})();
