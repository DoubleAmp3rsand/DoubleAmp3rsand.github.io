/* ============================================================
   Theme Toggle
   ============================================================ */
(function () {
  const STORAGE_KEY = "theme";
  const root = document.documentElement;

  function getPreferred() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.textContent = theme === "dark" ? "☀" : "☾";
  }

  window.toggleTheme = function () {
    const current = root.getAttribute("data-theme") || "light";
    applyTheme(current === "dark" ? "light" : "dark");
  };

  applyTheme(getPreferred());
})();

/* ============================================================
   Mobile Nav
   ============================================================ */
document.addEventListener("DOMContentLoaded", function () {
  const hamburger = document.getElementById("nav-hamburger");
  const navLinks = document.getElementById("nav-links");
  if (hamburger && navLinks) {
    hamburger.addEventListener("click", function () {
      navLinks.classList.toggle("open");
    });
    navLinks.addEventListener("click", function (e) {
      if (e.target.tagName === "A") navLinks.classList.remove("open");
    });
  }
});

/* ============================================================
   Scroll Fade-In (Intersection Observer)
   ============================================================ */
document.addEventListener("DOMContentLoaded", function () {
  const els = document.querySelectorAll(".fade-in");
  if (!els.length) return;
  const obs = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
  );
  els.forEach(function (el) { obs.observe(el); });
});

/* ============================================================
   Active nav link highlight
   ============================================================ */
document.addEventListener("DOMContentLoaded", function () {
  const path = window.location.pathname;
  document.querySelectorAll(".nav-links a").forEach(function (a) {
    const href = a.getAttribute("href");
    if (!href) return;
    if (
      (path.endsWith("blog.html") && href.includes("blog")) ||
      (path.endsWith("post.html") && href.includes("blog")) ||
      ((path === "/" || path.endsWith("index.html") || path.endsWith("/")) && href.includes("index"))
    ) {
      a.classList.add("active");
    }
  });
});

/* ============================================================
   Markdown loader — fetches a .md file and parses frontmatter
   ============================================================ */
function parseFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!match) return { meta: {}, body: text };

  const meta = {};
  match[1].split("\n").forEach(function (line) {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value.slice(1, -1).split(",").map(function (s) {
        return s.trim().replace(/^["']|["']$/g, "");
      }).filter(Boolean);
    } else {
      value = value.replace(/^["']|["']$/g, "");
    }
    meta[key] = value;
  });

  return { meta: meta, body: match[2] };
}

async function fetchPost(slug) {
  const res = await fetch("posts/" + encodeURIComponent(slug) + ".md");
  if (!res.ok) throw new Error("Post not found (" + res.status + ")");
  const text = await res.text();
  const parsed = parseFrontmatter(text);
  if (!window.marked || typeof window.marked.parse !== "function") {
    throw new Error("Markdown renderer failed to load.");
  }
  return {
    slug: slug,
    title: parsed.meta.title || slug,
    date: parsed.meta.date || "",
    tags: Array.isArray(parsed.meta.tags) ? parsed.meta.tags : (parsed.meta.tags ? [parsed.meta.tags] : []),
    html: window.marked.parse(parsed.body)
  };
}

/* ============================================================
   Blog List Page — fetches posts/index.json and renders posts
   ============================================================ */
async function loadBlogList() {
  const container = document.getElementById("post-list");
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;padding:48px"><div class="spinner"></div></div>';

  try {
    const res = await fetch("posts/index.json");
    if (!res.ok) throw new Error("Failed to load posts");
    const index = await res.json();

    if (!index.length) {
      container.innerHTML = `
        <div class="blog-empty">
          <p>No posts yet — check back soon!</p>
        </div>`;
      return;
    }

    const sorted = index.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

    const posts = await Promise.all(
      sorted.map(function (meta) {
        return fetchPost(meta.slug).catch(function () { return null; });
      })
    );

    if (!posts.some(Boolean)) {
      throw new Error("Posts could not be rendered.");
    }

    container.innerHTML = "";

    posts.forEach(function (post, i) {
      if (!post) return;

      const article = document.createElement("article");
      article.className = "inline-post fade-in";
      article.innerHTML = `
        <div class="inline-post-meta">
          <span class="post-date">${formatDate(post.date)}</span>
          <div class="post-tags">
            ${(post.tags || []).map(function (t) { return '<span class="post-tag">' + t + "</span>"; }).join("")}
          </div>
        </div>
        <h3 class="inline-post-title">${post.title}</h3>
        <div class="post-content">${post.html}</div>`;

      container.appendChild(article);

      if (i < posts.length - 1) {
        const hr = document.createElement("hr");
        hr.className = "section-divider";
        hr.style.margin = "56px 0";
        container.appendChild(hr);
      }
    });

    setupMasonryGalleries();

    const fadeEls = container.querySelectorAll(".fade-in");
    if ("IntersectionObserver" in window) {
      const obs = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("visible");
              obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.05 }
      );
      fadeEls.forEach(function (el) { obs.observe(el); });
      // Safety net: never leave posts stuck invisible if the observer misfires.
      setTimeout(function () {
        fadeEls.forEach(function (el) { el.classList.add("visible"); });
      }, 1200);
    } else {
      fadeEls.forEach(function (el) { el.classList.add("visible"); });
    }

  } catch (err) {
    container.innerHTML = `
      <div class="blog-empty">
        <p>Could not load posts. ${err.message}</p>
      </div>`;
  }
}

