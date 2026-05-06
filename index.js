/**
 * index.js - AutoKkutu Node.js 메인 진입 파일
 *
 * 사용법:
 *   node index.js            → 대화형 CLI 모드
 *   node index.js --demo     → 데모 모드 (샘플 단어로 경로 탐색 시연)
 *   node index.js --add-words → 단어 일괄 추가 모드
 *   node index.js --check-word <단어> → 특정 단어 정보 확인
 *
 * 원본 C# 프로젝트: AutoKkutu v1.2
 * 한국어 끝말잇기 게임(끄투.io) 자동화 봇의 핵심 라이브러리를 Node.js로 재구성한 버전입니다.
 */

'use strict';

const readline = require('readline');

// 모듈 불러오기
const { loadConfig, getConfig }        = require('./src/config');
const { logger }                       = require('./src/logger');
const { Database }                     = require('./src/database');
const { PathFinder, PathFlags }        = require('./src/pathFinder');
const { PathFilter }                   = require('./src/pathFilter');
const { GameMode, getGameModeName, convertWordToCondition } = require('./src/gameMode');
const { WordFlags, WordCategories, describeFlagsArray }     = require('./src/wordFlags');
const { applyInitialLaw }              = require('./src/hangul');
const { describeCondition }            = require('./src/wordCondition');

// ===== 초기화 =====

const config = loadConfig();
logger.setLevel(config.logLevel);

// 전역 인스턴스
let db, pathFinder, pathFilter;

/**
 * 애플리케이션을 초기화합니다. (비동기 - sql.js WebAssembly 로드)
 */
async function initialize() {
  logger.info('AutoKkutu Node.js 초기화 중...');

  db = new Database(config.database.path);
  await db.connectAsync();

  pathFilter = new PathFilter();
  pathFinder = new PathFinder(db, pathFilter);

  const wordCount = db.getWordCount();
  logger.success(`초기화 완료! 데이터베이스 단어 수: ${wordCount.toLocaleString()}개`);
}

// ===== 샘플 단어 로딩 =====

