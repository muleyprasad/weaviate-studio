# Contributing to Weaviate Studio

Thank you for your interest in contributing to Weaviate Studio! We welcome contributions from the community.

## Getting Started

### Prerequisites

- **Node.js** (v16 or later)
- **npm** (v8 or later)
- **VS Code** (v1.80.0 or later)
- **Git**

### Development Setup

1. **Fork and Clone**
   - Fork the repository on GitHub: https://github.com/muleyprasad/weaviate-studio
   - Then clone your fork (replace `YOUR_GITHUB_USERNAME` with your GitHub username):
   ```bash
   git clone https://github.com/YOUR_GITHUB_USERNAME/weaviate-studio.git
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

## Development Workflow

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
5. **Push and Open a Pull Request**

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Project Structure

```
src/
├── extension.ts                  # Main extension entry point
├── WeaviateTreeDataProvider/     # Tree view provider and tests
├── services/                     # Business logic
├── types/                        # TypeScript definitions
├── views/                        # Custom views
├── query-editor/                 # GraphQL editor components
└── webview/                      # React-based UI and components
```

## Coding Standards

- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Use functional React components with hooks
- Use Prettier and ESLint for formatting and linting

## Testing

- Write unit tests for utility functions
- Write integration tests for components
- Use descriptive test names
- Run tests with `npm test` and check coverage with `npm run test:coverage`

## Bug Reports & Feature Requests

Please use [GitHub Issues](https://github.com/muleyprasad/weaviate-studio/issues) for bug reports and feature requests. Include clear steps to reproduce, environment details, and screenshots if applicable.

---

Thank you for contributing to Weaviate Studio!
