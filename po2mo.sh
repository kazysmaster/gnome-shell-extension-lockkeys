#!/bin/sh
find . -iname \*.po -print -execdir sh -c 'msgfmt -f -o "lockkeys@vaina.lt/locale/$(basename "$0" .po)/LC_MESSAGES/lockkeys.mo" "$0"' '{}' \;

