/* Renders the stats summary as a single image (canvas) so it can be
   shared to KakaoTalk / gallery / any app via the Web Share API. */

const COLORS = {
  bg: '#ffffff',
  headerBg: '#3d4852',
  headerText: '#ffffff',
  sectionBg: '#e9eef0',
  altRow: '#f6f8f8',
  border: '#d6dcdc',
  text: '#1a1a1a',
  sub: '#55615f',
  accent: '#1b5e3a',
};

const COL_LABEL_W = 170;
const ROW_H = 30;
const PAD_X = 12;

function fmtNum(v, digits = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return '-';
  const sign = v > 0 ? '+' : '';
  return digits > 0 ? `${sign}${v.toFixed(digits)}` : `${sign}${Math.round(v)}`;
}

function fmtMoney(v) {
  if (v === null || v === undefined) return '-';
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  return `${sign}${Math.abs(v).toLocaleString('ko-KR')}`;
}

function fmtScore(v) {
  if (v === null || v === undefined) return '-';
  return v > 0 ? `+${v}` : `${v}`;
}

function buildRows(result) {
  const names = PLAYER_IDS.map(playerName);
  const rows = [];

  rows.push({ type: 'highlight', label: '핸디\n(최근10경기 최고·최저 제외 평균)', values: PLAYER_IDS.map((p) => fmtNum(result.stats[p].handicap, 2)) });
  rows.push({ type: 'data', label: '지난번 대비 등락', values: PLAYER_IDS.map((p) => fmtNum(result.stats[p].handicapDelta, 2)) });

  rows.push({ type: 'section', label: '누적', values: ['', '', ''] });
  rows.push({ type: 'data', label: '평균 순위', values: PLAYER_IDS.map((p) => fmtNum(result.stats[p].avgRank, 2)) });
  rows.push({ type: 'data', label: '베스트스코어', values: PLAYER_IDS.map((p) => fmtScore(result.stats[p].best)) });
  rows.push({ type: 'data', label: '워스트스코어', values: PLAYER_IDS.map((p) => fmtScore(result.stats[p].worst)) });
  rows.push({ type: 'data', label: '표준편차', values: PLAYER_IDS.map((p) => fmtNum(result.stats[p].stdev, 2)) });
  rows.push({ type: 'data', label: '손익(원)', values: PLAYER_IDS.map((p) => fmtMoney(result.stats[p].money)) });

  rows.push({ type: 'section', label: '누적 순위별 횟수\n(핸디 반영)', values: ['', '', ''] });
  [['단독1위', 1], ['공동1위', 1.5], ['단독2위', 2], ['공동2위', 2.5], ['단독3위', 3]].forEach(([label, r]) => {
    rows.push({ type: 'data', label, values: PLAYER_IDS.map((p) => result.stats[p].rankBucketsHandicap[r] ?? 0) });
  });

  rows.push({ type: 'section', label: '누적 순위별 횟수\n(핸디 미반영)', values: ['', '', ''] });
  [['단독1위', 1], ['공동1위', 1.5], ['단독2위', 2], ['공동2위', 2.5], ['단독3위', 3]].forEach(([label, r]) => {
    rows.push({ type: 'data', label, values: PLAYER_IDS.map((p) => result.stats[p].rankBucketsRaw[r] ?? 0) });
  });

  rows.push({ type: 'data', label: '최근 10경기 추세\n(+면 하락세, -면 상승세)', values: PLAYER_IDS.map((p) => fmtNum(result.stats[p].trend, 2)) });

  rows.push({ type: 'section', label: '경기 결과\n(괄호=당일 핸디 대비 순위)', values: ['', '', ''] });
  result.recentGames.forEach((g) => {
    rows.push({
      type: 'data',
      label: g.date,
      values: PLAYER_IDS.map((p) => `${fmtScore(g.scores[p])}(${g.rankAdj[p]})`),
    });
  });

  if (result.justDropped) {
    rows.push({ type: 'section', label: '핸디에서 막 빠진 경기', values: ['', '', ''] });
    rows.push({
      type: 'data',
      label: result.justDropped.date,
      values: PLAYER_IDS.map((p) => `${fmtScore(result.justDropped.scores[p])}(${result.justDropped.rankAdj[p]})`),
    });
  }

  return { names, rows };
}

