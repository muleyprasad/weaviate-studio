# 🚀 Release Guide for Weaviate Studio Extension

This guide covers the complete process for releasing the Weaviate Studio extension to multiple marketplace platforms.

## 📋 Pre-Release Checklist

### ✅ Code Quality & Testing
- [ ] All tests passing (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Extension builds successfully (`npm run compile && npm run build:webview`)
- [ ] Manual testing completed across supported VS Code versions
- [ ] All features working as expected

### ✅ Documentation & Metadata
- [ ] README.md updated with latest features and any Breaking Changes
- [ ] Document Create Collection options (From scratch, Copy existing, Import JSON)
- [ ] CHANGELOG.md updated with release notes
- [ ] package.json version bumped appropriately
- [ ] LICENSE file present and up-to-date
- [ ] All marketplace assets ready (screenshots, logos, etc.)

### ✅ Repository State
- [ ] All changes committed and pushed to main branch
- [ ] No uncommitted changes in working directory
- [ ] Git tags created for release versions

## 🎯 Marketplace Publishing

### 1. VS Code Marketplace (Primary)

**Prerequisites:**
- Microsoft account with Visual Studio Marketplace publisher access
- Personal Access Token (PAT) from Azure DevOps
- `vsce` CLI tool installed globally

**Setup Steps:**
1. **Create Publisher Account:**
   ```bash
   # Visit https://marketplace.visualstudio.com/manage
   # Create publisher account for 'prasadmuley'
   ```

2. **Generate Personal Access Token:**
   ```bash
   # Go to https://dev.azure.com/
   # User Settings > Personal Access Tokens
   # Create token with "Marketplace (publish)" scope
   ```

3. **Configure vsce:**
   ```bash
   npm install -g vsce
   vsce login prasadmuley
   # Enter your PAT when prompted
   ```

**Publishing Process:**
```bash
# 1. Build the extension
npm run compile
npm run build:webview

# 2. Package the extension
vsce package

# 3. Test the packaged extension
code --install-extension weaviate-studio-<version>.vsix

# 4. Publish to marketplace
vsce publish
```

**Automated Publishing via GitHub Actions:**
1. Set up repository secrets in GitHub:
   - `VSCE_PAT`: Your Visual Studio Marketplace Personal Access Token
2. Create a release on GitHub - this will trigger automated publishing

### 2. Cursor Marketplace

**Current Status:** Cursor uses VS Code extensions via Open VSX Registry

**Publishing Process:**
1. **Create Open VSX Account:**
   ```bash
   # Visit https://open-vsx.org/
   # Sign up with GitHub account
   ```

2. **Install ovsx CLI:**
   ```bash
   npm install -g ovsx
   ```

3. **Get Access Token:**
   ```bash
   # Go to https://open-vsx.org/user-settings/tokens
   # Create new access token
   ```

4. **Publish to Open VSX:**
  ```bash
  ovsx publish weaviate-studio-<version>.vsix -p YOUR_ACCESS_TOKEN
  ```

### 3. Windsurf Marketplace

**Current Status:** Windsurf is relatively new. Research shows they likely support VS Code extensions.

**Publishing Process:**
1. **Check Windsurf Documentation:**
   ```bash
   # Visit Windsurf's official documentation
   # Look for extension marketplace information
   ```

2. **Alternative Approach:**
   - Users can manually install VSIX files
   - Provide direct download links
   - Support manual installation instructions

## 📦 Release Automation

### GitHub Actions Workflow

Our CI/CD pipeline (`/.github/workflows/ci.yml`) handles:
- **Continuous Integration:** Tests and builds on every push
- **Automated Releases:** Publishes to marketplaces on GitHub releases
- **Artifact Management:** Stores built extensions as GitHub artifacts

### Manual Release Process

1. **Version Bump:**
   ```bash
   # Update package.json version (no tag yet)
   npm version patch|minor|major --no-git-tag-version
   ```

2. **Update Documentation:**
   ```bash
   # Update CHANGELOG.md (Added/Changed/Fixed/Security/Breaking)
   # Update README.md (include Breaking Changes if any)
   ```

3. **Create Release:**
   ```bash
   # Tag must match package.json version with a leading v
   git tag v<version>
   git push origin main --tags
   
   # Or create release via GitHub web interface
   ```

4. **Monitor Deployment:**
   - Check GitHub Actions for successful deployment
   - Verify extension appears in marketplaces
   - Test installation from marketplace

## 🔧 Development Tools

### Essential CLI Tools
```bash
# Install development dependencies
npm install -g vsce ovsx

# Verify installation
vsce --version
ovsx --version
```

### Testing Commands
```bash
# Run full test suite
npm test

# Build extension
npm run compile
npm run build:webview

# Package for testing
vsce package

# Test locally
code --install-extension weaviate-studio-<version>.vsix
```

## 📊 Post-Release Monitoring

### Key Metrics to Track
- **Download counts** on each marketplace
- **User ratings and reviews**
- **Issue reports** and bug feedback
- **Feature requests** from users

### Maintenance Tasks
- **Regular updates** based on VS Code API changes
- **Bug fixes** from user reports
- **Feature enhancements** based on feedback
- **Security updates** for dependencies

## 🆘 Troubleshooting

### Common Issues

1. **Publishing Fails:**
   ```bash
   # Check token permissions
   vsce verify-pat
   
   # Verify package.json format
   vsce package --no-yarn
   ```

2. **Extension Won't Load:**
   ```bash
   # Check VS Code compatibility
   # Verify all dependencies are bundled
   # Test in clean VS Code environment
   ```

3. **Marketplace Rejection:**
   - Review marketplace guidelines
   - Check for policy violations
   - Ensure all required metadata is present

### Support Resources
- **VS Code Extension API:** https://code.visualstudio.com/api
- **Publishing Guide:** https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- **Open VSX Registry:** https://open-vsx.org/
- **GitHub Actions Documentation:** https://docs.github.com/en/actions

## 📝 Release Notes Template

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New feature descriptions

### Changed
- Updated feature descriptions

### Fixed
- Bug fix descriptions

### Security
- Security-related changes

### Breaking
- Changes that require user action or newer editor versions
```

## ⚡ Quick Release Checklist (CI/CD Pipeline)

Follow **these six steps** any time you need to publish a new version.  The GitHub
Actions workflow in `.github/workflows/ci.yml` is wired to run automatically
when a Git tag that starts with `v` is pushed.

1. **Pick the next version number**  
   – Use [Semantic Versioning](https://semver.org).  
   – Patch fix → `1.0.0` → `1.0.1`  
   – Back-compatible feature → `1.1.0`  
   – Breaking change → `2.0.0`.

2. **Update metadata**  
   ```bash
   # bump package.json manually or via npm
   npm version <patch|minor|major> --no-git-tag-version
   ```
   • Edit `CHANGELOG.md` — add a section like:
   ```markdown
   ## [1.0.1] — 2025-07-08
   ### Added
   * Something new.
   ### Fixed
   * Something fixed.
   ### Breaking
   * Describe any breaking change and required user action
   ```

3. **Commit and push to `main`**  
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "chore(release): 1.0.1"
   git push origin main
   ```

4. **Tag _and_ publish the release**  
   ```bash
   git tag -a v1.0.1 -m "Release 1.0.1"
   git push origin v1.0.1
   ```
   Then open **GitHub → Releases → "Draft new release"** and:
   * Select the just–pushed tag `v1.0.1`.
   * Paste the same CHANGELOG section in the description.
   * Click **Publish release** – this fires the `release` event that the
     workflow listens for.

5. **Watch GitHub Actions**  
   The `ci.yml` workflow will:
   * run tests & build (extension + webview)
   * package with `vsce`
   * publish to VS Code Marketplace using the `VSCE_PAT` secret
   * attach the `.vsix` file as a build artifact

6. **Verify**  
   * Marketplace listing should show the new version a few minutes after the
     job succeeds.  
   * Optionally test the artifact locally:
     ```bash
     code --install-extension weaviate-studio-<version>.vsix --force
     ```

That's it—no manual `vsce publish` needed.  Just remember: **version bump → changelog → commit → tag**.

---

**Questions or Issues?**
- Open an issue in the GitHub repository
- Contact the Weaviate team
- Check the troubleshooting section above 
