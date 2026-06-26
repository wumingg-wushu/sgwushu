const grid = document.querySelector("#listing-grid");
const searchInput = document.querySelector("#search");
const filterButtons = document.querySelectorAll(".filter");
const counts = {
  club: document.querySelector("#club-count"),
  shop: document.querySelector("#shop-count"),
  event: document.querySelector("#event-count"),
};

let listings = [];
let activeFilter = "all";

const typeLabels = {
  club: "Club",
  class: "Class",
  shop: "Shop",
  event: "Event",
};

function normalise(value) {
  return String(value || "").toLowerCase();
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

function renderCounts() {
  const clubTotal = listings.filter((item) => item.type === "club" || item.type === "class").length;
  const shopTotal = listings.filter((item) => item.type === "shop").length;
  const eventTotal = listings.filter((item) => item.type === "event").length;

  counts.club.textContent = clubTotal;
  counts.shop.textContent = shopTotal;
  counts.event.textContent = eventTotal;
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

async function loadListings() {
  try {
    const response = await fetch("data/listings.json");
    listings = await response.json();
    renderCounts();
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

searchInput.addEventListener("input", renderListings);

loadListings();
