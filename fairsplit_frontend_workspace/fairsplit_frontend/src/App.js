import React, { useState, useEffect, useRef } from "react";
import "./App.css";

// Theme colors: #4F8DFF (primary), #FF5C8D (secondary), #FFDB58 (accent)
const COLORS = {
  primary: "#4F8DFF",
  secondary: "#FF5C8D",
  accent: "#FFDB58",
  white: "#fff",
};

// UTILS
// PUBLIC_INTERFACE
function formatCurrency(amount) {
  return amount == null || isNaN(amount)
    ? "-"
    : `${amount < 0 ? "-" : ""}$${Math.abs(amount).toFixed(2)}`;
}

// PUBLIC_INTERFACE
function getLocalData() {
  try {
    const data = JSON.parse(localStorage.getItem("fairsplit-data"));
    if (!data) return { people: [], expenses: [] };
    return data;
  } catch {
    return { people: [], expenses: [] };
  }
}
// PUBLIC_INTERFACE
function setLocalData(data) {
  localStorage.setItem("fairsplit-data", JSON.stringify(data));
}

// PUBLIC_INTERFACE
function calculateBalances(people, expenses) {
  const balances = {};
  people.forEach((p) => {
    balances[p.id] = 0;
  });
  expenses.forEach((expense) => {
    const { payer, split, amount } = expense;
    const n = split.length;
    if (n === 0) return;
    const portion = amount / n;
    split.forEach((personId) => {
      if (personId === payer) {
        balances[payer] += amount - portion;
      } else {
        balances[personId] -= portion;
      }
    });
  });
  return balances;
}

// PUBLIC_INTERFACE
function getDebtGraph(people, balances) {
  // Greedy minimize cashflow
  const nodes = [];
  people.forEach((p) => {
    nodes.push({ ...p, balance: balances[p.id] || 0 });
  });
  const debtors = [...nodes].filter((n) => n.balance < -0.01);
  const creditors = [...nodes].filter((n) => n.balance > 0.01);
  const settlements = [];
  let d = 0,
    c = 0;
  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];
    const settleAmount = Math.min(
      -debtor.balance,
      creditor.balance
    );
    settlements.push({
      from: debtor,
      to: creditor,
      amount: settleAmount,
    });
    debtor.balance += settleAmount;
    creditor.balance -= settleAmount;
    if (Math.abs(debtor.balance) < 0.01) d++;
    if (Math.abs(creditor.balance) < 0.01) c++;
  }
  return settlements;
}

// Fade In Animation Wrapper
function FadeIn({ children, delay = 0, style = {}, ...rest }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timeout = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);
  return (
    <div
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0px)" : "translateY(24px)",
        transition: "all 0.6s cubic-bezier(.62,1.38,.47,.9)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

// Floating Action Button (FAB)
function FAB({ icon, children, onClick, style, ...rest }) {
  return (
    <button
      className="fab"
      style={{
        background: `linear-gradient(90deg, ${COLORS.primary} 70%, ${COLORS.accent} 100%)`,
        color: COLORS.white,
        boxShadow: "0 4px 12px rgba(79,141,255,.16)",
        ...style,
      }}
      onClick={onClick}
      {...rest}
    >
      {icon}
      <span style={{ marginLeft: 8 }}>{children}</span>
    </button>
  );
}

// Modal (mobile-first, pop-in animation)
function Modal({ open, onClose, children }) {
  return open ? (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        aria-modal="true"
        role="dialog"
      >
        {children}
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ✖
        </button>
      </div>
    </div>
  ) : null;
}

