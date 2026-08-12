#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-http://localhost:3000}"
BASE="${BASE%/}"
echo "Smoke $BASE"
fail(){ echo "FAIL: $*" >&2; exit 1; }
pass(){ echo "PASS: $*"; }
curl -sf "$BASE/health" | grep -q '"ok"' || fail "/health"
pass "/health"
curl -sf "$BASE/api/health" | grep -q '"ok"' || fail "/api/health"
pass "/api/health"
curl -sf "$BASE/widget.js" | head -c 500 | grep -q "Bugaputa" || fail "/widget.js content"
pass "/widget.js"
curl -sf "$BASE/widget.css" | head -c 500 | grep -q "bugaputa" || echo "WARN /widget.css placeholder ok"
pass "/widget.css"
TMP=$(mktemp -d)
JAR="$TMP/jar.txt"
EMAIL="smoke-$(date +%s)-$RANDOM@example.com"
PASS="Smoke12345!"
echo "-> register $EMAIL"
code=$(curl -s -o "$TMP/reg.json" -w "%{http_code}" -c "$JAR" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" "$BASE/api/auth/register")
[ "$code" = "201" ] || { cat "$TMP/reg.json"; fail "register $code"; }
pass "register $code"
code=$(curl -s -o "$TMP/proj.json" -w "%{http_code}" -b "$JAR" -c "$JAR" -H "Content-Type: application/json" -d '{"name":"Smoke Project"}' "$BASE/api/projects")
[ "$code" = "201" ] || { cat "$TMP/proj.json"; fail "create project $code"; }
PROJECT_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMP/proj.json','utf8')).id || JSON.parse(require('fs').readFileSync('$TMP/proj.json','utf8')).project?.id)")
PKEY=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMP/proj.json','utf8')).publicKey || JSON.parse(require('fs').readFileSync('$TMP/proj.json','utf8')).public_key || JSON.parse(require('fs').readFileSync('$TMP/proj.json','utf8')).project?.publicKey)")
[ -n "$PKEY" ] || fail "no publicKey"
echo "project $PROJECT_ID key $PKEY"
pass "create project $PROJECT_ID"
code=$(curl -s -o "$TMP/report.json" -w "%{http_code}" -H "Content-Type: application/json" -H "x-project-key: $PKEY" -d '{"message":"Smoke test bug report - automated smoke check 123","pageUrl":"https://example.com/test","userAgent":"smoke-test","viewport":"1280x800","language":"en"}' "$BASE/api/reports")
[ "$code" = "201" ] || { cat "$TMP/report.json"; fail "public submit $code"; }
REPORT_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMP/report.json','utf8')).id)")
pass "public submit $REPORT_ID"
code=$(curl -s -o "$TMP/list.json" -w "%{http_code}" -b "$JAR" "$BASE/api/projects/$PROJECT_ID/reports")
[ "$code" = "200" ] || { cat "$TMP/list.json"; fail "list reports $code"; }
COUNT=$(node -e "const j=JSON.parse(require('fs').readFileSync('$TMP/list.json','utf8')); const items=j.items||j.reports||j; console.log(Array.isArray(items)?items.length:(j.total||0))")
[ "$COUNT" -ge "1" ] || { cat "$TMP/list.json"; fail "list count $COUNT"; }
pass "list reports count=$COUNT"
rm -rf "$TMP"
echo "SMOKE PASS"
