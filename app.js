// PWA Scoreboard with voice
if ("serviceWorker" in navigator) { navigator.serviceWorker.register("./service-worker.js"); }
const $ = sel => document.querySelector(sel);
const blueScoreEl = $("#blue-score");
const redScoreEl = $("#red-score");
const gamesEl = $("#games");
const setsEl = $("#sets");
const modeEl = $("#mode");
const tbIndicator = $("#tbIndicator");
const historySetsEl = $("#history-sets");
const micDot = $("#mic-dot");
const micLabel = $("#mic-label");
const soundDot = $("#sound-dot");
const soundLabel = $("#sound-label");
const serveBlue = $("#serve-blue");
const serveRed = $("#serve-red");
const inputs = { blue1: $("#blue-p1"), blue2: $("#blue-p2"), red1: $("#red-p1"), red2: $("#red-p2") };
const orderEls = { blue1: $("#blue-p1-order"), blue2: $("#blue-p2-order"), red1: $("#red-p1-order"), red2: $("#red-p2-order") };
const state = {
  points:{blue:0,red:0}, tiebreak:false, tbPoints:{blue:0,red:0},
  games:{blue:0,red:0}, sets:{blue:0,red:0}, history:[[]],
  servingOrder:["blue1","red1","blue2","red2"], serverIndex:0,
  micEnabled:false, soundEnabled:true, cooldown:false, undoCooldown:false, lastEvents:[]
};
const POINTS_VIEW = ["0","15","30","40","Adv"];
function saveLocal(){ localStorage.setItem("marcador-padel", JSON.stringify({state, players:Object.fromEntries(Object.entries(inputs).map(([k,el])=>[k,el.value]))})); }
function loadLocal(){ try{ const data=JSON.parse(localStorage.getItem("marcador-padel")); if(!data)return; Object.assign(state, data.state||{}); if(data.players){ Object.entries(data.players).forEach(([k,v])=>inputs[k]&&(inputs[k].value=v)); } }catch{} }
loadLocal();
function currentSetScoreAtIndex(idx){ if(idx<state.history.length-1){ const finished=state.history[idx]; if(finished.length) return finished[finished.length-1]; return [0,0]; } else { return [state.games.blue, state.games.red]; } }
function updateUI(){
  if(state.tiebreak){ blueScoreEl.textContent=state.tbPoints.blue; redScoreEl.textContent=state.tbPoints.red; modeEl.textContent="Tie-break"; tbIndicator.classList.remove("hidden"); }
  else { blueScoreEl.textContent=POINTS_VIEW[state.points.blue]||"0"; redScoreEl.textContent=POINTS_VIEW[state.points.red]||"0"; modeEl.textContent="Joc"; tbIndicator.classList.add("hidden"); }
  gamesEl.textContent=`${state.games.blue} — ${state.games.red}`;
  setsEl.textContent=`${state.sets.blue} — ${state.sets.red}`;
  const currentServerKey = state.servingOrder[state.serverIndex % 4];
  serveBlue.innerHTML=""; serveRed.innerHTML="";
  const racket = `<svg class="racket" viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 2a6.5 6.5 0 0 0-6.2 8.4L3 16.8a2.5 2.5 0 0 0 3.5 3.5l6.4-5.3A6.5 6.5 0 1 0 14.5 2Zm0 2a4.5 4.5 0 1 1-3.2 7.7A4.5 4.5 0 0 1 14.5 4Z"/></svg>`;
  if(currentServerKey.startsWith("blue")) serveBlue.innerHTML=racket; else serveRed.innerHTML=racket;
  state.servingOrder.forEach((key,i)=>{ if(orderEls[key]) orderEls[key].textContent=(i+1); });
  historySetsEl.innerHTML=""; state.history.forEach((setArr,i)=>{ const [b,r]=currentSetScoreAtIndex(i); const chip=document.createElement("div"); chip.className="chip"; chip.textContent=`Set ${i+1}: ${b} - ${r}`; historySetsEl.appendChild(chip); });
  micDot.classList.toggle("on", state.micEnabled); micDot.classList.toggle("off", !state.micEnabled); micLabel.textContent=state.micEnabled?"Actiu":"Inactiu";
  soundDot.classList.toggle("on", state.soundEnabled); soundDot.classList.toggle("off", !state.soundEnabled); soundLabel.textContent=state.soundEnabled?"Actiu":"Inactiu";
  saveLocal();
}
function playBeep(duration=300,type="sine",freq=660){ if(!state.soundEnabled)return; const ctx=new (window.AudioContext||window.webkitAudioContext)(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.type=type; o.frequency.setValueAtTime(freq, ctx.currentTime); o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime+0.01); o.start(); setTimeout(()=>{ g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.03); o.stop(); ctx.close&&ctx.close(); }, duration); }
function threeSecondDraftSound(){ if(!state.soundEnabled) return; const ctx=new (window.AudioContext||window.webkitAudioContext)(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.type="sawtooth"; o.frequency.setValueAtTime(220, ctx.currentTime); o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.05, ctx.currentTime); o.start(); setTimeout(()=>{ o.stop(); ctx.close&&ctx.close(); }, 3000); }
function cooldown(ms=3000){ state.cooldown=true; setTimeout(()=>state.cooldown=false, ms); }
function undoCooldown(ms=3000){ state.undoCooldown=true; setTimeout(()=>state.undoCooldown=false, ms); }
function addPoint(team){ if(state.cooldown) return; state.lastEvents.push(JSON.stringify(state)); if(state.tiebreak){ state.tbPoints[team]++; playBeep(120,"triangle",720); checkTiebreakComplete(); } else { const opp=team==="blue"?"red":"blue"; const p=state.points; if(p[team]<=2){ p[team]++; } else if(p[team]===3){ if(p[opp]<3){ winGame(team); } else if(p[opp]===3){ p[team]=4; } else if(p[opp]===4){ p[opp]=3; } } else if(p[team]===4){ winGame(team); } playBeep(120,"triangle",720); cooldown(); } updateUI(); }
function undoPoint(){ if(state.undoCooldown) return; const last=state.lastEvents.pop(); if(last){ Object.assign(state, JSON.parse(last)); playBeep(200,"square",440); undoCooldown(); updateUI(); } }
function resetGamePoints(){ state.points.blue=0; state.points.red=0; }
function nextServer(){ state.serverIndex=(state.serverIndex+1)%4; }
function winGame(team){ state.games[team]++; resetGamePoints(); nextServer(); if(isSetComplete()){ completeSet(); } else if(state.games.blue===6 && state.games.red===6){ state.tiebreak=true; state.tbPoints.blue=0; state.tbPoints.red=0; } }
function isSetComplete(){ const b=state.games.blue, r=state.games.red; if(b>=6 || r>=6){ if(Math.abs(b-r)>=2) return true; } return false; }
function checkTiebreakComplete(){ const b=state.tbPoints.blue, r=state.tbPoints.red; const lead=Math.abs(b-r); const winner=(b>=7 && lead>=2) ? "blue" : (r>=7 && lead>=2) ? "red" : null; if(winner){ state.games[winner]++; completeSet(true); } }
function completeSet(fromTiebreak=false){ const setScore=[state.games.blue, state.games.red]; state.history[state.history.length-1]=[setScore]; if(state.games.blue>state.games.red) state.sets.blue++; else state.sets.red++; state.games.blue=0; state.games.red=0; resetGamePoints(); state.tiebreak=false; state.tbPoints.blue=0; state.tbPoints.red=0; state.history.push([]); }
function randomTeams(){ const names=[inputs.blue1.value, inputs.blue2.value, inputs.red1.value, inputs.red2.value]; threeSecondDraftSound(); const shuffle=[...names].sort(()=>Math.random()-0.5); setTimeout(()=>{ inputs.blue1.value=shuffle[0]; inputs.blue2.value=shuffle[1]; inputs.red1.value=shuffle[2]; inputs.red2.value=shuffle[3]; playBeep(200,"square",520); cooldown(); updateUI(); }, 3000); }
function randomServe(){ state.serverIndex=Math.floor(Math.random()*4); playBeep(200,"sine",660); updateUI(); }
function showServiceModal(show){ $("#modal-service").classList.toggle("hidden", !show); if(show){ const list=$("#service-list"); list.innerHTML=""; state.servingOrder.forEach(key=>{ const item=document.createElement("div"); item.className="draggable "+(key.startsWith("blue")?"blue":"red"); item.draggable=true; item.dataset.key=key; const label=(key=="blue1"?inputs.blue1.value:key=="blue2"?inputs.blue2.value:key=="red1"?inputs.red1.value:inputs.red2.value); item.innerHTML=`<strong>${label}</strong> <span class="order-badge">${key}</span>`; list.appendChild(item); }); enableDragSort(list); } }
function enableDragSort(container){ let dragEl=null; container.querySelectorAll(".draggable").forEach(el=>{ el.addEventListener("dragstart",(e)=>{ dragEl=el; el.style.opacity="0.6"; }); el.addEventListener("dragend",()=>{ dragEl=null; container.querySelectorAll(".draggable").forEach(x=>x.style.opacity="1"); }); el.addEventListener("dragover",(e)=>{ e.preventDefault(); }); el.addEventListener("drop",(e)=>{ e.preventDefault(); if(!dragEl||dragEl===el) return; container.insertBefore(dragEl, el); }); }); }
function saveServiceOrderFromModal(){ const list=Array.from($("#service-list").children); const order=list.map(el=>el.dataset.key); const blues=order.filter(k=>k.startsWith("blue")).length; const reds=order.filter(k=>k.startsWith("red")).length; if(blues===2 && reds===2){ state.servingOrder=order; playBeep(150,"sine",700); updateUI(); } else { alert("Han d'haver-hi 2 jugadors blaus i 2 vermells."); } }
function resetMatch(){ if(!confirm("Reiniciar el partit? Aquesta acció no es pot desfer.")) return; Object.assign(state,{ points:{blue:0,red:0}, tiebreak:false, tbPoints:{blue:0,red:0}, games:{blue:0,red:0}, sets:{blue:0,red:0}, history:[[]], servingOrder:["blue1","red1","blue2","red2"], serverIndex:0, lastEvents:[], cooldown:false, undoCooldown:false }); playBeep(220,"sine",500); updateUI(); }
$("#btn-blue-point").addEventListener("click", ()=>addPoint("blue"));
$("#btn-red-point").addEventListener("click", ()=>addPoint("red"));
$("#btn-undo").addEventListener("click", ()=>undoPoint());
$("#btn-reset").addEventListener("click", ()=>resetMatch());
$("#btn-random-teams").addEventListener("click", ()=>randomTeams());
$("#btn-service-order").addEventListener("click", ()=>showServiceModal(true));
$("#service-cancel").addEventListener("click", ()=>showServiceModal(false));
$("#service-save").addEventListener("click", ()=>{ showServiceModal(false); saveServiceOrderFromModal(); });
$("#btn-random-serve").addEventListener("click", ()=>randomServe());
$("#btn-mic-toggle").addEventListener("click", ()=>{ state.micEnabled=!state.micEnabled; if(state.micEnabled) startRecognition(true); else stopRecognition(); updateUI(); });
$("#btn-sound-toggle").addEventListener("click", ()=>{ state.soundEnabled=!state.soundEnabled; updateUI(); });
Object.values(inputs).forEach(el=>el.addEventListener("input", ()=>updateUI()));
$("#btn-enable-mic").addEventListener("click", ()=>{ startRecognition(true); });
let recognition=null; let listening=false;
function startRecognition(explicit=false){ const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR){ alert("El navegador no suporta reconeixement de veu."); return; } recognition=recognition||new SR(); recognition.lang="es-ES"; recognition.continuous=true; recognition.interimResults=false; recognition.onresult=(e)=>{ const last=e.results[e.results.length-1][0].transcript.trim().toLowerCase(); handleVoice(last); }; recognition.onstart=()=>{ listening=true; state.micEnabled=true; updateUI(); }; recognition.onend=()=>{ listening=false; state.micEnabled=false; updateUI(); }; try{ recognition.start(); }catch(err){} if(explicit){ playBeep(120,"sine",800); micLabel.textContent="Actiu"; micDot.classList.remove("off"); micDot.classList.add("on"); } }
function stopRecognition(){ if(recognition){ recognition.stop(); } }
const VOICE_CMDS=[
  {phrases:["equipo azul","equip blau"], action:()=>addPoint("blue")},
  {phrases:["equipo rojo","equip vermell"], action:()=>addPoint("red")},
  {phrases:["cancelar punto","cancelar punt"], action:()=>undoPoint()},
];
function handleVoice(text){ const found=VOICE_CMDS.find(cmd=>cmd.phrases.some(p=> text.includes(p))); if(found) found.action(); }
function isSetComplete(){ const b=state.games.blue, r=state.games.red; if(b>=6 || r>=6){ if(Math.abs(b-r)>=2) return true; } return false; }
updateUI();