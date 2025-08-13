// ===== helpers =====
const strength = p => (Number(p.batting)||0) + (Number(p.bowling)||0);

// Fisher–Yates
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

// random tie-break inside strength sort
function sortByStrengthWithTiebreak(list){
  return list.slice().sort((a,b)=>{
    const diff = strength(b) - strength(a);
    if (diff !== 0) return diff;
    return Math.random() - 0.5;
  });
}

// Track captains by ORIGINAL index in `players`
const captainSet = new Set();
const isCaptain = (player) => captainSet.has(players.indexOf(player));

// ===== UI: render players =====
function renderPlayerList() {
  const wrap = document.getElementById('playerList');
  wrap.innerHTML = '';

  // attach original index, then sort by name for display
  const ordered = players
    .map((p, i) => ({ p, i })) // keep ORIGINAL index
    .sort((a, b) => a.p.name.localeCompare(b.p.name));

  ordered.forEach(({ p, i }) => {
    const row = document.createElement('label');
    row.className = 'player';
    if (captainSet.has(i)) row.classList.add('is-captain');

    const top = document.createElement('div');
    top.className = 'top';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.idx = i; // store ORIGINAL index

    const name = document.createElement('span');
    name.textContent = `${p.name} (${p.role})`;

    // Captain toggle button
    const capBtn = document.createElement('button');
    capBtn.type = 'button';
    capBtn.className = 'cap-btn' + (captainSet.has(i) ? ' active' : '');
    capBtn.textContent = captainSet.has(i) ? '★ Captain' : '☆ Captain';
    capBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (captainSet.has(i)) {
        captainSet.delete(i);
      } else {
        captainSet.add(i);
      }
      // update visuals
      capBtn.textContent = captainSet.has(i) ? '★ Captain' : '☆ Captain';
      capBtn.classList.toggle('active', captainSet.has(i));
      row.classList.toggle('is-captain', captainSet.has(i));
    });

    top.appendChild(cb);
    top.appendChild(name);
    top.appendChild(capBtn);

    const meta = document.createElement('div');
    meta.className = 'sub';
    meta.textContent = `Bat ${p.batting} • Bowl ${p.bowling} • overall ${strength(p)}`;

    row.appendChild(top);
    row.appendChild(meta);
    wrap.appendChild(row);
  });
}

function getSelectedPlayers(){
  // read back original indexes so we select the right players
  return Array.from(document.querySelectorAll('#playerList input:checked'))
    .map(cb => players[Number(cb.dataset.idx)]);
}

function initTeams(n){
  return Array.from({length:n},()=>({ list:[], total:0, roles:{ Allrounder:0, Batter:0, Bowler:0 }}));
}

function bestTeamIndex(teams, role){
  let best = 0;
  for(let i=1;i<teams.length;i++){
    const a = teams[best], b = teams[i];
    const A = [a.roles[role], a.total, a.list.length];
    const B = [b.roles[role], b.total, b.list.length];
    if (B[0] < A[0] || (B[0] === A[0] && B[1] < A[1]) || (B[0] === A[0] && B[1] === A[1] && B[2] < A[2])
        || (B[0] === A[0] && B[1] === A[1] && B[2] === A[2] && Math.random()<0.5)) {
      best = i;
    }
  }
  return best;
}

function placePlayerIntoBestTeam(teams, player){
  const idx = bestTeamIndex(teams, player.role);
  const t = teams[idx];
  t.list.push(player);
  t.total += strength(player);
  t.roles[player.role] = (t.roles[player.role]||0)+1;
}

// ===== main generator with captains =====
function generateBalancedTeams(selected, teamCount){
  const teams = initTeams(teamCount);

  // 1) Collect captains (must be selected & exactly teamCount)
  const captains = Array.from(captainSet)
    .map(i => players[i])
    .filter(p => selected.includes(p));

  if (captains.length !== teamCount) {
    alert(`Select exactly ${teamCount} captains (and make sure they are also ticked as playing).`);
    return null;
  }

  // 2) Seed teams with captains (strongest first, one per team)
  const sortedCaps = sortByStrengthWithTiebreak(captains);
  sortedCaps.forEach((cap, idx) => {
    const t = teams[idx % teamCount];
    t.list.push(cap);
    t.total += strength(cap);
    t.roles[cap.role] = (t.roles[cap.role]||0)+1;
  });

  // 3) Distribute remaining selected players
  const remaining = selected.filter(p => !captains.includes(p));

  const roleOrder = shuffle(['Allrounder','Batter','Bowler']);
  const randomized = shuffle(remaining);

  const groups = {
    Allrounder: sortByStrengthWithTiebreak(randomized.filter(p=>p.role==='Allrounder')),
    Batter:     sortByStrengthWithTiebreak(randomized.filter(p=>p.role==='Batter')),
    Bowler:     sortByStrengthWithTiebreak(randomized.filter(p=>p.role==='Bowler'))
  };

  roleOrder.forEach(role=>{
    groups[role].forEach(p=>placePlayerIntoBestTeam(teams, p));
  });

  return teams;
}

