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

// Fonts for the shared image run ~2.2x bigger than the on-screen stats
// table, so it's readable at a glance in a chat thread. Crucially, the
// COLUMN WIDTHS only grow a little (WIDTH_SCALE) — if they grew by the same
// factor as the font, the image would just be a uniformly-scaled copy, and
// since apps resize a shared image to fit the thread width anyway, the text
// would look exactly as big as before (this was the bug in the first pass).
// Keeping the width nearly fixed while the font (and therefore row height)
// grows is what actually makes the text take up more of the image —
// producing a taller, narrower image, which is expected/fine.
const FONT_SCALE = 2.2;
const WIDTH_SCALE = 1.25;
const COL_LABEL_W = 170 * WIDTH_SCALE;
const ROW_H = 30 * FONT_SCALE;
const PAD_X = 12 * WIDTH_SCALE;
const LABEL_LINE_H = 18 * FONT_SCALE;
const VALUE_LINE_H = 16 * FONT_SCALE;
const FONT_TITLE = `bold ${Math.round(18 * FONT_SCALE)}px "Malgun Gothic", sans-serif`;
const FONT_PLAYER_HEADER = `bold ${Math.round(14 * FONT_SCALE)}px "Malgun Gothic", sans-serif`;
const FONT_LABEL = `${Math.round(13 * FONT_SCALE)}px "Malgun Gothic", sans-serif`;
const FONT_LABEL_BOLD = `bold ${Math.round(12 * FONT_SCALE)}px "Malgun Gothic", sans-serif`;
const FONT_VALUE = `${Math.round(13 * FONT_SCALE)}px "Malgun Gothic", sans-serif`;
const FONT_VALUE_BOLD = `bold ${Math.round(13 * FONT_SCALE)}px "Malgun Gothic", sans-serif`;

function fmtNum(v, digits = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return '-';
  const sign = v > 0 ? '+' : '';
  return digits > 0 ? `${sign}${v.toFixed(digits)}` : `${sign}${Math.round(v)}`;
}

// Same rounding as fmtNum but never shows a leading "+" — for values that
// are always non-negative (e.g. standard deviation), a sign is just noise.
function fmtNumUnsigned(v, digits = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return '-';
  return digits > 0 ? v.toFixed(digits) : `${Math.round(v)}`;
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
  const order = PLAYER_IDS;
  const names = order.map(playerName);
  const rows = [];

  rows.push({ type: 'highlight', label: '핸디\n(최근10경기 최고·최저 제외 평균)', values: order.map((p) => fmtNum(result.stats[p].handicap, 1)) });
  rows.push({ type: 'data', label: '지난번 대비 등락', values: order.map((p) => fmtNum(result.stats[p].handicapDelta, 1)) });

  rows.push({ type: 'section', label: '누적', values: ['', '', ''] });
  rows.push({ type: 'data', label: '평균 순위', values: order.map((p) => fmtNum(result.stats[p].avgRank, 1)) });
  rows.push({ type: 'data', label: '베스트스코어', values: order.map((p) => fmtScore(result.stats[p].best)) });
  rows.push({ type: 'data', label: '워스트스코어', values: order.map((p) => fmtScore(result.stats[p].worst)) });
  rows.push({ type: 'data', label: '표준편차', values: order.map((p) => fmtNumUnsigned(result.stats[p].stdev, 1)) });
  rows.push({ type: 'data', label: '손익(원)', values: order.map((p) => fmtMoney(result.stats[p].money)) });

  rows.push({ type: 'section', label: '누적 순위별 횟수\n(핸디 반영)', values: ['', '', ''] });
  [['단독1위', 1], ['공동1위', 1.5], ['단독2위', 2], ['공동2위', 2.5], ['단독3위', 3]].forEach(([label, r]) => {
    rows.push({ type: 'data', label, values: order.map((p) => result.stats[p].rankBucketsHandicap[r] ?? 0) });
  });

  rows.push({ type: 'section', label: '누적 순위별 횟수\n(핸디 미반영)', values: ['', '', ''] });
  [['단독1위', 1], ['공동1위', 1.5], ['단독2위', 2], ['공동2위', 2.5], ['단독3위', 3]].forEach(([label, r]) => {
    rows.push({ type: 'data', label, values: order.map((p) => result.stats[p].rankBucketsRaw[r] ?? 0) });
  });

  rows.push({ type: 'data', label: '최근 10경기 추세\n(+면 하락세, -면 상승세)', values: order.map((p) => fmtNum(result.stats[p].trend, 1)) });

  rows.push({ type: 'section', label: '경기 결과\n(괄호=당일 핸디 대비 순위)', values: ['', '', ''] });
  result.recentGames.forEach((g) => {
    rows.push({
      type: 'data',
      label: g.date,
      values: order.map((p) => `${fmtScore(g.scores[p])}(${g.rankAdj[p]})`),
    });
  });

  if (result.justDropped) {
    rows.push({ type: 'section', label: '핸디에서 막 빠진 경기', values: ['', '', ''] });
    rows.push({
      type: 'data',
      label: result.justDropped.date,
      values: order.map((p) => `${fmtScore(result.justDropped.scores[p])}(${result.justDropped.rankAdj[p]})`),
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

function rowHeight(ctx, row) {
  const labelLines = wrapLabel(ctx, row.label, COL_LABEL_W - PAD_X * 2);
  return Math.max(ROW_H, labelLines.length * LABEL_LINE_H + 12 * FONT_SCALE);
}

async function buildShareImageCanvas(result) {
  const { names, rows } = buildRows(result);
  const scale = 2;
  const colW = 150 * WIDTH_SCALE;
  const width = COL_LABEL_W + colW * 3;
  const titleH = 56 * FONT_SCALE;
  const playerHeaderH = 36 * FONT_SCALE;

  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  mctx.font = FONT_LABEL;
  const heights = rows.map((r) => rowHeight(mctx, r));
  const totalHeight = titleH + playerHeaderH + heights.reduce((a, b) => a + b, 0) + 16 * FONT_SCALE;

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
  ctx.font = FONT_TITLE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(LEAGUE_TITLE, width / 2, titleH / 2);

  let y = titleH;
  ctx.fillStyle = COLORS.sectionBg;
  ctx.fillRect(0, y, width, playerHeaderH);
  ctx.strokeStyle = COLORS.border;
  ctx.strokeRect(0, y, width, playerHeaderH);
  ctx.fillStyle = COLORS.text;
  ctx.font = FONT_PLAYER_HEADER;
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
    ctx.font = isSection || isHighlight ? FONT_LABEL_BOLD : FONT_LABEL;
    ctx.textAlign = 'left';
    const lines = wrapLabel(ctx, row.label, COL_LABEL_W - PAD_X * 2);
    const startY = y + h / 2 - ((lines.length - 1) * LABEL_LINE_H) / 2;
    lines.forEach((line, li) => ctx.fillText(line, PAD_X, startY + li * LABEL_LINE_H));

    if (!isSection) {
      ctx.font = isHighlight ? FONT_VALUE_BOLD : FONT_VALUE;
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
