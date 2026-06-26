const grid = document.querySelector("#listing-grid");
const searchInput = document.querySelector("#search");
const filterButtons = document.querySelectorAll(".filter");

const resultsSearchInput = document.querySelector("#results-search");
const resultFilterButtons = document.querySelectorAll(".result-filter");
const databaseStatus = document.querySelector("#database-status");
const achievementResults = document.querySelector("#achievement-results");
const achievementStats = {
  rows: document.querySelector("#achievement-count"),
  schools: document.querySelector("#school-count"),
  clubs: document.querySelector("#club-count"),
};

let listings = [];
let activeFilter = "all";
let activeResultFilter = "all";
let searchTimer;

const typeLabels = {
  club: "Club",
  class: "Class",
  shop: "Shop",
  event: "Event",
};

const resultColumns = [
  "id",
  "competition_name",
  "competition_year",
  "competition_start_date",
  "event_name",
  "athlete_name",
  "team_name",
  "organization_name",
  "organization_type",
  "school_name",
  "club_name",
  "rank_number",
  "rank_text",
  "score",
  "medal",
  "result_status",
  "source_url",
  "verified",
].join(",");

function normalise(value) {
  return String(value || "").toLowerCase().trim();
}

function cleanSearchTerm(value) {
  return String(value || "").replace(/[(),*]/g, " ").replace(/\s+/g, " ").trim();
}

function hasSupabaseConfig() {
  const url = window.WUSHU_SUPABASE_URL || "";
  const key = window.WUSHU_SUPABASE_ANON_KEY || "";
  return url.startsWith("https://") && key && !url.includes("YOUR-") && !key.includes("YOUR-");
}

function buildSupabaseUrl(tableName, params = {}) {
  const baseUrl = String(window.WUSHU_SUPABASE_URL || "").replace(/\/$/, "");
  const url = new URL(`${baseUrl}/rest/v1/${tableName}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return url;
}

async function fetchSupabaseRows(tableName, params = {}) {
  const headers = {
    apikey: window.WUSHU_SUPABASE_ANON_KEY,
    Accept: "application/json",
  };

  if (String(window.WUSHU_SUPABASE_ANON_KEY || "").startsWith("eyJ")) {
    headers.Authorization = `Bearer ${window.WUSHU_SUPABASE_ANON_KEY}`;
  }

  const response = await fetch(buildSupabaseUrl(tableName, params), {
    headers,
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status}`);
  }

  return response.json();
}

function listingMatchesSearch(listing, term) {
  const content = [
    listing.name,
    listing.type,
    listing.area,
    listing.venue,
    listing.description,
    listing.contact,
    listing.tags?.join(" "),
  ].join(" ");

  return normalise(content).includes(term);
}

function renderListings() {
  const term = normalise(searchInput.value.trim());

  const visible = listings.filter((listing) => {
    const filterMatches = activeFilter === "all" || listing.type === activeFilter;
    return filterMatches && listingMatchesSearch(listing, term);
  });

  grid.innerHTML = "";

  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No listings found. Try a different search or filter.";
    grid.append(empty);
    return;
  }

  visible.forEach((listing) => {
    const card = document.createElement("article");
    card.className = `card card-${listing.type}`;

    const top = document.createElement("div");
    top.className = "card-top";

    const title = document.createElement("h3");
    title.textContent = listing.name;

    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = typeLabels[listing.type] || listing.type;

    top.append(title, tag);

    const verified = document.createElement("p");
    verified.className = "verified";
    verified.textContent = listing.lastVerified
      ? `Checked ${listing.lastVerified}`
      : "Pending review";

    const meta = document.createElement("ul");
    meta.className = "meta";

    [
      ["Area", listing.area],
      ["Venue", listing.venue],
      ["Contact", listing.contact],
    ].forEach(([label, value]) => {
      if (!value) return;
      const item = document.createElement("li");
      item.textContent = `${label}: ${value}`;
      meta.append(item);
    });

    const description = document.createElement("p");
    description.textContent = listing.description;

    card.append(top, verified, meta, description);

    if (listing.sourceUrl) {
      const source = document.createElement("a");
      source.href = listing.sourceUrl;
      source.target = "_blank";
      source.rel = "noreferrer";
      source.className = "source-link";
      source.textContent = "View source";
      card.append(source);
    }

    grid.append(card);
  });
}

