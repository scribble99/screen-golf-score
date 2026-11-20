/* Score statistics engine — ported from the original Excel sheet's formulas
   (TRIMMEAN handicap, RANK.AVG ranking, LINEST trend, settlement money). */

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function trimmedMean(arr, percent) {
  const n = arr.length;
  const sorted = [...arr].sort((a, b) => a - b);
  const totalTrim = Math.floor(n * percent);
  const each = Math.floor(totalTrim / 2);
  const sliced = each > 0 ? sorted.slice(each, n - each) : sorted;
  return average(sliced);
}

function computeHandicap(priorScores) {
  if (priorScores.length === 0) return null;
  const window = priorScores.slice(-HANDICAP_WINDOW);
  if (window.length >= HANDICAP_WINDOW) {
    return trimmedMean(window, TRIM_PERCENT);
  }
  return average(window);
}

// RANK.AVG, ascending (lowest value = rank 1), ties share the average rank.
// Uses an epsilon instead of strict equality — subtracting two handicaps
// from two scores (e.g. 7 - 2.8 vs 18 - 13.8) can land a hair apart in
// floating point even though they're the same value, which would otherwise
// turn a real tie into two different ranks.
const RANK_EPSILON = 1e-9;
function rankAvgMap(valuesObj) {
  const entries = Object.entries(valuesObj);
  const result = {};
  for (const [pid, val] of entries) {
    const equal = entries.filter(([, v]) => Math.abs(v - val) < RANK_EPSILON).length;
    const less = entries.filter(([, v]) => val - v > RANK_EPSILON).length;
    result[pid] = less + (equal + 1) / 2;
  }
  return result;
}

function populationStdev(arr) {
  const m = average(arr);
  return Math.sqrt(average(arr.map((v) => (v - m) ** 2)));
}

// Least-squares slope of y over x = 1..n (matches Excel LINEST(y)).
function linearSlope(ys) {
  const n = ys.length;
  if (n < 2) return null;
  const xs = ys.map((_, i) => i + 1);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumXX = xs.reduce((a, x) => a + x * x, 0);
  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
}

function sortGames(games) {
  return [...games].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.id || 0) - (b.id || 0);
  });
}

// The original Excel sheet used a different handicap formula ("최근 5경기
// 단순평균") for the games right after ranking officially started, before
// switching to the documented "최근 10경기 최고·최저 제외 평균" rule used
// everywhere else (and by this app). LEGACY_HANDICAP_AFTER[i] is the
// Excel-computed handicap *after* ranked game i (0-based; ranked game 0 is
// the sheet's row 38) for each of the 29 games this applies to — used as
// handicapBefore for the following game, so the historical rank/stat
// breakdown matches the spreadsheet exactly instead of only the final
// handicap number.
const LEGACY_HANDICAP_AFTER = [
  { kim_hm: -4.2, kim_mk: 5.6, park: 13.2 },
  { kim_hm: -4.8, kim_mk: 8.4, park: 13 },
  { kim_hm: -4.4, kim_mk: 8.6, park: 14.6 },
  { kim_hm: -5, kim_mk: 9.2, park: 15.2 },
  { kim_hm: -5, kim_mk: 8.6, park: 13.4 },
  { kim_hm: -5.6, kim_mk: 10, park: 12.8 },
  { kim_hm: -6, kim_mk: 8, park: 14.6 },
  { kim_hm: -5.8, kim_mk: 8.2, park: 13.4 },
  { kim_hm: -6, kim_mk: 9.2, park: 13.6 },
  { kim_hm: -6.2, kim_mk: 10.4, park: 12 },
  { kim_hm: -5.6, kim_mk: 8.8, park: 14.8 },
  { kim_hm: -5.2, kim_mk: 8.4, park: 13 },
  { kim_hm: -4.8, kim_mk: 10.2, park: 14.8 },
  { kim_hm: -5.6, kim_mk: 7.6, park: 13.4 },
  { kim_hm: -6.2, kim_mk: 6.8, park: 14.4 },
  { kim_hm: -5.4, kim_mk: 7.4, park: 13 },
  { kim_hm: -7, kim_mk: 7.8, park: 13 },
  { kim_hm: -6.8, kim_mk: 3.8, park: 10.8 },
  { kim_hm: -5.4, kim_mk: 4.4, park: 13 },
  { kim_hm: -5, kim_mk: 4.2, park: 14.4 },
  { kim_hm: -6.6, kim_mk: 2.6, park: 15.4 },
  { kim_hm: -4.6, kim_mk: 2.8, park: 13.8 },
  { kim_hm: -4.8, kim_mk: 5.2, park: 15 },
  { kim_hm: -4, kim_mk: 5.4, park: 11.6 },
  { kim_hm: -3.4, kim_mk: 4.2, park: 10.4 },
  { kim_hm: -1.8, kim_mk: 4.4, park: 9 },
  { kim_hm: -3.4, kim_mk: 6.8, park: 11.4 },
  { kim_hm: -3.8, kim_mk: 6.4, park: 8.6 },
  { kim_hm: -5, kim_mk: 7.2, park: 10.6 },
];