function renderTeams(teams){
  const box = document.getElementById('teamsContainer');
  box.innerHTML = '';
  teams.forEach((t, i)=>{
    const el = document.createElement('div');
    el.className = 'team';
    const roleMeta = `Allrounder:${t.roles.Allrounder||0} Bats:${t.roles.Batter||0} Bowl:${t.roles.Bowler||0}`;
    el.innerHTML = `<h3>Team ${i+1}</h3>
      <div class="meta">Total strength: ${t.total} • ${roleMeta}</div>
      <ul>${t.list.map(p=>`<li>${p.name}${isCaptain(p) ? ' (C)' : ''} — ${p.role} • Bat ${p.batting}, Bowl ${p.bowling}, overall ${strength(p)}</li>`).join('')}</ul>`;
    box.appendChild(el);
  });
}

// names-only text for sharing (shows (C) next to captains)
function teamsToNamesText(teams){
  return teams.map((t,i)=>{
    const namesList = t.list.map(p=>`- ${p.name}${isCaptain(p) ? ' (C)' : ''}`).join('\n');
    return `Team ${i+1}:\n${namesList}`;
  }).join('\n\n');
}

function showToast(msg='Teams created.'){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(showToast._tid);
  showToast._tid = setTimeout(()=>{ t.hidden = true; }, 2200);
}

async function shareTeams(teams){
  const text = teamsToNamesText(teams);
  if (navigator.share){
    try {
      await navigator.share({ text, title: 'Cricket Teams' });
      return;
    } catch {}
  }
  await navigator.clipboard.writeText(text);
  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(wa, '_blank', 'noopener');
}

function ensureEnoughPlayers(selected, teamCount){
  if(selected.length < teamCount){
    alert('Select at least as many players as the number of teams');
    return false;
  }
  return true;
}

// ===== wire up =====
window.addEventListener('DOMContentLoaded', ()=>{
  renderPlayerList();

  const elTeamCount = document.getElementById('teamCount');
  const btnGen = document.getElementById('btnGenerate');
  const btnShuffle = document.getElementById('btnShuffle');
  const btnCopy = document.getElementById('btnCopy');
  const btnShare = document.getElementById('btnShare');
  const btnSelectAll = document.getElementById('btnSelectAll');
  const btnClear = document.getElementById('btnClear');
  const waShare = document.getElementById('waShare');

  function run(){
    const selected = getSelectedPlayers();
    const teamCount = Math.max(2, Math.min(8, parseInt(elTeamCount.value)||4));
    if(!ensureEnoughPlayers(selected, teamCount)) return;

    const teams = generateBalancedTeams(selected, teamCount);
    if (!teams) return; // captain count validation failed

    renderTeams(teams);
    window.__lastTeams = teams;
    showToast('Teams created. Use Share or WhatsApp.');
    waShare.href = `https://wa.me/?text=${encodeURIComponent(teamsToNamesText(teams))}`;
  }

  btnGen.addEventListener('click', run);
  btnShuffle.addEventListener('click', run);

  btnCopy.addEventListener('click', async ()=>{
    if(!window.__lastTeams) run();
    await navigator.clipboard.writeText(teamsToNamesText(window.__lastTeams));
    showToast('Copied names to clipboard.');
  });

  btnShare.addEventListener('click', ()=>{
    if(!window.__lastTeams) run();
    shareTeams(window.__lastTeams);
  });

  btnSelectAll.addEventListener('click', ()=>{
    document.querySelectorAll('#playerList input[type=checkbox]').forEach(cb=>cb.checked=true);
  });

  btnClear.addEventListener('click', ()=>{
    document.querySelectorAll('#playerList input[type=checkbox]').forEach(cb=>cb.checked=false);
    document.getElementById('teamsContainer').innerHTML='';
  });
});
