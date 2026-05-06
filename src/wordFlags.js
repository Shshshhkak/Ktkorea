/**
 * wordFlags.js
 * 단어 속성(플래그) 비트마스크 정의
 * 원본 C#: AutoKkutuLib/WordFlags.cs, WordCategories.cs
 */

'use strict';

/**
 * 단어 속성 비트마스크 (데이터베이스 flags 컬럼에 저장되는 값)
 * 원본: WordFlags enum
 */
const WordFlags = Object.freeze({
  NONE:               0,
  END_WORD:           1 << 0,   // 한방 단어 (끝말잇기)
  ATTACK_WORD:        1 << 1,   // 공격 단어 (끝말잇기)
  REVERSE_END_WORD:   1 << 2,   // 앞말잇기 한방 단어
  REVERSE_ATTACK_WORD:1 << 3,   // 앞말잇기 공격 단어
  MIDDLE_END_WORD:    1 << 4,   // 가운뎃말잇기 한방 단어
  MIDDLE_ATTACK_WORD: 1 << 5,   // 가운뎃말잇기 공격 단어
  KKUTU_END_WORD:     1 << 6,   // 끄투 한방 단어
  KKUTU_ATTACK_WORD:  1 << 7,   // 끄투 공격 단어
  KKT3:               1 << 8,   // 쿵쿵따 (3글자) 가능 단어
  KKT2:               1 << 9,   // 쿵쿵따 (2글자) 가능 단어
  KKT_END_WORD:       1 << 10,  // 쿵쿵따 한방 단어
  KOREAN:             1 << 11,  // 한국어 단어
  ENGLISH:            1 << 12,  // 영어 단어
  KKT_ATTACK_WORD:    1 << 13,  // 쿵쿵따 공격 단어
  LOAN_WORD:          1 << 14,  // 외래어
  INJEONG:            1 << 15,  // 어인정 단어
  DIALECT:            1 << 16,  // 방언
  DEAD_LANG:          1 << 17,  // 옛말
  MUNHWA:             1 << 18,  // 문화어
});

/**
 * 단어 카테고리 - 검색 결과 분류용
 * 원본: WordCategories enum
 */
const WordCategories = Object.freeze({
  NONE:        0,
  END_WORD:    1 << 0,  // 한방 단어
  ATTACK_WORD: 1 << 1,  // 공격 단어
  MISSION_WORD:1 << 2,  // 미션 글자 포함 단어
});

/**
 * 게임 모드별 한방/공격 단어 플래그를 반환합니다.
 * 원본: FindWordQuery.SelectFlags()
 * @param {string} gameMode
 * @returns {{ endWordFlag: number, attackWordFlag: number }}
 */
function selectFlagsForMode(gameMode) {
  const { GameMode } = require('./gameMode');

  switch (gameMode) {
    case GameMode.FIRST_AND_LAST:
      return { endWordFlag: WordFlags.REVERSE_END_WORD, attackWordFlag: WordFlags.REVERSE_ATTACK_WORD };
    case GameMode.MIDDLE_AND_FIRST:
      return { endWordFlag: WordFlags.MIDDLE_END_WORD, attackWordFlag: WordFlags.MIDDLE_ATTACK_WORD };
    case GameMode.KKUTU:
      return { endWordFlag: WordFlags.KKUTU_END_WORD, attackWordFlag: WordFlags.KKUTU_ATTACK_WORD };
    case GameMode.KUNG_KUNG_TTA:
      return { endWordFlag: WordFlags.KKT_END_WORD, attackWordFlag: WordFlags.KKT_ATTACK_WORD };
    default:
      return { endWordFlag: WordFlags.END_WORD, attackWordFlag: WordFlags.ATTACK_WORD };
  }
}

/**
 * 플래그가 특정 비트를 포함하는지 확인합니다.
 * @param {number} flags
 * @param {number} flag
 * @returns {boolean}
 */
function hasFlag(flags, flag) {
  return (flags & flag) !== 0;
}

/**
 * 단어 플래그의 설명 문자열을 반환합니다.
 * @param {number} flags
 * @returns {string[]}
 */
function describeFlagsArray(flags) {
  const parts = [];
  if (hasFlag(flags, WordFlags.END_WORD))           parts.push('한방');
  if (hasFlag(flags, WordFlags.ATTACK_WORD))        parts.push('공격');
  if (hasFlag(flags, WordFlags.REVERSE_END_WORD))   parts.push('앞말잇기-한방');
  if (hasFlag(flags, WordFlags.REVERSE_ATTACK_WORD))parts.push('앞말잇기-공격');
  if (hasFlag(flags, WordFlags.KKUTU_END_WORD))     parts.push('끄투-한방');
  if (hasFlag(flags, WordFlags.KKUTU_ATTACK_WORD))  parts.push('끄투-공격');
  if (hasFlag(flags, WordFlags.KKT_END_WORD))       parts.push('쿵쿵따-한방');
  if (hasFlag(flags, WordFlags.KKT_ATTACK_WORD))    parts.push('쿵쿵따-공격');
  if (hasFlag(flags, WordFlags.KOREAN))             parts.push('한국어');
  if (hasFlag(flags, WordFlags.ENGLISH))            parts.push('영어');
  if (hasFlag(flags, WordFlags.LOAN_WORD))          parts.push('외래어');
  if (hasFlag(flags, WordFlags.INJEONG))            parts.push('어인정');
  if (hasFlag(flags, WordFlags.DIALECT))            parts.push('방언');
  return parts;
}

/**
 * 단어 카테고리 이름을 반환합니다.
 * 원본: WordPreference.GetName()
 * @param {number} category - WordCategories 값
 * @returns {string}
 */
function getCategoryName(category) {
  let name = '';
  if (category & WordCategories.END_WORD)    name += '한방';
  else if (category & WordCategories.ATTACK_WORD) name += '공격';

  if (category & WordCategories.MISSION_WORD) {
    if (!name) name = '미션';
    else name += ' 미션';
  }

  return name || '일반 단어';
}

/**
 * 기본 단어 우선순위 순서를 반환합니다.
 * 원본: WordPreference.GetDefault()
 * @returns {number[]} WordCategories 값 배열 (높은 우선순위부터)
 */
function getDefaultWordPreference() {
  return [
    WordCategories.END_WORD | WordCategories.MISSION_WORD,   // 한방 미션 단어
    WordCategories.END_WORD,                                  // 한방 단어
    WordCategories.ATTACK_WORD | WordCategories.MISSION_WORD, // 공격 미션 단어
    WordCategories.ATTACK_WORD,                               // 공격 단어
    WordCategories.MISSION_WORD,                              // 미션 단어
    WordCategories.NONE,                                      // 일반 단어
  ];
}

module.exports = {
  WordFlags,
  WordCategories,
  selectFlagsForMode,
  hasFlag,
  describeFlagsArray,
  getCategoryName,
  getDefaultWordPreference,
};
