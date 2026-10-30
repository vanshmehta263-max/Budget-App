const $ = (id) => document.getElementById(id);

const STORE = "budgetBuddyV2Data";

const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(n) || 0);

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

const icons = {
  Food: "🍜",
  Shopping: "🛍️",
  Travel: "🚕",
  Bills: "🧾",
  Education: "📚",
  Health: "💊",
  Salary: "💼",
  Other: "💳"
};

let state = loadState();

// LOAD DATA
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));

    if (saved && Array.isArray(saved.transactions)) {
      return {
        transactions: [],
        budget: 10000,
        goal: {
          name: "New laptop",
          target: 50000,
          saved: 0
        },
        ...saved
      };
    }
  } catch (e) {}

  return {
    transactions: [],
    budget: 10000,
    goal: {
      name: "New laptop",
      target: 50000,
      saved: 0
    }
  };
}

// SAVE DATA
function save() {
  localStorage.setItem(STORE, JSON.stringify(state));
}

// CURRENT MONTH TRANSACTIONS
function monthTransactions() {
  const m = today().slice(0, 7);

  return state.transactions.filter(t =>
    t.date && t.date.slice(0, 7) === m
  );
}

// CALCULATE TOTALS
function totals(list = state.transactions) {
  return list.reduce((a, t) => {
    a[t.type] += Number(t.amount);
    return a;
  }, {
    income: 0,
    expense: 0
  });
}

// UPDATE DASHBOARD
function render() {
  const t = totals();

  const balance = t.income - t.expense;

  const rate = t.income
    ? Math.max(0, Math.round(balance / t.income * 100))
    : 0;

  $("balance").textContent = money(balance);
  $("income").textContent = money(t.income);
  $("expense").textContent = money(t.expense);
  $("savingRate").textContent = rate + "%";

  renderChart();
  renderCategories();
  renderBudget();
  renderGoal();
  renderTransactions();
}

