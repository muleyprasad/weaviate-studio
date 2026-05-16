import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Weaviate Studio",
  description:
    "A powerful VS Code extension for managing Weaviate vector databases with an intuitive GraphQL interface.",
  lang: "en-US",

  head: [],

  // GitHub Pages base path (repo name)
  base: "/weaviate-studio/",

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
