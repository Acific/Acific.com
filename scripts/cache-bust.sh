#!/bin/sh
# Stamp every asset reference with a fresh ?v= so browsers fetch new files
# after each deploy. Run before committing a change to assets/.
set -e
cd "$(dirname "$0")/.."
v=$(date +%Y%m%d%H%M%S)
files=$(find . -name '*.html' -not -path './.git/*'; echo assets/main.js assets/site.js)
# Link tags and script tags in the pages
sed -i '' -E "s#(/assets/(style\.css|site\.js|main\.js))(\?v=[0-9]+)?#\1?v=$v#g" $files
# Module imports between scripts
sed -i '' -E "s#(\./(specimens|site)\.js)(\?v=[0-9]+)?#\1?v=$v#g" assets/main.js assets/site.js
echo "assets stamped ?v=$v"
