
import { supabase } from "./supabase-config.js";

const message = document.getElementById("message");

async function protectDashboard() {
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    window.location.href = "admin-login.html";
    return false;
  }

  const { data: admin, error } = await supabase
    .from("admin_users")
    .select("role")
    .eq("user_id", sessionData.session.user.id)
    .maybeSingle();

  if (error || !admin || admin.role !== "super_admin") {
    await supabase.auth.signOut();
    window.location.href = "admin-login.html";
    return false;
  }

  return true;
}

async function loadDashboard() {
  const [reports, visits, stats] = await Promise.all([
    supabase.from("campaign_reports").select("*", { count: "exact", head: true }),
    supabase.from("campaign_visits").select("*", { count: "exact", head: true }),
    supabase.from("campaign_statistics").select("registered_members, volunteers")
  ]);

  if (reports.error || visits.error || stats.error) {
    message.textContent = "Could not load dashboard data.";
    return;
  }

  document.getElementById("reportCount").textContent = reports.count ?? 0;
  document.getElementById("visitCount").textContent = visits.count ?? 0;

  const totals = stats.data.reduce((sum, row) => ({
    members: sum.members + row.registered_members,
    volunteers: sum.volunteers + row.volunteers
  }), { members: 0, volunteers: 0 });

  document.getElementById("memberCount").textContent = totals.members;
  document.getElementById("volunteerCount").textContent = totals.volunteers;

  loadVisits();
}

async function loadVisits() {
  const list = document.getElementById("visitsList");

  const { data, error } = await supabase
    .from("campaign_visits")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    list.textContent = "Unable to load visits.";
    return;
  }

  list.replaceChildren();

  if (!data.length) {
    list.textContent = "No campaign visits recorded yet.";
    return;
  }

  data.forEach(visit => {
    const item = document.createElement("div");
    item.className = "visit";

    const heading = document.createElement("strong");
    heading.textContent = `${visit.location_name} — ${visit.lga}`;

    const details = document.createElement("p");
    details.textContent = `Status: ${visit.visit_status} | ${new Date(visit.created_at).toLocaleString()}`;

    item.append(heading, details);

    if (visit.visit_notes) {
      const notes = document.createElement("p");
      notes.textContent = visit.visit_notes;
      item.append(notes);
    }

    list.append(item);
  });
}

document.getElementById("gpsBtn").addEventListener("click", () => {
  if (!navigator.geolocation) {
    message.textContent = "GPS is not supported by this browser.";
    return;
  }

  message.textContent = "Getting GPS location...";

  navigator.geolocation.getCurrentPosition(
    position => {
      document.getElementById("latitude").value = position.coords.latitude;
      document.getElementById("longitude").value = position.coords.longitude;
      message.textContent = "GPS location captured.";
    },
    error => {
      message.textContent = "GPS error: " + error.message;
    },
    { enableHighAccuracy: true, timeout: 15000 }
  );
});

document.getElementById("visitForm").addEventListener("submit", async event => {
  event.preventDefault();
  message.textContent = "Saving visit...";

  const visit = {
    lga: document.getElementById("lga").value,
    location_name: document.getElementById("location").value.trim(),
    latitude: document.getElementById("latitude").value
      ? Number(document.getElementById("latitude").value) : null,
    longitude: document.getElementById("longitude").value
      ? Number(document.getElementById("longitude").value) : null,
    visit_status: document.getElementById("status").value,
    visit_notes: document.getElementById("notes").value.trim()
  };

  const { error } = await supabase
    .from("campaign_visits")
    .insert(visit);

  if (error) {
    message.textContent = "Save failed: " + error.message;
    return;
  }

  event.target.reset();
  message.textContent = "Campaign visit saved successfully.";
  loadDashboard();
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "admin-login.html";
});

if (await protectDashboard()) {
  loadDashboard();
}


const campaignMap = L.map("campaignMap").setView([11.5, 10.0], 8);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(campaignMap);

async function loadCampaignMap() {
  const { data, error } = await supabase
    .from("campaign_visits")
    .select("location_name, lga, latitude, longitude, visit_status")
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (error) {
    console.error(error);
    return;
  }

  data.forEach(visit => {
    L.marker([visit.latitude, visit.longitude])
      .addTo(campaignMap)
      .bindPopup(`
        <strong>${visit.location_name}</strong><br>
        LGA: ${visit.lga}<br>
        Status: ${visit.visit_status}
      `);
  });
}

loadCampaignMap();

supabase
  .channel("campaign-visits-live")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "campaign_visits"
    },
    () => {
      campaignMap.eachLayer(layer => {
        if (layer instanceof L.Marker) {
          campaignMap.removeLayer(layer);
        }
      });

      loadCampaignMap();
      loadDashboard();
    }
  )
  .subscribe();


