/**
 * pathFinder.js
 * 최적 단어 탐색 모듈 - 데이터베이스에서 조건에 맞는 단어를 검색합니다.
 * 원본 C#: AutoKkutuLib/Database/Path/PathFinder.cs, Database/Sql/Query/FindWordQuery.cs
 */

'use strict';

const { DB_CONSTANTS } = require('./database');
const { WordFlags, WordCategories, selectFlagsForMode, hasFlag, getDefaultWordPreference } = require('./wordFlags');
const { GameMode } = require('./gameMode');

/**
 * 단어 검색 옵션 플래그
 */
const PathFlags = Object.freeze({
  NONE:               0,
  USE_END_WORD:       1 << 0,  // 한방 단어 사용
  USE_ATTACK_WORD:    1 << 1,  // 공격 단어 사용
  REUSE_ALREADY_USED: 1 << 2,  // 이미 사용된 단어 재사용
  DO_NOT_AUTO_ENTER:  1 << 3,  // 자동 입력 하지 않음
});

/**
 * PathFinder 클래스 - 데이터베이스에서 최적 단어를 찾습니다.
 */
class PathFinder {
  /**
   * @param {import('./database').Database} database - 데이터베이스 인스턴스
   * @param {import('./pathFilter').PathFilter} pathFilter - 경로 필터
   */
  constructor(database, pathFilter) {
    this.database = database;
    this.pathFilter = pathFilter;
  }

  /**
   * 조건에 맞는 최적 단어 목록을 탐색합니다.
   * 원본: PathFinder.FindPath(), FindPathInternal()
   *
   * @param {string} gameMode     - GameMode 상수
   * @param {object} condition    - WordCondition { char, subChar, missionChar, wordLength, regexp }
   * @param {object} options      - 검색 옵션
   * @param {number} options.pathFlags       - PathFlags 비트마스크
   * @param {number} options.maxResults      - 최대 결과 수 (기본 20)
   * @param {number[]} options.preference    - 단어 우선순위 배열 (WordCategories)
   * @returns {{ results: Array, totalCount: number, elapsedMs: number, status: string }}
   */
  findPath(gameMode, condition, options = {}) {
    const {
      pathFlags  = PathFlags.USE_END_WORD | PathFlags.USE_ATTACK_WORD,
      maxResults = 20,
      preference = getDefaultWordPreference(),
    } = options;

    // 타자 대결 모드에서는 자동 단어 탐색 안 함
    if (gameMode === GameMode.TYPING_BATTLE && !(pathFlags & PathFlags.DO_NOT_AUTO_ENTER)) {
      return { results: [], totalCount: 0, elapsedMs: 0, status: 'skipped' };
    }

    const start = Date.now();

    try {
      // 데이터베이스에서 단어 검색
      const rawResults = this._queryWords(gameMode, condition, pathFlags, maxResults, preference);
      const elapsedMs  = Date.now() - start;

      // 필터 적용 (사용된 단어 제외 등)
      const reuseUsed = !!(pathFlags & PathFlags.REUSE_ALREADY_USED);
      const filtered  = this.pathFilter.filterPathList(rawResults, reuseUsed);

      if (filtered.length === 0) {
        return {
          results:    [],
          totalCount: rawResults.length,
          elapsedMs,
          status:     rawResults.length > 0 ? 'all_filtered' : 'not_found',
        };
      }

      return {
        results:    filtered,
        totalCount: rawResults.length,
        elapsedMs,
        status:     'found',
      };
    } catch (e) {
      console.error('[PathFinder] 탐색 오류:', e.message);
      return { results: [], totalCount: 0, elapsedMs: Date.now() - start, status: 'error' };
    }
  }

