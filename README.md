# stepintocrypto
step into crypto

## Design System

- `design-system/README.md`
- `design-system/tokens.css`

## Guestbook DB (Supabase)

1. Supabase SQL editor에서 `supabase/guestbook.sql` 실행
2. `guestbook-config.js`에 아래 값 입력
   - `window.SIC_SUPABASE_URL`
   - `window.SIC_SUPABASE_ANON_KEY`
3. SQL Editor에서 관리자 삭제 비밀번호 설정 (원하는 값으로 변경)
   - `update app_private.guestbook_admin_secret set password_hash = crypt('YOUR_PASSWORD', gen_salt('bf')) where id = true;`
4. `guestbook.html` 접속 후 목록 조회/등록/삭제 동작 확인 (`delete_guestbook_entry` RPC 포함)

## AI Chatbot (Supabase Edge Function + OpenAI)

프론트는 이미 연결되어 있습니다. 아래 3가지만 하면 실사용 LLM 답변으로 전환됩니다.

1. Supabase Dashboard > Edge Functions에서 함수 생성
   - 이름: `site-assistant`
   - 코드: `supabase/functions/site-assistant/index.ts` 내용 그대로 붙여넣고 Deploy
2. Supabase Dashboard > Project Settings > Edge Functions Secrets
   - `OPENAI_API_KEY` 추가
   - (선택) `OPENAI_MODEL` 추가 (기본값: `gpt-4o-mini`)
3. `guestbook-config.js` 확인
   - `window.SIC_SUPABASE_URL`
   - `window.SIC_SUPABASE_ANON_KEY`
   - `window.SIC_AI_FUNCTION_NAME = 'site-assistant'`

완료 후 `index.html`에서 AI 버튼을 누르면 Edge Function을 통해 OpenAI 답변을 받고, 함수 오류 시에는 로컬 답변으로 자동 폴백됩니다.
