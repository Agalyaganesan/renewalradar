
const API = "/api/subscriptions";

const $ = (id) => document.getElementById(id);

let subscriptions = [];

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data;
}

async function loadSubscriptions() {
  try {
    subscriptions = await request(API);
    renderSubscriptions();
  } catch (error) {
    $("subscriptionList").innerHTML =
      `<tr><td colspan="7" class="empty">
        Unable to load subscriptions. Please refresh.
      </td></tr>`;
    console.error(error);
  }
}

function renderSubscriptions() {
  const filter = $("statusFilter").value;

  const filtered = subscriptions.filter(item =>
    filter === "all" || item.status === filter
  );

  $("subscriptionList").innerHTML = filtered.length
    ? filtered.map(item => `
      <tr>
        <td><strong>${escapeHTML(item.name)}</strong></td>
        <td>${escapeHTML(item.provider || "-")}</td>
        <td>${escapeHTML(item.currency)} ${Number(item.amount).toFixed(2)}</td>
        <td>${escapeHTML(item.billing_cycle)}</td>
        <td>${escapeHTML(String(item.renewal_date).slice(0, 10))}</td>
        <td>
          <span class="badge ${item.status === "cancelled" ? "cancelled" : ""}">
            ${escapeHTML(item.status)}
          </span>
        </td>
        <td>
          <button class="action-btn" data-edit="${item.id}">Edit</button>
          <button class="action-btn delete-btn" data-delete="${item.id}">Delete</button>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="7" class="empty">No subscriptions found.</td></tr>`;

  $("totalCount").textContent = subscriptions.length;
  $("activeCount").textContent =
    subscriptions.filter(item => item.status === "active").length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  $("upcomingCount").textContent =
    subscriptions.filter(item => {
      const date = new Date(String(item.renewal_date).slice(0, 10) + "T00:00:00");
      const days = (date - today) / 86400000;
      return item.status === "active" && days >= 0 && days <= 30;
    }).length;

  const monthly = subscriptions
    .filter(item => item.status === "active")
    .reduce((sum, item) => {
      const amount = Number(item.amount);
      const multiplier = {
        weekly: 52 / 12,
        monthly: 1,
        quarterly: 1 / 3,
        yearly: 1 / 12
      }[item.billing_cycle] || 1;

      return sum + amount * multiplier;
    }, 0);

  $("monthlySpend").textContent = monthly.toFixed(2);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function openModal(item = null) {
  $("subscriptionForm").reset();
  $("editId").value = item?.id || "";
  $("modalTitle").textContent = item ? "Edit subscription" : "Add subscription";

  if (item) {
    $("name").value = item.name;
    $("provider").value = item.provider || "";
    $("amount").value = item.amount;
    $("currency").value = item.currency;
    $("billingCycle").value = item.billing_cycle;
    $("renewalDate").value = String(item.renewal_date).slice(0, 10);
    $("notes").value = item.notes || "";
  }

  $("modal").classList.remove("hidden");
}

function closeModal() {
  $("modal").classList.add("hidden");
}

$("addBtn").addEventListener("click", () => openModal());
$("closeBtn").addEventListener("click", closeModal);
$("statusFilter").addEventListener("change", renderSubscriptions);

$("subscriptionForm").addEventListener("submit", async event => {
  event.preventDefault();

  const id = $("editId").value;

  const data = {
    name: $("name").value.trim(),
    provider: $("provider").value.trim(),
    amount: Number($("amount").value),
    currency: $("currency").value,
    billing_cycle: $("billingCycle").value,
    renewal_date: $("renewalDate").value,
    notes: $("notes").value
  };

  try {
    await request(id ? `${API}/${id}` : API, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(data)
    });

    closeModal();
    await loadSubscriptions();
    alert("Subscription saved successfully!");
  } catch (error) {
    alert(error.message);
  }
});

$("subscriptionList").addEventListener("click", async event => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;

  if (editId) {
    const item = subscriptions.find(item => item.id == editId);
    if (item) openModal(item);
  }

  if (deleteId && confirm("Delete this subscription?")) {
    try {
      await request(`${API}/${deleteId}`, { method: "DELETE" });
      await loadSubscriptions();
    } catch (error) {
      alert(error.message);
    }
  }
});

loadSubscriptions();
