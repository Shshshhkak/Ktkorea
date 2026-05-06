/**
 * config.js
 * 설정 관리 모듈
 */

'use strict';

const path = require('path');
const fs   = require('fs');

const DEFAULT_CONFIG = {
  // 데이터베이스 설정
  database: {
    path: path.join(__dirname, '..', 'data', 'path.sqlite'),
  },

  // 게임 설정
  game: {
    // 기본 게임 모드 (끝말잇기)
    defaultMode: 'LastAndFirst',

    // 두음법칙 적용 여부
    applyInitialLaw: true,

    // 한방 단어 사용 여부
    useEndWord: true,

    // 공격 단어 사용 여부
    useAttackWord: true,

    // 이미 사용된 단어 재사용 여부
    reuseAlreadyUsed: false,

    // 최대 결과 수
    maxResults: 30,
  },

  // 로그 레벨 (DEBUG, INFO, WARN, ERROR)
  logLevel: 'INFO',
};

let _config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

/**
 * config.json 파일에서 설정을 불러옵니다.
 */
function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      const loaded = JSON.parse(raw);
      _config = deepMerge(_config, loaded);
      console.log('[Config] 설정 불러옴:', CONFIG_PATH);
    } catch (e) {
      console.warn('[Config] 설정 파일 읽기 실패, 기본값 사용:', e.message);
    }
  } else {
    // 기본 설정 파일 생성
    saveConfig();
  }
  return _config;
}

/**
 * 현재 설정을 config.json에 저장합니다.
 */
function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(_config, null, 2), 'utf8');
  } catch (e) {
    console.warn('[Config] 설정 저장 실패:', e.message);
  }
}

/**
 * 현재 설정 객체를 반환합니다.
 * @returns {object}
 */
function getConfig() {
  return _config;
}

/**
 * 객체를 깊게 병합합니다.
 * @param {object} target
 * @param {object} source
 * @returns {object}
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

module.exports = { loadConfig, saveConfig, getConfig, DEFAULT_CONFIG };
