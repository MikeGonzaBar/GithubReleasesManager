import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./ReleaseNotesViewer.css";

interface ReleaseNotesViewerProps {
    content: string | null;
    className?: string;
}

export function ReleaseNotesViewer({ content, className = "" }: ReleaseNotesViewerProps) {
    if (!content || content.trim() === "") {
        return (
            <div className={`release-notes-empty ${className}`}>
                <p>No release notes available for this release.</p>
            </div>
        );
    }

    return (
        <div className={`release-notes-viewer ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ node, ...props }) => <h1 className="release-notes-h1" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="release-notes-h2" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="release-notes-h3" {...props} />,
                    p: ({ node, ...props }) => <p className="release-notes-p" {...props} />,
                    ul: ({ node, ...props }) => <ul className="release-notes-ul" {...props} />,
                    ol: ({ node, ...props }) => <ol className="release-notes-ol" {...props} />,
                    li: ({ node, ...props }) => <li className="release-notes-li" {...props} />,
                    code: ({ node, className, ...props }: any) => {
                        const isInline = !className || !className.includes('language-');
                        return isInline ? (
                            <code className="release-notes-code-inline" {...props} />
                        ) : (
                            <code className="release-notes-code-block" {...props} />
                        );
                    },
                    pre: ({ node, ...props }) => <pre className="release-notes-pre" {...props} />,
                    a: ({ node, ...props }) => <a className="release-notes-link" target="_blank" rel="noopener noreferrer" {...props} />,
                    blockquote: ({ node, ...props }) => <blockquote className="release-notes-blockquote" {...props} />,
                    table: ({ node, ...props }) => <table className="release-notes-table" {...props} />,
                    thead: ({ node, ...props }) => <thead className="release-notes-thead" {...props} />,
                    tbody: ({ node, ...props }) => <tbody className="release-notes-tbody" {...props} />,
                    tr: ({ node, ...props }) => <tr className="release-notes-tr" {...props} />,
                    th: ({ node, ...props }) => <th className="release-notes-th" {...props} />,
                    td: ({ node, ...props }) => <td className="release-notes-td" {...props} />,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

