#!/bin/zsh
# Usage: ./deploy-gh-pages.sh <repo-name>
# Example: ./deploy-gh-pages.sh health-tools

set -e

REPO_NAME="$1"
if [ -z "$REPO_NAME" ]; then
  echo "Usage: $0 <repo-name>"
  exit 1
fi

# Update vite.config.ts base path
sed -i '' "s|base: .*|base: '/$REPO_NAME/',|" vite.config.ts

# Build the app
npm run build

# Switch to gh-pages branch
if ! git show-ref --quiet refs/heads/gh-pages; then
  git checkout --orphan gh-pages
else
  git checkout gh-pages
fi

# Remove all files except dist
find . -mindepth 1 ! -name 'dist' ! -name '.git' -exec rm -rf {} +

# Move build to root
cp -r dist/* .
rm -rf dist

# Commit and push
if [ -n "$(git status --porcelain)" ]; then
  git add .
  git commit -m "Deploy to GitHub Pages"
fi

git push origin gh-pages --force

echo "Deployed to GitHub Pages!"

git checkout main
