import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const AnalyticsNav = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { path: '/analytics/risk', label: 'Risk Analysis' },
    { path: '/analytics/strategy', label: 'Strategy Analysis' },
    { path: '/analytics/time', label: 'Time Analysis' },
    { path: '/analytics/psychology', label: 'Psychology' },
    { path: '/analytics/market', label: 'Market Context' },
    { path: '/analytics/loss', label: 'Loss Analysis' },
  ];

  return (
    <nav className="flex space-x-4 mb-6 bg-gray-800 p-4 rounded-lg">
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
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
