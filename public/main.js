(function () {
    const postsGrid = document.getElementById("posts-grid");
    const loading = document.getElementById("loading");
    const errorMessage = document.getElementById("error-message");
    const emptyState = document.getElementById("empty-state");
    const pagination = document.getElementById("pagination");
    const btnPrev = document.getElementById("btn-prev");
    const btnNext = document.getElementById("btn-next");
    const pageInfo = document.getElementById("page-info");
    const searchInput = document.getElementById("search-input");
    const sortSelect = document.getElementById("sort-select");
    const postsCount = document.getElementById("posts-count");
    const lightboxTitle = document.getElementById("lightbox-title");
    const lightboxImage = document.getElementById("lightbox-image");

    const lightboxModal = new bootstrap.Modal(
        document.getElementById("lightboxModal")
    );

    const LIMIT = 12;
    let currentPage = 1;
    let totalPages = 1;
    let searchTimeout = null;

    // --- Skeleton loader ---
    function showSkeletons(count) {
        postsGrid.innerHTML = "";
        for (let i = 0; i < count; i++) {
            const col = document.createElement("div");
            col.className = "col-12 col-sm-6 col-lg-4";
            col.innerHTML = `
                <div class="skeleton-card">
                    <div class="skeleton-img"></div>
                    <div class="p-3">
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line short"></div>
                    </div>
                </div>`;
            postsGrid.appendChild(col);
        }
    }

    // --- Render a single post card ---
    function createPostCard(post) {
        const col = document.createElement("div");
        col.className = "col-12 col-sm-6 col-lg-4";

        col.innerHTML = `
            <div class="card post-card h-100" data-title="${escapeAttr(post.title)}" data-image="${escapeAttr(post.image)}">
                <div class="card-img-wrapper">
                    <img
                        src="${post.image}"
                        alt="${escapeAttr(post.title)}"
                        class="card-img-top"
                        loading="lazy"
                    >
                    <button class="btn-download" title="تحميل الصورة" data-id="${post.id}" data-title="${escapeAttr(post.title)}">
                        <i class="bi bi-download"></i>
                    </button>
                </div>
                <div class="card-body">
                    <p class="card-title">${escapeHtml(post.title)}</p>
                </div>
            </div>`;

        // Lightbox click
        const card = col.querySelector(".post-card");
        card.addEventListener("click", () => openLightbox(post));

        // Download button
        const downloadBtn = col.querySelector(".btn-download");
        downloadBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            downloadImage(post.id, post.title);
        });

        return col;
    }

    // --- Lightbox ---
    function openLightbox(post) {
        lightboxImage.src = post.image;
        lightboxImage.alt = post.title;
        lightboxTitle.textContent = post.title || "";
        lightboxModal.show();
    }

    // Clear lightbox on close
    document
        .getElementById("lightboxModal")
        .addEventListener("hidden.bs.modal", () => {
            lightboxImage.src = "";
            lightboxImage.alt = "";
            lightboxTitle.textContent = "";
        });

    // --- Download ---
    async function downloadImage(id, title) {
        try {
            const res = await fetch(`/api/posts/${id}/image`);
            if (!res.ok) throw new Error("Download failed");

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${id}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Download error:", err);
        }
    }

    // --- Pagination ---
    function updatePaginationUI() {
        if (pageInfo) pageInfo.textContent = `صفحة ${currentPage} من ${totalPages}`;
        if (btnPrev) {
            btnPrev.disabled = currentPage <= 1;
            btnPrev.classList.toggle("disabled", currentPage <= 1);
        }
        if (btnNext) {
            btnNext.disabled = currentPage >= totalPages;
            btnNext.classList.toggle("disabled", currentPage >= totalPages);
        }
    }

    function renderPosts(posts) {
        postsGrid.innerHTML = "";
        posts.forEach((post) => {
            postsGrid.appendChild(createPostCard(post));
        });
    }

    function getSearchParams() {
        const search = searchInput ? searchInput.value.trim() : "";
        const sort = sortSelect ? sortSelect.value : "newest";
        return { search, sort };
    }

    async function fetchPage(page) {
        showView("loading");
        showSkeletons(LIMIT);

        const { search, sort } = getSearchParams();
        const params = new URLSearchParams({
            page: page,
            limit: LIMIT,
            sort: sort,
        });
        if (search) params.set("search", search);

        try {
            const res = await fetch(`/api/posts?${params.toString()}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            const { posts, pagination: pag } = data;

            currentPage = pag.page;
            totalPages = pag.totalPages;

            // Update posts count
            if (postsCount) {
                postsCount.textContent = `${pag.total} مقتطف`;
                postsCount.classList.remove("d-none");
            }

            if (!posts || posts.length === 0) {
                showView("empty");
                if (pagination) pagination.classList.add("d-none");
                if (postsCount) postsCount.classList.add("d-none");
                return;
            }

            renderPosts(posts);
            updatePaginationUI();
            showView("posts");
            if (pagination) pagination.classList.remove("d-none");

            // Scroll to top of grid
            postsGrid.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (err) {
            console.error("Failed to load posts:", err);
            showView("error");
        }
    }

    // --- Search & Sort handlers ---
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                fetchPage(1);
            }, 300);
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener("change", () => {
            fetchPage(1);
        });
    }

    // --- Pagination button handlers ---
    if (btnPrev) {
        btnPrev.addEventListener("click", () => {
            if (currentPage > 1) fetchPage(currentPage - 1);
        });
    }

    if (btnNext) {
        btnNext.addEventListener("click", () => {
            if (currentPage < totalPages) fetchPage(currentPage + 1);
        });
    }

    // --- Helpers ---
    function escapeHtml(text) {
        const div = document.createElement("div");
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    function escapeAttr(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function showView(view) {
        loading.classList.add("d-none");
        errorMessage.classList.add("d-none");
        emptyState.classList.add("d-none");
        postsGrid.classList.add("d-none");

        if (view === "loading") loading.classList.remove("d-none");
        else if (view === "error") errorMessage.classList.remove("d-none");
        else if (view === "empty") emptyState.classList.remove("d-none");
        else if (view === "posts") postsGrid.classList.remove("d-none");
    }

    // --- Init ---
    fetchPage(1);
})();
