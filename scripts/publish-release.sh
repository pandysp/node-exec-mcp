#!/usr/bin/env bash
set -euo pipefail

# Publish a new release of node-exec-mcp.
# This script bumps the version, commits, tags, pushes, and creates a GitHub release.
# The pushed tag triggers CI which publishes to npm via Trusted Publishing.

# Pre-flight checks
if ! command -v gh &>/dev/null; then
    echo "Error: gh CLI is required. Install with: brew install gh"
    exit 1
fi

if ! gh auth status &>/dev/null; then
    echo "Error: Not authenticated with gh. Run: gh auth login"
    exit 1
fi

BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
    echo "Error: Must be on main branch (currently on '$BRANCH')"
    exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
    echo "Error: Working directory is not clean. Commit or stash changes first."
    exit 1
fi

# Pull latest
echo "Pulling latest changes..."
git pull --rebase

# Run tests
echo "Running tests..."
npm test

# Build
echo "Building..."
npm run build

# Version bump
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo ""
echo "Current version: $CURRENT_VERSION"
echo ""
echo "Select release type:"
echo "  1) patch (bug fixes)"
echo "  2) minor (new features)"
echo "  3) major (breaking changes)"
read -rp "Choice [1-3]: " CHOICE

case $CHOICE in
    1) BUMP_TYPE="patch" ;;
    2) BUMP_TYPE="minor" ;;
    3) BUMP_TYPE="major" ;;
    *) echo "Invalid choice"; exit 1 ;;
esac

npm version "$BUMP_TYPE" --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")
echo ""
echo "Version bumped to: $NEW_VERSION"

# Pause for changelog
echo ""
echo "Update CHANGELOG.md now if needed, then press Enter to continue..."
read -r

# Commit and tag
git add package.json package-lock.json
if [ -f CHANGELOG.md ]; then
    git add CHANGELOG.md
fi

git commit -m "Bump version to $NEW_VERSION"
git tag "v$NEW_VERSION"

# Push
echo "Pushing to GitHub..."
git push origin main
git push origin "v$NEW_VERSION"

# Create GitHub release
echo "Creating GitHub release..."
gh release create "v$NEW_VERSION" \
    --title "v$NEW_VERSION" \
    --generate-notes

echo ""
echo "Release v$NEW_VERSION created!"
echo "CI will publish to npm automatically via Trusted Publishing."
echo "Monitor at: https://github.com/pandysp/node-exec-mcp/actions"
