// All components mapping with path for internal routes

import { lazy } from 'react'
import { Navigate } from 'react-router-dom'
import PortfolioOverview from '../pages/protected/PortfolioOverview'
import TradeLog from '../pages/protected/TradeLog'
import TradePlanner from '../pages/protected/TradeEntry'
import TradeJournal from '../pages/protected/TradeJournal'

// Protected pages
const Profile = lazy(() => import('../pages/protected/Profile'))
const Page404 = lazy(() => import('../pages/protected/404'))

// Analytics pages
const RiskAnalysis = lazy(() => import('../pages/protected/RiskAnalysis'))
const StrategyAnalysis = lazy(() => import('../pages/protected/StrategyAnalysis'))
const TimeAnalysis = lazy(() => import('../pages/protected/TimeAnalysis'))
const PsychologyAnalysis = lazy(() => import('../pages/protected/PsychologyAnalysis'))
const MarketContextAnalysis = lazy(() => import('../pages/protected/MarketContextAnalysis'))
const LossAnalysis = lazy(() => import('../pages/protected/LossAnalysis'))

const Login = lazy(() => import('../pages/Login'))
const Register = lazy(() => import('../pages/Register'))
const ForgotPassword = lazy(() => import('../pages/ForgotPassword'))

const routes = [
  {
    path: '/',
    element: <Navigate to="/dashboard" />
  },
  {
    path: '/dashboard',
    element: <PortfolioOverview />
  },
  {
    path: '/planner',
    element: <TradePlanner />
  },
  {
    path: '/trade-entry',
    element: <TradePlanner />
  },
  {
    path: '/trades',
    element: <TradeLog />
  },
  {
    path: '/journal',
    element: <TradeJournal />
  },
  {
    path: '/analytics/risk',
    element: <RiskAnalysis />
  },
  {
    path: '/analytics/strategy',
    element: <StrategyAnalysis />
  },
  {
    path: '/analytics/time',
    element: <TimeAnalysis />
  },
  {
    path: '/analytics/psychology',
    element: <PsychologyAnalysis />
  },
  {
    path: '/analytics/market',
    element: <MarketContextAnalysis />
  },
  {
    path: '/analytics/loss',
    element: <LossAnalysis />
  },
  {
    path: '/profile',
    element: <Profile />
  },
  {
    path: '/404',
    element: <Page404 />
  },
  {
    path: '/login',
    element: <Login />
  },
  {
    path: '/register',
    element: <Register />
  },
  {
    path: '/forgot-password',
    element: <ForgotPassword />
  }
]

export default routes
