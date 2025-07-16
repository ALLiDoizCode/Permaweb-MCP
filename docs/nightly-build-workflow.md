# Nightly Build Workflow

## Overview

The nightly build workflow automatically publishes development versions of Permamind to npm every night at 12:00 AM EST. This allows early access to the latest features and bug fixes for testing and development purposes.

## Setup Requirements

### Required GitHub Secrets

Configure these secrets in your GitHub repository settings:

1. **`NPM_TOKEN`** - NPM authentication token with publish permissions
   - Go to [npmjs.com](https://www.npmjs.com) → Account → Access Tokens
   - Generate a new token with "Automation" type
   - Add to GitHub repository secrets

2. **`GITHUB_TOKEN`** - Automatically provided by GitHub Actions
   - Used for creating releases and accessing repository

### NPM Token Setup

```bash
# Create NPM token (automation type recommended)
npm token create --type=automation --read-only=false

# Test token permissions
npm whoami --registry https://registry.npmjs.org
```

## Workflow Features

### 🔒 Security & Quality Gates

- **Branch Protection**: Only runs on `development` branch
- **Dependency Verification**: Uses `npm ci` for reproducible builds
- **Quality Checks**: Runs full `ci:quality` script including:
  - Linting and formatting checks
  - TypeScript type checking
  - Test coverage requirements
  - Security audit
  - Build verification

### 📦 Version Management

- **Nightly Versioning**: Generates unique versions like `1.0.0-nightly.20240716050000`
- **Timestamp Based**: Uses UTC timestamp for version uniqueness
- **Tag Strategy**: Published with `nightly` tag to npm
- **No Git Tags**: Avoids polluting main repository with nightly tags

### 🚀 Publishing Process

1. **Checkout**: Fetches latest development branch
2. **Setup**: Configures Node.js 20 with npm registry
3. **Install**: Installs dependencies with `npm ci`
4. **Quality**: Runs comprehensive quality checks
5. **Version**: Generates timestamped nightly version
6. **Build**: Compiles TypeScript to JavaScript
7. **Test**: Runs final test suite with coverage
8. **Publish**: Publishes to npm with `nightly` tag
9. **Release**: Creates GitHub pre-release with installation instructions

## Installation

### Installing Nightly Builds

```bash
# Install latest nightly build
npm install permamind@nightly

# Install specific nightly version
npm install permamind@1.0.0-nightly.20240716050000
```

### Switching Between Versions

```bash
# Switch to stable release
npm install permamind@latest

# Switch back to nightly
npm install permamind@nightly

# List available versions
npm view permamind versions --json
```

## Manual Triggering

The workflow can be manually triggered via GitHub Actions:

1. Go to repository → Actions → "Nightly NPM Publish"
2. Click "Run workflow"
3. Select `development` branch
4. Click "Run workflow"

## Monitoring

### Success Indicators

- ✅ Green workflow status in GitHub Actions
- 📦 New package version available on npm
- 🏷️ New GitHub pre-release created
- 📊 Test coverage reports generated

### Failure Handling

Common failure scenarios and solutions:

1. **Quality Gate Failures**
   - Check linting, type checking, or test failures
   - Fix issues in development branch

2. **NPM Publishing Errors**
   - Verify `NPM_TOKEN` is valid and has publish permissions
   - Check npm registry connectivity

3. **Version Conflicts**
   - Automatic timestamp-based versioning prevents conflicts
   - Manual intervention rarely needed

## Development Integration

### Pre-Nightly Checklist

Before relying on nightly builds:

- [ ] Ensure development branch is stable
- [ ] Run local quality checks: `npm run ci:quality`
- [ ] Verify critical functionality works
- [ ] Update documentation if needed

### Testing Nightly Builds

```bash
# Test nightly build in isolated environment
npx permamind@nightly --version
npx permamind@nightly --help

# Integration testing
npm install permamind@nightly
node -e "require('permamind')"
```

## Configuration

### Scheduling

Current schedule: **12:00 AM EST (5:00 AM UTC) daily**

To modify the schedule, update the cron expression in `.github/workflows/nightly-publish.yml`:

```yaml
schedule:
  - cron: '0 5 * * *'  # 5:00 AM UTC = 12:00 AM EST
```

### Environment Variables

- `NODE_VERSION`: Node.js version (currently 20)
- `REGISTRY_URL`: NPM registry URL
- `NODE_AUTH_TOKEN`: NPM authentication token

## Best Practices

### For Maintainers

1. **Keep Development Stable**: Only merge tested code to development
2. **Monitor Workflow**: Check nightly build results regularly
3. **Update Dependencies**: Keep workflow dependencies current
4. **Document Breaking Changes**: Note breaking changes in commits

### For Consumers

1. **Use Stable for Production**: Only use nightly builds for testing
2. **Pin Versions**: Avoid using `@nightly` in production dependencies
3. **Report Issues**: Report bugs found in nightly builds
4. **Test Thoroughly**: Verify functionality before deploying

## Troubleshooting

### Common Issues

1. **Workflow Not Running**
   - Check if development branch exists
   - Verify cron schedule is correct
   - Ensure repository has Actions enabled

2. **Permission Errors**
   - Verify `NPM_TOKEN` has publish permissions
   - Check token hasn't expired
   - Confirm package name availability

3. **Build Failures**
   - Check TypeScript compilation errors
   - Verify test suite passes locally
   - Review dependency conflicts

### Getting Help

- Check GitHub Actions logs for detailed error messages
- Review npm publish logs for registry issues
- Consult repository maintainers for persistent problems

---

*This workflow ensures consistent, high-quality nightly builds while maintaining security and reliability standards.*