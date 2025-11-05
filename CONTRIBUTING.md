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
4. **Build the Project**

   ```bash
   # Build everything
   npm run compile

   # Or build specific components
   npm run build:extension      # Main extension code
   npm run build:add-collection # Add Collection webview
   ```

5. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```
6. **Push and Open a Pull Request**

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
├── views/                        # Custom views (including AddCollectionPanel)
├── query-editor/                 # GraphQL editor components
└── webview/                      # React-based UI and components
```

## Working with Dependencies

### Updating weaviate-add-collection

The Add Collection UI is provided by an external React component package: [`weaviate-add-collection`](https://github.com/dudanogueira/weaviate-add-collection).

**Live Demo:** [https://dudanogueira.github.io/weaviate-add-collection/](https://dudanogueira.github.io/weaviate-add-collection/)

**To update to the latest version:**

1. **Update the dependency**

   ```bash
   npm install github:dudanogueira/weaviate-add-collection@latest
   ```

2. **Or to a specific commit/branch/tag:**

   ```bash
   # Specific commit
   npm install github:dudanogueira/weaviate-add-collection#commit-hash

   # Specific branch
   npm install github:dudanogueira/weaviate-add-collection#branch-name

   # Specific tag
   npm install github:dudanogueira/weaviate-add-collection#v1.0.0
   ```

3. **Rebuild the webview**

   ```bash
   npm run build:add-collection
   ```

4. **Test the changes**

   - Press `F5` to launch the extension
   - Test the "Create New Collection" flow
   - Verify clone and import flows work correctly

5. **Update package-lock.json**
   ```bash
   npm install
   ```

**Note:** The package is installed from GitHub, so updates require network access. The version is locked in `package-lock.json`.

### Developing weaviate-add-collection locally

If you need to make changes to the `weaviate-add-collection` component itself:

1. **Clone the component repository**

   ```bash
   cd ..
   git clone https://github.com/dudanogueira/weaviate-add-collection.git
   cd weaviate-add-collection
   npm install
   ```

2. **Link the local package**

   ```bash
   # In weaviate-add-collection directory
   npm link

   # In weaviate-studio directory
   cd ../weaviate-studio
   npm link weaviate-add-collection
   ```

3. **Make your changes** in the `weaviate-add-collection` project

4. **Rebuild in weaviate-studio**

   ```bash
   npm run build:add-collection
   ```

5. **Test the changes** by launching the extension (F5)

6. **Unlink when done**

   ```bash
   npm unlink weaviate-add-collection
   npm install
   ```

7. **Submit changes** to the weaviate-add-collection repository first, then update the dependency in weaviate-studio

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

### Testing Add Collection UI

When making changes that affect the Add Collection flow:

1. **Run unit tests:**

   ```bash
   npm test -- src/WeaviateTreeDataProvider/__tests__/AddCollection.test.ts
   ```

2. **Manual testing checklist:**
   - [ ] Create new collection from scratch
   - [ ] Clone existing collection (verify schema is prefilled)
   - [ ] Import collection from file (verify schema is loaded)
   - [ ] Test with different vectorizers
   - [ ] Test with multi-tenant collections
   - [ ] Verify error handling (invalid schema, network errors)

## Bug Reports & Feature Requests

Please use [GitHub Issues](https://github.com/muleyprasad/weaviate-studio/issues) for bug reports and feature requests. Include clear steps to reproduce, environment details, and screenshots if applicable.

---

Thank you for contributing to Weaviate Studio!
