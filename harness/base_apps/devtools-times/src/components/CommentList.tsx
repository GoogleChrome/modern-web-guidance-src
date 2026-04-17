
import React from 'react';

interface Comment {
    author: string;
    body: string;
    createdAt: string;
}

interface Props {
    comments: Comment[];
    isLoading: boolean;
}

export default function CommentList({ comments, isLoading }: Props) {
    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {comments.map((comment, index) => (
                <div key={index} className="border-b border-gray-200 pb-4">
                    <p className="font-semibold text-gray-800">{comment.author}</p>
                    <p className="text-xs text-gray-500 mb-2">{new Date(comment.createdAt).toLocaleString()}</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{comment.body}</p>
                </div>
            ))}
        </div>
    );
}