// PUBLIC_INTERFACE
function App() {
  // PAGE: "dashboard", "people", "expenses", "summary"
  const [page, setPage] = useState("dashboard");

  // App data
  const [{ people, expenses }, setData] = useState(() => getLocalData());

  // Modal state
  const [modal, setModal] = useState(null); // string: null|"person"|"expense"

  // Animation
  const [showNav, setShowNav] = useState(false);

  // For Add/Edit forms
  const [editPerson, setEditPerson] = useState(null);
  const [editExpense, setEditExpense] = useState(null);

  // Load state from localStorage
  useEffect(() => {
    setShowNav(true);
    // Listen to LS updates (multi-tab safety)
    const handleStorage = () => {
      setData(getLocalData());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Save state to LocalStorage on change
  useEffect(() => {
    setLocalData({ people, expenses });
  }, [people, expenses]);

  // Derived
  const balances = calculateBalances(people, expenses);
  const settlements = getDebtGraph(people, balances);

  // Add/Edit Person Logic
  function handleAddPerson(personName, color, id = null) {
    if (!personName || !personName.trim()) return false;
    setData(({ people, expenses }) => {
      if (
        people.some(
          (p) =>
            p.name.trim().toLowerCase() === personName.trim().toLowerCase() &&
            (!id || p.id !== id)
        )
      )
        return { people, expenses }; // Duplicate name
      if (id) {
        // Edit
        return {
          people: people.map((p) =>
            p.id === id ? { ...p, name: personName, color } : p
          ),
          expenses,
        };
      }
      // Add
      const newId = Date.now().toString();
      return {
        people: [
          ...people,
          {
            id: newId,
            name: personName.trim(),
            color:
              color ||
              COLORS[
                ["primary", "secondary", "accent"][
                  people.length % 3
                ]
              ],
          },
        ],
        expenses,
      };
    });
    return true;
  }
  function handleDeletePerson(personId) {
    setData(({ people, expenses }) => ({
      people: people.filter((p) => p.id !== personId),
      expenses: expenses.filter(
        (e) => e.payer !== personId && !e.split.includes(personId)
      ),
    }));
  }

  // Add/Edit Expense Logic
  function handleAddExpense(expense, id = null) {
    setData(({ people, expenses }) => {
      if (id) {
        // Edit
        return {
          people,
          expenses: expenses.map((e) =>
            e.id === id ? { ...expense, id } : e
          ),
        };
      } else {
        return {
          people,
          expenses: [
            ...expenses,
            { ...expense, id: Date.now().toString() },
          ],
        };
      }
    });
  }
  function handleDeleteExpense(expenseId) {
    setData(({ people, expenses }) => ({
      people,
      expenses: expenses.filter((e) => e.id !== expenseId),
    }));
  }

  // NAVIGATION + Floating Bar
  const NAV_ITEMS = [
    {
      key: "dashboard",
      icon: "🏠",
      label: "Dashboard",
    },
    {
      key: "people",
      icon: "👥",
      label: "People",
    },
    {
      key: "expenses",
      icon: "💸",
      label: "Expenses",
    },
    {
      key: "summary",
      icon: "📊",
      label: "Summary",
    },
  ];

  // Mobile FABs
  const canAddPerson = page === "people";
  const canAddExpense = page === "expenses";

  // Theme
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Export/Import JSON (for fun: power user)
  function handleExport() {
    const blob = new Blob(
      [JSON.stringify({ people, expenses }, null, 2)],
      { type: "application/json" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "fairsplit.json";
    a.click();
  }
  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const obj = JSON.parse(evt.target.result);
        if (
          Array.isArray(obj.people) &&
          Array.isArray(obj.expenses)
        ) {
          setData({
            people: obj.people,
            expenses: obj.expenses,
          });
        } else {
          alert("Invalid FairSplit backup.");
        }
      } catch {
        alert("Could not import data.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="App fairsplit-root">
      <nav
        className="fairsplit-navbar"
        role="navigation"
        style={{
          background:
            "linear-gradient(90deg,#4F8DFF 72%,#FFDB58 97%)",
          borderBottom: "3px solid #FF5C8D",
          boxShadow: "0 3px 12px -6px #4F8DFF33",
        }}
      >
        <FadeIn
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontWeight: "800",
              letterSpacing: "1.6px",
              fontFamily: "Montserrat, sans-serif",
              fontSize: "1.4rem",
              color: "#fff",
              textShadow: "0 3px 12px #4F8DFF33",
              userSelect: "none",
              padding: "8px 0 8px 12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span
              role="img"
              aria-label="logo"
              style={{
                fontSize: "1.75rem",
                filter: "drop-shadow(0 1px 6px #FF5C8D66)",
              }}
            >
              💡
            </span>
            FairSplit
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button
              title="Toggle Theme"
              className="theme-toggle"
              style={{
                background: theme === "light" ? COLORS.secondary : COLORS.primary,
                color: theme === "light" ? "#fff" : "#fff",
                fontSize: "1.05rem",
                padding: "6px 16px",
                marginRight: "6px",
                minWidth: "auto",
                borderRadius: "16px",
              }}
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
            <div className="desktop-extras">
              <button className="btn-link" style={{ fontSize: 13 }} onClick={handleExport} title="Export your data">
                ⬇️ Backup
              </button>
              <label className="btn-link" style={{ fontSize: 13, cursor: "pointer", margin: 0 }}>
                ⬆️ Import
                <input
                  type="file"
                  accept="application/json"
                  style={{ display: "none" }}
                  onChange={handleImport}
                  aria-label="Import backup"
                />
              </label>
            </div>
          </div>
        </FadeIn>
      </nav>

      <div className="fairsplit-body">
        {page === "dashboard" && (
          <DashboardPage
            people={people}
            expenses={expenses}
            balances={balances}
            settlements={settlements}
            onGoTo={(dest) => setPage(dest)}
            onAddFirstPerson={() => { setPage("people"); setModal("person"); }}
          />
        )}

        {page === "people" && (
          <PeoplePage
            people={people}
            onAdd={() => { setEditPerson(null); setModal("person"); }}
            onEdit={(person) => { setEditPerson(person); setModal("person"); }}
            onDelete={handleDeletePerson}
            balances={balances}
          />
        )}

        {page === "expenses" && (
          <ExpensesPage
            expenses={expenses}
            people={people}
            onAdd={() => { setEditExpense(null); setModal("expense"); }}
            onEdit={(expense) => { setEditExpense(expense); setModal("expense"); }}
            onDelete={handleDeleteExpense}
          />
        )}

        {page === "summary" && (
          <SummaryPage
            people={people}
            balances={balances}
            settlements={settlements}
          />
        )}
      </div>

      {/* MODALS */}
      <Modal
        open={modal === "person"}
        onClose={() => { setModal(null); setEditPerson(null); }}
      >
        <AddPersonForm
          person={editPerson}
          onSave={(name, color) => {
            const success = handleAddPerson(name, color, editPerson?.id || null);
            if (success) {
              setModal(null);
              setEditPerson(null);
            }
          }}
        />
      </Modal>
      <Modal
        open={modal === "expense"}
        onClose={() => { setModal(null); setEditExpense(null); }}
      >
        <AddExpenseForm
          people={people}
          expense={editExpense}
          onSave={(exp) => {
            handleAddExpense(exp, editExpense?.id || null);
            setModal(null);
            setEditExpense(null);
          }}
        />
      </Modal>

      {/* Floating Action Bar (FAB group, mobile-responsive) */}
      <div className="fairsplit-fabbar" aria-label="Action bar">
        <FadeIn delay={100}>
          {canAddPerson && (
            <FAB
              icon="➕"
              style={{ background: COLORS.secondary }}
              onClick={() => { setEditPerson(null); setModal("person"); }}
            >
              Person
            </FAB>
          )}
          {canAddExpense && (
            <FAB
              icon="💸"
              style={{ background: COLORS.primary }}
              onClick={() => { setEditExpense(null); setModal("expense"); }}
            >
              Expense
            </FAB>
          )}
        </FadeIn>
      </div>

      {/* NAVIGATION */}
      <FadeIn delay={showNav ? 100 : 350}>
        <nav className="fairsplit-tabbar" role="tablist" aria-label="Page navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              aria-label={item.label}
              className={`tabbar-btn${page === item.key ? " tabbar-btn-active" : ""}`}
              style={{
                color: page === item.key ? COLORS.secondary : COLORS.primary,
                borderBottom: page === item.key ? `3px solid ${COLORS.secondary}` : "0",
                fontWeight: page === item.key ? 700 : 500,
                fontSize: 14,
                flex: 1,
                padding: "8px 0 6px",
                background: "none",
                transition: "color .22s",
              }}
              onClick={() => setPage(item.key)}
              tabIndex={0}
            >
              <span style={{ fontSize: 21 }}>{item.icon}</span>
              <div>{item.label}</div>
            </button>
          ))}
        </nav>
      </FadeIn>

      {/* Minimal Footer */}
      <footer
        style={{
          textAlign: "center",
          fontSize: 13,
          color: "#888",
          margin: "16px 0 4px",
          opacity: 0.7,
        }}
      >
        <span role="img" aria-label="copyright">
          ©
        </span>{" "}
        {new Date().getFullYear()} FairSplit &nbsp;|&nbsp;{" "}
        <span style={{ color: COLORS.primary, fontWeight: 600 }}>All local data</span>
      </footer>
    </div>
  );
}

// Dashboard Page: pie chart, quick summary, total balance, main actions.
function DashboardPage({ people, expenses, balances, settlements, onGoTo, onAddFirstPerson }) {
  const isEmpty = people.length === 0;
  const totalSpent = expenses.reduce((sum, e) => sum + +e.amount, 0);
  const owes = settlements.length > 0 ? settlements[0].from : null;
  const isMobile = window.innerWidth <= 600;

  return (
    <FadeIn delay={60} style={{ maxWidth: 580, margin: "4vw auto", width: "98%" }}>
      <div className="dashboard-card">
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 700, fontSize: "1.2rem", color: COLORS.primary }}>
            Welcome to FairSplit!
          </span>
        </div>
        {isEmpty ? (
          <div style={{ marginTop: 36, marginBottom: 36, textAlign: "center" }}>
            <div style={{ fontSize: 54, fontWeight: 300, margin: "0 0 6px" }}>👥</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Add your first person to begin</div>
            <FAB icon={<span>➕</span>} style={{ margin: "14px auto 0", display: "block" }} onClick={onAddFirstPerson}>
              Add Person
            </FAB>
          </div>
        ) : (
          <>
            <div style={{ minHeight: 200, padding: "10px 0 0" }}>
              <PieChart balances={balances} people={people} />
            </div>
            <div className="dashboard-actions" style={{ display: "flex", gap: "10px", margin: "18px 0 0" }}>
              <button className="btn-action" onClick={() => onGoTo("expenses")}>
                Log Expense
              </button>
              <button className="btn-action" onClick={() => onGoTo("people")}>
                Manage People
              </button>
              <button className="btn-action" onClick={() => onGoTo("summary")}>
                Balances
              </button>
            </div>
            <div style={{ marginTop: 16, fontSize: 15 }}>
              <span style={{ color: "#456", opacity: 0.69 }}>Total Spent: </span>
              <span style={{ color: COLORS.secondary, fontWeight: 700 }}>
                {formatCurrency(totalSpent)}
              </span>
            </div>
          </>
        )}
      </div>
    </FadeIn>
  );
}

