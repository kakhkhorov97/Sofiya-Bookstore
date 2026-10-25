#!/bin/bash
# usage: render.sh page.html out.png [desktop-height] | render.sh -m page.html out.png [height]
cd "$(dirname "$0")"
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ "$1" = "-m" ]; then
  H=${4:-4200}; sed -e "s#PAGE#$2#" -e "s#4200px#${H}px#" frame-mobile.html > .mframe.html
  "$C" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=6000 --window-size=600,$H --screenshot="$3" "file://$PWD/.mframe.html" 2>/dev/null
  sips --cropToHeightWidth $H 390 --cropOffset 0 0 "$3" >/dev/null; rm .mframe.html
else
  "$C" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=6000 --window-size=1440,${3:-900} --screenshot="$2" "file://$PWD/$1" 2>/dev/null
fi
