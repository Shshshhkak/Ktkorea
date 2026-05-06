/**
 * logger.js
 * 로그 출력 유틸리티
 */

'use strict';

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

let currentLevel = LOG_LEVELS.INFO;

// chalk를 선택적으로 불러옵니다 (없어도 동작)
let chalk;
try { chalk = require('chalk'); } catch (_) { chalk = null; }

function colorize(color, text) {
  if (!chalk) return text;
  try { return chalk[color](text); } catch (_) { return text; }
}

function timestamp() {
  return new Date().toLocaleTimeString('ko-KR');
}

const logger = {
  setLevel(level) {
    if (typeof level === 'string') currentLevel = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.INFO;
    else currentLevel = level;
  },

  debug(msg, ...args) {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      console.log(colorize('gray', `[${timestamp()}] [DEBUG] ${msg}`), ...args);
    }
  },

  info(msg, ...args) {
    if (currentLevel <= LOG_LEVELS.INFO) {
      console.log(colorize('cyan', `[${timestamp()}] [INFO]  ${msg}`), ...args);
    }
  },

  warn(msg, ...args) {
    if (currentLevel <= LOG_LEVELS.WARN) {
      console.warn(colorize('yellow', `[${timestamp()}] [WARN]  ${msg}`), ...args);
    }
  },

  error(msg, ...args) {
    if (currentLevel <= LOG_LEVELS.ERROR) {
      console.error(colorize('red', `[${timestamp()}] [ERROR] ${msg}`), ...args);
    }
  },

  success(msg, ...args) {
    console.log(colorize('green', `[${timestamp()}] [OK]    ${msg}`), ...args);
  },
};

module.exports = { logger, LOG_LEVELS };
