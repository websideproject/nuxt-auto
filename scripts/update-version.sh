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

# Update all package.json files in packages/* (excluding templates and private packages)
for package_dir in packages/*/; do
  if [ -f "${package_dir}package.json" ]; then
    package_name=$(basename "$package_dir")

    # Skip template directories
    if [[ "$package_name" == *"-template"* ]] || [[ "$package_name" == "template-"* ]]; then
      echo "  ⊘ Skipping template: $package_name"
      continue
    fi

    # Check if package is private (skip private packages)
    is_private=$(node -e "
      try {
        const pkg = require('./${package_dir}package.json');
        console.log(pkg.private === true ? 'true' : 'false');
      } catch (e) {
        console.log('false');
      }
    ")

    if [ "$is_private" = "true" ]; then
      echo "  ⊘ Skipping private package: $package_name"
      continue
    fi

    echo "  - Updating $package_name"

    # Use Node.js to update the version in package.json
    node -e "
      const fs = require('fs');
      const path = '${package_dir}package.json';
      const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
      pkg.version = '${VERSION}';
      fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
    "
  fi
done

echo "✓ All packages updated to version $VERSION"
