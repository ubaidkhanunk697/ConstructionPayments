/**
 * CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
 * Database Service, Supabase Data Access Layer & Local Demo Store
 */

// ----------------------------------------------------------------------------
// FIVE REALISTIC DUMMY RECORDS FOR DESIGN, EDIT & DELETE TESTING
// ----------------------------------------------------------------------------
const DEMO_SEED_MATERIALS = [
  {
    id: "mat-001",
    user_id: "demo-user-001",
    person_name: "Haji Aslam (Fauji Cement Dealer)",
    material_type: "Cement (Fauji, Maple Leaf, Lucky, etc.)",
    quantity: 250,
    unit: "Bags",
    total_due: 325000,
    purchase_date: "2026-11-01",
    notes: "250 bags Fauji Cement for basement slab casting delivered via Hino Truck LES-4412. Bilty #8821.",
    created_at: "2026-11-01T08:30:00.000Z",
    updated_at: "2026-11-03T11:00:00.000Z"
  },
  {
    id: "mat-002",
    user_id: "demo-user-001",
    person_name: "Tariq Steel Mills (Mian Tariq)",
    material_type: "Steel / Sariya (Grade 60 / Grade 40)",
    quantity: 3.5,
    unit: "Tons",
    total_due: 910000,
    purchase_date: "2026-10-25",
    notes: "Grade 60 deformed steel bars (1/2 inch & 3/4 inch) for ground floor pillars. Weighbridge slip #4102. Fully settled.",
    created_at: "2026-10-25T09:15:00.000Z",
    updated_at: "2026-10-28T14:20:00.000Z"
  },
  {
    id: "mat-003",
    user_id: "demo-user-001",
    person_name: "Chaudhry Riasat (Chenab Sand Supply)",
    material_type: "Sand / Rait (Chenab, Ravi, Lawrencepur)",
    quantity: 4,
    unit: "Trucks",
    total_due: 180000,
    purchase_date: "2026-11-02",
    notes: "Chenab river washed coarse sand for roof screening and masonry work. 4 Dumper trucks unloaded.",
    created_at: "2026-11-02T10:00:00.000Z",
    updated_at: "2026-11-02T16:30:00.000Z"
  },
  {
    id: "mat-004",
    user_id: "demo-user-001",
    person_name: "Bismillah Bhatta (Ustad Munir)",
    material_type: "Bricks / Eint (Awwal, Doem, Bhatta)",
    quantity: 15,
    unit: "Senkrra",
    total_due: 240000,
    purchase_date: "2026-11-04",
    notes: "Awwal grade baked red clay bricks (15,000 bricks). Payment committed by coming Friday.",
    created_at: "2026-11-04T07:45:00.000Z",
    updated_at: "2026-11-04T07:45:00.000Z"
  },
  {
    id: "mat-005",
    user_id: "demo-user-001",
    person_name: "Al-Madina Marble & Tiles (Haji Qasim)",
    material_type: "Tiles & Marble",
    quantity: 1800,
    unit: "Sq. Feet",
    total_due: 450000,
    purchase_date: "2026-11-05",
    notes: "Sunny White marble slabs and kitchen porcelain tiles 24x24 inches. Invoice #1042.",
    created_at: "2026-11-05T12:00:00.000Z",
    updated_at: "2026-11-05T15:10:00.000Z"
  }
];

const DEMO_SEED_PAYMENTS = [
  {
    id: "pay-001",
    user_id: "demo-user-001",
    material_record_id: "mat-001",
    amount: 100000,
    payment_date: "2026-11-01",
    payment_method: "Bank Transfer",
    notes: "Initial 50% advance for dispatch via Meezan Bank",
    created_at: "2026-11-01T08:35:00.000Z"
  },
  {
    id: "pay-002",
    user_id: "demo-user-001",
    material_record_id: "mat-001",
    amount: 100000,
    payment_date: "2026-11-03",
    payment_method: "Cash",
    notes: "Second installment paid to truck driver upon delivery verification",
    created_at: "2026-11-03T11:00:00.000Z"
  },
  {
    id: "pay-003",
    user_id: "demo-user-001",
    material_record_id: "mat-002",
    amount: 500000,
    payment_date: "2026-10-25",
    payment_method: "Bank Transfer",
    notes: "Advance payment via online transfer",
    created_at: "2026-10-25T09:20:00.000Z"
  },
  {
    id: "pay-004",
    user_id: "demo-user-001",
    material_record_id: "mat-002",
    amount: 410000,
    payment_date: "2026-10-28",
    payment_method: "Cash",
    notes: "Final clearance upon steel bundle unloading",
    created_at: "2026-10-28T14:20:00.000Z"
  },
  {
    id: "pay-005",
    user_id: "demo-user-001",
    material_record_id: "mat-003",
    amount: 60000,
    payment_date: "2026-11-02",
    payment_method: "Cash",
    notes: "Cash paid to dumper driver Rashid",
    created_at: "2026-11-02T16:30:00.000Z"
  },
  {
    id: "pay-006",
    user_id: "demo-user-001",
    material_record_id: "mat-005",
    amount: 150000,
    payment_date: "2026-11-05",
    payment_method: "Bank Transfer",
    notes: "Online bank transfer via Allied Bank ref #992182",
    created_at: "2026-11-05T15:10:00.000Z"
  }
];

