# GitHub Actions Workflow Optimization Guide

## Overview

The CI/CD pipeline has been optimized to reduce PR validation time from ~15-20 minutes to ~5 minutes while maintaining code quality standards.

## Workflow Structure

### 1. PR Validation (Fast) - `pr-validation-fast.yml`
**Purpose:** Quick feedback for pull requests  
**Runtime:** ~3-5 minutes  
**Triggers:** All PRs to `development` and `main`

#### Key Features:
- **Smart Change Detection:** Only runs relevant tests based on modified files
- **Tiered Testing:** 
  - Tier 1: Quick checks (lint, type-check, build) - 2 min
  - Tier 2: Unit tests (when code changes) - 3 min
  - Tier 3: Critical integration tests (when needed) - 5 min
- **Single Node Version:** Tests on Node 20 only (not matrix)
- **No Coverage Collection:** Speeds up test execution by 30%
- **Parallel Jobs:** Security audit runs in parallel

#### When Tests Run:
- **Unit Tests:** Only when `src/` or `tests/` files change
- **Integration Tests:** Only when `src/services/`, `src/tools/`, or integration tests change
- **Platform Tests:** Only when source code changes
- **All Tests Skip:** For draft PRs (unless `[ci]` in title)

### 2. Main Branch Full Test - `main-full-test.yml`
**Purpose:** Comprehensive testing with coverage  
**Runtime:** ~15-20 minutes  
**Triggers:** 
- Push to `main` branch
- Nightly at 2 AM UTC
- Manual dispatch

#### Features:
- **Full Matrix Testing:** Node 20 and 22
- **Complete Coverage Reports:** With Codecov integration
- **All Integration Tests:** Including slow tests
- **Cross-Platform Testing:** Ubuntu, Windows, macOS
- **Security Deep Scan:** Full vulnerability analysis
- **Performance Analysis:** Bundle size and startup time

### 3. Legacy Workflow (Deprecated) - `pr-validation.yml`
- Kept for reference but disabled
- Can be manually triggered if needed

## Test Commands

### Quick Local Testing
```bash
# Run only unit tests (fastest)
npm run test:unit

# Run only changed tests
npm run test:changed

# Run critical integration tests
npm run test:integration:critical
```

### PR Simulation
```bash
# Simulate PR validation locally
npm run lint && npm run type-check && npm run test:unit
```

### Full Test Suite
```bash
# Run everything with coverage (like main branch)
COVERAGE=true npm run test:coverage
```

## Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| PR Validation | 15-20 min | 3-5 min | **75% faster** |
| Unit Tests | 5 min | 2 min | 60% faster |
| Integration Tests | 10 min | 3 min* | 70% faster |
| Coverage Collection | Always | Main only | N/A |
| Node Versions | 2 (matrix) | 1 (PR) | 50% reduction |

*Only critical tests run on PRs

## Configuration Changes

### Vitest Config Optimizations
- Dynamic timeouts based on CI environment
- Bail on first failure in CI for faster feedback
- Coverage disabled by default (enabled via env var)
- Optimized reporter output for CI

### Package.json Scripts
New scripts added for granular test control:
- `test:unit` - Unit tests only with minimal output
- `test:integration:critical` - Fast integration tests only
- `test:ci:fast` - Optimized for CI environments
- `test:changed` - Only tests affected by recent changes

## Best Practices

### For Developers
1. Run `npm run test:unit` before pushing
2. Use `npm run test:changed` during development
3. Add `[ci]` to draft PR titles to force CI runs

### For Reviewers
1. Check the PR status comment for test results
2. Warning symbols (⚠️) indicate non-blocking issues
3. Red X (❌) indicates must-fix issues

### For Maintainers
1. Monitor nightly test results for regression
2. Review coverage reports on main branch merges
3. Check performance metrics weekly

## Rollback Plan

If issues arise with the new workflow:

1. **Quick Rollback:**
   - Rename `pr-validation-fast.yml` to `pr-validation-fast.yml.bak`
   - Uncomment triggers in `pr-validation.yml`
   - Push changes

2. **Partial Rollback:**
   - Increase timeouts in `vitest.config.ts`
   - Enable matrix testing in `pr-validation-fast.yml`
   - Add coverage back to PR tests if needed

## Monitoring

Track these metrics weekly:
- Average PR validation time
- Test failure rate
- Coverage trends (from main branch)
- False positive rate

## Future Optimizations

Potential improvements to consider:
1. Test result caching between runs
2. Docker layer caching for faster setup
3. Distributed test execution
4. Test impact analysis based on code changes
5. Flaky test detection and auto-retry