function loadDemoWords() {
  logger.info('샘플 단어 로딩 중...');

  // 각 항목: [단어, 플래그(WordFlags 비트마스크), 뜻]
  const sampleWords = [
    // --- 끝말잇기 일반 단어 ---
    ['사과',     WordFlags.KOREAN,                                '과일의 일종'],
    ['과자',     WordFlags.KOREAN,                                '간식'],
    ['자동차',   WordFlags.KOREAN,                                '탈것'],
    ['차도',     WordFlags.KOREAN,                                '도로의 한 부분'],
    ['도서관',   WordFlags.KOREAN,                                '책을 보는 곳'],
    ['관광지',   WordFlags.KOREAN,                                '관광하는 곳'],
    ['지구',     WordFlags.KOREAN,                                '우리가 사는 행성'],
    ['구름',     WordFlags.KOREAN,                                '하늘에 떠 있는 것'],
    ['나라',     WordFlags.KOREAN,                                '국가'],
    ['라디오',   WordFlags.KOREAN | WordFlags.LOAN_WORD,          '방송 기기'],
    ['오리',     WordFlags.KOREAN,                                '새의 종류'],
    ['리모컨',   WordFlags.KOREAN | WordFlags.LOAN_WORD,          '원격 조종기'],
    ['음악',     WordFlags.KOREAN,                                '소리 예술'],
    ['악기',     WordFlags.KOREAN,                                '음악을 연주하는 도구'],
    ['기차',     WordFlags.KOREAN,                                '철도 위를 달리는 탈것'],
    ['차량',     WordFlags.KOREAN,                                '차의 통칭'],
    ['양말',     WordFlags.KOREAN,                                '발에 신는 것'],
    ['말씀',     WordFlags.KOREAN,                                '높임말'],
    ['씀바귀',   WordFlags.KOREAN,                                '식물'],
    ['귀신',     WordFlags.KOREAN,                                '유령'],
    ['신발',     WordFlags.KOREAN,                                '발에 신는 것'],
    ['발전소',   WordFlags.KOREAN,                                '전기를 생산하는 곳'],
    ['소나무',   WordFlags.KOREAN,                                '나무의 종류'],
    ['무지개',   WordFlags.KOREAN,                                '일곱 빛깔 호 모양'],
    ['개구리',   WordFlags.KOREAN,                                '양서류 동물'],
    ['리본',     WordFlags.KOREAN | WordFlags.LOAN_WORD,          '장식 끈'],
    ['본보기',   WordFlags.KOREAN,                                '예시, 모범'],
    ['기쁨',     WordFlags.KOREAN,                                '즐거운 감정'],

    // --- 공격 단어 (다음 사람이 잇기 어려운 글자로 끝남) ---
    ['나침반',   WordFlags.KOREAN | WordFlags.ATTACK_WORD,        '방향을 알려주는 도구'],
    ['아방궁',   WordFlags.KOREAN | WordFlags.ATTACK_WORD,        '중국의 궁전'],
    ['전복죽',   WordFlags.KOREAN | WordFlags.ATTACK_WORD,        '음식'],
    ['거북이',   WordFlags.KOREAN | WordFlags.ATTACK_WORD,        '파충류'],
    ['인삼밭',   WordFlags.KOREAN | WordFlags.ATTACK_WORD,        '인삼 재배지'],

    // --- 한방 단어 (상대방이 이어갈 수 없는 글자로 끝남) ---
    ['닭볶음탕', WordFlags.KOREAN | WordFlags.END_WORD,           '음식'],
    ['수박',     WordFlags.KOREAN | WordFlags.END_WORD,           '여름 과일'],
    ['서랍장',   WordFlags.KOREAN | WordFlags.END_WORD,           '가구'],

    // --- 앞말잇기 전용 ---
    ['나비',     WordFlags.KOREAN | WordFlags.REVERSE_END_WORD,   '곤충'],
    ['가방',     WordFlags.KOREAN,                                '들고 다니는 것'],
    ['방울',     WordFlags.KOREAN,                                '소리 나는 물건'],
    ['울음',     WordFlags.KOREAN,                                '우는 행위'],

    // --- 쿵쿵따 (2글자) ---
    ['가수',     WordFlags.KOREAN | WordFlags.KKT2,               '노래 부르는 사람'],
    ['수도',     WordFlags.KOREAN | WordFlags.KKT2,               '물이 나오는 관 / 수도'],
    ['도착',     WordFlags.KOREAN | WordFlags.KKT2,               '목적지에 닿음'],
    ['착각',     WordFlags.KOREAN | WordFlags.KKT2,               '잘못 생각함'],

    // --- 쿵쿵따 (3글자) ---
    ['사과즙',   WordFlags.KOREAN | WordFlags.KKT3,               '사과 주스'],
    ['자동차',   WordFlags.KOREAN | WordFlags.KKT3,               '탈것'],
    ['도서관',   WordFlags.KOREAN | WordFlags.KKT3,               '책을 읽는 곳'],
    ['관광지',   WordFlags.KOREAN | WordFlags.KKT3,               '관광하는 곳'],
    ['기차역',   WordFlags.KOREAN | WordFlags.KKT3,               '기차가 서는 곳'],

    // --- 끄투 전용 (2글자 인덱스 활용) ---
    ['사과나무', WordFlags.KOREAN,                                '사과가 열리는 나무'],
    ['나무젓가락', WordFlags.KOREAN,                              '나무로 만든 젓가락'],
    ['나라사랑', WordFlags.KOREAN,                                '나라를 아끼는 마음'],
  ];

  const added = db.addWordsBatch(
    sampleWords.map(([word, flags, meaning]) => ({ word, flags, meaning }))
  );
  logger.success(`샘플 단어 ${added}개 추가 완료 (총 ${db.getWordCount()}개)`);
}

