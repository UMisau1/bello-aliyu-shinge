
(() => {
  "use strict";

  const DATA_URL =
    "https://raw.githubusercontent.com/saidiadegoke/nigeria-inec-geo/main/data/polling-units.csv";

  const wardSelect = document.getElementById("inecWardSelect");
  const lgaSelect = document.getElementById("inecLgaSelect");
  const results = document.getElementById("inecPollingUnitResults");

  if (!wardSelect || !lgaSelect || !results) return;

  let pollingData = null;
  let loadingPromise = null;

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function parseCSV(csv) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let i = 0; i < csv.length; i++) {
      const char = csv[i];

      if (quoted) {
        if (char === '"' && csv[i + 1] === '"') {
          field += '"';
          i++;
        } else if (char === '"') {
          quoted = false;
        } else {
          field += char;
        }
      } else {
        if (char === '"') {
          quoted = true;
        } else if (char === ",") {
          row.push(field);
          field = "";
        } else if (char === "\n") {
          row.push(field);
          rows.push(row);
          row = [];
          field = "";
        } else if (char !== "\r") {
          field += char;
        }
      }
    }

    if (field || row.length) {
      row.push(field);
      rows.push(row);
    }

    if (!rows.length) return [];

    const headers = rows.shift().map(h =>
      h.trim().replace(/^"|"$/g, "").toLowerCase()
    );

    return rows.map(values => {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = (values[index] || "").trim();
      });
      return item;
    });
  }

  async function loadData() {
    if (pollingData) return pollingData;
    if (loadingPromise) return loadingPromise;

    loadingPromise = fetch(DATA_URL).then(async response => {
      if (!response.ok) {
        throw new Error("Could not download polling-unit data.");
      }

      const csv = await response.text();
      pollingData = parseCSV(csv);
      return pollingData;
    });

    try {
      return await loadingPromise;
    } finally {
      loadingPromise = null;
    }
  }

  function addMessage(message) {
    const p = document.createElement("p");
    p.textContent = message;
    results.appendChild(p);
  }

  function showPollingUnits(units, expectedCount) {
    const heading = document.createElement("h4");
    heading.textContent = `Polling Units Found: ${units.length}`;
    results.appendChild(heading);

    if (expectedCount !== null && units.length !== expectedCount) {
      addMessage(
        `Notice: This dataset returned ${units.length} units, while the ward directory count is ${expectedCount}. Please verify the difference with INEC.`
      );
    }

    if (!units.length) {
      addMessage("No matching polling units were found in this dataset.");
      return;
    }

    const list = document.createElement("ol");
    list.style.paddingLeft = "24px";

    units.forEach(unit => {
      const li = document.createElement("li");
      li.style.marginBottom = "10px";

      const name = document.createElement("strong");
      name.textContent = unit.name || "Polling Unit name unavailable";

      const code = document.createElement("div");
      code.textContent = "INEC PU Code: " + (unit.code || "Not available");

      li.append(name, code);
      list.appendChild(li);
    });

    results.appendChild(list);

    addMessage(
      "Source: Community-maintained dataset scraped from INEC's public CVR portal. Confirm current details with INEC."
    );
  }

  wardSelect.addEventListener("change", async () => {
    const wardCode = wardSelect.value;
    const lga = lgaSelect.value;
    const wardName =
      wardSelect.options[wardSelect.selectedIndex]?.textContent || "";

    if (!wardCode || !lga || !wardName) return;

    addMessage("Loading polling-unit names and codes. Please wait...");

    try {
      const records = await loadData();

      const units = records
        .filter(item => {
          const state = normalize(item.state);
          const recordLga = normalize(item.lg);
          const recordWard = normalize(item.ward);
          const fullCode = String(item.code || "").trim();

          const correctState = state === "bauchi";

          const correctLga =
            recordLga === normalize(lga) ||
            (lga === "Dambam" && recordLga === "damban");

          const codeMatch = fullCode.startsWith(wardCode + "/");

          const nameMatch =
            recordWard === normalize(wardName);

          return correctState && correctLga &&
            (codeMatch || nameMatch);
        })
        .map(item => ({
          name: item.location || "",
          code: item.code || ""
        }))
        .filter((unit, index, array) =>
          array.findIndex(other => other.code === unit.code) === index
        )
        .sort((a, b) => a.code.localeCompare(b.code));

      // Remove loading message before displaying results
      const loadingMessage = [...results.querySelectorAll("p")]
        .find(p => p.textContent.includes("Loading polling-unit"));

      if (loadingMessage) loadingMessage.remove();

      const countText = [...results.querySelectorAll("p")]
        .find(p => p.textContent.startsWith("Polling Units:"));

      const expectedCount = countText
        ? Number(countText.textContent.replace(/\D/g, ""))
        : null;

      showPollingUnits(units, Number.isFinite(expectedCount) ? expectedCount : null);

    } catch (error) {
      console.error("INEC polling-unit loading error:", error);
      addMessage(
        "Unable to load polling-unit data. Please check your internet connection or use the Official INEC Locator."
      );
    }
  });

})();
