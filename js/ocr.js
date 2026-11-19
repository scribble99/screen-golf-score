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
    scores: extractScores(text),
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

function extractScores(text) {
  const scores = {};
  for (const player of PLAYERS) {
    const idx = text.indexOf(player.name);
    if (idx === -1) continue;
    const nearby = text.slice(idx, idx + player.name.length + 60);
    const m = nearby.match(/\(\s*([+-]?\d+)\s*\)/);
    if (m) {
      scores[player.id] = parseInt(m[1], 10);
    }
  }
  return scores;
}

function extractCourse(lines) {
  const junkPattern = /^[\d:%.\s]*$/;
  for (const line of lines.slice(0, 6)) {
    if (junkPattern.test(line)) continue;
    if (line.length < 2) continue;
    if (PLAYERS.some((p) => p.name === line)) continue;
    return line.replace(/[>›]+\s*$/, '').trim();
  }
  return null;
}