// Likewise hand-entered in the Excel sheet for the very first ranked game
// (no handicap history existed yet to fall back on).
const LEGACY_FIRST_GAME_RANK = { kim_hm: 2, kim_mk: 3, park: 1 };

// Walks the games chronologically, computing the handicap that was in
// effect going into each game, the handicap-adjusted score, and both
// ranks (handicap-reflected / raw).
function computeTimeline(games) {
  const sorted = sortGames(games);
  const history = {};
  PLAYER_IDS.forEach((p) => (history[p] = []));
  const timeline = [];

  sorted.forEach((game, idx) => {
    const legacy = LEGACY_HANDICAP_AFTER[idx - 1];
    const handicapBefore = {};
    PLAYER_IDS.forEach((p) => {
      handicapBefore[p] = legacy ? legacy[p] : computeHandicap(history[p]);
    });

    const hasFullHandicap = PLAYER_IDS.every((p) => handicapBefore[p] !== null);
    const adjusted = {};
    PLAYER_IDS.forEach((p) => {
      adjusted[p] = hasFullHandicap ? game.scores[p] - handicapBefore[p] : null;
    });

    const rankRaw = rankAvgMap(game.scores);
    // The very first ranked game in the Excel sheet has no prior handicap
    // history either, but its rank was hand-entered rather than falling
    // back to the raw-score rank — reproduce that exact value.
    const rankAdj = idx === 0 ? { ...LEGACY_FIRST_GAME_RANK } : hasFullHandicap ? rankAvgMap(adjusted) : rankRaw;

    timeline.push({ ...game, handicapBefore, adjusted, rankRaw, rankAdj });

    PLAYER_IDS.forEach((p) => history[p].push(game.scores[p]));
  });

  return timeline;
}

function bucketCounts(timeline, rankField) {
  const buckets = { park: {}, kim_hm: {}, kim_mk: {} };
  [1, 1.5, 2, 2.5, 3].forEach((r) => {
    PLAYER_IDS.forEach((p) => (buckets[p][r] = 0));
  });
  timeline.forEach((g) => {
    PLAYER_IDS.forEach((p) => {
      const r = g[rankField][p];
      if (buckets[p][r] !== undefined) buckets[p][r] += 1;
    });
  });
  return buckets;
}

