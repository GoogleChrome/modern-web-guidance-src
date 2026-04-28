
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
    return null;
}
