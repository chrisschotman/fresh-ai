# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0] - 2026-03-12

### Added

- Autocomplete plugin for the Fresh editor powered by AI-generated suggestions
- Partial suggestion acceptance with word-level and line-level granularity
- Multi-line indentation intelligence for properly formatted suggestions
- Config-hash based cache invalidation and `ai_clear_cache` command
- Performance metrics and configurable logging levels
- Status bar messages for improved error visibility
- Request cancellation with timeout fallback and process tracking
- Shell escaping hardened with null byte rejection and edge case handling
- CI pipeline with GitHub Actions for linting, type checking, and tests

### Fixed

- Resolved ESLint errors across the codebase
