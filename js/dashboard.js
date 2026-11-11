/**
 * CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
 * Dashboard Controller, Live Data Hydration, Skeletons & Chart Analytics
 */

const Dashboard = {
  isLoading: false,
  chartInstance: null,
  cachedMaterials: [],
  cachedPayments: [],
  cachedSummary: null,

  /**
   * Initialize Dashboard
   */
  async init() {
    this.setupFiltersAndSorting();
    await this.load();
  },

  /**
   * Load actual Supabase data and refresh all components
   */
  async load() {
    if (this.isLoading) return; // Prevent duplicate requests
    this.isLoading = true;

    this.showSkeletons();

    try {
      // Populate Material Type filter dropdown if empty
      const filterTypeSelect = document.getElementById("filter-material-type");
      if (filterTypeSelect && filterTypeSelect.options.length <= 1 && typeof CONFIG !== "undefined") {
        CONFIG.populateMaterialTypeDropdown(filterTypeSelect, "", true);
      }

      // Fetch data in parallel (from Supabase if connected, or local demo store)
      const [materials, recentPayments, topPending] = await Promise.all([
        DB.fetchMaterialRecords(),
        DB.fetchRecentPayments(5),
        DB.fetchTopPendingMaterials(5)
      ]);

      this.cachedMaterials = materials || [];
      this.cachedPayments = recentPayments || [];

      // Compute exact metrics according to financial rules
      const summary = this.computeMetrics(this.cachedMaterials);
      this.cachedSummary = summary;

      // Render all sections
      this.renderSummaryCards(summary);
      this.applyFiltersAndSort();
      this.renderRecentPayments(this.cachedPayments);
      this.renderTopPending(topPending);
      this.renderMonthlyChart(this.cachedMaterials);

    } catch (err) {
      console.error("Dashboard data load error:", err);
      this.renderErrorState(err.message || "Failed to retrieve project records from database.");
    } finally {
      this.isLoading = false;
      this.hideSkeletons();
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
  },

  /**
   * Compute exact metrics adhering strictly to:
   * 1. Total Amount Due: Sum of available Total Due values
   * 2. Total Paid: Sum of all payment transactions
   * 3. Total Pending: Sum of outstanding balances for records with a known Total Due
   * 4. Total Material Records: Count of all material records
   * 5. Records without Total Due are NOT treated as having zero pending debt!
   */
  computeMetrics(materials) {
    let totalDue = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let unsetTotalDueCount = 0;

    for (const record of materials) {
      const recordDue = record.total_due !== null && record.total_due !== undefined ? Number(record.total_due) : null;
      const recordPaid = Number(record.paid_amount) || 0;

      totalPaid += recordPaid;

      if (recordDue !== null) {
        totalDue += recordDue;
        const pending = recordDue - recordPaid;
        if (pending > 0) {
          totalPending += pending;
        }
      } else {
        // Record total due is unset / unknown
        unsetTotalDueCount++;
      }
    }

    return {
      totalAmountDue: totalDue,
      totalPaid: totalPaid,
      totalPending: totalPending,
      totalRecords: materials.length,
      unsetTotalDueCount
    };
  },

  /**
   * Display loading skeletons across summary cards and tables
   */
  showSkeletons() {
    const totalDueEl = document.getElementById("metric-total-due");
    const totalPaidEl = document.getElementById("metric-total-paid");
    const totalPendingEl = document.getElementById("metric-total-pending");
    const totalRecordsEl = document.getElementById("metric-total-records");

    if (totalDueEl) totalDueEl.innerHTML = `<span class="skeleton skeleton-value"></span>`;
    if (totalPaidEl) totalPaidEl.innerHTML = `<span class="skeleton skeleton-value"></span>`;
    if (totalPendingEl) totalPendingEl.innerHTML = `<span class="skeleton skeleton-value"></span>`;
    if (totalRecordsEl) totalRecordsEl.innerHTML = `<span class="skeleton skeleton-value" style="width: 60px;"></span>`;
  },

  hideSkeletons() {
    // Skeletons are replaced automatically when elements receive real data
  },

  /**
   * Render 4 Summary Metric Cards
   */
  renderSummaryCards(summary) {
    const totalDueEl = document.getElementById("metric-total-due");
    const totalPaidEl = document.getElementById("metric-total-paid");
    const totalPendingEl = document.getElementById("metric-total-pending");
    const totalRecordsEl = document.getElementById("metric-total-records");

    if (totalDueEl) {
      totalDueEl.textContent = UI.formatPKR(summary.totalAmountDue);
      if (summary.unsetTotalDueCount > 0) {
        totalDueEl.title = `${summary.unsetTotalDueCount} record(s) have unspecified total due amounts`;
      }
    }

    if (totalPaidEl) {
      totalPaidEl.textContent = UI.formatPKR(summary.totalPaid);
    }

    if (totalPendingEl) {
      totalPendingEl.textContent = UI.formatPKR(summary.totalPending);
      if (summary.unsetTotalDueCount > 0) {
        totalPendingEl.title = `Excludes ${summary.unsetTotalDueCount} record(s) with unset total due`;
      }
    }

    if (totalRecordsEl) {
      totalRecordsEl.textContent = summary.totalRecords;
    }
  },

  /**
   * Render Material Records (Desktop Table & Mobile Responsive Cards)
   */
  renderMaterialRecords(materials) {
    const tableBody = document.getElementById("materials-table-body");
    const mobileCards = document.getElementById("materials-mobile-cards");
    const emptyState = document.getElementById("materials-empty-state");

    if (!materials || materials.length === 0) {
      if (tableBody) tableBody.innerHTML = "";
      if (mobileCards) mobileCards.innerHTML = "";
      if (emptyState) emptyState.classList.remove("hidden");
      return;
    }

    if (emptyState) emptyState.classList.add("hidden");

    // 1. Desktop Table Rows
    if (tableBody) {
      tableBody.innerHTML = materials.map((m) => {
        const totalDueText = m.total_due !== null ? UI.formatPKR(m.total_due) : `<span class="text-dim">Unset</span>`;
        const pendingText = m.pending_amount !== null ? UI.formatPKR(m.pending_amount) : `<span class="text-dim">Unset</span>`;
        const statusBadge = this.getStatusBadgeHTML(m.payment_status, m.pending_amount, m.total_due, m.paid_amount);
        const quantityText = m.quantity ? `${m.quantity} ${m.unit || ""}` : `<span class="text-dim">--</span>`;
        const dateText = m.purchase_date || "--";
        const dayText = m.purchase_day || "";

        return `
          <tr data-record-id="${m.id}">
            <td class="col-date">
              <div style="font-weight: var(--font-weight-medium); white-space: nowrap;">${dateText}</div>
              <div style="font-size: 11px; color: var(--color-text-dim); white-space: nowrap;">${dayText}</div>
            </td>
            <td class="col-person">
              <div class="table-person-name" title="${this.escapeHTML(m.person_name || 'Unassigned')}">${this.escapeHTML(m.person_name || "Unassigned")}</div>
              ${m.notes ? `<div class="table-person-notes" title="${this.escapeHTML(m.notes)}">${this.escapeHTML(m.notes)}</div>` : ""}
            </td>
            <td class="col-material">
              <span class="badge badge-unit table-material-badge" title="${this.escapeHTML(m.material_type || 'General')}">${this.escapeHTML(m.material_type || "General")}</span>
            </td>
            <td class="col-quantity">${quantityText}</td>
            <td class="col-due text-right text-total-due tabular-nums">${totalDueText}</td>
            <td class="col-paid text-right text-paid tabular-nums">${UI.formatPKR(m.paid_amount)}</td>
            <td class="col-pending text-right text-pending tabular-nums">${pendingText}</td>
            <td class="col-status text-center">${statusBadge}</td>
            <td class="col-actions text-right">
              <div class="table-actions justify-end" style="flex-wrap: wrap; gap: 4px;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="Dashboard.handleOpenAddPayment('${m.id}')" title="Record payment" style="color: var(--color-paid); font-weight: var(--font-weight-medium);">
                  <i data-lucide="plus" style="width: 12px; height: 12px;"></i>
                  <span>Pay</span>
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="Dashboard.handleOpenPaymentHistory('${m.id}')" title="Payment history">
                  <i data-lucide="receipt" style="width: 12px; height: 12px;"></i>
                  <span>History</span>
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="Dashboard.handleOpenEdit('${m.id}')" title="Edit record" aria-label="Edit record">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  <span>Edit</span>
                </button>
                ${m.receipt_url ? `
                <button type="button" class="btn btn-secondary btn-sm btn-view-receipt" onclick="Dashboard.handleViewReceipt('${encodeURIComponent(m.receipt_url)}', '${this.escapeHTML(m.person_name || 'Receipt')}')" title="View Receipt / Invoice" style="color: var(--color-primary); font-weight: var(--font-weight-medium);">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  <span>View</span>
                </button>
                ` : `
                <button type="button" class="btn btn-secondary btn-sm" disabled title="No receipt attached" style="opacity: 0.45; cursor: not-allowed;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  <span>View</span>
                </button>
                `}
              </div>
            </td>
          </tr>
        `;
      }).join("");
    }

    // 2. Mobile Responsive Record Cards
    if (mobileCards) {
      mobileCards.innerHTML = materials.map((m) => {
        const totalDueText = m.total_due !== null ? UI.formatPKR(m.total_due) : "Unset";
        const pendingText = m.pending_amount !== null ? UI.formatPKR(m.pending_amount) : "Unset";
        const statusBadge = this.getStatusBadgeHTML(m.payment_status, m.pending_amount, m.total_due, m.paid_amount);

        return `
          <div class="mobile-record-card" data-record-id="${m.id}">
            <div class="mobile-card-header">
              <div>
                <div class="mobile-card-title">${this.escapeHTML(m.person_name || "Unassigned")}</div>
                <div class="mobile-card-subtitle">${this.escapeHTML(m.material_type || "Material")} &bull; ${m.quantity ? `${m.quantity} ${m.unit || ''}` : 'Quantity unstated'}</div>
              </div>
              <div>${statusBadge}</div>
            </div>

            <div class="mobile-card-financials">
              <div class="mobile-fin-item">
                <span class="mobile-fin-label">Total Due</span>
                <span class="mobile-fin-value text-total-due">${totalDueText}</span>
              </div>
              <div class="mobile-fin-item">
                <span class="mobile-fin-label">Paid</span>
                <span class="mobile-fin-value text-paid">${UI.formatPKR(m.paid_amount)}</span>
              </div>
              <div class="mobile-fin-item">
                <span class="mobile-fin-label">Pending</span>
                <span class="mobile-fin-value text-pending">${pendingText}</span>
              </div>
            </div>

            <div class="mobile-card-actions" style="flex-wrap: wrap; gap: var(--space-2);">
              <span style="font-size: 11px; color: var(--color-text-dim); margin-right: auto; width: 100%; margin-bottom: 2px;">
                ${m.purchase_date || ''} (${m.purchase_day || ''})
              </span>
              <button type="button" class="btn btn-secondary btn-sm" onclick="Dashboard.handleOpenAddPayment('${m.id}')" style="color: var(--color-paid); font-weight: var(--font-weight-medium);">
                <i data-lucide="plus" style="width: 13px; height: 13px;"></i>
                Pay
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="Dashboard.handleOpenPaymentHistory('${m.id}')">
                <i data-lucide="receipt" style="width: 13px; height: 13px;"></i>
                History
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="Dashboard.handleOpenEdit('${m.id}')">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px;"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                Edit
              </button>
              ${m.receipt_url ? `
              <button type="button" class="btn btn-secondary btn-sm" onclick="Dashboard.handleViewReceipt('${encodeURIComponent(m.receipt_url)}', '${this.escapeHTML(m.person_name || 'Receipt')}')" style="color: var(--color-primary); font-weight: var(--font-weight-medium);">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px;"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                View
              </button>
              ` : `
              <button type="button" class="btn btn-secondary btn-sm" disabled style="opacity: 0.45; cursor: not-allowed;">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px;"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                View
              </button>
              `}
            </div>
          </div>
        `;
      }).join("");
    }
  },

  /**
   * Render Recent Payments Feed in Payment Overview Card
   */
  renderRecentPayments(payments) {
    const container = document.getElementById("recent-payments-container");
    if (!container) return;

    if (!payments || payments.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: var(--space-6) var(--space-2);">
          <i data-lucide="receipt" style="width: 28px; height: 28px; color: var(--color-text-dim); margin-bottom: var(--space-2);"></i>
          <span style="font-size: var(--font-size-xs); color: var(--color-text-muted);">No payment transactions recorded yet.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="activity-list">
        ${payments.map((p) => {
          const materialName = p.material_records?.person_name
            ? `${p.material_records.person_name} (${p.material_records.material_type || 'Material'})`
            : "Material Record";

          return `
            <div class="activity-item">
              <div class="activity-left">
                <div class="activity-icon">
                  <i data-lucide="check" style="width: 16px; height: 16px;"></i>
                </div>
                <div>
                  <div class="activity-title">${this.escapeHTML(materialName)}</div>
                  <div class="activity-subtitle">${p.payment_date || '--'} &bull; ${p.payment_method || 'Cash'}</div>
                </div>
              </div>
              <div class="activity-right">
                <div class="activity-amount">${UI.formatPKR(p.amount)}</div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  },

  /**
   * Render Top Pending Balances Ranking in Pending Overview Card
   */
  renderTopPending(topPending) {
    const container = document.getElementById("pending-payments-container");
    if (!container) return;

    if (!topPending || topPending.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: var(--space-6) var(--space-2);">
          <i data-lucide="wallet" style="width: 28px; height: 28px; color: var(--color-paid); margin-bottom: var(--space-2);"></i>
          <span style="font-size: var(--font-size-xs); color: var(--color-paid); font-weight: var(--font-weight-medium);">
            Zero outstanding debt! All balances are fully cleared.
          </span>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="pending-rank-list">
        ${topPending.map((item) => {
          const totalDue = Number(item.total_due) || 0;
          const paid = Number(item.paid_amount) || 0;
          const pending = Number(item.pending_amount) || 0;
          const paidPercent = totalDue > 0 ? Math.min(100, Math.round((paid / totalDue) * 100)) : 0;
          const pendingPercent = 100 - paidPercent;

          return `
            <div class="pending-rank-item">
              <div class="pending-rank-header">
                <span class="pending-rank-name">${this.escapeHTML(item.person_name || 'Unassigned')} (${item.material_type || 'Material'})</span>
                <span class="pending-rank-amount">${UI.formatPKR(pending)}</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill-paid" style="width: ${paidPercent}%;"></div>
                <div class="progress-fill-pending" style="width: ${pendingPercent}%;"></div>
              </div>
              <div class="progress-labels">
                <span>Paid: ${paidPercent}%</span>
                <span>Outstanding: ${UI.formatPKR(pending)}</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  },

  /**
   * Render Monthly Expenditure Trend using Chart.js
   */
  renderMonthlyChart(materials) {
    const canvas = document.getElementById("monthly-chart-canvas");
    if (!canvas || typeof Chart === "undefined") return;

    // Group materials by Year-Month
    const monthlyMap = {};

    for (const m of materials) {
      const dateStr = m.purchase_date || m.created_at;
      if (!dateStr) continue;

      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) continue;

      const monthKey = dateObj.toLocaleDateString("en-US", { year: "numeric", month: "short" });

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { due: 0, paid: 0 };
      }

      if (m.total_due !== null) {
        monthlyMap[monthKey].due += Number(m.total_due);
      }
      monthlyMap[monthKey].paid += Number(m.paid_amount || 0);
    }

    const labels = Object.keys(monthlyMap);
    if (labels.length === 0) {
      // Empty or single point
      labels.push(new Date().toLocaleDateString("en-US", { year: "numeric", month: "short" }));
      monthlyMap[labels[0]] = { due: 0, paid: 0 };
    }

    const dueData = labels.map((k) => monthlyMap[k].due);
    const paidData = labels.map((k) => monthlyMap[k].paid);

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const ctx = canvas.getContext("2d");
    this.chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Total Due (PKR)",
            data: dueData,
            backgroundColor: "rgba(37, 99, 235, 0.75)",
            borderColor: "rgb(37, 99, 235)",
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: "Paid Amount (PKR)",
            data: paidData,
            backgroundColor: "rgba(22, 163, 74, 0.75)",
            borderColor: "rgb(22, 163, 74)",
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: {
              boxWidth: 12,
              font: { family: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif", size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const label = context.dataset.label || "";
                const val = context.parsed.y !== null ? context.parsed.y : 0;
                return `${label}: Rs. ${val.toLocaleString("en-PK")}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return "Rs. " + Number(value).toLocaleString("en-PK");
              }
            }
          }
        }
      }
    });
  },

  /**
   * Helper: Status Badge HTML (Automatically turns Paid Green when transaction is complete)
   */
  getStatusBadgeHTML(status, pendingAmount, totalDue, paidAmount) {
    const numPending = pendingAmount !== undefined && pendingAmount !== null ? Number(pendingAmount) : null;
    const numDue = totalDue !== undefined && totalDue !== null ? Number(totalDue) : null;
    const numPaid = paidAmount !== undefined && paidAmount !== null ? Number(paidAmount) : 0;

    // Fully Paid Condition:
    // When pending balance is 0 and total due is known, or paid amount equals/exceeds total due
    const isPaid = status === "Paid" || 
      (numDue !== null && numDue > 0 && numPending === 0) ||
      (numDue !== null && numDue > 0 && numPaid >= numDue) ||
      (numDue === 0 && numPending === 0);

    if (isPaid) {
      return `<span class="badge badge-paid"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>Paid</span>`;
    }

    // Partially Paid Condition
    const isPartial = status === "Partial" || (numPaid > 0 && (numPending === null || numPending > 0));
    if (isPartial) {
      return `<span class="badge badge-partial"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Partial</span>`;
    }

    if (status === "Unset" || numDue === null) {
      return `<span class="badge badge-unit">Unset</span>`;
    }

    return `<span class="badge badge-pending"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>Pending</span>`;
  },

  /**
   * Setup Search, Payment Status Filter, Material Filter, and Sort Controls
   */
  setupFiltersAndSorting() {
    const searchInput = document.getElementById("filter-search-input");
    const typeSelect = document.getElementById("filter-material-type");
    const statusSelect = document.getElementById("statusFilter") || document.getElementById("filter-status");
    const sortSelect = document.getElementById("filter-sort");
    const resetBtn = document.getElementById("btn-reset-filters");

    if (searchInput) searchInput.addEventListener("input", () => this.applyFiltersAndSort());
    if (typeSelect) typeSelect.addEventListener("change", () => this.applyFiltersAndSort());
    if (statusSelect) statusSelect.addEventListener("change", () => this.applyFiltersAndSort());
    if (sortSelect) sortSelect.addEventListener("change", () => this.applyFiltersAndSort());

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        if (typeSelect) typeSelect.value = "";
        if (statusSelect) statusSelect.value = "all";
        if (sortSelect) sortSelect.value = "newest";
        this.applyFiltersAndSort();
      });
    }
  },

  /**
   * Filter and Sort Material Records
   */
  applyFiltersAndSort() {
    if (!this.cachedMaterials) return;

    const query = (document.getElementById("filter-search-input")?.value || "").toLowerCase().trim();
    const selectedType = document.getElementById("filter-material-type")?.value || "";
    const selectedStatus = (
      document.getElementById("statusFilter")?.value ||
      document.getElementById("filter-status")?.value ||
      "all"
    ).toLowerCase();
    const sortOrder = document.getElementById("filter-sort")?.value || "newest";

    let filtered = this.cachedMaterials.filter((m) => {
      // 1. Text Search across Person Name and Notes
      if (query) {
        const person = (m.person_name || "").toLowerCase();
        const mat = (m.material_type || "").toLowerCase();
        const notes = (m.notes || "").toLowerCase();
        if (!person.includes(query) && !mat.includes(query) && !notes.includes(query)) {
          return false;
        }
      }

      // 2. Material Type Filter
      if (selectedType && m.material_type !== selectedType) {
        return false;
      }

      // 3. Payment Status Filter ("all", "paid", "pending")
      const due = m.total_due !== null && m.total_due !== undefined ? Number(m.total_due) : null;
      const paid = Number(m.paid_amount) || 0;
      const pending = m.pending_amount !== null && m.pending_amount !== undefined
        ? Number(m.pending_amount)
        : (due !== null ? Math.max(0, due - paid) : 0);

      if (selectedStatus === "paid") {
        // Paid: pending balance is 0 or paid equals/exceeds total due
        const isPaid = (m.pending_amount !== null && Number(m.pending_amount) <= 0 && due !== null) ||
                       (due !== null && paid >= due);
        if (!isPaid) return false;
      } else if (selectedStatus === "pending") {
        // Pending / Partial: pending balance is greater than 0
        const isPending = (m.pending_amount !== null && Number(m.pending_amount) > 0) ||
                          (due !== null && due > paid);
        if (!isPending) return false;
      }

      return true;
    });

    // 4. Sort Records
    filtered.sort((a, b) => {
      const dateA = new Date(a.purchase_date || a.created_at || 0).getTime();
      const dateB = new Date(b.purchase_date || b.created_at || 0).getTime();
      if (sortOrder === "oldest") {
        return dateA - dateB;
      }
      return dateB - dateA; // newest first
    });

    // Cache the active filtered dataset so exports and actions reflect on-screen rows
    this.filteredMaterials = filtered;

    // Update filter counter badge
    const countBadge = document.getElementById("filtered-records-count");
    if (countBadge) {
      if (filtered.length === this.cachedMaterials.length) {
        countBadge.textContent = `${this.cachedMaterials.length} record(s)`;
      } else {
        countBadge.textContent = `${filtered.length} of ${this.cachedMaterials.length} record(s)`;
      }
    }

    this.renderMaterialRecords(filtered);
    if (window.lucide) window.lucide.createIcons();
  },

  /**
   * Render Empty Dashboard state when database has 0 items
   */
  renderEmptyDashboard() {
    this.renderSummaryCards({
      totalAmountDue: 0,
      totalPaid: 0,
      totalPending: 0,
      totalRecords: 0,
      unsetTotalDueCount: 0
    });
    this.renderMaterialRecords([]);
    this.renderRecentPayments([]);
    this.renderTopPending([]);
  },

  /**
   * Render Friendly Error State
   */
  renderErrorState(errorMessage) {
    const container = document.getElementById("dashboard-alert-banner");
    if (!container) return;

    container.innerHTML = `
      <div class="card" style="margin-bottom: var(--space-6); background: var(--color-pending-subtle); border: 1px solid var(--color-pending-border); padding: var(--space-4);">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-3">
            <i data-lucide="alert-triangle" style="color: var(--color-pending); width: 20px; height: 20px; flex-shrink: 0; margin-top: 2px;"></i>
            <div>
              <strong style="color: var(--color-pending-hover); font-size: var(--font-size-sm); display: block; margin-bottom: 2px;">
                Unable to Load Project Records
              </strong>
              <p style="color: var(--color-text-main); font-size: var(--font-size-xs); margin: 0;">
                ${this.escapeHTML(errorMessage)}
              </p>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="Dashboard.load()">
            <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i>
            Retry
          </button>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  },

  /**
   * Open Edit Handler (Dispatches to Phase 5 CRUD engine)
   */
  handleOpenEdit(recordId) {
    const record = this.cachedMaterials.find((m) => m.id === recordId);
    if (!record) return;

    // Prepopulate modal form
    const personInput = document.getElementById("material-person");
    const typeSelect = document.getElementById("material-type");
    const quantityInput = document.getElementById("material-quantity");
    const unitSelect = document.getElementById("material-unit-select");
    const customUnitInput = document.getElementById("material-custom-unit");
    const customUnitGroup = document.getElementById("custom-unit-group");
    const totalAmountInput = document.getElementById("material-total-amount");
    const paidAmountInput = document.getElementById("material-paid-amount");
    const dateInput = document.getElementById("material-date");
    const dayInput = document.getElementById("material-day");
    const modalTitle = document.getElementById("material-form-title");
    const submitBtn = document.getElementById("btn-submit-material-form");

    if (personInput) personInput.value = record.person_name || "";
    if (typeSelect) typeSelect.value = record.material_type || "";
    if (quantityInput) quantityInput.value = record.quantity !== null && record.quantity !== undefined ? record.quantity : "";
    if (unitSelect) unitSelect.value = record.unit || "";
    if (customUnitGroup) customUnitGroup.classList.add("hidden");

    if (totalAmountInput) totalAmountInput.value = (record.total_due !== null && record.total_due !== undefined) ? record.total_due : "";
    if (paidAmountInput) paidAmountInput.value = (record.paid_amount !== null && record.paid_amount !== undefined) ? record.paid_amount : "";

    // Trigger auto-calculation of pending balance
    if (typeof UI !== "undefined" && typeof UI.updatePendingCalculation === "function") {
      UI.updatePendingCalculation();
    }
    if (dateInput) {
      dateInput.value = record.purchase_date || UI.getTodayDateString();
      if (dayInput) dayInput.value = UI.getDayName(dateInput.value);
    }
    const notesInput = document.getElementById("material-notes");
    if (notesInput) notesInput.value = record.notes || "";

    if (modalTitle) modalTitle.textContent = "Edit Material Record";
    const submitText = document.getElementById("btn-submit-material-text");
    if (submitText) {
      submitText.textContent = "Save Changes";
    } else if (submitBtn) {
      submitBtn.textContent = "Save Changes";
    }

    // Attach target record id to form
    const form = document.getElementById("material-record-form");
    if (form) {
      form.setAttribute("data-edit-id", record.id);
      form.setAttribute("data-existing-receipt-url", record.receipt_url || "");
    }

    // Set receipt preview if existing receipt is present
    const receiptFileInput = document.getElementById("receiptFileInput");
    const previewContainer = document.getElementById("receipt-preview-container");
    const previewImg = document.getElementById("receipt-preview-img");
    const fileNameEl = document.getElementById("receipt-file-name");
    const fileSizeEl = document.getElementById("receipt-file-size");
    if (receiptFileInput) receiptFileInput.value = "";

    if (record.receipt_url && previewContainer && previewImg) {
      previewImg.src = record.receipt_url;
      if (fileNameEl) fileNameEl.textContent = "Existing Receipt";
      if (fileSizeEl) fileSizeEl.textContent = "Saved in Cloud Storage";
      previewContainer.style.display = "flex";
    } else if (previewContainer) {
      previewContainer.style.display = "none";
    }

    // Show delete option in modal footer for existing records
    const deleteBtn = document.getElementById("btn-delete-material-record");
    if (deleteBtn) {
      deleteBtn.classList.remove("hidden");
      deleteBtn.onclick = () => {
        UI.closeModal("modal-material-form");
        Dashboard.handleOpenDelete(record.id);
      };
    }

    UI.openModal("modal-material-form");
  },

  /**
   * View Receipt Image in Modal
   */
  handleViewReceipt(encodedUrl, personName) {
    const url = decodeURIComponent(encodedUrl);
    const img = document.getElementById("receipt-view-image");
    const subtitle = document.getElementById("receipt-view-subtitle");
    const downloadLink = document.getElementById("receipt-view-download-link");

    if (img) img.src = url;
    if (subtitle) {
      subtitle.textContent = (personName && personName !== "Unassigned")
        ? `Invoice / Receipt for ${personName}`
        : "High-resolution verification";
    }
    if (downloadLink) downloadLink.href = url;

    UI.openModal("modal-receipt-view");
    if (window.lucide) window.lucide.createIcons();
  },

  /**
   * Open Delete Handler (Dispatches to Phase 5 Deletion Safety engine)
   */
  async handleOpenDelete(recordId) {
    const record = this.cachedMaterials.find((m) => m.id === recordId);
    if (!record) return;

    try {
      // Query deletion impact to inspect existing payments
      const impact = await DB.getDeletionImpact(recordId);

      UI.showDeleteConfirmation(
        {
          personName: record.person_name || "Unassigned",
          materialType: record.material_type || "Material",
          quantity: record.quantity,
          unit: record.unit,
          totalAmount: record.total_due,
          paidAmount: record.paid_amount,
          pendingAmount: record.pending_amount,
          recordId: record.id,
          hasPayments: impact.has_payments,
          paymentCount: impact.payment_count,
          totalPaid: impact.total_paid
        },
        async () => {
          try {
            UI.showToast("Deleting record...", "info", "Processing");
            await DB.deleteMaterialRecordExplicit(recordId, impact.has_payments);
            UI.showToast("Material record successfully deleted.", "success", "Deleted");
            await Dashboard.load(); // Refresh dashboard
          } catch (err) {
            console.error("Delete error:", err);
            UI.showToast(err.message || "Failed to delete record.", "error", "Delete Failed");
          }
        },
        () => {
          // Cancelled - do nothing
          UI.showToast("Deletion cancelled. No changes made.", "info", "Cancelled");
        }
      );
    } catch (err) {
      console.error("Deletion impact inspection error:", err);
      UI.showToast("Could not inspect record deletion impact.", "error", "Error");
    }
  },

  /**
   * Open Add Payment Modal for a Material Record
   */
  handleOpenAddPayment(materialId) {
    const record = this.cachedMaterials.find((m) => m.id === materialId);
    if (!record) return;

    const modalTitle = document.getElementById("payment-form-title");
    const parentNameEl = document.getElementById("payment-parent-name");
    const parentMatEl = document.getElementById("payment-parent-material");
    const parentDueEl = document.getElementById("payment-parent-due");
    const parentPaidEl = document.getElementById("payment-parent-paid");
    const parentPendingEl = document.getElementById("payment-parent-pending");
    const amountInput = document.getElementById("payment-amount");
    const amountHelper = document.getElementById("payment-amount-helper");
    const dateInput = document.getElementById("payment-date");
    const methodSelect = document.getElementById("payment-method");
    const notesInput = document.getElementById("payment-notes");
    const submitBtn = document.getElementById("btn-submit-payment-form");
    const submitText = document.getElementById("btn-submit-payment-text");
    const form = document.getElementById("payment-record-form");

    if (modalTitle) modalTitle.textContent = "Record Payment";
    if (submitText) submitText.textContent = "Save Payment";
    if (submitBtn) submitBtn.disabled = false;

    if (parentNameEl) parentNameEl.textContent = record.person_name || "Unassigned";
    if (parentMatEl) parentMatEl.textContent = record.material_type || "Material";
    if (parentDueEl) parentDueEl.textContent = record.total_due !== null ? UI.formatPKR(record.total_due) : "Unset";
    if (parentPaidEl) parentPaidEl.textContent = UI.formatPKR(record.paid_amount || 0);
    if (parentPendingEl) parentPendingEl.textContent = record.pending_amount !== null ? UI.formatPKR(record.pending_amount) : "Unset";

    if (amountInput) {
      amountInput.value = "";
      if (record.pending_amount !== null && record.pending_amount > 0) {
        amountInput.max = record.pending_amount;
        if (amountHelper) amountHelper.textContent = `Outstanding balance: ${UI.formatPKR(record.pending_amount)}. Amount cannot exceed this.`;
      } else if (record.pending_amount !== null && record.pending_amount <= 0 && record.total_due !== null) {
        amountInput.max = 0;
        if (amountHelper) amountHelper.textContent = "Record is fully paid. Further payments cannot be added.";
      } else {
        amountInput.removeAttribute("max");
        if (amountHelper) amountHelper.textContent = "Amount in PKR (must be greater than zero).";
      }
    }

    if (dateInput) dateInput.value = UI.getTodayDateString();
    if (methodSelect) methodSelect.value = "Cash";
    if (notesInput) notesInput.value = "";

    if (form) {
      form.setAttribute("data-material-id", materialId);
      form.removeAttribute("data-payment-id");
      form.removeAttribute("data-old-amount");
    }

    UI.openModal("modal-payment-form");
  },

  /**
   * Open Payment History Modal for a Material Record
   */
  async handleOpenPaymentHistory(materialId) {
    const record = this.cachedMaterials.find((m) => m.id === materialId);
    if (!record) return;

    const parentNameEl = document.getElementById("history-parent-name");
    const parentMatEl = document.getElementById("history-parent-material");
    const parentDueEl = document.getElementById("history-parent-due");
    const parentPaidEl = document.getElementById("history-parent-paid");
    const parentPendingEl = document.getElementById("history-parent-pending");
    const listContainer = document.getElementById("payment-history-items-container");
    const emptyState = document.getElementById("payment-history-empty");
    const quickAddBtn = document.getElementById("btn-history-add-payment");
    const emptyAddBtn = document.getElementById("btn-history-empty-add");

    if (parentNameEl) parentNameEl.textContent = record.person_name || "Unassigned";
    if (parentMatEl) parentMatEl.textContent = record.material_type || "Material";
    if (parentDueEl) parentDueEl.textContent = record.total_due !== null ? UI.formatPKR(record.total_due) : "Unset";
    if (parentPaidEl) parentPaidEl.textContent = UI.formatPKR(record.paid_amount || 0);
    if (parentPendingEl) parentPendingEl.textContent = record.pending_amount !== null ? UI.formatPKR(record.pending_amount) : "Unset";

    const triggerAdd = () => {
      UI.closeModal("modal-payment-history");
      Dashboard.handleOpenAddPayment(materialId);
    };

    if (quickAddBtn) quickAddBtn.onclick = triggerAdd;
    if (emptyAddBtn) emptyAddBtn.onclick = triggerAdd;

    if (listContainer) {
      listContainer.innerHTML = `
        <div style="padding: var(--space-6); text-align: center; color: var(--color-text-dim);">
          <div class="spinner" style="display: inline-block; width: 22px; height: 22px; border-width: 2px; margin-bottom: 8px;"></div>
          <div style="font-size: var(--font-size-xs);">Loading payment transactions...</div>
        </div>
      `;
    }

    UI.openModal("modal-payment-history");

    try {
      const payments = await DB.fetchPaymentsForMaterial(materialId);
      this.cachedCurrentHistoryPayments = payments || [];

      if (!payments || payments.length === 0) {
        if (listContainer) listContainer.innerHTML = "";
        if (emptyState) emptyState.classList.remove("hidden");
      } else {
        if (emptyState) emptyState.classList.add("hidden");
        if (listContainer) {
          listContainer.innerHTML = payments.map((p) => {
            return `
              <div class="payment-history-item" data-payment-id="${p.id}">
                <div class="payment-history-info">
                  <div class="payment-history-top">
                    <span class="badge badge-paid">${this.escapeHTML(p.payment_method || 'Cash')}</span>
                    <span class="payment-history-date">${p.payment_date || '--'}</span>
                  </div>
                  ${p.notes ? `<div class="payment-history-notes">${this.escapeHTML(p.notes)}</div>` : ''}
                </div>
                <div class="payment-history-amount-group">
                  <span class="payment-history-amount">${UI.formatPKR(p.amount)}</span>
                  <div class="payment-history-actions">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="Dashboard.handleOpenEditPayment('${p.id}', '${materialId}')" title="Edit payment">
                      <i data-lucide="edit-3" style="width: 13px; height: 13px;"></i>
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm text-pending" onclick="Dashboard.handleOpenDeletePayment('${p.id}', '${materialId}')" title="Delete payment">
                      <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join("");
        }
      }
    } catch (err) {
      console.error("Fetch payments error:", err);
      if (listContainer) {
        listContainer.innerHTML = `<div style="color: var(--color-pending); padding: var(--space-4); font-size: var(--font-size-xs);">Failed to load payments: ${this.escapeHTML(err.message)}</div>`;
      }
    } finally {
      if (window.lucide) window.lucide.createIcons();
    }
  },

  /**
   * Open Edit Payment Form for an existing transaction
   */
  async handleOpenEditPayment(paymentId, materialId) {
    const record = this.cachedMaterials.find((m) => m.id === materialId);
    let payments = this.cachedCurrentHistoryPayments;
    if (!payments || !payments.some((p) => p.id === paymentId)) {
      payments = await DB.fetchPaymentsForMaterial(materialId);
    }
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment) {
      UI.showToast("Payment transaction not found.", "error", "Error");
      return;
    }

    // Close history modal if open
    UI.closeModal("modal-payment-history");

    const modalTitle = document.getElementById("payment-form-title");
    const parentNameEl = document.getElementById("payment-parent-name");
    const parentMatEl = document.getElementById("payment-parent-material");
    const parentDueEl = document.getElementById("payment-parent-due");
    const parentPaidEl = document.getElementById("payment-parent-paid");
    const parentPendingEl = document.getElementById("payment-parent-pending");
    const amountInput = document.getElementById("payment-amount");
    const amountHelper = document.getElementById("payment-amount-helper");
    const dateInput = document.getElementById("payment-date");
    const methodSelect = document.getElementById("payment-method");
    const notesInput = document.getElementById("payment-notes");
    const submitBtn = document.getElementById("btn-submit-payment-form");
    const submitText = document.getElementById("btn-submit-payment-text");
    const form = document.getElementById("payment-record-form");

    if (modalTitle) modalTitle.textContent = "Edit Payment Transaction";
    if (submitText) submitText.textContent = "Save Changes";
    if (submitBtn) submitBtn.disabled = false;

    if (parentNameEl) parentNameEl.textContent = record ? record.person_name || "Unassigned" : "Unassigned";
    if (parentMatEl) parentMatEl.textContent = record ? record.material_type || "Material" : "Material";
    if (parentDueEl) parentDueEl.textContent = record && record.total_due !== null ? UI.formatPKR(record.total_due) : "Unset";
    if (parentPaidEl) parentPaidEl.textContent = UI.formatPKR(record ? record.paid_amount || 0 : 0);
    if (parentPendingEl) parentPendingEl.textContent = record && record.pending_amount !== null ? UI.formatPKR(record.pending_amount) : "Unset";

    const oldAmount = Number(payment.amount) || 0;
    const currentPending = record && record.pending_amount !== null ? Number(record.pending_amount) : null;
    const maxAllowable = currentPending !== null ? (currentPending + oldAmount) : null;

    if (amountInput) {
      amountInput.value = payment.amount;
      if (maxAllowable !== null) {
        amountInput.max = maxAllowable;
        if (amountHelper) amountHelper.textContent = `Max allowable for this updated payment: ${UI.formatPKR(maxAllowable)}.`;
      } else {
        amountInput.removeAttribute("max");
        if (amountHelper) amountHelper.textContent = "Amount in PKR (must be greater than zero).";
      }
    }

    if (dateInput) dateInput.value = payment.payment_date || UI.getTodayDateString();
    if (methodSelect) methodSelect.value = payment.payment_method || "Cash";
    if (notesInput) notesInput.value = payment.notes || "";

    if (form) {
      form.setAttribute("data-material-id", materialId);
      form.setAttribute("data-payment-id", paymentId);
      form.setAttribute("data-old-amount", payment.amount);
    }

    UI.openModal("modal-payment-form");
  },

  /**
   * Open Delete Payment Confirmation
   */
  async handleOpenDeletePayment(paymentId, materialId) {
    let payments = this.cachedCurrentHistoryPayments;
    if (!payments || !payments.some((p) => p.id === paymentId)) {
      payments = await DB.fetchPaymentsForMaterial(materialId);
    }
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment) {
      UI.showToast("Payment transaction not found.", "error", "Error");
      return;
    }

    // Temporarily close history modal to show delete confirmation cleanly
    UI.closeModal("modal-payment-history");

    UI.showPaymentDeleteConfirmation(
      {
        amount: payment.amount,
        paymentDate: payment.payment_date,
        paymentMethod: payment.payment_method,
        notes: payment.notes
      },
      async () => {
        try {
          UI.showToast("Deleting payment transaction...", "info", "Processing");
          await DB.deletePayment(paymentId);
          UI.showToast("Payment deleted. Balances recalculated.", "success", "Deleted");
          await Dashboard.load();
          // Re-open history to show updated state
          await Dashboard.handleOpenPaymentHistory(materialId);
        } catch (err) {
          console.error("Delete payment error:", err);
          UI.showToast(err.message || "Failed to delete payment.", "error", "Delete Failed");
        }
      },
      () => {
        UI.showToast("Payment deletion cancelled. No changes made.", "info", "Cancelled");
        // Re-open history
        Dashboard.handleOpenPaymentHistory(materialId);
      }
    );
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
};

// Bind to window for global access
if (typeof window !== "undefined") {
  window.Dashboard = Dashboard;
}
