## 목표
공격력(필요시 방어력)의 조건부 보너스(상어/공룡/문드라/광전사)와 헴마 누적 보너스를 PDF 공식대로 **단독 ATK 단계의 commonPct에 합산해서 곱하는** 방식으로 재배열한다. 현재는 `finalAtk × (1 + 조건부%)`로 이중 곱이 일어나서 결과가 살짝 부풀려져 있다.

## 변경 파일

### 1) `src/lib/statCalculator.ts`
`CalculatedStats`에 두 필드 추가:
- `atkConstant: number` = `baseAtk + seedAtk + equipAtk + bonusSummary.flatAtk` (퍼센트 곱 전 상수)
- `commonAtkPct: number` = `bonusSummary.pctAtk` (소수가 아니라 그대로, 단위 %)
- (방어력도 같이) `defConstant`, `commonDefPct`

`totalAtk` 계산은 그대로 두되 이 두 값을 추가로 노출.

### 2) `src/lib/partyBuffCalculator.ts`
`PrecomputedHeroStats` 비슷한 구조에 추가 필드를 같이 산출해 넘긴다:
- `atkConstant`, `commonAtkPct`, `partyAtkMult` (= `(1 + champAtk*mod + aurasong.atk)*mercMult + booster + loneWolf`)
- `aurasongFlatAtk`
- (방어력 동일 세트)

기존 `atk`/`def`/`hp` 등 다른 필드는 유지 (다른 곳에서 표시용으로 쓰는 경우 대비).

### 3) `src/lib/combatSimulation.ts`
- `PrecomputedHeroStats` 인터페이스에 위 7개 필드 추가 (옵셔널로 두고 없으면 기존 방식 폴백).
- L805 부근 precomputed 경로에서 `atkConstant`, `commonAtkPct`, `partyAtkMult`, `aurasongFlatAtk` 추출.
- L1714 `atkMod` 제거하고 매 턴 다음과 같이:
  ```
  condPct = sharkActive*0.01*heroShark[jj]
          + dinosaurActive*0.01*heroDinosaur[jj]
          + (monster.isBoss ? 0.2 : 0) * heroMundra[jj]  // 단위 보정 필요
          + 0.1*(1+heroBerserkerLevel[jj])*berserkerStage[jj]
  standaloneAtk = atkConstant[jj] * (1 + commonAtkPct[jj]/100 + condPct)
  effectiveAtk = standaloneAtk * partyAtkMult[jj] + aurasongFlatAtk[jj]
  baseHeroDmg = effectiveAtk * tamasAtkMult + hemmaBonus[jj]
  ```
- **헴마 누적**: 매 턴 시작 시 헴마 본인의 그 턴 `standaloneAtk_hemma * hemmaMult`를 `hemmaBonus[hemmaWho]`에 누적(흡수 이벤트 발생 시점에).
- **방어력**: precomputed 경로에서 `finalDef[i]`를 매 턴 보스 여부에 따라 `defConstant*(1+commonDefPct + 0.2*mundra_def_if_boss) * partyDefMult + aurasongFlatDef`로 동적 계산. AoE 단일 모두에 적용되어야 하므로 라운드 진입 시 `damageTaken[i]`/`critDamageTaken[i]`를 보스이고 문드라 있는 영웅만 재계산.
  - 비용 줄이려면 보스전이고 mundra>0인 영웅만 별도 분기.

### 4) 폴백 경로(L840-997 비-precomputed 경로)
`finalAtk` 식에 conditional shark/dino/mundra/berserker가 들어가 있지 않으므로 그대로 두되, 시뮬 본문의 새 `condPct` 적용 식이 폴백에도 작동하도록 `atkConstant`/`commonAtkPct`/`partyAtkMult` 계산을 폴백에도 채워준다.

### 5) 검증
- 조건부 보너스가 전부 0(상어·공룡·문드라·광전사 없음)인 영웅: `effectiveAtk == finalAtk` (수치 회귀 없음) 확인.
- 상어만 활성된 단순 케이스: 외부 스크립트 식 `base × (1 + commonPct + sharkPct) × partyMult`와 정확히 일치.
- 헴마 단독 시뮬에서 흡수 누적치가 그 턴 standalone ATK 기준으로 늘어나는지 콘솔 로그로 1회 확인.

## 미확인 / 사용자 확인 부탁
- 첨부 PDF가 세션에 더이상 없어. **HP에 조건부 보너스가 있었는지** 다시 알려주거나 PDF 재첨부 부탁.
- 위 식에서 문드라가 보스일 때만 `+20%×수치` 인지 코드 라벨로 추정한 것 — 맞는지 확인.
