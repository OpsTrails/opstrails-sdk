#!/bin/bash

# OpsTrails SDK Release Script
# Usage: ./scripts/release.sh [patch|minor|major|x.x.x]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 OpsTrails SDK Release Script${NC}"
echo "================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Run this script from the project root.${NC}"
    exit 1
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}Error: You have uncommitted changes. Please commit or stash them first.${NC}"
    exit 1
fi

# Check if on main branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
    echo -e "${YELLOW}Warning: You're on branch '$BRANCH', not 'main'.${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Get version bump type
VERSION_TYPE=${1:-patch}

echo -e "\n${YELLOW}Step 1: Pulling latest changes...${NC}"
git pull origin main

echo -e "\n${YELLOW}Step 2: Installing dependencies...${NC}"
npm ci

echo -e "\n${YELLOW}Step 3: Running type check...${NC}"
npm run typecheck

echo -e "\n${YELLOW}Step 4: Running tests...${NC}"
npm test

echo -e "\n${YELLOW}Step 5: Building package...${NC}"
npm run build

echo -e "\n${YELLOW}Step 6: Bumping version ($VERSION_TYPE)...${NC}"
if [[ $VERSION_TYPE =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    # Specific version provided
    npm version $VERSION_TYPE --no-git-tag-version
else
    # Version type (patch, minor, major)
    npm version $VERSION_TYPE --no-git-tag-version
fi

NEW_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}New version: $NEW_VERSION${NC}"

echo -e "\n${YELLOW}Step 7: Committing version bump...${NC}"
git add package.json package-lock.json
git commit -m "chore: release v$NEW_VERSION"

echo -e "\n${YELLOW}Step 8: Creating git tag...${NC}"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo -e "\n${YELLOW}Step 9: Pushing to GitHub...${NC}"
git push origin main
git push origin "v$NEW_VERSION"

echo -e "\n${YELLOW}Step 10: Publishing to npm...${NC}"
npm publish --access public

echo -e "\n${GREEN}✅ Successfully released @opstrails/sdk v$NEW_VERSION${NC}"
echo ""
echo "Package is now available via:"
echo "  npm install @opstrails/sdk@$NEW_VERSION"
echo "  yarn add @opstrails/sdk@$NEW_VERSION"
echo "  pnpm add @opstrails/sdk@$NEW_VERSION"
echo ""
echo "GitHub: https://github.com/OpsTrails/opstrails-sdk/releases/tag/v$NEW_VERSION"
echo "npm: https://www.npmjs.com/package/@opstrails/sdk"