/* ============================================================
   Single Post Page — reads ?slug= and fetches posts/<slug>.json
   ============================================================ */
async function loadPost() {
  const titleEl = document.getElementById("post-title");
  if (!titleEl) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");

  if (!slug) {
    showPostError("No post specified.");
    return;
  }

  try {
    const post = await fetchPost(slug);

    document.title = `${post.title} — Blog`;
    titleEl.textContent = post.title;

    const dateEl = document.getElementById("post-date");
    if (dateEl) dateEl.textContent = formatDate(post.date);

    const tagsEl = document.getElementById("post-tags");
    if (tagsEl) tagsEl.innerHTML = (post.tags || []).map(t => `<span class="post-tag">${t}</span>`).join("");

    const contentEl = document.getElementById("post-content");
    if (contentEl) {
      contentEl.innerHTML = post.html;
      setupMasonryGalleries();
      contentEl.classList.add("fade-in");
      setTimeout(() => contentEl.classList.add("visible"), 50);
    }
  } catch (err) {
    showPostError(err.message);
  }
}

function showPostError(msg) {
  const contentEl = document.getElementById("post-content");
  if (contentEl) contentEl.innerHTML = `<p style="color:var(--text-muted)">⚠️ ${msg}</p>`;
}

/* ============================================================
   Utility
   ============================================================ */
function formatDate(str) {
  if (!str) return "";
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/* ============================================================
   Gallery masonry sizing
   ============================================================ */
function setupMasonryGalleries() {
  document.querySelectorAll(".photo-gallery").forEach(function (gallery) {
    var figures = Array.from(gallery.querySelectorAll("figure"));
    var imgs = figures.map(function (f) { return f.querySelector("img"); });
    var total = imgs.filter(Boolean).length;
    if (!total) return;

    var loaded = 0;
    function onLoad() {
      loaded++;
      if (loaded < total) return;
      // Mark landscape images
      figures.forEach(function (figure) {
        var img = figure.querySelector("img");
        if (img && img.naturalWidth > img.naturalHeight * 1.3) {
          figure.classList.add("wide");
        }
      });
      // Set row spans
      resizeMasonryItems(gallery);
    }

    imgs.forEach(function (img) {
      if (!img) return;
      if (img.complete && img.naturalWidth) { onLoad(); }
      else { img.addEventListener("load", onLoad); img.addEventListener("error", onLoad); }
    });
  });
}

function resizeMasonryItems(gallery) {
  var rowSize = 10;
  Array.from(gallery.querySelectorAll("figure")).forEach(function (figure) {
    figure.style.gridRowEnd = "";
    var span = Math.ceil((figure.scrollHeight + 10) / (rowSize + 0));
    figure.style.gridRowEnd = "span " + span;
  });
}

/* ============================================================
   Lightbox
   ============================================================ */
(function () {
  var box, boxImg, boxCaption;

  function buildLightbox() {
    box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");

    var close = document.createElement("button");
    close.className = "lightbox-close";
    close.innerHTML = "&#x2715;";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", closeLightbox);

    boxImg = document.createElement("img");
    boxCaption = document.createElement("p");
    boxCaption.className = "lightbox-caption";

    box.appendChild(close);
    box.appendChild(boxImg);
    box.appendChild(boxCaption);
    document.body.appendChild(box);

    box.addEventListener("click", function (e) {
      if (e.target === box) closeLightbox();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeLightbox();
    });
  }

  function openLightbox(src, caption) {
    if (!box) buildLightbox();
    boxImg.src = src;
    boxCaption.textContent = caption || "";
    box.style.display = "flex";
    requestAnimationFrame(function () { box.classList.add("open"); });
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    if (!box) return;
    box.classList.remove("open");
    box.addEventListener("transitionend", function hide() {
      box.style.display = "none";
      box.removeEventListener("transitionend", hide);
    });
    document.body.style.overflow = "";
  }

  document.addEventListener("click", function (e) {
    var img = e.target.closest(".photo-gallery img");
    if (!img) return;
    var caption = img.closest("figure") && img.closest("figure").querySelector("figcaption");
    openLightbox(img.src, caption ? caption.textContent : "");
  });
})();

window.addEventListener("resize", function () {
  document.querySelectorAll(".photo-gallery").forEach(resizeMasonryItems);
});

/* ============================================================
   Entry Points
   ============================================================ */
document.addEventListener("DOMContentLoaded", function () {
  loadBlogList();
  loadPost();
});
