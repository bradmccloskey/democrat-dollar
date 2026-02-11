# DemocratDollar Setup Guide

## 1. Firebase Project Setup

### Create Firebase Project
1. Go to https://console.firebase.google.com
2. Click "Create a project"
3. Name it "democrat-dollar"
4. Disable Google Analytics (not needed)
5. Click "Create project"

### Enable Firestore
1. In Firebase console, go to **Build > Firestore Database**
2. Click "Create database"
3. Select **Start in production mode** (our rules only allow reads)
4. Choose region: `us-central1` (or closest to you)
5. Click "Enable"

### Deploy Firestore Rules
From the `firebase/` directory:
```bash
npx firebase-tools deploy --only firestore:rules --project YOUR_PROJECT_ID
```
Or manually paste the rules from `firebase/firestore.rules` into the Firebase console under Firestore > Rules.

### Set Up iOS App in Firebase
1. In Firebase console, click the **iOS+** button to add an iOS app
2. Bundle ID: `com.democratdollar.app`
3. App nickname: "DemocratDollar"
4. Download `GoogleService-Info.plist`
5. Place it in `app/DemocratDollar/` directory
6. Open the Xcode project and drag it into the project navigator (make sure "Copy items if needed" is checked)

### Set Up Admin SDK (for Node.js updater)
1. In Firebase console, go to **Project Settings > Service accounts**
2. Click "Generate new private key"
3. Save the JSON file as `updater/firebase-service-account.json`
4. This file is gitignored — never commit it

## 2. FEC API Key

1. Go to https://api.data.gov/signup/
2. Enter your email
3. You'll receive an API key instantly
4. Add it to `updater/.env`:
   ```
   FEC_API_KEY=your_key_here
   FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
   ```

## 3. Node.js Updater Setup

```bash
cd ~/democrat-dollar/updater
npm install
```

### Test with dry run (no Firebase needed):
```bash
node src/index.js --dry-run --company "Walmart"
```

### Run full update:
```bash
node src/index.js
```

## 4. iOS App Setup

1. Open `~/democrat-dollar/app/DemocratDollar.xcodeproj` in Xcode
2. Ensure `GoogleService-Info.plist` is in the project
3. Wait for Swift Package Manager to resolve Firebase dependency
4. Select your development team in Signing & Capabilities
5. Build and run on Simulator (Cmd+R)

## 5. Schedule Automatic Updates

### Install the launchd plist:
```bash
cp ~/democrat-dollar/com.democratdollar.updater.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.democratdollar.updater.plist
```

### Test it manually:
```bash
launchctl start com.democratdollar.updater
```

### Check logs:
```bash
tail -f ~/democrat-dollar/updater/logs/launchd-stdout.log
```

### Unload if needed:
```bash
launchctl unload ~/Library/LaunchAgents/com.democratdollar.updater.plist
```

Note: launchd's StartCalendarInterval runs weekly on Sundays at 3 AM. To get "every 2 weeks", you can either run weekly (data won't change much) or manually trigger when needed.

## 6. App Store Submission

### Before submitting:
- [ ] Test on physical iPhone
- [ ] Generate app icons (1024x1024 for App Store, plus all required sizes)
- [ ] Take screenshots on required device sizes
- [ ] Write App Store description
- [ ] Set age rating (4+, no objectionable content)
- [ ] Privacy policy URL (required — the app collects no data)

### App Store description suggestion:
> Make informed purchasing decisions with DemocratDollar. See how major companies' Political Action Committees (PACs) distribute donations between political parties, based on public Federal Election Commission (FEC) data.
>
> Features:
> - Browse companies categorized by political donation patterns
> - Search by company name or industry
> - View detailed donation breakdowns
> - Works offline after initial load
> - Updated regularly with latest FEC data
>
> All data comes from public FEC records. DemocratDollar presents factual donation data without editorializing.
