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
let currentAchievementRows = [];
let selectedProfile = null;

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
  if (activeResultFilter === "athlete") return Boolean(getAthleteName(row));
  if (activeResultFilter === "school") {
    return getOrganizationProfile(row).type === "school";
  }
  if (activeResultFilter === "club") {
    return getOrganizationProfile(row).type === "club";
  }
  return true;
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

function getSchoolName(row) {
  return row.school_name || (row.organization_type === "school" ? row.organization_name : "");
}

function getClubName(row) {
  return row.club_name || (row.organization_type === "club" ? row.organization_name : "");
}

function inferOrganizationType(name) {
  const lowered = normalise(name);
  if (!lowered) return "";
  const schoolWords = [
    "school",
    "primary",
    "secondary",
    "junior college",
    "institution",
    "polytechnic",
    "university",
    "madrasah",
  ];
  if (schoolWords.some((word) => lowered.includes(word))) return "school";
  return "club";
}

function getOrganizationProfile(row) {
  const school = getSchoolName(row);
  const club = getClubName(row);
  if (school) return { type: "school", name: school };
  if (club) return { type: "club", name: club };
  if (row.organization_name) {
    return {
      type: inferOrganizationType(row.organization_name),
      name: row.organization_name,
    };
  }
  return { type: "", name: "" };
}

function isGroupAchievement(row) {
  const text = [
    row.event_name,
    row.category,
    row.athlete_name,
    row.team_name,
  ]
    .join(" ")
    .toLowerCase();

  return ["group event", "group quanshu", "jiti", "duilian", "集体"].some((marker) =>
    text.includes(marker)
  );
}

function getAthleteName(row) {
  const athlete = String(row.athlete_name || "").replace(/\s+/g, " ").trim();
  if (!athlete || athlete === "队" || isGroupAchievement(row)) return "";
  return athlete;
}

function smartTitleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bCc\b/g, "CC")
    .replace(/\bRc\b/g, "RC")
    .replace(/\bCsn\b/g, "CSN");
}

function canonicalEntityName(type, name) {
  let value = String(name || "").replace(/\s+/g, " ").trim();
  if (!value) return "";

  value = value
    .replace(/\bTeam\s+[A-Z0-9]+\b/gi, "")
    .replace(/\bGroup\s+[A-Z0-9]+\b/gi, "")
    .replace(/队/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (type === "school") {
    value = value
      .replace(/\bPr\s+Sch\b/gi, "Primary School")
      .replace(/\bPri\s+Sch\b/gi, "Primary School")
      .replace(/\bSec\s+Sch\b/gi, "Secondary School");

    const lowered = value.toLowerCase();
    if (lowered.includes("nan chiau primary")) return "Nan Chiau Primary School";
    if (lowered.includes("nan chiau high")) return "Nan Chiau High School";
  }

  if (value === value.toUpperCase() && /[A-Z]/.test(value)) {
    return smartTitleCase(value);
  }

  return value;
}

function profileKey(type, name) {
  return `${type}:${normalise(canonicalEntityName(type, name))}`;
}

function addProfile(profiles, type, name, row) {
  const displayName = canonicalEntityName(type, name);
  if (!displayName) return;
  const key = profileKey(type, displayName);
  if (!profiles.has(key)) {
    profiles.set(key, {
      key,
      type,
      name: displayName,
      rows: [],
      schools: new Set(),
      clubs: new Set(),
      competitions: new Set(),
    });
  }

  const profile = profiles.get(key);
  profile.rows.push(row);
  if (getSchoolName(row)) profile.schools.add(canonicalEntityName("school", getSchoolName(row)));
  if (getClubName(row)) profile.clubs.add(canonicalEntityName("club", getClubName(row)));
  if (row.competition_name) profile.competitions.add(row.competition_name);
}

function buildProfiles(rows, term) {
  const profiles = new Map();
  const loweredTerm = normalise(term);

  rows.forEach((row) => {
    const athlete = getAthleteName(row);
    const school = getSchoolName(row);
    const club = getClubName(row);
    const organizationProfile = getOrganizationProfile(row);

    if (activeResultFilter === "athlete") {
      addProfile(profiles, "athlete", athlete, row);
    } else if (activeResultFilter === "school") {
      addProfile(profiles, "school", school || (organizationProfile.type === "school" ? organizationProfile.name : ""), row);
    } else if (activeResultFilter === "club") {
      addProfile(profiles, "club", club || (organizationProfile.type === "club" ? organizationProfile.name : ""), row);
    } else {
      if (normalise(athlete).includes(loweredTerm)) addProfile(profiles, "athlete", athlete, row);
      if (normalise(school).includes(loweredTerm)) addProfile(profiles, "school", school, row);
      if (normalise(club).includes(loweredTerm)) addProfile(profiles, "club", club, row);
      if (
        organizationProfile.name &&
        normalise(organizationProfile.name).includes(loweredTerm) &&
        !school &&
        !club
      ) {
        addProfile(profiles, organizationProfile.type, organizationProfile.name, row);
      }
    }
  });

  return Array.from(profiles.values()).sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.name.localeCompare(b.name);
  });
}

