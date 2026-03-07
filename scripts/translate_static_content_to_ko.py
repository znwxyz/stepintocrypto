#!/usr/bin/env python3
import json
import os
import re
import socket
import sys
import time
from pathlib import Path

from bs4 import BeautifulSoup
from deep_translator import GoogleTranslator, MyMemoryTranslator


KOREAN_RE = re.compile(r"[가-힣]")
LATIN_RE = re.compile(r"[A-Za-z]")


def has_korean(text: str) -> bool:
    return bool(KOREAN_RE.search(text))


def has_latin(text: str) -> bool:
    return bool(LATIN_RE.search(text))


def should_translate(text: str) -> bool:
    t = text.strip()
    if not t:
        return False
    if has_korean(t):
        return False
    return has_latin(t)


class Translator:
    def __init__(self):
        socket.setdefaulttimeout(20)
        engine = (os.environ.get("SIC_TRANSLATOR_ENGINE") or "google").strip().lower()
        if engine == "mymemory":
            self.client = MyMemoryTranslator(source="english", target="korean")
            self.max_len = 450
            self.delay_sec = 0.35
        else:
            self.client = GoogleTranslator(source="auto", target="ko")
            self.max_len = 3000
            self.delay_sec = 0.25
        self.cache = {}

    def tr(self, text: str) -> str:
        if text in self.cache:
            return self.cache[text]

        if not should_translate(text):
            self.cache[text] = text
            return text

        # Google endpoint is sensitive to long strings; split conservatively.
        parts = split_text(text, self.max_len)
        translated_parts = []
        for part in parts:
            translated_parts.append(self._tr_with_retry(part))
        out = "".join(translated_parts)
        self.cache[text] = out
        return out

    def _tr_with_retry(self, text: str) -> str:
        last_err = None
        for i in range(4):
            try:
                result = self.client.translate(text)
                time.sleep(self.delay_sec)
                return result
            except Exception as err:  # noqa: BLE001
                last_err = err
                msg = str(err).lower()
                if "too many requests" in msg or "429" in msg:
                    time.sleep(2.0 * (i + 1))
                else:
                    time.sleep(0.8 * (i + 1))
        print(f"[warn] translation failed; keep original text: {last_err}", file=sys.stderr)
        return text


def split_text(text: str, max_len: int):
    if len(text) <= max_len:
        return [text]
    parts = []
    start = 0
    while start < len(text):
        end = min(start + max_len, len(text))
        if end < len(text):
            cut = text.rfind("\n", start, end)
            if cut == -1:
                cut = text.rfind(". ", start, end)
            if cut == -1:
                cut = text.rfind(" ", start, end)
            if cut <= start:
                cut = end
            else:
                # keep delimiter character
                cut += 1
            end = cut
        parts.append(text[start:end])
        start = end
    return parts


def translate_html_fragment(html: str, tr: Translator) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for node in soup.find_all(string=True):
        original = str(node)
        if not should_translate(original):
            continue
        translated = tr.tr(original)
        node.replace_with(translated)
    return str(soup)


def main():
    if len(sys.argv) != 2:
        print("Usage: translate_static_content_to_ko.py <path/to/chapters-static.json>")
        sys.exit(1)

    target_path = Path(sys.argv[1])
    data = json.loads(target_path.read_text(encoding="utf-8"))
    tr = Translator()

    for idx, chapter in enumerate(data, start=1):
        print(f"[translate] chapter {chapter.get('num', '?')} ({idx}/{len(data)})")
        if "keyPoints" in chapter:
            chapter["keyPoints"] = [tr.tr(x) if should_translate(x) else x for x in chapter["keyPoints"]]
        for section in chapter.get("sections", []):
            title = section.get("title", "")
            if should_translate(title):
                section["title"] = tr.tr(title)
            body = section.get("body", "")
            if body:
                section["body"] = translate_html_fragment(body, tr)
        # Persist progress chapter by chapter.
        target_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    target_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Translated and wrote: {target_path}")


if __name__ == "__main__":
    main()
