### 1. 시뮬레이션 결과 확장 (`src/lib/combatSimulation.ts`)

- `SimulationResult` 인터페이스에 `retryResult?: SimulationResult` 필드 추가
- Fateweaver/Chronomancer 재시도 경로(L2213~)에서 이미 호출하는 재귀 `runCombatSimulation(...)` 결과 전체를 반환 객체에 그대로 실어 보냄 (현재는 winRate만 꺼내 씀)
- 재시도 시뮬레이션은 이미 `getRetryBooster(booster)`(원본 부스터 + 일반 부스터 +20%/+20%)로 돌고 있어서, 그 안에서 계산된 winRounds/loseRounds, winHeroResults/loseHeroResults, party aggregates, miniBossResults 등 모든 버킷 통계가 그대로 재시도 전용 데이터로 활용 가능

### 2. 토글 UI (`src/components/QuestSimulation.tsx`)

- 전역 state 추가: `retryOnly: boolean` (시뮬 재실행 시 자동 false 초기화)
- 노출 조건: `simResult.retryResult` 가 있을 때만 활성화 (페이트위버/크로노맨서가 있고 첫 시도가 100%가 아닌 경우)
- `ResultTabsToggle` 시그니처 확장: `retryOnly`, `onToggleRetryOnly`, `hasRetry` 추가
  - "전체 / 성공 / 실패" 버튼 그룹 왼쪽에 모래시계(Hourglass) 아이콘 버튼 배치
  - HeroList 편집모드 휴지통과 동일 스타일: 비활성 = `bg-muted text-muted-foreground`, 활성 = `bg-primary text-primary-foreground` (또는 amber 계열) + 부드러운 글로우
  - 모든 ResultTabsToggle 인스턴스가 같은 state를 공유하므로 한 곳에서 누르면 모든 섹션 동기화
- `hasRetry === false` 인 경우 모래시계 버튼 자체를 숨김 → 기존 UI 그대로 유지

### 3. 표시 데이터 스왑

- 컴포넌트 최상단 가까이에서 파생값 정의:
  ```
  const activeSimResult = retryOnly && simResult?.retryResult ? simResult.retryResult : simResult;
  ```
- 주요 결과/상세 정보에서 사용하는 `simResult.winRounds`, `simResult.winHeroResults`, `simResult.partyDmgDealt`, `simResult.miniBossResults`, `simResult.winPartyDmgTaken` 등 모든 버킷 관련 접근을 `activeSimResult.`로 치환
- 전체 승률 / 평균 라운드 표시도 retryOnly 모드에서는 `activeSimResult.rawWinRate`(재시도 단판 기준)와 그 라운드 통계를 사용
- 합산 winRate (1차+재시도)는 retryOnly === false 일 때만 표시

### 4. 파티 구성 / 스탯 계산표에 부스터 반영

- retryOnly + Fateweaver/Chronomancer 존재 시: 표시되는 ATK/DEF는 일반 부스터 1개 분량 + 기존 부스터 가 적용된 값이어야 함
- 파티 구성 표(L492~518 영역) 렌더링 시:
  - 기존 `buffedStats` 의 `atkConstant`, `commonAtkPct`, `partyAtkMult` 이 이미 있음
  - retryOnly 모드면 보너스 가산식만 추가:
    ```
    extra = 0.2  // 일반 부스터 한 개 분량
    displayAtk = round(atkConstant * (1 + commonAtkPct + extra) * partyAtkMult)
    displayDef = round(defConstant * (1 + commonDefPct + extra) * partyDefMult)
    ```
  - HP/CRIT 등 비대상 스탯은 그대로
- 스탯 계산표 (StatBreakdownDrawer)는 별도 prop `retryBoosterActive?: boolean` 받아서 `통합 보너스 요약` 의 `총 공통 %` 줄과 최종 ATK/DEF 줄에 `+20%(재시도 부스터)` 항목을 명시적으로 추가하여 보여줌. 토글이 꺼져 있을 때는 기존과 동일

### 5. 검증

- 빌드 후 페이트위버 포함 파티/미포함 파티 각각에서:
  - 미포함: 모래시계 버튼 숨김 확인
  - 포함: 토글 ON → 모든 ResultTabsToggle UI 동기화, 주요결과/상세정보가 재시도 전용 통계로 갱신, 파티 구성 ATK/DEF가 +20% 반영된 값으로 표시
- 콘솔/네트워크 에러 없는지 확인

### 비고

- 재시도 시뮬레이션은 같은 미니보스 여부/유형으로 진행되도록 이미 동일 `config`(miniBoss 포함)를 전달하므로 추가 변경 불필요
- 저장된 결과(`SavedSimulationSummary`)에는 retryOnly 상태를 따로 보관하지 않음 — 화면 필터에만 영향
