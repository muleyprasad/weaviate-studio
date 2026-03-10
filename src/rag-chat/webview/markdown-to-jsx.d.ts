declare module 'markdown-to-jsx' {
  import * as React from 'react';
  export interface MarkdownProps {
    children: string;
    options?: any;
    className?: string;
  }
  const Markdown: React.FC<MarkdownProps>;
  export default Markdown;
}
