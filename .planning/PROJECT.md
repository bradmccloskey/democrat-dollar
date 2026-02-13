# DemocratDollar - Candidate View Feature

## Project Overview
DemocratDollar is an iOS app that tracks corporate PAC donations to political candidates.
Currently shows: **Company -> Party breakdown** (which companies lean D vs R).
New feature: **Candidate View** — show individual candidates and who funds them.

## Architecture
- **iOS App**: SwiftUI with `@Observable` pattern, Firebase Firestore for data
- **Data Pipeline**: Node.js updater fetches FEC API data, pushes to Firestore
- **Backend**: Firebase Firestore (read-only rules for app, Admin SDK writes)

## Scope: Candidate View Feature
Focus: Wake County, North Carolina — state-level and national-level races

### What we're building:
1. **Data Pipeline** (`updater/`): New module to fetch NC/Wake County candidates from FEC API, aggregate their donors (PACs, companies, individuals), push to new `candidates` Firestore collection
2. **iOS Models** (`app/`): New `Candidate` model with donors list
3. **iOS Views** (`app/`): Candidate list view, candidate detail view, filtering by office/party/race
4. **iOS Navigation**: New "Candidates" tab in the tab bar
5. **Firestore**: New `candidates` collection, updated rules and indexes

### Key FEC API endpoints needed:
- `/candidates/search/` — search candidates by state, district, office
- `/schedules/schedule_a/` — individual contributions TO a candidate's committee
- `/schedules/schedule_b/` — disbursements FROM PACs TO candidate committees (already used)
- `/candidate/{candidate_id}/` — candidate details

### Wake County NC races to cover:
- US Senate (NC statewide)
- US House NC-02 and NC-13 (Wake County districts)
- NC Governor (statewide)
- NC state legislature races (Wake County)
