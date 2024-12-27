import { themeChange } from 'theme-change'
import React, { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import BellIcon from '@heroicons/react/24/outline/BellIcon'
import Bars3Icon from '@heroicons/react/24/outline/Bars3Icon'
import MoonIcon from '@heroicons/react/24/outline/MoonIcon'
import SunIcon from '@heroicons/react/24/outline/SunIcon'
import { openRightDrawer } from '../features/common/rightDrawerSlice';
import { RIGHT_DRAWER_TYPES } from '../utils/globalConstantUtil'
import { NavLink, Routes, Link, useLocation } from 'react-router-dom'
import TradePlansDrawer from '../components/TradePlans/TradePlansDrawer'
import { fetchTradePlans } from '../features/tradePlans/tradePlansSlice'
import { supabase } from '../config/supabaseClient';


const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function Header() {
    const dispatch = useDispatch()
    const { noOfNotifications, pageTitle } = useSelector(state => state.header)
    const [currentTheme, setCurrentTheme] = useState(localStorage.getItem("theme"))
    const [showWatchlist, setShowWatchlist] = useState(false)
    const [plannedTrades, setPlannedTrades] = useState([])

    useEffect(() => {
        themeChange(false)
        if (currentTheme === null) {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                setCurrentTheme("dark")
            } else {
                setCurrentTheme("light")
            }
        }
        
        loadPlannedTrades()
    }, [])

    const loadPlannedTrades = async () => {
        const cachedData = localStorage.getItem('plannedTrades')
        const cachedTimestamp = localStorage.getItem('plannedTradesTimestamp')
        const now = Date.now()

        // Check if cache is valid
        if (cachedData && cachedTimestamp && (now - Number(cachedTimestamp)) < CACHE_DURATION) {
            setPlannedTrades(JSON.parse(cachedData))
            return
        }

        // Cache expired or doesn't exist, fetch new data
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('trades')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'Planned')
                .order('created_at', { ascending: false })

            if (error) throw error
            
            // Update state and cache
            setPlannedTrades(data || [])
            localStorage.setItem('plannedTrades', JSON.stringify(data || []))
            localStorage.setItem('plannedTradesTimestamp', String(now))
        } catch (error) {
            console.error('Error fetching planned trades:', error)
        }
    }

    // Function to update cache when trades change
    const updateTradesCache = (trades) => {
        setPlannedTrades(trades)
        localStorage.setItem('plannedTrades', JSON.stringify(trades))
        localStorage.setItem('plannedTradesTimestamp', String(Date.now()))
    }

    const openNotification = () => {
        dispatch(openRightDrawer({ header: "Notifications", bodyType: RIGHT_DRAWER_TYPES.NOTIFICATION }))
    }

    function logoutUser() {
        localStorage.clear();
        window.location.href = '/'
    }

    return (
        <>
            <div className="navbar sticky top-0 bg-base-100 z-10 shadow-md">
                <div className="flex-1">
                    <label htmlFor="left-sidebar-drawer" className="btn btn-primary drawer-button lg:hidden">
                        <Bars3Icon className="h-5 inline-block w-5" />
                    </label>
                    <h1 className="text-2xl font-semibold ml-2">MetricFlow</h1>
                </div>

                <div className="flex-none gap-2">
                    {/* Trade Plans Button */}
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowWatchlist(!showWatchlist)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                        </svg>
                        <span className="ml-2">Trade Plans</span>
                        {plannedTrades.length > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none bg-primary text-primary-content rounded-full">
                                {plannedTrades.length}
                            </span>
                        )}
                    </button>

                    <select className="select select-sm mr-4" data-choose-theme>
                        <option disabled selected>Theme</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="cupcake">Cupcake</option>
                        <option value="bumblebee">Bumblebee</option>
                        <option value="emerald">Emerald</option>
                        <option value="corporate">Corporate</option>
                        <option value="synthwave">Synthwave</option>
                        <option value="retro">Retro</option>
                        <option value="cyberpunk">Cyberpunk</option>
                        <option value="valentine">Valentine</option>
                        <option value="halloween">Halloween</option>
                        <option value="garden">Garden</option>
                        <option value="forest">Forest</option>
                        <option value="aqua">Aqua</option>
                        <option value="lofi">Lofi</option>
                        <option value="pastel">Pastel</option>
                        <option value="fantasy">Fantasy</option>
                        <option value="wireframe">Wireframe</option>
                        <option value="black">Black</option>
                        <option value="luxury">Luxury</option>
                        <option value="dracula">Dracula</option>
                        <option value="cmyk">CMYK</option>
                        <option value="autumn">Autumn</option>
                        <option value="business">Business</option>
                        <option value="acid">Acid</option>
                        <option value="lemonade">Lemonade</option>
                        <option value="night">Night</option>
                        <option value="coffee">Coffee</option>
                        <option value="winter">Winter</option>
                        <option value="dim">Dim</option>
                        <option value="nord">Nord</option>
                        <option value="sunset">Sunset</option>
                    </select>

                    <label className="swap">
                        <input type="checkbox" />
                        <SunIcon data-set-theme="light" data-act-class="ACTIVECLASS" className={"fill-current w-6 h-6 " + (currentTheme === "dark" ? "swap-on" : "swap-off")} />
                        <MoonIcon data-set-theme="dark" data-act-class="ACTIVECLASS" className={"fill-current w-6 h-6 " + (currentTheme === "light" ? "swap-on" : "swap-off")} />
                    </label>

                    <button className="btn btn-ghost ml-4 btn-circle" onClick={() => openNotification()}>
                        <div className="indicator">
                            <BellIcon className="h-6 w-6" />
                            {noOfNotifications > 0 ? <span className="indicator-item badge badge-secondary badge-sm">{noOfNotifications}</span> : null}
                        </div>
                    </button>

                    <div className="dropdown dropdown-end ml-4">
                        <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
                            <div className="w-10 rounded-full">
                                <img src="https://cafe24.poxo.com/ec01/nunaoppa/5GslpdAnCPzGTb8GqqEZ3uW7S5bIKfFRuUPcW9UQxy8UBa2SUzrQLQXhGOYkFYByz/hkUb6csc5n8DQbEcum7g==/_/web/product/medium/202306/0013a4f969d151b932218c9695158e70.jpeg" alt="profile" />
                            </div>
                        </label>
                        <ul tabIndex={0} className="menu menu-compact dropdown-content mt-3 p-2 shadow bg-base-100 rounded-box w-52">
                            <li className="justify-between">
                                <Link to={'/app/settings-profile'}>
                                    Profile Settings
                                    <span className="badge">New</span>
                                </Link>
                            </li>
                            <li className=''><Link to={'/app/settings-billing'}>Bill History</Link></li>
                            <div className="divider mt-0 mb-0"></div>
                            <li><a onClick={logoutUser}>Logout</a></li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Trade Plans Drawer */}
            <TradePlansDrawer
                showWatchlist={showWatchlist}
                setShowWatchlist={setShowWatchlist}
                plannedTrades={plannedTrades}
                onTradesUpdate={updateTradesCache}
            />
        </>
    )
}

export default Header