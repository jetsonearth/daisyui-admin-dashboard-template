/** Icons are imported separatly to reduce build time */
import BellIcon from '@heroicons/react/24/outline/BellIcon'
import DocumentTextIcon from '@heroicons/react/24/outline/DocumentTextIcon'
import Squares2X2Icon from '@heroicons/react/24/outline/Squares2X2Icon'
import TableCellsIcon from '@heroicons/react/24/outline/TableCellsIcon'
import WalletIcon from '@heroicons/react/24/outline/WalletIcon'
import CodeBracketSquareIcon from '@heroicons/react/24/outline/CodeBracketSquareIcon'
import DocumentIcon from '@heroicons/react/24/outline/DocumentIcon'
import ExclamationTriangleIcon from '@heroicons/react/24/outline/ExclamationTriangleIcon'
import CalendarDaysIcon from '@heroicons/react/24/outline/CalendarDaysIcon'
import ArrowRightOnRectangleIcon from '@heroicons/react/24/outline/ArrowRightOnRectangleIcon'
import UserIcon from '@heroicons/react/24/outline/UserIcon'
import Cog6ToothIcon from '@heroicons/react/24/outline/Cog6ToothIcon'
import BoltIcon from '@heroicons/react/24/outline/BoltIcon'
import ChartBarIcon from '@heroicons/react/24/outline/ChartBarIcon'
import CurrencyDollarIcon from '@heroicons/react/24/outline/CurrencyDollarIcon'
import InboxArrowDownIcon from '@heroicons/react/24/outline/InboxArrowDownIcon'
import UsersIcon from '@heroicons/react/24/outline/UsersIcon'
import KeyIcon from '@heroicons/react/24/outline/KeyIcon'
import DocumentDuplicateIcon from '@heroicons/react/24/outline/DocumentDuplicateIcon'

const iconClasses = `h-6 w-6`
const submenuIconClasses = `h-5 w-5`

const routes = [
  {
    path: '/app/dashboard',
    icon: <Squares2X2Icon className={iconClasses}/>, 
    name: 'Portfolio Overview',
  },
  {
    path: '/app/planner',
    icon: <DocumentTextIcon className={iconClasses}/>,
    name: 'Trade Planner',
  },
  {
    path: '/app/trades',
    icon: <CurrencyDollarIcon className={iconClasses}/>,
    name: 'Trade Log',
  },
  {
    path: '/app/journal',
    icon: <DocumentDuplicateIcon className={iconClasses}/>,
    name: 'Trading Journal',
  },
  {
    path: '/app/analytics/risk',
    icon: <ExclamationTriangleIcon className={iconClasses}/>,
    name: 'Risk Analysis',
  },
  {
    path: '/app/analytics/strategy',
    icon: <BoltIcon className={iconClasses}/>,
    name: 'Strategy Analysis',
  },
  {
    path: '/app/analytics/time',
    icon: <CalendarDaysIcon className={iconClasses}/>,
    name: 'Time Analysis',
  },
  {
    path: '/app/analytics/psychology',
    icon: <UserIcon className={iconClasses}/>,
    name: 'Psychology',
  },
  {
    path: '/app/analytics/market',
    icon: <ChartBarIcon className={iconClasses}/>,
    name: 'Market Context',
  },
  {
    path: '/app/analytics/loss',
    icon: <DocumentTextIcon className={iconClasses}/>,
    name: 'Loss Analysis',
  },
  {
    path: '/app/settings',
    icon: <Cog6ToothIcon className={iconClasses}/>,
    name: 'Settings',
  },
  {
    path: '/app/profile',
    icon: <UserIcon className={iconClasses}/>,
    name: 'Profile',
  }
]

export default routes