// ===== 핵심 기능: 단어 탐색 =====

/**
 * 주어진 단어를 받아 최적의 다음 단어를 찾아 출력합니다.
 * @param {string} inputWord    - 상대방이 제시한 단어
 * @param {string} gameMode     - 게임 모드 (GameMode 상수)
 * @param {string} missionChar  - 미션 글자 (없으면 '')
 * @param {object} options      - 검색 옵션
 * @returns {object|null}
 */
function findNextWord(inputWord, gameMode = GameMode.LAST_AND_FIRST, missionChar = '', options = {}) {
  const cfg = getConfig().game;

  // 단어 → 조건 변환 (두음법칙 포함)
  const condition = convertWordToCondition(gameMode, inputWord, missionChar, cfg.applyInitialLaw);
  if (!condition) {
    logger.warn(`'${inputWord}'에서 "${getGameModeName(gameMode)}" 모드의 단어 조건을 만들 수 없습니다.`);
    return null;
  }

  logger.info(`[탐색] ${describeCondition(condition)} (모드: ${getGameModeName(gameMode)})`);

  // PathFlags 구성
  let pFlags = PathFlags.NONE;
  if (options.useEndWord    ?? cfg.useEndWord)       pFlags |= PathFlags.USE_END_WORD;
  if (options.useAttackWord ?? cfg.useAttackWord)    pFlags |= PathFlags.USE_ATTACK_WORD;
  if (options.reuseUsed     ?? cfg.reuseAlreadyUsed) pFlags |= PathFlags.REUSE_ALREADY_USED;

  const result = pathFinder.findPath(gameMode, condition, {
    pathFlags:  pFlags,
    maxResults: options.maxResults ?? cfg.maxResults,
  });

  printSearchResult(result, inputWord, condition, gameMode);
  return result;
}

/**
 * 탐색 결과를 콘솔에 출력합니다.
 */
function printSearchResult(result, inputWord, condition, gameMode) {
  const line = '─'.repeat(62);
  console.log('\n' + line);
  console.log(
    `  입력: "${inputWord}"  →  조건: "${condition.char}"` +
    (condition.subChar ? ` (또는 "${condition.subChar}")` : '')
  );
  console.log(
    `  모드: ${getGameModeName(gameMode)} | ` +
    `상태: ${translateStatus(result.status)} | ` +
    `소요: ${result.elapsedMs}ms`
  );
  console.log(line);

  if (result.results.length === 0) {
    console.log('  ⚠  사용 가능한 단어를 찾지 못했습니다.');
  } else {
    console.log(`  DB 결과: ${result.totalCount}개 → 필터 후: ${result.results.length}개\n`);
    result.results.slice(0, 10).forEach((w, i) => {
      const tags = buildWordTags(w);
      console.log(`  ${String(i + 1).padStart(2)}. ${w.word.padEnd(12)} ${tags}`);
    });
    if (result.results.length > 10) {
      console.log(`  ... 외 ${result.results.length - 10}개`);
    }
    console.log(`\n  ★ 추천: "${result.results[0].word}"`);
  }
  console.log(line + '\n');
}

function buildWordTags(w) {
  const tags = [];
  if (w.categories & WordCategories.END_WORD)    tags.push('[한방]');
  if (w.categories & WordCategories.ATTACK_WORD) tags.push('[공격]');
  if (w.categories & WordCategories.MISSION_WORD) tags.push(`[미션×${w.missionCharCount}]`);
  return tags.length ? tags.join(' ') : '[일반]';
}

function translateStatus(status) {
  return ({
    found:        '단어 발견',
    not_found:    '단어 없음',
    all_filtered: '모두 필터됨',
    skipped:      '탐색 건너뜀',
    error:        '오류',
  })[status] || status;
}

