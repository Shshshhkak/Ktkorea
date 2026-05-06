/**
 * database.js
 * SQLite 단어 데이터베이스 관리 모듈
 * 원본 C#: AutoKkutuLib/Database/, AutoKkutuLib.Sqlite/
 *
 * sql.js(순수 JavaScript SQLite WebAssembly) 기반 구현.
 * 네이티브 바이너리 빌드 없이 어디서나 동작합니다.
 *
 * 데이터베이스 스키마:
 *   word_list 테이블: seq, word, word_index, reverse_word_index, kkutu_index, choseong, flags, meaning
 *   endword_list, reverse_endword_list, kkutu_endword_list, kkt_endword_list 등 노드 테이블들
 */

'use strict';

const path = require('path');
const fs   = require('fs');

// 테이블 및 컬럼 이름 상수 (원본: DatabaseConstants.cs)
const DB_CONSTANTS = {
  WORD_TABLE:             'word_list',
  END_NODE_TABLE:         'endword_list',
  REVERSE_END_NODE_TABLE: 'reverse_endword_list',
  KKUTU_END_NODE_TABLE:   'kkutu_endword_list',
  KKT_END_NODE_TABLE:     'kkt_endword_list',
  ATTACK_NODE_TABLE:      'attackword_list',

  COL_SEQ:              'seq',
  COL_WORD:             'word',
  COL_WORD_INDEX:       'word_index',
  COL_REVERSE_INDEX:    'reverse_word_index',
  COL_KKUTU_INDEX:      'kkutu_index',
  COL_CHOSEONG:         'choseong',
  COL_FLAGS:            'flags',
  COL_MEANING:          'meaning',
  COL_NODE:             'node',
};

/**
 * sql.js 래퍼 - sql.js API를 better-sqlite3와 비슷하게 감쌉니다.
 */
class SqlJsAdapter {
  constructor(sqlJs, dbPath) {
    this._dbPath = dbPath;
    this._sqlJs  = sqlJs;

    // 파일이 존재하면 불러오고, 없으면 새로 생성
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      this._db = new sqlJs.Database(buffer);
    } else {
      this._db = new sqlJs.Database();
    }
  }

  /** SQL 실행 (결과 없음) - 여러 문장 지원 */
  exec(sql) {
    this._db.exec(sql);   // sql.js: exec()는 여러 SQL 문장 처리, run()은 첫 문장만 처리
    this._save();
  }

  /** 여러 행 반환 - 배열(positional) 또는 객체(named) params 모두 지원 */
  all(sql, params = []) {
    const stmt = this._db.prepare(sql);
    if (Array.isArray(params)) {
      stmt.bind(params);
    } else if (params && typeof params === 'object' && Object.keys(params).length > 0) {
      stmt.bind(this._convertParams(params));
    }
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  /** 단일 행 반환 */
  get(sql, params = {}) {
    const results = this.all(sql, params);
    return results[0] || null;
  }

  /** INSERT/UPDATE/DELETE 실행 */
  run(sql, params = []) {
    const stmt = this._db.prepare(sql);
    if (Array.isArray(params)) {
      stmt.run(params);
    } else {
      stmt.run(this._convertParams(params));
    }
    stmt.free();
    const changes = this._db.getRowsModified();
    this._save();
    return { changes };
  }

  /** prepare → run 스타일 */
  prepare(sql) {
    const adapter = this;
    return {
      run: (...args) => {
        const params = args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])
          ? adapter._convertParams(args[0])
          : args.flat();
        const stmt = adapter._db.prepare(sql);
        stmt.run(params);
        stmt.free();
        const changes = adapter._db.getRowsModified();
        adapter._save();
        return { changes };
      },
      all: (...args) => {
        const params = args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])
          ? adapter._convertParams(args[0])
          : args.flat();
        const stmt = adapter._db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      },
    };
  }

  /** pragma 설정 (sql.js에서는 실행만 하고 무시) */
  pragma(str) {
    try { this._db.run(`PRAGMA ${str}`); } catch (_) {}
  }

  /** 닫기 및 저장 */
  close() {
    this._save();
    this._db.close();
  }

  /** DB를 파일로 저장 */
  _save() {
    try {
      const data = this._db.export();
      const dir = path.dirname(this._dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this._dbPath, Buffer.from(data));
    } catch (e) {
      // 저장 실패는 무시 (읽기 전용 환경 등)
    }
  }

  /** named params (:name, @name) → positional array 변환 */
  _convertParams(obj) {
    // sql.js는 {':name': value} 형식 지원
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      const key = k.startsWith(':') || k.startsWith('@') || k.startsWith('$') ? k : `:${k}`;
      result[key] = v;
    }
    return result;
  }
}

/**
 * 데이터베이스 연결 클래스
 */
