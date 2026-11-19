const SEED_GAMES = [
  {
    "date": "2024-10-18",
    "course": "골프존카운티 화랑",
    "yardage": 5783,
    "scores": {
      "kim_hm": 2,
      "kim_mk": 1,
      "park": 11
    },
    "excluded": true
  },
  {
    "date": "2024-11-30",
    "course": "윈체스트",
    "yardage": 5757,
    "scores": {
      "kim_hm": -9,
      "kim_mk": 4,
      "park": 12
    },
    "excluded": true
  },
  {
    "date": "2024-12-08",
    "course": "루트 52",
    "yardage": 5753,
    "scores": {
      "kim_hm": -2,
      "kim_mk": 5,
      "park": 12
    },
    "excluded": true
  },
  {
    "date": "2024-12-14",
    "course": "포도 - 포도/자두",
    "yardage": 5955,
    "scores": {
      "kim_hm": -4,
      "kim_mk": 12,
      "park": 25
    },
    "excluded": true
  },
  {
    "date": "2024-12-21",
    "course": "아리지 - 달님/별님",
    "yardage": 5681,
    "scores": {
      "kim_hm": -8,
      "kim_mk": 6,
      "park": 6
    }
  },
  {
    "date": "2024-12-29",
    "course": "한탄강",
    "yardage": 5394,
    "scores": {
      "kim_hm": -1,
      "kim_mk": 15,
      "park": 10
    }
  },
  {
    "date": "2025-01-18",
    "course": "울진마린",
    "yardage": 5975,
    "scores": {
      "kim_hm": -7,
      "kim_mk": 5,
      "park": 20
    }
  },
  {
    "date": "2025-01-25",
    "course": "여수 시티파크",
    "yardage": 5418,
    "scores": {
      "kim_hm": -5,
      "kim_mk": 8,
      "park": 15
    }
  },
  {
    "date": "2025-01-27",
    "course": "함평 엘리체",
    "yardage": 5477,
    "scores": {
      "kim_hm": -4,
      "kim_mk": 9,
      "park": 16
    }
  },
  {
    "date": "2025-02-15",
    "course": "지산 서/동",
    "yardage": 5447,
    "scores": {
      "kim_hm": -11,
      "kim_mk": 13,
      "park": 3
    }
  },
  {
    "date": "2025-02-23",
    "course": "엠스클럽 의성 Master/Challenge",
    "yardage": 5586,
    "scores": {
      "kim_hm": -3,
      "kim_mk": 5,
      "park": 19
    }
  },
  {
    "date": "2025-03-03",
    "course": "하이원",
    "yardage": 5585,
    "scores": {
      "kim_hm": -6,
      "kim_mk": 6,
      "park": 14
    }
  },
  {
    "date": "2025-03-08",
    "course": "골든레이크",
    "yardage": 6084,
    "scores": {
      "kim_hm": -6,
      "kim_mk": 13,
      "park": 16
    }
  },
  {
    "date": "2025-03-15",
    "course": "인터불고 경산",
    "yardage": 6255,
    "scores": {
      "kim_hm": -5,
      "kim_mk": 15,
      "park": 8
    }
  },
  {
    "date": "2025-03-19",
    "course": "동촌",
    "yardage": 5724,
    "scores": {
      "kim_hm": -8,
      "kim_mk": 5,
      "park": 17
    }
  },
  {
    "date": "2025-03-22",
    "course": "한림용인 루비 다이아몬드",
    "yardage": 5745,
    "scores": {
      "kim_hm": -1,
      "kim_mk": 3,
      "park": 10
    }
  },
  {
    "date": "2025-03-30",
    "course": "샴발라",
    "yardage": 5480,
    "scores": {
      "kim_hm": -4,
      "kim_mk": 15,
      "park": 23
    }
  },
  {
    "date": "2025-04-06",
    "course": "설악썬밸리 썬/밸리",
    "yardage": 5568,
    "scores": {
      "kim_hm": -10,
      "kim_mk": 0,
      "park": 9
    }
  },
  {
    "date": "2025-04-12",
    "course": "어등산 어등/송정",
    "yardage": 5979,
    "scores": {
      "kim_hm": -8,
      "kim_mk": 11,
      "park": 13
    }
  },
  {
    "date": "2025-05-05",
    "course": "대관령힐스",
    "yardage": 5745,
    "scores": {
      "kim_hm": -4,
      "kim_mk": 8,
      "park": 10
    }
  },
  {
    "date": "2025-05-11",
    "course": "백제 웅진/사비",
    "yardage": 5683,
    "scores": {
      "kim_hm": -9,
      "kim_mk": 5,
      "park": 10
    }
  },
  {
    "date": "2025-05-23",
    "course": "이천 실크밸리 레이크/실크",
    "yardage": 5600,
    "scores": {
      "kim_hm": -3,
      "kim_mk": -5,
      "park": 12
    }
  },
  {
    "date": "2025-06-06",
    "course": "킹즈락 West/South",
    "yardage": 6041,
    "scores": {
      "kim_hm": -3,
      "kim_mk": 3,
      "park": 20
    }
  },
  {
    "date": "2025-06-15",
    "course": "골프존카운티 경남",
    "yardage": 5327,
    "scores": {
      "kim_hm": -6,
      "kim_mk": 10,
      "park": 20
    }
  },
  {
    "date": "2025-06-18",
    "course": "이천 실크밸리 레이크/실크",
    "yardage": 5600,
    "scores": {
      "kim_hm": -12,
      "kim_mk": 0,
      "park": 15
    }
  },
  {
    "date": "2025-06-28",
    "course": "오투골프리조트 백두/함백",
    "yardage": 5389,
    "scores": {
      "kim_hm": 1,
      "kim_mk": 6,
      "park": 2
    }
  },
  {
    "date": "2025-07-20",
    "course": "일죽 썬밸리",
    "yardage": 5751,
    "scores": {
      "kim_hm": -4,
      "kim_mk": 7,
      "park": 18
    }
  },
  {
    "date": "2025-08-29",
    "course": "써미트 M/S",
    "yardage": 5489,
    "scores": {
      "kim_hm": 1,
      "kim_mk": 4,
      "park": 3
    }
  },
  {
    "date": "2025-08-31",
    "course": "로드힐스",
    "yardage": 5582,
    "scores": {
      "kim_hm": -3,
      "kim_mk": 4,
      "park": 14
    }
  },
  {
    "date": "2025-09-27",
    "course": "이천실크밸리 레이크/실크",
    "yardage": 5600,
    "scores": {
      "kim_hm": -4,
      "kim_mk": 1,
      "park": 8
    }
  },
  {
    "date": "2025-10-04",
    "course": "광주 무등",
    "yardage": 5758,
    "scores": {
      "kim_hm": -7,
      "kim_mk": 18,
      "park": 14
    }
  },
  {
    "date": "2025-10-09",
    "course": "서산수",
    "yardage": 5573,
    "scores": {
      "kim_hm": -6,
      "kim_mk": 5,
      "park": 4
    }
  },
  {
    "date": "2025-10-12",
    "course": "파인리즈",
    "yardage": 6018,
    "scores": {
      "kim_hm": -5,
      "kim_mk": 8,
      "park": 13
    }
  },
  {
    "date": "2025-10-18",
    "course": "써미트 S/K",
    "yardage": 5472,
    "scores": {
      "kim_hm": -9,
      "kim_mk": 19,
      "park": 10
    }
  },
  {
    "date": "2025-10-25",
    "course": "스카이뷰",
    "yardage": 5800,
    "scores": {
      "kim_hm": -10,
      "kim_mk": 21,
      "park": 5
    }
  },
  {
    "date": "2025-11-07",
    "course": "블루원 용인 서/중",
    "yardage": 5615,
    "scores": {
      "kim_hm": -7,
      "kim_mk": 4,
      "park": 7
    }
  },
  {
    "date": "2025-11-21",
    "course": "클럽모우 오아시스/와일드",
    "yardage": 5923,
    "scores": {
      "kim_hm": 2,
      "kim_mk": 16,
      "park": 25
    }
  },
  {
    "date": "2025-12-05",
    "course": "양산",
    "yardage": 5490,
    "scores": {
      "kim_hm": -3,
      "kim_mk": 10,
      "park": 8
    }
  },
  {
    "date": "2025-12-13",
    "course": "해피니스 히든/힐링",
    "yardage": 5632,
    "scores": {
      "kim_hm": -1,
      "kim_mk": 8,
      "park": 11
    }
  },
  {
    "date": "2025-12-20",
    "course": "마이다스밸리 청평",
    "yardage": 5711,
    "scores": {
      "kim_hm": -1,
      "kim_mk": 8,
      "park": 6
    }
  },
  {
    "date": "2025-12-24",
    "course": "클럽모우 마운틴/오아시스",
    "yardage": 5984,
    "scores": {
      "kim_hm": -3,
      "kim_mk": 19,
      "park": 7
    }
  },
  {
    "date": "2025-12-26",
    "course": "해운대 로얄/실크",
    "yardage": 6050,
    "scores": {
      "kim_hm": -1,
      "kim_mk": 11,
      "park": 10
    }
  },
  {
    "date": "2025-12-28",
    "course": "포레스트힐",
    "yardage": 5950,
    "scores": {
      "kim_hm": -6,
      "kim_mk": 20,
      "park": 4
    }
  },
  {
    "date": "2026-01-03",
    "course": "킬레이트",
    "yardage": 5914,
    "scores": {
      "kim_hm": -3,
      "kim_mk": 7,
      "park": 10
    }
  },
  {
    "date": "2026-03-02",
    "course": "골프존카운티 경남",
    "yardage": 5327,
    "scores": {
      "kim_hm": -4,
      "kim_mk": 3,
      "park": 16
    }
  },
  {
    "date": "2026-03-07",
    "course": "써미트 M/S",
    "yardage": 5489,
    "scores": {
      "kim_hm": -6,
      "kim_mk": 6,
      "park": 6
    }
  },
  {
    "date": "2026-03-14",
    "course": "칼레이트",
    "yardage": 5914,
    "scores": {
      "kim_hm": -9,
      "kim_mk": 4,
      "park": 16
    }
  },
  {
    "date": "2026-03-22",
    "course": "오투골프리조트 백두/함백",
    "yardage": 5389,
    "scores": {
      "kim_hm": 4,
      "kim_mk": 12,
      "park": 23
    }
  },
  {
    "date": "2026-03-29",
    "course": "써미트 S/K",
    "yardage": 5472,
    "scores": {
      "kim_hm": -4,
      "kim_mk": -1,
      "park": 9
    }
  },
  {
    "date": "2026-04-03",
    "course": "샤인데일",
    "yardage": 5879,
    "scores": {
      "kim_hm": -3,
      "kim_mk": 10,
      "park": 16
    }
  },
  {
    "date": "2026-04-11",
    "course": "한탄강",
    "yardage": 5394,
    "scores": {
      "kim_hm": -3,
      "kim_mk": 0,
      "park": 4
    }
  },
  {
    "date": "2026-04-26",
    "course": "골프존카운티 천안",
    "yardage": 5813,
    "scores": {
      "kim_hm": -2,
      "kim_mk": 9,
      "park": 14
    }
  },
  {
    "date": "2026-05-08",
    "course": "용원 백로/무학",
    "yardage": 5543,
    "scores": {
      "kim_hm": -8,
      "kim_mk": 10,
      "park": 2
    }
  },
  {
    "date": "2026-06-17",
    "course": "포라이즌 베이/가든",
    "yardage": 5648,
    "scores": {
      "kim_hm": -3,
      "kim_mk": 2,
      "park": 6
    }
  },
  {
    "date": "2026-06-21",
    "course": "의령리온 마운틴/길정",
    "yardage": 6304,
    "scores": {
      "kim_hm": -4,
      "kim_mk": 10,
      "park": 19
    }
  },
  {
    "date": "2026-06-28",
    "course": "원더클럽 신라 서/남",
    "yardage": 5672,
    "scores": {
      "kim_hm": -7,
      "kim_mk": 5,
      "park": 11
    }
  },
  {
    "date": "2026-07-10",
    "course": "오투골프리조트 백두/함백",
    "yardage": 5389,
    "scores": {
      "kim_hm": -1,
      "kim_mk": 14,
      "park": 8
    }
  },
  {
    "date": "2026-07-16",
    "course": "코스카 메이플/릴리",
    "yardage": 5539,
    "scores": {
      "kim_hm": -8,
      "kim_mk": 8,
      "park": 9
    }
  },
  {
    "date": "2026-07-17",
    "course": "장수",
    "yardage": 5912,
    "scores": {
      "kim_hm": -7,
      "kim_mk": 10,
      "park": 11
    }
  },
  {
    "date": "2026-08-02",
    "course": "엠스클럽 의성 챔피온/마스터",
    "yardage": 5634,
    "scores": {
      "kim_hm": 9,
      "kim_mk": 14,
      "park": 15
    }
  },
  {
    "date": "2026-08-19",
    "course": "JNJ 정/남",
    "yardage": 5846,
    "scores": {
      "kim_hm": -3,
      "kim_mk": 3,
      "park": 9
    }
  },
  {
    "date": "2026-09-20",
    "course": "다신베아체 베아체/장보고",
    "yardage": 5893,
    "scores": {
      "kim_hm": 0,
      "kim_mk": -3,
      "park": 14
    }
  },
  {
    "date": "2026-10-09",
    "course": "아델스코트 마운틴/힐",
    "yardage": 5892,
    "scores": {
      "kim_hm": -4,
      "kim_mk": 12,
      "park": 20
    }
  },
  {
    "date": "2026-10-18",
    "course": "한탄강",
    "yardage": 5394,
    "scores": {
      "kim_hm": -2,
      "kim_mk": 7,
      "park": 13
    }
  },
  {
    "date": "2026-10-24",
    "course": "해내다 스카이/마운틴",
    "yardage": 6160,
    "scores": {
      "kim_hm": -6,
      "kim_mk": 6,
      "park": 18
    }
  },
  {
    "date": "2026-11-06",
    "course": "오투리조트 함백/태백",
    "yardage": 5662,
    "scores": {
      "kim_hm": 0,
      "kim_mk": 6,
      "park": 10
    }
  },
  {
    "date": "2026-11-13",
    "course": "자유로 통일/대한",
    "yardage": 5931,
    "scores": {
      "kim_hm": -1,
      "kim_mk": 12,
      "park": 21
    }
  },
  {
    "date": "2026-11-18",
    "course": "지산 동/남",
    "yardage": 5551,
    "scores": {
      "kim_hm": -9,
      "kim_mk": 9,
      "park": 7
    }
  }
];