// Helper to access localStorage safely
const getStorage = () => {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
    if (typeof localStorage !== "undefined") return localStorage;
  } catch (e) {}
  return null;
};

/**
 * Reactive Local Demo Store for offline testing of Design, Edit & Delete
 */
const DemoStore = {
  _materials: null,
  _payments: null,

  _init() {
    if (this._materials !== null && this._payments !== null) return;

    const storage = getStorage();
    if (storage) {
      try {
        const savedMats = storage.getItem("construction_demo_materials_v2");
        const savedPays = storage.getItem("construction_demo_payments_v2");
        if (savedMats && savedPays) {
          this._materials = JSON.parse(savedMats);
          this._payments = JSON.parse(savedPays);
          return;
        }
      } catch (e) {
        console.warn("Could not load demo store from localStorage:", e);
      }
    }

    // Seed defaults
    this._materials = JSON.parse(JSON.stringify(DEMO_SEED_MATERIALS));
    this._payments = JSON.parse(JSON.stringify(DEMO_SEED_PAYMENTS));
    this._save();
  },

  _save() {
    const storage = getStorage();
    if (storage) {
      try {
        storage.setItem("construction_demo_materials_v2", JSON.stringify(this._materials));
        storage.setItem("construction_demo_payments_v2", JSON.stringify(this._payments));
      } catch (e) {}
    }
  },

  reset() {
    this._materials = JSON.parse(JSON.stringify(DEMO_SEED_MATERIALS));
    this._payments = JSON.parse(JSON.stringify(DEMO_SEED_PAYMENTS));
    this._save();
  },

  getMaterials() {
    this._init();
    return this._materials.map((m) => {
      const pays = this._payments.filter((p) => p.material_record_id === m.id);
      const paid = pays.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const due = m.total_due !== null && m.total_due !== undefined ? Number(m.total_due) : null;
      const pending = due !== null ? Math.max(0, due - paid) : null;

      // Automatically determine exact payment status
      let paymentStatus = "Pending";
      if (due === null) {
        paymentStatus = paid > 0 ? "Partial" : "Unset";
      } else if (due > 0 && paid >= due) {
        paymentStatus = "Paid";
      } else if (due > 0 && paid > 0 && paid < due) {
        paymentStatus = "Partial";
      } else if (due === 0) {
        paymentStatus = "Paid";
      } else {
        paymentStatus = "Pending";
      }

      return {
        ...m,
        paid_amount: paid,
        pending_amount: pending,
        payment_status: paymentStatus,
        payment_count: pays.length
      };
    }).sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date) || new Date(b.created_at) - new Date(a.created_at));
  },

  getFinancialSummary() {
    const mats = this.getMaterials();
    let totalDue = 0;
    let totalPaid = 0;
    let totalPending = 0;

    for (const m of mats) {
      totalPaid += m.paid_amount || 0;
      if (m.total_due !== null) {
        totalDue += Number(m.total_due);
        if (m.pending_amount) totalPending += m.pending_amount;
      }
    }

    return {
      total_amount_due: totalDue,
      total_paid: totalPaid,
      total_pending: totalPending,
      total_material_records: mats.length
    };
  },

  createMaterial(payload) {
    this._init();
    const newId = "mat-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    const newMat = {
      id: newId,
      user_id: "demo-user-001",
      person_name: payload.person_name || null,
      material_type: payload.material_type || null,
      quantity: payload.quantity !== "" && payload.quantity !== null && payload.quantity !== undefined ? Number(payload.quantity) : null,
      unit: payload.unit || null,
      total_due: payload.total_due !== "" && payload.total_due !== null && payload.total_due !== undefined ? Number(payload.total_due) : null,
      purchase_date: payload.purchase_date || new Date().toISOString().split("T")[0],
      notes: payload.notes || null,
      receipt_url: payload.receipt_url || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this._materials.unshift(newMat);
    this._save();
    return newMat;
  },

  updateMaterial(id, payload) {
    this._init();
    const mat = this._materials.find((m) => m.id === id);
    if (!mat) throw new Error("Material record not found in local demo store.");

    if (payload.person_name !== undefined) mat.person_name = payload.person_name || null;
    if (payload.material_type !== undefined) mat.material_type = payload.material_type || null;
    if (payload.quantity !== undefined) mat.quantity = payload.quantity !== "" && payload.quantity !== null ? Number(payload.quantity) : null;
    if (payload.unit !== undefined) mat.unit = payload.unit || null;
    if (payload.total_due !== undefined) mat.total_due = payload.total_due !== "" && payload.total_due !== null ? Number(payload.total_due) : null;
    if (payload.purchase_date !== undefined) mat.purchase_date = payload.purchase_date || null;
    if (payload.notes !== undefined) mat.notes = payload.notes || null;
    if (payload.receipt_url !== undefined) mat.receipt_url = payload.receipt_url || null;
    mat.updated_at = new Date().toISOString();

    this._save();
    return mat;
  },

  getDeletionImpact(materialRecordId) {
    this._init();
    const pays = this._payments.filter((p) => p.material_record_id === materialRecordId);
    const totalPaid = pays.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    return {
      has_payments: pays.length > 0,
      payment_count: pays.length,
      total_paid: totalPaid
    };
  },

  deleteMaterial(materialRecordId, confirmCascade = false) {
    this._init();
    const pays = this._payments.filter((p) => p.material_record_id === materialRecordId);
    if (pays.length > 0 && !confirmCascade) {
      throw new Error(`Cannot delete record: ${pays.length} payment transactions exist.`);
    }
    this._materials = this._materials.filter((m) => m.id !== materialRecordId);
    this._payments = this._payments.filter((p) => p.material_record_id !== materialRecordId);
    this._save();
    return true;
  },

  addPayment(payload) {
    this._init();
    const targetMat = this._materials.find((m) => m.id === payload.material_record_id);
    const numAmount = Number(payload.amount);

    if (numAmount <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }

    if (targetMat && targetMat.total_due !== null) {
      const curPaid = this._payments
        .filter((p) => p.material_record_id === payload.material_record_id)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const pendingBal = targetMat.total_due - curPaid;
      if (numAmount > pendingBal) {
        throw new Error(`Overpayment prohibited: Payment exceeds outstanding balance of Rs. ${pendingBal.toLocaleString()}.`);
      }
    }

    const newPay = {
      id: "pay-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      user_id: "demo-user-001",
      material_record_id: payload.material_record_id,
      amount: numAmount,
      payment_date: payload.payment_date || new Date().toISOString().split("T")[0],
      payment_method: payload.payment_method || "Cash",
      notes: payload.notes || null,
      created_at: new Date().toISOString()
    };
    this._payments.unshift(newPay);
    this._save();
    return newPay;
  },

  updatePayment(paymentId, payload) {
    this._init();
    const pay = this._payments.find((p) => p.id === paymentId);
    if (!pay) throw new Error("Payment transaction not found in local demo store.");

    const newAmount = Number(payload.amount);
    if (newAmount <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }

    const targetMat = this._materials.find((m) => m.id === pay.material_record_id);
    if (targetMat && targetMat.total_due !== null) {
      const otherPaid = this._payments
        .filter((p) => p.material_record_id === pay.material_record_id && p.id !== paymentId)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const maxAllowed = targetMat.total_due - otherPaid;
      if (newAmount > maxAllowed) {
        throw new Error(`Overpayment prohibited: Payment exceeds maximum allowable balance of Rs. ${maxAllowed.toLocaleString()}.`);
      }
    }

    pay.amount = newAmount;
    if (payload.payment_date) pay.payment_date = payload.payment_date;
    if (payload.payment_method) pay.payment_method = payload.payment_method;
    pay.notes = payload.notes !== undefined ? payload.notes : pay.notes;

    this._save();
    return pay;
  },

  deletePayment(paymentId) {
    this._init();
    this._payments = this._payments.filter((p) => p.id !== paymentId);
    this._save();
    return true;
  },

  getPaymentsForMaterial(materialRecordId) {
    this._init();
    return this._payments
      .filter((p) => p.material_record_id === materialRecordId)
      .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date) || new Date(b.created_at) - new Date(a.created_at));
  },

  getRecentPayments(limit = 5) {
    this._init();
    const sorted = [...this._payments].sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date) || new Date(b.created_at) - new Date(a.created_at));
    return sorted.slice(0, limit).map((p) => {
      const m = this._materials.find((mat) => mat.id === p.material_record_id);
      return {
        ...p,
        material_records: m ? { id: m.id, person_name: m.person_name, material_type: m.material_type } : null
      };
    });
  },

  getAllPaymentsForExport() {
    this._init();
    const sorted = [...this._payments].sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date) || new Date(b.created_at) - new Date(a.created_at));
    return sorted.map((p) => {
      const m = this._materials.find((mat) => mat.id === p.material_record_id);
      return {
        ...p,
        material_records: m ? { id: m.id, person_name: m.person_name, material_type: m.material_type } : null
      };
    });
  },

  getTopPending(limit = 5) {
    const mats = this.getMaterials();
    const pending = mats.filter((m) => m.pending_amount !== null && m.pending_amount > 0);
    pending.sort((a, b) => b.pending_amount - a.pending_amount);
    return pending.slice(0, limit);
  }
};