// PieChart: Render a vibrant circular pie of balances
function PieChart({ balances, people }) {
  // Gather sorted balances, skip $0
  const slices = people
    .map((p) => ({ ...p, value: Math.abs(balances[p.id] || 0) }))
    .filter((p) => p.value > 0.01)
    .sort((a, b) => b.value - a.value);

  const total = slices.reduce((s, p) => s + p.value, 0);
  let accAngle = 0;
  let cy = 60, cx = 60, r = 56;

  // Assign colors
  const palette = [COLORS.primary, COLORS.secondary, COLORS.accent, "#6ee7b7", "#f472b6"];
  return (
    <svg width="120" height="120" style={{ display: "block", margin: "0 auto" }}>
      <circle cx={cx} cy={cy} r={r} fill="#fff" />
      {slices.map((s, idx) => {
        const v = s.value;
        const angle = (v / total) * 360;
        const largeArc = angle > 180 ? 1 : 0;
        const theta = ((accAngle + angle) * Math.PI) / 180;
        const x1 = cx + r * Math.cos((accAngle * Math.PI) / 180);
        const y1 = cy + r * Math.sin((accAngle * Math.PI) / 180);
        const x2 = cx + r * Math.cos(theta);
        const y2 = cy + r * Math.sin(theta);
        const path = `
          M ${cx} ${cy}
          L ${x1} ${y1}
          A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}
          Z
        `;
        accAngle += angle;
        return (
          <path
            key={s.id}
            d={path}
            fill={palette[idx % palette.length] + "CC"}
            stroke="#fff"
            strokeWidth="2"
          />
        );
      })}
      {/* Legend */}
      {slices.map((s, idx) => (
        <g key={s.id}>
          <rect x="10" y={100 + idx * 12} width="12" height="8" rx="2" fill={palette[idx % palette.length]} />
          <text x="27" y={107 + idx * 12} fontSize="9" fill="#333">{s.name}</text>
        </g>
      ))}
      {/* Center */}
      <circle cx={cx} cy={cy} r={30} fill="#f9fafb" stroke={COLORS.primary + "22"} strokeWidth="2" />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        fontWeight="bold"
        fontSize="20"
        fill={COLORS.secondary}
        dy="7"
      >
        {slices.length}
      </text>
    </svg>
  );
}

