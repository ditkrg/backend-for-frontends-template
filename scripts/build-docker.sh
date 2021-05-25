#!/bin/bash

BASEDIR=$(dirname "$0")
cd $BASEDIR/../

VERSION=$(grep "\"[Vv]ersion\":.*\".*\"" package.json | awk -F '"' '{print $4}')
echo "Building Back-end For Front-ends Node.js Template v"$VERSION" ..."
docker build -t reg.dev.krd/common/backend-for-frontends:"$VERSION" .