const reportForm = document.getElementById("reportForm");
const reportMessage = document.getElementById("reportMessage");
const reportsList = document.getElementById("reportsList");

async function loadReports() {
  const { data, error } = await supabase
    .from("campaign_reports")
    .select("id, lga, report_type, title, description, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    reportsList.textContent = "Unable to load reports.";
    return;
  }

  reportsList.replaceChildren();

  if (!data.length) {
    reportsList.textContent = "No campaign reports yet.";
    return;
  }

  data.forEach(report => {
    const item = document.createElement("div");
    item.className = "visit";

    const heading = document.createElement("strong");
    heading.textContent = report.title;

    const details = document.createElement("p");
    details.textContent =
      `${report.lga} | ${report.report_type} | ` +
      new Date(report.created_at).toLocaleString();

    const description = document.createElement("p");
    description.textContent = report.description || "";

    item.append(heading, details, description);
    reportsList.append(item);
  });
}

reportForm.addEventListener("submit", async event => {
  event.preventDefault();

  reportMessage.textContent = "Submitting report...";

  const report = {
    lga: document.getElementById("reportLga").value,
    report_type: document.getElementById("reportType").value,
    title: document.getElementById("reportTitle").value.trim(),
    description: document.getElementById("reportDescription").value.trim()
  };

  const { error } = await supabase
    .from("campaign_reports")
    .insert(report);

  if (error) {
    reportMessage.textContent = "Failed: " + error.message;
    return;
  }

  reportForm.reset();
  reportMessage.textContent = "Report submitted successfully.";

  await loadReports();
  await loadDashboard();
});


loadReports();

supabase
  .channel("campaign-reports-live")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "campaign_reports"
    },
    async () => {
      await loadReports();
      await loadDashboard();
    }
  )
  .subscribe();


const statisticsForm = document.getElementById("statisticsForm");
const statisticsMessage = document.getElementById("statisticsMessage");

statisticsForm.addEventListener("submit", async event => {
  event.preventDefault();

  statisticsMessage.textContent = "Updating statistics...";

  const lga = document.getElementById("statisticsLga").value;
  const registered_members = Number(
    document.getElementById("membersCount").value
  );
  const volunteers = Number(
    document.getElementById("volunteersCount").value
  );

  const { error } = await supabase
    .from("campaign_statistics")
    .upsert(
      { lga, registered_members, volunteers, updated_at: new Date().toISOString() },
      { onConflict: "lga" }
    );

  if (error) {
    statisticsMessage.textContent = "Update failed: " + error.message;
    return;
  }

  statisticsMessage.textContent = "Statistics updated successfully.";
  await loadDashboard();
  statisticsForm.reset();
});

const statisticsLiveChannel = supabase
  .channel("campaign-statistics-live")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "campaign_statistics"
    },
    async () => {
      await loadDashboard();
    }
  )
  .subscribe();

/* =========================================
   SUPABASE STORAGE - IMAGE MANAGEMENT
========================================= */

const STORAGE_ADMIN_UID = "c3ffb5cd-3dbf-4ebe-9262-ed4eb4c649f3";

const storageBucket = document.getElementById("storageBucket");
const storageFiles = document.getElementById("storageFiles");
const uploadStorageBtn = document.getElementById("uploadStorageBtn");
const refreshStorageBtn = document.getElementById("refreshStorageBtn");
const storageMessage = document.getElementById("storageMessage");
const storageFileList = document.getElementById("storageFileList");

const publicBuckets = [
  "campaign-news",
  "campaign-gallery",
  "candidate-media",
  "executive-photos"
];

let storageAdminVerified = false;

async function verifyStorageAdmin() {
  const { data, error } = await supabase.auth.getUser();

  if (
    error ||
    !data.user ||
    data.user.id !== STORAGE_ADMIN_UID
  ) {
    storageMessage.textContent =
      "Access denied. Only the authorized administrator can manage files.";

    uploadStorageBtn.disabled = true;
    storageBucket.disabled = true;
    storageFiles.disabled = true;
    refreshStorageBtn.disabled = true;

    return false;
  }

  storageAdminVerified = true;
  return true;
}

function updateStorageFileType() {
  if (storageBucket.value === "campaign-documents") {
    storageFiles.accept =
      ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt";
  } else {
    storageFiles.accept = "image/*";
  }
}

