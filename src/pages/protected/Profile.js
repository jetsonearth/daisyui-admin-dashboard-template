import React from 'react'
import TitleCard from '../../components/Cards/TitleCard'

function Profile(){
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
