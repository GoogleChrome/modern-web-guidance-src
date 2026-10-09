import React, { useState } from 'react';
import FlyoutMenu from './FlyoutMenu';

interface Props {
  categories: string[];
}

export default function MenuButton({ categories }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <>
      <button className="text-gray-700 hover:text-amber-400" onClick={toggleMenu}>
        <svg className="w-7 h-7" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>
      <FlyoutMenu isOpen={isOpen} onClose={closeMenu} categories={categories} />
    </>
  );
}
