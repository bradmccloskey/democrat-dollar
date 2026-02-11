import dotenv from 'dotenv';
dotenv.config();

const FEC_API_BASE = 'https://api.open.fec.gov/v1';
const API_KEY = process.env.FEC_API_KEY;
let RATE_LIMIT_DELAY = 3600; // 3.6 seconds between requests to stay safely under 1000/hour

// Curated mapping of PAC names to consumer-friendly company names
// Includes FEC committee IDs where known for faster lookups
export const COMPANY_PAC_MAPPING = {
  'Walmart': {
    searchTerms: ['WALMART', 'WAL-MART'],
    committeeId: 'C00093054',
    industry: 'Retail'
  },
  'Amazon': {
    searchTerms: ['AMAZON'],
    committeeId: 'C00360354',
    industry: 'Tech'
  },
  'Apple': {
    searchTerms: ['APPLE INC'],
    committeeId: 'C00563692',
    industry: 'Tech'
  },
  'Google': {
    searchTerms: ['GOOGLE', 'ALPHABET'],
    committeeId: 'C00428623',
    industry: 'Tech'
  },
  'Microsoft': {
    searchTerms: ['MICROSOFT'],
    committeeId: 'C00227546',
    industry: 'Tech'
  },
  'Meta': {
    searchTerms: ['META', 'FACEBOOK'],
    committeeId: 'C00502906',
    industry: 'Tech'
  },
  'Disney': {
    searchTerms: ['DISNEY', 'WALT DISNEY'],
    committeeId: 'C00230987',
    industry: 'Entertainment'
  },
  'Comcast': {
    searchTerms: ['COMCAST', 'NBCUNIVERSAL'],
    committeeId: 'C00248716',
    industry: 'Telecom'
  },
  'AT&T': {
    searchTerms: ['AT&T', 'ATT INC'],
    committeeId: 'C00109017',
    industry: 'Telecom'
  },
  'Verizon': {
    searchTerms: ['VERIZON'],
    committeeId: 'C00213876',
    industry: 'Telecom'
  },
  'T-Mobile': {
    searchTerms: ['T-MOBILE'],
    committeeId: 'C00461830',
    industry: 'Telecom'
  },
  'Coca-Cola': {
    searchTerms: ['COCA-COLA', 'COCA COLA'],
    committeeId: 'C00163527',
    industry: 'Food & Beverage'
  },
  'PepsiCo': {
    searchTerms: ['PEPSICO', 'PEPSI-COLA'],
    committeeId: 'C00093971',
    industry: 'Food & Beverage'
  },
  'McDonald\'s': {
    searchTerms: ['MCDONALD', 'MCDONALDS'],
    committeeId: 'C00343079',
    industry: 'Food & Beverage'
  },
  'Starbucks': {
    searchTerms: ['STARBUCKS'],
    committeeId: 'C00496935',
    industry: 'Food & Beverage'
  },
  'Nike': {
    searchTerms: ['NIKE'],
    committeeId: 'C00467902',
    industry: 'Retail'
  },
  'Target': {
    searchTerms: ['TARGET CORPORATION'],
    committeeId: 'C00117499',
    industry: 'Retail'
  },
  'Costco': {
    searchTerms: ['COSTCO'],
    committeeId: 'C00333146',
    industry: 'Retail'
  },
  'Home Depot': {
    searchTerms: ['HOME DEPOT'],
    committeeId: 'C00284885',
    industry: 'Retail'
  },
  'Lowe\'s': {
    searchTerms: ['LOWES', 'LOWE\'S'],
    committeeId: 'C00284877',
    industry: 'Retail'
  },
  'JPMorgan Chase': {
    searchTerms: ['JPMORGAN', 'JP MORGAN', 'CHASE'],
    committeeId: 'C00124487',
    industry: 'Finance'
  },
  'Bank of America': {
    searchTerms: ['BANK OF AMERICA'],
    committeeId: 'C00035154',
    industry: 'Finance'
  },
  'Wells Fargo': {
    searchTerms: ['WELLS FARGO'],
    committeeId: 'C00127902',
    industry: 'Finance'
  },
  'Citigroup': {
    searchTerms: ['CITIGROUP', 'CITICORP'],
    committeeId: 'C00141192',
    industry: 'Finance'
  },
  'Goldman Sachs': {
    searchTerms: ['GOLDMAN SACHS'],
    committeeId: 'C00142711',
    industry: 'Finance'
  },
  'Morgan Stanley': {
    searchTerms: ['MORGAN STANLEY'],
    committeeId: 'C00182337',
    industry: 'Finance'
  },
  'Pfizer': {
    searchTerms: ['PFIZER'],
    committeeId: 'C00016683',
    industry: 'Healthcare'
  },
  'Johnson & Johnson': {
    searchTerms: ['JOHNSON & JOHNSON', 'JOHNSON AND JOHNSON'],
    committeeId: 'C00140715',
    industry: 'Healthcare'
  },
  'UnitedHealth': {
    searchTerms: ['UNITEDHEALTH', 'UNITED HEALTH'],
    committeeId: 'C00329110',
    industry: 'Healthcare'
  },
  'CVS Health': {
    searchTerms: ['CVS HEALTH', 'CVS CAREMARK'],
    committeeId: 'C00267336',
    industry: 'Healthcare'
  },
  'Walgreens': {
    searchTerms: ['WALGREENS', 'WALGREEN'],
    committeeId: 'C00186759',
    industry: 'Healthcare'
  },
  'Kroger': {
    searchTerms: ['KROGER'],
    committeeId: 'C00049478',
    industry: 'Retail'
  },
  'Procter & Gamble': {
    searchTerms: ['PROCTER & GAMBLE', 'PROCTER AND GAMBLE', 'P&G'],
    committeeId: 'C00042366',
    industry: 'Consumer Goods'
  },
  'Unilever': {
    searchTerms: ['UNILEVER'],
    committeeId: 'C00496620',
    industry: 'Consumer Goods'
  },
  'General Motors': {
    searchTerms: ['GENERAL MOTORS', 'GM '],
    committeeId: 'C00053587',
    industry: 'Automotive'
  },
  'Ford': {
    searchTerms: ['FORD MOTOR'],
    committeeId: 'C00004127',
    industry: 'Automotive'
  },
  'Toyota': {
    searchTerms: ['TOYOTA'],
    committeeId: 'C00382150',
    industry: 'Automotive'
  },
  'Tesla': {
    searchTerms: ['TESLA'],
    committeeId: null, // Tesla doesn't have a traditional PAC
    industry: 'Automotive'
  },
  'ExxonMobil': {
    searchTerms: ['EXXONMOBIL', 'EXXON MOBIL'],
    committeeId: 'C00028076',
    industry: 'Energy'
  },
  'Chevron': {
    searchTerms: ['CHEVRON'],
    committeeId: 'C00040279',
    industry: 'Energy'
  },
  'Shell': {
    searchTerms: ['SHELL OIL', 'SHELL PETROLEUM'],
    committeeId: 'C00082263',
    industry: 'Energy'
  },
  'BP': {
    searchTerms: ['BP AMERICA', 'BP CORP'],
    committeeId: 'C00129056',
    industry: 'Energy'
  },
  'Delta Air Lines': {
    searchTerms: ['DELTA AIR LINES'],
    committeeId: 'C00047449',
    industry: 'Transportation'
  },
  'United Airlines': {
    searchTerms: ['UNITED AIRLINES', 'UNITED AIR LINES'],
    committeeId: 'C00056960',
    industry: 'Transportation'
  },
  'American Airlines': {
    searchTerms: ['AMERICAN AIRLINES'],
    committeeId: 'C00037036',
    industry: 'Transportation'
  },
  'Southwest Airlines': {
    searchTerms: ['SOUTHWEST AIRLINES'],
    committeeId: 'C00193177',
    industry: 'Transportation'
  },
  'Uber': {
    searchTerms: ['UBER'],
    committeeId: 'C00697441',
    industry: 'Tech'
  },
  'Lyft': {
    searchTerms: ['LYFT'],
    committeeId: 'C00697409',
    industry: 'Tech'
  },
  'Airbnb': {
    searchTerms: ['AIRBNB'],
    committeeId: 'C00697383',
    industry: 'Tech'
  },
  'Netflix': {
    searchTerms: ['NETFLIX'],
    committeeId: 'C00698043',
    industry: 'Entertainment'
  },
  'Spotify': {
    searchTerms: ['SPOTIFY'],
    committeeId: null, // May not have a traditional PAC
    industry: 'Entertainment'
  },
  'Intel': {
    searchTerms: ['INTEL CORPORATION'],
    committeeId: 'C00119453',
    industry: 'Tech'
  },
  'AMD': {
    searchTerms: ['ADVANCED MICRO DEVICES', 'AMD INC'],
    committeeId: 'C00245142',
    industry: 'Tech'
  },
  'Oracle': {
    searchTerms: ['ORACLE CORPORATION', 'ORACLE AMERICA'],
    committeeId: 'C00321968',
    industry: 'Tech'
  },
  'Salesforce': {
    searchTerms: ['SALESFORCE'],
    committeeId: 'C00519355',
    industry: 'Tech'
  },
  'Boeing': {
    searchTerms: ['BOEING'],
    committeeId: 'C00082115',
    industry: 'Aerospace'
  },
  'Lockheed Martin': {
    searchTerms: ['LOCKHEED MARTIN'],
    committeeId: 'C00303024',
    industry: 'Aerospace'
  },
  'Raytheon': {
    searchTerms: ['RAYTHEON', 'RTX CORPORATION'],
    committeeId: 'C00089243',
    industry: 'Aerospace'
  },
  'General Electric': {
    searchTerms: ['GENERAL ELECTRIC', 'GE '],
    committeeId: 'C00024869',
    industry: 'Industrial'
  },
  'Honeywell': {
    searchTerms: ['HONEYWELL'],
    committeeId: 'C00112045',
    industry: 'Industrial'
  },
  '3M': {
    searchTerms: ['3M COMPANY', '3M '],
    committeeId: 'C00112052',
    industry: 'Industrial'
  },
  'Caterpillar': {
    searchTerms: ['CATERPILLAR'],
    committeeId: 'C00115436',
    industry: 'Industrial'
  },
  'Deere & Company': {
    searchTerms: ['DEERE & COMPANY', 'JOHN DEERE'],
    committeeId: 'C00048991',
    industry: 'Industrial'
  },
  'FedEx': {
    searchTerms: ['FEDEX'],
    committeeId: 'C00238279',
    industry: 'Transportation'
  },
  'UPS': {
    searchTerms: ['UNITED PARCEL SERVICE', 'UPS '],
    committeeId: 'C00082917',
    industry: 'Transportation'
  },
  'Anheuser-Busch': {
    searchTerms: ['ANHEUSER-BUSCH', 'ANHEUSER BUSCH'],
    committeeId: 'C00082453',
    industry: 'Food & Beverage'
  },
  'Molson Coors': {
    searchTerms: ['MOLSON COORS', 'COORS BREWING'],
    committeeId: 'C00166918',
    industry: 'Food & Beverage'
  },
  'Altria': {
    searchTerms: ['ALTRIA', 'PHILIP MORRIS'],
    committeeId: 'C00082578',
    industry: 'Consumer Goods'
  },
  'Reynolds American': {
    searchTerms: ['REYNOLDS AMERICAN', 'RJ REYNOLDS'],
    committeeId: 'C00186817',
    industry: 'Consumer Goods'
  },
  'Visa': {
    searchTerms: ['VISA INC', 'VISA USA'],
    committeeId: 'C00343905',
    industry: 'Finance'
  },
  'Mastercard': {
    searchTerms: ['MASTERCARD'],
    committeeId: 'C00330116',
    industry: 'Finance'
  },
  'American Express': {
    searchTerms: ['AMERICAN EXPRESS'],
    committeeId: 'C00034033',
    industry: 'Finance'
  },
  'Capital One': {
    searchTerms: ['CAPITAL ONE'],
    committeeId: 'C00379818',
    industry: 'Finance'
  },
  'Progressive': {
    searchTerms: ['PROGRESSIVE CORPORATION', 'PROGRESSIVE INSURANCE'],
    committeeId: 'C00284687',
    industry: 'Insurance'
  },
  'State Farm': {
    searchTerms: ['STATE FARM'],
    committeeId: 'C00087593',
    industry: 'Insurance'
  },
  'Allstate': {
    searchTerms: ['ALLSTATE'],
    committeeId: 'C00032466',
    industry: 'Insurance'
  },
  'GEICO': {
    searchTerms: ['GEICO', 'GOVERNMENT EMPLOYEES INSURANCE'],
    committeeId: 'C00247312',
    industry: 'Insurance'
  },
  'Liberty Mutual': {
    searchTerms: ['LIBERTY MUTUAL'],
    committeeId: 'C00100941',
    industry: 'Insurance'
  },
  'Berkshire Hathaway': {
    searchTerms: ['BERKSHIRE HATHAWAY'],
    committeeId: null,
    industry: 'Finance'
  },
  'BlackRock': {
    searchTerms: ['BLACKROCK'],
    committeeId: 'C00459867',
    industry: 'Finance'
  },
  'Vanguard': {
    searchTerms: ['VANGUARD GROUP'],
    committeeId: null,
    industry: 'Finance'
  },
  'Charles Schwab': {
    searchTerms: ['CHARLES SCHWAB', 'SCHWAB'],
    committeeId: 'C00235176',
    industry: 'Finance'
  },
  'Fidelity': {
    searchTerms: ['FIDELITY INVESTMENTS', 'FMR CORP'],
    committeeId: 'C00103523',
    industry: 'Finance'
  },
  'AbbVie': {
    searchTerms: ['ABBVIE'],
    committeeId: 'C00507095',
    industry: 'Healthcare'
  },
  'Merck': {
    searchTerms: ['MERCK & CO', 'MERCK AND CO'],
    committeeId: 'C00029488',
    industry: 'Healthcare'
  },
  'Bristol-Myers Squibb': {
    searchTerms: ['BRISTOL-MYERS SQUIBB', 'BRISTOL MYERS'],
    committeeId: 'C00146506',
    industry: 'Healthcare'
  },
  'Eli Lilly': {
    searchTerms: ['ELI LILLY', 'LILLY & COMPANY'],
    committeeId: 'C00027961',
    industry: 'Healthcare'
  },
  'Abbott Laboratories': {
    searchTerms: ['ABBOTT LABORATORIES'],
    committeeId: 'C00034173',
    industry: 'Healthcare'
  },
  'Medtronic': {
    searchTerms: ['MEDTRONIC'],
    committeeId: 'C00283879',
    industry: 'Healthcare'
  },
  'Charter Communications': {
    searchTerms: ['CHARTER COMMUNICATIONS', 'SPECTRUM'],
    committeeId: 'C00464065',
    industry: 'Telecom'
  },
  'Cox Enterprises': {
    searchTerms: ['COX ENTERPRISES', 'COX COMMUNICATIONS'],
    committeeId: 'C00302166',
    industry: 'Telecom'
  },
  'Time Warner': {
    searchTerms: ['TIME WARNER', 'WARNERMEDIA'],
    committeeId: 'C00242978',
    industry: 'Entertainment'
  },
  'ViacomCBS': {
    searchTerms: ['VIACOMCBS', 'PARAMOUNT GLOBAL'],
    committeeId: 'C00294421',
    industry: 'Entertainment'
  },
  'Sony': {
    searchTerms: ['SONY CORPORATION', 'SONY AMERICA'],
    committeeId: 'C00327031',
    industry: 'Entertainment'
  },
  'Warner Bros': {
    searchTerms: ['WARNER BROS', 'WARNER BROTHERS'],
    committeeId: null,
    industry: 'Entertainment'
  },
  'Marriott': {
    searchTerms: ['MARRIOTT INTERNATIONAL'],
    committeeId: 'C00247981',
    industry: 'Hospitality'
  },
  'Hilton': {
    searchTerms: ['HILTON WORLDWIDE', 'HILTON HOTELS'],
    committeeId: 'C00432906',
    industry: 'Hospitality'
  },
  'Hyatt': {
    searchTerms: ['HYATT HOTELS', 'HYATT CORPORATION'],
    committeeId: 'C00437228',
    industry: 'Hospitality'
  },
  'Yum! Brands': {
    searchTerms: ['YUM! BRANDS', 'YUM BRANDS'],
    committeeId: 'C00418624',
    industry: 'Food & Beverage'
  },
  'Darden Restaurants': {
    searchTerms: ['DARDEN RESTAURANTS'],
    committeeId: 'C00312611',
    industry: 'Food & Beverage'
  },
  'Chipotle': {
    searchTerms: ['CHIPOTLE'],
    committeeId: null,
    industry: 'Food & Beverage'
  },
  'Whole Foods': {
    searchTerms: ['WHOLE FOODS'],
    committeeId: null, // Now owned by Amazon
    industry: 'Retail'
  },
  'Albertsons': {
    searchTerms: ['ALBERTSONS'],
    committeeId: 'C00036673',
    industry: 'Retail'
  },
  'Safeway': {
    searchTerms: ['SAFEWAY'],
    committeeId: 'C00065052',
    industry: 'Retail'
  },
  'Publix': {
    searchTerms: ['PUBLIX SUPER MARKETS'],
    committeeId: 'C00206052',
    industry: 'Retail'
  },
  'Macy\'s': {
    searchTerms: ['MACYS', 'MACY\'S'],
    committeeId: 'C00235929',
    industry: 'Retail'
  },
  'Nordstrom': {
    searchTerms: ['NORDSTROM'],
    committeeId: 'C00191718',
    industry: 'Retail'
  },
  'Gap': {
    searchTerms: ['GAP INC'],
    committeeId: 'C00227009',
    industry: 'Retail'
  },
  'Best Buy': {
    searchTerms: ['BEST BUY'],
    committeeId: 'C00361071',
    industry: 'Retail'
  },
  'GameStop': {
    searchTerms: ['GAMESTOP'],
    committeeId: null,
    industry: 'Retail'
  },
  'Bed Bath & Beyond': {
    searchTerms: ['BED BATH & BEYOND', 'BED BATH AND BEYOND'],
    committeeId: 'C00401885',
    industry: 'Retail'
  },
  'Wayfair': {
    searchTerms: ['WAYFAIR'],
    committeeId: null,
    industry: 'Retail'
  },
  'eBay': {
    searchTerms: ['EBAY'],
    committeeId: 'C00429654',
    industry: 'Tech'
  },
  'PayPal': {
    searchTerms: ['PAYPAL'],
    committeeId: 'C00462762',
    industry: 'Tech'
  },
  'Square': {
    searchTerms: ['SQUARE INC', 'BLOCK INC'],
    committeeId: null,
    industry: 'Tech'
  },
  'Stripe': {
    searchTerms: ['STRIPE'],
    committeeId: null,
    industry: 'Tech'
  },
  'Zoom': {
    searchTerms: ['ZOOM VIDEO'],
    committeeId: null,
    industry: 'Tech'
  },
  'Slack': {
    searchTerms: ['SLACK TECHNOLOGIES'],
    committeeId: null,
    industry: 'Tech'
  },
  'Dropbox': {
    searchTerms: ['DROPBOX'],
    committeeId: null,
    industry: 'Tech'
  },
  'Adobe': {
    searchTerms: ['ADOBE'],
    committeeId: 'C00310854',
    industry: 'Tech'
  },
  'Autodesk': {
    searchTerms: ['AUTODESK'],
    committeeId: 'C00247379',
    industry: 'Tech'
  },
  'Intuit': {
    searchTerms: ['INTUIT'],
    committeeId: 'C00292391',
    industry: 'Tech'
  },
  'Twitter': {
    searchTerms: ['TWITTER', 'X CORP'],
    committeeId: 'C00505867',
    industry: 'Tech'
  },
  'Snap': {
    searchTerms: ['SNAP INC', 'SNAPCHAT'],
    committeeId: null,
    industry: 'Tech'
  },
  'Pinterest': {
    searchTerms: ['PINTEREST'],
    committeeId: null,
    industry: 'Tech'
  },
  'Reddit': {
    searchTerms: ['REDDIT'],
    committeeId: null,
    industry: 'Tech'
  },
  'Discord': {
    searchTerms: ['DISCORD'],
    committeeId: null,
    industry: 'Tech'
  },
  'Roblox': {
    searchTerms: ['ROBLOX'],
    committeeId: null,
    industry: 'Entertainment'
  },
  'EA': {
    searchTerms: ['ELECTRONIC ARTS', 'EA INC'],
    committeeId: 'C00306449',
    industry: 'Entertainment'
  },
  'Activision Blizzard': {
    searchTerms: ['ACTIVISION BLIZZARD'],
    committeeId: 'C00502054',
    industry: 'Entertainment'
  },
  'Take-Two': {
    searchTerms: ['TAKE-TWO INTERACTIVE'],
    committeeId: null,
    industry: 'Entertainment'
  },
  'Nvidia': {
    searchTerms: ['NVIDIA'],
    committeeId: 'C00438192',
    industry: 'Tech'
  },
  'Qualcomm': {
    searchTerms: ['QUALCOMM'],
    committeeId: 'C00206052',
    industry: 'Tech'
  },
  'Broadcom': {
    searchTerms: ['BROADCOM'],
    committeeId: 'C00467704',
    industry: 'Tech'
  },
  'Texas Instruments': {
    searchTerms: ['TEXAS INSTRUMENTS'],
    committeeId: 'C00115790',
    industry: 'Tech'
  },
  'Micron': {
    searchTerms: ['MICRON TECHNOLOGY'],
    committeeId: 'C00308692',
    industry: 'Tech'
  },
  'Applied Materials': {
    searchTerms: ['APPLIED MATERIALS'],
    committeeId: 'C00265892',
    industry: 'Tech'
  },
  'Cisco': {
    searchTerms: ['CISCO SYSTEMS'],
    committeeId: 'C00311381',
    industry: 'Tech'
  },
  'HP': {
    searchTerms: ['HEWLETT PACKARD', 'HP INC'],
    committeeId: 'C00122960',
    industry: 'Tech'
  },
  'Dell': {
    searchTerms: ['DELL TECHNOLOGIES', 'DELL INC'],
    committeeId: 'C00372599',
    industry: 'Tech'
  },
  'IBM': {
    searchTerms: ['IBM', 'INTERNATIONAL BUSINESS MACHINES'],
    committeeId: 'C00102657',
    industry: 'Tech'
  },
  'ServiceNow': {
    searchTerms: ['SERVICENOW'],
    committeeId: null,
    industry: 'Tech'
  },
  'Workday': {
    searchTerms: ['WORKDAY'],
    committeeId: null,
    industry: 'Tech'
  },
  'Snowflake': {
    searchTerms: ['SNOWFLAKE'],
    committeeId: null,
    industry: 'Tech'
  },
  'Databricks': {
    searchTerms: ['DATABRICKS'],
    committeeId: null,
    industry: 'Tech'
  },
  'Palantir': {
    searchTerms: ['PALANTIR'],
    committeeId: null,
    industry: 'Tech'
  },
  'SpaceX': {
    searchTerms: ['SPACEX', 'SPACE EXPLORATION'],
    committeeId: null,
    industry: 'Aerospace'
  },
  'Blue Origin': {
    searchTerms: ['BLUE ORIGIN'],
    committeeId: null,
    industry: 'Aerospace'
  },
  'Rivian': {
    searchTerms: ['RIVIAN'],
    committeeId: null,
    industry: 'Automotive'
  },
  'Lucid': {
    searchTerms: ['LUCID MOTORS', 'LUCID GROUP'],
    committeeId: null,
    industry: 'Automotive'
  },
  'NIO': {
    searchTerms: ['NIO INC', 'NIO USA'],
    committeeId: null,
    industry: 'Automotive'
  },
  'Honda': {
    searchTerms: ['HONDA MOTOR', 'AMERICAN HONDA'],
    committeeId: 'C00037473',
    industry: 'Automotive'
  },
  'Nissan': {
    searchTerms: ['NISSAN'],
    committeeId: 'C00379941',
    industry: 'Automotive'
  },
  'BMW': {
    searchTerms: ['BMW OF NORTH AMERICA'],
    committeeId: 'C00379495',
    industry: 'Automotive'
  },
  'Mercedes-Benz': {
    searchTerms: ['MERCEDES-BENZ', 'DAIMLER'],
    committeeId: 'C00379453',
    industry: 'Automotive'
  },
  'Volkswagen': {
    searchTerms: ['VOLKSWAGEN'],
    committeeId: 'C00379446',
    industry: 'Automotive'
  },
  'Hyundai': {
    searchTerms: ['HYUNDAI MOTOR'],
    committeeId: 'C00422725',
    industry: 'Automotive'
  },
  'Kia': {
    searchTerms: ['KIA MOTORS'],
    committeeId: null,
    industry: 'Automotive'
  }
};