async function loadStorageFiles() {
  if (!storageAdminVerified) return;

  storageMessage.textContent = "Loading files...";
  storageFileList.replaceChildren();

  const bucket = storageBucket.value;

  const { data, error } = await supabase.storage
    .from(bucket)
    .list("", {
      limit: 100,
      sortBy: {
        column: "created_at",
        order: "desc"
      }
    });

  if (error) {
    storageMessage.textContent =
      "Unable to load files: " + error.message;
    return;
  }

  const files = (data || []).filter(file => file.id);

  if (!files.length) {
    storageMessage.textContent = "No files uploaded yet.";
    return;
  }

  storageMessage.textContent =
    files.length + " file(s) found.";

  for (const file of files) {
    const path = file.name;
    const card = document.createElement("div");

    card.style.cssText =
      "border:1px solid #ddd;padding:12px;border-radius:8px;overflow-wrap:anywhere;";

    const name = document.createElement("p");
    name.textContent = file.name;
    name.style.fontWeight = "bold";

    card.appendChild(name);

    let fileUrl = "";

    if (publicBuckets.includes(bucket)) {
      const result = supabase.storage
        .from(bucket)
        .getPublicUrl(path);

      fileUrl = result.data.publicUrl;
    } else {
      const result = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 600);

      if (!result.error) {
        fileUrl = result.data.signedUrl;
      }
    }

    if (fileUrl) {
      const link = document.createElement("a");
      link.href = fileUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "View / Open File";
      link.style.display = "block";
      link.style.margin = "10px 0";

      if (
        publicBuckets.includes(bucket) &&
        file.metadata?.mimetype?.startsWith("image/")
      ) {
        const preview = document.createElement("img");
        preview.src = fileUrl;
        preview.alt = file.name;
        preview.style.cssText =
          "width:100%;height:150px;object-fit:cover;border-radius:6px;margin-top:10px;";

        card.appendChild(preview);
      }

      card.appendChild(link);
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete File";
    deleteBtn.style.cssText =
      "padding:9px 12px;background:#b91c1c;color:white;border:0;border-radius:5px;cursor:pointer;";

    deleteBtn.addEventListener("click", async () => {
      if (!confirm("Are you sure you want to delete " + file.name + "?")) {
        return;
      }

      const { error: deleteError } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (deleteError) {
        storageMessage.textContent =
          "Delete failed: " + deleteError.message;
        return;
      }

      storageMessage.textContent = "File deleted successfully.";
      await loadStorageFiles();
    });

    card.appendChild(deleteBtn);
    storageFileList.appendChild(card);
  }
}

async function uploadStorageFiles() {
  if (!storageAdminVerified) return;

  const files = Array.from(storageFiles.files || []);
  const bucket = storageBucket.value;

  if (!files.length) {
    storageMessage.textContent = "Please select at least one file.";
    return;
  }

  uploadStorageBtn.disabled = true;

  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) {
      storageMessage.textContent =
        file.name + " exceeds the 10MB file limit.";
      uploadStorageBtn.disabled = false;
      return;
    }

    if (publicBuckets.includes(bucket)) {
      if (!file.type.startsWith("image/")) {
        storageMessage.textContent =
          "Only image files are allowed in this folder: " + file.name;
        uploadStorageBtn.disabled = false;
        return;
      }
    } else {
      const allowedExtensions =
        /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt)$/i;

      if (!allowedExtensions.test(file.name)) {
        storageMessage.textContent =
          "Unsupported document format: " + file.name;
        uploadStorageBtn.disabled = false;
        return;
      }
    }
  }

  for (const file of files) {
    storageMessage.textContent = "Uploading " + file.name + "...";

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName =
      Date.now() + "-" + crypto.randomUUID() + "-" + safeName;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(uniqueName, file, {
        upsert: false,
        contentType: file.type || "application/octet-stream"
      });

    if (error) {
      storageMessage.textContent =
        "Upload failed for " + file.name + ": " + error.message;

      uploadStorageBtn.disabled = false;
      return;
    }
  }

  storageFiles.value = "";
  storageMessage.textContent = "All files uploaded successfully.";

  uploadStorageBtn.disabled = false;

  await loadStorageFiles();
}

if (
  storageBucket &&
  storageFiles &&
  uploadStorageBtn &&
  refreshStorageBtn &&
  storageMessage &&
  storageFileList
) {
  storageBucket.addEventListener("change", () => {
    updateStorageFileType();
    loadStorageFiles();
  });

  uploadStorageBtn.addEventListener("click", uploadStorageFiles);
  refreshStorageBtn.addEventListener("click", loadStorageFiles);

  updateStorageFileType();

  verifyStorageAdmin().then(allowed => {
    if (allowed) {
      loadStorageFiles();
    }
  });
}
