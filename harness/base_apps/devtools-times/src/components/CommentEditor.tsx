import type { EditorState } from 'lexical';

import React, { useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { $getRoot, $createParagraphNode, CLEAR_EDITOR_COMMAND } from 'lexical';
import ToolbarPlugin from './ToolbarPlugin';

interface Props {
    slug: string;
    onCommentPosted: (newComment: any) => void;
}

const editorConfig = {
    namespace: 'CommentEditor',
    onError: (error: Error) => console.error(error),
    editorState: () => {
        const root = $getRoot();
        if (root.isEmpty()) {
            root.append($createParagraphNode());
        }
    }
};

export default function CommentEditor({ slug, onCommentPosted }: Props) {
    const [author, setAuthor] = useState('');
    const [editorState, setEditorState] = useState<EditorState | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const editorRef = React.useRef(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const content = editorState ? JSON.stringify(editorState.toJSON()) : '';
        const plainText = editorState ? editorState.read(() => $getRoot().getTextContent()) : '';

        if (!author.trim() || !plainText.trim()) {
            alert('Please enter your name and a comment.');
            setIsSubmitting(false);
            return;
        }

        try {
            const response = await fetch(`${import.meta.env.PROD ? import.meta.env.SITE : ''}${import.meta.env.BASE_URL}api/comments/${slug}.json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ author, body: plainText }), // Storing as plain text for simplicity
            });

            if (response.ok) {
                const newComment = await response.json();
                setAuthor('');
                editorRef.current?.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
                onCommentPosted(newComment);
            } else {
                alert('Failed to submit comment.');
            }
        } catch (error) {
            console.error('Failed to submit comment:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mb-8 p-4 border border-gray-200 bg-gray-50">
            <form onSubmit={handleSubmit}>
                <div className="mb-4">
                    <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                        type="text"
                        id="author"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        required
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                    <div className="w-full border border-gray-300 rounded-md bg-white">
                        <LexicalComposer initialConfig={editorConfig}>
                            <ToolbarPlugin />
                            <div className="relative">
                                <RichTextPlugin
                                    contentEditable={<ContentEditable className="p-2 min-h-[120px] outline-none" />}
                                    placeholder={<div className="absolute top-2 left-2 text-gray-400 pointer-events-none">Enter your comment...</div>}
                                    ErrorBoundary={LexicalErrorBoundary}
                                />
                            </div>
                            <HistoryPlugin />
                            <OnChangePlugin onChange={(state, editor) => {
                                setEditorState(state);
                                editorRef.current = editor;
                            }} />
                        </LexicalComposer>
                    </div>
                </div>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-amber-400 text-white font-semibold hover:bg-amber-700 transition-colors rounded disabled:bg-gray-400">
                    {isSubmitting ? 'Submitting...' : 'Submit Comment'}
                </button>
            </form>
        </div>
    );
}