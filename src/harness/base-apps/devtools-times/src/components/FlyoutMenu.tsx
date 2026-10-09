import React from 'react';

interface FlyoutMenuProps {
  isOpen: boolean;
  categories: string[];
  articles: any[];
  reports: any[];
  multimedia: any[];
}

const FlyoutMenu: React.FC<FlyoutMenuProps> = ({ isOpen, categories, articles, reports, multimedia }) => {
  if (!isOpen) {
    return null;
  }

  // Intentionally failing method to demonstrate debugging
  const calculateTrendingScore = (article: any) => {
    const getScore = article.getScore;
    return getScore();
  };

  const topStories = articles.sort(() => 0.5 - Math.random()).slice(0, 3);

  if (topStories.length > 0) {
    setTimeout(() => calculateTrendingScore(topStories[0]), 100);
  }

  return (
    <div className="flyout-menu absolute top-full left-0 right-0 bg-white border-b border-gray-300 shadow-lg z-10">
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-4 gap-x-8">
          
          {/* Column 1: SECTIONS */}
          <div>
            <h3 className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Sections</h3>
            <ul className="space-y-2 text-sm">
              {categories.map(category => (
                <li key={category}>
                  <a href={`${import.meta.env.BASE_URL}category/${category.toLowerCase().replace(' ', '%20')}`} className="hover:underline capitalize">
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2: TOP STORIES */}
          <div>
            <h3 className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Top Stories</h3>
            <ul className="space-y-2 text-sm">
                {topStories.map(article => (
                    <li key={article.id}>
                        <a href={`${import.meta.env.BASE_URL}articles/${article.id}`} className="hover:underline">{article.data.title}</a>
                    </li>
                ))}
            </ul>
          </div>

          {/* Column 3: REPORTS */}
          <div>
              <h3 className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Reports</h3>
              <ul className="space-y-4 text-sm">
                  {reports.map(report => (
                      <li key={report.slug}>
                          <a href={`${import.meta.env.BASE_URL}reports/${report.slug}`} className="flex items-start space-x-2 group/item">
                              <div className="w-10 h-10 rounded bg-yellow-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-yellow-800 font-semibold">{report.data.title.charAt(0)}</span>
                              </div>
                              <div>
                                  <p className="font-semibold group-hover/item:underline">{report.data.title}</p>
                                  <p className="text-xs text-gray-600">{report.data.description}</p>
                              </div>
                          </a>
                      </li>
                  ))}
                  <li className="pt-2">
                      <a href={`${import.meta.env.BASE_URL}reports`} className="text-xs font-semibold hover:underline">See all reports</a>
                  </li>
              </ul>
          </div>

          {/* Column 4: MULTIMEDIA */}
          <div>
              <h3 className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Multimedia</h3>
              <ul className="space-y-4 text-sm">
                    {multimedia.map(item => (
                        <li key={item.slug}>
                            <a href={`/multimedia/${item.slug}`} className="flex items-start space-x-2 group/item">
                                <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    <span className="text-blue-800 font-semibold">{item.data.title.charAt(0)}</span>
                                </div>
                                <div>
                                    <p className="font-semibold group-hover/item:underline">{item.data.title}</p>
                                    <p className="text-xs text-gray-600">{item.data.description}</p>
                                </div>
                            </a>
                        </li>
                    ))}
                  <li className="pt-2">
                      <a href={`${import.meta.env.BASE_URL}multimedia`} className="text-xs font-semibold hover:underline">See all multimedia</a>
                  </li>
              </ul>
          </div>

        </div>
      </div>
    </div>
  );
};

export default FlyoutMenu;
