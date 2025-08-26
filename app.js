// Marcador Pàdel PWA amb veu i funcionalitats extres
// Desenvolupat per funcionar íntegrament offline un cop instal·lat (HTTPS requerit per veu)

// ---- PWA ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}

// ---- Audio (WebAudio) ----
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let soundOn = true;
function beep(duration=250, type='sine', frequency=880, volume=0.2){
  if(!soundOn) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = frequency;
  g.gain.setValueAtTime(volume, audioCtx.currentTime);
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + duration/1000);
}
function longTone(duration=3000, frequency=520){
  if(!soundOn) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type='triangle'; o.frequency.value = frequency;
  g.gain.setValueAtTime(0.12, audioCtx.currentTime);
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + duration/1000);
}

// ---- UI Elements ----
const els = {
  scoreBlue: document.getElementById('scoreBlue'),
  scoreRed: document.getElementById('scoreRed'),
  gamesBlue: document.getElementById('gamesBlue'),
  gamesRed: document.getElementById('gamesRed'),
  setsBlue: document.getElementById('setsBlue'),
  setsRed: document.getElementById('setsRed'),
  gamesBlue2: document.getElementById('gamesBlue2'),
  gamesRed2: document.getElementById('gamesRed2'),
  setsBlue2: document.getElementById('setsBlue2'),
  setsRed2: document.getElementById('setsRed2'),
  addBlue: document.getElementById('addBlue'),
  addRed: document.getElementById('addRed'),
  undoPoint: document.getElementById('undoPoint'),
  resetMatch: document.getElementById('resetMatch'),
  randomTeams: document.getElementById('randomTeams'),
  changeOrder: document.getElementById('changeOrder'),
  randomServe: document.getElementById('randomServe'),
  micToggle: document.getElementById('micToggle'),
  micStatus: document.getElementById('micStatus'),
  soundToggle: document.getElementById('soundToggle'),
  soundStatus: document.getElementById('soundStatus'),
  blueP1: document.getElementById('blueP1'),
  blueP2: document.getElementById('blueP2'),
  redP1: document.getElementById('redP1'),
  redP2: document.getElementById('redP2'),
  blueP1Row: document.getElementById('blueP1Row'),
  blueP2Row: document.getElementById('blueP2Row'),
  redP1Row: document.getElementById('redP1Row'),
  redP2Row: document.getElementById('redP2Row'),
  blueP1Order: document.getElementById('blueP1Order'),
  blueP2Order: document.getElementById('blueP2Order'),
  redP1Order: document.getElementById('redP1Order'),
  redP2Order: document.getElementById('redP2Order'),
  orderModal: document.getElementById('orderModal'),
  sortableList: document.getElementById('sortableList'),
  saveOrder: document.getElementById('saveOrder'),
  cancelOrder: document.getElementById('cancelOrder'),
  historyList: document.getElementById('historyList'),
};

// ---- State ----
const POINTS = ['0','15','30','40','ADV'];
function createInitialState(){
  return {
    cur: { blue:0, red:0, adv: null }, // adv: 'blue'/'red'/null
    games: { blue:0, red:0 },
    sets:  { blue:0, red:0 },
    history: [], // [{blue:6, red:4}]
    // players
    players: {
      blue: [ {name:els.blueP1.value}, {name:els.blueP2.value} ],
      red:  [ {name:els.redP1.value},  {name:els.redP2.value}  ],
    },
    // serve order indexes into [B1,R1,B2,R2] by default
    order: ['B1','R1','B2','R2'],
    serverIndex: 0,
    lastAction: null, // {type:'point', winner:'blue'|'red', snapshot:{}}
    cooldownUntil: 0
  };
}
let S = createInitialState();

function now(){ return Date.now(); }
function inCooldown(){ return now() < S.cooldownUntil; }
function setCooldown(ms=3000){ S.cooldownUntil = now() + ms; }

// ---- Rendering ----
function render(){
  // score
  const scoreTextBlue = scoreText('blue');
  const scoreTextRed  = scoreText('red');
  els.scoreBlue.textContent = scoreTextBlue;
  els.scoreRed.textContent  = scoreTextRed;

  // games/sets mirroring (both panels show both)
  els.gamesBlue.textContent = S.games.blue;
  els.gamesBlue2.textContent= S.games.blue;
  els.gamesRed.textContent  = S.games.red;
  els.gamesRed2.textContent = S.games.red;
  els.setsBlue.textContent  = S.sets.blue;
  els.setsBlue2.textContent = S.sets.blue;
  els.setsRed.textContent   = S.sets.red;
  els.setsRed2.textContent  = S.sets.red;

  // server highlight
  const ids = mapOrderToPlayers();
  const allRows = [els.blueP1Row, els.redP1Row, els.blueP2Row, els.redP2Row];
  allRows.forEach(r => r.classList.remove('server'));
  const current = ids[S.serverIndex];
  const row = {
    'B1': els.blueP1Row, 'B2': els.blueP2Row, 'R1': els.redP1Row, 'R2': els.redP2Row
  }[current];
  if(row) row.classList.add('server');

  // orders
  const orderMap = { 'B1': null, 'R1': null, 'B2': null, 'R2': null };
  S.order.forEach((k,i)=>{ orderMap[k]= (i+1); });
  els.blueP1Order.textContent = orderMap['B1'];
  els.blueP2Order.textContent = orderMap['B2'];
  els.redP1Order.textContent  = orderMap['R1'];
  els.redP2Order.textContent  = orderMap['R2'];

  // history
  els.historyList.innerHTML = S.history.map((set,i)=>{
    return `<div class="row"><div>Set ${i+1}</div><div><span class="pill blue">B</span> ${set.blue} - ${set.red} <span class="pill red">R</span></div></div>`;
  }).join('');
}

