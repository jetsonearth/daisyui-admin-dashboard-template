// src/features/user/LandingIntro.tsx
import React from 'react';
import TemplatePointers from "./components/TemplatePointers";

function LandingIntro(): JSX.Element {
    return (
        <div className="hero min-h-full rounded-l-xl bg-base-200">
            <div className="hero-content py-12">
              <div className="max-w-md">
                <h1 className='text-3xl text-center font-bold'>MetricFlow</h1>

                <div className="text-center mt-12">
                    <img 
                        src="./intro.png" 
                        alt="Dashwind Admin Template" 
                        className="w-48 inline-block"
                    />
                </div>
              
                {/* Importing pointers component */}
                <TemplatePointers />
              </div>
            </div>
        </div>
    );
}
  
export default LandingIntro;