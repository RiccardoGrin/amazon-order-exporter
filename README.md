# Amazon Order Exporter

A Chrome extension that adds an "Export Orders to CSV" button to your Amazon order history page. One click exports all your orders with the date, amount, description, and order ID.

## CSV Output

The exported file (`amazon-orders-YYYY-MM-DD.csv`) contains:

| Column | Example |
|--------|---------|
| Date | January 15 2024 |
| Amount | $45.99 |
| Description | MacBook USB-C Cable |
| Order ID | 123-4567890-1234567 |

## Supported Regions

US, UK, Canada, Australia, Germany, Japan, and India Amazon stores.

## Install (Developer Mode)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the project folder
5. Navigate to your [Amazon order history](https://www.amazon.com/gp/your-account/order-history) page

## Usage

1. Go to your Amazon order history page
2. Click the yellow **Export Orders to CSV** button that appears near the top of the page
3. The extension will automatically page through all your orders and download a CSV file when complete

## How It Works

The extension injects a content script into Amazon order history pages. When you click export, it:

1. Counts your total orders on the current page filter
2. Fetches each page of results (10 orders per page, with a short delay between requests)
3. Parses the order date, total, product names, and order ID from each order card
4. Generates and downloads a CSV file

No data is sent anywhere -- everything runs locally in your browser. The extension requires no special permissions.
