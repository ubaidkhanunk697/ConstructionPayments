/**
 * CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
 * UI Component Controller, Modals, Toasts, and Event Handlers
 */

const UI = {
  // Current active modal reference
  activeModal: null,

  /**
   * Initialize Global UI Handlers
   */
  init() {
    this.setupDateBadges();
    this.setupSidebarDrawer();
    this.setupModalDismissListeners();
    this.setupUnitSelectListener();
    this.setupFormDateAutoFill();
    this.setupFinancialAutoCalculation();
  },

  /**
   * Format numeric amounts to Pakistani Rupees (PKR)
   * e.g., 250000 -> "Rs. 250,000"
   */
  formatPKR(amount) {
    const num = Number(amount) || 0;
    return `${CONFIG.CURRENCY.SYMBOL} ${num.toLocaleString(CONFIG.CURRENCY.LOCALE, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })}`;
  },

  /**
   * Get Today's Date in YYYY-MM-DD format
   */
  getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },

  /**
   * Derive Day Name (e.g., "Monday") from a YYYY-MM-DD date string
   */
  getDayName(dateStr) {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    return dateObj.toLocaleDateString("en-US", { weekday: "long" });
  },

  /**
   * Setup Real-time Date & Day in Top Navigation
   */
  setupDateBadges() {
    const dateBadgeEl = document.getElementById("header-live-date");
    const dayBadgeEl = document.getElementById("header-live-day");
    if (dateBadgeEl || dayBadgeEl) {
      const now = new Date();
      const options = { year: "numeric", month: "short", day: "numeric" };
      if (dateBadgeEl) dateBadgeEl.textContent = now.toLocaleDateString("en-US", options);
      if (dayBadgeEl) dayBadgeEl.textContent = now.toLocaleDateString("en-US", { weekday: "long" });
    }
  },

  /**
   * Responsive Mobile Sidebar Drawer Toggle
   */
  setupSidebarDrawer() {
    const toggleBtn = document.getElementById("menu-toggle-btn");
    const sidebar = document.getElementById("app-sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");

    if (toggleBtn && sidebar && backdrop) {
      const toggle = () => {
        const isOpen = sidebar.classList.contains("open");
        if (isOpen) {
          sidebar.classList.remove("open");
          backdrop.classList.remove("active");
        } else {
          sidebar.classList.add("open");
          backdrop.classList.add("active");
        }
      };

      toggleBtn.addEventListener("click", toggle);
      backdrop.addEventListener("click", () => {
        sidebar.classList.remove("open");
        backdrop.classList.remove("active");
      });
    }
  },

  /**
   * Modal Open Controller
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add("active");
    this.activeModal = modal;
    document.body.style.overflow = "hidden";

    // Refresh icons inside modal if Lucide is available
    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  /**
   * Modal Close Controller
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove("active");
    this.activeModal = null;
    document.body.style.overflow = "";
  },

  /**
   * Close all active modals
   */
  closeAllModals() {
    document.querySelectorAll(".modal-overlay.active").forEach((modal) => {
      modal.classList.remove("active");
    });
    this.activeModal = null;
    document.body.style.overflow = "";
  },

  /**
   * Setup Backdrop & Escape Key Listeners for Modals
   */
  setupModalDismissListeners() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.activeModal) {
        this.closeAllModals();
      }
    });

    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          this.closeAllModals();
        }
      });
    });

    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const modalId = btn.getAttribute("data-close-modal");
        this.closeModal(modalId);
      });
    });
  },

  /**
   * Handle Custom Unit Field visibility and sync with datalist options
   */
  setupUnitSelectListener() {
    const unitSelect = document.getElementById("material-unit-select");
    const customUnitGroup = document.getElementById("custom-unit-group");
    const customUnitInput = document.getElementById("material-custom-unit");

    if (unitSelect && customUnitGroup) {
      // If unitSelect is a native SELECT tag (legacy fallback), populate from CONFIG
      if (unitSelect.tagName === "SELECT" && typeof CONFIG !== "undefined" && typeof CONFIG.populateUnitDropdown === "function") {
        CONFIG.populateUnitDropdown(unitSelect, unitSelect.value || "Bags");
      }

      const handleUnitChange = () => {
        if (unitSelect.value === "Other") {
          customUnitGroup.classList.remove("hidden");
          if (customUnitInput) customUnitInput.required = true;
        } else {
          customUnitGroup.classList.add("hidden");
          if (customUnitInput) {
            customUnitInput.required = false;
            customUnitInput.value = "";
          }
        }
      };

      unitSelect.addEventListener("change", handleUnitChange);
      unitSelect.addEventListener("input", handleUnitChange);
      handleUnitChange();
    }
  },

  /**
   * Real-time Financial Calculations for Material Form
   * Calculates Pending Balance = Total Amount Due − Paid Amount
   */
  setupFinancialAutoCalculation() {
    const totalInput = document.getElementById("material-total-amount");
    const paidInput = document.getElementById("material-paid-amount");
    const pendingInput = document.getElementById("material-pending-amount");
    const helperText = document.getElementById("material-pending-helper");

    if (!totalInput || !paidInput || !pendingInput) return;

    const recalculate = () => {
      const totalRaw = totalInput.value.trim();
      const paidRaw = paidInput.value.trim();

      if (totalRaw === "" && paidRaw === "") {
        pendingInput.value = "0.00";
        if (helperText) {
          helperText.textContent = "Auto-calculated: Total Amount Due − Paid Amount";
          helperText.style.color = "";
        }
        return;
      }

      const total = parseFloat(totalRaw) || 0;
      const paid = parseFloat(paidRaw) || 0;
      const pending = Math.max(0, total - paid);

      pendingInput.value = pending.toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

      if (helperText) {
        if (paid > total && total > 0) {
          helperText.textContent = `Warning: Paid amount (${this.formatPKR(paid)}) exceeds Total Due (${this.formatPKR(total)})!`;
          helperText.style.color = "var(--color-danger, #ef4444)";
        } else {
          helperText.textContent = `Pending balance: ${this.formatPKR(pending)} (${this.formatPKR(total)} − ${this.formatPKR(paid)})`;
          helperText.style.color = "";
        }
      }
    };

    totalInput.addEventListener("input", recalculate);
    totalInput.addEventListener("change", recalculate);
    paidInput.addEventListener("input", recalculate);
    paidInput.addEventListener("change", recalculate);

    // Expose recalculate so other scripts can trigger it
    this.updatePendingCalculation = recalculate;
  },

  /**
   * Auto-fill Date with today's date and derive Day of week
   */
  setupFormDateAutoFill() {
    const dateInput = document.getElementById("material-date");
    const dayInput = document.getElementById("material-day");

    if (dateInput && dayInput) {
      // Default to today
      if (!dateInput.value) {
        dateInput.value = this.getTodayDateString();
        dayInput.value = this.getDayName(dateInput.value);
      }

      dateInput.addEventListener("change", () => {
        dayInput.value = this.getDayName(dateInput.value);
      });
    }
  },

  /**
   * Strong Confirmation Dialog for EDITING a Record
   * Uses custom modal instead of native browser prompt
   */
  showEditConfirmation({ personName, materialType, quantity, unit, totalAmount, paidAmount, pendingAmount, purchaseDate, notes, recordId }, onConfirm, onCancel) {
    const modalId = "modal-confirm-edit";
    const personEl = document.getElementById("confirm-edit-person");
    const materialEl = document.getElementById("confirm-edit-material");
    const quantityEl = document.getElementById("confirm-edit-quantity");
    const totalEl = document.getElementById("confirm-edit-total");
    const paidEl = document.getElementById("confirm-edit-paid");
    const pendingEl = document.getElementById("confirm-edit-pending");
    const dateEl = document.getElementById("confirm-edit-date");
    const notesItem = document.getElementById("confirm-edit-notes-item");
    const notesEl = document.getElementById("confirm-edit-notes");
    const confirmBtn = document.getElementById("btn-confirm-save-edit");
    const confirmBtnText = document.getElementById("btn-confirm-save-edit-text");
    const confirmBtnSpinner = document.getElementById("btn-confirm-save-edit-spinner");

    if (personEl) personEl.textContent = personName || "Unassigned";
    if (materialEl) materialEl.textContent = materialType || "Material Record";
    if (quantityEl) quantityEl.textContent = quantity ? `${quantity} ${unit || ''}` : "Unspecified";
    if (totalEl) totalEl.textContent = totalAmount !== null && totalAmount !== undefined ? this.formatPKR(totalAmount) : "Unset";
    if (paidEl) paidEl.textContent = paidAmount !== null && paidAmount !== undefined ? this.formatPKR(paidAmount) : "Rs. 0";
    if (pendingEl) pendingEl.textContent = pendingAmount !== null && pendingAmount !== undefined ? this.formatPKR(pendingAmount) : "Rs. 0";
    if (dateEl) dateEl.textContent = purchaseDate || "--";

    if (notesItem && notesEl) {
      if (notes) {
        notesItem.classList.remove("hidden");
        notesEl.textContent = notes;
      } else {
        notesItem.classList.add("hidden");
      }
    }

    // Reset button state
    if (confirmBtn) {
      confirmBtn.disabled = false;
      if (confirmBtnSpinner) confirmBtnSpinner.style.display = "none";
      if (confirmBtnText) confirmBtnText.textContent = "Confirm & Save Changes";

      const newConfirmBtn = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

      newConfirmBtn.addEventListener("click", async () => {
        newConfirmBtn.disabled = true;
        const spinner = document.getElementById("btn-confirm-save-edit-spinner");
        const text = document.getElementById("btn-confirm-save-edit-text");
        if (spinner) spinner.style.display = "inline-block";
        if (text) text.textContent = "Saving...";

        if (typeof onConfirm === "function") {
          await onConfirm();
        }
        this.closeModal(modalId);
      });
    }

    // Handle cancellation
    const cancelBtns = document.querySelectorAll(`[data-close-modal="${modalId}"]`);
    cancelBtns.forEach(btn => {
      btn.onclick = () => {
        this.closeModal(modalId);
        if (typeof onCancel === "function") onCancel();
      };
    });

    this.openModal(modalId);
  },

  /**
   * Strong Confirmation Dialog for DELETING a Record
   * Uses custom modal instead of native browser prompt
   */
  showDeleteConfirmation({ personName, materialType, quantity, unit, totalAmount, paidAmount, pendingAmount, recordId, hasPayments, paymentCount, totalPaid }, onConfirm, onCancel) {
    const modalId = "modal-confirm-delete";
    const personEl = document.getElementById("confirm-delete-person");
    const materialEl = document.getElementById("confirm-delete-material");
    const totalEl = document.getElementById("confirm-delete-total");
    const paidEl = document.getElementById("confirm-delete-paid");
    const pendingEl = document.getElementById("confirm-delete-pending");
    const paymentsBox = document.getElementById("confirm-delete-payments-box");
    const paymentsText = document.getElementById("confirm-delete-payments-text");
    const checkbox = document.getElementById("confirm-delete-payments-checkbox");
    const confirmBtn = document.getElementById("btn-confirm-delete");
    const confirmBtnText = document.getElementById("btn-confirm-delete-text");
    const confirmBtnSpinner = document.getElementById("btn-confirm-delete-spinner");

    if (personEl) personEl.textContent = personName || "Unassigned";
    if (materialEl) materialEl.textContent = `${materialType || "Material"} (${quantity || '0'} ${unit || ''})`;
    if (totalEl) totalEl.textContent = totalAmount !== null && totalAmount !== undefined ? this.formatPKR(totalAmount) : "Unset";
    if (paidEl) paidEl.textContent = this.formatPKR(paidAmount || 0);
    if (pendingEl) pendingEl.textContent = pendingAmount !== null && pendingAmount !== undefined ? this.formatPKR(pendingAmount) : "Unset";

    // Setup payment impact and explicit confirmation requirement
    if (paymentsBox) {
      if (hasPayments) {
        paymentsBox.classList.remove("hidden");
        if (paymentsText) {
          paymentsText.textContent = `${paymentCount} existing payment transaction(s) totaling ${this.formatPKR(totalPaid)} detected.`;
        }
        if (checkbox) {
          checkbox.checked = false;
        }
      } else {
        paymentsBox.classList.add("hidden");
      }
    }

    // Reset button state and clone to clean event listeners
    if (confirmBtn) {
      confirmBtn.disabled = hasPayments ? true : false;
      if (confirmBtnSpinner) confirmBtnSpinner.style.display = "none";
      if (confirmBtnText) confirmBtnText.textContent = "Yes, Delete Record";

      const newConfirmBtn = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

      // If payments exist, require checkbox confirmation
      if (checkbox && hasPayments) {
        checkbox.onchange = () => {
          newConfirmBtn.disabled = !checkbox.checked;
        };
      }

      newConfirmBtn.addEventListener("click", async () => {
        newConfirmBtn.disabled = true;
        const spinner = document.getElementById("btn-confirm-delete-spinner");
        const text = document.getElementById("btn-confirm-delete-text");
        if (spinner) spinner.style.display = "inline-block";
        if (text) text.textContent = "Deleting...";

        if (typeof onConfirm === "function") {
          await onConfirm();
        }
        this.closeModal(modalId);
      });
    }

    // Handle cancellation
    const cancelBtns = document.querySelectorAll(`[data-close-modal="${modalId}"]`);
    cancelBtns.forEach(btn => {
      btn.onclick = () => {
        this.closeModal(modalId);
        if (typeof onCancel === "function") onCancel();
      };
    });

    this.openModal(modalId);
  },

  /**
   * Strong Confirmation Dialog for EDITING a Payment Transaction
   * Uses custom modal instead of native browser prompt
   */
  showPaymentEditConfirmation({ oldAmount, newAmount, paymentDate, paymentMethod, notes }, onConfirm, onCancel) {
    const modalId = "modal-confirm-payment-edit";
    const oldAmountEl = document.getElementById("confirm-payment-edit-old-amount");
    const newAmountEl = document.getElementById("confirm-payment-edit-new-amount");
    const dateEl = document.getElementById("confirm-payment-edit-date");
    const methodEl = document.getElementById("confirm-payment-edit-method");
    const notesItem = document.getElementById("confirm-payment-edit-notes-item");
    const notesEl = document.getElementById("confirm-payment-edit-notes");
    const confirmBtn = document.getElementById("btn-confirm-save-payment-edit");
    const confirmBtnText = document.getElementById("btn-confirm-save-payment-edit-text");
    const confirmBtnSpinner = document.getElementById("btn-confirm-save-payment-edit-spinner");

    if (oldAmountEl) oldAmountEl.textContent = this.formatPKR(oldAmount);
    if (newAmountEl) newAmountEl.textContent = this.formatPKR(newAmount);
    if (dateEl) dateEl.textContent = paymentDate || "--";
    if (methodEl) methodEl.textContent = paymentMethod || "Cash";

    if (notesItem && notesEl) {
      if (notes) {
        notesItem.classList.remove("hidden");
        notesEl.textContent = notes;
      } else {
        notesItem.classList.add("hidden");
      }
    }

    if (confirmBtn) {
      confirmBtn.disabled = false;
      if (confirmBtnSpinner) confirmBtnSpinner.style.display = "none";
      if (confirmBtnText) confirmBtnText.textContent = "Confirm & Save Changes";

      const newConfirmBtn = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

      newConfirmBtn.addEventListener("click", async () => {
        newConfirmBtn.disabled = true;
        const spinner = document.getElementById("btn-confirm-save-payment-edit-spinner");
        const text = document.getElementById("btn-confirm-save-payment-edit-text");
        if (spinner) spinner.style.display = "inline-block";
        if (text) text.textContent = "Saving...";

        if (typeof onConfirm === "function") {
          await onConfirm();
        }
        this.closeModal(modalId);
      });
    }

    const cancelBtns = document.querySelectorAll(`[data-close-modal="${modalId}"]`);
    cancelBtns.forEach(btn => {
      btn.onclick = () => {
        this.closeModal(modalId);
        if (typeof onCancel === "function") onCancel();
      };
    });

    this.openModal(modalId);
  },

  /**
   * Strong Confirmation Dialog for DELETING a Payment Transaction
   * Uses custom modal instead of native browser prompt
   */
  showPaymentDeleteConfirmation({ amount, paymentDate, paymentMethod, notes }, onConfirm, onCancel) {
    const modalId = "modal-confirm-delete-payment";
    const amountEl = document.getElementById("confirm-delete-payment-amount");
    const dateEl = document.getElementById("confirm-delete-payment-date");
    const methodEl = document.getElementById("confirm-delete-payment-method");
    const notesItem = document.getElementById("confirm-delete-payment-notes-item");
    const notesEl = document.getElementById("confirm-delete-payment-notes");
    const confirmBtn = document.getElementById("btn-confirm-delete-payment");
    const confirmBtnText = document.getElementById("btn-confirm-delete-payment-text");
    const confirmBtnSpinner = document.getElementById("btn-confirm-delete-payment-spinner");

    if (amountEl) amountEl.textContent = this.formatPKR(amount);
    if (dateEl) dateEl.textContent = paymentDate || "--";
    if (methodEl) methodEl.textContent = paymentMethod || "Cash";

    if (notesItem && notesEl) {
      if (notes) {
        notesItem.classList.remove("hidden");
        notesEl.textContent = notes;
      } else {
        notesItem.classList.add("hidden");
      }
    }

    if (confirmBtn) {
      confirmBtn.disabled = false;
      if (confirmBtnSpinner) confirmBtnSpinner.style.display = "none";
      if (confirmBtnText) confirmBtnText.textContent = "Yes, Delete Payment";

      const newConfirmBtn = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

      newConfirmBtn.addEventListener("click", async () => {
        newConfirmBtn.disabled = true;
        const spinner = document.getElementById("btn-confirm-delete-payment-spinner");
        const text = document.getElementById("btn-confirm-delete-payment-text");
        if (spinner) spinner.style.display = "inline-block";
        if (text) text.textContent = "Deleting...";

        if (typeof onConfirm === "function") {
          await onConfirm();
        }
        this.closeModal(modalId);
      });
    }

    const cancelBtns = document.querySelectorAll(`[data-close-modal="${modalId}"]`);
    cancelBtns.forEach(btn => {
      btn.onclick = () => {
        this.closeModal(modalId);
        if (typeof onCancel === "function") onCancel();
      };
    });

    this.openModal(modalId);
  },

  /**
   * Non-intrusive Toast Notification Engine
   * Types: 'success', 'error', 'warning', 'info'
   */
  showToast(message, type = "info", title = "") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const defaultTitles = {
      success: "Operation Successful",
      error: "Error Encountered",
      warning: "Important Notice",
      info: "Information"
    };

    const icons = {
      success: "check-circle",
      error: "alert-triangle",
      warning: "alert-circle",
      info: "info"
    };

    const finalTitle = title || defaultTitles[type] || "Notice";
    const iconName = icons[type] || "info";

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">
        <i data-lucide="${iconName}"></i>
      </div>
      <div class="toast-content">
        <div class="toast-title">${finalTitle}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" aria-label="Close notification">
        <i data-lucide="x"></i>
      </button>
    `;

    container.appendChild(toast);

    if (window.lucide) {
      window.lucide.createIcons();
    }

    const closeBtn = toast.querySelector(".toast-close");
    const removeToast = () => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      toast.style.transition = "all 150ms ease";
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 150);
    };

    closeBtn.addEventListener("click", removeToast);
    // Auto dismiss after 4 seconds
    setTimeout(removeToast, 4000);
  }
};

// Explicitly bind to window for global access
if (typeof window !== "undefined") {
  window.UI = UI;
}

