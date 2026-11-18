
(() => {
  "use strict";

  const directory = {
    "Misau": {
      code: "05/14",
      wards: [
        ["05/14/01", "Zadawa", 28],
        ["05/14/02", "Beti", 17],
        ["05/14/03", "Jarkasa", 19],
        ["05/14/04", "Kukadi/Gundari", 69],
        ["05/14/05", "Ajilin/Gugulin", 29],
        ["05/14/06", "Tofu", 17],
        ["05/14/07", "Hardawa", 22],
        ["05/14/08", "Sarma/Akuyam", 30],
        ["05/14/09", "Sirko", 9],
        ["05/14/10", "Gwaram", 16]
      ]
    },

    "Dambam": {
      code: "05/04",
      wards: [
        ["05/04/01", "Garuza", 14],
        ["05/04/02", "Gurbana", 19],
        ["05/04/03", "Dambam", 35],
        ["05/04/04", "Yanda", 18],
        ["05/04/05", "Yame", 15],
        ["05/04/06", "Dagauda", 18],
        ["05/04/07", "Gargawa", 9],
        ["05/04/08", "Zaura", 12],
        ["05/04/09", "Jalam Central", 13],
        ["05/04/10", "Jalam East", 10]
      ]
    },

    "Ningi": {
      code: "05/15",
      wards: [
        ["05/15/01", "Ningi", 62],
        ["05/15/02", "Dingis", 23],
        ["05/15/03", "Nasaru", 36],
        ["05/15/04", "Jangu", 23],
        ["05/15/05", "Balma", 35],
        ["05/15/06", "Kudu/Yamma", 36],
        ["05/15/07", "Tiffi/Guda", 26],
        ["05/15/08", "Burra/Kyata", 34],
        ["05/15/09", "Sama", 26],
        ["05/15/10", "Bashe", 37],
        ["05/15/11", "Kurmi", 33]
      ]
    },

    "Warji": {
      code: "05/19",
      wards: [
        ["05/19/01", "Baima North/West", 16],
        ["05/19/02", "Baima South/East", 15],
        ["05/19/03", "Dagu East", 14],
        ["05/19/04", "Dagu West", 8],
        ["05/19/05", "Gabanga", 14],
        ["05/19/06", "Katanga", 17],
        ["05/19/07", "Ranga", 14],
        ["05/19/08", "Tiyin", 17],
        ["05/19/09", "Tudun Wada East", 11],
        ["05/19/10", "Tudun Wada West", 16]
      ]
    },

    "Darazo": {
      code: "05/05",
      wards: [
        ["05/05/01", "Darazo", 58],
        ["05/05/02", "Tauya", 28],
        ["05/05/03", "Gabarin", 21],
        ["05/05/04", "Konkiyal", 17],
        ["05/05/05", "Lago", 21],
        ["05/05/06", "Sade", 29],
        ["05/05/07", "Lanzai", 22],
        ["05/05/08", "Yautare", 13],
        ["05/05/09", "Gabciyari", 19],
        ["05/05/10", "Wahu", 13],
        ["05/05/11", "Papa", 29]
      ]
    },

    "Ganjuwa": {
      code: "05/08",
      wards: [
        ["05/08/01", "Ganjuwa", 36],
        ["05/08/02", "Gungura", 21],
        ["05/08/03", "Kafin Madaki", 31],
        ["05/08/04", "Kariya", 30],
        ["05/08/05", "Kubi East", 17],
        ["05/08/06", "Kubi West", 15],
        ["05/08/07", "Miya East", 18],
        ["05/08/08", "Miya West", 33],
        ["05/08/09", "Nasarawa North", 19],
        ["05/08/10", "Nasarawa South", 15],
        ["05/08/11", "Yali", 18]
      ]
    }
  };

  const lgaSelect = document.getElementById("inecLgaSelect");
  const wardSelect = document.getElementById("inecWardSelect");
  const summary = document.getElementById("inecDirectorySummary");
  const results = document.getElementById("inecPollingUnitResults");

  if (!lgaSelect || !wardSelect || !summary || !results) {
    console.error("INEC Directory: HTML elements not found.");
    return;
  }

  const officialLocator = "https://cvr.inecnigeria.org/pu";

  function resetWard() {
    wardSelect.innerHTML = '<option value="">Select Ward</option>';
    wardSelect.disabled = true;
  }

  function resetResults(message) {
    results.textContent = message;
  }

  // Load LGAs
  Object.keys(directory).forEach(lga => {
    const option = document.createElement("option");
    option.value = lga;
    option.textContent = lga;
    lgaSelect.appendChild(option);
  });

  summary.textContent =
    "Bauchi Central: 6 LGAs | 63 Wards | 1,455 Polling Units";

  resetWard();
  resetResults("Select an LGA and Ward to view polling unit information.");

  // LGA selection
  lgaSelect.addEventListener("change", () => {
    const selectedLga = lgaSelect.value;

    resetWard();
    resetResults("Select a Ward to view its polling unit information.");

    if (!selectedLga || !directory[selectedLga]) {
      summary.textContent = "Select an LGA to begin.";
      return;
    }

    const wards = directory[selectedLga].wards;

    wards.forEach(([code, name]) => {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = name;
      wardSelect.appendChild(option);
    });

    wardSelect.disabled = false;

    const totalPUs = wards.reduce((sum, ward) => sum + ward[2], 0);

    summary.textContent =
      `${selectedLga} LGA | ${wards.length} Wards | ${totalPUs} Polling Units`;
  });

  // Ward selection
  wardSelect.addEventListener("change", () => {
    const selectedLga = lgaSelect.value;
    const selectedCode = wardSelect.value;

    if (!selectedLga || !selectedCode) {
      resetResults("Select a Ward to continue.");
      return;
    }

    const ward = directory[selectedLga].wards.find(
      item => item[0] === selectedCode
    );

    if (!ward) return;

    const [code, name, puCount] = ward;

    results.innerHTML = "";

    const heading = document.createElement("h4");
    heading.textContent = name + " Ward";

    const lgaInfo = document.createElement("p");
    lgaInfo.textContent = "LGA: " + selectedLga;

    const codeInfo = document.createElement("p");
    codeInfo.textContent = "INEC Ward Code: " + code;

    const countInfo = document.createElement("p");
    countInfo.textContent = "Polling Units: " + puCount;

    const notice = document.createElement("p");
    notice.textContent =
      "This is the compiled polling-unit count for this Ward. Individual polling-unit names and codes are not yet loaded.";

    const link = document.createElement("a");
    link.href = officialLocator;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open Official INEC Polling Unit Locator";

    results.append(
      heading,
      lgaInfo,
      codeInfo,
      countInfo,
      notice,
      link
    );

    summary.textContent =
      `${selectedLga} | ${name} Ward | ${puCount} Polling Units`;
  });

})();
