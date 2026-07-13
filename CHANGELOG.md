# Changelog

All notable changes to SkillStack are documented in this file.

## [0.1.2] - 2026-07-13

### Added

- Added a GitHub Actions release workflow for the Electron desktop client.
- Published installers for macOS (Intel and Apple Silicon), Windows x64, and Linux x64 (AppImage and deb).

### Fixed

- Locked platform-specific native dependencies so CI can build the desktop client on Linux, Windows, and macOS.
- Added the Debian package metadata required by electron-builder.
