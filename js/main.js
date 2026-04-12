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
   Blog List Page — fetches posts/index.json and renders posts
   ============================================================ */
async function loadBlogList() {
  const container = document.getElementById("post-list");
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;padding:48px"><div class="spinner"></div></div>';

  try {
    const res = await fetch("posts/index.json");
    if (!res.ok) throw new Error("Failed to load posts");
    const posts = await res.json();

    if (!posts.length) {
      container.innerHTML = `
        <div class="blog-empty">
          <span style="font-size:2.5rem">✏️</span>
          <p>No posts yet — check back soon!</p>
        </div>`;
      return;
    }

    container.innerHTML = "";
    const ul = document.createElement("ul");
    ul.className = "post-list";

    posts
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach(function (post) {
        const li = document.createElement("li");
        li.className = "post-item fade-in";
        li.innerHTML = `
          <div class="post-item-meta">
            <span class="post-date">${formatDate(post.date)}</span>
            <div class="post-tags">
              ${(post.tags || []).map(t => `<span class="post-tag">${t}</span>`).join("")}
            </div>
          </div>
          <a class="post-title" href="post.html?slug=${encodeURIComponent(post.slug)}">${post.title}</a>
          <p class="post-excerpt">${post.excerpt || ""}</p>`;
        ul.appendChild(li);
      });

    container.appendChild(ul);

    // Re-trigger fade-ins for dynamically added elements
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
    container.querySelectorAll(".fade-in").forEach(function (el) { obs.observe(el); });

  } catch (err) {
    container.innerHTML = `
      <div class="blog-empty">
        <span style="font-size:2rem">⚠️</span>
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
    const res = await fetch(`posts/${encodeURIComponent(slug)}.json`);
    if (!res.ok) throw new Error(`Post not found (${res.status})`);
    const post = await res.json();

    document.title = `${post.title} — Blog`;
    titleEl.textContent = post.title;

    const dateEl = document.getElementById("post-date");
    if (dateEl) dateEl.textContent = formatDate(post.date);

    const tagsEl = document.getElementById("post-tags");
    if (tagsEl) tagsEl.innerHTML = (post.tags || []).map(t => `<span class="post-tag">${t}</span>`).join("");

    const contentEl = document.getElementById("post-content");
    if (contentEl) {
      contentEl.innerHTML = Array.isArray(post.content) ? post.content.join("\n") : post.content;
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
   Entry Points
   ============================================================ */
document.addEventListener("DOMContentLoaded", function () {
  loadBlogList();
  loadPost();
});
