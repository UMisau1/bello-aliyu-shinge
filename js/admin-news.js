
import { supabase } from "./supabase-config.js";

const ADMIN_UID = "c3ffb5cd-3dbf-4ebe-9262-ed4eb4c649f3";
const BUCKET = "campaign-news";

const form = document.getElementById("adminNewsForm");
const newsList = document.getElementById("adminNewsList");
const message = document.getElementById("adminNewsMessage");

const newsId = document.getElementById("newsId");
const imagePath = document.getElementById("newsImagePath");

const fields = {
  categoryEn: document.getElementById("newsCategoryEn"),
  categoryHa: document.getElementById("newsCategoryHa"),
  date: document.getElementById("newsDate"),
  titleEn: document.getElementById("newsTitleEn"),
  titleHa: document.getElementById("newsTitleHa"),
  descriptionEn: document.getElementById("newsDescriptionEn"),
  descriptionHa: document.getElementById("newsDescriptionHa"),
  image: document.getElementById("newsImage"),
  imageAlt: document.getElementById("newsImageAlt"),
  link: document.getElementById("newsLink"),
  published: document.getElementById("newsPublished")
};

let adminVerified = false;

function showMessage(text, success = true) {
  message.textContent = text;
  message.style.color = success ? "green" : "red";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

async function verifyNewsAdmin() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user || data.user.id !== ADMIN_UID) {
    showMessage("Access denied. Admin login required.", false);

    const saveButton = document.getElementById("saveNewsBtn");
    if (saveButton) saveButton.disabled = true;

    return false;
  }

  adminVerified = true;
  return true;
}

function resetNewsForm() {
  form.reset();

  newsId.value = "";
  imagePath.value = "";
  fields.published.checked = true;

  document.getElementById("saveNewsBtn").textContent = "Save News";

  showMessage("");
}

async function loadAdminNews() {
  if (!adminVerified) return;

  newsList.textContent = "Loading news...";

  const { data, error } = await supabase
    .from("campaign_news")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    newsList.textContent = "Unable to load news: " + error.message;
    return;
  }

  if (!data || data.length === 0) {
    newsList.textContent = "No campaign news has been added yet.";
    return;
  }

  newsList.innerHTML = "";

  data.forEach(item => {
    const card = document.createElement("div");

    card.style.cssText =
      "background:#f8fafc;padding:15px;margin:12px 0;border-radius:8px;border:1px solid #ddd;";

    let imageHTML = "";

    if (item.image_path) {
      const { data: imageData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(item.image_path);

      imageHTML = `
        <img
          src="${escapeHTML(imageData.publicUrl)}"
          alt="${escapeHTML(item.image_alt || item.title_en)}"
          style="width:100%;max-width:300px;height:160px;object-fit:cover;border-radius:7px;"
        >
      `;
    }

    card.innerHTML = `
      ${imageHTML}
      <h3>${escapeHTML(item.title_en)}</h3>
      <p>${escapeHTML(item.title_ha || "")}</p>
      <p><strong>Date:</strong> ${escapeHTML(item.date_label)}</p>
      <p><strong>Status:</strong>
        ${item.is_published ? "Published" : "Hidden"}
      </p>
      <button type="button" class="edit-news">Edit</button>
      <button type="button" class="delete-news" style="background:#b42318;">
        Delete
      </button>
    `;

    card.querySelector(".edit-news").addEventListener("click", () => {
      editNews(item);
    });

    card.querySelector(".delete-news").addEventListener("click", () => {
      deleteNews(item);
    });

    newsList.appendChild(card);
  });
}

function editNews(item) {
  if (!adminVerified) return;

  newsId.value = item.id;
  imagePath.value = item.image_path || "";

  fields.categoryEn.value = item.category_en || "";
  fields.categoryHa.value = item.category_ha || "";
  fields.date.value = item.date_label || "";
  fields.titleEn.value = item.title_en || "";
  fields.titleHa.value = item.title_ha || "";
  fields.descriptionEn.value = item.description_en || "";
  fields.descriptionHa.value = item.description_ha || "";
  fields.imageAlt.value = item.image_alt || "";
  fields.link.value = item.link_url || "news.html";
  fields.published.checked = item.is_published;

  fields.image.value = "";

  document.getElementById("saveNewsBtn").textContent = "Update News";

  showMessage("Editing selected news.");

  form.scrollIntoView({ behavior: "smooth" });
}

