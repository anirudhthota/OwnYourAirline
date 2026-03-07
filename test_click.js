import puppeteer from 'puppeteer';

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));

        await page.goto('http://localhost:8080');
        await page.waitForSelector('.main-menu');

        // Start game
        await page.type('input[placeholder="Enter airline name..."]', 'Test');
        await page.type('input[placeholder="e.g. TA"]', 'TST');
        await page.type('input[placeholder="Search by IATA..."]', 'HYD');
        await page.waitForTimeout(500);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await page.click('button.btn-primary'); // Launch Airline

        await page.waitForTimeout(1000);

        // Go to routes
        const routesBtn = await page.$('.nav-btn[data-panel="routes"]');
        if (routesBtn) {
            await routesBtn.click();
            await page.waitForTimeout(500);

            // Create a route
            await page.click('#route-create-btn');
            await page.waitForTimeout(500);

            // Fill origin
            const originInput = await page.$('#rc-origin');
            await originInput.type('HYD');
            await page.waitForTimeout(500);
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');

            // Fill dest
            const destInput = await page.$('#rc-dest');
            await destInput.type('BOM');
            await page.waitForTimeout(500);
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');

            await page.waitForTimeout(500);

            // Click route only
            const createBtn = await page.$('#rc-submit-route-only');
            if (createBtn) {
                await createBtn.click();
                await page.waitForTimeout(1000);

                // Click view details
                const viewBtn = await page.$('[data-detail-route]');
                if (viewBtn) {
                    console.log("Clicking View Details...");
                    await viewBtn.click();
                    await page.waitForTimeout(1000);
                } else {
                    console.log("View Details button not found");
                }
            } else {
                console.log("Create button not found");
            }
        }

        await browser.close();
    } catch (e) {
        console.error("Test script failed:", e);
        process.exit(1);
    }
})();
