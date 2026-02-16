# Current State

## Active Phase: Complete
- All feature phases implemented and verified
- Post-completion refactoring complete

## Completed Phases
- Phase 1: Data Pipeline — candidate-fetcher.js module created
- Phase 2: Firebase Infrastructure — rules, indexes, push function updated
- Phase 3: iOS Data Layer — Candidate.swift, CandidateViewModel.swift created
- Phase 4: iOS UI — CandidateListView, CandidateRowView, CandidateDetailView created
- Phase 5: Navigation Integration — Candidates tab added to ContentView
- Phase 6: Build Verification — iOS project builds successfully, Node.js syntax valid

## Post-Completion Improvements
- Extracted shared rate limiting into fec-api.js (eliminated duplication between fec-client.js and candidate-fetcher.js)
- Added npm scripts: update-candidates, test-candidates, update-all
- Fixed exit code logic: expected "no data" errors no longer cause process.exit(1)
- Fixed stripTitles regex for better whitespace handling after title removal

## Build Status
- iOS: BUILD SUCCEEDED (iPhone 17 Pro Simulator, iOS 26.2)
- Node.js: Syntax OK for all files (7 source files)

## Architecture
- `updater/src/fec-api.js` — shared FEC API rate limiting (single source of truth)
- `updater/src/fec-client.js` — company PAC data fetching
- `updater/src/candidate-fetcher.js` — candidate data fetching
- `updater/src/index.js` — company pipeline entry point
- `updater/src/update-candidates.js` — candidate pipeline entry point
- `updater/src/categorize.js` — company political categorization
- `updater/src/firebase-push.js` — Firestore write operations
