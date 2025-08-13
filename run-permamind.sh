#!/bin/bash
# Script to run Permamind directly without global installation

cd "$(dirname "$0")"
node bin/permamind.js "$@"