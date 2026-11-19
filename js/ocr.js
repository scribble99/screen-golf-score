/* Parses a GolfZone result-screen screenshot with Tesseract.js (OCR).
   OCR is never 100% accurate, especially for Korean course names, so the
   caller must always show a confirm/edit form before saving. */

async function recognizeGolfZoneCapture(imageSource, onProgress) {
  if (typeof Tesseract === 'undefined') {
    throw new Error('OCR 라이브러리를 아직 불러오지 못했습니다. 인터넷 연결을 확인해주세요.');
  }

  const { data } = await Tesseract.recognize(imageSource, 'kor+eng', {
    logger: (m) => {
      if (onProgress && m.status === 'recognizing text') {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });

  const text = data.text || '';
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return {
    rawText: text,
    date: extractDate(text),
    course: extractCourse(lines),
    scores: extractScores(lines),
  };
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
// featured player's block is OCR'd far worse (large colored badge font), so
// as a fallback we assign any leftover "(±N)" line, in on-screen order, to
// whichever player's nickname couldn't be matched directly.
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

  const leftoverPlayers = PLAYERS.map((p) => p.id).filter((id) => scores[id] === undefined);
  const leftoverParenLines = lines
    .map((line, i) => ({ line, i }))
    .filter(({ line, i }) => !usedLines.has(i) && parenRe.test(line));
  leftoverPlayers.forEach((pid, i) => {
    const entry = leftoverParenLines[i];
    if (entry) scores[pid] = parseInt(entry.line.match(parenRe)[1], 10);
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
