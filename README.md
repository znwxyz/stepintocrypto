# stepintocrypto
step into crypto

## Guestbook DB (Supabase)

1. Supabase SQL editor에서 `supabase/guestbook.sql` 실행
2. `guestbook-config.js`에 아래 값 입력
   - `window.SIC_SUPABASE_URL`
   - `window.SIC_SUPABASE_ANON_KEY`
3. SQL Editor에서 관리자 삭제 비밀번호 설정 (원하는 값으로 변경)
   - `update app_private.guestbook_admin_secret set password_hash = crypt('YOUR_PASSWORD', gen_salt('bf')) where id = true;`
4. `guestbook.html` 접속 후 목록 조회/등록/삭제 동작 확인 (`delete_guestbook_entry` RPC 포함)
