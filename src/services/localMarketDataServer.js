const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/market-data', async (req, res) => {
  try {
    const { ticker, startDate, endDate } = req.body;
    console.log(`Fetching data for ${ticker} from ${startDate} to ${endDate}`);
    
    const start = Math.floor(new Date(startDate).getTime() / 1000);
    const end = Math.floor(new Date(endDate).getTime() / 1000);
    const interval = 86400; // 1 day in seconds
    
    const url = `https://www.google.com/finance/api/chart?symbol=${ticker}&period=5d&interval=${interval}&start=${start}&end=${end}`;
    console.log('Fetching from URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Received raw data from Google Finance:', data);

    // Transform data to our format
    const ohlcv = data.points.map(point => ({
      timestamp: point.timestamp * 1000,
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volume: point.volume
    })).filter(item => 
      item.open !== null && 
      item.high !== null && 
      item.low !== null && 
      item.close !== null
    );

    console.log(`Processed ${ohlcv.length} valid data points`);
    res.json(ohlcv);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Market data server running on port ${PORT}`);
});
