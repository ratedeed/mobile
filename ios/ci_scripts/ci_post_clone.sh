#!/bin/sh

# Fail this script immediately if any command fails
set -e

echo "========================================================"
echo "Xcode Cloud: Running ci_post_clone.sh"
echo "========================================================"

# Navigate to the root directory of the repository
if [ -n "$CI_PRIMARY_REPOSITORY_PATH" ]; then
    cd "$CI_PRIMARY_REPOSITORY_PATH"
else
    cd "$(dirname "$0")/../.."
fi

echo "Working directory: $(pwd)"

# 1. Install Node.js if not available
if ! command -v node >/dev/null 2>&1; then
    echo "Installing Node.js via Homebrew..."
    export HOMEBREW_NO_INSTALL_CLEANUP=TRUE
    brew install node
fi

# 2. Install CocoaPods if not available
if ! command -v pod >/dev/null 2>&1; then
    echo "Installing CocoaPods via Homebrew..."
    export HOMEBREW_NO_INSTALL_CLEANUP=TRUE
    brew install cocoapods
fi

echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"
echo "CocoaPods version: $(pod --version)"

# 3. Install NPM dependencies
echo "Installing NPM dependencies..."
npm install --legacy-peer-deps

# 4. Install CocoaPods dependencies
echo "Installing CocoaPods dependencies in ios directory..."
cd ios
pod install

echo "========================================================"
echo "Xcode Cloud: ci_post_clone.sh completed successfully!"
echo "========================================================"