// ===== 단어 정보 출력 =====
function printWordInfo(word) {
  const info = db.getWordInfo(word);
  if (!info) {
    console.log(`\n  "${word}" 단어가 데이터베이스에 없습니다.\n`);
    return;
  }
  const flags = describeFlagsArray(info.flags);
  const line  = '─'.repeat(52);
  console.log('\n' + line);
  console.log(`  단어:    ${info.word}`);
  console.log(`  끝말잇기 인덱스: ${info.word_index}`);
  console.log(`  앞말잇기 인덱스: ${info.reverse_word_index}`);
  console.log(`  끄투 인덱스:     ${info.kkutu_index}`);
  console.log(`  초성:    ${info.choseong}`);
  console.log(`  플래그:  ${flags.length ? flags.join(', ') : '없음'} (${info.flags})`);
  if (info.meaning) console.log(`  뜻:      ${info.meaning}`);
  console.log(line + '\n');
}

// ===== 대화형 CLI =====
async function interactiveCLI() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (p) => new Promise(r => rl.question(p, r));

  let currentMode = GameMode.LAST_AND_FIRST;

  const MODES = Object.values(GameMode).filter(v => v !== 'None');

  console.log('\n' + '═'.repeat(62));
  console.log('  AutoKkutu Node.js  —  끝말잇기 단어 탐색 시스템');
  console.log('  (원본: AutoKkutu v1.2 C# WPF → Node.js 포팅)');
  console.log('═'.repeat(62));
  console.log('  명령어:');
  console.log('    <단어>          → 다음 단어 탐색');
  console.log('    mode <번호>     → 게임 모드 변경');
  console.log('    info <단어>     → 단어 DB 정보 확인');
  console.log('    add <단어>      → 단어 추가');
  console.log('    stat            → 필터 통계');
  console.log('    reset           → 필터(사용 단어 목록) 초기화');
  console.log('    exit / q        → 종료');
  console.log('\n  게임 모드:');
  MODES.forEach((m, i) => console.log(`    ${i}. ${getGameModeName(m)}`));
  console.log('═'.repeat(62) + '\n');

  while (true) {
    const raw = (await question(`[${getGameModeName(currentMode)}] 단어 입력 > `)).trim();
    if (!raw) continue;

    const [cmd, ...rest] = raw.split(/\s+/);
    const arg = rest.join(' ');
    const low = cmd.toLowerCase();

    if (low === 'exit' || low === 'quit' || low === 'q') {
      console.log('\n종료합니다.\n');
      break;
    }

    if (low === 'mode') {
      const idx = parseInt(arg, 10);
      if (!isNaN(idx) && MODES[idx]) {
        currentMode = MODES[idx];
        console.log(`  게임 모드 변경 → ${getGameModeName(currentMode)}\n`);
      } else {
        console.log(`  유효한 모드 번호를 입력하세요 (0~${MODES.length - 1})\n`);
      }
      continue;
    }

    if (low === 'info') {
      if (!arg) { console.log('  사용법: info <단어>\n'); continue; }
      printWordInfo(arg);
      continue;
    }

    if (low === 'add') {
      const word = arg || cmd; // 'add 단어' 또는 그냥 입력
      const targetWord = low === 'add' ? arg : raw;
      if (!targetWord) { console.log('  사용법: add <단어>\n'); continue; }
      const ok = db.addWord(targetWord, WordFlags.KOREAN, '');
      console.log(ok ? `  "${targetWord}" 추가됨\n` : `  "${targetWord}" 추가 실패\n`);
      continue;
    }

    if (low === 'stat') {
      const s = pathFilter.getStats();
      console.log('  필터 통계:');
      console.log(`    사용된 단어: ${s.previousCount}개`);
      console.log(`    지원 불가:   ${s.unsupportedCount}개`);
      console.log(`    존재 안 함:  ${s.inexistentCount}개\n`);
      continue;
    }

    if (low === 'reset') {
      pathFilter.reset();
      console.log('  필터 초기화 완료\n');
      continue;
    }

    // 기본: 단어 탐색
    const result = findNextWord(raw, currentMode);
    if (result && result.results.length > 0) {
      // 사용한 단어를 필터에 기록 (재사용 방지)
      pathFilter.recordUsedWord(raw);
      pathFilter.recordUsedWord(result.results[0].word);
    }
  }

  rl.close();
}

