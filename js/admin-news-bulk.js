
import { supabase } from "./supabase-config.js";

(function () {
    "use strict";

    const ADMIN_UID = "c3ffb5cd-3dbf-4ebe-9262-2ed4eb4c649f";
    const BUCKET = "campaign-news";

    const rowsContainer = document.getElementById("bulkNewsRows");
    const addButton = document.getElementById("addBulkNewsRowBtn");
    const uploadButton = document.getElementById("uploadAllBulkNewsBtn");
    const message = document.getElementById("bulkNewsMessage");

    if (!rowsContainer || !addButton || !uploadButton || !message) {
        return;
    }

    function showMessage(text, color = "#172033") {
        message.textContent = text;
        message.style.color = color;
    }

    function createNewsRow() {
        const row = document.createElement("div");
        row.className = "bulk-news-row";

        row.style.cssText = `
            background:white;
            border:1px solid #cbd5e1;
            border-radius:9px;
            padding:18px;
            margin:15px 0;
        `;

        row.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
                <h4 class="bulk-row-title">News Item</h4>
                <button type="button" class="remove-bulk-row"
                    style="background:#dc2626;">Remove</button>
            </div>

            <label>Category (English)</label>
            <input data-field="category_en" required placeholder="Campaign Event">

            <label>Category (Hausa)</label>
            <input data-field="category_ha" placeholder="Shirin Kamfen">

            <label>Date</label>
            <input data-field="date_label" required placeholder="18 November 2026">

            <label>Title (English)</label>
            <input data-field="title_en" required maxlength="250">

            <label>Title (Hausa)</label>
            <input data-field="title_ha" maxlength="250">

            <label>Description (English)</label>
            <textarea data-field="description_en" required maxlength="5000"></textarea>

            <label>Description (Hausa)</label>
            <textarea data-field="description_ha" maxlength="5000"></textarea>

            <label>News Image</label>
            <input type="file" data-field="image" accept="image/*">

            <label>Image Description</label>
            <input data-field="image_alt" placeholder="Describe the image">

            <label>News Link</label>
            <input data-field="link_url" value="news.html">

            <label style="display:flex;align-items:center;gap:8px;">
                <input type="checkbox" data-field="is_published"
                    checked style="width:auto;margin:0;">
                Publish this news
            </label>

            <p class="bulk-row-status" aria-live="polite"></p>
        `;

        rowsContainer.appendChild(row);
        updateRowNumbers();
    }

    function updateRowNumbers() {
        const rows = rowsContainer.querySelectorAll(".bulk-news-row");

        rows.forEach((row, index) => {
            row.querySelector(".bulk-row-title").textContent =
                "News Item " + (index + 1);
        });
    }

    function getField(row, name) {
        return row.querySelector(`[data-field="${name}"]`);
    }

    function getValue(row, name) {
        return getField(row, name).value.trim();
    }

    async function verifyAdmin() {
        const { data, error } = await supabase.auth.getUser();

        if (error || !data.user || data.user.id !== ADMIN_UID) {
            throw new Error("Admin verification failed. Please login again.");
        }

        return true;
    }

    function makeSafeFileName(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9.-]/g, "-")
            .replace(/-+/g, "-");
    }

    async function uploadImage(file) {
        if (!file) return null;

        if (!file.type.startsWith("image/")) {
            throw new Error("Selected file is not an image.");
        }

        const uniqueName =
            Date.now() + "-" +
            (crypto.randomUUID
                ? crypto.randomUUID()
                : Math.random().toString(36).slice(2)) +
            "-" + makeSafeFileName(file.name);

        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(uniqueName, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type
            });

        if (error) throw error;

        return uniqueName;
    }

    async function saveOneNews(row, index, total) {
        const status = row.querySelector(".bulk-row-status");

        const categoryEn = getValue(row, "category_en");
        const dateLabel = getValue(row, "date_label");
        const titleEn = getValue(row, "title_en");
        const descriptionEn = getValue(row, "description_en");

        if (!categoryEn || !dateLabel || !titleEn || !descriptionEn) {
            throw new Error("Complete all required English fields.");
        }

        status.textContent = "Uploading image and saving news...";

        const imageFile = getField(row, "image").files[0];
        let imagePath = null;

        if (imageFile) {
            imagePath = await uploadImage(imageFile);
        }

        const newsRecord = {
            category_en: categoryEn,
            category_ha: getValue(row, "category_ha") || null,
            date_label: dateLabel,
            title_en: titleEn,
            title_ha: getValue(row, "title_ha") || null,
            description_en: descriptionEn,
            description_ha: getValue(row, "description_ha") || null,
            image_path: imagePath,
            image_alt: getValue(row, "image_alt") || null,
            link_url: getValue(row, "link_url") || "news.html",
            is_published: getField(row, "is_published").checked
        };

        const { error } = await supabase
            .from("campaign_news")
            .insert([newsRecord]);

        if (error) {
            if (imagePath) {
                await supabase.storage.from(BUCKET).remove([imagePath]);
            }

            throw error;
        }

        status.textContent = "Successfully uploaded.";
        status.style.color = "#087b48";

        return true;
    }

    addButton.addEventListener("click", createNewsRow);

    rowsContainer.addEventListener("click", function (event) {
        const removeButton = event.target.closest(".remove-bulk-row");

        if (!removeButton) return;

        const rows = rowsContainer.querySelectorAll(".bulk-news-row");

        if (rows.length <= 1) {
            showMessage("At least one news item must remain.", "#b45309");
            return;
        }

        removeButton.closest(".bulk-news-row").remove();
        updateRowNumbers();
    });

    uploadButton.addEventListener("click", async function () {
        const rows = Array.from(
            rowsContainer.querySelectorAll(".bulk-news-row")
        );

        if (!rows.length) {
            showMessage("Add at least one news item.", "#dc2626");
            return;
        }

        uploadButton.disabled = true;
        addButton.disabled = true;
        uploadButton.textContent = "Uploading...";

        let successful = 0;
        let failed = 0;

        try {
            await verifyAdmin();

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];

                showMessage(
                    `Processing news ${i + 1} of ${rows.length}...`
                );

                try {
                    await saveOneNews(row, i, rows.length);
                    successful++;
                } catch (error) {
                    failed++;

                    const status = row.querySelector(".bulk-row-status");
                    status.textContent = "Failed: " + error.message;
                    status.style.color = "#dc2626";

                    console.error("Bulk news upload error:", error);
                }
            }

            if (successful > 0) {
                const refreshButton =
                    document.getElementById("refreshNewsBtn");

                if (refreshButton) refreshButton.click();
            }

            showMessage(
                `Completed. Successful: ${successful}. Failed: ${failed}.`,
                failed ? "#b45309" : "#087b48"
            );

        } catch (error) {
            showMessage(error.message, "#dc2626");
        } finally {
            uploadButton.disabled = false;
            addButton.disabled = false;
            uploadButton.textContent = "Upload All News";
        }
    });

    // Start with two news entry forms
    createNewsRow();
    createNewsRow();

})();
