/**
 * wordCondition.js
 * 단어 검색 조건 구조체
 * 원본 C#: AutoKkutuLib/WordCondition.cs
 */

'use strict';

/**
 * 단어 검색 조건을 나타냅니다.
 *
 * @param {string} char        - 주 단어 조건 문자 (예: 끝말잇기에서 이번에 입력해야 할 첫 글자)
 * @param {string} subChar     - 보조 조건 문자 (두음법칙 적용 시 대체 문자)
 * @param {string} missionChar - 미션 글자 (없으면 빈 문자열)
 * @param {number} wordLength  - 쿵쿵따 모드에서의 단어 길이 (2 또는 3)
 * @param {boolean} regexp     - 정규식 검색 여부
 * @returns {object} WordCondition
 */
function createWordCondition(char = '', subChar = '', missionChar = '', wordLength = 3, regexp = false) {
  return Object.freeze({ char, subChar, missionChar, wordLength, regexp });
}

/**
 * 빈 단어 조건 (공란)
 */
const EMPTY_CONDITION = createWordCondition('');

/**
 * 단어 조건이 비어있는지 확인합니다.
 * @param {object} condition
 * @returns {boolean}
 */
function isEmptyCondition(condition) {
  return !condition || !condition.char;
}

/**
 * 보조 단어 조건이 있는지 확인합니다.
 * @param {object} condition
 * @returns {boolean}
 */
function hasSubCondition(condition) {
  return !!(condition && condition.subChar && condition.subChar.trim());
}

/**
 * 두 단어 조건이 비슷한지 여부를 반환합니다.
 * "비슷하다" = 한 개 이상의 조건 문자를 공유하고, 미션 글자가 동일
 * 원본: WordCondition.IsSimilar()
 *
 * @param {object} a
 * @param {object} b
 * @returns {boolean}
 */
function isSimilarCondition(a, b) {
  if (!a || !b) return false;
  if (isEmptyCondition(a) || isEmptyCondition(b)) return false;

  if (a.missionChar !== b.missionChar) return false;
  if (a.regexp !== b.regexp) return false;
  if (a.wordLength !== b.wordLength) return false;

  const charMatch = a.char.toLowerCase() === b.char.toLowerCase();
  const aSubMatchB = hasSubCondition(a) && a.subChar.toLowerCase() === b.char.toLowerCase();
  const bSubMatchA = hasSubCondition(b) && b.subChar.toLowerCase() === a.char.toLowerCase();
  const subMatch   = hasSubCondition(a) && hasSubCondition(b) &&
                     a.subChar.toLowerCase() === b.subChar.toLowerCase();

  return charMatch || aSubMatchB || bSubMatchA || subMatch;
}

/**
 * 단어 조건을 사람이 읽기 쉬운 형태로 변환합니다.
 * @param {object} condition
 * @returns {string}
 */
function describeCondition(condition) {
  if (!condition || isEmptyCondition(condition)) return '[빈 조건]';

  let desc = `조건{글자: ${condition.char}`;
  if (hasSubCondition(condition)) desc += `, 대체: ${condition.subChar}`;
  if (condition.missionChar)      desc += `, 미션: ${condition.missionChar}`;
  if (condition.wordLength !== 3) desc += `, 길이: ${condition.wordLength}`;
  if (condition.regexp)           desc += ' (정규식)';
  return desc + '}';
}

module.exports = {
  createWordCondition,
  EMPTY_CONDITION,
  isEmptyCondition,
  hasSubCondition,
  isSimilarCondition,
  describeCondition,
};
