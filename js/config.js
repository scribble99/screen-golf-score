const PLAYERS = [
  { id: 'park', name: '박종화', nicknames: ['박프로장난아'] },
  { id: 'kim_hm', name: '김현민', nicknames: ['이기적비거리'] },
  { id: 'kim_mk', name: '김민기', nicknames: ['kyotokim'] },
];

const PLAYER_IDS = PLAYERS.map((p) => p.id);

function playerName(id) {
  const p = PLAYERS.find((p) => p.id === id);
  return p ? p.name : id;
}

// 과거 엑셀 운영 기간 중 공식 집계 방식이 일부 바뀐 적이 있어, 그 시기의 손익을
// 현재 엑셀 최종 값과 정확히 맞추기 위한 보정값. (정상 운영 시에는 수정할 필요 없음)
const DEFAULT_MONEY_ADJUSTMENT = { park: 2500, kim_hm: -7000, kim_mk: 4500 };

const LEAGUE_TITLE = 'KISTEP 위례 스크린 챔피언스 리그';

const HANDICAP_WINDOW = 10;
const TRIM_PERCENT = 0.2;
const RANK_MONEY = { 1: 5000, 1.5: 2500, 2: 0, 2.5: -2500, 3: -5000 };
