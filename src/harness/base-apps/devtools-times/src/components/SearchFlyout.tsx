
import React, { useState, useMemo, useEffect } from 'react';

interface Article {
    slug: string;
    title: string;
    summary: string;
    image?: string;
}

interface Props {
    articles: Article[];
    onClose: () => void;
}

// Function to shuffle an array and get the first N items
const getShuffledItems = <T,>(arr: T[], count: number): T[] => {
    return [...arr].sort(() => 0.5 - Math.random()).slice(0, count);
};

export default function SearchFlyout({ articles, onClose }: Props) {
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState<Article[]>([]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        
        // Bug: Redundant fetch for suggestions
        const fetchSuggestions = async () => {
            try {
                const response = await fetch(`${import.meta.env.BASE_URL}api/articles.json`);
                const data = await response.json();
                setSuggestions(getShuffledItems(data, 3));
            } catch (error) {
                console.error('Failed to fetch suggestions:', error);
            }
        };

        fetchSuggestions();

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const filteredArticles = useMemo(() => {
        if (!searchTerm) {
            return [];
        }
        return articles.filter(article =>
            article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            article.summary.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [articles, searchTerm]);

    return (
        <div className="fixed inset-0 bg-white/30 backdrop-blur-sm z-[99999] flex justify-center items-start p-4 pt-[15vh]" onClick={onClose}>
            <div className="bg-white shadow-xl w-full max-w-2xl relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md text-gray-500 hover:text-amber-400 hover:scale-110 transition-transform z-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <div className="p-4">
                    {!searchTerm && suggestions.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 mb-3">Featured</h3>
                            <ul className="grid grid-cols-3 gap-4 mb-4">
                                {suggestions.map(article => {
                                    const imagePath = article.image ? article.image.replace(/^\//, '') : '';
                                    return (
                                        <li key={article.slug}>
                                            <a href={`${import.meta.env.BASE_URL}articles/${article.slug}`} className="block hover:bg-gray-100 p-2 rounded-md transition-colors">
                                                <img src={`${import.meta.env.BASE_URL}${imagePath}`} alt={article.title} className="w-full h-20 object-cover rounded-md mb-2" />
                                                <h4 className="font-bold text-sm text-gray-800 group-hover:text-amber-400">{article.title}</h4>
                                            </a>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                    <h3 className="text-sm font-semibold text-gray-500 mb-3">Search</h3>
                    <input
                        type="text"
                        placeholder="Search for articles..."
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                    {searchTerm && filteredArticles.length === 0 && (
                        <p className="text-gray-500 text-center py-8">No results found for "{searchTerm}".</p>
                    )}
                    {searchTerm && (
                        <ul className="space-y-2">
                            {filteredArticles.map(article => (
                                <li key={article.slug}>
                                    <a href={`${import.meta.env.BASE_URL}articles/${article.slug}`} className="block hover:bg-gray-100 p-4 rounded-md transition-colors">
                                        <h4 className="font-bold text-lg text-gray-800 group-hover:text-amber-400">{article.title}</h4>
                                        <p className="text-sm text-gray-600">{article.summary}</p>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