function scoreText(team){
  const b = S.cur.blue, r = S.cur.red;
  if(b>=3 && r>=3){
    if(b===r) return '40'; // deuce
    if((team==='blue' && S.cur.adv==='blue') || (team==='red' && S.cur.adv==='red')) return 'ADV';
    return '40';
  }
  const val = team==='blue'? b : r;
  return POINTS[Math.min(val,3)];
}

function mapOrderToPlayers(){
  return S.order.slice(); // ['B1','R1','B2','R2']
}

function nextServer(){
  S.serverIndex = (S.serverIndex + 1) % 4;
}

// ---- Scoring Logic ----
function pointWon(winner){
  if(inCooldown()) return;
  setCooldown(3000);
  beep(160, 'sine', 990, 0.25);

  const snapshot = JSON.parse(JSON.stringify(S));
  S.lastAction = { type:'point', winner, snapshot };

  let b = S.cur.blue;
  let r = S.cur.red;

  // Deuce/Adv logic
  if(b>=3 && r>=3){
    if(S.cur.adv === null){
      S.cur.adv = winner;
    } else if(S.cur.adv === winner){
      // wins game
      gameWon(winner);
      return render();
    } else {
      // back to deuce
      S.cur.adv = null;
    }
  } else {
    // Normal progression
    if(winner==='blue') b++;
    else r++;

    S.cur.blue = b;
    S.cur.red = r;

    if(b>=4 || r>=4){
      const diff = Math.abs(b - r);
      if((b>=4 || r>=4) && diff>=2){
        gameWon(b>r?'blue':'red');
        return render();
      }
    }
  }
  render();
}

function gameWon(winner){
  // reset points
  S.cur = { blue:0, red:0, adv:null };
  // inc games
  S.games[winner]++;
  // rotate server
  nextServer();

  // check set
  const gB = S.games.blue, gR = S.games.red;
  const max = Math.max(gB, gR);
  const min = Math.min(gB, gR);
  if((max>=6 && (max-min)>=2) || max===7){
    // set finished
    if(gB>gR) S.sets.blue++; else S.sets.red++;
    S.history.push({blue:gB, red:gR});
    S.games = {blue:0, red:0};
  }
}

// ---- Undo ----
function undo(){
  if(inCooldown()) return;
  if(!S.lastAction) return;
  setCooldown(3000);
  beep(220, 'square', 480, 0.25);
  const snap = S.lastAction.snapshot;
  S = snap;
  S.lastAction = null;
  render();
}

// ---- Reset ----
function resetAll(){
  if(!confirm('Segur que vols reiniciar el partit?')) return;
  S = createInitialState();
  render();
}

// ---- Random Teams ----
function randomTeams(){
  // 3s draft animation + 3s tone, then set, then 3s cooldown
  const names = [
    els.blueP1.value, els.blueP2.value, els.redP1.value, els.redP2.value
  ];

  let t = 0;
  const anim = setInterval(()=>{
    t++;
    const shuffled = names.slice().sort(()=>Math.random()-0.5);
    els.blueP1.value = shuffled[0];
    els.redP1.value  = shuffled[1];
    els.blueP2.value = shuffled[2];
    els.redP2.value  = shuffled[3];
  }, 120);

  longTone(3000, 520);
  setTimeout(()=>{
    clearInterval(anim);
    setCooldown(3000);
    // re-bind players into state
    S.players.blue[0].name = els.blueP1.value;
    S.players.blue[1].name = els.blueP2.value;
    S.players.red[0].name  = els.redP1.value;
    S.players.red[1].name  = els.redP2.value;
    render();
  }, 3000);
}

// ---- Change Serve Order (Drag & Drop) ----
function openOrderModal(){
  els.sortableList.innerHTML = '';
  const items = [
    {id:'B1', label: els.blueP1.value, color:'var(--blue)'},
    {id:'R1', label: els.redP1.value,  color:'var(--red)'},
    {id:'B2', label: els.blueP2.value, color:'var(--blue)'},
    {id:'R2', label: els.redP2.value,  color:'var(--red)'}
  ];
  items.forEach((it,i)=>{
    const div = document.createElement('div');
    div.className='sort-item';
    div.draggable = true;
    div.dataset.id = it.id;
    div.innerHTML = `<div style="display:flex;align-items:center;gap:10px">
      <span class="color" style="background:${it.color}"></span>
      <strong>${it.label}</strong>
    </div>
    <span class="badge">#${i+1}</span>`;
    addDnD(div);
    els.sortableList.appendChild(div);
  });
  els.orderModal.style.display='flex';
}
function closeOrderModal(){ els.orderModal.style.display='none'; }

