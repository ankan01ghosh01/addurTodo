window.addEventListener("scroll", () => {
    if (window.scrollY >= 220) {
        document.querySelector(".navbar-app").classList.add("shadow-sm");
    } else {
        document.querySelector(".navbar-app").classList.remove("shadow-sm");
    }
});



const dropdown = document.getElementById("notifDropdown");
const btn = document.getElementById("notifBtn");

btn.addEventListener("click", () => {
    dropdown.classList.toggle("hidden");
});

async function loadNotifications() {
    const res = await fetch("/notifications");
    const data = await res.json();

    dropdown.innerHTML = "";

    if (data.length === 0) {
        dropdown.innerHTML = "<p class='text-sm text-gray-500'>No notifications</p>";
        return;
    }

    data.forEach(task => {
        const div = document.createElement("div");
        div.className = "p-2 bg-gray-100 rounded-lg text-sm";
        div.innerText = `⏰ Reminder: ${task.task}`;
        dropdown.appendChild(div);
    });
}

// 🔁 Poll every 30 seconds
setInterval(loadNotifications, 30000);

// initial load
loadNotifications();
