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
function rankAvgMap(valuesObj) {
  const entries = Object.entries(valuesObj);
  const result = {};
  for (const [pid, val] of entries) {
    const equal = entries.filter(([, v]) => v === val).length;
    const less = entries.filter(([, v]) => v < val).length;
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

// Walks the games chronologically, computing the handicap that was in
// effect going into each game, the handicap-adjusted score, and both
// ranks (handicap-reflected / raw).
function computeTimeline(games) {
  const sorted = sortGames(games);
  const history = {};
  PLAYER_IDS.forEach((p) => (history[p] = []));
  const timeline = [];

  sorted.forEach((game, idx) => {
    const handicapBefore = {};
    PLAYER_IDS.forEach((p) => {
      handicapBefore[p] = computeHandicap(history[p]);
    });

    const hasFullHandicap = PLAYER_IDS.every((p) => handicapBefore[p] !== null);
    const adjusted = {};
    PLAYER_IDS.forEach((p) => {
      adjusted[p] = hasFullHandicap ? game.scores[p] - handicapBefore[p] : null;
    });

    const rankRaw = rankAvgMap(game.scores);
    const rankAdj = hasFullHandicap ? rankAvgMap(adjusted) : rankRaw;

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

// Every unique pair of players, with the absolute gap between their current
// handicaps (e.g. "박종화-김현민" → |12.3 − (−9.0)| = 21.3).
function computeHandicapGaps(stats) {
  const pairs = [];
  for (let i = 0; i < PLAYER_IDS.length; i++) {
    for (let j = i + 1; j < PLAYER_IDS.length; j++) {
      const a = PLAYER_IDS[i];
      const b = PLAYER_IDS[j];
      const ha = stats[a].handicap;
      const hb = stats[b].handicap;
      pairs.push({
        a,
        b,
        label: `${playerName(a)}-${playerName(b)}`,
        gap: ha !== null && hb !== null ? Math.abs(ha - hb) : null,
      });
    }
  }
  return pairs;
}

// Top games (by default up to 10) where `playerId` won solo first place by
// handicap-adjusted score, ranked by how big a margin they won by — i.e.
// how much lower their adjusted score was than the next-best opponent's.
function computeCourseRecommendations(timeline, playerId, limit) {
  const wins = [];
  timeline.forEach((game) => {
    if (game.rankAdj[playerId] !== 1) return;
    const othersAdj = PLAYER_IDS.filter((p) => p !== playerId).map((p) => game.adjusted[p]);
    const margin = Math.min(...othersAdj) - game.adjusted[playerId];
    wins.push({
      date: game.date,
      course: game.course,
      yardage: game.yardage ?? null,
      scores: game.scores,
      margin,
    });
  });
  wins.sort((a, b) => b.margin - a.margin);
  return wins.slice(0, limit || 10);
}
