
import React, { useState, useEffect } from 'react';
import { BookmarkIcon } from '@heroicons/react/24/outline'

interface Props {
  slug: string;
  initialIsBookmarked: boolean;
}

export default function BookmarkButton({ slug, initialIsBookmarked }: Props) {
  const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked);

  const handleClick = async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}api/reading-list.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slug }),
    });
    const data = await response.json();
    setIsBookmarked(data.readingList.includes(slug));
  };

  return (
    <button onClick={handleClick} className="p-1">
      <BookmarkIcon className={`h-5 w-5 ${isBookmarked ? 'text-amber-400 fill-current' : 'text-gray-400'}`}></BookmarkIcon>
    </button>
  );
}
