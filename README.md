# Amazon Order Exporter

A Chrome extension that adds an "Export Orders to CSV" button to your Amazon order history page. One-click exports all your orders with the date, amount, description, and order ID.

## CSV Output

The exported file (`amazon-orders-YYYY-MM-DD.csv`) contains (example):

| Date | Amount | Description | Order ID |
|--------|---------|--------|---------|
| January 15 2024 | $45.99 | MacBook USB-C Cable | 123-4567890-1234567 |

## Install

1. Clone or download this repository
2. Open Google Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** (top left) and select the project folder
5. Navigate to your [Amazon order history](https://www.amazon.com/your-orders/orders) page

## Usage

1. Go to your Amazon order history page, if not there already
2. Click the yellow **Export Orders to CSV** button that appears near the top left of the page
3. The extension will automatically page through all your orders and download a CSV file when complete

## How It Works

The extension injects a content script into Amazon order history pages. When you click export, it:

1. Parses orders from the current page
2. Follows the pagination "Next" links to fetch each subsequent page (with a short delay between requests)
3. Parses the order date, total, product names, and order ID from each order card
4. Generates and downloads a CSV file

Both regular orders and subscription orders are included. No data is sent anywhere -- everything runs locally in your browser. The extension requires no special permissions.
