
import React, { useState, useEffect } from 'react';

interface Article {
  slug: string;
  title: string;
  summary: string;
  image: string;
}

interface Props {
  articles: Article[];
  onClose: () => void;
}

export default function ReadingListFlyout({ articles, onClose }: Props) {
  const [readingList, setReadingList] = useState<string[]>([]);

  const fetchReadingList = async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}api/reading-list.json`);
    const data = await response.json();
    setReadingList(data.readingList);
  };

  useEffect(() => {
    fetchReadingList();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleRemove = async (slug: string) => {
    await fetch(`${import.meta.env.BASE_URL}api/reading-list.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slug }),
    });
    fetchReadingList();
  };

  const readingListArticles = articles.filter(article => readingList.includes(article.slug));

  return (
    <div className="fixed inset-0 bg-white/30 backdrop-blur-sm z-[99999] flex justify-center items-start p-4 pt-[15vh]" onClick={onClose}>
      <div className="bg-white shadow-xl w-full max-w-2xl relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md text-gray-500 hover:text-amber-400 hover:scale-110 transition-transform z-10">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Your Reading List</h3>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {readingListArticles.length === 0 && (
            <p className="text-gray-500 text-center py-8">Your reading list is empty.</p>
          )}
          <ul className="space-y-2">
            {readingListArticles.map(article => (
              <li key={article.slug} className="flex items-center">
                <a href={`${import.meta.env.BASE_URL}articles/${article.slug}`} className="block hover:bg-gray-100 p-4 rounded-md transition-colors flex-grow">
                  <h4 className="font-bold text-lg text-gray-800 group-hover:text-amber-400">{article.title}</h4>
                  <p className="text-sm text-gray-600">{article.summary}</p>
                </a>
                <button onClick={() => handleRemove(article.slug)} className="p-2 text-gray-500 hover:text-amber-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
