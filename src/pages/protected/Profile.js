import React, { useState, useEffect } from 'react'
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import TitleCard from '../../components/Cards/TitleCard'
import { userSettingsService } from '../../services/userSettingsService';

function Profile(){
    // Account Settings
    const [startingCash, setStartingCash] = useState(100000);
    const [transferAmount, setTransferAmount] = useState('');

    // Profile Settings
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [tradingExperience, setTradingExperience] = useState('');
    const [preferredTradingStyle, setPreferredTradingStyle] = useState('');
    const [bio, setBio] = useState('');

    // Advanced Settings
    const [automatedTradeLogging, setAutomatedTradeLogging] = useState(false);
    const [performanceAlerts, setPerformanceAlerts] = useState(false);

    const [isLoading, setIsLoading] = useState(true);

    // Fetch user settings on component mount
    useEffect(() => {
        const fetchUserSettings = async () => {
            try {
                const settings = await userSettingsService.getUserSettings();
                
                // Account Settings
                setStartingCash(settings.starting_cash || 100000);
                
                // Profile Settings
                setName(settings.name || '');
                setEmail(settings.email || '');
                setTradingExperience(settings.trading_experience || '');
                setPreferredTradingStyle(settings.preferred_trading_style || '');
                setBio(settings.bio || '');
                
                // Advanced Settings
                setAutomatedTradeLogging(settings.automated_trade_logging || false);
                setPerformanceAlerts(settings.performance_alerts || false);
                
                setIsLoading(false);
            } catch (error) {
                toast.error('Failed to load user settings');
                setIsLoading(false);
            }
        };

        fetchUserSettings();
    }, []);

    // Handle Account Settings Save
    const handleSaveAccountSettings = async () => {
        try {
            await userSettingsService.updateUserSettings({ 
                starting_cash: startingCash 
            });
            toast.success('Account settings saved!');
        } catch (error) {
            toast.error('Failed to save account settings');
        }
    };

    // Handle Transfer
    const handleTransfer = async () => {
        if (transferAmount && !isNaN(parseFloat(transferAmount))) {
            const amount = parseFloat(transferAmount);
            const newStartingCash = startingCash + amount;
            
            try {
                await userSettingsService.updateUserSettings({ 
                    starting_cash: newStartingCash 
                });
                
                setStartingCash(newStartingCash);
                setTransferAmount('');
                
                toast.success('Transfer successful!');
            } catch (error) {
                toast.error('Failed to update starting cash');
            }
        }
    };

    // Handle Profile Settings Save
    const handleSaveProfileSettings = async () => {
        try {
            await userSettingsService.updateUserSettings({ 
                name,
                email,
                trading_experience: tradingExperience,
                preferred_trading_style: preferredTradingStyle,
                bio
            });
            toast.success('Profile settings saved!');
        } catch (error) {
            toast.error('Failed to save profile settings');
        }
    };

    // Handle Advanced Settings Save
    const handleSaveAdvancedSettings = async () => {
        try {
            await userSettingsService.updateUserSettings({ 
                automated_trade_logging: automatedTradeLogging,
                performance_alerts: performanceAlerts
            });
            toast.success('Advanced settings saved!');
        } catch (error) {
            toast.error('Failed to save advanced settings');
        }
    };

    if (isLoading) {
        return <div>Loading...</div>;
    }

    return(
        <>
            <TitleCard title="Account Settings" topMargin="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text">Starting Cash</span>
                        </label>
                        <div className="flex items-center">
                            <input 
                                type="number" 
                                value={startingCash}
                                onChange={(e) => setStartingCash(parseFloat(e.target.value))}
                                className="input input-bordered w-full mr-2" 
                            />
                            <span className="text-lg font-semibold">$</span>
                        </div>
                    </div>

                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text">Transfer / Top Up</span>
                        </label>
                        <div className="flex items-center">
                            <input 
                                type="number" 
                                placeholder="Enter amount to transfer"
                                value={transferAmount}
                                onChange={(e) => setTransferAmount(e.target.value)}
                                className="input input-bordered w-full mr-2" 
                            />
                            <button 
                                onClick={handleTransfer}
                                className="btn btn-primary"
                            >
                                Transfer
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-6 bg-base-200 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-2">Account Summary</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <span className="text-gray-600">Current Starting Cash</span>
                            <div className="text-xl font-bold text-primary">${startingCash.toLocaleString()}</div>
                        </div>
                        <div>
                            <span className="text-gray-600">Last Transfer</span>
                            <div className="text-xl font-bold">
                                {transferAmount ? `+$${parseFloat(transferAmount).toLocaleString()}` : 'No recent transfers'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6">
                    <button 
                        onClick={handleSaveAccountSettings}
                        className="btn btn-primary"
                    >
                        Save Account Settings
                    </button>
                </div>
            </TitleCard>
            
            <TitleCard title="Profile Settings" topMargin="mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text">Name</span>
                        </label>
                        <input 
                            type="text" 
                            placeholder="Your Name" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="input input-bordered w-full" 
                        />
                    </div>

                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text">Email</span>
                        </label>
                        <input 
                            type="email" 
                            placeholder="Your Email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input input-bordered w-full" 
                        />
                    </div>

                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text">Trading Experience (Years)</span>
                        </label>
                        <input 
                            type="number" 
                            placeholder="Years of Experience" 
                            value={tradingExperience}
                            onChange={(e) => setTradingExperience(e.target.value)}
                            className="input input-bordered w-full" 
                        />
                    </div>

                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text">Preferred Trading Style</span>
                        </label>
                        <select 
                            className="select select-bordered w-full"
                            value={preferredTradingStyle}
                            onChange={(e) => setPreferredTradingStyle(e.target.value)}
                        >
                            <option value="">Select Trading Style</option>
                            <option>Day Trading</option>
                            <option>Swing Trading</option>
                            <option>Position Trading</option>
                            <option>Scalping</option>
                        </select>
                    </div>
                </div>

                <div className="form-control w-full mt-4">
                    <label className="label">
                        <span className="label-text">Bio</span>
                    </label>
                    <textarea 
                        className="textarea textarea-bordered h-24" 
                        placeholder="Your trading journey and goals"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                    ></textarea>
                </div>

                <div className="mt-6">
                    <button 
                        onClick={handleSaveProfileSettings}
                        className="btn btn-primary"
                    >
                        Save Profile Settings
                    </button>
                </div>
            </TitleCard>

            <TitleCard title="Advanced Settings" topMargin="mt-6">
                <div className="form-control w-full">
                    <label className="label cursor-pointer">
                        <span className="label-text">Automated Trade Logging</span>
                        <input 
                            type="checkbox" 
                            className="toggle toggle-primary"
                            checked={automatedTradeLogging}
                            onChange={(e) => setAutomatedTradeLogging(e.target.checked)}
                        />
                    </label>
                </div>
                <div className="form-control w-full">
                    <label className="label cursor-pointer">
                        <span className="label-text">Performance Alerts</span>
                        <input 
                            type="checkbox" 
                            className="toggle toggle-primary"
                            checked={performanceAlerts}
                            onChange={(e) => setPerformanceAlerts(e.target.checked)}
                        />
                    </label>
                </div>
                <div className="mt-6">
                    <button 
                        onClick={handleSaveAdvancedSettings}
                        className="btn btn-primary"
                    >
                        Save Advanced Settings
                    </button>
                </div>
            </TitleCard>

            <ToastContainer />

        </>
    )
}

export default Profile