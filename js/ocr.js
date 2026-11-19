/* Parses a GolfZone result-screen screenshot with Tesseract.js (OCR).
   OCR is never 100% accurate, especially for Korean course names, so the
   caller must always show a confirm/edit form before saving. */

async function recognizeGolfZoneCapture(imageSource, onProgress) {
  if (typeof Tesseract === 'undefined') {
    throw new Error('OCR 라이브러리를 아직 불러오지 못했습니다. 인터넷 연결을 확인해주세요.');
  }
  const report = (pct) => onProgress && onProgress(pct);

  const mainWorker = await Tesseract.createWorker('kor+eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') report(Math.round(m.progress * 60));
    },
  });
  let data;
  try {
    ({ data } = await mainWorker.recognize(imageSource, {}, { text: true, blocks: true }));
  } finally {
    await mainWorker.terminate();
  }

  const text = data.text || '';
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const ocrLines = groupWordsByLine(flattenWords(data.blocks));

  const scores = extractScores(lines);
  let course = extractCourse(lines);

  // The featured player's score and (occasionally) the course name are
  // rendered in large/stylised fonts that the combined kor+eng model reads
  // badly. Re-OCR just those small regions — located from the first pass's
  // own word positions, not hardcoded coordinates — with an English-only
  // model, which reads this UI's Latin digits/letters far more reliably.
  const missingPlayers = PLAYERS.filter((p) => scores[p.id] === undefined);
  const courseLooksGarbled = course && /[<>{}|~`]/.test(course);

  if ((missingPlayers.length || courseLooksGarbled) && typeof createImageBitmap === 'function') {
    let bitmap;
    try {
      bitmap = await createImageBitmap(imageSource);
    } catch (err) {
      bitmap = null;
    }

    if (bitmap) {
      const refineWorker = await Tesseract.createWorker('eng', 1);
      try {
        for (const player of missingPlayers) {
          const result = await refinePlayerScore(player, ocrLines, bitmap, refineWorker);
          if (result !== undefined) scores[player.id] = result;
        }
        if (courseLooksGarbled) {
          const courseLine = findCourseLineObject(ocrLines);
          course = await refineCourseName(course, courseLine, bitmap, refineWorker);
        }
      } finally {
        await refineWorker.terminate();
        if (bitmap.close) bitmap.close();
      }
    }
  }

  report(100);
  return { rawText: text, date: extractDate(text), course, scores };
}

function flattenWords(blocks) {
  const words = [];
  (blocks || []).forEach((block) => {
    (block.paragraphs || []).forEach((para) => {
      (para.lines || []).forEach((line) => {
        (line.words || []).forEach((word) => {
          words.push({ text: word.text, bbox: word.bbox, lineBbox: line.bbox });
        });
      });
    });
  });
  return words;
}

// Large/bold UI text (the featured player's nickname, "CC" in a course
// title, ...) sometimes gets tokenised one character per "word" instead of
// as a single word. Group words by their shared line box, then for a given
// target string, find the run of consecutive same-line words whose
// concatenated text contains it, and return a combined bbox spanning them.
function groupWordsByLine(words) {
  const lines = [];
  const indexByKey = new Map();
  words.forEach((w) => {
    const key = [w.lineBbox.x0, w.lineBbox.y0, w.lineBbox.x1, w.lineBbox.y1].join(',');
    if (!indexByKey.has(key)) {
      indexByKey.set(key, lines.length);
      lines.push({ bbox: w.lineBbox, words: [] });
    }
    lines[indexByKey.get(key)].words.push(w);
  });
  return lines;
}

function findTextSpan(ocrLines, target) {
  for (const line of ocrLines) {
    const joined = line.words.map((w) => w.text).join('');
    const idx = joined.indexOf(target);
    if (idx === -1) continue;

    let pos = 0;
    let startWord = null;
    let endWord = null;
    for (const w of line.words) {
      const wStart = pos;
      const wEnd = pos + w.text.length;
      if (startWord === null && wEnd > idx) startWord = w;
      if (wStart < idx + target.length) endWord = w;
      pos = wEnd;
    }
    if (startWord && endWord) {
      return {
        bbox: {
          x0: Math.min(startWord.bbox.x0, endWord.bbox.x0),
          y0: Math.min(startWord.bbox.y0, endWord.bbox.y0),
          x1: Math.max(startWord.bbox.x1, endWord.bbox.x1),
          y1: Math.max(startWord.bbox.y1, endWord.bbox.y1),
        },
        lineBbox: line.bbox,
        lineWords: line.words,
      };
    }
  }
  return null;
}

function cropAndScale(bitmap, x, y, w, h, scale) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, x, y, w, h, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toGrayscale(canvas) {
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(imgData, 0, 0);
}

// The featured player's row looks like "닉네임 [badge] 79 (+7)" where "79"
// (total strokes) OCRs fine as a standalone word in the main pass, but the
// small "(+7)" right next to it gets mangled by the kor+eng model (its "+"
// is read as "1"). We locate "79" from the main pass's word boxes, crop the
// region immediately to its right, and re-read just that with an
// English-only model — which reads it correctly. If even that fails, we
// fall back to computing the value arithmetically from the total strokes.
async function refinePlayerScore(player, ocrLines, bitmap, worker) {
  const nameSpan = findTextSpan(ocrLines, player.name);
  if (!nameSpan) return undefined;

  // The nickname's row can also contain small unrelated digits (a rating
  // badge, etc). The actual total-strokes number is the right-most numeric
  // token on the row, closest to where the score is displayed.
  const numCandidates = nameSpan.lineWords.filter(
    (w) => /^\d{1,3}$/.test(w.text) && w.bbox.x0 > nameSpan.bbox.x1
  );
  const numWord = numCandidates.sort((a, b) => b.bbox.x0 - a.bbox.x0)[0];
  if (!numWord) return undefined;

  const pad = 10;
  const cropX = numWord.bbox.x1;
  const cropY = Math.max(0, numWord.bbox.y0 - pad);
  const cropW = 160;
  const cropH = numWord.bbox.y1 - numWord.bbox.y0 + pad * 2;

  try {
    const canvas = cropAndScale(bitmap, cropX, cropY, cropW, cropH, 4);
    toGrayscale(canvas);
    await worker.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: '0123456789()+-' });
    const { data } = await worker.recognize(canvas);
    const m = (data.text || '').match(/\(\s*([+-]?\d+)\s*\)/);
    if (m) return parseInt(m[1], 10);
  } catch (err) {
    // fall through to the arithmetic fallback below
  }

  // Best-effort fallback: relative-to-par score = total strokes − par.
  return parseInt(numWord.text, 10) - DEFAULT_PAR;
}

// Locates the specific OCR line the course title was read from (same
// position logic as extractCourse: the line right above the "코스X.X
// 그린X.X" stat line), so garbled-word lookup never matches unrelated UI
// chrome (e.g. the back-arrow icon, also misread as "<") elsewhere on screen.
function findCourseLineObject(ocrLines) {
  const idx = ocrLines.findIndex((l) => /(코스|그린)\s*[\d.]/.test(l.words.map((w) => w.text).join('')));
  return idx > 0 ? ocrLines[idx - 1] : null;
}

// Re-reads the garbled word(s) in the course title (e.g. "CC" misread as
// junk symbols like "<(") from their own location in the image, using an
// English-only model/whitelist — restricted to the course's own line so it
// can't latch onto a lookalike symbol elsewhere on the screen.
async function refineCourseName(course, courseLine, bitmap, worker) {
  if (!courseLine) return course;

  // Only fix the first *contiguous* run of garbled words — a trailing ">"
  // chevron icon can independently match the same junk pattern, but it's
  // unrelated (and already stripped from `course` by extractCourse), so
  // including it would stretch the crop across unrelated text in between.
  const badWords = [];
  for (const w of courseLine.words) {
    if (/[<>{}|~`]/.test(w.text)) {
      badWords.push(w);
    } else if (badWords.length) {
      break;
    }
  }
  if (!badWords.length) return course;

  const bbox = {
    x0: Math.min(...badWords.map((w) => w.bbox.x0)),
    y0: Math.min(...badWords.map((w) => w.bbox.y0)),
    x1: Math.max(...badWords.map((w) => w.bbox.x1)),
    y1: Math.max(...badWords.map((w) => w.bbox.y1)),
  };
  const original = badWords.map((w) => w.text).join('');

  const pad = 20;
  try {
    const canvas = cropAndScale(
      bitmap,
      Math.max(0, bbox.x0 - pad),
      Math.max(0, bbox.y0 - pad),
      bbox.x1 - bbox.x0 + pad * 2,
      bbox.y1 - bbox.y0 + pad * 2,
      4
    );
    toGrayscale(canvas);
    await worker.setParameters({
      tessedit_pageseg_mode: '7',
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-',
    });
    const { data } = await worker.recognize(canvas);
    const fixed = (data.text || '').trim();
    if (fixed) return course.split(original).join(fixed);
  } catch (err) {
    // keep the original (garbled) course text — user confirms/edits anyway
  }
  return course;
}

