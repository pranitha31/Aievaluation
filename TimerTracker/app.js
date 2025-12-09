import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection, doc, setDoc, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let user;
let totalMinutes = 0;
let chart;

window.login = async () => {
  const email = email.value;
  const pass = password.value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch {
    await createUserWithEmailAndPassword(auth, email, pass);
  }
};

window.logout = () => signOut(auth);

onAuthStateChanged(auth, u => {
  if (u) {
    user = u;
    loginPage.classList.add("hidden");
    app.classList.remove("hidden");
    datePicker.valueAsDate = new Date();
    loadData();
  } else {
    loginPage.classList.remove("hidden");
    app.classList.add("hidden");
  }
});

async function loadData() {
  totalMinutes = 0;
  activityList.innerHTML = "";
  dashboard.classList.add("hidden");
  noData.classList.add("hidden");

  const date = datePicker.value;
  const ref = collection(db, "users", user.uid, "days", date, "activities");
  const snap = await getDocs(ref);

  if (snap.empty) {
    noData.classList.remove("hidden");
    return;
  }

  snap.forEach(d => {
    const a = d.data();
    totalMinutes += a.minutes;
    activityList.innerHTML += `<li>${a.title} - ${a.minutes} mins</li>`;
  });

  updateRemaining();
}

window.addActivity = async () => {
  const mins = +minutes.value;
  if (totalMinutes + mins > 1440) {
    alert("Cannot exceed 1440 minutes");
    return;
  }

  const date = datePicker.value;
  await setDoc(
    doc(collection(db, "users", user.uid, "days", date, "activities")),
    {
      title: title.value,
      category: category.value,
      minutes: mins
    }
  );

  loadData();
};

function updateRemaining() {
  remaining.innerText = `Remaining: ${1440 - totalMinutes} mins`;
  analyseBtn.disabled = totalMinutes === 0;
}

window.analyse = async () => {
  dashboard.classList.remove("hidden");
  noData.classList.add("hidden");

  const date = datePicker.value;
  const ref = collection(db, "users", user.uid, "days", date, "activities");
  const snap = await getDocs(ref);

  const categories = {};
  snap.forEach(d => {
    const a = d.data();
    categories[a.category] = (categories[a.category] || 0) + a.minutes;
  });

  if (chart) chart.destroy();
  chart = new Chart(pieChart, {
    type: "pie",
    data: {
      labels: Object.keys(categories),
      datasets: [{
        data: Object.values(categories),
      }]
    }
  });
};

datePicker.addEventListener("change", loadData);
