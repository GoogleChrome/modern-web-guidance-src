import React, { useState } from 'react';

interface CategoryNavItemProps {
    groupName: string;
    subCategories: string[];
    currentPath: string;
}

const CategoryNavItem: React.FC<CategoryNavItemProps> = ({ groupName, subCategories, currentPath }) => {
    const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);

    const isActive = subCategories.some(category => currentPath.includes(`/category/${category.toLowerCase().replace(' ', '%20')}`));

    return (
        <div 
            className="relative"
            onMouseEnter={() => setIsFlyoutOpen(true)}
            onMouseLeave={() => setIsFlyoutOpen(false)}
        >
            <a 
                href="#" 
                className={`flex items-center space-x-1 hover:text-gray-600 whitespace-nowrap ${isActive ? 'text-amber-400' : ''}`}
            >
                <span>{groupName}</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor" className="w-3 h-3 text-gray-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
            </a>
            {isFlyoutOpen && (
                <div className="absolute top-full left-0 bg-white border-b border-gray-300 shadow-sm z-10 mt-2 py-6 px-4">
                    <div className="grid grid-cols-1 gap-x-8">
                        <ul className="space-y-2 text-sm">
                            {subCategories.map(category => (
                                <li key={category}>
                                    <a href={`/category/${category.toLowerCase().replace(' ', '%20')}`} className="hover:underline capitalize">
                                        {category.charAt(0).toUpperCase() + category.slice(1)}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CategoryNavItem;
