/**
 * hangul.js
 * 한글 처리 모듈 - 한글 자모 분해/합성, 두음법칙 적용 등을 담당합니다.
 * 원본 C# 소스: AutoKkutuLib/Hangul/
 */

'use strict';

// ===== 한글 유니코드 상수 =====
const HANGUL_SYLLABLES_ORIGIN = 0xAC00;  // 가
const HANGUL_SYLLABLES_BOUND  = 0xD7A3;  // 힣

// 초성 테이블 (19개)
const INITIAL_CONSONANT_TABLE = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';

// 중성 테이블 (21개)
const MEDIAL_TABLE = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';

// 종성 테이블 (28개, 첫 번째는 공란)
const FINAL_CONSONANT_TABLE = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';

/**
 * 한글 음절 한 글자를 초성·중성·종성으로 분해합니다.
 * 원본: HangulSplit.Parse()
 * @param {string} char - 한 글자
 * @returns {{ isHangul: boolean, initial: string, medial: string, final: string }}
 */
function parseHangul(char) {
  const code = char.charCodeAt(0);

  if (code >= HANGUL_SYLLABLES_ORIGIN && code <= HANGUL_SYLLABLES_BOUND) {
    // 완성형 한글 음절 분해
    const delta = code - HANGUL_SYLLABLES_ORIGIN;
    const initialIdx = Math.floor(delta / 588);
    const medialIdx  = Math.floor((delta % 588) / 28);
    const finalIdx   = delta % 28;

    return {
      isHangul: true,
      initial: INITIAL_CONSONANT_TABLE[initialIdx],
      medial:  MEDIAL_TABLE[medialIdx],
      final:   FINAL_CONSONANT_TABLE[finalIdx],  // 종성 없으면 ' '
    };
  }

  // 자모(호환 자음/모음) 또는 비한글 문자
  return {
    isHangul: false,
    initial: char,
    medial:  '',
    final:   '',
  };
}

/**
 * 초성·중성·종성을 합쳐 한글 음절 한 글자로 만듭니다.
 * 원본: HangulSplit.MergeHangul()
 * @param {string} initial - 초성
 * @param {string} medial  - 중성
 * @param {string} final   - 종성 (없으면 ' ')
 * @returns {string} 합성된 한글 문자
 */
function mergeHangul(initial, medial, final = ' ') {
  const initialIdx = INITIAL_CONSONANT_TABLE.indexOf(initial);
  const medialIdx  = MEDIAL_TABLE.indexOf(medial);
  const finalIdx   = FINAL_CONSONANT_TABLE.indexOf(final === '' ? ' ' : final);

  if (initialIdx < 0 || medialIdx < 0) return initial;

  const code = HANGUL_SYLLABLES_ORIGIN
    + (initialIdx * 21 + medialIdx) * 28
    + (finalIdx < 0 ? 0 : finalIdx);

  return String.fromCharCode(code);
}

/**
 * 주어진 글자에 받침(종성)이 있는지 여부를 반환합니다.
 * @param {string} char - 검사할 문자
 * @returns {boolean}
 */
function hasFinalConsonant(char) {
  const code = char.charCodeAt(0);
  if (code < HANGUL_SYLLABLES_ORIGIN || code > HANGUL_SYLLABLES_BOUND) return false;
  return (code - HANGUL_SYLLABLES_ORIGIN) % 28 > 0;
}

/**
 * 주어진 문자가 한글 완성형 음절인지 여부를 반환합니다.
 * @param {string} char
 * @returns {boolean}
 */
function isHangulSyllable(char) {
  const code = char.charCodeAt(0);
  return code >= HANGUL_SYLLABLES_ORIGIN && code <= HANGUL_SYLLABLES_BOUND;
}

/**
 * 주어진 문자열이 한글 문자를 포함하는지 여부를 반환합니다.
 * @param {string} str
 * @returns {boolean}
 */
function containsHangul(str) {
  return [...str].some(c => isHangulSyllable(c));
}

// ===== 두음법칙 (Initial Law) =====
// 원본: AutoKkutuLib/Hangul/InitialLaw.cs
// JJoriping 원본 구현 참고: https://github.com/JJoriping/KKuTu

// ㄹ → ㄴ 로 변환되는 중성들
const RIEUL_TO_NIEUN_VOWELS = new Set(['ㅏ', 'ㅐ', 'ㅗ', 'ㅚ', 'ㅜ', 'ㅡ']);
// ㄹ → ㅇ 로 변환되는 중성들
const RIEUL_TO_IEUNG_VOWELS = new Set(['ㅑ', 'ㅕ', 'ㅖ', 'ㅛ', 'ㅠ', 'ㅣ']);
// ㄴ → ㅇ 로 변환되는 중성들
const NIEUN_TO_IEUNG_VOWELS = new Set(['ㅕ', 'ㅛ', 'ㅠ', 'ㅣ']);

/**
 * 단어 조건에 두음법칙을 적용합니다.
 * 원본: InitialLaw.ApplyInitialLaw()
 *
 * 예: '라'로 시작해야 하는 경우 → '나' 또는 '아'로도 시작 가능
 *
 * @param {object} condition - WordCondition 객체 { char, subChar, missionChar, wordLength }
 * @returns {object} 두음법칙이 적용된 WordCondition
 */
function applyInitialLaw(condition) {
  // 이미 subChar가 존재하거나 char가 없으면 그대로 반환
  if (condition.subChar || !condition.char) return condition;

  const firstChar = condition.char[0];
  const split = parseHangul(firstChar);

  // 한글이 아니거나 중성이 없으면 두음법칙 적용 불가
  if (!split.isHangul || !split.medial) return condition;

  let newInitial = split.initial;

  if (split.initial === 'ㄹ') {
    if (RIEUL_TO_NIEUN_VOWELS.has(split.medial)) {
      newInitial = 'ㄴ';
    } else if (RIEUL_TO_IEUNG_VOWELS.has(split.medial)) {
      newInitial = 'ㅇ';
    } else {
      return condition; // 변환 불가
    }
  } else if (split.initial === 'ㄴ' && NIEUN_TO_IEUNG_VOWELS.has(split.medial)) {
    newInitial = 'ㅇ';
  } else {
    return condition; // 변환 불가
  }

  // 변환된 첫 글자 합성
  const newFirstChar = mergeHangul(newInitial, split.medial, split.final);
  const subChar = newFirstChar + condition.char.slice(1);

  return {
    ...condition,
    subChar,
  };
}

/**
 * 단어의 초성들을 추출합니다. (훈민정음 모드에서 사용)
 * 예: '안녕하세요' → 'ㅇㄴㅎㅅㅇ'
 * @param {string} word
 * @returns {string}
 */
function extractChoseong(word) {
  return [...word].map(char => {
    const split = parseHangul(char);
    if (split.isHangul && split.initial && split.initial !== ' ') {
      return split.initial;
    }
    return char;
  }).join('');
}

module.exports = {
  parseHangul,
  mergeHangul,
  hasFinalConsonant,
  isHangulSyllable,
  containsHangul,
  applyInitialLaw,
  extractChoseong,
  INITIAL_CONSONANT_TABLE,
  MEDIAL_TABLE,
  FINAL_CONSONANT_TABLE,
};
