# 관리자급 날짜시간 직접 편집 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `admin`·`operator`만 접수/1차처리/완료 날짜시간을 직접 수정할 수 있게 하고, 일반 사용자는 현재 시각 자동 기록만 되도록 UI와 DB 트리거로 이중 방어한다.

**Architecture:** 프론트엔드(`records/page.tsx`)에서 `isAdmin` 파생값으로 4개 모달의 날짜 편집 UI를 조건부 노출한다. DB에는 `service_records`에 `BEFORE INSERT/UPDATE` 트리거를 추가해, 일반 사용자가 보낸 날짜 값을 서버 시각/기존값으로 강제한다. 기존 RLS 정책·스키마는 변경하지 않는다.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase(PostgreSQL/PL-pgSQL), TailwindCSS 4. 테스트 프레임워크 없음 → 검증은 `npm run lint`, `npm run build`, 수동 시나리오.

## Global Constraints

- 관리자급 판별: `admin`, `operator` 두 역할. 프론트는 `userRole === 'admin' || userRole === 'operator'`, DB는 기존 `public.check_is_admin()`(role IN ('admin','operator')).
- 시간 순서(접수 ≤ 1차 ≤ 완료) 검증하지 않음.
- 기존 RLS 정책, 다른 페이지, 기존 컬럼 스키마 변경 금지.
- 날짜 저장은 UTC ISO(`toISOString()`), 편집칸은 `datetime-local`(로컬 `YYYY-MM-DDTHH:mm`).
- 기존 코드 스타일(2-space 들여쓰기, `any` 허용, 인라인 Tailwind 클래스)을 따른다.
- 커밋은 한국어 메시지 + `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` 푸터.
- 대상 파일: `src/app/dashboard/records/page.tsx`(수정), `supabase/add_datetime_admin_protection.sql`(신규).

## File Structure

- `supabase/add_datetime_admin_protection.sql` — 신규. 트리거 함수 + 트리거. 재실행 가능(`CREATE OR REPLACE` / `DROP ... IF EXISTS`).
- `src/app/dashboard/records/page.tsx` — 수정. `RecordsPageContent` 컴포넌트에 `isAdmin` 파생값과 datetime 변환 헬퍼를 추가하고, 신규/수정/1차처리/완료 모달 4곳과 관련 핸들러(`handleAddRecord`, `handleUpdateRecord`)를 수정.

---

### Task 1: DB 트리거 SQL 파일 작성

트리거는 프론트와 독립적이므로 먼저 만든다. 이 파일은 배포 시 Supabase SQL Editor에서 수동 실행한다.

**Files:**
- Create: `supabase/add_datetime_admin_protection.sql`

**Interfaces:**
- Consumes: 기존 함수 `public.check_is_admin() RETURNS BOOLEAN` (role IN ('admin','operator')), 테이블 `public.service_records` (컬럼 `reception_at`, `started_at`, `processed_at` : TIMESTAMPTZ).
- Produces: 함수 `public.enforce_record_datetime_protection()`, 트리거 `trg_enforce_record_datetime` on `public.service_records`.

- [ ] **Step 1: SQL 파일 작성**

파일 전체 내용:

```sql
-- ============================================================
-- service_records 날짜시간 컬럼 관리자 전용 보호 트리거
-- 일반 사용자(admin/operator 외)는 reception_at/started_at/processed_at을
-- 임의로 지정할 수 없고, 서버 시각(now())/기존값으로 강제된다.
-- 관리자(admin/operator)는 자유롭게 지정 가능.
-- check_is_admin()은 기존 정의(role IN ('admin','operator'))를 사용.
-- 배포: Supabase 대시보드 SQL Editor에서 수동 실행.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_record_datetime_protection()
RETURNS TRIGGER AS $$
BEGIN
    -- 관리자급은 보낸 값 그대로 존중
    IF public.check_is_admin() THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.reception_at := now();
        IF NEW.started_at IS NOT NULL THEN
            NEW.started_at := now();
        END IF;
        IF NEW.processed_at IS NOT NULL THEN
            NEW.processed_at := now();
        END IF;

    ELSIF TG_OP = 'UPDATE' THEN
        -- 접수일시는 변경 금지
        NEW.reception_at := OLD.reception_at;

        -- 1차처리 시각: NULL->값(최초)이면 now(), 값->다른값(변경)이면 무시, 값->NULL(되돌리기)은 허용
        IF OLD.started_at IS NULL AND NEW.started_at IS NOT NULL THEN
            NEW.started_at := now();
        ELSIF OLD.started_at IS NOT NULL
              AND NEW.started_at IS NOT NULL
              AND NEW.started_at <> OLD.started_at THEN
            NEW.started_at := OLD.started_at;
        END IF;

        -- 완료 시각: started_at과 동일 규칙
        IF OLD.processed_at IS NULL AND NEW.processed_at IS NOT NULL THEN
            NEW.processed_at := now();
        ELSIF OLD.processed_at IS NOT NULL
              AND NEW.processed_at IS NOT NULL
              AND NEW.processed_at <> OLD.processed_at THEN
            NEW.processed_at := OLD.processed_at;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_record_datetime ON public.service_records;
CREATE TRIGGER trg_enforce_record_datetime
    BEFORE INSERT OR UPDATE ON public.service_records
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_record_datetime_protection();
```

- [ ] **Step 2: 문법 자체 점검**

psql/Supabase CLI가 없으면 육안 점검(다른 `supabase/*.sql`과 동일한 `CREATE OR REPLACE FUNCTION ... SECURITY DEFINER SET search_path = public` 패턴인지, `$$` 짝, 세미콜론 확인). 실제 적용은 배포 시 Supabase SQL Editor에서 수행.

- [ ] **Step 3: 커밋**

