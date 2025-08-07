#!/bin/bash

FILES=$(find cpp -type f \( -name "*.cpp" -o -name "*.c" \))
for file in $FILES; do
  echo "🔍 Linting $file"
  clang-tidy "$file" -- -std=c++17
done