function resultMatchesActiveFilter(row) {
  if (activeResultFilter === "athlete") return Boolean(row.athlete_name);
  if (activeResultFilter === "school") {
    return Boolean(row.school_name) || row.organization_type === "school";
  }
  if (activeResultFilter === "club") {
    return Boolean(row.club_name) || row.organization_type === "club";
  }
  return true;
}

function getPrimaryResultName(row) {
  if (activeResultFilter === "school") {
    return row.school_name || row.organization_name || "School achievement";
  }
  if (activeResultFilter === "club") {
    return row.club_name || row.organization_name || "Club achievement";
  }
  return row.athlete_name || row.team_name || row.school_name || row.club_name || row.organization_name || "Achievement";
}

function getRepresentativeName(row) {
  return row.athlete_name || row.team_name || "";
}

function getAchievementLine(row) {
  const rank = row.rank_number || row.rank_text;
  const rankText = rank ? `Rank ${rank}` : "";
  const medalText = row.medal && row.medal !== "none" ? row.medal : "";
  return [rankText, medalText, row.score ? `Score ${row.score}` : row.result_status]
    .filter(Boolean)
    .join(" · ");
}

function addMetaItem(list, label, value, className = "") {
  if (value === undefined || value === null || value === "") return;
  const item = document.createElement("li");
  item.textContent = label ? `${label}: ${value}` : value;
  if (className) item.className = className;
  list.append(item);
}

function renderAchievementRows(rows) {
  achievementResults.innerHTML = "";

  const visibleRows = rows.filter(resultMatchesActiveFilter);

  if (!visibleRows.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent =
      "No achievement rows found yet. Upload full result rows into raw_result_imports to enable this search.";
    achievementResults.append(empty);
    return;
  }

  visibleRows.forEach((row) => {
    const card = document.createElement("article");
    card.className = "result-item";

    const title = document.createElement("h4");
    title.textContent = getPrimaryResultName(row);

    const event = document.createElement("p");
    event.textContent = row.event_name || "Event not recorded";

    const representative = document.createElement("p");
    representative.className = "representative";
    const representativeName = getRepresentativeName(row);
    if (activeResultFilter === "school" && representativeName) {
      representative.textContent = `Represented by: ${representativeName}`;
    } else if (activeResultFilter === "club" && representativeName) {
      representative.textContent = `Represented by: ${representativeName}`;
    } else {
      representative.textContent = "";
    }

    const achievementLine = document.createElement("p");
    achievementLine.className = "achievement-line";
    achievementLine.textContent = getAchievementLine(row);

    const meta = document.createElement("ul");
    meta.className = "result-meta";

    addMetaItem(meta, "Competition", row.competition_name);
    addMetaItem(meta, "Year", row.competition_year);
    addMetaItem(meta, "School", row.school_name);
    addMetaItem(meta, "Club", row.club_name);
    addMetaItem(meta, "Organisation", row.organization_name);

    card.append(title, event);
    if (representative.textContent) card.append(representative);
    if (achievementLine.textContent) card.append(achievementLine);
    card.append(meta);

    if (row.source_url) {
      const source = document.createElement("a");
      source.href = row.source_url;
      source.target = "_blank";
      source.rel = "noreferrer";
      source.className = "source-link";
      source.textContent = "View source";
      card.append(source);
    }

    achievementResults.append(card);
  });
}

