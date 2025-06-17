# Contributing to Weaviate Studio

Thank you for your interest in contributing to Weaviate Studio! We welcome contributions from the community and are excited to see what you'll build.

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v16 or later)
- **npm** (v8 or later) 
- **VS Code** (v1.85.0 or later)
- **Git**

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/weaviate-studio.git
   cd weaviate-studio
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Development**
   ```bash
   npm run dev
   ```

4. **Launch Extension**
   - Press `F5` in VS Code
   - Or use "Run Extension" from the Run and Debug panel

## 🛠️ Development Workflow

### Making Changes

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Follow our coding standards (see below)
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**
   ```bash
   npm test
   npm run lint
   ```

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

### Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```
feat: add table view for query results
fix: resolve connection timeout issues
docs: update installation instructions
```

## 📁 Project Structure

```
src/
├── extension.ts              # Main extension entry point
├── WeaviateTreeDataProvider.ts # Tree view provider
├── services/                 # Business logic
├── types/                    # TypeScript definitions
├── views/                    # Custom views
├── query-editor/             # GraphQL editor components
└── webview/                  # React-based UI
    ├── index.tsx             # Main webview app
    ├── components/           # Reusable components
    └── MonacoGraphQLEditor.tsx
```

## 🎨 Coding Standards

### TypeScript

- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

```typescript
/**
 * Generates a sample GraphQL query for a collection
 * @param collectionName - Name of the Weaviate collection
 * @param properties - Array of property names to include
 * @param limit - Maximum number of results to return
 * @returns Formatted GraphQL query string
 */
export function generateSampleQuery(
  collectionName: string,
  properties: string[] = [],
  limit: number = 10
): string {
  // Implementation...
}
```

### React Components

- Use functional components with hooks
- Prefer TypeScript interfaces for props
- Use meaningful component and prop names
- Keep components focused and reusable

```typescript
interface ResultsTableProps {
  data: any[];
  loading?: boolean;
  onRowClick?: (row: any) => void;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  data,
  loading = false,
  onRowClick
}) => {
  // Component implementation...
};
```

### CSS/Styling

- Use CSS custom properties for theming
- Follow VS Code's design system
- Prefer semantic class names
- Keep styles scoped to components

```css
.results-table {
  --table-border-color: var(--vscode-panel-border);
  --table-header-bg: var(--vscode-editor-background);
  
  border: 1px solid var(--table-border-color);
  border-radius: 4px;
}
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Writing Tests

- Write unit tests for utility functions
- Write integration tests for components
- Use descriptive test names
- Follow the AAA pattern (Arrange, Act, Assert)

```typescript
describe('generateSampleQuery', () => {
  it('should generate basic query with properties', () => {
    // Arrange
    const collectionName = 'Article';
    const properties = ['title', 'content'];
    
    // Act
    const result = generateSampleQuery(collectionName, properties);
    
    // Assert
    expect(result).toContain('Get');
    expect(result).toContain('Article');
    expect(result).toContain('title');
    expect(result).toContain('content');
  });
});
```

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Clear Description** - What happened vs. what you expected
2. **Steps to Reproduce** - Detailed steps to recreate the issue
3. **Environment** - VS Code version, OS, extension version
4. **Screenshots** - If applicable
5. **Error Messages** - Full error messages or stack traces

Use our [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).

## 💡 Feature Requests

For feature requests, please include:

1. **Problem Statement** - What problem does this solve?
2. **Proposed Solution** - How would you like it to work?
3. **Use Cases** - Who would benefit from this feature?
4. **Alternatives** - Have you considered other approaches?

Use our [feature request template](.github/ISSUE_TEMPLATE/feature_request.md).

## 📋 Pull Request Process

1. **Create an Issue** - Discuss your changes before starting
2. **Fork the Repository** - Work on your own fork
3. **Create a Feature Branch** - Use descriptive branch names
4. **Make Your Changes** - Follow our coding standards
5. **Add Tests** - Ensure good test coverage
6. **Update Documentation** - Keep docs in sync
7. **Submit Pull Request** - Use our PR template

### Pull Request Checklist

- [ ] Code follows our style guidelines
- [ ] Tests pass locally (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Documentation is updated
- [ ] Commit messages follow convention
- [ ] PR description explains the changes
- [ ] Screenshots included (for UI changes)

## 🎯 Areas for Contribution

We welcome contributions in these areas:

### 🔧 Core Features
- Query performance optimization
- Enhanced error handling
- Connection management improvements
- Schema visualization enhancements

### 🎨 UI/UX
- Accessibility improvements
- Mobile responsiveness
- Dark/light theme refinements
- User experience enhancements

### 📚 Documentation
- Code examples and tutorials
- API documentation
- Video guides
- Translation to other languages

### 🧪 Testing
- Unit test coverage
- Integration tests
- End-to-end testing
- Performance testing

### 🚀 DevOps
- CI/CD improvements
- Build optimization
- Release automation
- Monitoring and analytics

## 🏷️ Labels

We use labels to categorize issues and PRs:

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements to docs
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `priority: high` - Critical issues
- `priority: low` - Nice to have
- `area: ui` - User interface changes
- `area: backend` - Backend/logic changes

## 🤝 Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## 💬 Getting Help

- **GitHub Discussions** - For questions and general discussion
- **GitHub Issues** - For bug reports and feature requests
- **Weaviate Slack** - Join the community at [weaviate.io/slack](https://weaviate.io/slack)

## 🙏 Recognition

Contributors will be recognized in:

- README.md contributors section
- Release notes for significant contributions
- Special recognition for first-time contributors

Thank you for contributing to Weaviate Studio! 🎉