// Rate limiting utility
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let lastRequestTime = 0;
let consecutive429s = 0;
const MAX_CONSECUTIVE_429S = 8; // Abort after this many 429s in a row
const MAX_RETRIES = 5;

class RateLimitExhaustedError extends Error {
  constructor() {
    super('FEC API rate limit exhausted. Get a real API key at https://api.data.gov/signup');
    this.name = 'RateLimitExhaustedError';
  }
}

export { RateLimitExhaustedError };

async function rateLimitedFetch(url) {
  if (consecutive429s >= MAX_CONSECUTIVE_429S) {
    throw new RateLimitExhaustedError();
  }

  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await sleep(RATE_LIMIT_DELAY - timeSinceLastRequest);
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    lastRequestTime = Date.now();
    const response = await fetch(url);

    if (response.status === 429) {
      consecutive429s++;
      if (consecutive429s >= MAX_CONSECUTIVE_429S) {
        throw new RateLimitExhaustedError();
      }
      const backoff = Math.min(10000 * Math.pow(2, attempt), 120000);
      console.log(`    Rate limited (429). Retrying in ${backoff / 1000}s... (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(backoff);
      continue;
    }

    if (!response.ok) {
      throw new Error(`FEC API error: ${response.status} ${response.statusText}`);
    }

    // Successful request — reset consecutive 429 counter
    consecutive429s = 0;
    return response.json();
  }

  throw new Error('FEC API error: 429 Too Many Requests (retries exhausted)');
}

/**
 * Search for a committee by company name.
 * Always searches by name (ignoring potentially wrong committeeId values).
 * Prioritizes committees active in recent cycles.
 */
export async function searchCommittee(companyName) {
  const companyData = COMPANY_PAC_MAPPING[companyName];

  if (!companyData) {
    console.warn(`No mapping found for company: ${companyName}`);
    return null;
  }

  // Search by company name terms — most reliable approach
  for (const searchTerm of companyData.searchTerms) {
    try {
      const url = `${FEC_API_BASE}/committees/?api_key=${API_KEY}&q=${encodeURIComponent(searchTerm)}&committee_type=N&committee_type=Q&committee_type=O&per_page=20`;
      const data = await rateLimitedFetch(url);

      if (data.results && data.results.length > 0) {
        // Prefer committees active in recent cycles (2024 or 2026)
        const recentMatch = data.results.find(c =>
          c.name.toUpperCase().includes(searchTerm.toUpperCase()) &&
          c.cycles && (c.cycles.includes(2024) || c.cycles.includes(2026))
        );

        const anyMatch = data.results.find(c =>
          c.name.toUpperCase().includes(searchTerm.toUpperCase())
        );

        const match = recentMatch || anyMatch;
        if (match) return match;
      }
    } catch (error) {
      console.warn(`Failed to search for ${searchTerm}:`, error.message);
    }
  }

  return null;
}

/**
 * Fetch all committees (for discovery/exploratory use)
 */
export async function fetchCommittees(committeeTypes = ['N', 'Q', 'O'], page = 1) {
  const typeParams = committeeTypes.map(t => `committee_type=${t}`).join('&');
  const url = `${FEC_API_BASE}/committees/?api_key=${API_KEY}&${typeParams}&per_page=100&page=${page}`;

  const data = await rateLimitedFetch(url);
  return {
    results: data.results || [],
    pagination: data.pagination || {}
  };
}

/**
 * Fetch disbursements for a single two-year period.
 */
async function fetchDisbursementsForPeriod(committeeId, twoYearPeriod) {
  const allDisbursements = [];
  let lastIndex = null;
  let lastDate = null;

  try {
    while (true) {
      let url = `${FEC_API_BASE}/schedules/schedule_b/?api_key=${API_KEY}&committee_id=${committeeId}&two_year_transaction_period=${twoYearPeriod}&per_page=100`;

      if (lastIndex && lastDate) {
        url += `&last_index=${lastIndex}&last_disbursement_date=${lastDate}`;
      }

      const data = await rateLimitedFetch(url);

      if (!data.results || data.results.length === 0) break;

      const candidateContributions = data.results.filter(d => {
        const recipientType = d.recipient_committee_type;
        const purpose = (d.disbursement_description || '').toUpperCase();
        return recipientType === 'H' || recipientType === 'S' || recipientType === 'P' ||
               purpose.includes('CONTRIBUTION') || purpose.includes('CANDIDATE');
      });

      allDisbursements.push(...candidateContributions);

      if (!data.pagination || !data.pagination.last_indexes) break;
      const pagination = data.pagination.last_indexes;
      if (pagination.last_index && pagination.last_disbursement_date) {
        lastIndex = pagination.last_index;
        lastDate = pagination.last_disbursement_date;
      } else {
        break;
      }

      if (allDisbursements.length > 10000) break;
    }
  } catch (error) {
    console.error(`    Error fetching ${twoYearPeriod} disbursements for ${committeeId}:`, error.message);
  }

  return allDisbursements;
}

/**
 * Fetch disbursements (contributions to candidates) for a committee.
 * Tries multiple election cycles: 2026 (current), 2024, and 2022 as fallback.
 */
export async function fetchDisbursements(committeeId, twoYearPeriod = 2024) {
  console.log(`  Fetching disbursements for committee ${committeeId}...`);

  // Try current and recent cycles
  const periods = [2024, 2026, 2022];
  let allDisbursements = [];

  for (const period of periods) {
    const results = await fetchDisbursementsForPeriod(committeeId, period);
    if (results.length > 0) {
      console.log(`    ${period} cycle: ${results.length} candidate contributions`);
      allDisbursements.push(...results);
    }
  }

  console.log(`  Total disbursements retrieved: ${allDisbursements.length}`);
  return allDisbursements;
}

/**
 * Get candidate party affiliation
 */
export async function getCandidateInfo(candidateId) {
  try {
    const url = `${FEC_API_BASE}/candidate/${candidateId}/?api_key=${API_KEY}`;
    const data = await rateLimitedFetch(url);

    if (data.results && data.results.length > 0) {
      return data.results[0];
    }
  } catch (error) {
    console.warn(`Failed to fetch candidate ${candidateId}:`, error.message);
  }

  return null;
}

/**
 * Batch fetch candidate party info for many candidate IDs at once.
 * The /candidates/ endpoint accepts multiple candidate_id params (up to ~100 per request).
 * Returns a Map of candidateId -> party string (e.g. 'DEM', 'REP').
 */
export async function batchFetchCandidates(candidateIds) {
  const partyMap = new Map();
  if (candidateIds.length === 0) return partyMap;

  const BATCH_SIZE = 100; // FEC API allows up to ~100 IDs per request

  for (let i = 0; i < candidateIds.length; i += BATCH_SIZE) {
    const batch = candidateIds.slice(i, i + BATCH_SIZE);
    const idParams = batch.map(id => `candidate_id=${id}`).join('&');

    try {
      let page = 1;
      while (true) {
        const url = `${FEC_API_BASE}/candidates/?api_key=${API_KEY}&${idParams}&per_page=100&page=${page}`;
        const data = await rateLimitedFetch(url);

        if (data.results) {
          for (const candidate of data.results) {
            partyMap.set(candidate.candidate_id, candidate.party || null);
          }
        }

        // Check for more pages
        if (data.pagination && data.pagination.pages > page) {
          page++;
        } else {
          break;
        }
      }
    } catch (error) {
      console.warn(`  Failed to batch fetch candidates (batch ${Math.floor(i / BATCH_SIZE) + 1}):`, error.message);
    }
  }

  return partyMap;
}

/**
 * Get all companies that we can track
 */
export function getTrackedCompanies() {
  return Object.keys(COMPANY_PAC_MAPPING);
}

/**
 * Get company industry
 */
export function getCompanyIndustry(companyName) {
  return COMPANY_PAC_MAPPING[companyName]?.industry || 'Unknown';
}
