const fetch = require('node-fetch');

async function testAppScript() {
    const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyD0jaEQ1wTUq0AiH-taVQZvYTq4JyEVA2-Mn58i8VX027PFRD6R8p4BmjGzIIuGgMi/exec';
    
    const testData = {
        userId: 'test_user',
        type: 'ohlcv',
        ticker: 'AAPL',
        entryDate: '2023-12-10',
        exitDate: '2023-12-15'
    };

    try {
        console.log('🔄 Sending request to App Script...');
        console.log('Request data:', testData);

        const response = await fetch(APP_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify(testData),
            redirect: 'follow'
        });

        const textResponse = await response.text();
        console.log('\nRaw response:', textResponse);

        try {
            const data = JSON.parse(textResponse);
            console.log('\n✅ Parsed response:', JSON.stringify(data, null, 2));
        } catch (parseError) {
            console.error('❌ Failed to parse response as JSON:', parseError);
        }

    } catch (error) {
        console.error('❌ Request failed:', error);
    }
}

// Run the test
testAppScript();
