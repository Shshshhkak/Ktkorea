/**
 * pathFilter.js
 * 단어 필터링 모듈 - 이미 사용된 단어, 지원되지 않는 단어 등을 필터링합니다.
 * 원본 C#: AutoKkutuLib/Database/Path/PathFilter.cs
 */

'use strict';

/**
 * PathFilter 클래스 - 사용된 단어와 제외할 단어를 추적합니다.
 */
class PathFilter {
  constructor() {
    /** @type {Set<string>} 존재하지 않는 단어 (서버에서 거부됨) */
    this.inexistentPaths = new Set();

    /** @type {Set<string>} 새로 발견된 단어들 */
    this.newPaths = new Set();

    /** @type {Set<string>} 이전 라운드에서 사용된 단어들 */
    this.previousPaths = new Set();

    /** @type {Set<string>} 지원되지 않는 단어 (게임 서버 거부) */
    this.unsupportedPaths = new Set();
  }

  /**
   * 단어 목록에서 사용할 수 없는 단어를 필터링합니다.
   * 원본: PathFilter.FilterPathList()
   * @param {Array<{word: string, categories: number, missionCharCount: number}>} pathList
   * @param {boolean} reuseAlreadyUsed - 이미 사용된 단어 재사용 여부
   * @returns {Array} 필터링된 단어 목록
   */
  filterPathList(pathList, reuseAlreadyUsed = false) {
    if (!pathList) throw new Error('pathList is null');

    const qualified = [];

    for (const path of pathList) {
      const word = path.word;

      // 존재하지 않는 단어 → 삭제 대상 표시
      if (this.inexistentPaths.has(word)) {
        path.removeQueued = true;
        continue;
      }

      // 지원되지 않는 단어 → 제외
      if (this.unsupportedPaths.has(word)) {
        path.excluded = true;
        continue;
      }

      // 이전에 사용된 단어 → reuseAlreadyUsed 설정에 따라 처리
      if (!reuseAlreadyUsed && this.previousPaths.has(word)) {
        path.alreadyUsed = true;
        continue;
      }

      qualified.push(path);
    }

    return qualified;
  }

  /**
   * 사용된 단어를 기록합니다.
   * @param {string} word
   */
  recordUsedWord(word) {
    this.newPaths.add(word);
    this.previousPaths.add(word);
  }

  /**
   * 지원되지 않는 단어를 기록합니다.
   * @param {string} word
   * @param {boolean} isInexistent - true이면 존재하지 않는 단어, false이면 규칙 위반
   */
  recordUnsupportedWord(word, isInexistent = false) {
    if (isInexistent) {
      this.inexistentPaths.add(word);
    } else {
      this.unsupportedPaths.add(word);
    }
  }

  /**
   * 라운드가 바뀌면 이전 경로를 초기화합니다.
   */
  onRoundChanged() {
    this.previousPaths.clear();
  }

  /**
   * 게임이 끝나면 상태를 초기화합니다.
   */
  onGameEnded() {
    this.previousPaths.clear();
    this.unsupportedPaths.clear();
  }

  /**
   * 모든 상태를 초기화합니다.
   */
  reset() {
    this.inexistentPaths.clear();
    this.newPaths.clear();
    this.previousPaths.clear();
    this.unsupportedPaths.clear();
  }

  /**
   * 현재 상태를 요약하여 반환합니다.
   * @returns {object}
   */
  getStats() {
    return {
      inexistentCount:  this.inexistentPaths.size,
      newPathsCount:    this.newPaths.size,
      previousCount:    this.previousPaths.size,
      unsupportedCount: this.unsupportedPaths.size,
    };
  }
}

module.exports = { PathFilter };
