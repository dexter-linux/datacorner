// DataCorner Ocean-Themed Application Logic & Firebase Integration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  doc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyA-jYi-vtRHyS3Oc9J6mSKtYgzhqNJJbGo",
  authDomain: "datacorner-f2c7e.firebaseapp.com",
  projectId: "datacorner-f2c7e",
  storageBucket: "datacorner-f2c7e.firebasestorage.app",
  messagingSenderId: "530169307147",
  appId: "1:530169307147:web:6050507859baf3786e670e",
  measurementId: "G-Q6BTYDHDB7"
};

// Initialize Firebase SDKs
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Application State
let currentTab = "marketing";
let isAdminAuthenticated = false;

// Register Service Worker for PWA Offline Capability
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then((reg) => console.log("Service Worker registered successfully:", reg.scope))
      .catch((err) => console.warn("Service Worker registration failed:", err));
  });
}

// DOM Elements
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupClientSubmission();
  setupLiveChat();
  setupAdminConsole();
  setupBlogPublisher();

  // Initial Firestore Realtime Data Listeners
  listenToBlogs();
  listenToProjects();
  listenToChatMessages();
});

// --- NAVIGATION & TAB SWITCHING ---
function setupNavigation() {
  const tabs = {
    marketing: { btn: document.getElementById("tab-marketing"), sec: document.getElementById("section-marketing") },
    client: { btn: document.getElementById("tab-client"), sec: document.getElementById("section-client") },
    chat: { btn: document.getElementById("tab-chat"), sec: document.getElementById("section-chat") },
    admin: { btn: document.getElementById("tab-admin"), sec: document.getElementById("section-admin") }
  };

  const navHome = document.getElementById("nav-home");
  if (navHome) {
    navHome.addEventListener("click", () => switchTab("marketing"));
  }

  Object.keys(tabs).forEach((key) => {
    if (tabs[key].btn) {
      tabs[key].btn.addEventListener("click", () => switchTab(key));
    }
  });

  function switchTab(targetTab) {
    currentTab = targetTab;
    Object.keys(tabs).forEach((key) => {
      const isSelected = key === targetTab;
      if (tabs[key].sec) {
        tabs[key].sec.classList.toggle("hidden", !isSelected);
      }
      if (tabs[key].btn) {
        if (isSelected) {
          tabs[key].btn.className = "px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-medium transition-all text-white bg-cyan-600/50 border border-cyan-400/40 shadow-sm flex items-center space-x-2";
        } else {
          tabs[key].btn.className = "px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-medium transition-all text-cyan-200/80 hover:text-white hover:bg-white/10 flex items-center space-x-2";
        }
      }
    });
  }
}