```bash
git add supabase/add_datetime_admin_protection.sql
git commit -m "관리자 전용 날짜시간 보호 트리거 SQL 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 프론트 공통 — isAdmin 파생값, datetime 헬퍼, newRecord.reception_at 필드

이후 모든 모달 태스크가 의존하는 공통 조각을 먼저 추가한다. UI 노출은 아직 없으므로 이 태스크만으로는 화면 변화가 없다(빌드/린트로만 검증).

**Files:**
- Modify: `src/app/dashboard/records/page.tsx`

**Interfaces:**
- Produces:
  - `const isAdmin: boolean` — `RecordsPageContent` 본문 파생값.
  - `function toDateTimeLocal(iso: string | null | undefined): string` — UTC ISO → `datetime-local` 표시값. 빈/무효값은 `''`.
  - `function nowDateTimeLocal(): string` — 현재 시각의 `datetime-local` 문자열.
  - `newRecord.reception_at: string` 필드.

- [ ] **Step 1: datetime 변환 헬퍼 추가**

`formatDateTime` 함수(현재 652행 부근) 바로 위에 두 헬퍼를 추가한다:

```tsx
// UTC ISO 문자열 -> datetime-local 입력값(YYYY-MM-DDTHH:mm, 로컬 시각)
function toDateTimeLocal(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// 현재 시각의 datetime-local 문자열
function nowDateTimeLocal(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
```

- [ ] **Step 2: isAdmin 파생값 추가**

`const supabase = createClient();`(72행 부근) 바로 아래에 추가:

```tsx
    const isAdmin = userRole === 'admin' || userRole === 'operator';
```

- [ ] **Step 3: newRecord 초기 state에 reception_at 추가**

`useState`의 `newRecord` 초기값(26-37행)에서 `client_id: '',` 다음 줄에 추가:

```tsx
        reception_at: '',
```

- [ ] **Step 4: handleAddRecord 리셋 객체에도 reception_at 추가**

`handleAddRecord` 성공 후 리셋하는 `setNewRecord({ client_id: '', ... })`(468행)에 `reception_at: ''`을 포함하도록 수정:

```tsx
            setNewRecord({ client_id: '', reception_at: '', type: '장애', details: '', receiver_id: '', status: 'pending', started_at: '', processed_at: '', first_handler_id: '', handler_id: '', result: '' });
```

- [ ] **Step 5: 린트 검증**

Run: `npm run lint`
Expected: 신규 코드로 인한 새 에러 없음(기존 경고는 무방).

- [ ] **Step 6: 커밋**

```bash
git add src/app/dashboard/records/page.tsx
git commit -m "날짜 편집 공통 유틸(isAdmin, datetime 헬퍼) 및 reception_at 필드 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 신규 접수 모달 — 관리자 날짜 편집 UI + handleAddRecord 반영

**Files:**
- Modify: `src/app/dashboard/records/page.tsx`

**Interfaces:**
- Consumes: `isAdmin`, `nowDateTimeLocal`, `newRecord.reception_at`(Task 2).
- Produces: 없음(UI/핸들러 변경만).

- [ ] **Step 1: 접수일시 편집칸 추가(관리자 전용)**

신규 접수 모달의 "접수자" select 블록(현재 1060-1072행, `<div className="space-y-1">...접수자...</div>`) **바로 다음**에 아래 블록을 삽입한다:

```tsx
                    {isAdmin && (
                        <div className="space-y-1">
                            <label className="text-sm font-medium block mb-1">접수일시 <span className="text-[11px] text-slate-400">(관리자 · 미입력 시 현재 시각)</span></label>
                            <input
                                type="datetime-local"
                                className="input-field w-full"
                                value={newRecord.reception_at}
                                onChange={e => setNewRecord({ ...newRecord, reception_at: e.target.value })}
                            />
                        </div>
                    )}
```

- [ ] **Step 2: 1차처리/완료 시각 편집칸 추가(관리자 전용)**

처리중/완료일 때 나타나는 영역(현재 1130-1175행, `{(newRecord.status === 'processing' || newRecord.status === 'completed') && (` 블록) 내부에서, "처리 내용" textarea를 감싸는 `<div>`(1164-1173행) **바로 앞**에 아래 블록을 삽입한다:

```tsx
                            {isAdmin && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">1차처리 일시</label>
                                        <input
                                            type="datetime-local"
                                            className="input-field w-full text-sm"
                                            value={newRecord.started_at}
                                            onChange={e => setNewRecord({ ...newRecord, started_at: e.target.value })}
                                        />
                                    </div>
                                    {newRecord.status === 'completed' && (
                                        <div>
                                            <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">완료 일시</label>
                                            <input
                                                type="datetime-local"
                                                className="input-field w-full text-sm"
                                                value={newRecord.processed_at}
                                                onChange={e => setNewRecord({ ...newRecord, processed_at: e.target.value })}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
```

주: 상태 버튼 클릭 시 `started_at`/`processed_at`이 현재 시각으로 자동 세팅되는 기존 로직(1099-1126행)은 그대로 두어, 관리자에게는 그 값이 기본으로 채워지고 편집 가능하게 된다.

- [ ] **Step 3: handleAddRecord에 reception_at 반영(관리자 전용)**

`handleAddRecord`의 `recordData` 객체 생성부(416-422행) 다음, `if (newRecord.status === 'processing' ...` 앞에 추가:

```tsx
            if (isAdmin && newRecord.reception_at) {
                recordData.reception_at = new Date(newRecord.reception_at).toISOString();
            }
```

(일반 사용자는 `reception_at` 미포함 → DB `DEFAULT now()`. `started_at`/`processed_at`은 기존 로직 그대로이며, 일반 사용자 값은 트리거가 서버 시각으로 강제.)

- [ ] **Step 4: 린트 검증**

Run: `npm run lint`
Expected: 새 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add src/app/dashboard/records/page.tsx
git commit -m "신규 접수 모달에 관리자 전용 날짜시간 편집 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 수정 모달 — 관리자 날짜 편집 UI 3개 + handleUpdateRecord 반영

**Files:**
- Modify: `src/app/dashboard/records/page.tsx`

**Interfaces:**
- Consumes: `isAdmin`, `toDateTimeLocal`(Task 2), `editingRecord`(record 전체: `reception_at`/`started_at`/`processed_at`는 UTC ISO).
- Produces: 없음.

- [ ] **Step 1: 수정 모달에 날짜 편집칸 3개 추가(관리자 전용)**

수정 모달의 "상태" 버튼 블록(현재 1290-1315행, `<div><label>상태</label>...</div>`) **바로 다음**, 담당자 grid 블록(1316행 `<div className="grid grid-cols-3 gap-3 border-t ...">`) **앞**에 삽입:

```tsx
                        {isAdmin && (
                            <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-3">
                                <div>
                                    <label className="text-sm font-medium block mb-1">접수일시</label>
                                    <input
                                        type="datetime-local"
                                        className="input-field w-full text-sm"
                                        value={toDateTimeLocal(editingRecord.reception_at)}
                                        onChange={e => setEditingRecord({ ...editingRecord, reception_at: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-1">1차처리 일시</label>
                                    <input
                                        type="datetime-local"
                                        className="input-field w-full text-sm"
                                        value={toDateTimeLocal(editingRecord.started_at)}
                                        onChange={e => setEditingRecord({ ...editingRecord, started_at: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-1">완료 일시</label>
                                    <input
                                        type="datetime-local"
                                        className="input-field w-full text-sm"
                                        value={toDateTimeLocal(editingRecord.processed_at)}
                                        onChange={e => setEditingRecord({ ...editingRecord, processed_at: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}
```

- [ ] **Step 2: handleUpdateRecord의 날짜 저장 로직 수정**

`handleUpdateRecord`의 `.update({...})` 호출(483-497행)을 아래로 교체한다. `started_at`/`processed_at`을 ISO로 정규화(편집 시 datetime-local 문자열, 미편집 시 기존 ISO 둘 다 `new Date().toISOString()`으로 안전 변환)하고, `reception_at`은 관리자일 때만 payload에 포함한다:

```tsx
            const updatePayload: any = {
                client_id: editingRecord.client_id || null,
                type: editingRecord.type,
                details: editingRecord.details,
                result: editingRecord.result,
                status: editingRecord.status,
                processed_at: editingRecord.processed_at ? new Date(editingRecord.processed_at).toISOString() : null,
                started_at: editingRecord.started_at ? new Date(editingRecord.started_at).toISOString() : null,
                receiver_id: editingRecord.receiver_id || null,
                first_handler_id: editingRecord.first_handler_id || null,
                handler_id: editingRecord.handler_id || null
            };
            if (isAdmin && editingRecord.reception_at) {
                updatePayload.reception_at = new Date(editingRecord.reception_at).toISOString();
            }
            const { error } = await supabase
                .from('service_records')
                .update(updatePayload)
                .eq('id', editingRecord.id);
```

(일반 사용자는 편집칸이 없어 `started_at`/`processed_at`이 기존 ISO 그대로 재전송되며, 트리거가 기존값을 유지한다. `reception_at`은 애초에 전송하지 않으며 트리거도 OLD 유지.)

- [ ] **Step 3: 린트 검증**

Run: `npm run lint`
Expected: 새 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add src/app/dashboard/records/page.tsx
git commit -m "접수 수정 모달에 관리자 전용 날짜시간 편집 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 1차처리 모달 & 완료 모달 — datetime 편집 관리자 게이팅

**Files:**
- Modify: `src/app/dashboard/records/page.tsx`

**Interfaces:**
- Consumes: `isAdmin`(Task 2).
- Produces: 없음.

- [ ] **Step 1: 1차처리 모달의 처리일시 input 게이팅**

1차처리 모달의 처리일시 `<input type="datetime-local" ... value={processingRecord.started_at} ...>`(현재 1415-1420행)을 아래로 교체(`disabled={!isAdmin}` + 비관리자 안내):

```tsx
                            <input
                                type="datetime-local"
                                className={`input-field w-full ${!isAdmin ? 'bg-slate-50 text-slate-500' : ''}`}
                                value={processingRecord.started_at}
                                disabled={!isAdmin}
                                onChange={e => setProcessingRecord({ ...processingRecord, started_at: e.target.value })}
                            />
                            {!isAdmin && <p className="text-[11px] text-slate-400 mt-1">현재 시각으로 기록됩니다.</p>}
```

- [ ] **Step 2: 완료 처리 모달의 처리일시 input 게이팅**

완료 처리 모달의 처리일시 `<input type="datetime-local" ... value={completingRecord.processed_at} ...>`(현재 1371-1376행)을 아래로 교체:

```tsx
                            <input
                                type="datetime-local"
                                className={`input-field w-full ${!isAdmin ? 'bg-slate-50 text-slate-500' : ''}`}
                                value={completingRecord.processed_at}
                                disabled={!isAdmin}
                                onChange={e => setCompletingRecord({ ...completingRecord, processed_at: e.target.value })}
                            />
                            {!isAdmin && <p className="text-[11px] text-slate-400 mt-1">현재 시각으로 기록됩니다.</p>}
```

(비관리자는 편집 불가하지만 값은 현재 시각으로 전송되며, 트리거가 서버 시각으로 확정하므로 안전하다.)

- [ ] **Step 3: 린트 검증**

Run: `npm run lint`
Expected: 새 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add src/app/dashboard/records/page.tsx
git commit -m "1차처리·완료 모달 날짜 편집을 관리자 전용으로 제한

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 통합 빌드 검증 & 수동 확인

자동 테스트가 없으므로 빌드(타입체크 포함)와 수동 시나리오로 최종 확인한다.

**Files:**
- 없음(검증 전용).

- [ ] **Step 1: 프로덕션 빌드(타입체크 포함)**

Run: `npm run build`
Expected: 빌드 성공. 신규 코드로 인한 타입 에러 없음.

- [ ] **Step 2: 수동 확인 체크리스트(dev 서버 또는 배포 환경)**

`npm run dev` 후, 트리거 SQL을 Supabase에 적용한 환경에서 아래를 확인한다:

관리자(admin/operator) 계정:
- [ ] 신규 접수 모달에 "접수일시" 편집칸이 보인다. 과거 일시로 등록 → 목록의 접수일시가 지정값과 일치.
- [ ] 신규 접수를 완료 상태로 두고 "1차처리 일시"/"완료 일시"를 임의 지정 → 저장값 일치.
- [ ] 수정 모달에 접수/1차처리/완료 일시 3개 편집칸이 보이고, 각각 변경 저장 → 반영됨.
- [ ] 1차처리·완료 모달의 일시 input이 편집 가능.

일반 사용자(callcenter/field) 계정:
- [ ] 신규/수정 모달에 날짜 편집칸이 보이지 않는다.
- [ ] 1차처리·완료 모달의 일시 input이 비활성(회색) + "현재 시각으로 기록됩니다" 안내가 보인다.
- [ ] 접수/1차처리/완료 진행 시 각 일시가 현재 시각으로 기록된다.
- [ ] 처리중 건을 대기로 되돌리면 1차처리/완료 일시가 정상적으로 비워진다(null).

DB 방어(선택, API 직접 호출 가능 시):
- [ ] 일반 사용자 토큰으로 `reception_at`/`started_at`/`processed_at`에 임의 과거값을 PATCH → 서버가 현재 시각/기존값으로 강제.

- [ ] **Step 3: 브랜치 마무리**

수동 확인까지 통과하면 `superpowers:finishing-a-development-branch` 스킬로 병합/PR 여부를 결정한다. 배포 시 `supabase/add_datetime_admin_protection.sql`을 Supabase SQL Editor에서 실행해야 함을 인수인계에 명시한다.

---

## Self-Review

**Spec coverage:**
- 요구사항1(일반 동작 유지) → Task 3(기존 자동 세팅 유지), Task 5(비관리자 게이팅, 값은 현재 시각), Task 1(트리거 now() 강제). ✓
- 요구사항2(관리자만 접수 등록·수정 시 세 날짜 수정) → Task 3(신규), Task 4(수정). ✓
- 요구사항3(순서 검증 없음) → 어느 태스크에도 검증 로직 없음. ✓
- 요구사항4(DB 레벨 방어) → Task 1 트리거. ✓
- 4개 화면 일관 처리 → Task 3(①), Task 4(②), Task 5(③④). ✓

**Placeholder scan:** TBD/TODO/"적절한 처리"류 없음. 모든 코드 스텝에 실제 코드 포함. ✓

**Type consistency:** `toDateTimeLocal`/`nowDateTimeLocal`/`isAdmin`/`newRecord.reception_at`는 Task 2에서 정의 후 Task 3·4·5에서 동일 시그니처로 사용. 트리거 함수/트리거 이름(`enforce_record_datetime_protection`/`trg_enforce_record_datetime`)은 Task 1 내부에서 일관. ✓
