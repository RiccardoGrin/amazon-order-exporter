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
    const cards = doc.querySelectorAll(".order-card.js-order-card");
    const orders = [];

    cards.forEach((card) => {
      const header = card.querySelector(".order-header");
      if (!header) return;

      // Extract date: the span right after "Order placed" label
      let date = "";
      const headerItems = header.querySelectorAll(
        ".order-header__header-list-item"
      );
      headerItems.forEach((item) => {
        const label = item.querySelector(".a-text-caps");
        if (label && label.textContent.trim().toLowerCase() === "order placed") {
          const valueEl = item.querySelector(
            ".a-size-base.a-color-secondary.aok-break-word"
          );
          if (valueEl) date = valueEl.textContent.trim();
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

  function getTotalOrderCount(doc) {
    // Look for text like "49 orders placed in" or "123 orders"
    const countEl = doc.querySelector(
      ".num-orders, .a-spacing-mini .a-normal"
    );
    // Fallback: search for any element containing "X orders placed"
    const allText = doc.body.innerText;
    const match = allText.match(/(\d+)\s+orders?\s+placed/i);
    if (match) return parseInt(match[1], 10);
    return 0;
  }

  function buildPageUrl(baseUrl, startIndex) {
    const url = new URL(baseUrl);
    url.searchParams.set("startIndex", startIndex);
    return url.toString();
  }

  function getBaseUrl() {
    // Use the current page URL, preserving the timeFilter param
    const url = new URL(window.location.href);
    // Remove startIndex so we can set it ourselves
    url.searchParams.delete("startIndex");
    // Remove ref_ params (not needed)
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("ref_") || key === "ref") {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  }

  async function fetchPage(url) {
    const resp = await fetch(url, { credentials: "include" });
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
        const ORDERS_PER_PAGE = 10;
        let allOrders = [];

        // Get total order count from the current page
        const totalOrders = getTotalOrderCount(document);
        const totalPages = Math.max(1, Math.ceil(totalOrders / ORDERS_PER_PAGE));
        const baseUrl = getBaseUrl();

        status.textContent = `Found ${totalOrders} orders across ${totalPages} page(s). Scraping page 1...`;

        // Parse the current page first
        const currentOrders = parseOrdersFromDocument(document);
        allOrders = allOrders.concat(currentOrders);

        // Fetch remaining pages by incrementing startIndex
        for (let page = 2; page <= totalPages; page++) {
          status.textContent = `Scraping page ${page} of ${totalPages}... (${allOrders.length} orders so far)`;

          // Small delay to be respectful to Amazon's servers
          await new Promise((r) => setTimeout(r, 800));

          const startIndex = (page - 1) * ORDERS_PER_PAGE;
          const pageUrl = buildPageUrl(baseUrl, startIndex);

          const doc = await fetchPage(pageUrl);
          const orders = parseOrdersFromDocument(doc);

          if (orders.length === 0) break; // No more orders, stop early
          allOrders = allOrders.concat(orders);
        }

        if (allOrders.length === 0) {
          status.textContent = "No orders found on this page.";
          btn.disabled = false;
          return;
        }

        const csv = generateCSV(allOrders);
        const today = new Date().toISOString().slice(0, 10);
        downloadCSV(csv, `amazon-orders-${today}.csv`);

        status.textContent = `Done! Exported ${allOrders.length} orders across ${totalPages} page(s).`;
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
