#!/usr/bin/env python3
"""Persistent JSON-lines bridge between Node and pypartpicker."""

import json
import os
import re
import shutil
import sys

os.environ.setdefault("PYPPETEER_HOME", "/tmp/outbackelectronics-pyppeteer")

try:
    import pyppeteer
    import pypartpicker
    from requests_html import HTMLSession
    from pypartpicker.errors import CloudflareException, RateLimitException
except Exception as exc:
    print(json.dumps({"fatal": "dependency_missing", "message": str(exc)}), flush=True)
    raise SystemExit(2)


def norm(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def score(name, brand, query):
    candidate = norm(name)
    b = norm(brand)
    q = norm(query)
    if not candidate or not q:
        return 0
    value = 0
    if candidate == q or (b and candidate == f"{b} {q}"):
        value += 1000
    if q in candidate:
        value += 500
    tokens = [t for t in q.split() if len(t) > 1]
    if tokens:
        value += round(sum(t in candidate for t in tokens) / len(tokens) * 300)
    if b and b in candidate:
        value += 100
    return value


CHROMIUM = (
    os.environ.get("PCPARTPICKER_CHROMIUM")
    or shutil.which("chromium")
    or shutil.which("chromium-browser")
)

if CHROMIUM:
    _original_launch = pyppeteer.launch

    async def _launch_native_chromium(*args, **kwargs):
        kwargs.setdefault("executablePath", CHROMIUM)
        browser_args = list(kwargs.get("args") or [])
        for flag in (
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
        ):
            if flag not in browser_args:
                browser_args.append(flag)
        kwargs["args"] = browser_args
        return await _original_launch(*args, **kwargs)

    pyppeteer.launch = _launch_native_chromium


# pypartpicker 2.0.5 only renders a page whose title is "Just a moment...".
# PCPartPicker currently returns "Verification"/"Unavailable" to our search
# requests, which pypartpicker labels RateLimitException *without ever invoking
# Chromium*. Use a custom response retriever so those verification pages get the
# same browser-render attempt before we conclude that the connection is blocked.
_session = HTMLSession()


def _title(response):
    try:
        node = response.html.find("title", first=True)
        return (node.text if node is not None else "").strip()
    except Exception:
        return ""


def _page_title(response):
    try:
        node = response.html.find(".pageTitle", first=True)
        return (node.text if node is not None else "").strip()
    except Exception:
        return ""


def _challenge_kind(response):
    title = _title(response)
    page_title = _page_title(response)
    if title == "Just a moment...":
        return "cloudflare"
    if title == "Unavailable" or page_title == "Verification":
        return "verification"
    return None


def response_retriever(url):
    response = _session.get(url, timeout=20)
    challenge = _challenge_kind(response)
    if challenge and CHROMIUM:
        try:
            # Render the actual requested URL in the Pi's installed Chromium.
            # sleep gives PCPartPicker's verification JS a chance to complete.
            response.html.render(timeout=45, sleep=4, reload=True, keep_page=False)
        except Exception as exc:
            if challenge == "verification":
                raise RateLimitException(f"PCPartPicker verification could not be rendered: {exc}")
            raise CloudflareException(f"PCPartPicker Cloudflare challenge could not be rendered: {exc}")
        challenge = _challenge_kind(response)

    if challenge == "verification":
        raise RateLimitException(f"PCPartPicker verification/rate-limit still active after browser render: {url}")
    if challenge == "cloudflare":
        raise CloudflareException(f"PCPartPicker Cloudflare challenge still active after browser render: {url}")
    return response


client = pypartpicker.Client(
    max_retries=1,
    retry_delay=0,
    no_js=False,
    response_retriever=response_retriever,
)
DEFAULT_REGION = os.environ.get("PCPARTPICKER_REGION", "au")


def lookup(req):
    brand = str(req.get("brand") or "").strip()
    query = str(req.get("mpn") or req.get("model") or "").strip()
    region = str(req.get("region") or DEFAULT_REGION or "au").strip().lower()
    if not query:
        return {"ok": False, "reason": "missing_identity"}
    if not CHROMIUM:
        return {
            "ok": False,
            "reason": "browser_missing",
            "message": "Chromium was not found. Set PCPARTPICKER_CHROMIUM or install chromium.",
        }

    queries = [query]
    if brand and norm(brand) not in norm(query).split():
        queries.append(f"{brand} {query}")

    parts = []
    seen = set()
    for q in queries:
        result = client.get_part_search(q, region=region)
        # pypartpicker returns a bare list when search redirects directly to a
        # product page, despite its annotated PartSearchResult return type.
        candidates = result if isinstance(result, list) else (getattr(result, "parts", []) or [])
        for part in candidates:
            url = getattr(part, "url", None)
            key = url or getattr(part, "name", "")
            if key and key not in seen:
                seen.add(key)
                parts.append(part)
        if parts:
            break

    ranked = sorted(
        ((score(getattr(p, "name", ""), brand, query), p) for p in parts),
        key=lambda item: item[0],
        reverse=True,
    )
    ranked = [item for item in ranked if item[0] >= 180]
    if not ranked:
        return {"ok": False, "reason": "not_found"}
    if len(ranked) > 1 and ranked[0][0] < 700 and ranked[0][0] - ranked[1][0] < 80:
        return {
            "ok": False,
            "reason": "ambiguous",
            "candidates": [getattr(x[1], "name", "") for x in ranked[:3]],
        }

    best_score, candidate = ranked[0]
    url = getattr(candidate, "url", None)
    if not url:
        return {"ok": False, "reason": "missing_product_url"}

    part = client.get_part(url, region=region)
    specs = getattr(part, "specs", None) or {}
    if not specs:
        return {"ok": False, "reason": "no_specs", "url": url}

    return {
        "ok": True,
        "name": getattr(part, "name", ""),
        "url": getattr(part, "url", None) or url,
        "score": best_score,
        "rawSpecs": specs,
    }


for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    request_id = None
    try:
        request = json.loads(line)
        request_id = request.get("id")
        result = lookup(request)
        result["id"] = request_id
    except CloudflareException as exc:
        result = {"id": request_id, "ok": False, "reason": "blocked", "message": str(exc)}
    except RateLimitException as exc:
        result = {"id": request_id, "ok": False, "reason": "rate_limited", "message": str(exc)}
    except Exception as exc:
        result = {
            "id": request_id,
            "ok": False,
            "reason": "error",
            "message": f"{type(exc).__name__}: {exc}",
        }
    print(json.dumps(result, ensure_ascii=False), flush=True)
