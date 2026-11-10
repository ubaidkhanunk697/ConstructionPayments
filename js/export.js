/**
 * CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
 * Excel Export Engine using SheetJS (xlsx)
 * Generates professional single-sheet styled financial workbooks
 */

const ExportService = {
  isExporting: false,

  /**
   * Generate Complete Excel Workbook and Binary Blob
   * Reused across Local Download and Google Drive Export
   */
  async generateExcelBlob() {
    if (typeof XLSX === "undefined") {
      throw new Error("SheetJS library is not loaded. Please verify your internet connection.");
    }

    // 1. Fetch ALL records directly from Supabase (not just filtered/visible ones)
    let materials = [];
    let payments = [];

    if (typeof CONFIG !== "undefined" && CONFIG.isConfigured() && typeof DB !== "undefined") {
      const [materialsData, paymentsData] = await Promise.all([
        DB.fetchMaterialRecords(),
        DB.fetchAllPaymentsForExport()
      ]);
      materials = materialsData || [];
      payments = paymentsData || [];
    } else if (typeof Dashboard !== "undefined") {
      materials = Dashboard.cachedMaterials || [];
      payments = Dashboard.cachedPayments || [];
    }

    // 2. Compute accurate financial aggregates across ALL fetched materials
    const summaryMetrics = this.computeSummaryMetrics(materials, payments);

    // 3. Build Single Worksheet: "Material Records"
    const wb = XLSX.utils.book_new();
    const wsMaterials = this.buildMaterialsWorksheet(materials, summaryMetrics);
    XLSX.utils.book_append_sheet(wb, wsMaterials, "Material Records");

    // 4. Generate timestamped filename
    const today = (typeof UI !== "undefined" && typeof UI.getTodayDateString === "function")
      ? UI.getTodayDateString()
      : new Date().toISOString().split("T")[0];
    const filename = `Construction_Financial_Report_${today}.xlsx`;

    // 5. Generate Binary Blob
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    return {
      wb,
      blob,
      filename,
      materialsCount: materials.length,
      paymentsCount: payments.length
    };
  },

  /**
   * Main Export Controller (Local File Download)
   */
  async exportToExcel() {
    if (this.isExporting) return; // Prevent concurrent export triggers

    this.setLoadingState(true);

    try {
      UI.showToast("Generating Excel spreadsheet...", "info", "Exporting Excel");

      const { wb, filename, materialsCount } = await this.generateExcelBlob();

      // Trigger download via SheetJS
      XLSX.writeFile(wb, filename);

      UI.showToast(
        `Successfully exported ${materialsCount} material record(s) to ${filename}`,
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
   * Helper: Parse Date String into Excel Serial Date / Formatted String dd-mmm-yy
   */
  parseDateValue(dateStr) {
    if (!dateStr) return { value: "", formatted: "" };
    try {
      const parts = String(dateStr).split("T")[0].split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          const dateObj = new Date(Date.UTC(year, month, day, 0, 0, 0));
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const dayStr = String(day).padStart(2, "0");
          const monthStr = months[month] || "Jan";
          const shortYear = String(year).slice(-2);
          const formatted = `${dayStr}-${monthStr}-${shortYear}`;
          return { value: dateObj, formatted };
        }
      }
    } catch (e) {
      // Fallback
    }
    return { value: String(dateStr), formatted: String(dateStr) };
  },

  /**
   * Build Single Worksheet: "Material Records"
   * Structure:
   *  Row 1 (idx 0): Summary Labels ("Total Due", "Total Paid", "Total Pending")
   *  Row 2 (idx 1): Aggregated numeric values from dataset
   *  Row 3 (idx 2): Clean Separator Row
   *  Row 4 (idx 3): Table Headers: ID, Date, Supplier, Material, Qty, Unit, Rate, Total, Paid, Pending, Notes
   *  Row 5+ (idx 4+): Data rows sorted chronologically (ID: 1, 2, 3...)
   */
  buildMaterialsWorksheet(materials = [], summaryMetrics = null) {
    const metrics = summaryMetrics || this.computeSummaryMetrics(materials, []);

    // 1. Construct Row Arrays (AOA)
    // Row 1: Top Summary Labels
    const rowSummaryLabels = ["Total Due", "Total Paid", "Total Pending", "", "", "", "", "", "", "", ""];

    // Row 2: Top Summary Numeric Values
    const rowSummaryValues = [
      Number(metrics.totalAmountDue) || 0,
      Number(metrics.totalPaid) || 0,
      Number(metrics.totalPending) || 0,
      "", "", "", "", "", "", "", ""
    ];

    // Row 3: Clean Separator Row
    const rowSeparator = ["", "", "", "", "", "", "", "", "", "", ""];

    // Row 4: Table Headers (Omit Day column; compact exact names)
    const tableHeaders = [
      "ID",
      "Date",
      "Supplier",
      "Material",
      "Qty",
      "Unit",
      "Rate",
      "Total",
      "Paid",
      "Pending",
      "Notes"
    ];

    const rows = [
      rowSummaryLabels,
      rowSummaryValues,
      rowSeparator,
      tableHeaders
    ];

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

    if (sortedMaterials.length === 0) {
      rows.push(["No material records recorded yet.", "", "", "", "", "", "", "", "", "", ""]);
    } else {
      sortedMaterials.forEach((m, index) => {
        const id = index + 1; // 1, 2, 3...
        const dateParsed = this.parseDateValue(m.purchase_date);
        const dateVal = dateParsed.value || "";
        const supplier = m.person_name || "Unassigned";
        const material = m.material_type || "General";
        const qty = (m.quantity !== null && m.quantity !== undefined && m.quantity !== "")
          ? Number(m.quantity)
          : "";
        const unit = m.unit || "";
        const totalDue = (m.total_due !== null && m.total_due !== undefined && m.total_due !== "")
          ? Number(m.total_due)
          : 0;
        const paid = Number(m.paid_amount) || 0;
        const pending = (m.pending_amount !== null && m.pending_amount !== undefined)
          ? Number(m.pending_amount)
          : Math.max(0, totalDue - paid);

        // Derive Rate: unit price if stored, or totalDue / qty
        let rate = "";
        if (m.rate !== null && m.rate !== undefined && m.rate !== "") {
          rate = Number(m.rate);
        } else if (m.unit_price !== null && m.unit_price !== undefined && m.unit_price !== "") {
          rate = Number(m.unit_price);
        } else if (typeof qty === "number" && qty > 0 && totalDue > 0) {
          rate = Math.round((totalDue / qty) * 100) / 100;
        }

        const notes = m.notes || "";

        rows.push([
          id,
          dateVal,
          supplier,
          material,
          qty,
          unit,
          rate,
          totalDue,
          paid,
          pending,
          notes
        ]);
      });
    }

    // 2. Convert to SheetJS Worksheet
    const ws = XLSX.utils.aoa_to_sheet(rows, { dateNF: "dd-mmm-yy", cellDates: true });
    ws._rows = rows;
    ws.tableHeaders = tableHeaders;

    // 3. Typography, Colors, Borders & Styles Definitions
    const COLOR_NAVY = "1F4E78";
    const COLOR_SOFT_BLUE = "DDEBF7";
    const COLOR_RED = "C00000";
    const COLOR_GREY_BORDER = "D9D9D9";
    const COLOR_WHITE = "FFFFFF";

    const fontBase = { name: "Arial", sz: 10 };
    const fontHeader = { name: "Arial", sz: 10, bold: true, color: { rgb: COLOR_WHITE } };
    const fontSummary = { name: "Arial", sz: 10, bold: true, color: { rgb: COLOR_NAVY } };
    const fontPendingRed = { name: "Arial", sz: 10, bold: true, color: { rgb: COLOR_RED } };

    const fillHeader = { fgColor: { rgb: COLOR_NAVY }, patternType: "solid" };
    const fillSummary = { fgColor: { rgb: COLOR_SOFT_BLUE }, patternType: "solid" };

    const borderThinGrey = {
      top: { style: "thin", color: { rgb: COLOR_GREY_BORDER } },
      bottom: { style: "thin", color: { rgb: COLOR_GREY_BORDER } },
      left: { style: "thin", color: { rgb: COLOR_GREY_BORDER } },
      right: { style: "thin", color: { rgb: COLOR_GREY_BORDER } }
    };

    const borderHeader = {
      top: { style: "thin", color: { rgb: COLOR_NAVY } },
      bottom: { style: "medium", color: { rgb: COLOR_NAVY } },
      left: { style: "thin", color: { rgb: "2F5597" } },
      right: { style: "thin", color: { rgb: "2F5597" } }
    };

    const borderSummary = {
      top: { style: "thin", color: { rgb: "B4C6E7" } },
      bottom: { style: "thin", color: { rgb: "B4C6E7" } },
      left: { style: "thin", color: { rgb: "B4C6E7" } },
      right: { style: "thin", color: { rgb: "B4C6E7" } }
    };

    // 4. Apply Cell Styling, Formats & Alignments
    const decodeRange = (ref) => {
      if (typeof XLSX !== "undefined" && XLSX.utils && typeof XLSX.utils.decode_range === "function") {
        return XLSX.utils.decode_range(ref);
      }
      return { s: { c: 0, r: 0 }, e: { c: 10, r: rows.length - 1 } };
    };

    const encodeCell = (coord) => {
      if (typeof XLSX !== "undefined" && XLSX.utils && typeof XLSX.utils.encode_cell === "function") {
        return XLSX.utils.encode_cell(coord);
      }
      const colLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      return (colLetters[coord.c] || "A") + (coord.r + 1);
    };

    const range = decodeRange(ws["!ref"] || "A1:K4");
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = encodeCell({ r: R, c: C });
        let cell = ws[cellRef];
        if (!cell) {
          if (R === 0 || R === 1 || R === 3 || R >= 4) {
            cell = { t: "s", v: "" };
            ws[cellRef] = cell;
          } else {
            continue;
          }
        }

        cell.s = cell.s || {};

        // Row 1 (idx 0): Summary Section Labels
        if (R === 0) {
          if (C <= 2) {
            cell.s = {
              font: fontSummary,
              fill: fillSummary,
              alignment: { horizontal: "center", vertical: "center" },
              border: borderSummary
            };
          }
        }

        // Row 2 (idx 1): Summary Section Numeric Values
        else if (R === 1) {
          if (C <= 2) {
            cell.t = "n";
            cell.z = "#,##0";
            cell.s = {
              font: fontSummary,
              fill: fillSummary,
              alignment: { horizontal: "center", vertical: "center" },
              border: borderSummary
            };
          }
        }

        // Row 3 (idx 2): Clean Separator Row
        else if (R === 2) {
          // Keep empty without heavy borders
        }

        // Row 4 (idx 3): Table Header Row
        else if (R === 3) {
          const isNumHeader = (C === 4 || C === 6 || C === 7 || C === 8 || C === 9);
          const isCenterHeader = (C === 0 || C === 1 || C === 5);
          cell.s = {
            font: fontHeader,
            fill: fillHeader,
            alignment: {
              horizontal: isNumHeader ? "right" : (isCenterHeader ? "center" : "left"),
              vertical: "center",
              wrapText: true
            },
            border: borderHeader
          };
        }

        // Row 5+ (idx 4+): Main Table Data Rows
        else if (R >= 4) {
          cell.s.font = { ...fontBase };
          cell.s.border = borderThinGrey;

          // Alignments & Number Formats per Column
          switch (C) {
            case 0: // ID
              cell.s.alignment = { horizontal: "center", vertical: "center" };
              if (cell.v !== "") { cell.t = "n"; cell.z = "0"; }
              break;

            case 1: // Date
              cell.s.alignment = { horizontal: "center", vertical: "center" };
              cell.z = "dd-mmm-yy";
              break;

            case 2: // Supplier
              cell.s.alignment = { horizontal: "left", vertical: "center" };
              break;

            case 3: // Material
              cell.s.alignment = { horizontal: "left", vertical: "center" };
              break;

            case 4: // Qty
              cell.s.alignment = { horizontal: "right", vertical: "center" };
              if (typeof cell.v === "number") {
                cell.t = "n";
                cell.z = (cell.v % 1 !== 0) ? "#,##0.00" : "#,##0";
              }
              break;

            case 5: // Unit
              cell.s.alignment = { horizontal: "center", vertical: "center" };
              break;

            case 6: // Rate
              cell.s.alignment = { horizontal: "right", vertical: "center" };
              if (typeof cell.v === "number") {
                cell.t = "n";
                cell.z = (cell.v % 1 !== 0) ? "#,##0.00" : "#,##0";
              }
              break;

            case 7: // Total
              cell.s.alignment = { horizontal: "right", vertical: "center" };
              if (typeof cell.v === "number") {
                cell.t = "n";
                cell.z = "#,##0";
              }
              break;

            case 8: // Paid
              cell.s.alignment = { horizontal: "right", vertical: "center" };
              if (typeof cell.v === "number") {
                cell.t = "n";
                cell.z = "#,##0";
              }
              break;

            case 9: // Pending
              cell.s.alignment = { horizontal: "right", vertical: "center" };
              if (typeof cell.v === "number") {
                cell.t = "n";
                cell.z = "#,##0";
                if (cell.v > 0) {
                  cell.s.font = fontPendingRed; // Highlight pending balance text in red
                }
              }
              break;

            case 10: // Notes
              cell.s.alignment = { horizontal: "left", vertical: "center", wrapText: true };
              break;
          }
        }
      }
    }

    // 5. Freeze Panes: Freeze above data rows (ySplit = 4)
    ws["!freeze"] = { xSplit: 0, ySplit: 4 };
    ws["!views"] = [{ state: "frozen", ySplit: 4, xSplit: 0 }];

    // 6. AutoFilter: Enable on the Table Header Row (Row 4, index 3)
    const lastRowIndex = Math.max(rows.length, 4);
    ws["!autofilter"] = {
      ref: `A4:K${lastRowIndex}`
    };

    // 7. Column Widths (Exact specifications)
    ws["!cols"] = [
      { wch: 6 },  // ID: ~6
      { wch: 11 }, // Date: ~11
      { wch: 16 }, // Supplier: ~16
      { wch: 16 }, // Material: ~16
      { wch: 8 },  // Qty: ~8
      { wch: 6 },  // Unit: ~6
      { wch: 10 }, // Rate: ~10
      { wch: 12 }, // Total: ~12
      { wch: 12 }, // Paid: ~12
      { wch: 12 }, // Pending: ~12
      { wch: 26 }  // Notes: ~26 (wrapText: true)
    ];

    // 8. Row Heights (Summary/Header ~20-22pt, Separator 10pt, Data 15pt default)
    const rowHeights = [
      { hpt: 20 }, // Row 1: Summary Labels
      { hpt: 20 }, // Row 2: Summary Numeric Values
      { hpt: 10 }, // Row 3: Separator Row
      { hpt: 22 }  // Row 4: Table Headers
    ];
    for (let r = 4; r < rows.length; r++) {
      rowHeights.push({ hpt: 15 }); // Standard rows: 15pt
    }
    ws["!rows"] = rowHeights;

    // 9. Page Setup & Printing: Landscape, fitToWidth: 1, fitToHeight: 0
    ws["!pageSetup"] = {
      orientation: "landscape",
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9
    };
    ws["!sheetPr"] = {
      pageSetUpPr: {
        fitToPage: true
      }
    };
    ws["!sheetFormat"] = {
      defaultRowHeight: 15
    };

    return ws;
  },

  /**
   * Helper: Payments Worksheet generator (retained for backward compatibility)
   */
  buildPaymentsWorksheet(payments = [], materialIdMap = {}) {
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
      const sortedPayments = [...payments].sort((a, b) => {
        const timeA = a.payment_date || a.created_at || "";
        const timeB = b.payment_date || b.created_at || "";
        return timeA.localeCompare(timeB);
      });

      sortedPayments.forEach((p, idx) => {
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
    ws._rows = rows;
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    ws["!views"] = [{ state: "frozen", ySplit: 1 }];
    ws["!cols"] = [
      { wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 18 },
      { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 35 }
    ];
    return ws;
  },

  /**
   * Helper: Summary Worksheet generator (retained for backward compatibility)
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
    ws._rows = rows;
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
  computeSummaryMetrics(materials, payments = []) {
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
