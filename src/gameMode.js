/**
 * gameMode.js
 * 게임 모드 정의 및 모드별 단어 노드 변환 로직
 * 원본 C#: AutoKkutuLib/GameMode.cs, AutoKkutuLib/Extension/GameModeExtension.cs, WordToNodeExtension.cs
 */

'use strict';

// ===== 게임 모드 열거형 =====
const GameMode = Object.freeze({
  NONE:             'None',
  LAST_AND_FIRST:   'LastAndFirst',   // 끝말잇기
  FIRST_AND_LAST:   'FirstAndLast',   // 앞말잇기
  MIDDLE_AND_FIRST: 'MiddleAndFirst', // 가운뎃말잇기
  KKUTU:            'Kkutu',          // 끄투
  KUNG_KUNG_TTA:    'KungKungTta',    // 쿵쿵따
  TYPING_BATTLE:    'TypingBattle',   // 타자 대결
  ALL:              'All',            // 전체
  FREE:             'Free',           // 자유
  LAST_AND_FIRST_FREE: 'LastAndFirstFree', // 자유 끝말잇기
  HUNMIN:           'Hunmin',         // 훈민정음
});

// 게임 모드 한국어 이름 매핑
const GAME_MODE_NAMES = {
  [GameMode.N2ONE]:             '없음',
  [GameMode.LAST_AND_FIRST]:   '끝말잇기',
  [GameMode.FIRST_AND_LAST]:   '앞말잇기',
  [GameMode.MIDDLE_AND_FIRST]: '가운뎃말잇기',
  [GameMode.KKUTU]:            '끄투',
  [GameMode.KUNG_KUNG_TTA]:    '쿵쿵따',
  [GameMode.TYPING_BATTLE]:    '타자 대결',
  [GameMode.ALL]:              '전체',
  [GameMode.FREE]:             '자유',
  [GameMode.LAST_AND_FIRST_FREE]: '자유 끝말잇기',
  [GameMode.HUNMIN]:           '훈민정음',
};

// ===== 단어 → 노드 변환 함수들 =====
// 원본: AutoKkutuLib/Extension/WordToNodeExtension.cs

/**
 * 끝말잇기: 단어의 마지막 글자(TAIL 노드)를 반환합니다.
 * 예: '안녕하세요' → '요'
 * @param {string} word
 * @returns {string}
 */
function getLaFTailNode(word) {
  if (!word) throw new Error('word is null or empty');
  return word[word.length - 1];
}

/**
 * 앞말잇기: 단어의 첫 글자(TAIL 노드)를 반환합니다.
 * 예: '안녕하세요' → '안'
 * @param {string} word
 * @returns {string}
 */
function getFaLTailNode(word) {
  if (!word) throw new Error('word is null or empty');
  return word[0];
}

/**
 * 끄투: 단어의 끝 두 글자(TAIL 노드)를 반환합니다.
 * 4글자 이상이면 끝 2자, 그 이하이면 마지막 글자 1개
 * 예: '안녕하세요' → '세요', '가나다' → '다'
 * @param {string} word
 * @returns {string}
 */
function getKkutuTailNode(word) {
  if (!word) throw new Error('word is null or empty');
  return word.length >= 4 ? word.slice(-2) : word[word.length - 1];
}

/**
 * 끄투: 단어의 앞 두 글자(HEAD 노드)를 반환합니다.
 * @param {string} word
 * @returns {string}
 */
function getKkutuHeadNode(word) {
  if (!word) throw new Error('word is null or empty');
  if (word.length >= 4) return word.slice(0, 2);
  if (word.length >= 3) return word[0];
  return '';
}

/**
 * 가운뎃말잇기: 단어의 중간 글자(TAIL 노드)를 반환합니다.
 * 예: '안녕하세요' → '하', '가나다라' → '나'
 * @param {string} word
 * @returns {string}
 */
function getMaFTailNode(word) {
  if (!word) throw new Error('word is null or empty');
  return word[Math.floor((word.length - 1) / 2)];
}

/**
 * 게임 모드에 맞는 TAIL 노드를 반환합니다.
 * 원본: GameModeExtension.ConvertWordToTailNode()
 * @param {string} gameMode - GameMode 상수값
 * @param {string} word     - 현재 제시된 단어
 * @returns {string|null}
 */
function convertWordToTailNode(gameMode, word) {
  if (!word || !word.trim()) throw new Error('word is null or blank');

  switch (gameMode) {
    case GameMode.LAST_AND_FIRST:
    case GameMode.KUNG_KUNG_TTA:
    case GameMode.LAST_AND_FIRST_FREE:
      return getLaFTailNode(word);

    case GameMode.FIRST_AND_LAST:
      return getFaLTailNode(word);

    case GameMode.MIDDLE_AND_FIRST:
      // 3글자 이상이고 홀수 글자일 때만 유효
      if (word.length > 2 && word.length % 2 === 1) {
        return getMaFTailNode(word);
      }
      return null;

    case GameMode.KKUTU:
      return getKkutuTailNode(word);

    case GameMode.TYPING_BATTLE:
    case GameMode.ALL:
    case GameMode.FREE:
      return null;

    default:
      return null;
  }
}

/**
 * 게임 모드에 맞는 단어 조건으로 변환합니다.
 * 원본: GameModeExtension.ConvertWordToCondition()
 * @param {string} gameMode   - 게임 모드
 * @param {string} word       - 현재 제시된 단어
 * @param {string} missionChar - 미션 글자 (없으면 '')
 * @param {boolean} applyLaw  - 두음법칙 적용 여부
 * @returns {object|null}     - WordCondition 또는 null
 */
function convertWordToCondition(gameMode, word, missionChar = '', applyLaw = true) {
  const { applyInitialLaw } = require('./hangul');

  const node = convertWordToTailNode(gameMode, word);
  if (!node) return null;

  let condition = {
    char: node,
    subChar: '',
    missionChar: missionChar || '',
    wordLength: 3,
    regexp: false,
  };

  if (applyLaw) {
    condition = applyInitialLaw(condition);
  }

  return condition;
}

/**
 * 자유 모드 여부를 반환합니다.
 * @param {string} mode
 * @returns {boolean}
 */
function isFreeMode(mode) {
  return mode === GameMode.FREE || mode === GameMode.LAST_AND_FIRST_FREE;
}

/**
 * 게임 모드의 한국어 이름을 반환합니다.
 * @param {string} mode
 * @returns {string}
 */
function getGameModeName(mode) {
  return GAME_MODE_NAMES[mode] || '알 수 없는 모드';
}

/**
 * 쿵쿵따 모드에서 단어 길이 조건을 확인합니다. (2글자 또는 3글자)
 * @param {string} word
 * @param {number} requiredLength - 2 또는 3
 * @returns {boolean}
 */
function isValidKungKungTtaWord(word, requiredLength) {
  return word.length === requiredLength;
}

module.exports = {
  GameMode,
  GAME_MODE_NAMES,
  getLaFTailNode,
  getFaLTailNode,
  getKkutuTailNode,
  getKkutuHeadNode,
  getMaFTailNode,
  convertWordToTailNode,
  convertWordToCondition,
  isFreeMode,
  getGameModeName,
  isValidKungKungTtaWord,
};
