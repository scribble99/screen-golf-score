/* Parses a GolfZone result-screen screenshot with Tesseract.js (OCR).
   OCR is never 100% accurate, especially for Korean course names, so the
   caller must always show a confirm/edit form before saving. */

// Matches obvious OCR junk in a course name: stray symbols (misread "CC"
// etc.) or a lone Hangul *jamo* letter (ㄷ, ㅌ, ...) standing on its own —
// real Korean text always uses composed syllable blocks, so an isolated
// jamo character is reliably noise, never a legitimate part of a name.
const JUNK_CHAR_RE = /[<>{}|~`]|[ㄱ-ㆎ]/;

async function recognizeGolfZoneCapture(imageSource, onProgress) {
  if (typeof Tesseract === 'undefined') {
    throw new Error('OCR 라이브러리를 아직 불러오지 못했습니다. 인터넷 연결을 확인해주세요.');
  }
  const report = (pct) => onProgress && onProgress(pct);

  const mainWorker = await Tesseract.createWorker('kor+eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') report(Math.round(m.progress * 70));
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

  const { scores, strokes } = extractScores(lines);
  let course = extractCourse(lines);
  const yardage = extractYardage(text);
  const date = extractDate(text);

  // The featured player (the one with the big hole-by-hole table instead of
  // a plain "닉네임 ... (±N)" row) never reliably shows "(±N)" on its own —
  // the combined kor+eng model mangles that stylised badge differently on
  // almost every screenshot (missing digits, "+" read as "1", everything
  // fused into one blob, ...). Instead of trying to re-read that badge, we
  // sum the hole table's own "Score" row totals (the plain number at the
  // end of the row right after each "Par" row) for the front/back nine —
  // that total is already the signed relative-to-par score, and this row
  // reads far more reliably since it's plain monospace-style digits.
  PLAYERS.forEach((player) => {
    if (scores[player.id] !== undefined) return;
    const fromHoleTable = extractFeaturedPlayerScore(lines);
    if (fromHoleTable !== null) scores[player.id] = fromHoleTable;
  });

  // The two collapsed rows' "(±N)" often loses just its +/- sign to OCR
  // (e.g. "(-4)" read as "(4)") even though the stroke total right before it
  // ("68") and the course's total par (from the hole table, always plain
  // positive digits) both read fine. Recomputing relative = strokes − par
  // sidesteps the unreliable sign glyph entirely, so prefer it whenever
  // we have both numbers.
  const coursePar = extractCoursePar(lines);
  if (coursePar !== null) {
    PLAYERS.forEach((player) => {
      if (strokes[player.id] !== undefined) {
        scores[player.id] = strokes[player.id] - coursePar;
      }
    });
  }

  // "CC" (and similar short Latin abbreviations) in the course title is the
  // one thing the combined kor+eng model reads badly even when otherwise
  // isolated correctly — re-crop just that word (located from this pass's
  // own word positions, not hardcoded coordinates) and re-read it with an
  // English-only model, which handles Latin letters far better.
  if (course && JUNK_CHAR_RE.test(course) && typeof createImageBitmap === 'function') {
    let bitmap;
    try {
      bitmap = await createImageBitmap(imageSource);
    } catch (err) {
      bitmap = null;
    }
    if (bitmap) {
      const refineWorker = await Tesseract.createWorker('eng', 1);
      try {
        const ocrLines = groupWordsByLine(flattenWords(data.blocks));
        const courseLine = findCourseLineObject(lines, ocrLines);
        course = await refineCourseName(course, courseLine, bitmap, refineWorker);
      } finally {
        await refineWorker.terminate();
        if (bitmap.close) bitmap.close();
      }
    }
  }

  // Last resort: if the course name still looks garbled, check it against
  // courses already played before (cross-validating against the existing
  // game history) — a unique match on the Korean-only portion is a much
  // stronger signal than anything OCR alone can offer.
  if (course && JUNK_CHAR_RE.test(course)) {
    course = fuzzyMatchKnownCourse(course);
  }

  report(100);
  return { rawText: text, date, course, yardage, scores };
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

// The hole-by-hole table only appears for the featured player. Each half
// (front/back nine) has a "Par ..." row immediately followed by a "Score
// ..." row that ends with that half's relative-to-par subtotal (birdies
// etc. already netted in). OCR mangles "Par"/"Score" spelling and the
// boxed/circled per-hole marks inconsistently, but the row ORDER and the
// trailing subtotal are reliable, so we don't need to parse the middle of
// either row at all.
function extractFeaturedPlayerScore(lines) {
  let total = null;
  for (let i = 0; i < lines.length - 1; i++) {
    if (!/^(Par|Pr)\b/i.test(lines[i])) continue;
    const m = lines[i + 1].match(/(-?\d+)\s*$/);
    if (m) total = (total || 0) + parseInt(m[1], 10);
  }
  return total;
}

// The course's total par is the sum of the "Par ..." rows' own trailing
// totals (e.g. 36 + 36 = 72, or 36 + 37 = 73 for an uneven course) — always
// plain positive digits, read very reliably.
function extractCoursePar(lines) {
  let total = null;
  lines.forEach((line) => {
    if (!/^(Par|Pr)\b/i.test(line)) return;
    const m = line.match(/(\d+)\s*$/);
    if (m) total = (total || 0) + parseInt(m[1], 10);
  });
  return total;
}

// Locates the specific OCR line the course title was read from, so garbled
// word lookup never matches unrelated UI chrome (e.g. the back-arrow icon,
// also sometimes misread as "<") elsewhere on screen.
function findCourseLineObject(lines, ocrLines) {
  const idx = findCourseLineIndex(lines);
  return idx >= 0 && ocrLines[idx] ? ocrLines[idx] : null;
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
    if (JUNK_CHAR_RE.test(w.text)) {
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

// OCR drops date separators (dots/space/colon) inconsistently — sometimes
// all of them ("2611060921"), sometimes only some ("26.032909:20"). A single
// pattern with every separator optional handles every combination, as long
// as each field stays exactly 2 digits (which GolfZone always zero-pads).
function extractDateFromLine(line) {
  const m = line.match(/(\d{2})[.\s]?(\d{2})[.\s]?(\d{2})[.\s]?(\d{2})[:시]?(\d{2})/);
  if (!m) return null;
  const [, yy, mm, dd, hh, mi] = m;
  if (!(+mm >= 1 && +mm <= 12 && +dd >= 1 && +dd <= 31 && +hh <= 23 && +mi <= 59)) {
    return null;
  }
  const year = 2000 + parseInt(yy, 10);
  const pad = (v) => String(v).padStart(2, '0');
  return `${year}-${pad(mm)}-${pad(dd)}`;
}

function extractDate(text) {
  for (const line of text.split('\n')) {
    const d = extractDateFromLine(line);
    if (d) return d;
  }
  return null;
}

// Course total yardage ("White 5,551m") always has a comma-grouped 4-digit
// meter value, which reliably tells it apart from the small putt-distance
// mentions ("PT 11m") that appear later on the same screen.
function extractYardage(text) {
  const m = text.match(/(\d{1,2},\d{3})\s*m\b/);
  if (!m) return null;
  return parseInt(m[1].replace(/,/g, ''), 10);
}

// The GolfZone screen lays the three players out vertically (one "featured"
// player with a large stylised score and a hole-by-hole table, two
// collapsed rows below with plain text "닉네임 ... 숫자 (±N)"). The collapsed
// rows' nickname and score are on the exact same OCR line, so matching
// line-by-line is far more reliable than distance-in-flattened-text
// (right-padded whitespace before the score can put the *next* player's
// nickname closer than the correct one). The featured player's score is
// handled separately in extractFeaturedPlayerScore.
function extractScores(lines) {
  const strokesRe = /(\d{2,3})\D{0,6}\(\s*([+-]?\d+)\s*\)/;
  const scores = {};
  const strokes = {};
  const usedLines = new Set();

  PLAYERS.forEach((player) => {
    const lineIdx = lines.findIndex((line, i) => !usedLines.has(i) && line.includes(player.name));
    if (lineIdx === -1) return;
    const m = lines[lineIdx].match(strokesRe);
    if (m) {
      strokes[player.id] = parseInt(m[1], 10);
      scores[player.id] = parseInt(m[2], 10);
      usedLines.add(lineIdx);
    }
  });

  return { scores, strokes };
}

// The course title is always exactly one line above the "코스X.X 그린X.X"
// stat line. That marker text itself is sometimes OCR'd beyond recognition,
// so as a fallback we anchor off the date line instead (date/time reads far
// more reliably) — the course title is always exactly 2 lines above it,
// with the stat line in between.
function findCourseLineIndex(lines) {
  const statIdx = lines.findIndex((l) => /(코스|그린)\s*[\d.]/.test(l));
  if (statIdx > 0) return statIdx - 1;

  const dateIdx = lines.findIndex((l) => extractDateFromLine(l) !== null);
  if (dateIdx >= 2) return dateIdx - 2;

  return -1;
}

// Populated by app.js from the game list (seed history + whatever the user
// has entered) so OCR can cross-check a shaky course-name read against
// places this group has actually played before.
let KNOWN_COURSES = [];
function setKnownCourses(list) {
  KNOWN_COURSES = list || [];
}

function stripToKoreanSyllables(s) {
  return (s || '').replace(/[^가-힣]/g, '');
}

// Only ever called when `course` still contains obvious OCR junk. Composed
// Hangul syllables are the one part of a course name OCR reads reliably, so
// comparing just that (ignoring spaces/"CC"/dashes/digits/stray symbols)
// against known course names can confidently recover names that still have
// garbage mixed in elsewhere in the string. Only acts on an unambiguous
// match — if two known courses share the same Korean-only form (e.g. "써미트
// M/S" vs "써미트 S/K"), the Latin suffix is exactly the unreliable part, so
// we leave the text as-is rather than guess.
function fuzzyMatchKnownCourse(course) {
  const stripped = stripToKoreanSyllables(course);
  if (!stripped || !KNOWN_COURSES.length) return course;

  const exact = [...new Set(KNOWN_COURSES.filter((k) => stripToKoreanSyllables(k) === stripped))];
  if (exact.length === 1) return exact[0];

  const prefixed = [
    ...new Set(
      KNOWN_COURSES.filter((k) => {
        const ks = stripToKoreanSyllables(k);
        return ks && stripped.startsWith(ks);
      })
    ),
  ];
  if (prefixed.length === 1) return prefixed[0];

  return course;
}

function extractCourse(lines) {
  const idx = findCourseLineIndex(lines);
  if (idx >= 0) {
    return lines[idx].replace(/[>›]+\s*$/, '').trim();
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
