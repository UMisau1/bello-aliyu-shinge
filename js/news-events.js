
import { supabase } from "./supabase-config.js";

(function () {
    "use strict";

    const newsGrid = document.getElementById("shingeNewsGrid");

    if (!newsGrid) {
        console.warn("Shinge News: shingeNewsGrid was not found.");
        return;
    }

    let newsItems = [];

    // Detect the current portal language
    function getCurrentLanguage() {
        const htmlLanguage = (
            document.documentElement.lang || ""
        ).toLowerCase();

        const bodyLanguage = (
            document.body.getAttribute("data-language") || ""
        ).toLowerCase();

        const savedLanguage = (
            localStorage.getItem("shingeLanguage") || ""
        ).toLowerCase();

        const language =
            htmlLanguage || bodyLanguage || savedLanguage || "en";

        return language.startsWith("ha") ? "ha" : "en";
    }

    // Create HTML elements safely
    function createElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined && text !== null) {
            element.textContent = text;
        }

        return element;
    }

    // Get public image URL from Supabase Storage
    function getNewsImageUrl(imagePath) {
        if (!imagePath) return "";

        const { data } = supabase.storage
            .from("campaign-news")
            .getPublicUrl(imagePath);

        return data?.publicUrl || "";
    }

    // Create one news card
    function createNewsCard(item, language) {
        const isHausa = language === "ha";

        const category = isHausa
            ? (item.category_ha || item.category_en)
            : item.category_en;

        const title = isHausa
            ? (item.title_ha || item.title_en)
            : item.title_en;

        const description = isHausa
            ? (item.description_ha || item.description_en)
            : item.description_en;

        const article = createElement("article", "shinge-news-card");

        // Image area
        const photo = createElement("div", "shinge-news-photo");

        if (item.image_path) {
            const image = createElement("img");

            image.src = getNewsImageUrl(item.image_path);
            image.alt = item.image_alt || title || "Campaign news";
            image.loading = "lazy";

            image.onerror = function () {
                this.style.display = "none";
            };

            photo.appendChild(image);
        }

        const categoryLabel = createElement(
            "span",
            "shinge-news-label",
            category || (isHausa ? "LABARI" : "NEWS")
        );

        photo.appendChild(categoryLabel);

        // News body
        const body = createElement("div", "shinge-news-body");

        const date = createElement(
            "span",
            "shinge-news-date",
            item.date_label || ""
        );

        const heading = createElement("h3", "", title || "");

        const details = createElement(
            "p",
            "",
            description || ""
        );

        // Read more link
        const link = createElement("a", "shinge-read-more");

        link.href = item.link_url || "news.html";

        const linkText = createElement(
            "span",
            "",
            isHausa ? "Kara Karantawa" : "Read More"
        );

        const arrow = createElement("span", "", "→");
        arrow.setAttribute("aria-hidden", "true");

        link.appendChild(linkText);
        link.appendChild(arrow);

        body.appendChild(date);
        body.appendChild(heading);
        body.appendChild(details);
        body.appendChild(link);

        article.appendChild(photo);
        article.appendChild(body);

        return article;
    }

    // Display news in the selected language
    function renderNews() {
        const language = getCurrentLanguage();
        const fragment = document.createDocumentFragment();

        if (!newsItems.length) {
            const message = createElement(
                "p",
                "",
                language === "ha"
                    ? "Babu labarai a halin yanzu."
                    : "There are no news or events at the moment."
            );

            newsGrid.replaceChildren(message);
            return;
        }

        newsItems.forEach(function (item) {
            fragment.appendChild(
                createNewsCard(item, language)
            );
        });

        newsGrid.replaceChildren(fragment);
    }

    // Load published news from Supabase
    async function loadNews() {
        newsGrid.textContent =
            getCurrentLanguage() === "ha"
                ? "Ana loda labarai..."
                : "Loading news and events...";

        try {
            const { data, error } = await supabase
                .from("campaign_news")
                .select("*")
                .eq("is_published", true)
                .order("sort_order", { ascending: true })
                .order("created_at", { ascending: false });

            if (error) {
                throw error;
            }

            newsItems = data || [];

            renderNews();

        } catch (error) {
            console.error("Shinge News loading error:", error);

            newsGrid.textContent =
                getCurrentLanguage() === "ha"
                    ? "An samu matsala wajen loda labarai. Da fatan za a sake gwadawa."
                    : "Unable to load news and events. Please try again.";
        }
    }

    // Re-render news when the portal language changes
    const languageObserver = new MutationObserver(function () {
        renderNews();
    });

    languageObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["lang"]
    });

    languageObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["data-language"]
    });

    // Also respond to language selector interactions
    document.addEventListener("click", function (event) {
        if (
            event.target.closest("[data-language]") ||
            event.target.closest("#languageSelect")
        ) {
            setTimeout(renderNews, 100);
        }
    });

    document.addEventListener("change", function (event) {
        if (event.target.matches("#languageSelect")) {
            setTimeout(renderNews, 100);
        }
    });

    // Listen for language changes from other browser tabs
    window.addEventListener("storage", function (event) {
        if (event.key === "shingeLanguage") {
            renderNews();
        }
    });

    // Start
    loadNews();

})();