// PeoplePage
function PeoplePage({ people, onAdd, onEdit, onDelete, balances }) {
  return (
    <FadeIn delay={50} style={{ maxWidth: 440, margin: "18px auto 0" }}>
      <div className="page-header">
        <span className="page-title">
          <span role="img" aria-label="people">👥</span> People
        </span>
        <button onClick={onAdd} className="btn-action" style={{ marginLeft: 14 }}>Add</button>
      </div>
      <div className="people-list">
        {people.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 0" }}>
            <div style={{ fontSize: 34 }}>✨</div>
            <div>No people yet. Add someone!</div>
          </div>
        ) : (
          people.map((p) => (
            <FadeIn key={p.id} delay={65}>
              <div className="person-card" tabIndex={0} aria-label={`Edit or remove ${p.name}`}>
                <span
                  className="person-avatar"
                  style={{
                    background: p.color || COLORS.accent,
                    boxShadow: "0 2px 6px " + (p.color || COLORS.primary) + "29",
                  }}
                  aria-label={p.name}
                >
                  {p.name[0] || "?"}
                </span>
                <div className="person-name">{p.name}</div>
                <div className="person-balance" title="Net balance">
                  {formatCurrency(balances[p.id])}
                </div>
                <div className="person-actions">
                  <button className="btn-link" onClick={() => onEdit(p)} title="Edit">✏️</button>
                  <button className="btn-link" onClick={() => onDelete(p.id)} title="Remove">🗑️</button>
                </div>
              </div>
            </FadeIn>
          ))
        )}
      </div>
    </FadeIn>
  );
}

