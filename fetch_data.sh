#!/usr/bin/env bash
set -eu -o pipefail

zip -r data.zip data
mkdir -p backup
mv --backup=numbered data.zip backup

curl -O https://speedydelete.com/5s/data.zip
rm -rf data
unzip data.zip
