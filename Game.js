const WEBHOOK_URL = "https://discord.com/api/webhooks/YOUR_WEBHOOK_HERE"; // ← put yours here (or leave blank to disable)

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = 800;
canvas.height = 600;

let player, floor, logsEnabled = true;
const TILE = 40;

function logToDiscord(title, desc = "", fields = {}, color = 0x8B0000) {
  if (!logsEnabled || !WEBHOOK_URL) return;
  const embed = {
    title: `👁️ ${title}`,
    description: desc,
    color: color,
    fields: Object.entries(fields).map(([k,v])=>(({name:k,value:"```"+v+"```",inline:true}))),
    timestamp: new Date().toISOString(),
    footer: { text: "Haunted Eternity Observer" }
  };
  fetch(WEBHOOK_URL, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({embeds:[embed]})})
    .catch(()=>{}); // silent fail
}

function toggleLogging() {
  logsEnabled = !logsEnabled;
  document.getElementById("logStatus").textContent = logsEnabled ? "ON" : "OFF";
  localStorage.setItem("logging", logsEnabled);
}

class Player {
  constructor() {
    this.name = localStorage.getItem("playerName") || prompt("Your name, wanderer?") || "Lost Soul";
    localStorage.setItem("playerName", this.name);
    this.x = 10; this.y = 10;
    this.level = 1; this.exp = 0; this.statPoints = 0;
    this.str = 5; this.san = 10; this.luck = 5; this.per = 5;
    this.hp = 20; this.maxHp = 20; this.sanity = 100;
    this.depth = 0; this.deepest = parseInt(localStorage.getItem("deepest")||"0");
    this.inventory = [];
  }
  levelUp() {
    this.level++; this.exp = 0; this.statPoints += 3;
    this.maxHp += 5; this.hp = this.maxHp;
    logToDiscord("Level Up!", `${this.name} reached level ${this.level}`, {Depth: this.depth, Stats: this.statPoints+" points"});
  }
}

function startGame() {
  player = new Player();
  generateFloor();
  logToDiscord("New Soul Entered", `${player.name} stepped into the house…`, {Depth: player.depth});
  gameLoop();
}

function generateFloor() {
  floor = [];
  const rooms = 12 + Math.floor(Math.random()*8);
  for(let i=0; i<rooms; i++) {
    const w = 6 + Math.random()*6|0;
    const h = 6 + Math.random()*6|0;
    const x = Math.random()*(canvas.width/TILE- w -4)|0 + 2;
    const y = Math.random()*(canvas.height/TILE- h -4)|0 + 2;
    for(let yy=y; yy<y+h; yy++)
      for(let xx=x; xx<x+w; xx++)
        floor[yy*100 + xx] = (yy===y||yy===y+h-1||xx===x||xx===x+w-1) ? 1 : 0;
  }
  // stairs down
  floor[500 + 50] = 3;
  player.depth++;
  if(player.depth > player.deepest) {
    player.deepest = player.depth;
    localStorage.setItem("deepest", player.deepest);
  }
}

function draw() {
  ctx.fillStyle = "#111"; ctx.fillRect(0,0,canvas.width,canvas.height);
  // draw floor
  for(let y=0; y<canvas.height/TILE; y++)
    for(let x=0; x<canvas.width/TILE; x++) {
      const tile = floor[y*100 + x];
      if(tile===1) { ctx.fillStyle="#522"; ctx.fillRect(x*TILE,y*TILE,TILE,TILE); }
      if(tile===3) { ctx.fillStyle="#0f0"; ctx.fillRect(x*TILE,y*TILE,TILE,TILE); }
    }
  // player
  ctx.fillStyle = player.sanity > 30 ? "#0ff" : "#f00";
  ctx.fillRect(player.x*TILE+8, player.y*TILE+8, 24, 24);

  // UI
  document.getElementById("stats").innerHTML = `
    ${player.name} | Lv.${player.level} | Depth ${player.depth} (Best ${player.deepest})<br>
    HP: ${player.hp}/${player.maxHp} | Sanity: ${player.sanity}<br>
    STR:${player.str} SAN:${player.san} LCK:${player.luck} PER:${player.per} | Points: ${player.statPoints}
  `;
}

let keys = {};
window.onkeydown = e => keys[e.key] = true;
window.onkeyup = e => keys[e.key] = false;

function update() {
  if(keys["w"] && !floor[(player.y-1)*100 + player.x]) player.y--;
  if(keys["s"] && !floor[(player.y+1)*100 + player.x]) player.y++;
  if(keys["a"] && !floor[player.y*100 + player.x-1]) player.x--;
  if(keys["d"] && !floor[player.y*100 + player.x+1]) player.x++;

  // stairs
  if(floor[player.y*100 + player.x] === 3) {
    generateFloor();
    player.x = 5; player.y = 5;
    player.sanity = Math.max(10, player.sanity - 5);
    if(Math.random() < 0.1) {
      player.exp += player.level*10;
      if(player.exp >= player.level*50) player.levelUp();
    }
  }

  // fake enemies / sanity drain
  if(Math.random()<0.001) {
    player.hp -= 1;
    player.sanity -= 5;
    logToDiscord("Ambushed!", `${player.name} was attacked in the dark`, {HP: player.hp, Sanity: player.sanity});
  }
  if(player.hp <= 0) {
    logToDiscord("☠️ Soul Claimed", `${player.name} has become part of the house forever`, {Depth: player.depth, Playtime: "??"});
    alert("You died. The house keeps your soul.\nRefresh to try again.");
  }
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// load settings
logsEnabled = localStorage.getItem("logging") !== "false";
document.getElementById("logStatus").textContent = logsEnabled ? "ON" : "OFF";

// error logging
window.addEventListener("error", e => {
  logToDiscord("💥 Crash", e.message, {Stack: e.error?.stack || "none"}, 0xFF0000);
});
