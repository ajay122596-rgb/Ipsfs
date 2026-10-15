declare module 'react-syntax-highlighter' {
  import type { ComponentType, ReactNode } from 'react'

  export interface SyntaxHighlighterProps {
    language?: string
    style?: unknown
    children?: ReactNode
    showLineNumbers?: boolean
    wrapLongLines?: boolean
    customStyle?: Record<string, unknown>
    [key: string]: unknown
  }

  export const Prism: ComponentType<SyntaxHighlighterProps>
  export const Light: ComponentType<SyntaxHighlighterProps>
  const SyntaxHighlighter: ComponentType<SyntaxHighlighterProps>
  export default SyntaxHighlighter
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism/*' {
  const style: Record<string, Record<string, unknown>>
  export default style
}