// --- CLIENT SUBMISSION & FIRESTORE STORAGE ---
function setupClientSubmission() {
  const form = document.getElementById("project-submit-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("client-name");
    const titleInput = document.getElementById("project-title");
    const categoryInput = document.getElementById("project-category");
    const descInput = document.getElementById("project-desc");
    const fileInput = document.getElementById("project-file");

    const submitBtn = form.querySelector("button[type='submit']");
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Uploading...</span>`;

    try {
      let fileUrl = "";
      let fileName = "";

      if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        fileName = file.name;
        const storageRef = ref(storage, `projects/${Date.now()}_${file.name}`);
        const uploadSnapshot = await uploadBytes(storageRef, file);
        fileUrl = await getDownloadURL(uploadSnapshot.ref);
      }

      await addDoc(collection(db, "projects"), {
        clientName: nameInput.value.trim(),
        title: titleInput.value.trim(),
        category: categoryInput.value,
        description: descInput.value.trim(),
        fileUrl: fileUrl,
        fileName: fileName,
        status: "Pending",
        deliverableUrl: "",
        createdAt: serverTimestamp()
      });

      form.reset();
      alert("Project submitted successfully! You can track its progress in your dashboard.");
    } catch (err) {
      console.error("Error submitting project:", err);
      alert("Failed to submit project. Please try again.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });
}

// Listen for Projects Realtime Updates
function listenToProjects() {
  const clientProjectsList = document.getElementById("client-projects-list");
  const adminProjectsList = document.getElementById("admin-projects-list");

  const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
  
  onSnapshot(q, (snapshot) => {
    if (clientProjectsList) clientProjectsList.innerHTML = "";
    if (adminProjectsList) adminProjectsList.innerHTML = "";

    if (snapshot.empty) {
      const emptyHtml = `<div class="p-6 text-center text-xs text-cyan-200/60 ocean-card rounded-2xl">No projects found. Submit a new requirement to get started!</div>`;
      if (clientProjectsList) clientProjectsList.innerHTML = emptyHtml;
      if (adminProjectsList) adminProjectsList.innerHTML = emptyHtml;
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const id = docSnap.id;
      const statusColor = getStatusBadgeColor(data.status);

      // Render Client View
      if (clientProjectsList) {
        const clientCard = document.createElement("div");
        clientCard.className = "ocean-card rounded-2xl p-5 space-y-3";
        clientCard.innerHTML = `
          <div class="flex justify-between items-start">
            <div>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 font-semibold">${escapeHtml(data.category)}</span>
              <h4 class="text-base font-bold text-white mt-1">${escapeHtml(data.title)}</h4>
            </div>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor}">${escapeHtml(data.status)}</span>
          </div>
          <p class="text-xs text-cyan-100/70 leading-relaxed">${escapeHtml(data.description)}</p>
          <div class="pt-2 border-t border-cyan-500/20 flex justify-between items-center text-xs">
            ${data.fileUrl ? `<a href="${data.fileUrl}" target="_blank" class="text-cyan-300 hover:underline flex items-center space-x-1"><i class="fa-solid fa-paperclip"></i><span>${escapeHtml(data.fileName || "View Attachment")}</span></a>` : `<span class="text-cyan-100/40">No File Attached</span>`}
            ${data.deliverableUrl ? `<a href="${data.deliverableUrl}" target="_blank" class="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-xl font-bold hover:bg-emerald-500/30 flex items-center space-x-1"><i class="fa-solid fa-download"></i><span>Download Solution</span></a>` : `<span class="text-cyan-100/40">In Progress</span>`}
          </div>
        `;
        clientProjectsList.appendChild(clientCard);
      }

      // Render Admin View
      if (adminProjectsList) {
        const adminCard = document.createElement("div");
        adminCard.className = "ocean-card rounded-2xl p-5 space-y-4";
        adminCard.innerHTML = `
          <div class="flex flex-wrap justify-between items-start gap-2">
            <div>
              <div class="flex items-center space-x-2">
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 font-semibold">${escapeHtml(data.category)}</span>
                <span class="text-xs text-cyan-200/80">Client: <strong>${escapeHtml(data.clientName)}</strong></span>
              </div>
              <h4 class="text-base font-bold text-white mt-1">${escapeHtml(data.title)}</h4>
            </div>
            <div class="flex items-center space-x-2">
              <select class="admin-status-select ocean-input text-xs py-1 px-2" data-id="${id}">
                <option value="Pending" ${data.status === "Pending" ? "selected" : ""}>Pending</option>
                <option value="In Progress" ${data.status === "In Progress" ? "selected" : ""}>In Progress</option>
                <option value="Completed" ${data.status === "Completed" ? "selected" : ""}>Completed</option>
              </select>
            </div>
          </div>
          <p class="text-xs text-cyan-100/70 leading-relaxed">${escapeHtml(data.description)}</p>
          <div class="pt-2 border-t border-cyan-500/20 flex flex-wrap justify-between items-center gap-2 text-xs">
            <div>
              ${data.fileUrl ? `<a href="${data.fileUrl}" target="_blank" class="text-cyan-300 hover:underline flex items-center space-x-1"><i class="fa-solid fa-file-arrow-down"></i><span>Client File: ${escapeHtml(data.fileName || "Download")}</span></a>` : `<span class="text-cyan-100/40">No client attachment</span>`}
            </div>
            <div class="flex items-center space-x-2">
              <input type="file" class="admin-deliverable-input text-[10px] text-cyan-200 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-cyan-600 file:text-white" data-id="${id}" />
            </div>
          </div>
        `;
        adminProjectsList.appendChild(adminCard);
      }
    });

    // Attach Admin Event Listeners for Status and Deliverables
    attachAdminListeners();
  });
}

function attachAdminListeners() {
  document.querySelectorAll(".admin-status-select").forEach((select) => {
    select.addEventListener("change", async (e) => {
      const docId = e.target.getAttribute("data-id");
      const newStatus = e.target.value;
      try {
        await updateDoc(doc(db, "projects", docId), { status: newStatus });
      } catch (err) {
        console.error("Error updating status:", err);
      }
    });
  });

  document.querySelectorAll(".admin-deliverable-input").forEach((input) => {
    input.addEventListener("change", async (e) => {
      const docId = e.target.getAttribute("data-id");
      const file = e.target.files[0];
      if (!file) return;

      try {
        const storageRef = ref(storage, `deliverables/${Date.now()}_${file.name}`);
        const uploadSnapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(uploadSnapshot.ref);

        await updateDoc(doc(db, "projects", docId), {
          deliverableUrl: url,
          status: "Completed"
        });
        alert("Completed deliverable uploaded and sent to client!");
      } catch (err) {
        console.error("Error uploading deliverable:", err);
        alert("Failed to upload deliverable file.");
      }
    });
  });
}

// --- REALTIME CHAT SYSTEM ---
function setupLiveChat() {
  const chatForm = document.getElementById("chat-form");
  const msgInput = document.getElementById("chat-message-input");
  const usernameInput = document.getElementById("chat-username-input");

  if (!chatForm) return;

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = msgInput.value.trim();
    const user = usernameInput.value.trim() || "Anonymous";

    if (!text) return;

    try {
      await addDoc(collection(db, "messages"), {
        sender: user,
        text: text,
        isAdmin: isAdminAuthenticated,
        createdAt: serverTimestamp()
      });
      msgInput.value = "";
    } catch (err) {
      console.error("Error sending message:", err);
    }
  });
}

function listenToChatMessages() {
  const container = document.getElementById("chat-messages");
  if (!container) return;

  const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));

  onSnapshot(q, (snapshot) => {
    container.innerHTML = "";
    if (snapshot.empty) {
      container.innerHTML = `<div class="text-center text-xs text-cyan-200/50 my-auto">No messages yet. Send a query to chat with the admin!</div>`;
      return;
    }

    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      const isMe = msg.isAdmin ? isAdminAuthenticated : !isAdminAuthenticated;
      
      const msgBubble = document.createElement("div");
      msgBubble.className = `flex flex-col ${isMe ? "items-end" : "items-start"} space-y-1`;
      
      msgBubble.innerHTML = `
        <span class="text-[10px] text-cyan-200/60 px-1">${escapeHtml(msg.sender)}${msg.isAdmin ? " (Admin)" : ""}</span>
        <div class="max-w-[80%] rounded-2xl px-4 py-2 text-xs leading-relaxed ${
          msg.isAdmin 
            ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-none shadow-md" 
            : isMe 
            ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-none shadow-md" 
            : "ocean-card text-cyan-100 rounded-bl-none"
        }">
          ${escapeHtml(msg.text)}
        </div>
      `;
      container.appendChild(msgBubble);
    });

    container.scrollTop = container.scrollHeight;
  });
}

// --- ADMIN AUTHENTICATION ---
function setupAdminConsole() {
  const loginBtn = document.getElementById("admin-login-btn");
  const passInput = document.getElementById("admin-pass-input");
  const lockScreen = document.getElementById("admin-lock-screen");
  const dashboard = document.getElementById("admin-dashboard");
  const usernameInput = document.getElementById("chat-username-input");

  if (!loginBtn) return;

  loginBtn.addEventListener("click", () => {
    if (passInput.value.trim() === "admin123") {
      isAdminAuthenticated = true;
      lockScreen.classList.add("hidden");
      dashboard.classList.remove("hidden");
      if (usernameInput) usernameInput.value = "Admin (DataCorner)";
      listenToChatMessages(); // Refresh chat UI for admin view
    } else {
      alert("Invalid Admin Passkey!");
    }
  });
}

// --- MARKETING BLOG PUBLISHER ---
function setupBlogPublisher() {
  const blogForm = document.getElementById("blog-publish-form");
  if (!blogForm) return;

  blogForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("blog-title").value.trim();
    const category = document.getElementById("blog-category").value.trim();
    const content = document.getElementById("blog-content").value.trim();

    try {
      await addDoc(collection(db, "blogs"), {
        title: title,
        category: category,
        content: content,
        createdAt: serverTimestamp()
      });
      blogForm.reset();
      alert("Blog post published to the landing page!");
    } catch (err) {
      console.error("Error publishing blog:", err);
      alert("Failed to publish blog post.");
    }
  });
}

function listenToBlogs() {
  const blogContainer = document.getElementById("blog-posts-container");
  if (!blogContainer) return;

  const q = query(collection(db, "blogs"), orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    blogContainer.innerHTML = "";

    if (snapshot.empty) {
      blogContainer.innerHTML = `
        <div class="col-span-full ocean-card rounded-2xl p-6 text-center text-xs text-cyan-100/60">
          No case studies published yet. Check back soon for data science insights!
        </div>
      `;
      return;
    }

    snapshot.forEach((docSnap) => {
      const blog = docSnap.data();
      const card = document.createElement("div");
      card.className = "ocean-card rounded-2xl p-6 space-y-3";
      card.innerHTML = `
        <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">${escapeHtml(blog.category)}</span>
        <h4 class="text-lg font-bold text-white">${escapeHtml(blog.title)}</h4>
        <p class="text-xs text-cyan-100/80 leading-relaxed">${escapeHtml(blog.content)}</p>
      `;
      blogContainer.appendChild(card);
    });
  });
}

// --- HELPER UTILITIES ---
function getStatusBadgeColor(status) {
  switch (status) {
    case "Completed":
      return "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30";
    case "In Progress":
      return "bg-amber-500/20 text-amber-300 border border-amber-400/30";
    default:
      return "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30";
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
