const PLAYERS = [
  { id: 'park', name: '박프로장난아' },
  { id: 'kim_hm', name: '이기적비거리' },
  { id: 'kim_mk', name: 'kyotokim' },
];

const PLAYER_IDS = PLAYERS.map((p) => p.id);

function playerName(id) {
  const p = PLAYERS.find((p) => p.id === id);
  return p ? p.name : id;
}

// 과거 기록을 가져오기(설정 탭)로 불러오면 이 값은 백업 파일 안의 조정값으로 대체됩니다.
const DEFAULT_MONEY_ADJUSTMENT = { park: 0, kim_hm: 0, kim_mk: 0 };

const LEAGUE_TITLE = 'KISTEP 위례 스크린 챔피언스 리그';

const DEFAULT_PAR = 72;

const HANDICAP_WINDOW = 10;
const TRIM_PERCENT = 0.2;
const RANK_MONEY = { 1: 5000, 1.5: 2500, 2: 0, 2.5: -2500, 3: -5000 };
