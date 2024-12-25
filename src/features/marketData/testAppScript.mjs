import fetch from 'node-fetch';

async function testAppScript() {
    const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzL8p0FCtJWc2Vdvbag_Ec-oSzceRbfhYGBVGcNl6Wh5h7PkozZxY-_g09BoyBw6H16/exec';
    
    const userId = 'test_user';
    const requestType = 'ohlcv';
    // Create dates and format them
    const entryDate = new Date('2023-12-10');
    const exitDate = new Date('2023-12-15');
    
    const testData = {
        userId,
        type: requestType,
        ticker: 'AAPL',
        entryDate: entryDate.toISOString(),
        exitDate: exitDate.toISOString()
    };

    console.log('🔄 Sending request to App Script...');
    console.log('Sheet name should be:', `${userId}_${requestType}`);
    console.log('Request data:', JSON.stringify(testData, null, 2));

    try {
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
            if (data.error) {
                console.error('\n❌ Error from server:', data.error);
                if (data.message) console.error('Message:', data.message);
            } else {
                console.log('\n✅ Success! Response summary:');
                console.log('- Ticker:', data.ticker);
                console.log('- Start Date:', data.startDate);
                console.log('- End Date:', data.endDate);
                console.log('- Number of candles:', data.ohlcv?.length || 0);
                
                if (data.ohlcv && data.ohlcv.length > 0) {
                    console.log('\nFirst candle:', data.ohlcv[0]);
                    console.log('Last candle:', data.ohlcv[data.ohlcv.length - 1]);
                }
            }
        } catch (parseError) {
            console.error('❌ Failed to parse response as JSON:', parseError);
        }

    } catch (error) {
        console.error('❌ Request failed:', error);
    }
}

// Run the test
testAppScript();
