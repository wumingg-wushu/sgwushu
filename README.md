# Singapore Wushu Directory Starter

This is a simple starter website you can upload to GitHub Pages before paying
for website hosting.

## Files to upload

Upload everything in this folder to your GitHub repository:

- `index.html`
- `styles.css`
- `script.js`
- `data/listings.json`
- `data/listings-template.csv`
- `assets/images/wushu-training-hero.png`

## How to publish on GitHub Pages

1. Open your GitHub repository.
2. Click **Add file**.
3. Choose **Upload files**.
4. Drag all the files and folders from this starter folder into GitHub.
5. Click **Commit changes**.
6. Go to **Settings**.
7. Go to **Pages**.
8. Set source to **Deploy from a branch**.
9. Choose branch **main** and folder **/root**.
10. Save.

GitHub will give you a public website link after it publishes.

## How to edit listings

The website reads listings from:

```text
data/listings.json
```

Each listing has this shape:

```json
{
  "name": "Example Wushu Club",
  "type": "club",
  "area": "Central",
  "venue": "Community sports hall",
  "contact": "hello@example.com",
  "description": "Short description of the listing.",
  "tags": ["modern wushu", "youth", "adult"],
  "sourceUrl": "https://example.com",
  "lastVerified": "2026-06-26"
}
```

Allowed `type` values:

- `club`
- `class`
- `shop`
- `event`

## Easier data collection

Use `data/listings-template.csv` as a spreadsheet template. You can collect
data in Google Sheets first, review it, and later convert the approved rows into
`data/listings.json`.

## Suggested next step

Replace the sample listings with 5 to 10 real verified listings before sharing
the site publicly.

## Easy design management

Most of the visual tone is controlled at the top of `styles.css`.

```css
--ivory: #fbf7ef;
--ink: #15171c;
--burgundy: #8f1d1d;
--gold: #c8a45d;
--jade: #2f6f5e;
```

Change those colour variables first if you want a new look later. The rest of
the CSS is grouped into clear sections: header, hero, buttons, trust and stats,
layout, listing cards, footer, and responsive mobile rules.
