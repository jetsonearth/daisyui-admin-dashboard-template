import { marketDataService } from './marketDataService';

async function testOHLCVData() {
    try {
        const entryDate = new Date('2023-12-10');
        const exitDate = new Date('2023-12-15');
        const ticker = 'AAPL';

        console.log('🔄 Testing OHLCV data fetch...');
        console.log(`Ticker: ${ticker}`);
        console.log(`Entry Date: ${entryDate.toISOString()}`);
        console.log(`Exit Date: ${exitDate.toISOString()}`);

        const data = await marketDataService.getOHLCVData(ticker, entryDate, exitDate);
        
        console.log('\n✅ Successfully fetched OHLCV data:');
        console.log(`Number of candles: ${data.length}`);
        
        // Print first and last few candles
        if (data.length > 0) {
            console.log('\nFirst 3 candles:');
            data.slice(0, 3).forEach(candle => {
                console.log({
                    date: new Date(candle.time * 1000).toISOString(),
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                    volume: candle.volume
                });
            });

            console.log('\nLast 3 candles:');
            data.slice(-3).forEach(candle => {
                console.log({
                    date: new Date(candle.time * 1000).toISOString(),
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                    volume: candle.volume
                });
            });
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testOHLCVData();