// DRAW CHART
function renderChart() {
  const canvas = $("spendingChart");
  const ctx = canvas.getContext("2d");

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const pad = 24;

  const months = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);

    const key =
      d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0");

    months.push({
      key,
      label: d.toLocaleString("en-IN", {
        month: "short"
      })
    });
  }

  const values = months.map(m => {
    const a = totals(
      state.transactions.filter(t =>
        t.date && t.date.startsWith(m.key)
      )
    );

    return { ...m, ...a };
  });

  const max = Math.max(
    1,
    ...values.flatMap(v => [v.income, v.expense])
  );

  $("chartEmpty").style.display =
    state.transactions.length ? "none" : "grid";

  ctx.clearRect(0, 0, w, h);
  ctx.font = "10px DM Sans";
  ctx.textAlign = "center";

  // GRID LINES
  for (let i = 0; i < 4; i++) {
    const y = pad + i * (h - pad - 22) / 3;

    ctx.strokeStyle =
      getComputedStyle(document.body)
        .getPropertyValue("--line");

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const group = w / 6;
  const barW = Math.min(13, group * .23);
  const base = h - 22;

  values.forEach((v, i) => {
    const x = group * i + group / 2;

    const hi =
      (v.income / max) * (h - pad - 30);

    const he =
      (v.expense / max) * (h - pad - 30);

    ctx.fillStyle = "#20b889";
    roundRect(ctx, x - barW - 2, base - hi, barW, hi, 4);
    ctx.fill();

    ctx.fillStyle = "#ef6c91";
    roundRect(ctx, x + 2, base - he, barW, he, 4);
    ctx.fill();

    ctx.fillStyle =
      getComputedStyle(document.body)
        .getPropertyValue("--muted");

    ctx.fillText(v.label, x, h - 5);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  if (h < 1) return;

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// CATEGORY BREAKDOWN
function renderCategories() {
  const expenses = state.transactions.filter(
    t => t.type === "expense"
  );

  const groups = {};

  expenses.forEach(t => {
    groups[t.category] =
      (groups[t.category] || 0) + Number(t.amount);
  });

  const sorted = Object.entries(groups)
    .sort((a, b) => b[1] - a[1]);

  const total = sorted.reduce(
    (s, x) => s + x[1], 0
  );

  $("categoryList").innerHTML = sorted.length
    ? sorted.slice(0, 5).map(([name, val]) => `
      <div class="category-row">

        <div class="category-name">
          <span class="category-emoji">
            ${icons[name] || "💳"}
          </span>
          ${escapeHtml(name)}
        </div>

        <span class="category-value">
          ${money(val)}
        </span>

        <div class="mini-track">
          <div class="mini-fill"
            style="width:${total ? val / total * 100 : 0}%">
          </div>
        </div>

      </div>
    `).join("")
    : '<div class="empty-small">Your category breakdown will appear here.</div>';
}

// MONTHLY BUDGET
function renderBudget() {
  const spent = monthTransactions()
    .filter(t => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  const limit = Number(state.budget) || 0;

  const pct = limit
    ? Math.round(spent / limit * 100)
    : 0;

  $("budgetSpent").textContent = money(spent);
  $("budgetLimit").textContent = money(limit);

  $("budgetRemaining").textContent =
    money(Math.max(0, limit - spent)) + " remaining";

  $("budgetPercent").textContent = pct + "%";

  $("budgetProgress").style.width =
    Math.min(100, pct) + "%";

  $("budgetProgress").style.background =
    pct > 100 ? "#ef6c91" : "";

  $("budgetTip").textContent =
    pct > 100
      ? "You've crossed your monthly budget. Review your expenses."
      : pct >= 80
      ? "You're close to your budget limit. Spend mindfully."
      : "You're doing well. Keep tracking your spending!";
}

// SAVINGS GOAL
function renderGoal() {
  const g = state.goal;

  const p = g.target
    ? Math.min(100, Math.round(g.saved / g.target * 100))
    : 0;

  $("goalName").textContent = g.name;
  $("goalPercent").textContent = p + "%";

  $("goalProgress").style.width = p + "%";

  $("goalSaved").textContent =
    money(g.saved) + " saved";

  $("goalTarget").textContent =
    "Target " + money(g.target);
}

// TRANSACTION TABLE
function renderTransactions() {
  const q = $("searchInput").value.toLowerCase();
  const type = $("filterType").value;
  const cat = $("filterCategory").value;

  const list = [...state.transactions]
    .filter(t =>
      (type === "all" || t.type === type) &&
      (cat === "all" || t.category === cat) &&
      (`${t.name} ${t.category} ${t.date}`
        .toLowerCase().includes(q))
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  $("transactionRows").innerHTML = list.length
    ? list.map(t => `
      <tr>

        <td>
          <div class="tx-name">
            <span class="tx-icon">
              ${icons[t.category] || "💳"}
            </span>

            <span>
              ${escapeHtml(t.name)}
              <span class="tx-sub">
                ${escapeHtml(t.category)}
              </span>
            </span>
          </div>
        </td>

        <td>
          <span class="type-tag ${t.type}">
            ${t.type === "income" ? "Income" : "Expense"}
          </span>
        </td>

        <td>${formatDate(t.date)}</td>

        <td class="${t.type === "income" ? "positive" : "negative"}">
          ${t.type === "income" ? "+" : "−"}${money(t.amount)}
        </td>

        <td>
          <div class="row-actions">
            <button onclick="editTransaction('${t.id}')">✎</button>
            <button onclick="deleteTransaction('${t.id}')">×</button>
          </div>
        </td>

      </tr>
    `).join("")
    : '<tr><td colspan="5" class="empty-row">No matching transactions found.</td></tr>';

  $("transactionCount").textContent =
    `${list.length} transaction${list.length === 1 ? "" : "s"}`;
}

// SECURITY: ESCAPE USER TEXT
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

// FORMAT DATE
function formatDate(s) {
  if (!s) return "—";

  return new Date(s + "T00:00:00")
    .toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
}

// TOAST MESSAGE
function toast(msg) {
  const el = $("toast");

  el.textContent = msg;
  el.classList.add("show");

  setTimeout(() => {
    el.classList.remove("show");
  }, 2300);
}

// OPEN TRANSACTION FORM
function openTransaction(t) {
  $("transactionForm").reset();

  $("editId").value = t?.id || "";

  $("formTitle").textContent =
    t ? "Edit transaction" : "Add transaction";

  $("txName").value = t?.name || "";
  $("txAmount").value = t?.amount || "";
  $("txType").value = t?.type || "expense";
  $("txCategory").value = t?.category || "Food";
  $("txDate").value = t?.date || today();

  $("transactionDialog").showModal();
}

// EDIT TRANSACTION
function editTransaction(id) {
  const t = state.transactions.find(
    x => String(x.id) === String(id)
  );

  if (t) openTransaction(t);
}

// DELETE TRANSACTION
function deleteTransaction(id) {
  if (!confirm("Delete this transaction?")) return;

  state.transactions = state.transactions.filter(
    t => String(t.id) !== String(id)
  );

  save();
  render();
  toast("Transaction deleted.");
}

// ADD TRANSACTION BUTTON
$("openAdd").addEventListener("click", () => {
  openTransaction();
});

// SAVE TRANSACTION
$("transactionForm").addEventListener("submit", e => {
  e.preventDefault();

  const id = $("editId").value;

  const tx = {
    id: id || String(Date.now()),
    name: $("txName").value.trim(),
    amount: Number($("txAmount").value),
    type: $("txType").value,
    category: $("txCategory").value,
    date: $("txDate").value
  };

  if (!tx.name || tx.amount <= 0 || !tx.date) return;

  if (id) {
    state.transactions = state.transactions.map(t =>
      String(t.id) === id ? tx : t
    );
  } else {
    state.transactions.push(tx);
  }

  save();
  render();

  $("transactionDialog").close();

  toast(id
    ? "Transaction updated."
    : "Transaction added."
  );
});

// EDIT BUDGET
$("editBudgetBtn").addEventListener("click", () => {
  $("budgetInput").value = state.budget;
  $("budgetDialog").showModal();
});

// SAVE BUDGET
$("budgetForm").addEventListener("submit", e => {
  e.preventDefault();

  state.budget = Number($("budgetInput").value);

  save();
  render();

  $("budgetDialog").close();
  toast("Monthly budget updated.");
});

// EDIT SAVINGS GOAL
$("editGoalBtn").addEventListener("click", () => {
  $("goalNameInput").value = state.goal.name;
  $("goalTargetInput").value = state.goal.target;
  $("goalSavedInput").value = state.goal.saved;

  $("goalDialog").showModal();
});

// SAVE SAVINGS GOAL
$("goalForm").addEventListener("submit", e => {
  e.preventDefault();

  state.goal = {
    name: $("goalNameInput").value.trim(),
    target: Number($("goalTargetInput").value),
    saved: Number($("goalSavedInput").value)
  };

  save();
  render();

  $("goalDialog").close();
  toast("Savings goal updated.");
});

// CLOSE DIALOGS
document.querySelectorAll("[data-close]").forEach(b => {
  b.addEventListener("click", () => {
    $(b.dataset.close).close();
  });
});

// SEARCH AND FILTER
["searchInput", "filterType", "filterCategory"].forEach(id => {
  $(id).addEventListener(
    id === "searchInput" ? "input" : "change",
    renderTransactions
  );
});

// EXPORT CSV
$("exportBtn").addEventListener("click", () => {
  if (!state.transactions.length) {
    toast("No transactions to export.");
    return;
  }

  const rows = [
    ["Name", "Type", "Category", "Date", "Amount"],
    ...state.transactions.map(t => [
      t.name, t.type, t.category, t.date, t.amount
    ])
  ];

  const csv = rows.map(r =>
    r.map(v =>
      `"${String(v).replace(/"/g, '""')}"`
    ).join(",")
  ).join("\n");

  const blob = new Blob([csv], {
    type: "text/csv"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "budget-buddy-transactions.csv";
  a.click();

  URL.revokeObjectURL(url);

  toast("CSV exported.");
});

// DARK MODE
$("themeBtn").addEventListener("click", () => {
  document.body.classList.toggle("dark");

  localStorage.setItem(
    "budgetBuddyDark",
    document.body.classList.contains("dark") ? "1" : "0"
  );

  renderChart();
});

if (localStorage.getItem("budgetBuddyDark") === "1") {
  document.body.classList.add("dark");
}

// MOBILE MENU
$("menuBtn").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
});

document.querySelectorAll(".nav-link").forEach(a => {
  a.addEventListener("click", () => {
    $("sidebar").classList.remove("open");
  });
});

// DATE AND INITIAL DISPLAY
$("todayLabel").textContent =
  new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

window.addEventListener("resize", renderChart);

// START APP
render();