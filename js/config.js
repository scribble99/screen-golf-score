const PLAYERS = [
  { id: 'park', name: '박프로장난아' },
  { id: 'kim_hm', name: '이기적비거리' },
  { id: 'kim_mk', name: 'kyotokim' },
];

const PLAYER_IDS = PLAYERS.map((p) => p.id);

// Column order for the 통계 screen / share image only (data entry, the game
// list, etc. keep PLAYER_IDS order).
const STATS_DISPLAY_ORDER = ['kim_hm', 'kim_mk', 'park'];

// Local-only display-name overrides (e.g. real names instead of nicknames).
// Never hardcoded here — only ever set at runtime from a setting stored in
// IndexedDB (see 설정 탭), so the public source/repo only ever shows
// nicknames while a given install of the app can display whatever name its
// owner typed in.
let playerDisplayOverrides = {};
function setPlayerDisplayNames(map) {
  playerDisplayOverrides = map || {};
}
function playerName(id) {
  if (playerDisplayOverrides[id]) return playerDisplayOverrides[id];
  const p = PLAYERS.find((p) => p.id === id);
  return p ? p.name : id;
}

const LEAGUE_TITLE = 'KISTEP 위례 스크린 챔피언스 리그';

const DEFAULT_PAR = 72;

const HANDICAP_WINDOW = 10;
const TRIM_PERCENT = 0.2;
const RANK_MONEY = { 1: 5000, 1.5: 2500, 2: 0, 2.5: -2500, 3: -5000 };