function wrapLabel(ctx, label, maxWidth) {
  const parts = label.split('\n');
  const lines = [];
  parts.forEach((part) => {
    let line = '';
    part.split('').forEach((ch) => {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
  });
  return lines;
}

function rowHeight(ctx, row, colW) {
  const labelLines = wrapLabel(ctx, row.label, COL_LABEL_W - PAD_X * 2);
  return Math.max(ROW_H, labelLines.length * 18 + 12);
}

async function buildShareImageCanvas(result) {
  const { names, rows } = buildRows(result);
  const scale = 2;
  const colW = 150;
  const width = COL_LABEL_W + colW * 3;
  const titleH = 56;
  const playerHeaderH = 36;

  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  mctx.font = '13px "Malgun Gothic", sans-serif';
  const heights = rows.map((r) => rowHeight(mctx, r, colW));
  const totalHeight = titleH + playerHeaderH + heights.reduce((a, b) => a + b, 0) + 16;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = totalHeight * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, totalHeight);

  ctx.fillStyle = COLORS.headerBg;
  ctx.fillRect(0, 0, width, titleH);
  ctx.fillStyle = COLORS.headerText;
  ctx.font = 'bold 18px "Malgun Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(LEAGUE_TITLE, width / 2, titleH / 2);

  let y = titleH;
  ctx.fillStyle = COLORS.sectionBg;
  ctx.fillRect(0, y, width, playerHeaderH);
  ctx.strokeStyle = COLORS.border;
  ctx.strokeRect(0, y, width, playerHeaderH);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 14px "Malgun Gothic", sans-serif';
  names.forEach((name, i) => {
    const x = COL_LABEL_W + colW * i + colW / 2;
    ctx.fillText(name, x, y + playerHeaderH / 2);
  });
  y += playerHeaderH;

  rows.forEach((row, idx) => {
    const h = heights[idx];
    const isSection = row.type === 'section';
    const isHighlight = row.type === 'highlight';
    ctx.fillStyle = isSection || isHighlight ? COLORS.sectionBg : idx % 2 === 0 ? COLORS.bg : COLORS.altRow;
    ctx.fillRect(0, y, width, h);
    ctx.strokeStyle = COLORS.border;
    ctx.strokeRect(0, y, width, h);

    ctx.fillStyle = isSection || isHighlight ? COLORS.accent : COLORS.text;
    ctx.font = isSection || isHighlight ? 'bold 12px "Malgun Gothic", sans-serif' : '13px "Malgun Gothic", sans-serif';
    ctx.textAlign = 'left';
    const lines = wrapLabel(ctx, row.label, COL_LABEL_W - PAD_X * 2);
    const lineH = 16;
    const startY = y + h / 2 - ((lines.length - 1) * lineH) / 2;
    lines.forEach((line, li) => ctx.fillText(line, PAD_X, startY + li * lineH));

    if (!isSection) {
      ctx.font = isHighlight ? 'bold 13px "Malgun Gothic", sans-serif' : '13px "Malgun Gothic", sans-serif';
      ctx.fillStyle = isHighlight ? COLORS.accent : COLORS.text;
      ctx.textAlign = 'center';
      row.values.forEach((v, i) => {
        const x = COL_LABEL_W + colW * i + colW / 2;
        ctx.fillText(String(v), x, y + h / 2);
      });
    }

    y += h;
  });

  return canvas;
}

async function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

async function shareResults(result) {
  const canvas = await buildShareImageCanvas(result);
  const blob = await canvasToBlob(canvas);
  const fileName = `golf-score-${new Date().toISOString().slice(0, 10)}.png`;
  const file = new File([blob], fileName, { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: LEAGUE_TITLE });
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
