import React, { useState, useEffect } from 'react'
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import TitleCard from '../../components/Cards/TitleCard'
import { userSettingsService } from '../../services/userSettingsService';

function Profile(){
    // Account Settings
    const [currentBalance, setCurrentBalance] = useState(0);
    const [transferAmount, setTransferAmount] = useState('');
    const [transferType, setTransferType] = useState('deposit');
    const [lastTransfer, setLastTransfer] = useState(null);

    const [isLoading, setIsLoading] = useState(true);

    // Fetch user settings on component mount
    useEffect(() => {
        const fetchUserSettings = async () => {
            try {
                const settings = await userSettingsService.getUserSettings();
                
                // Set current balance
                setCurrentBalance(settings.starting_cash || 0);
                
                setIsLoading(false);
            } catch (error) {
                toast.error('Failed to load user settings');
                setIsLoading(false);
            }
        };

        fetchUserSettings();
    }, []);

    // Handle Fund Transfer
    const handleFundTransfer = async () => {
        try {
            const amount = parseFloat(transferAmount);
            if (isNaN(amount) || amount <= 0) {
                toast.error('Please enter a valid amount');
                return;
            }

            let newBalance;
            if (transferType === 'deposit') {
                newBalance = currentBalance + amount;
            } else {
                if (amount > currentBalance) {
                    toast.error('Insufficient funds');
                    return;
                }
                newBalance = currentBalance - amount;
            }

            // Update settings with new balance
            await userSettingsService.updateUserSettings({
                starting_cash: newBalance
            });

            // Update local state
            setCurrentBalance(newBalance);
            setLastTransfer({
                amount,
                type: transferType,
                date: new Date().toLocaleString()
            });

            // Reset transfer amount
            setTransferAmount('');
            
            toast.success(`Successfully ${transferType}ed $${amount}`);
        } catch (error) {
            console.error('Failed to transfer funds:', error);
            toast.error('Failed to transfer funds');
        }
    };

    if (isLoading) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            <TitleCard title="Account Summary" topMargin="mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="stat">
                        <div className="stat-title">Current Balance</div>
                        <div className="stat-value">${currentBalance.toLocaleString()}</div>
                    </div>
                    <div className="stat">
                        <div className="stat-title">Last Transfer</div>
                        <div className="stat-value">
                            {lastTransfer ? (
                                <>
                                    ${lastTransfer.amount.toLocaleString()} 
                                    {lastTransfer.type === 'deposit' ? ' ↑' : ' ↓'}
                                </>
                            ) : (
                                'No recent transfers'
                            )}
                        </div>
                        {lastTransfer && (
                            <div className="stat-desc">
                                {lastTransfer.date}
                            </div>
                        )}
                    </div>
                </div>
            </TitleCard>

            <TitleCard title="Fund Transfer" topMargin="mt-2">
                <div className="form-control w-full">
                    <label className="label">
                        <span className="label-text">Transfer Type</span>
                    </label>
                    <select 
                        className="select select-bordered w-full"
                        value={transferType}
                        onChange={(e) => setTransferType(e.target.value)}
                    >
                        <option value="deposit">Deposit</option>
                        <option value="withdraw">Withdraw</option>
                    </select>
                </div>

                <div className="form-control w-full mt-4">
                    <label className="label">
                        <span className="label-text">Amount</span>
                    </label>
                    <input 
                        type="number" 
                        placeholder="Enter amount" 
                        className="input input-bordered w-full"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                    />
                </div>

                <div className="mt-6">
                    <button 
                        className="btn btn-primary w-full"
                        onClick={handleFundTransfer}
                    >
                        {transferType === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
                    </button>
                </div>
            </TitleCard>

            <ToastContainer />
        </div>
    );
}

export default Profile;