// Script to log in and test the analytics dashboard
const puppeteer = require('puppeteer');

(async () => {
  console.log('Testing analytics dashboard with personnel cost analysis...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    // Navigate to login page
    await page.goto('http://localhost:5173/auth');
    await page.waitForSelector('input[name="email"]', { timeout: 5000 });
    
    // Fill login form
    await page.type('input[name="email"]', 'tomas@epical.digital');
    await page.type('input[name="password"]', 'epical2025');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForNavigation();
    console.log('✓ Logged in successfully');
    
    // Navigate to analytics page
    await page.goto('http://localhost:5173/analytics');
    await page.waitForSelector('[role="tab"][value="insights"]', { timeout: 10000 });
    
    // Click on "Salud Corporativa" tab
    await page.click('[role="tab"][value="insights"]');
    console.log('✓ Navigated to Salud Corporativa tab');
    
    // Wait for personnel cost analysis section
    await page.waitForSelector('text/Análisis de Costos de Personal', { timeout: 5000 });
    console.log('✓ Personnel cost analysis section is visible');
    
    // Take screenshot
    await page.screenshot({ path: 'analytics-corporate-health.png', fullPage: true });
    console.log('✓ Screenshot saved as analytics-corporate-health.png');
    
  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: 'error-analytics.png' });
  }
  
  await browser.close();
})();