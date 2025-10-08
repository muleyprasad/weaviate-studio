# Linting and Pre-commit Setup

This project uses ESLint, Prettier, and Husky to maintain code quality and consistency.

## Tools Used

- **ESLint**: JavaScript/TypeScript linter
- **Prettier**: Code formatter
- **Husky**: Git hooks manager
- **lint-staged**: Run linters on staged files only

## Local Development

### First Time Setup

After cloning the repository, install dependencies:

```bash
npm install
```

This will automatically:

1. Install all dependencies including dev dependencies
2. Initialize Husky git hooks (via the `prepare` script)
3. Set up the pre-commit hook

### Pre-commit Hooks

When you commit code, the pre-commit hook will automatically:

1. Run ESLint on staged TypeScript files
2. Run Prettier to format staged files
3. Only process files that are staged for commit (fast!)

If there are any linting errors or formatting issues, the commit will be blocked until they're fixed.

### Manual Commands

You can run these commands manually:

```bash
# Check formatting
npm run format:check

# Auto-fix formatting
npm run format

# Run linter
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## GitHub Actions CI/CD

The CI pipeline runs on:

- Push to `main` or `develop` branches
- Pull requests to `main`
- Release events

### CI Jobs

1. **Lint Job**

   - Checks code formatting with Prettier
   - Runs ESLint
   - Runs on Node.js 20.x

2. **Test Job**

   - Runs formatting check
   - Runs linter
   - Runs all tests
   - Tests on Node.js 18.x and 20.x

3. **Build Job** (only on release)

   - Builds and packages the extension
   - Depends on both lint and test jobs passing

4. **Publish Jobs** (only on release)
   - Publishes to VS Code Marketplace
   - Publishes to Open VSX Registry

## Configuration Files

- `.prettierrc` - Prettier configuration
- `.prettierignore` - Files to exclude from Prettier
- `eslint.config.mjs` - ESLint configuration
- `.husky/pre-commit` - Pre-commit hook script
- `package.json` - lint-staged configuration

## Troubleshooting

### Pre-commit hook not running

If the pre-commit hook isn't running:

```bash
# Reinitialize Husky
npm run prepare

# Make sure the hook is executable (Unix/macOS)
chmod +x .husky/pre-commit
```

### Formatting conflicts

If ESLint and Prettier have conflicting rules, Prettier should win. The pre-commit hook runs ESLint first, then Prettier.

### Skipping hooks (not recommended)

In rare cases where you need to skip the pre-commit hook:

```bash
git commit --no-verify -m "your message"
```

⚠️ **Not recommended**: This bypasses all quality checks. The CI will still run and may fail.

## Best Practices

1. **Commit often**: The pre-commit hook only checks staged files, so it's fast
2. **Fix issues early**: Don't wait for CI to catch formatting/linting issues
3. **Use IDE extensions**: Install ESLint and Prettier extensions for your editor for real-time feedback
4. **Don't disable rules**: If you think a rule should be changed, discuss it with the team first

## IDE Setup

### VS Code (Recommended)

Install these extensions:

- ESLint (`dbaeumer.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)

Add to your workspace settings (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": ["typescript", "typescriptreact"]
}
```

This will auto-format and auto-fix on save!