// ExpensesPage
function ExpensesPage({ expenses, people, onAdd, onEdit, onDelete }) {
  return (
    <FadeIn delay={50} style={{ maxWidth: 520, margin: "18px auto 0", width: "98%" }}>
      <div className="page-header">
        <span className="page-title">
          <span role="img" aria-label="expenses">💸</span> Expenses
        </span>
        <button onClick={onAdd} className="btn-action" style={{ marginLeft: 14 }}>Add</button>
      </div>
      <div className="expense-list">
        {expenses.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 0" }}>
            <div style={{ fontSize: 34 }}>🧾</div>
            <div>No expenses yet. Add your first expense!</div>
          </div>
        ) : (
          expenses
            .slice()
            .reverse()
            .map((e) => (
              <FadeIn key={e.id} delay={60}>
                <div className="expense-card" tabIndex={0} aria-label={`Edit or remove expense ${e.title}`}>
                  <div className="expense-info">
                    <div className="expense-title">{e.title}</div>
                    <div className="expense-meta">
                      Paid by: <strong>{people.find((p) => p.id === e.payer)?.name || "?"}</strong>
                      <span>
                        {" "}on{" "}
                        <span style={{ color: COLORS.primary, fontSize: "0.95em" }}>
                          {e.date || "(unknown)"}
                        </span>
                      </span>
                    </div>
                    <div className="expense-amount">{formatCurrency(e.amount)}</div>
                  </div>
                  <div className="expense-split">
                    <span className="expense-split-label">Split: </span>
                    {e.split.length === people.length
                      ? <span className="expense-split-all">everyone</span>
                      : e.split.map((pid) => (
                        <span
                          key={pid}
                          className="expense-split-person"
                          style={{
                            background: people.find((p) => p.id === pid)?.color || COLORS.accent,
                          }}
                        >
                          {people.find((p) => p.id === pid)?.name || "?"}
                        </span>
                      ))}
                  </div>
                  <div className="expense-actions">
                    <button className="btn-link" onClick={() => onEdit(e)} title="Edit">✏️</button>
                    <button className="btn-link" onClick={() => onDelete(e.id)} title="Remove">🗑️</button>
                  </div>
                </div>
              </FadeIn>
            ))
        )}
      </div>
    </FadeIn>
  );
}