function extractDate(text) {
  const m = text.match(/(\d{2})[.\s](\d{1,2})[.\s](\d{1,2})\s*\d{1,2}[:시]\d{2}/);
  if (!m) return null;
  const [, yy, mm, dd] = m;
  const year = 2000 + parseInt(yy, 10);
  const pad = (v) => String(v).padStart(2, '0');
  return `${year}-${pad(mm)}-${pad(dd)}`;
}

// The GolfZone screen lays the three players out vertically (one "featured"
// player with a large stylised score, two collapsed rows below with plain
// text "닉네임 ... 숫자 (±N)"). The collapsed rows' nickname and score are on
// the exact same OCR line, so matching line-by-line is far more reliable
// than distance-in-flattened-text (right-padded whitespace before the score
// can put the *next* player's nickname closer than the correct one). The
// featured player's row is handled separately in refinePlayerScore, since
// its score never reliably lands in the same text line.
function extractScores(lines) {
  const parenRe = /\(\s*([+-]?\d+)\s*\)/;
  const scores = {};
  const usedLines = new Set();

  PLAYERS.forEach((player) => {
    const lineIdx = lines.findIndex((line, i) => !usedLines.has(i) && line.includes(player.name));
    if (lineIdx === -1) return;
    const m = lines[lineIdx].match(parenRe);
    if (m) {
      scores[player.id] = parseInt(m[1], 10);
      usedLines.add(lineIdx);
    }
  });

  return scores;
}

// The course name has no fixed marker of its own, but it always sits right
// above the "코스X.X 그린X.X ..." stat line, which OCRs far more reliably
// (plain small text, no icons/photos overlapping it).
function extractCourse(lines) {
  const statLineIdx = lines.findIndex((l) => /(코스|그린)\s*[\d.]/.test(l));
  if (statLineIdx > 0) {
    return lines[statLineIdx - 1].replace(/[>›]+\s*$/, '').trim();
  }

  const junkPattern = /^[\d:%.\s]*$/;
  for (const line of lines.slice(0, 6)) {
    if (junkPattern.test(line)) continue;
    if (line.length < 2) continue;
    if (PLAYERS.some((p) => p.name === line)) continue;
    return line.replace(/[>›]+\s*$/, '').trim();
  }
  return null;
}
