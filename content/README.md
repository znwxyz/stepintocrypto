# Content Editing Guide

이 사이트의 콘텐츠는 아래 JSON 파일만 수정하면 반영됩니다.

- `content/chapters.json`: 메인 챕터/섹션 본문
- `content/glossary.json`: 용어집
- `content/quiz.json`: 퀴즈

## 1) chapters.json

구조(배열):

```json
[
  {
    "num": "00",
    "title": "머리말",
    "subtitle": "왜 크립토를 이해해야 하는가",
    "keyPoints": ["..."],
    "sections": [
      {
        "title": "섹션 제목",
        "body": "HTML 허용 문자열",
        "formula": "선택",
        "formulaNote": "선택",
        "card": { "type": "info|warn|success", "tag": "라벨", "text": "문구" },
        "table": {
          "headers": ["..."],
          "rows": [["...", "..."]]
        }
      }
    ]
  }
]
```

## 2) glossary.json

구조(배열):

```json
[
  { "term": "용어", "def": "정의" }
]
```

## 3) quiz.json

구조(배열):

```json
[
  {
    "id": "q-001",
    "chapter": "01",
    "difficulty": "easy",
    "q": "문제",
    "opts": ["보기1", "보기2", "보기3", "보기4"],
    "a": 1,
    "fb": "정답 해설"
  }
]
```

필드 규칙:
- `chapter`: `chapters.json`의 `num`과 동일 값 권장 (예: `"07"`)
- `difficulty`: `easy`, `medium`, `hard` 중 하나
- `a`: 정답 인덱스 (0부터 시작)
- `opts`: 최소 2개 이상

## 퀴즈 필터/정렬 동작

퀴즈 UI는 다음을 지원합니다.
- 검색: 문제/보기/해설 텍스트 포함 검색
- 필터: 챕터, 난이도
- 정렬: 랜덤, 챕터순, 난이도 낮은순, 난이도 높은순

## 주의

- `body`는 HTML 문자열이라 따옴표/태그를 깨지 않게 주의하세요.
- JSON 문법 오류(쉼표 누락, 따옴표 오류)가 있으면 로드 실패합니다.
