function doPost(e) {
    try {
        Logger.log("Received POST data: " + e.postData.contents);
        const data = JSON.parse(e.postData.contents);
        
        const userId = data.userId;
        const requestType = data.type;
        
        if (!userId) {
            throw new Error('userId is required');
        }
        
        // Get or create the spreadsheet
        const spreadsheet = getOrCreateSpreadsheet();
        
        // Get or create user-specific sheet
        const sheetName = `${userId}_${requestType}`; // e.g., "ABC123_market_data"
        let sheet = spreadsheet.getSheetByName(sheetName);
        
        if (!sheet) {
            // Create new sheet for this user if it doesn't exist
            sheet = spreadsheet.insertSheet(sheetName);
            initializeSheet(sheet, requestType);
        }
        
        let response;
        switch(requestType) {
            case 'market_data':
                response = handleMarketDataRequest(sheet, data);
                break;
            case 'historical':
                response = handleHistoricalRequest(sheet, data);
                break;
            case 'ohlcv':
                response = handleOHLCVRequest(sheet, data);
                break;
            default:
                throw new Error('Invalid request type');
        }

        return ContentService
            .createTextOutput(JSON.stringify(response))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        Logger.log("Error in doPost: " + error.toString());
        return ContentService
            .createTextOutput(JSON.stringify({
                error: error.toString(),
                message: "Failed to process request"
            }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

function initializeSheet(sheet, type) {
    switch(type) {
        case 'market_data':
            sheet.getRange('A1:B1').setValues([['Ticker', 'Price']]);
            break;
        case 'historical':
            sheet.getRange('A1:B1').setValues([['Date', 'High/Low']]);
            break;
        case 'ohlcv':
            sheet.getRange('A1:F1').setValues([['Date', 'Open', 'High', 'Low', 'Close', 'Volume']]);
            break;
    }
    
    sheet.getRange('1:1').setFontWeight('bold');
    sheet.getRange('H1').setValue('Created: ' + new Date().toISOString());
}

function getOrCreateSpreadsheet() {
    const SPREADSHEET_NAME = 'HSM Market Data';
    const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
    
    if (files.hasNext()) {
        const file = files.next();
        return SpreadsheetApp.open(file);
    }
    
    // Create new spreadsheet if none exists
    const newSpreadsheet = SpreadsheetApp.create(SPREADSHEET_NAME);
    const sheet = newSpreadsheet.getSheets()[0];
    sheet.setName('info');
    sheet.getRange('A1').setValue('HSM Market Data Spreadsheet');
    sheet.getRange('A2').setValue('Created: ' + new Date().toISOString());
    
    return newSpreadsheet;
}

function handleMarketDataRequest(sheet, data) {
    try {
        // Clear previous data
        const lastRow = Math.max(sheet.getLastRow(), 1);
        if (lastRow > 1) {
            sheet.getRange(2, 1, lastRow - 1, 2).clear();
        }

        // Process market data request
        const tickers = data.tickers;
        const formulas = tickers.map(ticker => [
            ticker,
            `=GOOGLEFINANCE("${ticker}", "price")`
        ]);

        if (formulas.length > 0) {
            sheet.getRange(2, 1, formulas.length, 2).setValues(formulas);
        }

        Utilities.sleep(1000);

        // Get results
        const results = {};
        const dataRange = sheet.getRange(2, 1, formulas.length, 2).getValues();
        dataRange.forEach(row => {
            const [ticker, price] = row;
            if (ticker && !isNaN(price)) {
                results[ticker] = price;
            }
        });

        return {
            prices: results,
            timestamp: new Date().toISOString(),
            status: "success"
        };

    } catch (error) {
        Logger.log("Error in handleMarketDataRequest: " + error.toString());
        throw error;
    }
}

function handleHistoricalRequest(sheet, data) {
    try {
        const { ticker, entryDate, exitDate } = data;
        
        // Format dates
        const entryDateStr = `DATE(${new Date(entryDate).getFullYear()}, ${new Date(entryDate).getMonth() + 1}, ${new Date(entryDate).getDate()})`;
        const exitDateStr = `DATE(${new Date(exitDate).getFullYear()}, ${new Date(exitDate).getMonth() + 1}, ${new Date(exitDate).getDate()})`;
        
        const minFormula = `=MIN(INDEX(GOOGLEFINANCE("${ticker}", "low", ${entryDateStr}, ${exitDateStr}), , 2))`;
        const maxFormula = `=MAX(INDEX(GOOGLEFINANCE("${ticker}", "high", ${entryDateStr}, ${exitDateStr}), , 2))`;

        sheet.getRange("A1").setFormula(minFormula);
        sheet.getRange("B1").setFormula(maxFormula);
        
        Utilities.sleep(1000);
        
        const minPrice = sheet.getRange("A1").getValue();
        const maxPrice = sheet.getRange("B1").getValue();
        
        return {
            minPrice,
            maxPrice,
            ticker,
            entryDate,
            exitDate,
            status: "success"
        };

    } catch (error) {
        Logger.log("Error in handleHistoricalRequest: " + error.toString());
        throw error;
    }
}

function handleOHLCVRequest(sheet, data) {
    try {
        const { ticker, entryDate, exitDate } = data;
        
        // Calculate date range
        const startDate = new Date(entryDate);
        startDate.setDate(startDate.getDate() - 30); // 30 days before entry
        
        let endDate = new Date(exitDate);
        const today = new Date();
        // If exitDate + 30 days would exceed today, use today as the end date
        const targetEndDate = new Date(exitDate);
        targetEndDate.setDate(targetEndDate.getDate() + 30);
        endDate = targetEndDate > today ? today : targetEndDate;
        
        // Format dates for GOOGLEFINANCE
        const startDateStr = `DATE(${startDate.getFullYear()}, ${startDate.getMonth() + 1}, ${startDate.getDate()})`;
        const endDateStr = `DATE(${endDate.getFullYear()}, ${endDate.getMonth() + 1}, ${endDate.getDate()})`;
        
        // Clear previous data
        sheet.clear();
        sheet.getRange('A1:F1').setValues([['Date', 'Open', 'High', 'Low', 'Close', 'Volume']]);
        
        // Fetch OHLCV data
        const formula = `=GOOGLEFINANCE("${ticker}", "all", ${startDateStr}, ${endDateStr})`;
        sheet.getRange("A2").setFormula(formula);
        
        // Wait for data to load
        Utilities.sleep(2000);
        
        // Get the data
        const lastRow = sheet.getLastRow();
        const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
        
        // Transform data into the format needed for TradingView's charting library
        const ohlcv = data.map(row => {
            const [date, open, high, low, close, volume] = row;
            return {
                time: new Date(date).getTime() / 1000, // Unix timestamp in seconds
                open,
                high,
                low,
                close,
                volume: volume || 0
            };
        }).filter(candle => !isNaN(candle.open) && !isNaN(candle.high) && !isNaN(candle.low) && !isNaN(candle.close));
        
        return {
            ohlcv,
            ticker,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            status: "success"
        };

    } catch (error) {
        Logger.log("Error in handleOHLCVRequest: " + error.toString());
        throw error;
    }
}
