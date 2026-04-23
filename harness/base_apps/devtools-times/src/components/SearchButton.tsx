
import React, { useState } from 'react';
import SearchFlyout from './SearchFlyout';

interface Article {
    slug: string;
    title: string;
    summary: string;
}

export default function SearchButton() {
    const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
    const [articles, setArticles] = useState<Article[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const openSearch = async () => {
        try {
            setArticles([]);
            setIsFlyoutOpen(true);
        } catch (error) {
            console.error('Failed to fetch articles:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const closeSearch = () => {
        setIsFlyoutOpen(false);
    };

    return (
        <>
            <button
                className="text-gray-700 hover:text-amber-400 w-6 h-6 flex items-center justify-center"
                onClick={openSearch}
                disabled={isLoading}
            >
                {isLoading ? (
                    <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                    <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                )}
            </button>
            {isFlyoutOpen && <SearchFlyout articles={[]} onClose={closeSearch} />}
        </>
    );
}
