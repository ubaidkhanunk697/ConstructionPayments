/**
 * CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
 * Excel Export Engine using SheetJS (xlsx)
 * Generates professional multi-sheet workbooks directly from Supabase
 */

const ExportService = {
  isExporting: false,

  /**
   * Main Export Controller
   * Downloads all material records, payment transactions, and financial aggregates
   */
  async exportToExcel() {
    if (this.isExporting) return; // Prevent concurrent export triggers

    if (typeof XLSX === "undefined") {
      UI.showToast("SheetJS library is not loaded. Please verify your internet connection.", "error", "Export Error");
      return;
    }

    this.setLoadingState(true);

    try {
      UI.showToast("Fetching all project records from database...", "info", "Exporting Excel");

      // 1. Fetch ALL records directly from Supabase (not just filtered/visible ones)
      let materials = [];
      let payments = [];

      if (CONFIG.isConfigured() && typeof DB !== "undefined") {
        const [materialsData, paymentsData] = await Promise.all([
          DB.fetchMaterialRecords(),
          DB.fetchAllPaymentsForExport()
        ]);
        materials = materialsData || [];
        payments = paymentsData || [];
      } else if (typeof Dashboard !== "undefined") {
        // Fallback to cached materials in unconfigured / staging mode
        materials = Dashboard.cachedMaterials || [];
        payments = Dashboard.cachedPayments || [];
      }

      // 2. Compute accurate financial aggregates across ALL fetched materials
      const summaryMetrics = this.computeSummaryMetrics(materials, payments);

      // 3. Build Worksheets
      const wb = XLSX.utils.book_new();

      // Build material ID lookup map (UUID -> numeric Record ID: 1, 2, 3...)
      // so Payment History worksheet can cross-reference records by numeric ID
      const materialIdMap = {};
      const sortedMaterialsForMap = [...materials].sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (timeA && timeB && timeA !== timeB) return timeA - timeB;
        const dateA = a.purchase_date || "";
        const dateB = b.purchase_date || "";
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return String(a.id || "").localeCompare(String(b.id || ""));
      });
      sortedMaterialsForMap.forEach((m, idx) => {
        if (m.id) materialIdMap[m.id] = idx + 1;
      });

      // Worksheet 1: Material Records
      const wsMaterials = this.buildMaterialsWorksheet(materials);
      XLSX.utils.book_append_sheet(wb, wsMaterials, "Material Records");

      // Worksheet 2: Payment History
      const wsPayments = this.buildPaymentsWorksheet(payments, materialIdMap);
      XLSX.utils.book_append_sheet(wb, wsPayments, "Payment History");

      // Worksheet 3: Summary
      const wsSummary = this.buildSummaryWorksheet(summaryMetrics);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

      // 4. Generate timestamped filename
      const today = UI.getTodayDateString();
      const filename = `Construction_Financial_Report_${today}.xlsx`;

      // 5. Trigger download via SheetJS
      XLSX.writeFile(wb, filename);

      UI.showToast(
        `Successfully exported ${materials.length} material(s) and ${payments.length} payment(s) to ${filename}`,
        "success",
        "Excel Downloaded"
      );

    } catch (err) {
      console.error("Excel Export Error:", err);
      UI.showToast(err.message || "An unexpected error occurred while generating Excel file.", "error", "Export Failed");
    } finally {
      this.setLoadingState(false);
    }
  },

  /**
   * Helper: Get Weekday Name
   */
  getDayName(dateStr) {
    if (!dateStr) return "";
    if (typeof UI !== "undefined" && typeof UI.getDayName === "function") {
      return UI.getDayName(dateStr);
    }
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString("en-US", { weekday: "long" });
    }
    return "";
  },

  /**
   * Build Worksheet 1: Material Records
   * Columns: Record ID, Purchase Date, Day, Person Name, Material Type, Material Quantity, Unit,
   * Total Amount Due (PKR), Paid Amount (PKR), Pending Amount (PKR), Notes
   * Sorted so that first entered data appears first (Record ID: 1, 2, 3...)
   */
  buildMaterialsWorksheet(materials) {
    const headers = [
      "Record ID",
      "Purchase Date",
      "Day",
      "Person Name",
      "Material Type",
      "Material Quantity",
      "Unit",
      "Total Amount Due (PKR)",
      "Paid Amount (PKR)",
      "Pending Amount (PKR)",
      "Notes"
    ];

    const rows = [headers];

    if (!materials || materials.length === 0) {
      rows.push(["No material records recorded yet.", "", "", "", "", "", "", "", "", "", ""]);
    } else {
      // Sort chronologically: first entered data (earliest created/purchased) appears first
      const sortedMaterials = [...materials].sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (timeA && timeB && timeA !== timeB) return timeA - timeB;
        const dateA = a.purchase_date || "";
        const dateB = b.purchase_date || "";
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return String(a.id || "").localeCompare(String(b.id || ""));
      });

      sortedMaterials.forEach((m, index) => {
        // Record ID as a clean sequential number (1, 2, 3...)
        const recordId = index + 1;
        const purchaseDate = m.purchase_date || "";
        const day = m.purchase_day || (m.purchase_date ? this.getDayName(m.purchase_date) : "");
        const personName = m.person_name || "Unassigned";
        const materialType = m.material_type || "General";
        const quantity = m.quantity !== null && m.quantity !== undefined && m.quantity !== "" ? Number(m.quantity) : "";
        const unit = m.unit || "";
        const totalDue = m.total_due !== null && m.total_due !== undefined ? Number(m.total_due) : "Unset";
        const paidAmount = Number(m.paid_amount) || 0;
        const pendingAmount = m.pending_amount !== null && m.pending_amount !== undefined ? Number(m.pending_amount) : "Unset";
        const notes = m.notes || "";

        rows.push([
          recordId,
          purchaseDate,
          day,
          personName,
          materialType,
          quantity,
          unit,
          totalDue,
          paidAmount,
          pendingAmount,
          notes
        ]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Freeze header row
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    ws["!views"] = [{ state: "frozen", ySplit: 1 }];

    // Auto-compute column widths
    ws["!cols"] = this.computeAutoColumnWidths(rows, [12, 16, 14, 20, 22, 18, 12, 22, 18, 22, 35]);

    return ws;
  },

  /**
   * Build Worksheet 2: Payment History
   * Columns: Payment ID, Material Record ID, Person Name, Material Type,
   * Payment Amount, Payment Date, Payment Method, Notes
   */
  buildPaymentsWorksheet(payments, materialIdMap = {}) {
    const headers = [
      "Payment ID",
      "Material Record ID",
      "Person Name",
      "Material Type",
      "Payment Amount (PKR)",
      "Payment Date",
      "Payment Method",
      "Notes"
    ];

    const rows = [headers];

    if (!payments || payments.length === 0) {
      rows.push(["No payment transactions recorded yet.", "", "", "", "", "", "", ""]);
    } else {
      // Sort payments chronologically (earliest first)
      const sortedPayments = [...payments].sort((a, b) => {
        const timeA = a.payment_date || a.created_at || "";
        const timeB = b.payment_date || b.created_at || "";
        return timeA.localeCompare(timeB);
      });

      sortedPayments.forEach((p, idx) => {
        // Sequential clean payment number (1, 2, 3...)
        const paymentId = idx + 1;
        const materialRecordId = (p.material_record_id && materialIdMap[p.material_record_id])
          ? materialIdMap[p.material_record_id]
          : (p.material_record_id || "");
        const personName = p.material_records?.person_name || "Unassigned";
        const materialType = p.material_records?.material_type || "Material";
        const amount = Number(p.amount) || 0;
        const paymentDate = p.payment_date || "";
        const paymentMethod = p.payment_method || "Cash";
        const notes = p.notes || "";

        rows.push([
          paymentId,
          materialRecordId,
          personName,
          materialType,
          amount,
          paymentDate,
          paymentMethod,
          notes
        ]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Freeze header row
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    ws["!views"] = [{ state: "frozen", ySplit: 1 }];

    // Auto-compute column widths
    ws["!cols"] = this.computeAutoColumnWidths(rows, [12, 18, 20, 18, 20, 14, 16, 35]);

    return ws;
  },

  /**
   * Build Worksheet 3: Summary
   * Structured key financial indicators for the construction project
   */
  buildSummaryWorksheet(metrics) {
    const now = new Date();
    const exportTimestamp = now.toLocaleString("en-PK", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });

    const rows = [
      ["CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM"],
      ["Single House Construction Financial Report"],
      [],
      ["METRIC", "VALUE", "NOTES / DETAILS"],
      ["Total Material Records", metrics.totalRecords, "Count of all active material procurement entries"],
      ["Total Amount Due (PKR)", metrics.totalAmountDue, `Aggregate of known contracts (${metrics.unsetDueCount} unset)`],
      ["Total Paid (PKR)", metrics.totalPaid, "Total sum of all disbursed payment transactions"],
      ["Total Pending (PKR)", metrics.totalPending, "Outstanding balance owed to suppliers / contractors"],
      [],
      ["Export Date & Time", exportTimestamp, "Generated from Supabase database"],
      ["Currency", "Pakistani Rupee (PKR)", "All monetary figures in PKR"],
      ["System Architecture", "Supabase PostgreSQL + RLS", "Single Authorized Owner House Project"]
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Column widths for summary
    ws["!cols"] = [
      { wch: 30 },
      { wch: 25 },
      { wch: 55 }
    ];

    return ws;
  },

  /**
   * Compute Summary Financial Metrics adhering strictly to project calculation rules
   */
  computeSummaryMetrics(materials, payments) {
    let totalDue = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let unsetDueCount = 0;

    // Sum paid amounts from payment transactions if available, else from materials view
    if (payments && payments.length > 0) {
      totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    } else {
      totalPaid = materials.reduce((sum, m) => sum + (Number(m.paid_amount) || 0), 0);
    }

    materials.forEach((m) => {
      const due = m.total_due !== null && m.total_due !== undefined ? Number(m.total_due) : null;
      const paid = Number(m.paid_amount) || 0;

      if (due !== null) {
        totalDue += due;
        const pending = due - paid;
        if (pending > 0) {
          totalPending += pending;
        }
      } else {
        unsetDueCount++;
      }
    });

    return {
      totalRecords: materials.length,
      totalAmountDue: totalDue,
      totalPaid: totalPaid,
      totalPending: totalPending,
      unsetDueCount: unsetDueCount
    };
  },

  /**
   * Helper: Dynamically compute appropriate column widths from cell content
   */
  computeAutoColumnWidths(rows, minWidths = []) {
    if (!rows || rows.length === 0) return [];

    const colCount = rows[0].length;
    const widths = [];

    for (let c = 0; c < colCount; c++) {
      let maxLen = minWidths[c] || 12;
      for (let r = 0; r < rows.length; r++) {
        const cell = rows[r][c];
        if (cell !== undefined && cell !== null) {
          const strLen = String(cell).length;
          if (strLen > maxLen) {
            maxLen = strLen;
          }
        }
      }
      // Add padding and cap at max 50 to avoid overly wide columns
      widths.push({ wch: Math.min(Math.max(maxLen + 3, 12), 50) });
    }

    return widths;
  },

  /**
   * Toggle button loading state across all Excel download buttons
   */
  setLoadingState(isLoading) {
    this.isExporting = isLoading;

    const btnHeader = document.getElementById("btn-export-excel");
    const btnToolbar = document.getElementById("btn-export-excel-toolbar");
    const navLink = document.getElementById("nav-export-link");

    const buttons = [btnHeader, btnToolbar].filter(Boolean);

    buttons.forEach((btn) => {
      if (isLoading) {
        btn.disabled = true;
        btn.setAttribute("data-original-html", btn.innerHTML);
        btn.innerHTML = `
          <div class="spinner" style="display: inline-block; width: 14px; height: 14px; border-width: 2px;"></div>
          <span>Exporting...</span>
        `;
      } else {
        btn.disabled = false;
        const orig = btn.getAttribute("data-original-html");
        if (orig) btn.innerHTML = orig;
      }
    });

    if (navLink) {
      if (isLoading) {
        navLink.style.pointerEvents = "none";
        navLink.style.opacity = "0.6";
      } else {
        navLink.style.pointerEvents = "";
        navLink.style.opacity = "";
      }
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
};

// Bind to window for global access
if (typeof window !== "undefined") {
  window.ExportService = ExportService;
}
