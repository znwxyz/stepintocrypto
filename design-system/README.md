# Design System (Step into Crypto)

## Purpose
현재 사이트(`index.html`, `guestbook.html`)에 흩어진 스타일을 공통 규칙으로 통일하기 위한 기준 문서입니다.

## 1) Tokens
- 파일: `design-system/tokens.css`
- 사용법: 각 페이지 `<style>` 상단 또는 공통 CSS에서 `@import` 후 사용

```css
@import url('./design-system/tokens.css');
```

## 2) Brand Rules
- 분위기: Dark + Neon Tech
- 기본 배경: `--color-bg`
- 기본 패널: `--color-surface`
- 주요 강조: `--color-accent-cyan`
- 경고/행동: `--color-accent-orange`
- 성공/완료: `--color-accent-lime`

## 3) Typography
- Display: `--font-display`
- Headings: `--font-heading`
- Body: `--font-body`
- Numeric / Utility: `--font-mono`

## 4) Core Components
- Panel: `background: var(--surface); border: var(--border-thin); border-radius: var(--radius-12);`
- Input: `background: var(--surface2); border: var(--border-thin); border-radius: var(--radius-8);`
- Primary action: cyan 계열 (`--accent`) 사용
- Danger action: orange 계열 (`--accent2`) 사용
- Success state: lime 계열 (`--accent3`) 사용

## 5) Interaction
- Hover/Focus 전환 시간: `--ease-fast`
- 버튼/링크 hover 시 배경 alpha만 올리고 색상은 토큰 유지
- 모달, 오버레이는 배경 `rgba(5, 8, 17, 0.72~0.92)` 범위 유지

## 6) Migration Order (추천)
1. `guestbook.html`에서 하드코딩 px/hex를 토큰 치환
2. `index.html`의 버튼/카드/모달 순으로 토큰 치환
3. 공통 컴포넌트 클래스를 별도 css(`components.css`)로 분리

## 7) Non-goals
- 지금 문서는 시각 언어 표준화가 목적
- 회원 시스템/비즈니스 로직/API 명세는 포함하지 않음
