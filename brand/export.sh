#!/bin/zsh
# Regenerates the icon and link-preview images in site/ from the sources in this folder.
# Uses only what's already on this Mac: headless Chrome to render, sips to write the .ico.
#
#   zsh brand/export.sh
set -euo pipefail

cd "${0:A:h}/.."
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
work=$(mktemp -d)

shoot() { # shoot <url> <width> <height> <output.png>
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --virtual-time-budget=4000 --window-size="$2,$3" --screenshot="$4" "$1" >/dev/null 2>&1
}

icon="file://$PWD/brand/icon.html"

# Link preview, 1200 × 630
shoot "file://$PWD/brand/og-image.html" 1200 630 site/og.png

# iPhone home screen and iMessage/WhatsApp fallback icon. Square corners: iOS rounds it.
shoot "$icon?square=1&size=180" 180 180 site/apple-touch-icon.png

# favicon.ico for older browsers and crawlers that don't read the SVG
shoot "$icon?size=32" 32 32 "$work/favicon-32.png"
sips -s format ico "$work/favicon-32.png" --out site/favicon.ico >/dev/null

rm -rf "$work"
ls -l site/og.png site/apple-touch-icon.png site/favicon.ico site/favicon.svg