  /**
   * 실제 데이터베이스 쿼리를 수행합니다.
   * 원본: FindWordQuery.Execute(), CreateQuery()
   * @private
   */
  _queryWords(gameMode, condition, pathFlags, maxResults, preference) {
    const { endWordFlag, attackWordFlag } = selectFlagsForMode(gameMode);

    // 인덱스 컬럼 선택
    const indexCol = this._getIndexColumnName(gameMode, condition);

    // WHERE 절 구성
    let whereParts = [];
    const positionalParams = []; // sql.js는 positional params 사용

    if (gameMode !== GameMode.ALL) {
      if (condition.subChar) {
        // 두음법칙 적용 - 두 가지 인덱스 모두 검색
        whereParts.push(`(${indexCol} = ? OR ${indexCol} = ?)`);
        positionalParams.push(condition.char, condition.subChar);
      } else if (condition.char) {
        whereParts.push(`(${indexCol} = ?)`);
        positionalParams.push(condition.char);
      }

      // 한방 단어 제외
      if (!(pathFlags & PathFlags.USE_END_WORD)) {
        whereParts.push(`(${DB_CONSTANTS.COL_FLAGS} & ${endWordFlag} = 0)`);
      }

      // 공격 단어 제외
      if (!(pathFlags & PathFlags.USE_ATTACK_WORD)) {
        whereParts.push(`(${DB_CONSTANTS.COL_FLAGS} & ${attackWordFlag} = 0)`);
      }

      // 쿵쿵따: 단어 길이 조건
      if (gameMode === GameMode.KUNG_KUNG_TTA) {
        const kktFlag = condition.wordLength === 2 ? WordFlags.KKT2 : WordFlags.KKT3;
        whereParts.push(`(${DB_CONSTANTS.COL_FLAGS} & ${kktFlag} != 0)`);
      }
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    // 우선순위 정렬
    const orderExpr = this._buildOrderExpression(
      condition.missionChar, endWordFlag, attackWordFlag, preference
    );

    const sql = `
      SELECT ${DB_CONSTANTS.COL_WORD}, ${DB_CONSTANTS.COL_FLAGS}
      FROM ${DB_CONSTANTS.WORD_TABLE}
      ${whereClause}
      ORDER BY ${orderExpr} DESC
      LIMIT ${maxResults}
    `;

    try {
      const rows = this.database.db.all(sql, positionalParams);
      return rows.map(row =>
        this._mapRowToPathObject(row, condition.missionChar, endWordFlag, attackWordFlag)
      );
    } catch (e) {
      console.error('[PathFinder] 쿼리 오류:', e.message, '\nSQL:', sql);
      throw e;
    }
  }

  /**
   * 게임 모드에 맞는 인덱스 컬럼 이름을 반환합니다.
   * 원본: FindWordQuery.GetIndexColumnName()
   * @private
   */
  _getIndexColumnName(gameMode, condition) {
    switch (gameMode) {
      case GameMode.FIRST_AND_LAST:
        return DB_CONSTANTS.COL_REVERSE_INDEX;
      case GameMode.KKUTU:
        if ((condition.char && condition.char.length === 2) ||
            (condition.subChar && condition.subChar.length === 2)) {
          return DB_CONSTANTS.COL_KKUTU_INDEX;
        }
        break;
      case GameMode.HUNMIN:
        return DB_CONSTANTS.COL_CHOSEONG;
    }
    return DB_CONSTANTS.COL_WORD_INDEX;
  }

  /**
   * 우선순위 정렬 표현식을 만듭니다. (CASE WHEN 기반)
   * 원본: FindWordQuery.CreateWordPriorityFuncCall()
   * @private
   */
  _buildOrderExpression(missionChar, endWordFlag, attackWordFlag, preference) {
    const getPriority = (cat) => {
      const idx = preference.indexOf(cat);
      return idx >= 0 ? (preference.length - idx) * 10000 : 0;
    };

    let caseExpr = 'CASE';

    if (missionChar && missionChar.length > 0) {
      const m = missionChar[0].replace(/'/g, "''"); // SQL 이스케이프
      caseExpr += `
        WHEN (${DB_CONSTANTS.COL_FLAGS} & ${endWordFlag} != 0) AND (instr(${DB_CONSTANTS.COL_WORD}, '${m}') > 0)
          THEN ${getPriority(WordCategories.END_WORD | WordCategories.MISSION_WORD)}
        WHEN (${DB_CONSTANTS.COL_FLAGS} & ${endWordFlag} != 0)
          THEN ${getPriority(WordCategories.END_WORD)}
        WHEN (${DB_CONSTANTS.COL_FLAGS} & ${attackWordFlag} != 0) AND (instr(${DB_CONSTANTS.COL_WORD}, '${m}') > 0)
          THEN ${getPriority(WordCategories.ATTACK_WORD | WordCategories.MISSION_WORD)}
        WHEN (${DB_CONSTANTS.COL_FLAGS} & ${attackWordFlag} != 0)
          THEN ${getPriority(WordCategories.ATTACK_WORD)}
        WHEN (instr(${DB_CONSTANTS.COL_WORD}, '${m}') > 0)
          THEN ${getPriority(WordCategories.MISSION_WORD)}
        ELSE ${getPriority(WordCategories.NONE)}
      `;
    } else {
      caseExpr += `
        WHEN (${DB_CONSTANTS.COL_FLAGS} & ${endWordFlag} != 0) THEN ${getPriority(WordCategories.END_WORD)}
        WHEN (${DB_CONSTANTS.COL_FLAGS} & ${attackWordFlag} != 0) THEN ${getPriority(WordCategories.ATTACK_WORD)}
        ELSE ${getPriority(WordCategories.NONE)}
      `;
    }

    caseExpr += ' END';

    // 최종 정렬: 우선순위 점수 + 단어 길이 (긴 단어 우선)
    return `(${caseExpr} + length(${DB_CONSTANTS.COL_WORD}))`;
  }

  /**
   * DB 행을 PathObject로 변환합니다.
   * @private
   */
  _mapRowToPathObject(row, missionChar, endWordFlag, attackWordFlag) {
    const word  = String(row.word).trim();
    const flags = Number(row.flags) || 0;

    let categories = WordCategories.NONE;
    if (hasFlag(flags, endWordFlag))    categories |= WordCategories.END_WORD;
    if (hasFlag(flags, attackWordFlag)) categories |= WordCategories.ATTACK_WORD;

    let missionCharCount = 0;
    if (missionChar && missionChar.length > 0) {
      missionCharCount = [...word].filter(c => c === missionChar[0]).length;
      if (missionCharCount > 0) categories |= WordCategories.MISSION_WORD;
    }

    return {
      word,
      flags,
      categories,
      missionCharCount,
      alreadyUsed:  false,
      excluded:     false,
      removeQueued: false,
    };
  }
}

module.exports = { PathFinder, PathFlags };
