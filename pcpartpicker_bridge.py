#!/usr/bin/env python3
"""Persistent JSON-lines bridge between Node and pypartpicker.

stdin:  one JSON object per line: {"id":..., "brand":..., "mpn":..., "model":...}
stdout: one JSON object per line with the same id.

The process keeps a single pypartpicker Client alive so a bulk enrichment run
is not starting Python and a HTTP session for every product.
"""

import json
import os
import re
import sys

try:
    import pypartpicker
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


# On the Raspberry Pi we do not want pyppeteer downloading an x86 Chromium
# build. The site is being queried from the shop's normal residential
# connection, where the ordinary HTML path is what we want. If PCPartPicker
# presents Cloudflare, report it cleanly and let the caller retry later.
client = pypartpicker.Client(max_retries=1, retry_delay=0, no_js=True)
DEFAULT_REGION = os.environ.get("PCPARTPICKER_REGION", "au")


def lookup(req):
    brand = str(req.get("brand") or "").strip()
    query = str(req.get("mpn") or req.get("model") or "").strip()
    region = str(req.get("region") or DEFAULT_REGION or "au").strip().lower()
    if not query:
        return {"ok": False, "reason": "missing_identity"}

    # Search the model/MPN exactly first. Supplier names often duplicate the
    # brand ("ASRock ASRock ..."), so only add the brand on a second attempt.
    queries = [query]
    if brand and norm(brand) not in norm(query).split():
        queries.append(f"{brand} {query}")

    parts = []
    seen = set()
    for q in queries:
        result = client.get_part_search(q, region=region)
        for part in getattr(result, "parts", []) or []:
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

    part = client.get_part(url)
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
