
import React, { useState, useEffect } from 'react';
import ReadingListFlyout from './ReadingListFlyout';

interface Article {
  slug: string;
  title: string;
  summary: string;
  image: string;
}

export default function ReadingListButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);

  useEffect(() => {
    const fetchArticles = async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}api/articles.json`);
      const data = await response.json();
      setArticles(data);
    };
    fetchArticles();
  }, []);

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="p-1">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
      </button>
      {isOpen && <ReadingListFlyout articles={articles} onClose={() => setIsOpen(false)} />}
    </>
  );
}
