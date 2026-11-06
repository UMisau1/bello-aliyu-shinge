
/* ==========================================
   SHINGE CAMPAIGN
   NEWS & EVENTS MANAGER

   Add, edit or remove news from this file.
========================================== */

const SHINGE_NEWS_EVENTS = [

    // ======================================
    // UPCOMING EVENT 1
    // ======================================

    {
        category: "UPCOMING EVENT",
        categoryHa: "SHIRIN DA KE TAFE",
        date: "8 November 2026",

        title: "PDP to Receive 1,500 Decampees from APC, APM, ADC, NDC and Other Parties",
        titleHa: "PDP Za Ta Karɓi Mutane 1,500 da Suka Sauya Sheƙa Daga APC, APM, ADC, NDC da Sauransu",

        description: "On Sunday, 8 November 2026, the PDP is scheduled to receive approximately 1,500 decampees from APC, APM, ADC, NDC and other political groups.",
        descriptionHa: "A ranar Lahadi, 8 ga Nuwamba, 2026, ana shirin PDP ta karɓi kusan mutane 1,500 da suka sauya sheƙa daga APC, APM, ADC, NDC da sauran ƙungiyoyin siyasa.",

        image: "images/pdp-event.jpg",
        alt: "PDP Event",

        link: "news.html"
    },

    // ======================================
    // UPCOMING EVENT 2
    // ======================================

    {
        category: "PARTY MEETING",
        categoryHa: "TARON JAM'IYYA",
        date: "8 November 2026",

        title: "Meeting with PDP Officials and All Candidates",
        titleHa: "Taron Jami'an PDP da Dukkan 'Yan Takarar Jam'iyyar",

        description: "A meeting with PDP officials and all party candidates will also take place on Sunday, 8 November 2026, at the PDP State Secretariat in Bauchi.",
        descriptionHa: "Haka kuma, za a gudanar da taro da jami'an PDP da dukkan 'yan takarar jam'iyyar a ranar Lahadi, 8 ga Nuwamba, 2026, a sakatariyar PDP ta jiha da ke Bauchi.",

        image: "images/pdp-meeting.jpg",
        alt: "PDP Meeting",

        link: "news.html"
    },

    // ======================================
    // EXISTING NEWS 1
    // ======================================

    {
        category: "CAMPAIGN NEWS",
        categoryHa: "LABARIN KAMFEN",
        date: "15 Jan 2027",

        title: "Campaign Flag-Off",
        titleHa: "Kaddamar da Kamfen",

        description: "Updates on the campaign launch and engagement with communities across Bauchi Central.",
        descriptionHa: "Sabbin bayanai kan kaddamar da kamfen da ganawa da al'ummomi a Bauchi Central.",

        image: "images/news/news1.jpg",
        alt: "Campaign News",

        link: "news.html"
    },

    // ======================================
    // EXISTING NEWS 2
    // ======================================

    {
        category: "YOUTH",
        categoryHa: "MATASA",
        date: "20 Jan 2027",

        title: "Youth Engagement",
        titleHa: "Shigar da Matasa Cikin Ayyuka",

        description: "Campaign engagement focused on youth participation, leadership and empowerment.",
        descriptionHa: "Ayyukan kamfen da suka mayar da hankali kan shigar matasa, jagoranci da karfafawa.",

        image: "images/news/news2.jpg",
        alt: "Youth Engagement",

        link: "news.html"
    },

    // ======================================
    // EXISTING NEWS 3
    // ======================================

    {
        category: "COMMUNITY",
        categoryHa: "AL'UMMA",
        date: "28 Jan 2027",

        title: "Community Stakeholders Meeting",
        titleHa: "Taron Masu Ruwa da Tsaki",

        description: "Community discussions on local priorities and development needs in the six LGAs.",
        descriptionHa: "Tattaunawar al'umma kan muhimman bukatu da ci gaba a kananan hukumomi shida.",

        image: "images/news/news3.jpg",
        alt: "Community Meeting",

        link: "news.html"
    }

];


/* ==========================================
   DISPLAY NEWS AND EVENTS
========================================== */

(function () {

    "use strict";

    const newsGrid = document.getElementById("shingeNewsGrid");

    if (!newsGrid) return;

    function createElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;
    }

    function createNewsCard(item) {

        const article = createElement("article", "shinge-news-card");

        // IMAGE AREA
        const photo = createElement("div", "shinge-news-photo");

        const image = createElement("img");

        image.src = item.image || "";
        image.alt = item.alt || item.title;
        image.loading = "lazy";

        image.onerror = function () {
            this.style.display = "none";
        };

        const category = createElement(
            "span",
            "shinge-news-label",
            item.category
        );

        category.setAttribute("data-en", item.category);
        category.setAttribute("data-ha", item.categoryHa || item.category);

        photo.appendChild(image);
        photo.appendChild(category);

        // NEWS BODY
        const body = createElement("div", "shinge-news-body");

        const date = createElement(
            "span",
            "shinge-news-date",
            item.date
        );

        const title = createElement("h3", "", item.title);

        title.setAttribute("data-en", item.title);
        title.setAttribute("data-ha", item.titleHa || item.title);

        const description = createElement(
            "p",
            "",
            item.description
        );

        description.setAttribute("data-en", item.description);
        description.setAttribute(
            "data-ha",
            item.descriptionHa || item.description
        );

        const link = createElement("a", "shinge-read-more");

        link.href = item.link || "news.html";

        const linkText = createElement("span", "", "Read More");

        linkText.setAttribute("data-en", "Read More");
        linkText.setAttribute("data-ha", "Kara Karantawa");

        const arrow = createElement("span", "", "→");
        arrow.setAttribute("aria-hidden", "true");

        link.appendChild(linkText);
        link.appendChild(arrow);

        body.appendChild(date);
        body.appendChild(title);
        body.appendChild(description);
        body.appendChild(link);

        article.appendChild(photo);
        article.appendChild(body);

        return article;
    }

    function renderNews() {

        const fragment = document.createDocumentFragment();

        SHINGE_NEWS_EVENTS.forEach(function (item) {
            fragment.appendChild(createNewsCard(item));
        });

        newsGrid.replaceChildren(fragment);

        // Apply the current language if the portal exposes it.
        const currentLanguage =
            document.documentElement.lang ||
            document.body.getAttribute("data-language");

        if (currentLanguage === "ha") {
            newsGrid.querySelectorAll("[data-ha]").forEach(function (element) {
                element.textContent = element.getAttribute("data-ha");
            });
        }

    }

    renderNews();

})();
