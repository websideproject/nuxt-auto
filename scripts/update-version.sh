#!/bin/bash

# Update version across all packages in the monorepo
# Usage: ./scripts/update-version.sh <version>

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Error: Version argument is required"
  echo "Usage: ./scripts/update-version.sh <version>"
  echo "Example: ./scripts/update-version.sh 1.2.3"
  exit 1
fi

echo "Updating packages to version $VERSION..."

# Update all package.json files in packages/*
for package_dir in packages/*/; do
  if [ -f "${package_dir}package.json" ]; then
    package_name=$(basename "$package_dir")
    echo "  - Updating $package_name"
    cd "$package_dir"
    npm version "$VERSION" --no-git-tag-version --allow-same-version
    cd - > /dev/null
  fi
done

echo "✓ All packages updated to version $VERSION"
