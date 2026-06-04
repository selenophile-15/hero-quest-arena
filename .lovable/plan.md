# 로그인 시스템 구현 계획

Supabase 프로젝트(gnelcguiprogfwgzsvgj)는 이미 연동되어 있다는 전제로, Google OAuth 기반 로그인 + 온보딩 + 프로필 메뉴 + 서버 저장 시스템을 한 번에 구축합니다.

---

## 1. 데이터베이스 스키마 (마이그레이션)

### `profiles` 테이블
- `user_id uuid PK` → `auth.users(id) ON DELETE CASCADE`
- `nickname text UNIQUE NOT NULL` (3~16자, 영문/한글/숫자만, citext로 대소문자 무시 중복 검사)
- `google_sub text` (구글 고유 ID — 강퇴 후 재가입 차단용)
- `email text`
- `agreed_at timestamptz NOT NULL` (약관 동의 시각)
- `last_seen_at timestamptz NOT NULL DEFAULT now()` (1년 미접속 자동 삭제 기준)
- `created_at timestamptz DEFAULT now()`
- RLS: 본인만 select/update, insert는 본인 user_id만

### `banned_google_subs` 테이블
- `google_sub text PK`
- `reason text`, `banned_at timestamptz DEFAULT now()`
- RLS: select는 service_role만, public 접근 없음
- 로그인 시 edge function이 검사해서 차단

### `user_heroes` 테이블 (개인 영웅/챔피언 저장, 최대 100개)
- `id uuid PK`, `user_id uuid FK`, `data jsonb`, `kind text ('hero'|'champion')`, `updated_at`
- RLS: 본인만 CRUD
- 100개 제한은 BEFORE INSERT trigger로 강제

### `user_simulations` 테이블 (개인 시뮬 결과, 최대 30개)
- `id uuid PK`, `user_id uuid FK`, `data jsonb`, `win_rate numeric`, `updated_at`
- RLS: 본인만 CRUD
- 30개 제한 trigger

### `ranking_simulations` 테이블 (서버 공개 랭킹용 — 성공률 80%↑ 자동 저장)
- `id uuid PK`, `user_id uuid FK`, `nickname text`, `data jsonb`, `win_rate numeric`, `created_at`
- RLS: 모두 select 가능, insert는 본인 user_id + win_rate≥80 체크 정책으로 제한

### GRANT
- 모든 public 테이블에 `authenticated` 권한 명시
- `ranking_simulations`는 `anon`에도 select 허용

### Trigger
- `handle_new_user`는 생성하지 않음 (닉네임/동의가 필요하므로 온보딩 완료 시 client-side insert)

---

## 2. Supabase Google OAuth 설정 안내
사용자가 직접 Supabase 대시보드 → Authentication → Providers → Google에서 Client ID/Secret을 등록해야 함을 안내. (현 도구로는 provider 활성화 불가)

---

## 3. 프론트엔드 구현

### `src/integrations/supabase/client.ts`
- 이미 존재. 그대로 사용.

### `src/hooks/use-auth.tsx` (신규)
- `AuthProvider`: `onAuthStateChange` + 초기 `getSession`
- 제공값: `user`, `session`, `profile`, `loading`, `signInWithGoogle()`, `signOut()`, `refreshProfile()`
- 로그인 후 profile이 없으면 → 온보딩 모달 강제 오픈
- 로그인 시 `last_seen_at` 업데이트

### `src/components/OnboardingDialog.tsx` (신규)
구글 인증 직후 최초 1회만 표시:
- 닉네임 입력 (실시간 중복 검사 — debounce 후 `select count from profiles where nickname ilike $1`)
  - 안내: "가급적 인게임과 일치하는 닉네임을 입력해주세요."
  - 경고: "선정적/정치적/비속어 등 논란이 될 닉네임은 운영자에 의해 계정이 삭제되고 재가입이 차단될 수 있습니다."
