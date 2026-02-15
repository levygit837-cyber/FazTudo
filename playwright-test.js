const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/levybonito/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome'
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(15000);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(15000);

  const serverErrors = [];
  page.on('response', response => {
    if (response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  let passed = 0, failed = 0;
  const test = (name, ok, detail) => {
    if (ok) { console.log(`  ✅ ${name}`); passed++; }
    else { console.log(`  ❌ ${name}: ${detail || 'FAILED'}`); failed++; }
  };

  try {
    // ========== 1. CLIENT LOGIN ==========
    console.log("\n📋 1. Client Login");
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('domcontentloaded');
    test("Login page loads", (await page.title()) !== '');

    await page.fill('input[type="email"]', 'cliente@teste.com');
    await page.fill('input[type="password"]', 'teste123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    test("Client login succeeds", page.url().includes('client') || page.url().includes('dashboard'), `URL: ${page.url()}`);

    // ========== 2. BROWSE SERVICES ==========
    console.log("\n📋 2. Browse Services");
    await page.goto('http://localhost:5173/services');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    const svcText = await page.textContent('body');
    test("Services page loads", !svcText.includes('SQLITE_ERROR'));
    test("No 500 errors", serverErrors.length === 0, serverErrors.join(', '));
    serverErrors.length = 0;

    // ========== 3. SERVICE DETAIL ==========
    console.log("\n📋 3. Service Detail");
    await page.goto('http://localhost:5173/services/1');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    const detailText = await page.textContent('body');
    test("Service detail loads", !detailText.includes('SQLITE_ERROR'));
    test("No 500 on detail", serverErrors.length === 0, serverErrors.join(', '));
    serverErrors.length = 0;

    // ========== 4. CLIENT ORDERS ==========
    console.log("\n📋 4. Client Orders Page");
    await page.goto('http://localhost:5173/client/orders');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    const ordersText = await page.textContent('body');
    test("Orders page loads", !ordersText.includes('SQLITE_ERROR'));
    test("No 500 on orders", serverErrors.length === 0, serverErrors.join(', '));
    serverErrors.length = 0;

    // ========== 5. CREATE ORDER VIA API ==========
    console.log("\n📋 5. Create Order (API)");
    const clientLogin = await page.evaluate(async () => {
      const r = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'cliente@teste.com', password: 'teste123' })
      });
      return r.json();
    });
    const cToken = clientLogin.data.token;
    test("Client token obtained", !!cToken);

    const profLogin = await page.evaluate(async () => {
      const r = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'profissional@teste.com', password: 'teste123' })
      });
      return r.json();
    });
    const pToken = profLogin.data.token;
    test("Professional token obtained", !!pToken);

    const orderResp = await page.evaluate(async (token) => {
      const r = await fetch('http://localhost:3001/api/services/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ serviceListingId: 1, title: 'Teste Playwright E2E', description: 'Teste completo do fluxo via Playwright' })
      });
      return r.json();
    }, cToken);
    const orderId = orderResp.data?.serviceOrder?.id;
    test("Order created", !!orderId, orderResp.message);

    // ========== 6. PROFESSIONAL ACCEPTS ==========
    console.log("\n📋 6. Professional Accepts Order (API)");
    const acceptResp = await page.evaluate(async ([token, id]) => {
      const r = await fetch(`http://localhost:3001/api/services/orders/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      return r.json();
    }, [pToken, orderId]);
    test("Order accepted", acceptResp.success, acceptResp.message);

    // ========== 7. ORDER DETAILS WITH FLOW COMPONENTS ==========
    console.log("\n📋 7. Order Details (Client View - ACCEPTED)");
    serverErrors.length = 0;
    await page.goto(`http://localhost:5173/client/orders/${orderId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const orderPage = await page.textContent('body');
    test("Order detail loads", !orderPage.includes('SQLITE_ERROR'));
    test("No 500 errors", serverErrors.length === 0, serverErrors.join(', '));
    test("Shows order title", orderPage.includes('Teste Playwright'));
    test("ServiceFlowStepper visible", orderPage.includes('Pedido') && orderPage.includes('Pagamento') && orderPage.includes('Concluido'));
    test("FlowStatusBanner visible", orderPage.includes('pendente') || orderPage.includes('Pagar') || orderPage.includes('aceito'));
    serverErrors.length = 0;

    // ========== 8. CHECKOUT PAGE ==========
    console.log("\n📋 8. Checkout Page");
    await page.goto(`http://localhost:5173/client/orders/${orderId}/checkout`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const checkoutText = await page.textContent('body');
    test("Checkout page loads", checkoutText.length > 100);
    test("Shows payment methods", checkoutText.includes('PIX') || checkoutText.includes('Boleto') || checkoutText.includes('dito'));
    test("No 500 on checkout", serverErrors.length === 0, serverErrors.join(', '));
    serverErrors.length = 0;

    // ========== 9. PROFESSIONAL VIEW ==========
    console.log("\n📋 9. Professional Login & Order View");
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[type="email"]', 'profissional@teste.com');
    await page.fill('input[type="password"]', 'teste123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    test("Professional login", page.url().includes('professional') || page.url().includes('dashboard'), `URL: ${page.url()}`);

    await page.goto(`http://localhost:5173/professional/services/${orderId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const profPage = await page.textContent('body');
    test("Professional order view loads", !profPage.includes('SQLITE_ERROR'));
    test("No 500 on prof view", serverErrors.length === 0, serverErrors.join(', '));
    test("Shows stepper for professional", profPage.includes('Pedido') && profPage.includes('Pagamento'));
    serverErrors.length = 0;

    // ========== 10. COMPLETE FLOW VIA API ==========
    console.log("\n📋 10. Complete Flow (API: start -> complete -> confirm)");

    // Start
    const startResp = await page.evaluate(async ([token, id]) => {
      const r = await fetch(`http://localhost:3001/api/services/orders/${id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      return r.json();
    }, [pToken, orderId]);
    test("Service started", startResp.success, startResp.message);

    // Check IN_PROGRESS page
    await page.goto(`http://localhost:5173/professional/services/${orderId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    const inProgressText = await page.textContent('body');
    test("Shows in-progress state", inProgressText.includes('andamento') || inProgressText.includes('Marcar') || inProgressText.includes('Entregue'));

    // Complete (needs payment) - simulate payment first
    const simPayment = await page.evaluate(async ([token, id]) => {
      // Try to complete without payment (should fail)
      const r = await fetch(`http://localhost:3001/api/services/orders/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      return r.json();
    }, [pToken, orderId]);
    test("Completion requires payment (expected fail)", !simPayment.success && simPayment.message.includes('payment'), simPayment.message);

  } catch (e) {
    console.error("\n💥 Test crashed:", e.message);
    failed++;
  } finally {
    await browser.close();
  }

  console.log("\n" + "=".repeat(50));
  console.log(`  TOTAL: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(50));

  if (serverErrors.length > 0) {
    console.log("\n⚠️  Server errors:");
    serverErrors.forEach(e => console.log(`  - ${e}`));
  }

  process.exit(failed > 0 ? 1 : 0);
})();
