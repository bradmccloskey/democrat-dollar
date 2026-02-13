# Roadmap: Candidate View Feature

## Phase 1: Data Pipeline — Candidate Fetcher
- Add FEC API functions to discover NC/Wake County candidates
- Fetch candidate details (name, party, office, district, state)
- Fetch contributions TO each candidate (Schedule A for individual/PAC donors)
- Aggregate donor data per candidate
- Push to new `candidates` Firestore collection

## Phase 2: Firebase Infrastructure
- Update Firestore rules to allow reads on `candidates` collection
- Add Firestore indexes for candidate queries (by office, party, state)

## Phase 3: iOS Data Layer
- Create `Candidate` model (Codable, Identifiable)
- Create `Donor` model for individual donors within a candidate
- Create `CandidateViewModel` with Firestore listener

## Phase 4: iOS UI — Candidate Views
- `CandidateListView` — browseable list of candidates with search/filter
- `CandidateRowView` — compact row showing candidate name, party, office, total raised
- `CandidateDetailView` — full detail with donor list, amounts, party info
- Filter controls: by office (Senate/House/Governor/State), by party (D/R)

## Phase 5: iOS Navigation Integration
- Add "Candidates" tab to ContentView's TabView
- Wire up navigation from candidate list to detail views

## Phase 6: Testing & Polish
- Run updater in dry-run mode to verify data pipeline
- Verify iOS app builds and displays candidate data
- Update About view with candidate feature info
