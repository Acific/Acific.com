#!/bin/sh
# Stamp every asset reference with a fresh ?v= so browsers fetch new files
# after each deploy. Run before committing a change to assets/.
set -e
cd "$(dirname "$0")/.."
v=$(date +%Y%m%d%H%M%S)
html=$(find . -name '*.html' -not -path './.git/*')
# Stylesheet and script tags in the pages
sed -i '' -E "s#(/assets/[a-z]+\.(css|js))(\?v=[0-9]+)?#\1?v=$v#g" $html
# Module imports between scripts
sed -i '' -E "s#(import (\"|[^\"]* from \")\./[a-z]+\.js)(\?v=[0-9]+)?#\1?v=$v#g" assets/*.js
echo "assets stamped ?v=$v"