// SummaryPage: "Who owes whom" list + chart
function SummaryPage({ people, balances, settlements }) {
  return (
    <FadeIn delay={60} style={{ maxWidth: 470, margin: "16px auto" }}>
      <div className="page-header">
        <span className="page-title">
          <span role="img" aria-label="summary">📊</span> Balances & Settlements
        </span>
      </div>
      <div className="summary-settlements">
        {settlements.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 0" }}>
            <div style={{ fontSize: 34 }}>🎉</div>
            <div>All settled up! No pending debts.</div>
          </div>
        ) : (
          settlements.map((s, i) => (
            <FadeIn key={i} delay={64 + i * 25}>
              <div className="settlement-card">
                <span
                  className="settlement-avatar"
                  style={{ background: s.from.color || COLORS.secondary }}
                >{s.from.name[0]}</span>
                <span className="settlement-label">
                  <span style={{ fontWeight: 600, color: COLORS.secondary }}>{s.from.name}</span>
                  <span style={{ color: "#111", fontWeight: 500, fontSize: "1.07em", margin: "0 8px" }}>
                    owes
                  </span>
                  <span style={{ fontWeight: 700, color: COLORS.primary }}>{s.to.name}</span>
                </span>
                <span
                  className="settlement-amount"
                  style={{
                    color: COLORS.accent,
                  }}
                >
                  {formatCurrency(s.amount)}
                </span>
              </div>
            </FadeIn>
          ))
        )}
      </div>
      <div className="summary-balances">
        <h4 style={{ margin: "18px 0 0 0", color: "#7c7c7c", fontSize: 15, fontWeight: 600, letterSpacing: ".01em" }}>
          Net Balances
        </h4>
        {people.map((p) => (
          <div className="summary-balance-row" key={p.id}>
            <span className="summary-avatar" style={{ background: p.color || COLORS.accent }}>{p.name[0]}</span>
            <span className="summary-name">{p.name}</span>
            <span className="summary-balance-val" style={{
              color: balances[p.id] > 0.01 ? COLORS.secondary :
                balances[p.id] < -0.01 ? COLORS.primary : "#aaa"
            }}>
              {formatCurrency(balances[p.id])}
            </span>
          </div>
        ))}
      </div>
    </FadeIn>
  );
}

