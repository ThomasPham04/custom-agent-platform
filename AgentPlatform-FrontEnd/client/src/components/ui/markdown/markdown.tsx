import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './markdown.css';

interface MarkdownProps {
  children: string;
  className?: string;
}

/**
 * Presentation-only. The model answers in markdown — bold runs, `*` bullets,
 * fenced code — and printing that verbatim showed the syntax instead of the
 * emphasis.
 *
 * No rehype-raw and no dangerouslySetInnerHTML: HTML in the answer stays inert
 * text. The answer is model output, so it is untrusted input to this component.
 */
export const Markdown = ({ children, className }: MarkdownProps) => (
  <div className={['markdown', className].filter(Boolean).join(' ')}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Anything the answer links to is outside this app.
        a: ({ children: text, ...props }) => (
          <a {...props} target="_blank" rel="noreferrer noopener">
            {text}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  </div>
);