function computeStats(games) {
  const ranked = games.filter((g) => !g.excluded);
  const timeline = computeTimeline(ranked);
  const n = timeline.length;

  const rankBucketsHandicap = bucketCounts(timeline, 'rankAdj');
  const rankBucketsRaw = bucketCounts(timeline, 'rankRaw');

  const stats = {};
  PLAYER_IDS.forEach((p) => {
    const rawScores = timeline.map((g) => g.scores[p]);
    const adjRanks = timeline.map((g) => g.rankAdj[p]);
    const last = timeline[n - 1];
    const prev = timeline[n - 2];

    // 당일 핸디 대비 순위: 1위 +5,000원 / 2위 0원 / 3위 -5,000원.
    // 동률(1.5, 2.5)은 인접한 두 금액의 평균으로 자연스럽게 보간된다.
    const money = [1, 1.5, 2.5, 3].reduce(
      (sum, r) => sum + rankBucketsHandicap[p][r] * RANK_MONEY[r],
      0
    );

    const recentWindow = rawScores.slice(-HANDICAP_WINDOW);
    const trend = linearSlope(recentWindow);

    stats[p] = {
      handicap: last ? last.handicapBefore[p] ?? computeHandicap(rawScores) : null,
      handicapDelta:
        last && prev
          ? (last.handicapBefore[p] ?? 0) - (prev.handicapBefore[p] ?? 0)
          : 0,
      avgRank: n ? average(adjRanks) : null,
      best: n ? Math.min(...rawScores) : null,
      worst: n ? Math.max(...rawScores) : null,
      stdev: n ? populationStdev(rawScores) : null,
      money,
      rankBucketsHandicap: rankBucketsHandicap[p],
      rankBucketsRaw: rankBucketsRaw[p],
      trend,
    };
  });

  // Current handicap should reflect ALL games played so far (i.e. the
  // handicap that would apply to the *next* game), not just "before the
  // last game".
  PLAYER_IDS.forEach((p) => {
    const rawScores = timeline.map((g) => g.scores[p]);
    stats[p].handicap = computeHandicap(rawScores);
    if (n >= 2) {
      const prevRawScores = timeline.slice(0, -1).map((g) => g.scores[p]);
      stats[p].handicapDelta = stats[p].handicap - computeHandicap(prevRawScores);
    }
  });

  const recentGames = [...timeline].reverse().slice(0, HANDICAP_WINDOW);
  const justDropped = timeline.length > HANDICAP_WINDOW ? timeline[timeline.length - HANDICAP_WINDOW - 1] : null;

  return { timeline, stats, recentGames, justDropped, totalGames: n };
}

function round1(v) {
  return v === null || v === undefined ? null : Math.round(v * 10) / 10;
}

// Every unique pair of players, with the gap between their current
// handicaps — computed from the *rounded* (1-decimal, same as displayed)
// handicaps, so the shown numbers are internally consistent
// (e.g. displayed 13.8 and −2.9 → gap shows 16.7, not 16.6 from the
// unrounded 13.75 − (−2.875)).
function computeHandicapGaps(stats) {
  const pairs = [];
  for (let i = 0; i < PLAYER_IDS.length; i++) {
    for (let j = i + 1; j < PLAYER_IDS.length; j++) {
      const a = PLAYER_IDS[i];
      const b = PLAYER_IDS[j];
      const ha = round1(stats[a].handicap);
      const hb = round1(stats[b].handicap);
      pairs.push({
        a,
        b,
        label: `${playerName(a)}-${playerName(b)}`,
        gap: ha !== null && hb !== null ? round1(Math.abs(ha - hb)) : null,
      });
    }
  }
  return pairs;
}

function mean(arr) {
  return arr.length ? average(arr) : null;
}

// z-score of each value against the group's own mean/stdev — lets factors
// on unrelated scales (score strokes vs. meters) combine into one weighted
// sum. A zero-stdev group (e.g. only one course, or every course tied)
// collapses to all-zero so it contributes nothing rather than dividing by 0.
function zScores(values) {
  const present = values.filter((v) => v !== null);
  if (present.length < 2) return values.map(() => 0);
  const m = average(present);
  const sd = populationStdev(present);
  return values.map((v) => (v === null || sd === 0 ? 0 : (v - m) / sd));
}

