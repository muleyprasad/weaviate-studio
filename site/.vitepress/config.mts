import { defineConfig, type HeadConfig } from "vitepress";

const SITE_URL = "https://weaviatestudio.com";
const SITE_TITLE = "Weaviate Studio — Self-Hosted Weaviate Management UI for VS Code";
const SITE_DESCRIPTION =
  "Weaviate Studio is a free, open-source VS Code extension for managing self-hosted, on-prem, and cloud Weaviate vector databases. Browse collections, run GraphQL and generative (RAG) queries, manage RBAC, backups, schemas, and multi-vector search — a full Weaviate dashboard inside your editor.";
const OG_IMAGE = `${SITE_URL}/weaviate-studio-color.png`;

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Weaviate Studio",
  titleTemplate: ":title · Weaviate Studio",
  description: SITE_DESCRIPTION,
  lang: "en-US",

  // Custom domain (root path)
  base: "/",

  // Auto-generate sitemap.xml for crawlers
  sitemap: {
    hostname: `${SITE_URL}/`,
  },

  // Clean URLs help SEO (no .html suffixes)
  cleanUrls: true,

  // Don't fail the build on a dead link, but warn
  ignoreDeadLinks: false,

  head: [
    // Branding
    ["link", { rel: "icon", type: "image/png", href: "/weaviate-studio-color.png" }],
    ["link", { rel: "apple-touch-icon", href: "/weaviate-studio-color.png" }],

    // Crawl + indexing hints
    ["meta", { name: "robots", content: "index, follow, max-image-preview:large" }],
    ["meta", { name: "googlebot", content: "index, follow" }],

    // SEO keywords (low-weight but harmless)
    [
      "meta",
      {
        name: "keywords",
        content:
          "Weaviate, Weaviate UI, Weaviate dashboard, Weaviate management, self-hosted Weaviate, Weaviate VS Code extension, vector database UI, vector database dashboard, manage Weaviate cluster, Weaviate console, Weaviate GUI, GraphQL editor for Weaviate, RAG, RBAC, multi-vector search, Muvera, generative search",
      },
    ],
    ["meta", { name: "author", content: "Prasad Muley" }],
    ["meta", { name: "theme-color", content: "#41d1ff" }],

    // Open Graph (Facebook, LinkedIn, Slack previews)
    ["meta", { property: "og:site_name", content: "Weaviate Studio" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:locale", content: "en_US" }],
    ["meta", { property: "og:title", content: SITE_TITLE }],
    ["meta", { property: "og:description", content: SITE_DESCRIPTION }],
    ["meta", { property: "og:url", content: `${SITE_URL}/` }],
    ["meta", { property: "og:image", content: OG_IMAGE }],
    ["meta", { property: "og:image:alt", content: "Weaviate Studio logo" }],

    // Twitter / X card
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:title", content: SITE_TITLE }],
    ["meta", { name: "twitter:description", content: SITE_DESCRIPTION }],
    ["meta", { name: "twitter:image", content: OG_IMAGE }],

    // JSON-LD structured data — helps Google show rich results for a SoftwareApplication
    [
      "script",
      { type: "application/ld+json" },
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Weaviate Studio",
        alternateName: ["Weaviate Studio VS Code Extension", "Weaviate Dashboard for VS Code"],
        applicationCategory: "DeveloperApplication",
        applicationSubCategory: "DatabaseManagementApplication",
        operatingSystem: "Windows, macOS, Linux",
        description: SITE_DESCRIPTION,
        url: `${SITE_URL}/`,
        downloadUrl:
          "https://marketplace.visualstudio.com/items?itemName=prasadmuley.weaviate-studio",
        softwareVersion: "1.7.1",
        license: "https://opensource.org/licenses/MIT",
        author: {
          "@type": "Person",
          name: "Prasad Muley",
          url: "https://github.com/muleyprasad",
        },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        keywords:
          "Weaviate, vector database, self-hosted, dashboard, VS Code, GraphQL, RAG, RBAC, multi-vector search",
        sameAs: [
          "https://github.com/muleyprasad/weaviate-studio",
          "https://marketplace.visualstudio.com/items?itemName=prasadmuley.weaviate-studio",
          "https://open-vsx.org/extension/prasadmuley/weaviate-studio",
        ],
      }),
    ],
  ],

  // Per-page canonical URL + per-page OG/Twitter overrides
  transformHead: ({ pageData, siteConfig }): HeadConfig[] => {
    const head: HeadConfig[] = [];
    const base = siteConfig.site.base.replace(/\/$/, "");
    // pageData.relativePath is like "guide/getting-started.md" or "index.md"
    const slug = pageData.relativePath
      .replace(/(^|\/)index\.md$/, "$1")
      .replace(/\.md$/, "");
    const path = slug ? `${slug}/` : "";
    const canonical = `${SITE_URL}${base}/${path}`.replace(/([^:]\/)\/+/g, "$1");

    head.push(["link", { rel: "canonical", href: canonical }]);
    head.push(["meta", { property: "og:url", content: canonical }]);

    // Per-page title and description for OG/Twitter (uses frontmatter when present)
    const pageTitle: string = pageData.title
      ? `${pageData.title} · Weaviate Studio`
      : SITE_TITLE;
    const pageDescription: string =
      (pageData.description as string) ||
      (pageData.frontmatter?.description as string) ||
      SITE_DESCRIPTION;

    head.push(["meta", { property: "og:title", content: pageTitle }]);
    head.push(["meta", { property: "og:description", content: pageDescription }]);
    head.push(["meta", { name: "twitter:title", content: pageTitle }]);
    head.push(["meta", { name: "twitter:description", content: pageDescription }]);

    return head;
  },

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: "/weaviate-studio-color.png",
    siteTitle: "Weaviate Studio",

    nav: [
      { text: "Home", link: "/" },
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Features", link: "/features/overview" },
      {
        text: "Changelog",
        link: "/changelog",
      },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "Getting Started", link: "/guide/getting-started" },
            { text: "Installation", link: "/guide/installation" },
            { text: "Quick Start Sandbox", link: "/guide/sandbox" },
          ],
        },
        {
          text: "Development",
          items: [
            { text: "Contributing", link: "/guide/contributing" },
            { text: "Testing Guide", link: "/guide/testing" },
            { text: "Release Guide", link: "/guide/release" },
            { text: "Telemetry", link: "/guide/telemetry" },
          ],
        },
      ],
      "/features/": [
        {
          text: "Features",
          items: [
            { text: "Overview", link: "/features/overview" },
            { text: "Data Explorer", link: "/features/data-explorer" },
            { text: "Generative Search", link: "/features/generative-search" },
            { text: "GraphQL Editor", link: "/features/graphql-templates" },
            {
              text: "RBAC & Security",
              link: "/features/rbac-security",
            },
            {
              text: "Backup & Restore",
              link: "/features/backup-restore",
            },
            {
              text: "Cluster Management",
              link: "/features/cluster-management",
            },
            { text: "Schema Management", link: "/features/schema" },
            { text: "Multi-Vector Search", link: "/features/muvera" },
          ],
        },
      ],
    },

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/muleyprasad/weaviate-studio",
      },
    ],

    editLink: {
      pattern: "https://github.com/muleyprasad/weaviate-studio/edit/main/site/:path",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: `Copyright © 2024–${new Date().getFullYear()} Prasad Muley`,
    },

    search: {
      provider: "local",
    },

    outline: {
      level: [2, 3],
      label: "On this page",
    },
  },

  markdown: {
    image: {
      lazyLoading: true,
    },
  },
});