// Modal: Add/Edit Person Form
function AddPersonForm({ person, onSave }) {
  const [name, setName] = useState(person?.name || "");
  const [color, setColor] = useState(person?.color || COLORS.accent);
  const inputRef = useRef();
  useEffect(() => {
    setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 90);
  }, []);
  return (
    <div className="modal-form modal-form-person">
      <div className="modal-form-title">{person ? "Edit Person" : "Add Person"}</div>
      <label className="modal-form-label">Name</label>
      <input
        ref={inputRef}
        className="modal-form-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={30}
        placeholder="Person's name"
        aria-label="Person name"
        data-testid="add-person-input"
      />
      <label className="modal-form-label">Color</label>
      <input
        className="modal-form-input"
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        style={{ width: 44, padding: 0, height: 35, border: "none", background: "none" }}
        aria-label="Person color"
      />
      <button
        className="btn-action"
        style={{ marginTop: 22 }}
        onClick={() => onSave(name, color)}
        disabled={!name.trim()}
        data-testid="save-person-btn"
      >
        {person ? "Save Changes" : "Add"}
      </button>
    </div>
  );
}

// Modal: Add/Edit Expense Form
function AddExpenseForm({ people, expense, onSave }) {
  const [title, setTitle] = useState(expense?.title || "");
  const [amount, setAmount] = useState(expense?.amount?.toString() || "");
  const [payer, setPayer] = useState(expense?.payer || (people[0] && people[0].id) || "");
  const [split, setSplit] = useState(expense?.split || people.map((p) => p.id));
  const [date, setDate] = useState(expense?.date || new Date().toISOString().slice(0, 10));
  const inputRef = useRef();

  useEffect(() => {
    setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 110);
  }, []);

  function handleToggleSplit(pid) {
    setSplit((old) =>
      old.includes(pid) ? old.filter((id) => id !== pid) : [...old, pid]
    );
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!title || !amount || !payer || !split.length) return;
    onSave({
      title: title.trim(),
      amount: parseFloat(amount),
      payer,
      split,
      date,
    });
  }

  return (
    <form className="modal-form modal-form-expense" onSubmit={handleSubmit}>
      <div className="modal-form-title">{expense ? "Edit Expense" : "Add Expense"}</div>
      <label className="modal-form-label">Title</label>
      <input
        ref={inputRef}
        className="modal-form-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={40}
        placeholder="e.g. Dinner, Groceries"
        aria-label="Expense title"
        data-testid="expense-title-input"
      />
      <label className="modal-form-label">Amount ($)</label>
      <input
        className="modal-form-input"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        type="number"
        step="0.01"
        min="0.01"
        placeholder="Total amount"
        aria-label="Expense amount"
        data-testid="expense-amount-input"
      />
      <label className="modal-form-label">Paid by</label>
      <select
        className="modal-form-input"
        value={payer}
        onChange={(e) => setPayer(e.target.value)}
        aria-label="Paid by"
        data-testid="expense-payer-select"
      >
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <label className="modal-form-label">Split between</label>
      <div className="split-list">
        {people.map((p) => (
          <label
            key={p.id}
            className="split-option"
            style={{
              background: split.includes(p.id) ? p.color || COLORS.primary : "#e6e6e610",
              color: split.includes(p.id) ? "#fff" : "#999",
              margin: "0 6px 6px 0",
              padding: "7px 14px 7px 3px",
              borderRadius: "21px",
              shift: "box-shadow 0.16s",
              fontSize: 15,
            }}
          >
            <input
              type="checkbox"
              checked={split.includes(p.id)}
              onChange={() => handleToggleSplit(p.id)}
              style={{ marginRight: 7, accentColor: p.color || COLORS.primary }}
              aria-label={`Split with ${p.name}`}
            />
            <span>{p.name}</span>
          </label>
        ))}
      </div>
      <label className="modal-form-label">Date</label>
      <input
        className="modal-form-input"
        type="date"
        value={date}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(e) => setDate(e.target.value)}
        aria-label="Expense date"
      />
      <button
        className="btn-action"
        type="submit"
        style={{ marginTop: 18 }}
        disabled={!title.trim() || !amount || !payer || !split.length}
        data-testid="save-expense-btn"
      >
        {expense ? "Save Changes" : "Add"}
      </button>
    </form>
  );
}

export default App;