// Relative weight of each factor in the recommendation composite score.
// Listed roughly in the priority order requested: handicap-adjusted
// performance first, then raw score, then margin over the other two
// players, then a mild preference for shorter courses.
const RECOMMEND_WEIGHTS = {
  adjusted: 0.35, // 핸디 대비 스코어 (낮을수록 좋음)
  raw: 0.25, // 핸디 없는 절대 스코어 (낮을수록 좋음)
  margin: 0.25, // 다른 두 선수와의 격차 (클수록 좋음)
  yardage: 0.15, // 전장 길이 (짧을수록 좋음, 선호도이지 필터 아님)
};

// Recommends courses for `playerId`, aggregated by course name so repeat
// visits to the same course contribute one averaged record instead of N
// separate entries ("동일 코스 기록은 평균으로 적용"). Each course is scored
// on four factors, each standardized (z-score) against the player's own
// course list so strokes and meters combine on a comparable scale, then
// combined into one weighted composite:
//   - avgAdjusted: 평균 핸디 대비 스코어 — 그 코스에서 본인 핸디 대비 얼마나
//     잘 쳤는지(낮을수록 좋음). 메인 신호.
//   - avgRaw: 평균 절대 스코어(파 대비, 핸디 미반영) — 핸디가 흔들려도 실제
//     타수 자체가 낮은 코스를 반영(낮을수록 좋음).
//   - avgMargin: 평균 격차 — 나머지 두 선수의 핸디 대비 스코어 평균 대비
//     본인이 얼마나 앞섰는지(핸디 대비 기준, 클수록 좋음 = 상대를 압도).
//   - avgYardage: 평균 전장(m) — 짧을수록 가점(강제 필터가 아니라 선호 가중치).
// Only games with an established handicap (adjusted !== null) are used, so
// every course's four factors come from the same basis; courses with too
// little handicap history yet are simply excluded rather than scored on
// incomplete data. Returns up to `limit` courses sorted by composite score.
function computeCourseRecommendations(timeline, playerId, limit) {
  const others = PLAYER_IDS.filter((p) => p !== playerId);
  const byCourse = new Map();

  timeline.forEach((game) => {
    if (game.adjusted[playerId] === null) return;
    if (!byCourse.has(game.course)) {
      byCourse.set(game.course, {
        course: game.course,
        adjustedList: [],
        rawList: [],
        marginList: [],
        yardageList: [],
        dates: [],
      });
    }
    const entry = byCourse.get(game.course);
    entry.adjustedList.push(game.adjusted[playerId]);
    entry.rawList.push(game.scores[playerId]);
    const othersAvgAdjusted = average(others.map((p) => game.adjusted[p]));
    entry.marginList.push(othersAvgAdjusted - game.adjusted[playerId]);
    if (game.yardage) entry.yardageList.push(game.yardage);
    entry.dates.push(game.date);
  });

  const courses = [...byCourse.values()].map((entry) => ({
    course: entry.course,
    games: entry.adjustedList.length,
    lastDate: entry.dates.reduce((a, b) => (b > a ? b : a)),
    avgAdjusted: mean(entry.adjustedList),
    avgRaw: mean(entry.rawList),
    avgMargin: mean(entry.marginList),
    avgYardage: mean(entry.yardageList),
  }));

  const zAdjusted = zScores(courses.map((c) => c.avgAdjusted));
  const zRaw = zScores(courses.map((c) => c.avgRaw));
  const zMargin = zScores(courses.map((c) => c.avgMargin));
  const zYardage = zScores(courses.map((c) => c.avgYardage));

  courses.forEach((c, i) => {
    c.score =
      RECOMMEND_WEIGHTS.adjusted * -zAdjusted[i] +
      RECOMMEND_WEIGHTS.raw * -zRaw[i] +
      RECOMMEND_WEIGHTS.margin * zMargin[i] +
      RECOMMEND_WEIGHTS.yardage * -zYardage[i];
  });

  courses.sort((a, b) => b.score - a.score);
  return courses.slice(0, limit || 10);
}
