// src/app.js
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const datePicker = document.getElementById("datePicker");
const remainingEl = document.getElementById("remaining");
const addBtn = document.getElementById("addActivity");
const analyseBtn = document.getElementById("analyseBtn");
const listEl = document.getElementById("activities");
const noDataEl = document.getElementById("noData");
const dashboardEl = document.getElementById("dashboard");
const totalHoursEl = document.getElementById("totalHours");
const activityCountEl = document.getElementById("activityCount");

let userId = null;
let currentDate = null;
let totalMinutes = 0;
let pieChart = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }
  userId = user.uid;
  // Default date: today
  const today = new Date().toISOString().slice(0, 10);
  datePicker.value = today;
  currentDate = today;
  loadActivities();
});

document.getElementById("signOut").onclick = async () => {
  await signOut(auth);
  window.location.href = "./index.html";
};

datePicker.onchange = async () => {
  currentDate = datePicker.value;
  loadActivities();
};

addBtn.onclick = async () => {
  if (!currentDate) {
    alert("Pick a date first.");
    return;
  }
  const name = document.getElementById("activityName").value.trim();
  const category = document.getElementById("activityCategory").value.trim();
  const minutes = Number(document.getElementById("activityMinutes").value);
  if (!name || !minutes || minutes <= 0) {
    alert("Enter a valid activity name and minutes.");
    return;
  }
  if (totalMinutes + minutes > 1440) {
    alert("Total minutes for the day cannot exceed 1440.");
    return;
  }

  const col = collection(db, "users", userId, "days", currentDate, "activities");
  await addDoc(col, {
    name,
    category,
    minutes,
    createdAt: serverTimestamp(),
  });

  // Clear inputs
  document.getElementById("activityName").value = "";
  document.getElementById("activityCategory").value = "";
  document.getElementById("activityMinutes").value = "";

  await loadActivities();
};

analyseBtn.onclick = async () => {
  // In this implementation, analyse triggers a re-render of the dashboard for the selected date
  await renderDashboard();
};

async function loadActivities() {
  listEl.innerHTML = "";
  totalMinutes = 0;

  const col = collection(db, "users", userId, "days", currentDate, "activities");
  const snap = await getDocs(col);
  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));

  if (items.length === 0) {
    showNoData(true);
  } else {
    showNoData(false);
  }

  items.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  items.forEach((it) => renderItem(it));

  updateRemaining();
  updateAnalyseState();
  await renderDashboard(items);
}

function renderItem(item) {
  totalMinutes += Number(item.minutes) || 0;

  const li = document.createElement("li");

  const info = document.createElement("div");
  info.className = "item-info";
  const title = document.createElement("div");
  title.className = "item-title";
  title.textContent = item.name;
  const meta = document.createElement("div");
  meta.className = "item-meta";
  meta.textContent = `${item.category?.trim() || "Uncategorized"} • ${item.minutes}m`;
  info.appendChild(title);
  info.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "item-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "btn ok";
  editBtn.textContent = "Edit";
  editBtn.onclick = async () => {
    const newName = prompt("Update activity name:", item.name);
    if (newName === null) return;

    const newCategory = prompt("Update category:", item.category || "");
    if (newCategory === null) return;

    const newMinutesStr = prompt("Update minutes:", String(item.minutes));
    if (newMinutesStr === null) return;
    const newMinutes = Number(newMinutesStr);
    if (!newName.trim() || !newMinutes || newMinutes <= 0) {
      alert("Invalid values.");
      return;
    }

    // Recalculate: new total = old total - item.minutes + newMinutes
    const projected = totalMinutes - Number(item.minutes) + newMinutes;
    if (projected > 1440) {
      alert("Updating exceeds daily limit of 1440 minutes.");
      return;
    }

    await updateDoc(doc(db, "users", userId, "days", currentDate, "activities", item.id), {
      name: newName.trim(),
      category: newCategory.trim(),
      minutes: newMinutes,
    });

    await loadActivities();
  };

  const delBtn = document.createElement("button");
  delBtn.className = "btn danger";
  delBtn.textContent = "Delete";
  delBtn.onclick = async () => {
    await deleteDoc(doc(db, "users", userId, "days", currentDate, "activities", item.id));
    await loadActivities();
  };

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  li.appendChild(info);
  li.appendChild(actions);
  listEl.appendChild(li);
}

function showNoData(flag) {
  noDataEl.classList.toggle("hidden", !flag);
  dashboardEl.classList.toggle("hidden", flag);
}

function updateRemaining() {
  const remaining = Math.max(0, 1440 - totalMinutes);
  remainingEl.textContent = `Remaining: ${remaining} minutes`;
}

function updateAnalyseState() {
  // Enable Analyse if there's at least one activity and total ≤ 1440
  analyseBtn.disabled = totalMinutes <= 0 || totalMinutes > 1440;
}

async function renderDashboard(itemsArg) {
  const items = itemsArg ?? (await fetchItems());
  // Totals
  const activityCount = items.length;
  const totalHours = (totalMinutes / 60).toFixed(2);
  activityCountEl.textContent = activityCount;
  totalHoursEl.textContent = `${totalHours}h`;

  // Category aggregation
  const byCat = {};
  for (const it of items) {
    const key = it.category?.trim() || "Uncategorized";
    byCat[key] = (byCat[key] || 0) + (Number(it.minutes) || 0);
  }

  const labels = Object.keys(byCat);
  const data = Object.values(byCat);

  const ctx = document.getElementById("pieChart").getContext("2d");
  if (pieChart) pieChart.destroy();
  pieChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: [
            "#4F46E5",
            "#22C55E",
            "#EF4444",
            "#F59E0B",
            "#06B6D4",
            "#A855F7",
            "#64748B",
          ],
          borderColor: "#0f172a",
        },
      ],
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        tooltip: { enabled: true },
      },
    },
  });
}

async function fetchItems() {
  const col = collection(db, "users", userId, "days", currentDate, "activities");
  const snap = await getDocs(col);
  const items = [];
  snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
  return items;
}