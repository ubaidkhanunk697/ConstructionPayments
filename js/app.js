/**
 * CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
 * Main Application Lifecycle & Event Bootstrapper
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize UI controllers and helpers
  UI.init();

  // Hydrate Lucide Icons across the DOM
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Enforce Authentication Guard on Dashboard
  await initializeAuthGuard();

  // Initialize Dashboard Data Engine
  if (typeof Dashboard !== "undefined") {
    await Dashboard.init();
  }

  // Bind Header & Dashboard Action Buttons
  setupActionButtons();

  // Bind Form Submission & Strong Confirmation Flows
  setupMaterialFormHandlers();

  // Bind Payment Form Submission & Overpayment Validation
  setupPaymentFormHandlers();
});

/**
 * Enforce Route Protection and Update Owner Identity
 */
async function initializeAuthGuard() {
  if (typeof Auth === "undefined") return;

  const result = await Auth.requireOwnerAuth();

  if (result.status === "unconfigured") {
    const bannerContainer = document.getElementById("dashboard-alert-banner");
    if (bannerContainer) {
      bannerContainer.innerHTML = `
        <div class="card" style="margin-bottom: var(--space-6); background: var(--color-warning-subtle); border: 1px solid #FCD34D; padding: var(--space-4);">
          <div class="flex items-start gap-3">
            <i data-lucide="check-circle-2" style="color: #059669; width: 22px; height: 22px; flex-shrink: 0; margin-top: 2px;"></i>
            <div style="flex: 1;">
              <div class="flex items-center justify-between" style="flex-wrap: wrap; gap: 8px; margin-bottom: 4px;">
                <strong style="color: #065F46; font-size: var(--font-size-sm); display: flex; align-items: center; gap: 6px;">
                  Interactive Demo Mode: 5 Sample Construction Records Active
                </strong>
                <button 
                  type="button" 
                  class="btn btn-secondary btn-sm" 
                  onclick="DB.resetDemoData().then(() => { Dashboard.load(); UI.showToast('5 sample records restored to initial state.', 'success', 'Demo Reset'); })"
                  style="font-size: 11px; padding: 4px 10px;"
                >
                  <i data-lucide="rotate-ccw" style="width: 13px; height: 13px;"></i>
                  Reset Sample Data
                </button>
              </div>
              <p style="color: #047857; font-size: var(--font-size-xs); margin: 0; line-height: 1.5;">
                5 realistic construction records are loaded below so you can test <strong>editing</strong>, <strong>deleting</strong>, 
                <strong>payments</strong>, and <strong>visual layout</strong>. Changes are saved in your local browser session.
                To connect to production Supabase, follow <code>SETUP_SUPABASE_AUTH.md</code>.
              </p>
            </div>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
  } else if (result.status === "authorized" && result.user) {
    // Populate Authenticated Owner Profile in Sidebar & Topbar
    const user = result.user;
    const email = user.email || "";
    const fullName = user.user_metadata?.full_name || email.split("@")[0] || "Authorized Owner";
    const initial = (fullName[0] || email[0] || "O").toUpperCase();

    const nameEl = document.getElementById("sidebar-owner-name");
    const emailEl = document.getElementById("sidebar-owner-email");
    const avatarEl = document.getElementById("sidebar-owner-avatar");

    if (nameEl) nameEl.textContent = fullName;
    if (emailEl) emailEl.textContent = email;
    if (avatarEl) avatarEl.textContent = initial;
  }

  // Setup Logout Button in Sidebar
  const logoutBtn = document.getElementById("logout-btn") || document.getElementById("btn-sidebar-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      UI.showToast("Signing out of system...", "info", "Security");
      await Auth.signOut();
    });
  }
}

/**
 * Setup Action Buttons (Add Material, Export Excel, etc.)
 */
function setupActionButtons() {
  const addBtnHeader = document.getElementById("btn-add-material-header");
  const addBtnEmpty = document.getElementById("btn-add-material-empty");
  const exportBtnHeader = document.getElementById("btn-export-excel");
  const exportBtnToolbar = document.getElementById("btn-export-excel-toolbar");
  const exportNavLink = document.getElementById("nav-export-link");

  const openAddModal = () => {
    const form = document.getElementById("material-record-form");
    if (form) {
      form.reset();
      form.removeAttribute("data-edit-id");
    }
    
    const dateInput = document.getElementById("material-date");
    const dayInput = document.getElementById("material-day");
    if (dateInput && dayInput) {
      dateInput.value = UI.getTodayDateString();
      dayInput.value = UI.getDayName(dateInput.value);
    }

    const customUnitGroup = document.getElementById("custom-unit-group");
    if (customUnitGroup) customUnitGroup.classList.add("hidden");

    const paidAmountInput = document.getElementById("material-paid-amount");
    if (paidAmountInput) paidAmountInput.value = "";

    if (typeof UI !== "undefined" && typeof UI.updatePendingCalculation === "function") {
      UI.updatePendingCalculation();
    }

    const notesInput = document.getElementById("material-notes");
    if (notesInput) notesInput.value = "";

    const modalTitle = document.getElementById("material-form-title");
    if (modalTitle) modalTitle.textContent = "Add Material Record";

    const deleteBtn = document.getElementById("btn-delete-material-record");
    if (deleteBtn) {
      deleteBtn.classList.add("hidden");
      deleteBtn.onclick = null;
    }

    const submitBtn = document.getElementById("btn-submit-material-form");
    const submitText = document.getElementById("btn-submit-material-text");
    if (submitText) {
      submitText.textContent = "Save Material Record";
    } else if (submitBtn) {
      submitBtn.textContent = "Save Material Record";
    }

    UI.openModal("modal-material-form");
  };

  if (addBtnHeader) addBtnHeader.addEventListener("click", openAddModal);
  if (addBtnEmpty) addBtnEmpty.addEventListener("click", openAddModal);

  // Wire Download Excel actions to ExportService
  const handleExportClick = async (e) => {
    if (e) e.preventDefault();
    if (typeof ExportService !== "undefined") {
      await ExportService.exportToExcel();
    } else {
      UI.showToast("Export engine is loading, please try again in a moment.", "warning", "Exporting");
    }
  };

  if (exportBtnHeader) exportBtnHeader.addEventListener("click", handleExportClick);
  if (exportBtnToolbar) exportBtnToolbar.addEventListener("click", handleExportClick);
  if (exportNavLink) exportNavLink.addEventListener("click", handleExportClick);
}

/**
 * Setup Material Form Submission with Validation & Live Database Persistence
 */
function setupMaterialFormHandlers() {
  const form = document.getElementById("material-record-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const personName = document.getElementById("material-person")?.value.trim() || null;
    const materialType = document.getElementById("material-type")?.value.trim() || null;
    const quantityRaw = document.getElementById("material-quantity")?.value;
    const quantity = quantityRaw !== "" && quantityRaw !== undefined ? parseFloat(quantityRaw) : null;
    const unit = document.getElementById("material-unit-select")?.value.trim() || null;
    const customUnit = document.getElementById("material-custom-unit")?.value.trim();
    const totalAmountRaw = document.getElementById("material-total-amount")?.value;
    const totalAmount = totalAmountRaw !== "" && totalAmountRaw !== undefined ? parseFloat(totalAmountRaw) : null;
    const paidAmountRaw = document.getElementById("material-paid-amount")?.value;
    const paidAmount = paidAmountRaw !== "" && paidAmountRaw !== undefined ? parseFloat(paidAmountRaw) : 0;
    const date = document.getElementById("material-date")?.value || null;
    const day = document.getElementById("material-day")?.value || null;
    const notes = document.getElementById("material-notes")?.value.trim() || null;
    const editId = form.getAttribute("data-edit-id");

    // Financial Validation: Total Amount Due cannot be negative
    if (totalAmount !== null && totalAmount < 0) {
      UI.showToast("Total Amount Due cannot be negative.", "error", "Validation Failed");
      return;
    }

    // Financial Validation: Paid Amount cannot be negative
    if (paidAmount < 0) {
      UI.showToast("Paid Amount cannot be negative.", "error", "Validation Failed");
      return;
    }

    // Financial Validation: Paid Amount cannot exceed Total Due
    if (totalAmount !== null && paidAmount > totalAmount) {
      UI.showToast("Paid Amount cannot exceed Total Amount Due.", "error", "Validation Failed");
      return;
    }

    // Validation: Custom unit must not be empty if "Other" is selected
    const resolvedUnit = unit === "Other" ? customUnit : unit;
    if (unit === "Other" && !resolvedUnit) {
      UI.showToast("Please specify the custom unit.", "warning", "Validation Failed");
      return;
    }

    const payload = {
      person_name: personName,
      material_type: materialType,
      quantity: quantity,
      unit: resolvedUnit,
      total_due: totalAmount,
      purchase_date: date,
      notes: notes
    };

    // Close form modal
    UI.closeModal("modal-material-form");

    if (editId) {
      // Edit Mode: Requires strong confirmation modal before modifying database
      const pendingCalc = totalAmount !== null ? Math.max(0, totalAmount - paidAmount) : null;
      UI.showEditConfirmation(
        {
          personName: payload.person_name || "Unassigned",
          materialType: payload.material_type || "Material Record",
          quantity: payload.quantity,
          unit: payload.unit,
          totalAmount: payload.total_due,
          paidAmount: paidAmount,
          pendingAmount: pendingCalc,
          purchaseDate: payload.purchase_date,
          notes: payload.notes,
          recordId: editId
        },
        async () => {
          try {
            if (!CONFIG.isConfigured()) {
              UI.showToast("Saving changes to local session...", "info", "Saving");
            } else {
              UI.showToast("Saving changes to database...", "info", "Saving");
            }

            await DB.updateMaterialRecord(editId, payload);

            // If initial payment was added on edit for a record that had none
            if (paidAmount > 0) {
              const impact = await DB.getDeletionImpact(editId);
              if (!impact || impact.payment_count === 0) {
                await DB.addPayment({
                  material_record_id: editId,
                  amount: paidAmount,
                  payment_date: payload.purchase_date || UI.getTodayDateString(),
                  payment_method: "Cash",
                  notes: "Initial payment recorded via Material Form"
                });
              }
            }

            UI.showToast("Material record successfully updated.", "success", "Saved");

            // Refresh dashboard and record list
            if (typeof Dashboard !== "undefined") {
              await Dashboard.load();
            }
          } catch (err) {
            console.error("Database update error:", err);
            UI.showToast(err.message || "Failed to update record in database.", "error", "Update Failed");
          }
        },
        () => {
          // Cancelled: do not touch database
          UI.showToast("Edit cancelled. Record remains unchanged.", "info", "Cancelled");
        }
      );
    } else {
      // Add Mode: Insert new record
      try {
        const submitBtn = document.getElementById("btn-submit-material-form");
        const btnText = document.getElementById("btn-submit-material-text");
        const btnSpinner = document.getElementById("btn-submit-material-spinner");

        if (submitBtn) submitBtn.disabled = true;
        if (btnSpinner) btnSpinner.style.display = "inline-block";
        if (btnText) btnText.textContent = "Saving...";

        if (!CONFIG.isConfigured()) {
          UI.showToast("Saving record to local session...", "info", "Saving");
        } else {
          UI.showToast("Adding material record to database...", "info", "Saving");
        }

        const newRecord = await DB.createMaterialRecord(payload);

        // If an initial payment amount was entered, record payment transaction immediately
        if (paidAmount > 0 && newRecord && newRecord.id) {
          try {
            await DB.addPayment({
              material_record_id: newRecord.id,
              amount: paidAmount,
              payment_date: payload.purchase_date || UI.getTodayDateString(),
              payment_method: "Cash",
              notes: "Initial payment on record creation"
            });
          } catch (payErr) {
            console.error("Initial payment transaction error:", payErr);
            UI.showToast("Record created, but payment recording failed: " + payErr.message, "warning", "Payment Notice");
          }
        }

        UI.showToast("New material record successfully created.", "success", "Created");

        if (typeof Dashboard !== "undefined") {
          await Dashboard.load();
        }
      } catch (err) {
        console.error("Database insert error:", err);
        UI.showToast(err.message || "Failed to create record in database.", "error", "Save Failed");
      } finally {
        const submitBtn = document.getElementById("btn-submit-material-form");
        const btnText = document.getElementById("btn-submit-material-text");
        const btnSpinner = document.getElementById("btn-submit-material-spinner");
        if (submitBtn) submitBtn.disabled = false;
        if (btnSpinner) btnSpinner.style.display = "none";
        if (btnText) btnText.textContent = "Save Material Record";
      }
    }
  });
}

/**
 * Setup Payment Form Submission with Overpayment Validation & Confirmation
 */
function setupPaymentFormHandlers() {
  const form = document.getElementById("payment-record-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const materialId = form.getAttribute("data-material-id");
    const paymentId = form.getAttribute("data-payment-id");
    const oldAmountRaw = form.getAttribute("data-old-amount");
    const amountRaw = document.getElementById("payment-amount")?.value;
    const paymentDate = document.getElementById("payment-date")?.value;
    const paymentMethod = document.getElementById("payment-method")?.value;
    const notes = document.getElementById("payment-notes")?.value.trim() || null;

    if (!materialId) {
      UI.showToast("Parent material record reference is missing.", "error", "Error");
      return;
    }

    const amount = parseFloat(amountRaw);
    if (isNaN(amount) || amount <= 0) {
      UI.showToast("Payment amount must be greater than zero.", "error", "Validation Failed");
      return;
    }

    // Inspect parent record from cached materials
    const parent = typeof Dashboard !== "undefined" && Dashboard.cachedMaterials
      ? Dashboard.cachedMaterials.find((m) => m.id === materialId)
      : null;

    // Strict Overpayment Prevention Check
    if (parent && parent.total_due !== null) {
      let maxAllowed;
      if (paymentId) {
        const oldAmount = parseFloat(oldAmountRaw) || 0;
        maxAllowed = (Number(parent.pending_amount) || 0) + oldAmount;
      } else {
        maxAllowed = Number(parent.pending_amount) || 0;
      }

      if (amount > maxAllowed) {
        UI.showToast(
          `Overpayment prohibited: Payment of ${UI.formatPKR(amount)} exceeds the outstanding balance of ${UI.formatPKR(maxAllowed)}.`,
          "error",
          "Overpayment Blocked"
        );
        return;
      }
    }

    const payload = {
      material_record_id: materialId,
      amount: amount,
      payment_date: paymentDate || UI.getTodayDateString(),
      payment_method: paymentMethod || "Cash",
      notes: notes
    };

    if (paymentId) {
      // EDIT MODE: Close form and display strong confirmation modal
      UI.closeModal("modal-payment-form");

      UI.showPaymentEditConfirmation(
        {
          oldAmount: parseFloat(oldAmountRaw) || 0,
          newAmount: amount,
          paymentDate: payload.payment_date,
          paymentMethod: payload.payment_method,
          notes: payload.notes
        },
        async () => {
          try {
            if (!CONFIG.isConfigured()) {
              UI.showToast("Updating payment in local session...", "info", "Saving");
            } else {
              UI.showToast("Updating payment transaction in database...", "info", "Saving");
            }

            await DB.updatePayment(paymentId, payload);
            UI.showToast("Payment transaction successfully updated.", "success", "Saved");

            if (typeof Dashboard !== "undefined") {
              await Dashboard.load();
              await Dashboard.handleOpenPaymentHistory(materialId);
            }
          } catch (err) {
            console.error("Payment update error:", err);
            UI.showToast(err.message || "Failed to update payment transaction.", "error", "Update Failed");
          }
        },
        () => {
          UI.showToast("Payment edit cancelled. Transaction remains unchanged.", "info", "Cancelled");
          if (typeof Dashboard !== "undefined") {
            Dashboard.handleOpenPaymentHistory(materialId);
          }
        }
      );
    } else {
      // ADD MODE: Insert new payment transaction
      const submitBtn = document.getElementById("btn-submit-payment-form");
      const btnText = document.getElementById("btn-submit-payment-text");
      const btnSpinner = document.getElementById("btn-submit-payment-spinner");

      try {
        if (submitBtn) submitBtn.disabled = true;
        if (btnSpinner) btnSpinner.style.display = "inline-block";
        if (btnText) btnText.textContent = "Saving...";

        if (!CONFIG.isConfigured()) {
          UI.showToast("Recording payment in local session...", "info", "Saving");
        } else {
          UI.showToast("Recording payment transaction in database...", "info", "Saving");
        }

        await DB.addPayment(payload);
        UI.showToast(`Payment of ${UI.formatPKR(amount)} successfully recorded.`, "success", "Payment Recorded");

        UI.closeModal("modal-payment-form");

        if (typeof Dashboard !== "undefined") {
          await Dashboard.load();
        }
      } catch (err) {
        console.error("Payment insert error:", err);
        UI.showToast(err.message || "Failed to record payment transaction.", "error", "Transaction Failed");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (btnSpinner) btnSpinner.style.display = "none";
        if (btnText) btnText.textContent = "Save Payment";
      }
    }
  });
}
