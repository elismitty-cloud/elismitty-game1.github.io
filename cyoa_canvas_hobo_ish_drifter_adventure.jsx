import React, { useEffect, useMemo, useRef, useState } from "react";

// Choose‑Your‑Own‑Adventure on HTML Canvas — light graphics + (tasteful) crude humor
// Theme: rail‑yard drifter road‑trip vibes. Fictional and slapstick; avoid real‑world guidance.
// Controls: Click a choice button or press 1‑4. Space: fast‑forward text reveal. R: restart.

const W = 800, H = 500;

export default function DrifterCYOA() {
  const canvasRef = useRef(null);
  const [nodeId, setNodeId] = useState("start");
  const [stats, setStats] = useState({ grit: 1, charm: 1, luck: 1, health: 5 });
  const [inv, setInv] = useState([]); // inventory strings
  const [log, setLog] = useState([]);
  const [reveal, setReveal] = useState(0); // typewriter progress
  const [pausedType, setPausedType] = useState(false);

  const nodes = useMemo(() => buildNodes(), []);
  const node = nodes[nodeId];

  // Typewriter effect for node text
  useEffect(() => {
    setReveal(0);
    setPausedType(false);
    const txt = node.text;
    let raf; let last = performance.now();
    const step = (t) => {
      if (pausedType) { raf = requestAnimationFrame(step); return; }
      const dt = t - last; last = t;
      const speed = 60; // chars per second
      setReveal(r => Math.min(txt.length, r + (dt/1000)*speed));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [nodeId, node.text, pausedType]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (["1","2","3","4"].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const choice = node.choices[idx];
        if (choice) applyChoice(choice);
      } else if (e.key === " ") { setPausedType(p => !p); }
      else if (e.key.toLowerCase() === "r") { hardReset(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [node]);

  // Draw scene
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    c.width = W; c.height = H;
    // background
    ctx.fillStyle = "#0b0b10"; ctx.fillRect(0,0,W,H);
    // vignette
    const g = ctx.createRadialGradient(W/2,H/2,50,W/2,H/2,500);
    g.addColorStop(0, "#111316"); g.addColorStop(1, "#030308");
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

    // draw ground line
    ctx.strokeStyle = "#2a2f36"; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(0, H-80); ctx.lineTo(W, H-80); ctx.stroke();

    // call scene painter
    node.draw(ctx, { stats, inv });

    // title banner
    ctx.fillStyle = "#e5e7eb"; ctx.font = "bold 28px sans-serif";
    ctx.fillText(node.title, 20, 40);

    // narrative text
    const txt = node.text.slice(0, Math.floor(reveal));
    ctx.font = "16px sans-serif"; ctx.fillStyle = "#cbd5e1";
    wrapText(ctx, txt, 20, 70, W-40, 22);

    // HUD
    drawHUD(ctx, stats, inv);
  }, [node, stats, inv, reveal]);

  function hardReset(){
    setStats({ grit: 1, charm: 1, luck: 1, health: 5 });
    setInv([]); setLog([]); setNodeId("start");
  }

  function applyChoice(choice){
    // stat checks & effects
    let s = { ...stats };
    let inventory = [...inv];
    let next = choice.next;
    let logline = `➡ ${choice.text}`;

    if (choice.check) {
      const passed = rollCheck(choice.check, s);
      logline += passed ? " (nailed it)" : " (whiff)";
      const result = passed ? choice.onPass : choice.onFail;
      if (result?.stats) s = applyStats(s, result.stats);
      if (result?.itemAdd) inventory = addItem(inventory, result.itemAdd);
      if (result?.itemRemove) inventory = removeItem(inventory, result.itemRemove);
      if (result?.next) next = result.next;
    }

    if (choice.stats) s = applyStats(s, choice.stats);
    if (choice.itemAdd) inventory = addItem(inventory, choice.itemAdd);
    if (choice.itemRemove) inventory = removeItem(inventory, choice.itemRemove);

    setStats(s); setInv(inventory);
    setLog(l => [logline, ...l].slice(0, 8));
    if (s.health <= 0) { setNodeId("gameover"); return; }
    if (next) setNodeId(next);
  }

  function addItem(list, item){ return list.includes(item) ? list : [...list, item]; }
  function removeItem(list, item){ return list.filter(i => i !== item); }

  function rollCheck(check, s){
    // check: { stat:"grit"|"charm"|"luck", dc: number }
    const die = 1 + Math.floor(Math.random()*6);
    const total = die + (s[check.stat]||0);
    return total >= check.dc;
  }

  return (
    <div className="w-full flex flex-col items-center gap-3 p-4">
      <div className="text-xs opacity-80 max-w-3xl text-center">
        This is a silly, fictional, slapstick take on a drifting adventure with cartoonish hazards and crude jokes that punch up at fate, not at people.
      </div>
      <canvas ref={canvasRef} className="rounded-2xl shadow-lg ring-1 ring-zinc-700 bg-black" width={W} height={H} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-3xl">
        {node.choices.map((c, i) => (
          <button key={i} onClick={() => applyChoice(c)}
            className="px-3 py-2 rounded-xl shadow ring-1 ring-zinc-700 text-left hover:bg-zinc-800">
            <span className="mr-2 font-mono">[{i+1}]</span>{c.text}
          </button>
        ))}
      </div>
      <div className="max-w-3xl w-full">
        <details className="mt-2">
          <summary className="cursor-pointer text-sm opacity-80">Event log</summary>
          <ul className="text-sm mt-1 space-y-1">
            {log.map((ln, i) => <li key={i} className="opacity-90">{ln}</li>)}
          </ul>
        </details>
        <div className="mt-2 flex gap-2">
          <button onClick={hardReset} className="px-3 py-1 rounded-lg ring-1 ring-zinc-700">Restart (R)</button>
          <button onClick={()=>setPausedType(p=>!p)} className="px-3 py-1 rounded-lg ring-1 ring-zinc-700">{pausedType?"Resume text (Space)":"Pause text (Space)"}</button>
        </div>
      </div>
    </div>
  );
}

// ===== Nodes & Scenes =====
function buildNodes(){
  const nodes = {
    start: {
      title: "Rail Yard Dawn",
      text: "Sun peeks over rusted boxcars. Your stomach growls like an angry raccoon in a trash band. You: a wandering drifter with a harmonica that only plays one note (poorly).",
      draw: (ctx, {stats, inv}) => {
        drawTrain(ctx); drawStick(ctx, 120, 360, { hat:true }); drawCrate(ctx, 300, 380);
        drawClouds(ctx); drawCampFire(ctx, 520, 380);
      },
      choices: [
        { text: "Approach the suspiciously friendly raccoon.", next: "raccoon", check:{stat:"charm", dc:5}, onPass:{}, onFail:{} },
        { text: "Try to busk with your one‑note harmonica.", next: "busk", check:{stat:"charm", dc:4}, onPass:{}, onFail:{} },
        { text: "Investigate the boxcar with the sign 'Absolutely Not Haunted'.", next: "boxcar" },
        { text: "Search the crate labeled 'Mystery Sandwiches'.", next: "sandwich" },
      ]
    },
    raccoon: {
      title: "Raccoon Diplomacy",
      text: "The raccoon eyes you like a tax auditor. You offer crumbs. It chitters, then points at your backpack like it wants rent.",
      draw: (ctx)=>{ drawRaccoon(ctx, 200, 360); drawStick(ctx, 120, 360, {handOut:true}); },
      choices:[
        { text: "Attempt a peace treaty with a shiny bottlecap.", check:{stat:"charm", dc:6}, onPass:{ itemAdd:"Raccoon Respect", next:"yardpass"}, onFail:{ stats:{health:-1}, next:"start" }},
        { text: "Stand your ground. Growl back.", check:{stat:"grit", dc:6}, onPass:{ stats:{grit:+1}, next:"yardpass"}, onFail:{ stats:{health:-1}, next:"start"}},
      ]
    },
    yardpass: {
      title: "Unofficial Yard Pass",
      text: "Through inscrutable raccoon law, you are now ‘permitted’ to loiter. You receive a stamp: a muddy paw on your shirt. Classy.",
      draw: (ctx)=>{ drawTrain(ctx); drawRaccoon(ctx, 240, 360, true); drawStamp(ctx, 120, 300); },
      choices:[
        { text: "Use your 'status' to approach workers for odd jobs.", next:"oddjobs" },
        { text: "Flex your luck and poke the ‘Definitely Not Button’ on the signal box.", check:{stat:"luck", dc:6}, onPass:{ stats:{luck:+1}, next:"shortcut"}, onFail:{ stats:{health:-1}, next:"sparks"} },
      ]
    },
    busk: {
      title: "Busking Bravely",
      text: "You blast the single most confident B‑flat the world never asked for. A pigeon nods. A worker tosses you a coin; another tosses you a complaint.",
      draw: (ctx)=>{ drawStick(ctx, 120, 360, {harmonica:true}); drawPigeon(ctx, 240, 340); drawCoin(ctx, 200, 330); },
      choices:[
        { text: "Pocket the coin and bow like a celebrity.", stats:{charm:+1}, next:"start" },
        { text: "Try a solo so intense you see colors.", check:{stat:"luck", dc:5}, onPass:{ itemAdd:"Bent Coin", stats:{luck:+1}, next:"start"}, onFail:{ stats:{health:-1}, next:"start"} },
      ]
    },
    boxcar: {
      title: "Boxcar of Whispers",
      text: "Inside: a draft, two spooky cobwebs, and one unreasonably judgmental seagull. The air smells like old pickles and newer mistakes.",
      draw: (ctx)=>{ drawBoxcarInterior(ctx); drawSeagull(ctx, 520, 180); },
      choices:[
        { text: "Sit quietly and let the universe roast you.", stats:{grit:+1}, next:"start" },
        { text: "Challenge the seagull to a staring contest.", check:{stat:"grit", dc:5}, onPass:{ itemAdd:"Seagull Feather", next:"start" }, onFail:{ stats:{health:-1}, next:"start" }},
      ]
    },
    sandwich: {
      title: "Mystery Sandwich Roulette",
      text: "You unwrap something triangular and ominous. It winks. Absolutely not great.",
      draw: (ctx)=>{ drawCrate(ctx, 300, 380); drawSandwich(ctx, 360, 360); },
      choices:[
        { text: "Eat it. What could go wrong?", check:{stat:"grit", dc:7}, onPass:{ stats:{health:+1, grit:+1}, next:"start" }, onFail:{ stats:{health:-2}, next:"latrine" }},
        { text: "Trade it to the pigeon for intel.", check:{stat:"charm", dc:5}, onPass:{ itemAdd:"Pigeon Gossip", next:"shortcut"}, onFail:{ next:"start" }},
      ]
    },
    latrine: {
      title: "Emergency Facilities",
      text: "A heroic sprint to a porta‑potty. The soundtrack is your soul leaving your body briefly. On the wall: ‘For a good time, don’t eat the sandwich.’ Wisdom arrives late.",
      draw: (ctx)=>{ drawPorta(ctx, 520, 340); drawStick(ctx, 120, 360, {panic:true}); },
      choices:[
        { text: "Dignity? Never met her. Exit with renewed perspective (and soap).", stats:{grit:+1}, next:"start" },
      ]
    },
    oddjobs: {
      title: "Odd Jobs Board",
      text: "A foreman points to three tasks: sweep platform, calm the haunted forklift, or sing to the coffee machine until it dispenses mercy.",
      draw: (ctx)=>{ drawForklift(ctx, 520, 360); drawBroom(ctx, 220, 360); },
      choices:[
        { text: "Sweep like a choreography montage.", stats:{grit:+1, charm:+1}, itemAdd:"Free Pass", next:"shortcut" },
        { text: "Exorcise the forklift with jazz hands.", check:{stat:"charm", dc:6}, onPass:{ stats:{charm:+1}, next:"shortcut" }, onFail:{ stats:{health:-1}, next:"sparks" }},
        { text: "Serenade the coffee machine in B‑flat.", check:{stat:"luck", dc:5}, onPass:{ itemAdd:"Coffee", stats:{luck:+1}, next:"start" }, onFail:{ next:"start" }},
      ]
    },
    shortcut: {
      title: "Lucky Shortcut",
      text: "A gate squeaks open to reveal a snack cart and a map westward. Destiny smells like pretzels.",
      draw: (ctx)=>{ drawGate(ctx, 520, 360); drawPretzel(ctx, 560, 340); },
      choices:[
        { text: "Grab a pretzel (carbs = courage).", stats:{health:+1}, next:"road" },
        { text: "Pocket the map and whistle ominously.", itemAdd:"Crumpled Map", next:"road" },
      ]
    },
    sparks: {
      title: "Sparks & Regrets",
      text: "You press the button. The universe answers with fireworks and a mild tingling of your eyebrows. New look? Sure.",
      draw: (ctx)=>{ drawSparks(ctx, 520, 320); drawStick(ctx, 120, 360, {hair: true}); },
      choices:[
        { text: "Laugh it off. Style it as ‘electro‑mullet’.", stats:{charm:+1}, next:"start" },
        { text: "Take a breather and hydrate.", stats:{health:+1}, next:"start" },
      ]
    },
    road: {
      title: "Open Road-ish",
      text: "You set out along a service path. A storm brews. Ahead: a diner, a park gazebo, and a cardboard landmark titled ‘Art?’ ",
      draw: (ctx)=>{ drawRoad(ctx); drawDiner(ctx, 520, 320); drawGazebo(ctx, 320, 340); },
      choices:[
        { text: "Head to the diner and negotiate for pie.", next:"diner" },
        { text: "Seek shelter at the gazebo and befriend local chess grandpa.", next:"gazebo" },
        { text: "Contemplate the cardboard ‘Art?’ until enlightenment or splinters.", next:"art" },
      ]
    },
    diner: {
      title: "Pie Diplomacy",
      text: "Inside: neon buzz, coffee stronger than your childhood, and a slice of pie that looks illegal in three states.",
      draw: (ctx)=>{ drawDinerInterior(ctx); },
      choices:[
        { text: "Charm the server with self‑deprecation and exact pie facts.", check:{stat:"charm", dc:7}, onPass:{ itemAdd:"Pie", stats:{charm:+1, health:+1}, next:"road" }, onFail:{ next:"road" }},
        { text: "Offer to wash dishes with heroic gusto.", stats:{grit:+1}, itemAdd:"Clean Spoon", next:"road" },
      ]
    },
    gazebo: {
      title: "Gazebo Gambit",
      text: "You face the chess grandpa. He smells like peppermint and victory. Winner gets life advice; loser gets life advice with extra sarcasm.",
      draw: (ctx)=>{ drawGazebo(ctx, 420, 340); drawChess(ctx, 420, 360); },
      choices:[
        { text: "Play seriously.", check:{stat:"grit", dc:7}, onPass:{ stats:{grit:+1}, next:"advice"}, onFail:{ next:"advice"}},
        { text: "Distract with harmonica solo mid‑match.", check:{stat:"charm", dc:6}, onPass:{ stats:{charm:+1}, next:"advice"}, onFail:{ next:"advice"}},
      ]
    },
    advice: {
      title: "Grandpa Wisdom",
      text: "He says: ‘Kid, the trick is simple—pack light, laugh loud, and never trust a sandwich that introduces itself.’ You feel oddly seen.",
      draw: (ctx)=>{ drawSpeechBubble(ctx, 420, 300, "Pack light. Laugh loud."); },
      choices:[
        { text: "Nod solemnly and move on.", next:"road" },
      ]
    },
    art: {
      title: "Modern ‘Art?’",
      text: "It’s a cardboard box titled ‘Yearning, But Moist’. You stare long enough to become part of the exhibit. People clap. Why?",
      draw: (ctx)=>{ drawArt(ctx, 520, 360); },
      choices:[
        { text: "Bow. Accept the role.", stats:{charm:+1}, next:"road" },
        { text: "Steal the title card because it’s funny.", itemAdd:"Art Card", stats:{luck:+1}, next:"road" },
      ]
    },
    gameover: {
      title: "You Took Too Many Ls",
      text: "You sit, breathe, and decide today’s saga is over. Tomorrow, you’ll try again—with fewer haunted sandwiches.",
      draw: (ctx)=>{ drawZzz(ctx, 380, 220); },
      choices:[
        { text: "Restart (R)", next:"start" },
      ]
    }
  };
  return nodes;
}

// ===== Helpers =====
function applyStats(s, delta){
  const out = { ...s };
  for (const k in delta){ out[k] = (out[k]||0) + delta[k]; }
  // clamp minimal values
  out.health = Math.min(8, out.health);
  out.grit = Math.max(0, out.grit);
  out.charm = Math.max(0, out.charm);
  out.luck = Math.max(0, out.luck);
  return out;
}

function drawHUD(ctx, stats, inv){
  // Stats panel
  ctx.fillStyle = "#0f172a"; ctx.globalAlpha = 0.8;
  ctx.fillRect(W-220, 10, 210, 120);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#334155"; ctx.strokeRect(W-220, 10, 210, 120);
  ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 14px monospace";
  ctx.fillText("STATS", W-205, 30);
  ctx.font = "13px monospace";
  ctx.fillText(`Health: ${stats.health}`, W-205, 52);
  ctx.fillText(`Grit:   ${stats.grit}`, W-205, 70);
  ctx.fillText(`Charm:  ${stats.charm}`, W-205, 88);
  ctx.fillText(`Luck:   ${stats.luck}`, W-205, 106);

  // Inventory
  ctx.fillStyle = "#0f172a"; ctx.globalAlpha = 0.8;
  ctx.fillRect(10, H-110, W-20, 100);
  ctx.globalAlpha = 1; ctx.strokeStyle = "#334155"; ctx.strokeRect(10, H-110, W-20, 100);
  ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 14px monospace";
  ctx.fillText("INVENTORY", 20, H-92);
  ctx.font = "12px monospace";
  const items = inv.length? inv.join(", ") : "(lint and optimism)";
  wrapText(ctx, items, 20, H-72, W-40, 16);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight){
  const words = text.split(" ");
  let line = ""; let yy = y;
  for (let n=0; n<words.length; n++){
    const test = line + words[n] + " ";
    const width = ctx.measureText(test).width;
    if (width > maxWidth && n>0){ ctx.fillText(line, x, yy); line = words[n] + " "; yy += lineHeight; }
    else line = test;
  }
  ctx.fillText(line, x, yy);
}

// ===== Simple scene doodles =====
function drawStick(ctx, x, y, opts={}){
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 3; ctx.lineCap = "round";
  // body
  ctx.beginPath(); ctx.arc(x, y-40, 12, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y-28); ctx.lineTo(x, y-4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y-12); ctx.lineTo(x-12, y+8); ctx.moveTo(x, y-12); ctx.lineTo(x+12, y+8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y-4); ctx.lineTo(x-10, y+20); ctx.moveTo(x, y-4); ctx.lineTo(x+10, y+20); ctx.stroke();
  if (opts.harmonica){ ctx.fillStyle="#93c5fd"; ctx.fillRect(x-6, y-40, 12, 6); }
  if (opts.handOut){ ctx.beginPath(); ctx.arc(x+12, y+8, 3, 0, Math.PI*2); ctx.fillStyle="#e5e7eb"; ctx.fill(); }
  if (opts.panic){ ctx.fillStyle="#ef4444"; ctx.fillRect(x-20, y-60, 40, 6); }
  if (opts.hat){ ctx.fillStyle="#64748b"; ctx.fillRect(x-16, y-54, 32, 6); ctx.fillRect(x-12, y-66, 24, 12); }
  if (opts.hair){ ctx.strokeStyle="#94a3b8"; ctx.beginPath(); ctx.moveTo(x-10, y-52); ctx.lineTo(x-16, y-64); ctx.moveTo(x+10, y-52); ctx.lineTo(x+16, y-64); ctx.stroke(); }
}

function drawTrain(ctx){ ctx.fillStyle="#475569"; ctx.fillRect(420, 320, 300, 120); ctx.fillStyle="#334155"; ctx.fillRect(440, 340, 260, 80); }
function drawCrate(ctx, x, y){ ctx.fillStyle="#6b7280"; ctx.fillRect(x, y-40, 80, 40); ctx.strokeStyle="#94a3b8"; ctx.strokeRect(x, y-40, 80, 40); }
function drawCampFire(ctx, x, y){ ctx.fillStyle="#fb923c"; ctx.beginPath(); ctx.arc(x, y-10, 10, 0, Math.PI*2); ctx.fill(); ctx.fillStyle="#7c2d12"; ctx.fillRect(x-16,y-4,32,6); }
function drawClouds(ctx){ ctx.fillStyle="#1f2937"; ctx.beginPath(); ctx.arc(200,120,30,0,Math.PI*2); ctx.arc(230,120,20,0,Math.PI*2); ctx.arc(260,120,26,0,Math.PI*2); ctx.fill(); }
function drawRaccoon(ctx, x, y, crown){ ctx.fillStyle="#9ca3af"; ctx.beginPath(); ctx.arc(x, y-14, 10, 0, Math.PI*2); ctx.fill(); ctx.fillRect(x-14,y-10,28,8); ctx.fillStyle="#111827"; ctx.fillRect(x-14,y-8,28,4); if(crown){ ctx.fillStyle="#fde047"; ctx.fillRect(x-8,y-26,16,8);} }
function drawStamp(ctx,x,y){ ctx.strokeStyle="#22c55e"; ctx.strokeRect(x-20,y-20,40,20); }
function drawPigeon(ctx,x,y){ ctx.fillStyle="#94a3b8"; ctx.beginPath(); ctx.arc(x,y,10,0,Math.PI*2); ctx.fill(); ctx.fillRect(x-12,y,24,8); }
function drawCoin(ctx,x,y){ ctx.fillStyle="#facc15"; ctx.beginPath(); ctx.arc(x,y,6,0,Math.PI*2); ctx.fill(); }
function drawBoxcarInterior(ctx){ ctx.fillStyle="#1f2937"; ctx.fillRect(100,120,600,260); ctx.strokeStyle="#475569"; ctx.strokeRect(100,120,600,260); }
function drawSeagull(ctx,x,y){ ctx.fillStyle="#e5e7eb"; ctx.fillRect(x-8,y-6,16,12); ctx.fillStyle="#f59e0b"; ctx.fillRect(x+8,y-2,6,4); }
function drawSandwich(ctx,x,y){ ctx.fillStyle="#fbbf24"; ctx.fillRect(x-14,y-6,28,12); ctx.fillStyle="#16a34a"; ctx.fillRect(x-14,y-2,28,4); }
function drawPorta(ctx,x,y){ ctx.fillStyle="#0891b2"; ctx.fillRect(x-30,y-60,60,60); ctx.fillStyle="#0e7490"; ctx.fillRect(x-18,y-44,20,28); }
function drawForklift(ctx,x,y){ ctx.fillStyle="#f59e0b"; ctx.fillRect(x-30,y-20,40,20); ctx.fillStyle="#525252"; ctx.fillRect(x+10,y-40,6,40); }
function drawBroom(ctx,x,y){ ctx.fillStyle="#78350f"; ctx.fillRect(x-2,y-30,4,30); ctx.fillStyle="#a16207"; ctx.fillRect(x-8,y-10,16,8); }
function drawGate(ctx,x,y){ ctx.fillStyle="#475569"; ctx.fillRect(x-40,y-30,80,30); }
function drawPretzel(ctx,x,y){ ctx.fillStyle="#b45309"; ctx.beginPath(); ctx.arc(x,y,10,0,Math.PI*2); ctx.fill(); }
function drawSparks(ctx,x,y){ for(let i=0;i<20;i++){ const a=Math.random()*Math.PI*2; const r=10+Math.random()*40; const px=x+Math.cos(a)*r; const py=y+Math.sin(a)*r; dot(ctx,px,py,"#fbbf24"); }}
function dot(ctx,x,y,color){ ctx.fillStyle=color; ctx.fillRect(x|0,y|0,2,2); }
function drawRoad(ctx){ ctx.fillStyle="#374151"; ctx.fillRect(0, H-100, W, 20); }
function drawDiner(ctx,x,y){ ctx.fillStyle="#dc2626"; ctx.fillRect(x-60,y-30,120,30); ctx.fillStyle="#fde68a"; ctx.fillRect(x-50,y-20,100,10); }
function drawGazebo(ctx,x,y){ ctx.fillStyle="#64748b"; ctx.fillRect(x-40,y-20,80,20); ctx.fillRect(x-50,y-20,100,6); }
function drawDinerInterior(ctx){ ctx.fillStyle="#581c87"; ctx.fillRect(120,140,560,220); ctx.fillStyle="#f43f5e"; ctx.fillRect(160,220,480,20); }
function drawChess(ctx,x,y){ ctx.fillStyle="#111827"; ctx.fillRect(x-20,y-10,40,10); ctx.fillStyle="#e5e7eb"; ctx.fillRect(x-18,y-8,36,6); }
function drawSpeechBubble(ctx,x,y,text){ ctx.fillStyle="#e5e7eb"; ctx.fillRect(x-120,y-50,240,40); ctx.fillStyle="#111827"; ctx.font="12px monospace"; wrapText(ctx,text,x-112,y-26,224,14); }
function drawArt(ctx,x,y){ ctx.fillStyle="#6b7280"; ctx.fillRect(x-30,y-20,60,20); ctx.fillStyle="#eab308"; ctx.fillRect(x-20,y-38,40,14); }
function drawZzz(ctx,x,y){ ctx.fillStyle="#e5e7eb"; ctx.font="26px serif"; ctx.fillText("Z z z", x, y); }