class Database {
  /**
   * @param {string} dbPath - SQLite 파일 경로
   */
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  /**
   * 데이터베이스에 연결하고 초기화합니다.
   * sql.js는 비동기 로드가 필요하므로 반드시 await connectAsync()를 사용하세요.
   */
  async connectAsync() {
    let initSqlJs;
    try {
      initSqlJs = require('sql.js');
    } catch (e) {
      throw new Error(
        'sql.js 모듈을 찾을 수 없습니다.\n' +
        '다음 명령어로 설치해 주세요:\n' +
        '  npm install'
      );
    }

    // sql.js 초기화 (WebAssembly 로드)
    const sqlJs = await initSqlJs();

    // 디렉토리 없으면 생성
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new SqlJsAdapter(sqlJs, this.dbPath);
    this.db.pragma('journal_mode = WAL');

    this._initSchema();
    console.log(`[DB] 연결됨: ${this.dbPath}`);
    return this;
  }

  /**
   * 동기 연결 (connect()는 connectAsync()의 별칭)
   * 편의를 위해 제공하지만 내부적으로 동기 처리됩니다.
   */
  connect() {
    throw new Error('database.connect()는 비동기입니다. connectAsync()를 사용하세요.');
  }

  /**
   * 데이터베이스 스키마를 초기화합니다.
   */
  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${DB_CONSTANTS.WORD_TABLE} (
        ${DB_CONSTANTS.COL_SEQ}          INTEGER PRIMARY KEY AUTOINCREMENT,
        ${DB_CONSTANTS.COL_WORD}         TEXT NOT NULL UNIQUE,
        ${DB_CONSTANTS.COL_WORD_INDEX}    TEXT NOT NULL DEFAULT '',
        ${DB_CONSTANTS.COL_REVERSE_INDEX} TEXT NOT NULL DEFAULT '',
        ${DB_CONSTANTS.COL_KKUTU_INDEX}   TEXT NOT NULL DEFAULT '',
        ${DB_CONSTANTS.COL_CHOSEONG}     TEXT NOT NULL DEFAULT '',
        ${DB_CONSTANTS.COL_FLAGS}        INTEGER NOT NULL DEFAULT 0,
        ${DB_CONSTANTS.COL_MEANING}      TEXT DEFAULT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_word_index    ON ${DB_CONSTANTS.WORD_TABLE}(${DB_CONSTANTS.COL_WORD_INDEX});
      CREATE INDEX IF NOT EXISTS idx_reverse_index ON ${DB_CONSTANTS.WORD_TABLE}(${DB_CONSTANTS.COL_REVERSE_INDEX});
      CREATE INDEX IF NOT EXISTS idx_kkutu_index   ON ${DB_CONSTANTS.WORD_TABLE}(${DB_CONSTANTS.COL_KKUTU_INDEX});
      CREATE INDEX IF NOT EXISTS idx_choseong      ON ${DB_CONSTANTS.WORD_TABLE}(${DB_CONSTANTS.COL_CHOSEONG});

      CREATE TABLE IF NOT EXISTS ${DB_CONSTANTS.END_NODE_TABLE} (
        ${DB_CONSTANTS.COL_NODE} TEXT NOT NULL PRIMARY KEY
      );
      CREATE TABLE IF NOT EXISTS ${DB_CONSTANTS.REVERSE_END_NODE_TABLE} (
        ${DB_CONSTANTS.COL_NODE} TEXT NOT NULL PRIMARY KEY
      );
      CREATE TABLE IF NOT EXISTS ${DB_CONSTANTS.KKUTU_END_NODE_TABLE} (
        ${DB_CONSTANTS.COL_NODE} TEXT NOT NULL PRIMARY KEY
      );
      CREATE TABLE IF NOT EXISTS ${DB_CONSTANTS.KKT_END_NODE_TABLE} (
        ${DB_CONSTANTS.COL_NODE} TEXT NOT NULL PRIMARY KEY
      );
      CREATE TABLE IF NOT EXISTS ${DB_CONSTANTS.ATTACK_NODE_TABLE} (
        ${DB_CONSTANTS.COL_NODE} TEXT NOT NULL PRIMARY KEY
      );
    `);
  }

  /**
   * 단어를 데이터베이스에 추가합니다.
   * @param {string} word    - 단어
   * @param {number} flags   - WordFlags 비트마스크
   * @param {string} meaning - 단어 뜻 (선택)
   * @returns {boolean} 추가 성공 여부
   */
  addWord(word, flags = 0, meaning = '') {
    const { extractChoseong } = require('./hangul');

    word = word.trim();
    if (!word) return false;

    // 인덱스 값 계산
    const wordIndex    = word[0];
    const reverseIndex = word[word.length - 1];
    const kkutuIndex   = word.length >= 4 ? word.slice(0, 2) : word[0];
    const choseong     = extractChoseong(word);

    try {
      this.db.run(
        `INSERT OR REPLACE INTO ${DB_CONSTANTS.WORD_TABLE}
          (${DB_CONSTANTS.COL_WORD}, ${DB_CONSTANTS.COL_WORD_INDEX},
           ${DB_CONSTANTS.COL_REVERSE_INDEX}, ${DB_CONSTANTS.COL_KKUTU_INDEX},
           ${DB_CONSTANTS.COL_CHOSEONG}, ${DB_CONSTANTS.COL_FLAGS}, ${DB_CONSTANTS.COL_MEANING})
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [word, wordIndex, reverseIndex, kkutuIndex, choseong, flags, meaning || null]
      );
      return true;
    } catch (e) {
      console.error(`[DB] 단어 추가 실패 "${word}":`, e.message);
      return false;
    }
  }

  /**
   * 여러 단어를 한 번에 추가합니다.
   * @param {Array<{word: string, flags?: number, meaning?: string}>} words
   * @returns {number} 추가된 단어 수
   */
  addWordsBatch(words) {
    let count = 0;
    for (const item of words) {
      if (this.addWord(item.word, item.flags || 0, item.meaning || '')) {
        count++;
      }
    }
    return count;
  }

  /**
   * 단어를 삭제합니다.
   * @param {string} word
   * @returns {boolean}
   */
  deleteWord(word) {
    const result = this.db.run(
      `DELETE FROM ${DB_CONSTANTS.WORD_TABLE} WHERE ${DB_CONSTANTS.COL_WORD} = ?`,
      [word.trim()]
    );
    return result.changes > 0;
  }

  /**
   * 단어가 데이터베이스에 존재하는지 확인합니다.
   * @param {string} word
   * @returns {boolean}
   */
  wordExists(word) {
    const row = this.db.get(
      `SELECT 1 as exists FROM ${DB_CONSTANTS.WORD_TABLE} WHERE ${DB_CONSTANTS.COL_WORD} = ?`,
      [word.trim()]
    );
    return !!row;
  }

  /**
   * 단어의 정보를 가져옵니다.
   * @param {string} word
   * @returns {object|null}
   */
  getWordInfo(word) {
    return this.db.get(
      `SELECT * FROM ${DB_CONSTANTS.WORD_TABLE} WHERE ${DB_CONSTANTS.COL_WORD} = ?`,
      [word.trim()]
    ) || null;
  }

  /**
   * 한방 노드 목록에 노드를 추가합니다.
   * @param {string} tableId - 'end'|'reverse_end'|'kkutu_end'|'kkt_end'|'attack'
   * @param {string} node
   */
  addEndNode(tableId, node) {
    const tableMap = {
      end:         DB_CONSTANTS.END_NODE_TABLE,
      reverse_end: DB_CONSTANTS.REVERSE_END_NODE_TABLE,
      kkutu_end:   DB_CONSTANTS.KKUTU_END_NODE_TABLE,
      kkt_end:     DB_CONSTANTS.KKT_END_NODE_TABLE,
      attack:      DB_CONSTANTS.ATTACK_NODE_TABLE,
    };
    const table = tableMap[tableId];
    if (!table) return;
    try {
      this.db.run(`INSERT OR IGNORE INTO ${table} (${DB_CONSTANTS.COL_NODE}) VALUES (?)`, [node]);
    } catch (_) {}
  }

  /**
   * 한방 노드 목록을 가져옵니다.
   * @param {string} tableId
   * @returns {Set<string>}
   */
  getEndNodes(tableId) {
    const tableMap = {
      end:         DB_CONSTANTS.END_NODE_TABLE,
      reverse_end: DB_CONSTANTS.REVERSE_END_NODE_TABLE,
      kkutu_end:   DB_CONSTANTS.KKUTU_END_NODE_TABLE,
      kkt_end:     DB_CONSTANTS.KKT_END_NODE_TABLE,
      attack:      DB_CONSTANTS.ATTACK_NODE_TABLE,
    };
    const table = tableMap[tableId];
    if (!table) return new Set();
    try {
      const rows = this.db.all(`SELECT ${DB_CONSTANTS.COL_NODE} FROM ${table}`);
      return new Set(rows.map(r => r.node));
    } catch (_) {
      return new Set();
    }
  }

  /**
   * 전체 단어 수를 반환합니다.
   * @returns {number}
   */
  getWordCount() {
    const row = this.db.get(`SELECT COUNT(*) as cnt FROM ${DB_CONSTANTS.WORD_TABLE}`);
    return row ? (row.cnt || 0) : 0;
  }

  /**
   * 단어 목록을 가져옵니다. (PathFinder 내부에서 직접 사용)
   * @param {string} sql
   * @param {object} params
   * @returns {Array}
   */
  queryWords(sql, params = {}) {
    return this.db.all(sql, params);
  }

  /**
   * 데이터베이스 연결을 닫습니다.
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[DB] 연결 닫힘');
    }
  }
}

module.exports = { Database, DB_CONSTANTS };