function buildAchievementSearchParams(term) {
  const wildcard = `*${term}*`;
  const resultLimit = activeResultFilter === "school" || activeResultFilter === "club" ? "500" : "120";
  const params = {
    select: resultColumns,
    limit: resultLimit,
    order: "competition_start_date.desc.nullslast,competition_year.desc.nullslast",
  };

  if (activeResultFilter === "athlete") {
    params.athlete_name = `ilike.${wildcard}`;
  } else if (activeResultFilter === "school") {
    params.or = `(school_name.ilike.${wildcard},organization_name.ilike.${wildcard})`;
  } else if (activeResultFilter === "club") {
    params.or = `(club_name.ilike.${wildcard},organization_name.ilike.${wildcard})`;
  } else {
    params.or = [
      `athlete_name.ilike.${wildcard}`,
      `team_name.ilike.${wildcard}`,
      `school_name.ilike.${wildcard}`,
      `club_name.ilike.${wildcard}`,
      `organization_name.ilike.${wildcard}`,
    ].join(",");
    params.or = `(${params.or})`;
  }

  return params;
}

async function runAchievementSearch() {
  if (!hasSupabaseConfig()) {
    databaseStatus.textContent =
      "Supabase is not connected yet. Paste your public Supabase URL and anon key into supabase-config.js.";
    renderAchievementRows([]);
    return;
  }

  const term = cleanSearchTerm(resultsSearchInput.value);

  if (term.length < 2) {
    databaseStatus.textContent =
      "Type at least 2 characters to search athlete, school, or club achievements.";
    achievementResults.innerHTML =
      '<p class="empty">Search will appear here after full result rows are uploaded.</p>';
    return;
  }

  databaseStatus.textContent = "Searching achievements...";

  try {
    const rows = await fetchSupabaseRows("raw_result_imports", buildAchievementSearchParams(term));
    const label = activeResultFilter === "school" ? "school achievement rows" : "matching achievement rows";
    databaseStatus.textContent = rows.length
      ? `Showing ${rows.length} ${label}.`
      : "No matching achievement rows found.";
    renderAchievementRows(rows);
  } catch (error) {
    databaseStatus.textContent =
      "Achievement search could not load. Check your Supabase public URL, anon key, and table permissions.";
    renderAchievementRows([]);
  }
}

async function loadAchievementStats() {
  if (!hasSupabaseConfig()) return;

  try {
    const rows = await fetchSupabaseRows("raw_result_imports", {
      select: "athlete_name,school_name,club_name,organization_name,organization_type",
      limit: "10000",
    });

    const schools = new Set();
    const clubs = new Set();

    rows.forEach((row) => {
      const school = row.school_name || (row.organization_type === "school" ? row.organization_name : "");
      const club = row.club_name || (row.organization_type === "club" ? row.organization_name : "");
      if (normalise(school)) schools.add(normalise(school));
      if (normalise(club)) clubs.add(normalise(club));
    });

    achievementStats.rows.textContent = rows.length;
    achievementStats.schools.textContent = schools.size;
    achievementStats.clubs.textContent = clubs.size;

    databaseStatus.textContent = rows.length
      ? "Achievement database connected."
      : "Database connected, but no achievement rows were found yet.";
  } catch (error) {
    databaseStatus.textContent =
      "Database connection is not ready yet. Check your public Supabase settings.";
  }
}

async function loadListings() {
  try {
    const response = await fetch("data/listings.json");
    listings = await response.json();
    renderListings();
  } catch (error) {
    grid.innerHTML =
      '<p class="empty">Listings could not be loaded. Check that data/listings.json was uploaded with the website files.</p>';
  }
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    activeFilter = button.dataset.filter;
    renderListings();
  });
});

resultFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    resultFilterButtons.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    activeResultFilter = button.dataset.resultFilter;
    runAchievementSearch();
  });
});

searchInput.addEventListener("input", renderListings);

resultsSearchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(runAchievementSearch, 260);
});

achievementResults.innerHTML =
  '<p class="empty">Upload full result rows, then search by athlete, school, or club.</p>';

loadListings();
loadAchievementStats();
