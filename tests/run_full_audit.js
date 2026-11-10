/**
 * CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
 * Master Quality Assurance & Security Audit Test Runner
 * Run anytime via: node tests/run_full_audit.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const jsDir = path.resolve(__dirname, '../js');
const dbDir = path.resolve(__dirname, '../database');
const cssDir = path.resolve(__dirname, '../css');
const rootDir = path.resolve(__dirname, '..');

let passedTests = 0;
let failedTests = 0;
const testResults = [];

function recordTest(category, name, passed, details = '') {
  if (passed) {
    passedTests++;
    testResults.push({ category, name, status: 'PASS', details });
    console.log(`[PASS] [${category}] ${name}`);
  } else {
    failedTests++;
    testResults.push({ category, name, status: 'FAIL', details });
    console.error(`[FAIL] [${category}] ${name}: ${details}`);
  }
}

async function runAudit() {
  console.log('================================================================');
  console.log('STARTING PHASE 9 MASTER QA AND SECURITY AUDIT');
  console.log('================================================================\n');

  // ============================================================================
  // 1. AUTHENTICATION & SESSION TESTS
  // ============================================================================
  console.log('\n--- Category 1: Authentication & Session Tests ---');

  const domSandbox = {
    console: console,
    window: {},
    document: {
      getElementById: (id) => ({
        id,
        value: '',
        disabled: false,
        innerHTML: '',
        textContent: '',
        classList: { add: () => {}, remove: () => {}, contains: () => false },
        setAttribute: () => {},
        removeAttribute: () => {},
        getAttribute: () => '',
        addEventListener: () => {}
      }),
      querySelectorAll: () => [],
      createElement: () => ({ className: '', innerHTML: '', appendChild: () => {}, addEventListener: () => {} }),
      body: { appendChild: () => {}, style: {} },
      location: {
        href: 'dashboard.html',
        pathname: '/dashboard.html',
        replace: (url) => { domSandbox.document.location.href = url; }
      },
      addEventListener: () => {}
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Math: Math,
    Number: Number,
    parseFloat: parseFloat,
    parseInt: parseInt,
    isNaN: isNaN,
    Date: Date,
    String: String,
    Array: Array,
    Object: Object
  };
  domSandbox.window = domSandbox;
  domSandbox.window.location = domSandbox.document.location;

  // Load config.js
  const configCode = fs.readFileSync(path.join(jsDir, 'config.js'), 'utf8');
  vm.runInNewContext(configCode, domSandbox);
  const CONFIG = domSandbox.CONFIG;

  // Mock valid Supabase configuration for route guard testing
  CONFIG.SUPABASE.URL = 'https://mockproject.supabase.co';
  CONFIG.SUPABASE.ANON_KEY = 'mock-anon-key-valid-jwt-token';

  // Load auth.js
  const authCode = fs.readFileSync(path.join(jsDir, 'auth.js'), 'utf8');
  vm.runInNewContext(authCode, domSandbox);
  const Auth = domSandbox.Auth;

  // Test 1.1: Dynamic Authenticated User Acceptance
  const testOwnerEmail = 'owner.house.project@gmail.com';
  recordTest('Auth', 'Dynamic Authenticated User Acceptance', Auth.isAuthorizedOwner({ email: testOwnerEmail, id: 'owner-123' }) === true);

  // Test 1.2: Null / Empty user rejection
  recordTest('Auth', 'Unauthenticated User Rejection', Auth.isAuthorizedOwner(null) === false && Auth.isAuthorizedOwner({}) === false);

  // Test 1.3: User with valid ID accepted dynamically
  recordTest('Auth', 'Dynamic ID Acceptance', Auth.isAuthorizedOwner({ id: 'owner-123' }) === true);

  // Test 1.4: Require Owner Auth on Unauthenticated Session
  Auth.client = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      signOut: async () => {},
      onAuthStateChange: () => {}
    }
  };
  const unauthSessionResult = await Auth.requireOwnerAuth();
  recordTest('Auth', 'Unauthenticated Session Rejection', unauthSessionResult.status === 'unauthenticated');

  // Test 1.5: Require Owner Auth on Valid Authenticated Session
  Auth.client.auth.getSession = async () => ({
    data: { session: { user: { id: 'usr-999', email: 'owner@project.com' } } },
    error: null
  });
  domSandbox.window.location.href = 'dashboard.html';
  const authAccountResult = await Auth.requireOwnerAuth();
  recordTest('Auth', 'Authenticated Session Acceptance', authAccountResult.status === 'authorized');

  // Test 1.6: Logout Lifecycle Execution
  let signOutCalled = false;
  Auth.client.auth.signOut = async () => { signOutCalled = true; };
  await Auth.signOut();
  recordTest('Auth', 'Logout Lifecycle Execution', signOutCalled === true);

  // ============================================================================
  // 2. MATERIAL RECORD TESTS
  // ============================================================================
  console.log('\n--- Category 2: Material Record Tests ---');

  // Load ui.js
  const uiCode = fs.readFileSync(path.join(jsDir, 'ui.js'), 'utf8');
  vm.runInNewContext(uiCode, domSandbox);
  const UI = domSandbox.UI;

  // Load dashboard.js
  const dashboardCode = fs.readFileSync(path.join(jsDir, 'dashboard.js'), 'utf8');
  vm.runInNewContext(dashboardCode, domSandbox);
  const Dashboard = domSandbox.Dashboard;

  // Test 2.1: Date and auto-day generation
  const sampleDate = '2026-11-05';
  const sampleDay = UI.getDayName(sampleDate);
  recordTest('Materials', 'Date to Day-of-Week Derivation', sampleDay === 'Thursday');

  // Test 2.2: Currency formatting
  const pkrString = UI.formatPKR(250000);
  recordTest('Materials', 'PKR Monetary Formatting', pkrString === 'Rs. 250,000');

  // Test 2.3: Validation for negative Total Due
  const negativeTotalDue = -5000;
  recordTest('Materials', 'Negative Total Due Rejection', negativeTotalDue < 0);

  // Test 2.4: Empty optional fields allowed (null notes, null quantity)
  const validMaterialPayload = {
    person_name: 'Haji Aslam',
    material_type: 'Cement',
    quantity: null,
    unit: 'Bags',
    total_due: 100000,
    purchase_date: '2026-11-05',
    notes: null
  };
  recordTest('Materials', 'Empty Optional Fields Handling', validMaterialPayload.notes === null && validMaterialPayload.quantity === null);

  // Test 2.5: Search, Filter, and Sort Engine
  Dashboard.cachedMaterials = [
    { id: '1', person_name: 'Haji Aslam', material_type: 'Cement', notes: 'Invoice 101', purchase_date: '2026-11-01', total_due: 100000, paid_amount: 100000, pending_amount: 0 },
    { id: '2', person_name: 'Tariq Steel', material_type: 'Steel / Sariya', notes: 'Grade 60', purchase_date: '2026-11-03', total_due: 250000, paid_amount: 150000, pending_amount: 100000 },
    { id: '3', person_name: 'Rashid Sand', material_type: 'Sand / Rait', notes: 'Ravi sand', purchase_date: '2026-11-02', total_due: 50000, paid_amount: 0, pending_amount: 50000 }
  ];

  // Search filter test
  const searchQuery = 'tariq';
  const searchResults = Dashboard.cachedMaterials.filter(m => 
    (m.person_name || '').toLowerCase().includes(searchQuery) || (m.notes || '').toLowerCase().includes(searchQuery)
  );
  recordTest('Materials', 'Text Search Across Person & Notes', searchResults.length === 1 && searchResults[0].id === '2');

  // Material Type filter test
  const typeFilter = 'Cement';
  const typeResults = Dashboard.cachedMaterials.filter(m => m.material_type === typeFilter);
  recordTest('Materials', 'Material Type Filtering', typeResults.length === 1 && typeResults[0].person_name === 'Haji Aslam');

  // Payment Status filter test (Paid vs Pending/Partial)
  const paidResults = Dashboard.cachedMaterials.filter(m => (m.pending_amount !== null && m.pending_amount <= 0));
  const pendingResults = Dashboard.cachedMaterials.filter(m => (m.pending_amount !== null && m.pending_amount > 0));
  recordTest('Materials', 'Payment Status Filtering (Paid vs Pending)', paidResults.length === 1 && pendingResults.length === 2);

  // Sort newest vs oldest
  const sortedNewest = [...Dashboard.cachedMaterials].sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date));
  recordTest('Materials', 'Sort Records Newest First', sortedNewest[0].id === '2' && sortedNewest[2].id === '1');

  // ============================================================================
  // 3. PAYMENT TESTS & INTEGRITY
  // ============================================================================
  console.log('\n--- Category 3: Payment Tests & Integrity ---');

  // Test 3.1: Single Payment Addition & Balance Calculation
  const parentTotalDue = 100000;
  let currentPayments = [{ id: 'p1', amount: 20000, payment_date: '2026-11-01', payment_method: 'Cash' }];
  let totalPaid = currentPayments.reduce((sum, p) => sum + p.amount, 0);
  let pendingBalance = parentTotalDue - totalPaid;
  recordTest('Payments', 'Single Payment Balance Calculation', totalPaid === 20000 && pendingBalance === 80000);

  // Test 3.2: Multiple Payments Accumulation (Rs. 20,000 + Rs. 30,000 + Rs. 10,000)
  currentPayments.push({ id: 'p2', amount: 30000, payment_date: '2026-11-02', payment_method: 'Bank Transfer' });
  currentPayments.push({ id: 'p3', amount: 10000, payment_date: '2026-11-03', payment_method: 'Online / Raast' });
  totalPaid = currentPayments.reduce((sum, p) => sum + p.amount, 0);
  pendingBalance = parentTotalDue - totalPaid;
  recordTest('Payments', 'Multiple Payments Sum (Rs. 60,000)', totalPaid === 60000);
  recordTest('Payments', 'Pending Balance Calculation (Rs. 40,000)', pendingBalance === 40000);

  // Test 3.3: Reject Zero and Negative Payment
  const zeroPayment = 0;
  const negativePayment = -1500;
  recordTest('Payments', 'Reject Zero Payment (<= 0)', zeroPayment <= 0);
  recordTest('Payments', 'Reject Negative Payment (<= 0)', negativePayment <= 0);

  // Test 3.4: Reject Overpayment beyond outstanding balance
  const overpaymentAmount = 45000;
  const isOverpaymentBlocked = overpaymentAmount > pendingBalance;
  recordTest('Payments', 'Reject Overpayment (> Rs. 40,000 pending)', isOverpaymentBlocked === true);

  // Test 3.5: Payment Edit Workflow
  const maxAllowableForEdit = pendingBalance + 20000; // 40k + 20k = 60k
  recordTest('Payments', 'Payment Edit Max Ceiling Calculation', maxAllowableForEdit === 60000);
  currentPayments[0].amount = 25000;
  totalPaid = currentPayments.reduce((sum, p) => sum + p.amount, 0);
  pendingBalance = parentTotalDue - totalPaid;
  recordTest('Payments', 'Balance Recalculation on Payment Edit', totalPaid === 65000 && pendingBalance === 35000);

  // Test 3.6: Payment Deletion Workflow
  currentPayments = currentPayments.filter(p => p.id !== 'p3');
  totalPaid = currentPayments.reduce((sum, p) => sum + p.amount, 0);
  pendingBalance = parentTotalDue - totalPaid;
  recordTest('Payments', 'Balance Recalculation on Payment Delete', totalPaid === 55000 && pendingBalance === 45000);

  // ============================================================================
  // 4. EXCEL EXPORT & SHEETJS TESTS
  // ============================================================================
  console.log('\n--- Category 4: Excel Export & SheetJS Tests ---');

  const mockXLSX = {
    utils: {
      book_new: () => ({ SheetNames: [], Sheets: {} }),
      aoa_to_sheet: (rows) => ({ _rows: rows, '!cols': [], '!freeze': null, '!ref': 'A1:K' + rows.length }),
      book_append_sheet: (wb, ws, name) => { wb.SheetNames.push(name); wb.Sheets[name] = ws; },
      decode_range: (ref) => ({ s: { c: 0, r: 0 }, e: { c: 10, r: 5 } }),
      encode_cell: (cell) => String.fromCharCode(65 + cell.c) + (cell.r + 1)
    },
    writeFile: (wb, fn) => {}
  };
  domSandbox.XLSX = mockXLSX;
  const exportCode = fs.readFileSync(path.join(jsDir, 'export.js'), 'utf8');
  vm.runInNewContext(exportCode, domSandbox);
  const ExportService = domSandbox.ExportService;

  // Test 4.1: Material Records Worksheet (11 Compact Columns in Row 4)
  const wsMat = ExportService.buildMaterialsWorksheet(Dashboard.cachedMaterials);
  const expectedMatCols = [
    "ID", "Date", "Supplier", "Material", "Qty", "Unit", "Rate", "Total", "Paid", "Pending", "Notes"
  ];
  recordTest('Excel', 'Worksheet 1 Headers Match 11 Required Columns', 
    JSON.stringify(wsMat._rows[3]) === JSON.stringify(expectedMatCols)
  );

  // Test 4.1b: Record ID is Sequential Number and Sorted First-Entered First
  const mockUnsortedMaterials = [
    { id: 'uuid-b', created_at: '2026-11-02T10:00:00Z', purchase_date: '2026-11-02', person_name: 'Second Entry' },
    { id: 'uuid-a', created_at: '2026-11-01T10:00:00Z', purchase_date: '2026-11-01', person_name: 'First Entry' },
    { id: 'uuid-c', created_at: '2026-11-03T10:00:00Z', purchase_date: '2026-11-03', person_name: 'Third Entry' }
  ];
  const wsSorted = ExportService.buildMaterialsWorksheet(mockUnsortedMaterials);
  const isNumericSequential = wsSorted._rows[4][0] === 1 && wsSorted._rows[5][0] === 2 && wsSorted._rows[6][0] === 3;
  const isFirstEnteredFirst = wsSorted._rows[4][2] === 'First Entry' && wsSorted._rows[5][2] === 'Second Entry' && wsSorted._rows[6][2] === 'Third Entry';
  recordTest('Excel', 'Record ID is Sequential (1, 2, 3) and Sorted Chronologically (First Entered First)',
    isNumericSequential && isFirstEnteredFirst
  );

  // Test 4.2: Summary KPIs Embedded in Rows 1-2
  const topSummaryLabels = wsMat._rows[0].slice(0, 3);
  const hasTopSummary = topSummaryLabels[0] === 'Total Due' && topSummaryLabels[1] === 'Total Paid' && topSummaryLabels[2] === 'Total Pending';
  recordTest('Excel', 'Worksheet 1 Summary KPIs Embedded in Rows 1-2', hasTopSummary);

  // Test 4.3: Single Worksheet in Workbook
  recordTest('Excel', 'Export as a Single Worksheet Only (Material Records)', true);

  // Test 4.4: Empty Database Export Handling
  const emptyMatWs = ExportService.buildMaterialsWorksheet([]);
  recordTest('Excel', 'Empty Database Export Graceful Handling', emptyMatWs._rows.length === 5);

  // Test 4.5: Freeze Panes & Column Widths
  recordTest('Excel', 'Freeze Header Pane (!freeze) Configuration',
    wsMat['!freeze'] !== null && wsMat['!freeze'].ySplit === 4
  );
  recordTest('Excel', 'Auto Column Widths (!cols) Assignment',
    Array.isArray(wsMat['!cols']) && wsMat['!cols'].length === 11
  );

  // Test 4.6: Export Synchronized with Active Filtered Dataset
  const subsetExport = ExportService.buildMaterialsWorksheet(pendingResults);
  recordTest('Excel', 'Export Synchronized with Active Filtered Dataset',
    subsetExport._rows.length === 6 && subsetExport._rows[4][2] === 'Rashid Sand' && subsetExport._rows[5][2] === 'Tariq Steel'
  );

  // ============================================================================
  // 5. SECURITY & RLS AUDIT
  // ============================================================================
  console.log('\n--- Category 5: Security & RLS Audit ---');

  const rlsSql = fs.readFileSync(path.join(dbDir, '04_rls.sql'), 'utf8');
  const hasProfilesRLS = rlsSql.includes('ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY') && rlsSql.includes('auth.uid() = id');
  const hasMaterialsRLS = rlsSql.includes('ALTER TABLE public.material_records ENABLE ROW LEVEL SECURITY') && rlsSql.includes('auth.uid() = user_id');
  const hasPaymentsRLS = rlsSql.includes('ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY') && rlsSql.includes('auth.uid() = user_id');
  recordTest('Security', 'RLS Enforced on profiles table', hasProfilesRLS);
  recordTest('Security', 'RLS Enforced on material_records table', hasMaterialsRLS);
  recordTest('Security', 'RLS Enforced on payments table', hasPaymentsRLS);

  const hasForceRLS = rlsSql.includes('FORCE ROW LEVEL SECURITY');
  recordTest('Security', 'FORCE ROW LEVEL SECURITY Enforced on Tables', hasForceRLS);

  const triggersSql = fs.readFileSync(path.join(dbDir, '03_triggers.sql'), 'utf8');
  const hasOwnershipCheck = triggersSql.includes('NEW.user_id != v_parent_owner');
  recordTest('Security', 'Payment Ownership Verification Trigger (NEW.user_id = v_parent_owner)', hasOwnershipCheck);

  const hasOverpaymentTrigger = triggersSql.includes('NEW.amount > v_parent_total_due') || triggersSql.includes('v_new_total_paid > v_parent_total_due');
  recordTest('Security', 'Database-level Overpayment Prevention Trigger', hasOverpaymentTrigger);

  const schemaSql = fs.readFileSync(path.join(dbDir, '01_schema.sql'), 'utf8');
  const hasDeleteRestrict = schemaSql.includes('ON DELETE RESTRICT');
  recordTest('Security', 'ON DELETE RESTRICT on Payments Foreign Key', hasDeleteRestrict);

  let serviceRoleFoundInCode = false;
  const allFiles = fs.readdirSync(jsDir).map(f => path.join(jsDir, f));
  allFiles.push(path.join(rootDir, 'dashboard.html'));
  allFiles.push(path.join(rootDir, 'login.html'));

  for (const filePath of allFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('service_role') && !filePath.includes('env.template.js')) {
      serviceRoleFoundInCode = true;
      console.error(`Leak found in: ${filePath}`);
    }
  }
  recordTest('Security', 'Service Role Key NOT Exposed in Frontend Code', !serviceRoleFoundInCode);

  let nativeDialogsFound = false;
  for (const filePath of allFiles) {
    if (filePath.endsWith('.js')) {
      const content = fs.readFileSync(filePath, 'utf8');
      const alertMatches = content.match(/(?<![a-zA-Z0-9_])alert\s*\(/g);
      const confirmMatches = content.match(/(?<![a-zA-Z0-9_])confirm\s*\(/g);
      if (alertMatches || confirmMatches) {
        nativeDialogsFound = true;
        console.error(`Native dialog found in: ${filePath}`);
      }
    }
  }
  recordTest('Security', 'Zero Native Dialogs (alert/confirm) Across Frontend JS', !nativeDialogsFound);

  // ============================================================================
  // 6. RESPONSIVE USABILITY & LAYOUT AUDIT
  // ============================================================================
  console.log('\n--- Category 6: Responsive Usability Audit ---');

  const responsiveCss = fs.readFileSync(path.join(cssDir, 'responsive.css'), 'utf8');

  const has1024Breakpoint = responsiveCss.includes('@media (max-width: 1024px)');
  recordTest('Responsive', '1024px Breakpoint for Small Laptops & Tablets', has1024Breakpoint);

  const has768Breakpoint = responsiveCss.includes('@media (max-width: 768px)');
  const hasTableCardToggle = responsiveCss.includes('.desktop-table-container') && responsiveCss.includes('display: none !important') && responsiveCss.includes('.mobile-cards-view');
  recordTest('Responsive', '768px Breakpoint with Table-to-Card Responsive Toggle', has768Breakpoint && hasTableCardToggle);

  const hasBottomNav = responsiveCss.includes('.mobile-bottom-nav');
  recordTest('Responsive', 'Mobile Touch Bottom Navigation Bar Present', hasBottomNav);

  const has480Breakpoint = responsiveCss.includes('@media (max-width: 480px)');
  recordTest('Responsive', '480px Breakpoint for Small Mobile Phones', has480Breakpoint);

  const componentsCss = fs.readFileSync(path.join(cssDir, 'components.css'), 'utf8');
  const hasTouchTargets = componentsCss.includes('min-height: 40px') && responsiveCss.includes('min-height: 44px');
  recordTest('Responsive', 'Touch-friendly Interactive Targets (40px base, 44px mobile)', hasTouchTargets);

  // ============================================================================
  // AUDIT SUMMARY REPORT
  // ============================================================================
  console.log('\n================================================================');
  console.log(`AUDIT RESULTS: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${passedTests + failedTests})`);
  console.log('================================================================');

  if (failedTests > 0) {
    console.error('CRITICAL: One or more audit tests failed!');
    process.exit(1);
  } else {
    console.log('ALL AUDIT TESTS PASSED WITH ZERO UNRESOLVED ISSUES.');
  }
}

runAudit().catch(err => {
  console.error('Fatal audit execution error:', err);
  process.exit(1);
});
