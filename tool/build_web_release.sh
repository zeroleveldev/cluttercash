#!/usr/bin/env bash
# Flutter 3.44.6 web_entrypoint tracks web.dart, not plugin dependency metadata.
# Invalidate only its disposable stamp so normal Flutter generation sees plugins.
set -euo pipefail
cd "$(dirname "$0")/.."
python -c "from pathlib import Path; files=list(Path('.dart_tool/flutter_build').glob('*/web_entrypoint.stamp')); [p.unlink() for p in files]; print('Invalidated web entrypoint stamps:', len(files))"
flutter build web --release --base-href / --dart-define=CLUTTERCASH_API_URL=https://cluttercash-api.zeroleveldev.workers.dev --dart-define=CLUTTERCASH_TEST_BILLING=true
cp web/CNAME build/web/CNAME
python tool/check_web_links.py
