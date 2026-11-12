
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