function typeLabel(type) {
  return {
    athlete: "Athlete",
    school: "School",
    club: "Club",
  }[type] || "Profile";
}

function renderProfileMatches(rows, term) {
  achievementResults.innerHTML = "";

  const visibleRows = rows.filter(resultMatchesActiveFilter);
  const profiles = buildProfiles(visibleRows, term);

  if (!profiles.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No matching athletes, schools, or clubs found.";
    achievementResults.append(empty);
    return;
  }

  profiles.forEach((profile) => {
    const button = document.createElement("button");
    button.className = "profile-card";
    button.type = "button";

    const title = document.createElement("h4");
    title.textContent = profile.name;

    const label = document.createElement("span");
    label.className = `profile-type profile-${profile.type}`;
    label.textContent = typeLabel(profile.type);

    const summary = document.createElement("p");
    summary.textContent = `${profile.rows.length} achievement${profile.rows.length === 1 ? "" : "s"} across ${profile.competitions.size || 1} competition${profile.competitions.size === 1 ? "" : "s"}`;

    const meta = document.createElement("ul");
    meta.className = "profile-meta";

    if (profile.type === "athlete") {
      addMetaItem(meta, "Affiliations", [...profile.schools, ...profile.clubs].filter(Boolean).join(", ") || "Not recorded");
    } else {
      const athletes = new Set(profile.rows.map((row) => getAthleteName(row)).filter(Boolean));
      addMetaItem(meta, "Athletes", athletes.size);
    }

    button.append(label, title, summary, meta);
    button.addEventListener("click", () => {
      selectedProfile = profile;
      renderProfileDetails(profile);
    });

    achievementResults.append(button);
  });
}

function renderProfileDetails(profile) {
  achievementResults.innerHTML = "";

  const panel = document.createElement("article");
  panel.className = "profile-detail";

  const back = document.createElement("button");
  back.className = "profile-back";
  back.type = "button";
  back.textContent = "Back to matches";
  back.addEventListener("click", () => {
    selectedProfile = null;
    renderProfileMatches(currentAchievementRows, cleanSearchTerm(resultsSearchInput.value));
  });

  const label = document.createElement("span");
  label.className = `profile-type profile-${profile.type}`;
  label.textContent = typeLabel(profile.type);

  const title = document.createElement("h3");
  title.textContent = profile.name;

  const summary = document.createElement("p");
  summary.textContent = `${profile.rows.length} achievement${profile.rows.length === 1 ? "" : "s"} recorded.`;

  const affiliationList = document.createElement("ul");
  affiliationList.className = "result-meta affiliations";

  if (profile.type === "athlete") {
    const affiliations = [...profile.schools, ...profile.clubs].filter(Boolean);
    addMetaItem(affiliationList, "Affiliations", affiliations.join(", ") || "Not recorded");
  } else {
    const athletes = new Set(profile.rows.map((row) => getAthleteName(row)).filter(Boolean));
    addMetaItem(affiliationList, "Represented by", `${athletes.size} athlete${athletes.size === 1 ? "" : "s"}`);
  }

  panel.append(back, label, title, summary, affiliationList);
  achievementResults.append(panel);

  const rows = [...profile.rows].sort((a, b) => {
    const yearA = Number(a.competition_year || 0);
    const yearB = Number(b.competition_year || 0);
    return yearB - yearA;
  });

  rows.forEach((row) => {
    const card = document.createElement("article");
    card.className = "result-item";

    const title = document.createElement("h4");
    title.textContent = row.event_name || "Event not recorded";

    const achievementLine = document.createElement("p");
    achievementLine.className = "achievement-line";
    achievementLine.textContent = getAchievementLine(row);

    const meta = document.createElement("ul");
    meta.className = "result-meta";

    addMetaItem(meta, "Competition", row.competition_name);
    addMetaItem(meta, "Year", row.competition_year);

    if (profile.type !== "athlete") {
      addMetaItem(meta, "Athlete", getAthleteName(row));
      if (!getAthleteName(row)) addMetaItem(meta, "Representative", row.team_name || "Team event");
    }

    if (profile.type === "athlete") {
      addMetaItem(meta, "School", canonicalEntityName("school", getSchoolName(row)));
      addMetaItem(meta, "Club", canonicalEntityName("club", getClubName(row)));
    }

    card.append(title);
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
  const resultLimit = activeResultFilter === "school" || activeResultFilter === "club" ? "800" : "500";
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
    renderProfileMatches([], "");
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
    currentAchievementRows = rows;
    selectedProfile = null;
    const profiles = buildProfiles(rows.filter(resultMatchesActiveFilter), term);
    databaseStatus.textContent = rows.length
      ? `Showing ${profiles.length} matching profile${profiles.length === 1 ? "" : "s"}. Select one to view achievements.`
      : "No matching profiles found.";
    renderProfileMatches(rows, term);
  } catch (error) {
    databaseStatus.textContent =
      "Achievement search could not load. Check your Supabase public URL, anon key, and table permissions.";
    currentAchievementRows = [];
    selectedProfile = null;
    renderProfileMatches([], term);
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
