import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const AnalyticsNav = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { path: '/app/analytics/risk', label: 'Risk Analysis' },
    { path: '/app/analytics/strategy', label: 'Strategy Analysis' },
    { path: '/app/analytics/time', label: 'Time Analysis' },
    { path: '/app/analytics/psychology', label: 'Psychology' },
    { path: '/app/analytics/market', label: 'Market Context' },
    { path: '/app/analytics/loss', label: 'Loss Analysis' },
  ];

  return (
    <nav className="flex space-x-4 mb-6 bg-gray-800 p-4 rounded-lg overflow-x-auto">
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={`px-4 py-2 rounded-lg transition-colors duration-200 whitespace-nowrap ${
            currentPath === item.path
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
};

export default AnalyticsNav;