function addDnD(el){
  el.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', el.dataset.id);
    el.style.opacity='.6';
  });
  el.addEventListener('dragend', e => el.style.opacity='1');
  el.addEventListener('dragover', e => e.preventDefault());
  el.addEventListener('drop', e => {
    e.preventDefault();
    const fromId = e.dataTransfer.getData('text/plain');
    const fromEl = [...els.sortableList.children].find(c=>c.dataset.id===fromId);
    if(fromEl && fromEl!==el){
      const children = [...els.sortableList.children];
      const toIndex = children.indexOf(el);
      els.sortableList.insertBefore(fromEl, children[toIndex]);
      updateBadges();
    }
  });
}

function updateBadges(){
  [...els.sortableList.children].forEach((c,i)=>{
    c.querySelector('.badge').textContent = `#${i+1}`;
  });
}

// ---- Random Serve (coin toss) ----
function randomServe(){
  const coin = Math.random() < 0.5 ? 'blue' : 'red';
  alert(`Comença servint l'equip ${coin==='blue'?'BLAU':'VERMELL'}.`);
  // set serverIndex to the first occurrence of chosen team in order
  const firstIdx = S.order.findIndex(k => coin==='blue'? k.startsWith('B'): k.startsWith('R'));
  if(firstIdx>=0) S.serverIndex = firstIdx;
  render();
}

// ---- Voice Recognition ----
let recognition = null;
let micOn = false;

function initSpeech(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    alert('El navegador no suporta SpeechRecognition.');
    return;
  }
  recognition = new SR();
  recognition.lang = 'es-ES'; // we'll parse ES/CA words; engine language can be ES
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    for(let i=event.resultIndex; i<event.results.length; i++){
      if(event.results[i].isFinal){
        const said = event.results[i][0].transcript.trim().toLowerCase();
        handleVoice(said);
      }
    }
  };
  recognition.onend = () => {
    if(micOn){ // keep listening while mic is ON
      try { recognition.start(); } catch(e){}
    }
  };
}

function handleVoice(text){
  // Commands (ES): "equipo rojo" / "equipo azul" / "cancelar punto"
  // Commands (CA): "equip vermell" / "equip blau" / "cancelar punt"
  const t = text.normalize('NFD').replace(/[\u0300-\u036f]/g,''); // strip accents
  if(/equipo\s+rojo|equip\s+vermell/.test(t)){
    pointWon('red');
  } else if(/equipo\s+azul|equip\s+blau/.test(t)){
    pointWon('blue');
  } else if(/cancelar\s+punto|cancelar\s+punt/.test(t)){
    undo();
  }
}

function toggleMic(){
  if(!recognition) initSpeech();
  if(!recognition) return;

  micOn = !micOn;
  els.micStatus.textContent = micOn ? 'ON' : 'OFF';
  els.micToggle.setAttribute('aria-pressed', micOn?'true':'false');
  if(micOn){
    navigator.mediaDevices.getUserMedia({audio:true})
      .then(() => { try{ recognition.start(); }catch(e){} })
      .catch(()=>{
        micOn=false;
        els.micStatus.textContent='OFF';
        alert('No s\'ha pogut accedir al micròfon.');
      });
  } else {
    try{ recognition.stop(); }catch(e){}
  }
}

// ---- Bindings ----
els.addBlue.addEventListener('click', ()=>pointWon('blue'));
els.addRed.addEventListener('click', ()=>pointWon('red'));
els.undoPoint.addEventListener('click', undo);
els.resetMatch.addEventListener('click', resetAll);
els.randomTeams.addEventListener('click', randomTeams);
els.changeOrder.addEventListener('click', openOrderModal);
els.randomServe.addEventListener('click', randomServe);
els.micToggle.addEventListener('click', toggleMic);
els.soundToggle.addEventListener('click', ()=>{
  soundOn = !soundOn;
  els.soundStatus.textContent = soundOn ? 'ON' : 'OFF';
});

els.saveOrder.addEventListener('click', ()=>{
  // read back order from DOM
  const ids = [...els.sortableList.children].map(c=>c.dataset.id);
  if(!confirm('Desar el nou ordre de servei?')) return;
  S.order = ids;
  // reset to first server of that new order
  S.serverIndex = 0;
  closeOrderModal();
  render();
});

els.cancelOrder.addEventListener('click', closeOrderModal);

// Player name changes -> reflect in state
[els.blueP1, els.blueP2, els.redP1, els.redP2].forEach((inp, idx)=>{
  inp.addEventListener('change', ()=>{
    if(idx===0) S.players.blue[0].name = inp.value;
    if(idx===1) S.players.blue[1].name = inp.value;
    if(idx===2) S.players.red[0].name  = inp.value;
    if(idx===3) S.players.red[1].name  = inp.value;
  });
});

// ---- Init ----
render();