// ===== 단어 일괄 추가 모드 =====
async function addWordsMode() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (p) => new Promise(r => rl.question(p, r));

  console.log('\n단어 일괄 추가 모드');
  console.log('형식: 단어 [플래그번호] [뜻]');
  console.log('예:   안녕 0 인사말');
  console.log('예:   나침반 2 방향 도구  (2 = 공격 단어)');
  console.log('빈 줄 입력 시 종료\n');

  let added = 0;
  while (true) {
    const line = (await question('> ')).trim();
    if (!line) break;
    const [word, flagStr, ...meaningParts] = line.split(/\s+/);
    const flags   = parseInt(flagStr || '0', 10);
    const meaning = meaningParts.join(' ');
    if (db.addWord(word, isNaN(flags) ? WordFlags.KOREAN : flags, meaning)) {
      added++;
      console.log(`  추가: "${word}"`);
    }
  }
  console.log(`\n총 ${added}개 추가. 데이터베이스 단어 수: ${db.getWordCount()}개\n`);
  rl.close();
}

// ===== 데모 모드 =====
function demoMode() {
  console.log('\n' + '═'.repeat(62));
  console.log('  AutoKkutu 데모 모드');
  console.log('═'.repeat(62) + '\n');

  if (db.getWordCount() === 0) loadDemoWords();

  const scenarios = [
    { mode: GameMode.LAST_AND_FIRST,   word: '사과',  mission: '',  desc: '끝말잇기 기본' },
    { mode: GameMode.LAST_AND_FIRST,   word: '나라',  mission: '자', desc: '끝말잇기 미션 글자 "자"' },
    { mode: GameMode.FIRST_AND_LAST,   word: '가방',  mission: '',  desc: '앞말잇기' },
    { mode: GameMode.KKUTU,            word: '나라',  mission: '',  desc: '끄투 모드' },
    { mode: GameMode.KUNG_KUNG_TTA,    word: '가수',  mission: '',  desc: '쿵쿵따 (3글자)' },
  ];

  for (const s of scenarios) {
    console.log(`\n[시나리오] ${s.desc}`);
    console.log(`  게임모드: ${getGameModeName(s.mode)} | 제시단어: "${s.word}"` +
      (s.mission ? ` | 미션: "${s.mission}"` : ''));
    findNextWord(s.word, s.mode, s.mission);
  }

  console.log('데모 완료!\n');
}

// ===== 메인 =====
async function main() {
  await initialize();

  const args = process.argv.slice(2);

  if (args.includes('--demo')) {
    if (db.getWordCount() === 0) loadDemoWords();
    demoMode();
    db.close();
    return;
  }

  if (args.includes('--add-words')) {
    await addWordsMode();
    db.close();
    return;
  }

  const checkIdx = args.indexOf('--check-word');
  if (checkIdx !== -1 && args[checkIdx + 1]) {
    printWordInfo(args[checkIdx + 1]);
    db.close();
    return;
  }

  // 단어가 없으면 샘플 단어 자동 추가
  if (db.getWordCount() === 0) {
    console.log('\n데이터베이스가 비어 있습니다. 샘플 단어를 자동으로 추가합니다...\n');
    loadDemoWords();
  }

  await interactiveCLI();
  db.close();
}

// SIGINT(Ctrl+C) 처리
process.on('SIGINT', () => {
  console.log('\n\n인터럽트 감지. 종료합니다.');
  if (db) db.close();
  process.exit(0);
});

main().catch(err => {
  console.error('\n치명적 오류:', err.message || err);
  if (db) db.close();
  process.exit(1);
});
