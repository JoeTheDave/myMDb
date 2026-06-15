# myMDb — Vision

## Purpose
A personal IMDb-style movie and TV catalog for Joe and invited users to browse, rate, and manage a curated film collection with full cast/crew data and automatic metadata enrichment.

## Target User
Joe as the primary admin — the only one who adds and curates content. Family members and close friends as invited viewers who can browse the catalog and see ratings.

## Value Proposition
A private, fully-controlled database that mirrors IMDb's feature set but is curated entirely by hand. No algorithmic noise, no ads, no accounts to manage with a third-party service. Data is owned by Joe and can be shaped exactly how he wants it: which movies are in, how cast is displayed, which images are used, and how ratings are surfaced (Rotten Tomatoes-sourced, not crowd-sourced from strangers).

## Business Model
Personal project — no revenue.

## Competitive Landscape
IMDb, Letterboxd, Plex, Trakt. None offer the combination of invite-only access, custom image curation with focal points, and admin-controlled metadata enrichment pipelines. The differentiator is full ownership and hand-curation over raw comprehensiveness.

## Roadmap

### Shipped
- Core movie/TV catalog with cast and actor management
- Google OAuth with role-based access (VIEWER / EDITOR / ADMIN)
- Image upload to S3 with stale-image cleanup
- Rotten Tomatoes critic and audience ratings (auto-fetched via scraper)
- TMDB cast auto-import per movie
- Amazon Prime URL tracking with auto-lookup
- Trailer URL auto-lookup
- Image focal point editor for actors and role images
- Cast sort order controls (by actor, by role, custom drag-and-drop)

### Post-MVP Direction
- Actor enrichment: image search and auto-population for actors missing photos
- Movie enrichment UX: guided workflow to fully populate a new media entry
- UI polish pass

## Out of Scope (Strategic)
- Public access or self-registration
- User-generated content (reviews, text ratings from viewers)
- Social features (follows, feeds, recommendations)
- Direct streaming integrations beyond Amazon Prime URL tracking