async function uploadNewsImage(file) {
  if (!file) return null;

  if (!file.type.startsWith("image/")) {
    throw new Error("Please select a valid image file.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Image size must not exceed 10MB.");
  }

  const safeName = file.name.replace(/[^\w.-]/g, "_");
  const path = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) throw error;

  return path;
}

async function removeNewsImage(path) {
  if (!path) return;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path]);

  if (error) throw error;
}

async function deleteNews(item) {
  if (!adminVerified) return;

  const confirmed = confirm(
    "Are you sure you want to permanently delete this news?"
  );

  if (!confirmed) return;

  try {
    showMessage("Deleting news...");

    const { error } = await supabase
      .from("campaign_news")
      .delete()
      .eq("id", item.id);

    if (error) throw error;

    if (item.image_path) {
      try {
        await removeNewsImage(item.image_path);
      } catch (imageError) {
        showMessage(
          "News deleted, but its image could not be removed: " +
          imageError.message,
          false
        );

        await loadAdminNews();
        return;
      }
    }

    showMessage("News and its image deleted successfully.");

    await loadAdminNews();

  } catch (error) {
    showMessage("Delete failed: " + error.message, false);
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  if (!adminVerified) {
    showMessage("Admin verification required.", false);
    return;
  }

  const saveButton = document.getElementById("saveNewsBtn");

  const isEditing = Boolean(newsId.value);
  const oldImagePath = imagePath.value;

  let newUploadedPath = null;

  saveButton.disabled = true;

  showMessage("Saving news...");

  try {
    const selectedFile = fields.image.files[0];

    if (selectedFile) {
      newUploadedPath = await uploadNewsImage(selectedFile);
    }

    const newsRecord = {
      category_en: fields.categoryEn.value.trim(),
      category_ha: fields.categoryHa.value.trim(),
      date_label: fields.date.value.trim(),
      title_en: fields.titleEn.value.trim(),
      title_ha: fields.titleHa.value.trim(),
      description_en: fields.descriptionEn.value.trim(),
      description_ha: fields.descriptionHa.value.trim(),
      image_path: newUploadedPath || oldImagePath || null,
      image_alt: fields.imageAlt.value.trim(),
      link_url: fields.link.value.trim() || "news.html",
      is_published: fields.published.checked
    };

    let result;

    if (isEditing) {
      result = await supabase
        .from("campaign_news")
        .update(newsRecord)
        .eq("id", newsId.value)
        .select("id")
        .maybeSingle();
    } else {
      result = await supabase
        .from("campaign_news")
        .insert(newsRecord)
        .select("id")
        .maybeSingle();
    }

    if (result.error) throw result.error;

    if (!result.data) {
      throw new Error("No news record was saved. Please check admin permissions.");
    }

    // Remove old image only after a successful update.
    if (
      isEditing &&
      newUploadedPath &&
      oldImagePath &&
      oldImagePath !== newUploadedPath
    ) {
      try {
        await removeNewsImage(oldImagePath);
      } catch (imageError) {
        showMessage(
          "News updated, but the old image could not be removed: " +
          imageError.message,
          false
        );
      }
    }

    if (!message.textContent.startsWith("News updated, but")) {
      showMessage(
        isEditing
          ? "News updated successfully."
          : "News saved successfully."
      );
    }

    resetNewsForm();

    await loadAdminNews();

  } catch (error) {
    // Clean up a newly uploaded image if the database save failed.
    if (newUploadedPath) {
      try {
        await removeNewsImage(newUploadedPath);
      } catch (cleanupError) {
        console.error("Image cleanup failed:", cleanupError);
      }
    }

    showMessage("Error: " + error.message, false);

  } finally {
    saveButton.disabled = false;
  }
});

document.getElementById("cancelNewsEditBtn")
  .addEventListener("click", resetNewsForm);

document.getElementById("refreshNewsBtn")
  .addEventListener("click", loadAdminNews);

async function startNewsManagement() {
  const verified = await verifyNewsAdmin();

  if (verified) {
    await loadAdminNews();
  }
}

startNewsManagement();
