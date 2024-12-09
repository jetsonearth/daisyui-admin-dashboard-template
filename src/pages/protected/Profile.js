import React, { useState } from 'react'
import TitleCard from '../../components/Cards/TitleCard'

function Profile(){
    const [startingCash, setStartingCash] = useState(100000); // Default starting cash
    const [transferAmount, setTransferAmount] = useState('');

    const handleTransfer = () => {
        if (transferAmount && !isNaN(parseFloat(transferAmount))) {
            const amount = parseFloat(transferAmount);
            setStartingCash(prevCash => prevCash + amount);
            setTransferAmount(''); // Reset transfer input
        }
    };

    return(
        <>
            <TitleCard title="Profile Settings" topMargin="mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text">Name</span>
                        </label>
                        <input type="text" placeholder="Your Name" className="input input-bordered w-full" />
                    </div>

                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text">Email</span>
                        </label>
                        <input type="email" placeholder="Your Email" className="input input-bordered w-full" />
                    </div>

                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text">Trading Experience (Years)</span>
                        </label>
                        <input type="number" placeholder="Years of Experience" className="input input-bordered w-full" />
                    </div>

                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text">Preferred Trading Style</span>
                        </label>
                        <select className="select select-bordered w-full">
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
                    <textarea className="textarea textarea-bordered h-24" placeholder="Your trading journey and goals"></textarea>
                </div>

                <div className="mt-6">
                    <button className="btn btn-primary">Save Changes</button>
                </div>
            </TitleCard>

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
                    <button className="btn btn-primary">Save Account Settings</button>
                </div>
            </TitleCard>


            <TitleCard title="Trading Preferences" topMargin="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text">Default Position Size ($)</span>
                        </label>
                        <input type="number" placeholder="Default Position Size" className="input input-bordered w-full" />
                    </div>

                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text">Risk Per Trade (%)</span>
                        </label>
                        <input type="number" placeholder="Risk Percentage" className="input input-bordered w-full" />
                    </div>

                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text">Default Stop Loss (%)</span>
                        </label>
                        <input type="number" placeholder="Stop Loss Percentage" className="input input-bordered w-full" />
                    </div>

                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text">Default Take Profit (%)</span>
                        </label>
                        <input type="number" placeholder="Take Profit Percentage" className="input input-bordered w-full" />
                    </div>
                </div>

                <div className="mt-6">
                    <button className="btn btn-primary">Save Preferences</button>
                </div>
            </TitleCard>
        </>
    )
}

export default Profile
