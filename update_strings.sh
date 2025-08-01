#!/bin/sh
SCRIPTDIR=`dirname $0`
xgettext  --from-code=UTF-8 -k_ -kN_  -o lockkeys.pot "$SCRIPTDIR"/./lockkeys@vaina.lt/*.js "$SCRIPTDIR"/./lockkeys@vaina.lt/schemas/*.xml

for fn in *.po; do
	msgmerge -U "$fn" lockkeys.pot
done
