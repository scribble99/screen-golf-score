let allGames = [];
let lastResult = null;

async function init() {
  await GolfDB.seedIfEmpty(SEED_GAMES);
  const displayNames = await GolfDB.getSetting('displayNames', {});
  setPlayerDisplayNames(displayNames);

  await reloadGames();
  buildScoreInputs();
  wireTabs();
  wireForm();
  wireOcr();
  wireSettings();
  await consumePendingShare();
}

async function reloadGames() {
  allGames = await GolfDB.getAllGames();
  lastResult = computeStats(allGames);
  renderStats(lastResult);
  renderCourseList();
  renderGameList();
  renderGap(lastResult);
  renderRecommend(lastResult);
}

function wireTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

function switchTab(name) {
  document.querySelector(`.tab-btn[data-tab="${name}"]`).click();
}

function buildScoreInputs() {
  const container = document.getElementById('scoreInputs');
  container.innerHTML = '';
  PLAYERS.forEach((p) => {
    const wrap = document.createElement('label');
    wrap.textContent = `${playerName(p.id)} 스코어(파 대비)`;
    const input = document.createElement('input');
    input.type = 'number';
    input.id = `score_${p.id}`;
    input.required = true;
    input.placeholder = '예: -3';
    wrap.appendChild(input);
    container.appendChild(wrap);
  });
}

