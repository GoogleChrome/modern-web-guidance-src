
import React, { useState, useEffect, useCallback } from 'react';
import CommentList from './CommentList';
import CommentEditor from './CommentEditor';

interface Comment {
    author: string;
    body: string;
    createdAt: string;
}

interface Props {
    slug: string;
}

export default function Comments({ slug }: Props) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasCommented, setHasCommented] = useState(false);

    const fetchComments = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${import.meta.env.BASE_URL}api/comments/${slug}.json`);
            const data = await response.json();
            setComments(data);
        } catch (error) {
            console.error('Failed to fetch comments:', error);
        } finally {
            setIsLoading(false);
        }
    }, [slug]);

    useEffect(() => {
        fetchComments();
    }, [fetchComments]);

    const handleCommentPosted = (newComment: Comment) => {
        setComments([newComment, ...comments]);
        setHasCommented(true);
    };

    return (
        <div id="comments" className="max-w-3xl mx-auto px-4 py-8 md:py-12 border-t border-gray-200 mt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Comments {isLoading ? '' : `(${comments.length})`}
            </h2>
            
            {hasCommented ? (
                <div className="text-center p-8 mb-6 bg-green-50 border border-green-200">
                    <p className="font-semibold text-green-800">Thanks for commenting!</p>
                </div>
            ) : (
                <CommentEditor slug={slug} onCommentPosted={handleCommentPosted} />
            )}

            <CommentList comments={comments} isLoading={isLoading} />
        </div>
    );
}
