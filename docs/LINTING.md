# Pre-commit and Linting Setup

This project uses automated code quality tools to maintain consistent code style and catch errors early.

## Tools Used

- **ESLint**: JavaScript/TypeScript linter for code quality
- **Prettier**: Code formatter for consistent style
- **Husky**: Git hooks manager
- **lint-staged**: Run linters on staged files only

## Local Development Setup

### Initial Setup

After cloning the repository, install dependencies:

```bash
npm install
```

This will automatically:

1. Install all dependencies including dev tools
2. Set up Husky git hooks via the `prepare` script
3. Configure the pre-commit hook

### Pre-commit Hook

Every time you commit, the pre-commit hook will automatically:

1. Run ESLint on staged `.ts` and `.tsx` files and auto-fix issues
2. Run Prettier to format staged files
3. Only allow the commit if all checks pass

If you need to bypass the hook (not recommended):

```bash
git commit --no-verify -m "your message"
```

## Available Scripts

### Linting

```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint:fix
```

### Formatting

```bash
# Format all source files
npm run format

# Check if files are formatted correctly (used in CI)
npm run format:check
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## GitHub Actions CI

The CI pipeline runs on:

- Push to `main` or `develop` branches
- Pull requests to `main`
- Release events

### CI Jobs

1. **Lint Job**: Checks code formatting and runs ESLint
2. **Test Job**: Runs the test suite on Node 18.x and 20.x
3. **Build Job**: Packages the extension (on releases)
4. **Publish Job**: Publishes to VS Code Marketplace (on releases)

All pull requests must pass linting and tests before merging.

## Configuration Files

- `.prettierrc.json` - Prettier configuration
- `.prettierignore` - Files to exclude from Prettier
- `eslint.config.mjs` - ESLint configuration
- `.husky/pre-commit` - Pre-commit hook script
- `package.json` - `lint-staged` configuration

## Troubleshooting

### Pre-commit hook not running

If the pre-commit hook doesn't run:

```bash
# Reinitialize Husky
npm run prepare

# Make sure the hook is executable
chmod +x .husky/pre-commit
```

### Linting errors

If you encounter linting errors:

1. Try auto-fixing: `npm run lint:fix`
2. Try formatting: `npm run format`
3. Review the errors and fix manually if needed

### CI failing on formatting

If CI fails on the format check:

```bash
# Check what's wrong
npm run format:check

# Fix formatting
npm run format

# Commit the changes
git add .
git commit -m "Fix formatting"
```

## Best Practices

1. **Commit often**: The pre-commit hook only checks staged files, so it runs faster
2. **Fix issues early**: Don't bypass the pre-commit hook - fix issues as they appear
3. **Review CI feedback**: If CI fails, check the logs to understand what went wrong
4. **Keep dependencies updated**: Regularly update linting tools for the latest rules
