// src/app/init.ts
import axios from "axios";

const initializeApp = (): void => {
    // Setting base URL for all API request via axios
    axios.defaults.baseURL = process.env.REACT_APP_BASE_URL || '';

    if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
        // dev code
        // Add any development-specific initialization
    } else {
        // Prod build code
        // Removing console.log from prod
        console.log = () => {};

        // init analytics here
    }
}

export default initializeApp;