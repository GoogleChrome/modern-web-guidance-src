import React, { useState } from 'react';
import FlyoutMenu from './FlyoutMenu';

interface BottomNavProps {
    categories: string[];
    articles: any[];
    reports: any[];
    multimedia: any[];
}

const BottomNav: React.FC<BottomNavProps> = ({ categories, articles, reports, multimedia }) => {
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    const groupedCategories = {
        'News & Politics': ['news', 'National', 'Politics', 'Economy', 'Labor', 'Business'],
        'Arts & Culture': ['Culture', 'Media'],
        'Science & Tech': ['science'],
        'Lifestyle & Sports': ['lifestyle', 'sports', 'Urban Development'],
    };

    const handleMouseLeave = () => {
        setActiveCategory(null);
    };

    const activeSubCategories = activeCategory ? groupedCategories[activeCategory as keyof typeof groupedCategories] : [];
    const filteredReports = activeCategory ? reports.filter(r => r.data.category === activeCategory) : [];
    const filteredMultimedia = activeCategory ? multimedia.filter(m => m.data.category === activeCategory) : [];

    return (
        <div onMouseLeave={handleMouseLeave}>
            <div className="border-t border-b border-gray-900">
                <nav className="container mx-auto px-4 flex justify-center items-center text-sm font-semibold space-x-6 h-10 overflow-x-auto">
                    {Object.entries(groupedCategories).map(([groupName, subCategories]) => {
                        return (
                            <div 
                                key={groupName}
                                onMouseEnter={() => setActiveCategory(groupName)}
                                className="h-full flex items-center"
                            >
                                <a 
                                    href="#" 
                                    className={`flex items-center space-x-1 hover:text-gray-600 whitespace-nowrap`}
                                >
                                    <span>{groupName}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor" className="w-3 h-3 text-gray-500">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                    </svg>
                                </a>
                            </div>
                        );
                    })}
                </nav>
            </div>
            <FlyoutMenu 
                isOpen={activeCategory !== null} 
                categories={activeSubCategories.filter(c => categories.includes(c))}
                articles={articles}
                reports={filteredReports}
                multimedia={filteredMultimedia}
            />
        </div>
    );
};

export default BottomNav;