- 동의 체크박스 3개 (모두 필수):
  1. 닉네임 + 성공률 80% 초과 시뮬 결과가 서버에 자동 저장·활용됨
  2. 논란 닉네임 시 계정 삭제 및 재가입 차단
  3. 1년 미접속 시 계정 자동 삭제
- 모두 체크 + 닉네임 유효 시 "시작하기" 활성 → profiles insert (google_sub은 user.identities[0].id에서 추출)
- 동의 미완료 상태로 닫으면 자동 로그아웃

### `src/components/ProfileMenu.tsx` (신규)
화면 우측 상단 고정. DropdownMenu:
- 헤더에 닉네임 표시
- "내 데이터 추출" → 영웅/챔피언/시뮬 결과 LocalStorage 데이터를 `.txt`로 저장 (기존 `saveBlobFile` 사용)
- "로그아웃"

### 모험시작 버튼 동작 변경
- 비로그인 → `signInWithGoogle()` 호출 (redirectTo = `window.location.origin + '/dashboard'`)
- 로그인됨 + 온보딩 미완료 → 온보딩 모달
- 로그인됨 + 온보딩 완료 → 기존 대시보드 진입

### 차단 검사
- 로그인 직후 edge function `check-ban` 호출 → google_sub이 banned_google_subs에 있으면 즉시 signOut + "계정이 차단되었습니다" 안내

### `src/integrations/webhook.ts` 또는 기존 webhook 전송 코드
- 기존 webhook payload에 `user_id`, `nickname` 필드 추가

### App.tsx
- `<AuthProvider>`로 라우트 감싸기
- 상단 우측 `<ProfileMenu />` 마운트 (로그인 시에만)

---

## 4. Edge Function: `check-ban`
- 입력: `google_sub`
- service_role 클라이언트로 `banned_google_subs` 조회
- 차단되어 있으면 해당 user의 auth 계정 삭제 후 `{banned: true}` 반환

---

## 5. 기술 세부사항

- **닉네임 검증 규칙**: `/^[가-힣A-Za-z0-9_]{3,16}$/`
- **중복 검사**: insert 시 unique violation 처리 + 입력 중 debounce 사전 검사
- **자동 랭킹 저장**: 시뮬레이션 완료 시 `win_rate >= 80`이면 `ranking_simulations`에 insert (기존 시뮬 종료 콜백 지점에서)
- **개인 저장 동기화**: 추후 단계로 분리. 이번 PR에선 테이블 + RLS + 100/30 제한 trigger까지만. UI 동기화는 다음 작업.
- **웹훅 user_id**: 현재 webhook 호출부를 grep으로 찾아 user_id/nickname 주입

---

## 6. 이번 PR 범위
1. 마이그레이션 (테이블 + RLS + GRANT + trigger)
2. `useAuth` 훅
3. 온보딩 모달 (닉네임 중복 검사 + 동의 3종)
4. 프로필 메뉴 (로그아웃 + 데이터 추출)
5. 모험시작 버튼 → Google 로그인 트리거
6. check-ban edge function
7. webhook 페이로드에 user_id/nickname 추가

다음 PR에서 작업할 항목 (확인 필요):
- LocalStorage ↔ user_heroes/user_simulations 양방향 동기화
- 랭킹 탭에서 `ranking_simulations` 조회 UI

---

## 사용자 확인 필요

1. **Google OAuth credentials**: Supabase 대시보드 Provider 설정에 Client ID/Secret 직접 입력 가능하신가요? (Lovable에서 자동 설정 불가)
2. **이번 PR에 LocalStorage ↔ 서버 동기화까지 포함할까요?** 아니면 인증/온보딩/스키마까지만 하고 동기화는 다음 단계로 나눌까요? (분리 권장 — 동기화는 충돌·마이그레이션 이슈가 많음)
3. **모험시작 버튼이 현재 어디인가요?** Index 페이지 메인 CTA로 보이는데, 같은 동작을 `/dashboard` 진입 가드에도 적용할지요?