// ----------------------------------------------------------------------------
// DATABASE SERVICE (Dispatches to Supabase or Demo Store)
// ----------------------------------------------------------------------------
const DB = {
  /**
   * Get Supabase Client from Auth service
   */
  getClient() {
    if (typeof Auth !== "undefined" && Auth.client) {
      return Auth.client;
    }
    if (typeof Auth !== "undefined" && typeof Auth.init === "function") {
      return Auth.init();
    }
    return null;
  },

  /**
   * Reset the local demo records to the initial 5 dummy records
   */
  async resetDemoData() {
    DemoStore.reset();
    return true;
  },

  /**
   * Fetch All Material Records with Calculated Financials from View / Demo Store
   */
  async fetchMaterialRecords() {
    const supabase = this.getClient();
    if (!supabase) {
      return DemoStore.getMaterials();
    }

    const { data, error } = await supabase
      .from("material_records_view")
      .select("*")
      .order("purchase_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch Dashboard Project Financial Aggregates
   */
  async fetchFinancialSummary() {
    const supabase = this.getClient();
    if (!supabase) {
      return DemoStore.getFinancialSummary();
    }

    const { data, error } = await supabase
      .from("project_financial_summary_view")
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data || {
      total_amount_due: 0,
      total_paid: 0,
      total_pending: 0,
      total_material_records: 0
    };
  },

  /**
   * Insert New Material Record
   */
  async createMaterialRecord({ person_name, material_type, quantity, unit, total_due, purchase_date, notes, receipt_url }) {
    const supabase = this.getClient();
    if (!supabase) {
      return DemoStore.createMaterial({ person_name, material_type, quantity, unit, total_due, purchase_date, notes, receipt_url });
    }

    const user = Auth.currentUser;
    if (!user) throw new Error("Authenticated session required.");

    const { data, error } = await supabase
      .from("material_records")
      .insert({
        user_id: user.id,
        person_name: person_name || null,
        material_type: material_type || null,
        quantity: quantity !== undefined && quantity !== "" ? Number(quantity) : null,
        unit: unit || null,
        total_due: total_due !== undefined && total_due !== "" ? Number(total_due) : null,
        purchase_date: purchase_date || null,
        notes: notes || null,
        receipt_url: receipt_url || null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update Existing Material Record
   */
  async updateMaterialRecord(id, { person_name, material_type, quantity, unit, total_due, purchase_date, notes, receipt_url }) {
    const supabase = this.getClient();
    if (!supabase) {
      return DemoStore.updateMaterial(id, { person_name, material_type, quantity, unit, total_due, purchase_date, notes, receipt_url });
    }

    const updatePayload = {
      person_name: person_name || null,
      material_type: material_type || null,
      quantity: quantity !== undefined && quantity !== "" ? Number(quantity) : null,
      unit: unit || null,
      total_due: total_due !== undefined && total_due !== "" ? Number(total_due) : null,
      purchase_date: purchase_date || null,
      notes: notes || null,
      updated_at: new Date().toISOString()
    };

    if (receipt_url !== undefined) {
      updatePayload.receipt_url = receipt_url || null;
    }

    const { data, error } = await supabase
      .from("material_records")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Query Material Record Deletion Impact (Inspects Associated Payments)
   */
  async getDeletionImpact(materialRecordId) {
    const supabase = this.getClient();
    if (!supabase) {
      return DemoStore.getDeletionImpact(materialRecordId);
    }

    const { data, error } = await supabase.rpc("get_material_deletion_impact", {
      p_material_record_id: materialRecordId
    });

    if (error) throw error;
    return data;
  },

  /**
   * Explicitly Delete Material Record (Safe Transactional Deletion)
   */
  async deleteMaterialRecordExplicit(materialRecordId, confirmPaymentDeletion = false) {
    const supabase = this.getClient();
    if (!supabase) {
      return DemoStore.deleteMaterial(materialRecordId, confirmPaymentDeletion);
    }

    const { data, error } = await supabase.rpc("delete_material_record_explicit", {
      p_material_record_id: materialRecordId,
      p_confirm_payment_deletion: confirmPaymentDeletion
    });

    if (error) throw error;
    return data;
  },

  /**
   * Add a Payment Transaction
   * The database trigger automatically validates that payment <= pending balance!
   */
  async addPayment({ material_record_id, amount, payment_date, payment_method, notes }) {
    const supabase = this.getClient();
    if (!supabase) {
      return DemoStore.addPayment({ material_record_id, amount, payment_date, payment_method, notes });
    }

    const user = Auth.currentUser;
    if (!user) throw new Error("Authenticated session required.");

    const { data, error } = await supabase
      .from("payments")
      .insert({
        user_id: user.id,
        material_record_id,
        amount: Number(amount),
        payment_date: payment_date || new Date().toISOString().split("T")[0],
        payment_method: payment_method || "Cash",
        notes: notes || null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update an Existing Payment Transaction
   * The database trigger automatically validates that the new amount <= outstanding balance!
   */
  async updatePayment(paymentId, { amount, payment_date, payment_method, notes }) {
    const supabase = this.getClient();
    if (!supabase) {
      return DemoStore.updatePayment(paymentId, { amount, payment_date, payment_method, notes });
    }

    const { data, error } = await supabase
      .from("payments")
      .update({
        amount: Number(amount),
        payment_date: payment_date || new Date().toISOString().split("T")[0],
        payment_method: payment_method || "Cash",
        notes: notes || null
      })
      .eq("id", paymentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a Payment Transaction
   * Automatically causes view to recalculate Paid and Pending balances
   */
  async deletePayment(paymentId) {
    const supabase = this.getClient();
    if (!supabase) {
      return DemoStore.deletePayment(paymentId);
    }

    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("id", paymentId);

    if (error) throw error;
    return true;
  },

  /**
   * Fetch All Payments for a Given Material Record
   */
  async fetchPaymentsForMaterial(materialRecordId) {
    const supabase = this.getClient();
    if (!supabase) {
      return DemoStore.getPaymentsForMaterial(materialRecordId);
    }

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("material_record_id", materialRecordId)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch Recent Payment Transactions with Parent Material Record Details
   */
  async fetchRecentPayments(limit = 5) {
    const supabase = this.getClient();
    if (!supabase) {
      return DemoStore.getRecentPayments(limit);
    }

    const { data, error } = await supabase
      .from("payments")
      .select("id, amount, payment_date, payment_method, notes, created_at, material_records(id, person_name, material_type)")
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch All Payment Transactions with Parent Material Record Details for Export
   */
  async fetchAllPaymentsForExport() {
    const supabase = this.getClient();
    if (!supabase) {
      return DemoStore.getAllPaymentsForExport();
    }

    const { data, error } = await supabase
      .from("payments")
      .select("id, material_record_id, amount, payment_date, payment_method, notes, created_at, material_records(id, person_name, material_type)")
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch Top Pending Balances Sorted by Highest Outstanding Amount
   */
  async fetchTopPendingMaterials(limit = 5) {
    const supabase = this.getClient();
    if (!supabase) {
      return DemoStore.getTopPending(limit);
    }

    const { data, error } = await supabase
      .from("material_records_view")
      .select("*")
      .not("pending_amount", "is", null)
      .gt("pending_amount", 0)
      .order("pending_amount", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }
};

// Bind to window for global access
if (typeof window !== "undefined") {
  window.DB = DB;
}
