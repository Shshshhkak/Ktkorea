# AutoKkutu Node.js

한국어 끝말잇기 게임(끄투.io) 자동화 봇 **AutoKkutu v1.2** (C# WPF)의 핵심 라이브러리를 **Node.js**로 재구성한 버전입니다.

---

## 기능

- **끝말잇기 / 앞말잇기 / 가운뎃말잇기 / 끄투 / 쿵쿵따** 게임 모드 지원
- **두음법칙** 자동 적용 (예: "라디오" → "나" 또는 "아" 조건 자동 생성)
- **한방 단어 / 공격 단어 / 미션 단어** 우선순위 탐색
- **SQLite 단어 데이터베이스** (better-sqlite3 기반)
- 이미 사용된 단어 자동 필터링
- **대화형 CLI** 인터페이스

---

## 파일 구조

```
autokkutu-node/
├── index.js              ← 메인 진입점 (node index.js 로 실행)
├── package.json          ← 의존성 정의
├── config.json           ← 설정 파일 (첫 실행 시 자동 생성)
├── .gitignore
│
├── src/
│   ├── hangul.js         ← 한글 처리 (자모 분해·합성, 두음법칙)
│   ├── gameMode.js       ← 게임 모드 정의 및 단어→노드 변환
│   ├── wordFlags.js      ← 단어 속성(플래그) 비트마스크 정의
│   ├── wordCondition.js  ← 단어 검색 조건 구조체
│   ├── database.js       ← SQLite 데이터베이스 관리
│   ├── pathFinder.js     ← 최적 단어 탐색 알고리즘
│   ├── pathFilter.js     ← 사용된 단어·지원 불가 단어 필터
│   ├── config.js         ← 설정 관리
│   └── logger.js         ← 로그 출력
│
└── data/
    └── path.sqlite       ← 단어 데이터베이스 (자동 생성)
```

---

## 설치 방법 (단계별)

### 1단계: Node.js 설치 확인

터미널(명령 프롬프트)에서 아래 명령어를 실행해 Node.js가 설치되어 있는지 확인합니다.

```bash
node --version
```

`v18.0.0` 이상이 출력되면 정상입니다.  
설치되지 않았다면 https://nodejs.org 에서 LTS 버전을 설치하세요.

### 2단계: 프로젝트 폴더로 이동

```bash
cd autokkutu-node
```

### 3단계: 의존성 설치

```bash
npm install
```

아래 패키지가 자동으로 설치됩니다:
- `better-sqlite3` — SQLite 데이터베이스
- `chalk` — 색상 있는 콘솔 출력

---

## 실행 방법

### 대화형 CLI 모드 (기본)

```bash
node index.js
```

실행하면 샘플 단어가 자동으로 추가되고, 대화형 프롬프트가 표시됩니다.

```
[끝말잇기] > 사과
```

단어를 입력하면 다음에 쓸 수 있는 최적의 단어를 찾아줍니다.

### 데모 모드

```bash
node index.js --demo
```

다양한 게임 모드에서 단어 탐색 과정을 자동으로 시연합니다.

### 단어 일괄 추가 모드

```bash
node index.js --add-words
```

터미널에서 단어를 직접 입력하여 데이터베이스에 추가합니다.

형식:
```
단어 [플래그번호] [뜻]
예) 안녕 0 인사말
예) 나침반 2 방향을 알려주는 도구
```

### 특정 단어 정보 확인

```bash
node index.js --check-word 사과
```

---

## CLI 명령어 목록

대화형 모드에서 사용 가능한 명령어:

| 명령어 | 설명 |
|--------|------|
| `<단어>` | 해당 단어를 기반으로 다음 단어를 탐색 |
| `mode <번호>` | 게임 모드 변경 (0=끝말잇기, 3=끄투, 4=쿵쿵따, …) |
| `info <단어>` | 단어의 DB 정보(플래그, 인덱스 등) 출력 |
| `add <단어>` | 새 단어를 데이터베이스에 추가 |
| `stat` | 필터 통계 (사용된 단어 수 등) 출력 |
| `reset` | 사용된 단어 필터 초기화 |
| `exit` | 종료 |

---

## 게임 모드

| 번호 | 모드 | 설명 |
|------|------|------|
| 1 | 끝말잇기 (LastAndFirst) | 앞 단어의 마지막 글자로 시작 |
| 2 | 앞말잇기 (FirstAndLast) | 앞 단어의 첫 글자로 끝나는 단어 |
| 3 | 가운뎃말잇기 | 앞 단어의 중간 글자로 시작 |
| 4 | 끄투 (Kkutu) | 앞 단어의 끝 두 글자로 시작 |
| 5 | 쿵쿵따 | 2글자 또는 3글자 단어만 사용 |

---

## 단어 플래그 (flags) 값

데이터베이스의 `flags` 컬럼은 비트마스크로 단어의 속성을 저장합니다.

| 값 | 의미 |
|----|------|
| 0 | 없음 |
| 1 | 한방 단어 (끝말잇기) |
| 2 | 공격 단어 (끝말잇기) |
| 4 | 앞말잇기 한방 단어 |
| 64 | 끄투 한방 단어 |
| 2048 | 한국어 단어 |
| 16384 | 외래어 |

여러 속성을 조합할 때는 값을 더합니다. 예: 한국어 한방 단어 = `2048 + 1 = 2049`

---

## 설정 파일 (config.json)

첫 실행 시 자동 생성됩니다. 직접 수정하여 동작을 변경할 수 있습니다.

```json
{
  "database": {
    "path": "data/path.sqlite"
  },
  "game": {
    "defaultMode": "LastAndFirst",
    "applyInitialLaw": true,
    "useEndWord": true,
    "useAttackWord": true,
    "reuseAlreadyUsed": false,
    "maxResults": 30
  },
  "logLevel": "INFO"
}
```

---

## 원본 프로젝트 구조와의 대응

| 원본 C# (AutoKkutu) | Node.js 포팅 |
|---------------------|-------------|
| `AutoKkutuLib/Hangul/` | `src/hangul.js` |
| `AutoKkutuLib/GameMode.cs` | `src/gameMode.js` |
| `AutoKkutuLib/Extension/GameModeExtension.cs` | `src/gameMode.js` |
| `AutoKkutuLib/Extension/WordToNodeExtension.cs` | `src/gameMode.js` |
| `AutoKkutuLib/WordFlags.cs` | `src/wordFlags.js` |
| `AutoKkutuLib/WordCategories.cs` | `src/wordFlags.js` |
| `AutoKkutuLib/WordCondition.cs` | `src/wordCondition.js` |
| `AutoKkutuLib/Database/` | `src/database.js` |
| `AutoKkutuLib/Database/Path/PathFinder.cs` | `src/pathFinder.js` |
| `AutoKkutuLib/Database/Sql/Query/FindWordQuery.cs` | `src/pathFinder.js` |
| `AutoKkutuLib/Database/Path/PathFilter.cs` | `src/pathFilter.js` |
| `AutoKkutuLib/Database/DatabaseConstants.cs` | `src/database.js` |

> **참고**: 브라우저 자동화(CefSharp/Selenium), GUI(WPF), WebSocket 스니퍼 등  
> Windows 전용 기능은 Node.js 버전에서 제외되었습니다.
> 핵심 단어 탐색 엔진과 데이터베이스 로직에 집중하였습니다.

---

## 라이선스

MIT
