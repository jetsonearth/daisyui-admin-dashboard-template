// src/App.tsx
import React, { lazy, useEffect, useState } from 'react';
import './App.css';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { themeChange } from 'theme-change';
import checkAuth from './app/auth';
import initializeApp from './app/init';

// Initialize the app
initializeApp();

// Importing pages
const Layout = lazy(() => import('./containers/Layout'));
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Register = lazy(() => import('./pages/Register'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Documentation = lazy(() => import('./pages/Documentation'));

function App(): JSX.Element {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // daisy UI themes initialization
    themeChange(false);

    // Check authentication status
    const authenticateUser = async () => {
      try {
        const authToken = await checkAuth();
        setToken(authToken);
      } catch (error) {
        console.error('Authentication check failed', error);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    authenticateUser();
  }, []);

  if (isLoading) {
    // Optional: Add a loading spinner or placeholder
    return <div>Loading...</div>;
  }

  return (
    <>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/register" element={<Register />} />
          <Route path="/documentation" element={<Documentation />} />
          
          {/* Place new routes over this */}
          <Route path="/app/*" element={<Layout />} />

          <Route path="*" element={<Navigate to={token ? "/app/dashboard" : "/login"} replace />}/>
        </Routes>
      </Router>
    </>
  );
}

export default App;