function renderStats(result) {
  const container = document.getElementById('statsContainer');
  if (!result.totalGames) {
    container.innerHTML = '<p>등록된 경기가 없습니다.</p>';
    return;
  }
  const { names, rows } = buildRows(result);
  let html = '<table class="stats-table"><thead><tr><th></th>';
  names.forEach((n) => (html += `<th>${n}</th>`));
  html += '</tr></thead><tbody>';
  rows.forEach((row) => {
    const label = row.label.replace(/\n/g, '<br>');
    if (row.type === 'section') {
      html += `<tr class="section-row"><td colspan="4">${label}</td></tr>`;
    } else {
      const rowClass = row.type === 'highlight' ? ' class="highlight-row"' : '';
      html += `<tr${rowClass}><td class="row-label">${label}</td>`;
      row.values.forEach((v) => (html += `<td>${v}</td>`));
      html += '</tr>';
    }
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderCourseList() {
  const datalist = document.getElementById('courseList');
  const courses = [...new Set(allGames.map((g) => g.course))].sort();
  datalist.innerHTML = courses.map((c) => `<option value="${c}">`).join('');
  setKnownCourses(courses);
}

function renderGameList() {
  const container = document.getElementById('gameListContainer');
  if (!allGames.length) {
    container.innerHTML = '<p>등록된 경기가 없습니다.</p>';
    return;
  }
  const sorted = [...allGames].sort((a, b) => (a.date < b.date ? 1 : -1));
  let html = '<table class="list-table"><thead><tr><th>날짜</th><th>구장</th><th>전장(m)</th>';
  PLAYERS.forEach((p) => (html += `<th>${playerName(p.id)}</th>`));
  html += '<th></th></tr></thead><tbody>';
  sorted.forEach((g) => {
    html += `<tr><td>${g.date}</td><td>${g.course}</td><td>${g.yardage ? g.yardage.toLocaleString('ko-KR') : '-'}</td>`;
    PLAYERS.forEach((p) => (html += `<td>${fmtScore(g.scores[p.id])}</td>`));
    html += `<td class="row-actions">
      <button data-action="edit" data-id="${g.id}">수정</button>
      <button data-action="delete" data-id="${g.id}">삭제</button>
    </td></tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;

  container.querySelectorAll('button[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => startEditGame(parseInt(btn.dataset.id, 10)));
  });
  container.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => deleteGame(parseInt(btn.dataset.id, 10)));
  });
}

function renderGap(result) {
  const container = document.getElementById('gapContainer');
  if (!result.totalGames) {
    container.innerHTML = '<p>등록된 경기가 없습니다.</p>';
    return;
  }
  const gaps = computeHandicapGaps(result.stats);
  let html = '<table class="list-table"><thead><tr><th>대결</th><th>핸디 격차</th></tr></thead><tbody>';
  gaps.forEach((g) => {
    html += `<tr><td>${g.label}</td><td>${g.gap === null ? '-' : g.gap.toFixed(1)}</td></tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderRecommend(result) {
  const container = document.getElementById('recommendContainer');
  if (!result.totalGames) {
    container.innerHTML = '<p>등록된 경기가 없습니다.</p>';
    return;
  }
  const recs = computeCourseRecommendations(result.timeline, 'park', 10);
  if (!recs.length) {
    container.innerHTML = '<p>박프로장난아가 핸디 대비 단독 1위를 기록한 경기가 아직 없습니다.</p>';
    return;
  }
  let html = '<table class="list-table"><thead><tr><th>순위</th><th>날짜</th><th>구장</th><th>전장(m)</th>';
  PLAYERS.forEach((p) => (html += `<th>${playerName(p.id)}</th>`));
  html += '</tr></thead><tbody>';
  recs.forEach((r, i) => {
    html += `<tr><td>${i + 1}</td><td>${r.date}</td><td>${r.course}</td><td>${r.yardage ? r.yardage.toLocaleString('ko-KR') : '-'}</td>`;
    PLAYERS.forEach((p) => (html += `<td>${fmtScore(r.scores[p.id])}</td>`));
    html += '</tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

function startEditGame(id) {
  const game = allGames.find((g) => g.id === id);
  if (!game) return;
  document.getElementById('f_editId').value = id;
  document.getElementById('f_date').value = game.date;
  document.getElementById('f_course').value = game.course;
  document.getElementById('f_yardage').value = game.yardage || '';
  PLAYERS.forEach((p) => (document.getElementById(`score_${p.id}`).value = game.scores[p.id]));
  document.getElementById('cancelEditBtn').style.display = '';
  switchTab('add');
}

async function deleteGame(id) {
  if (!confirm('이 경기 기록을 삭제할까요?')) return;
  await GolfDB.deleteGame(id);
  await reloadGames();
}

function wireForm() {
  const form = document.getElementById('gameForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('f_editId').value;
    const scores = {};
    PLAYERS.forEach((p) => {
      scores[p.id] = parseInt(document.getElementById(`score_${p.id}`).value, 10);
    });
    const yardageVal = document.getElementById('f_yardage').value;
    const game = {
      date: document.getElementById('f_date').value,
      course: document.getElementById('f_course').value.trim(),
      yardage: yardageVal ? parseInt(yardageVal, 10) : null,
      scores,
    };
    if (id) {
      game.id = parseInt(id, 10);
      await GolfDB.updateGame(game);
    } else {
      await GolfDB.addGame(game);
    }
    form.reset();
    document.getElementById('f_editId').value = '';
    document.getElementById('cancelEditBtn').style.display = 'none';
    document.getElementById('ocrStatus').textContent = '';
    await reloadGames();
    switchTab('stats');
  });

  document.getElementById('cancelEditBtn').addEventListener('click', () => {
    form.reset();
    document.getElementById('f_editId').value = '';
    document.getElementById('cancelEditBtn').style.display = 'none';
  });
}

function wireOcr() {
  document.getElementById('ocrFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) await runOcrAndFill(file);
  });

  document.getElementById('shareBtn').addEventListener('click', async () => {
    if (!lastResult) return;
    try {
      await shareResults(lastResult);
    } catch (err) {
      console.error(err);
      alert('공유에 실패했습니다: ' + err.message);
    }
  });
}

async function runOcrAndFill(imageSource) {
  const status = document.getElementById('ocrStatus');
  status.textContent = '이미지 분석 중... 0%';
  try {
    const parsed = await recognizeGolfZoneCapture(imageSource, (pct) => {
      status.textContent = `이미지 분석 중... ${pct}%`;
    });
    if (parsed.date) document.getElementById('f_date').value = parsed.date;
    if (parsed.course) document.getElementById('f_course').value = parsed.course;
    if (parsed.yardage) document.getElementById('f_yardage').value = parsed.yardage;
    PLAYERS.forEach((p) => {
      if (parsed.scores[p.id] !== undefined) {
        document.getElementById(`score_${p.id}`).value = parsed.scores[p.id];
      }
    });
    status.textContent = '인식 완료. 값을 확인한 뒤 저장하세요.';
  } catch (err) {
    console.error(err);
    status.textContent = '인식 실패: ' + err.message + ' (직접 입력해주세요)';
  }
}

async function consumePendingShare() {
  const pending = await GolfDB.getPendingShare();
  if (!pending) return;
  await GolfDB.clearPendingShare();
  switchTab('add');
  await runOcrAndFill(pending.blob);
}

function wireSettings() {
  const container = document.getElementById('displayNameInputs');
  GolfDB.getSetting('displayNames', {}).then((names) => {
    container.innerHTML = '';
    PLAYERS.forEach((p) => {
      const wrap = document.createElement('label');
      wrap.textContent = `${p.name} →`;
      const input = document.createElement('input');
      input.type = 'text';
      input.id = `dispname_${p.id}`;
      input.placeholder = p.name;
      input.value = names[p.id] || '';
      wrap.appendChild(input);
      container.appendChild(wrap);
    });
  });

  document.getElementById('saveDisplayNamesBtn').addEventListener('click', async () => {
    const names = {};
    PLAYERS.forEach((p) => {
      const v = document.getElementById(`dispname_${p.id}`).value.trim();
      if (v) names[p.id] = v;
    });
    await GolfDB.setSetting('displayNames', names);
    setPlayerDisplayNames(names);
    buildScoreInputs();
    await reloadGames();
    alert('저장했습니다.');
  });

  document.getElementById('exportBtn').addEventListener('click', async () => {
    const games = await GolfDB.getAllGames();
    const displayNames = await GolfDB.getSetting('displayNames', {});
    const payload = JSON.stringify({ games, displayNames }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `golf-score-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });

  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });

  document.getElementById('importFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('가져오기를 하면 현재 저장된 모든 경기 기록이 백업 파일 내용으로 대체됩니다. 계속할까요?')) {
      e.target.value = '';
      return;
    }
    const text = await file.text();
    const data = JSON.parse(text);
    const existing = await GolfDB.getAllGames();
    for (const g of existing) await GolfDB.deleteGame(g.id);
    for (const g of data.games) {
      const { id, ...rest } = g;
      await GolfDB.addGame(rest);
    }
    if (data.displayNames) {
      await GolfDB.setSetting('displayNames', data.displayNames);
      setPlayerDisplayNames(data.displayNames);
    }
    e.target.value = '';
    await reloadGames();
    alert('가져오기를 완료했습니다.');
  });
}

init();
