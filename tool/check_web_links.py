"""Post-build guard; widget Link tests cannot detect missing web registration.
Run: python tool/check_web_links.py after the production web build.
This artifact check complements, not replaces, trusted browser navigation.
"""
from pathlib import Path
import hashlib
import json
import sys

root = Path(__file__).resolve().parents[1]
bundle = root / 'build/web/main.dart.js'
registrants = list((root / '.dart_tool/flutter_build').glob('*/web_plugin_registrant.dart'))
result = {
    'sha256': hashlib.sha256(bundle.read_bytes()).hexdigest(),
    'webLinkMarkerPresent': '__url_launcher::link' in bundle.read_text(encoding='utf-8'),
    'registrants': [
        {'path': str(p.relative_to(root)),
         'registersUrlLauncher': 'UrlLauncherPlugin.registerWith' in p.read_text()}
        for p in registrants
    ],
}
# Historical configurations may remain stale; the compiled artifact is decisive.
result['passed'] = result['webLinkMarkerPresent'] and any(
    r['registersUrlLauncher'] for r in result['registrants'])
print(json.dumps(result, indent=2))
sys.exit(0 if result['passed'] else 1)
