import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';  // Ensure this is correct
import reportWebVitals from './reportWebVitals';
import store from './app/store';
import { Provider } from 'react-redux';
import SuspenseContent from './containers/SuspenseContent';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <Suspense fallback={<SuspenseContent />}>
    <Provider store={store}>
      <App />
    </Provider>
  </Suspense>
);

reportWebVitals();