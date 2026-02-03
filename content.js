(function () {
  "use strict";

  // --- Helpers ---

  function escapeCSV(str) {
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function parseOrdersFromDocument(doc) {
    const cards = doc.querySelectorAll(".order-card");
    const orders = [];

    cards.forEach((card) => {
      const header = card.querySelector(".order-header");
      if (!header) return;

      const headerItems = header.querySelectorAll(
        ".order-header__header-list-item"
      );

      // Extract date from the first header item that contains a date-like label
      // Handles "Order placed", "Subscription charged on", etc.
      let date = "";
      headerItems.forEach((item) => {
        if (date) return;
        const valueEl = item.querySelector(
          ".a-size-base.a-color-secondary.aok-break-word"
        );
        if (!valueEl) return;
        const value = valueEl.textContent.trim();
        // Match values that look like a date (contain a month name)
        if (
          /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(
            value
          )
        ) {
          date = value;
        }
      });

      // Extract total
      let total = "";
      headerItems.forEach((item) => {
        const label = item.querySelector(".a-text-caps");
        if (label && label.textContent.trim().toLowerCase() === "total") {
          const valueEl = item.querySelector(
            ".a-size-base.a-color-secondary.aok-break-word"
          );
          if (valueEl) total = valueEl.textContent.trim();
        }
      });

      // Extract order ID
      let orderId = "";
      const orderIdEl = header.querySelector(
        ".yohtmlc-order-id span[dir='ltr']"
      );
      if (orderIdEl) orderId = orderIdEl.textContent.trim();

      // Extract product names from ALL delivery boxes in this order card
      const productNames = [];
      const titleEls = card.querySelectorAll(".yohtmlc-product-title a");
      titleEls.forEach((el) => {
        const name = el.textContent.trim();
        if (name) productNames.push(name);
      });

      // Build description
      let description = "";
      if (productNames.length === 1) {
        description = productNames[0];
      } else if (productNames.length > 1) {
        description = productNames.map((n) => '"' + n + '"').join(", ");
      }

      // Skip orders where total is not a monetary value (e.g. "5 Audible credits")
      if (!/\d+\.\d{2}/.test(total)) return;

      orders.push({ date, total, description, orderId });
    });

    return orders;
  }

  function getNextPageUrl(doc) {
    // Amazon's "Next" link is inside <li class="a-last"><a href="...">
    const nextLink = doc.querySelector(".a-pagination .a-last a");
    if (!nextLink) return null;
    const href = nextLink.getAttribute("href");
    if (!href) return null;
    // Convert relative URL to absolute
    return new URL(href, window.location.origin).toString();
  }

  function getTotalOrderCount(doc) {
    // Read from the .num-orders element: "49 orders"
    const numEl = doc.querySelector(".num-orders");
    if (numEl) {
      const match = numEl.textContent.match(/(\d+)/);
      if (match) return parseInt(match[1], 10);
    }
    return null;
  }

  async function fetchPage(url) {
    // Add disableCsd parameter to get unencrypted HTML
    // (Amazon encrypts order data client-side via "Siege CSD" which
    //  doesn't run when we fetch HTML without executing JavaScript)
    const fetchUrl = new URL(url);
    fetchUrl.searchParams.set("disableCsd", "true");
    const resp = await fetch(fetchUrl.toString(), { credentials: "include" });
    const html = await resp.text();
    const parser = new DOMParser();
    return parser.parseFromString(html, "text/html");
  }

  function generateCSV(orders) {
    const header = "Date,Amount,Description,Order ID";
    const rows = orders.map(
      (o) =>
        escapeCSV(o.date) +
        "," +
        escapeCSV(o.total) +
        "," +
        escapeCSV(o.description) +
        "," +
        escapeCSV(o.orderId)
    );
    return header + "\n" + rows.join("\n");
  }

  function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- Main ---

  function injectButton() {
    // Find the "orders placed in" header area to place our button near it
    const heading = document.querySelector("h1");
    if (!heading) return;

    // Avoid injecting twice
    if (document.getElementById("amz-order-exporter-btn")) return;

    const btn = document.createElement("button");
    btn.id = "amz-order-exporter-btn";
    btn.textContent = "Export Orders to CSV";

    const status = document.createElement("span");
    status.id = "amz-order-exporter-status";

    heading.parentElement.appendChild(btn);
    heading.parentElement.appendChild(status);

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      status.textContent = "Counting orders...";

      try {
        let allOrders = [];

        // Try to detect total for display
        const totalOrders = getTotalOrderCount(document);
        if (totalOrders) {
          status.textContent = `Found ${totalOrders} orders. Scraping page 1...`;
        } else {
          status.textContent = "Scraping page 1...";
        }

        // Parse the current page
        const currentOrders = parseOrdersFromDocument(document);
        allOrders = allOrders.concat(currentOrders);

        // Follow the "Next" pagination link from the current page
        let nextUrl = getNextPageUrl(document);
        let page = 2;

        while (nextUrl) {
          status.textContent = `Scraping page ${page}... (${allOrders.length} orders so far)`;

          // Small delay to be respectful to Amazon's servers
          await new Promise((r) => setTimeout(r, 800));

          const doc = await fetchPage(nextUrl);
          const orders = parseOrdersFromDocument(doc);

          if (orders.length === 0) break;

          allOrders = allOrders.concat(orders);

          // Get the next page URL from the fetched page's pagination
          nextUrl = getNextPageUrl(doc);
          page++;
        }

        if (allOrders.length === 0) {
          status.textContent = "No orders found on this page.";
          btn.disabled = false;
          return;
        }

        const csv = generateCSV(allOrders);
        const today = new Date().toISOString().slice(0, 10);
        downloadCSV(csv, `amazon-orders-${today}.csv`);

        status.textContent = `Done! Exported ${allOrders.length} orders across ${page - 1} page(s).`;
      } catch (err) {
        status.textContent = "Error: " + err.message;
        console.error("Amazon Order Exporter error:", err);
      }

      btn.disabled = false;
    });
  }

  // Run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectButton);
  } else {
    injectButton();
  }
})();
