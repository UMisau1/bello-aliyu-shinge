
import { supabase } from "./supabase-config.js";
let lgaChart;

let currentLanguage = "ha";

const translations = {
  ha: {
    loading: "Ana sabunta kididdiga...",
    error: "An kasa ɗauko bayanan kididdiga.",
    connected: "● An haɗu da bayanan kai tsaye",
    members: "Membobi",
    volunteers: "Masu Sa-kai"
  },
  en: {
    loading: "Updating live statistics...",
    error: "Unable to load statistics.",
    connected: "● Live data connected",
    members: "Registered Members",
    volunteers: "Volunteers"
  }
};

function translate(key) {
  return translations[currentLanguage][key];
}

function setLanguage(language) {
  currentLanguage = language;

  document.documentElement.lang = language;

  document.querySelectorAll("[data-ha][data-en]").forEach(element => {
    element.textContent = element.dataset[language];
  });

  document.getElementById("languageToggle").textContent =
    language === "ha" ? "English" : "Hausa";

  if (lgaChart) {
    lgaChart.data.datasets[0].label = translate("members");
    lgaChart.data.datasets[1].label = translate("volunteers");
    lgaChart.update();
  }
}

document.getElementById("languageToggle").addEventListener("click", () => {
  setLanguage(currentLanguage === "ha" ? "en" : "ha");
});

const table = document.getElementById("statisticsTable");
const status = document.getElementById("liveStatus");

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

async function loadPublicStatistics() {
  status.textContent = translate("loading");

  const { data, error } = await supabase
    .from("campaign_statistics")
    .select("lga, registered_members, volunteers")
    .order("lga");

  if (error) {
    status.textContent = translate("error");
    status.className = "status error";
    return;
  }

  const lgas = [
    "Misau", "Dambam", "Ningi",
    "Warji", "Darazo", "Ganjuwa"
  ];

  const records = data || [];
  const { data: activity, error: activityError } =
  await supabase.rpc("get_public_campaign_activity_counts");

if (activityError) {
  status.textContent = "Unable to load campaign activity statistics.";
  status.className = "status error";
  return;
}

document.getElementById("totalVisits").textContent =
  formatNumber(activity.visits);

document.getElementById("totalReports").textContent =
  formatNumber(activity.reports);
    
  let totalMembers = 0;
  let totalVolunteers = 0;
  let participatingLgas = 0;

  table.replaceChildren();

  lgas.forEach(lga => {
    const record = records.find(item => item.lga === lga);

    const members = Number(record?.registered_members || 0);
    const volunteers = Number(record?.volunteers || 0);

    totalMembers += members;
    totalVolunteers += volunteers;

    if (record) participatingLgas++;

    const row = document.createElement("tr");

    [lga, formatNumber(members), formatNumber(volunteers)]
      .forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });

    table.appendChild(row);
  });

  document.getElementById("totalMembers").textContent =
    formatNumber(totalMembers);

  document.getElementById("totalVolunteers").textContent =
    formatNumber(totalVolunteers);

  document.getElementById("totalLgas").textContent =
    `${participatingLgas} / 6`;
    const chartLabels = lgas;

const membersData = lgas.map(lga =>
  Number(records.find(item => item.lga === lga)?.registered_members || 0)
);

const volunteersData = lgas.map(lga =>
  Number(records.find(item => item.lga === lga)?.volunteers || 0)
);

const chartContext = document.getElementById("lgaChart");

if (lgaChart) {
  lgaChart.data.labels = chartLabels;
  lgaChart.data.datasets[0].data = membersData;
  lgaChart.data.datasets[1].data = volunteersData;
  lgaChart.update();
} else {
  lgaChart = new Chart(chartContext, {
    type: "bar",
    data: {
      labels: chartLabels,
      datasets: [
        {
          label: "Registered Members",
          data: membersData
        },
        {
          label: "Volunteers",
          data: volunteersData
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

  status.textContent = translate("connected");
  status.className = "status";
}

loadPublicStatistics();

supabase
  .channel("public-campaign-activity-live")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "campaign_statistics"
    },
    loadPublicStatistics
  )
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "campaign_visits"
    },
    loadPublicStatistics
  )
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "campaign_reports"
    },
    loadPublicStatistics
  )
  .subscribe();
