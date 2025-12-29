"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";

type Coordinates = {
  lat: number;
  lng: number;
};

const COUNTRIES = [
  { label: "United States", code: "US" },
  { label: "United Kingdom", code: "UK" },
  { label: "France", code: "FR" },
  { label: "Germany", code: "DE" },
  { label: "China", code: "CN" },
  { label: "Taiwan", code: "TW" },
  { label: "Hong Kong", code: "HK" },
  { label: "Japan", code: "JP" },
  { label: "India", code: "IN" },
  { label: "Australia", code: "AU" },
  { label: "Brazil", code: "BR" },
  { label: "Canada", code: "CA" },
  { label: "Russia", code: "RU" },
  { label: "South Africa", code: "ZA" },
  { label: "Mexico", code: "MX" },
  { label: "South Korea", code: "KR" },
  { label: "Italy", code: "IT" },
  { label: "Spain", code: "ES" },
  { label: "Turkey", code: "TR" },
  { label: "Saudi Arabia", code: "SA" },
  { label: "Argentina", code: "AR" },
  { label: "Egypt", code: "EG" },
  { label: "Nigeria", code: "NG" },
  { label: "Indonesia", code: "ID" },
] as const;

type CountryCode = (typeof COUNTRIES)[number]["code"];

const COUNTRY_LABELS = COUNTRIES.reduce(
  (acc, country) => {
    acc[country.code] = country.label;
    return acc;
  },
  {} as Record<CountryCode, string>
);

const COUNTRY_COORDINATES: Record<CountryCode, Coordinates[]> = {
  US: [
    { lat: 37.7749, lng: -122.4194 },
    { lat: 34.0522, lng: -118.2437 },
  ],
  UK: [
    { lat: 51.5074, lng: -0.1278 },
    { lat: 53.4808, lng: -2.2426 },
  ],
  FR: [
    { lat: 48.8566, lng: 2.3522 },
    { lat: 45.764, lng: 4.8357 },
  ],
  DE: [
    { lat: 52.52, lng: 13.405 },
    { lat: 48.1351, lng: 11.582 },
  ],
  CN: [
    { lat: 39.9042, lng: 116.4074 },
    { lat: 31.2304, lng: 121.4737 },
    { lat: 23.1291, lng: 113.2644 },
    { lat: 30.6799, lng: 104.0679 },
    { lat: 30.2582, lng: 120.1646 },
  ],
  TW: [
    { lat: 25.033, lng: 121.5654 },
    { lat: 22.6273, lng: 120.3014 },
  ],
  HK: [
    { lat: 22.3193, lng: 114.1694 },
    { lat: 22.3964, lng: 114.1095 },
  ],
  JP: [
    { lat: 35.6895, lng: 139.6917 },
    { lat: 34.6937, lng: 135.5023 },
  ],
  IN: [
    { lat: 28.6139, lng: 77.209 },
    { lat: 19.076, lng: 72.8777 },
  ],
  AU: [
    { lat: -33.8688, lng: 151.2093 },
    { lat: -37.8136, lng: 144.9631 },
  ],
  BR: [
    { lat: -23.5505, lng: -46.6333 },
    { lat: -22.9068, lng: -43.1729 },
  ],
  CA: [
    { lat: 43.65107, lng: -79.347015 },
    { lat: 45.50169, lng: -73.567253 },
  ],
  RU: [
    { lat: 55.7558, lng: 37.6173 },
    { lat: 59.9343, lng: 30.3351 },
  ],
  ZA: [
    { lat: -33.9249, lng: 18.4241 },
    { lat: -26.2041, lng: 28.0473 },
  ],
  MX: [
    { lat: 19.4326, lng: -99.1332 },
    { lat: 20.6597, lng: -103.3496 },
  ],
  KR: [
    { lat: 37.5665, lng: 126.978 },
    { lat: 35.1796, lng: 129.0756 },
  ],
  IT: [
    { lat: 41.9028, lng: 12.4964 },
    { lat: 45.4642, lng: 9.19 },
  ],
  ES: [
    { lat: 40.4168, lng: -3.7038 },
    { lat: 41.3851, lng: 2.1734 },
  ],
  TR: [
    { lat: 41.0082, lng: 28.9784 },
    { lat: 39.9334, lng: 32.8597 },
  ],
  SA: [
    { lat: 24.7136, lng: 46.6753 },
    { lat: 21.3891, lng: 39.8579 },
  ],
  AR: [
    { lat: -34.6037, lng: -58.3816 },
    { lat: -31.4201, lng: -64.1888 },
  ],
  EG: [
    { lat: 30.0444, lng: 31.2357 },
    { lat: 31.2156, lng: 29.9553 },
  ],
  NG: [
    { lat: 6.5244, lng: 3.3792 },
    { lat: 9.0579, lng: 7.4951 },
  ],
  ID: [
    { lat: -6.2088, lng: 106.8456 },
    { lat: -7.7956, lng: 110.3695 },
  ],
};

type NameSet = {
  first: string[];
  last: string[];
};

const NAMES_BY_COUNTRY: Record<CountryCode, NameSet> = {
  CN: {
    first: [
      "Li",
      "Wang",
      "Zhang",
      "Liu",
      "Chen",
      "Yang",
      "Huang",
      "Zhao",
      "Wu",
      "Zhou",
      "Xu",
      "Sun",
      "Ma",
      "Zhu",
      "Hu",
      "Guo",
      "He",
      "Gao",
      "Lin",
      "Zheng",
    ],
    last: [
      "Wei",
      "Fang",
      "Na",
      "Xiuying",
      "Min",
      "Jing",
      "Li",
      "Qiang",
      "Lei",
      "Jun",
      "Yang",
      "Yong",
      "Yan",
      "Jie",
      "Tao",
      "Ming",
      "Chao",
      "Xiulan",
      "Xia",
      "Ping",
    ],
  },
  JP: {
    first: [
      "Sato",
      "Suzuki",
      "Takahashi",
      "Tanaka",
      "Watanabe",
      "Ito",
      "Yamamoto",
      "Nakamura",
      "Kobayashi",
      "Kato",
    ],
    last: [
      "Shota",
      "Ren",
      "Hina",
      "Yui",
      "Hiroto",
      "Sota",
      "Yota",
      "Misaki",
      "Nanami",
      "Yuto",
    ],
  },
  KR: {
    first: [
      "Kim",
      "Lee",
      "Park",
      "Choi",
      "Jung",
      "Kang",
      "Jo",
      "Yoon",
      "Jang",
      "Lim",
    ],
    last: [
      "Minjun",
      "Seojun",
      "Doyun",
      "Jiho",
      "Jihun",
      "Seoyeon",
      "Seoyun",
      "Jiwoo",
      "Seohyun",
      "Minseo",
    ],
  },
  TW: {
    first: [
      "Chen",
      "Lin",
      "Huang",
      "Chang",
      "Lee",
      "Wang",
      "Wu",
      "Liu",
      "Tsai",
      "Yang",
    ],
    last: [
      "Zhiming",
      "Jianhong",
      "Junjie",
      "Yijun",
      "Shufen",
      "Meiling",
      "Yating",
      "Jiahao",
      "Zhihao",
      "Shuhui",
    ],
  },
  HK: {
    first: [
      "Chan",
      "Lee",
      "Wong",
      "Cheung",
      "Lau",
      "Wang",
      "Ng",
      "Cheng",
      "Leung",
      "Ho",
    ],
    last: [
      "Chiming",
      "Kayan",
      "Junjie",
      "Wingsze",
      "Kaming",
      "Meiling",
      "Kahao",
      "Winger",
      "Chihao",
      "Shukfan",
    ],
  },
  US: {
    first: [
      "Smith",
      "Johnson",
      "Williams",
      "Brown",
      "Jones",
      "Garcia",
      "Miller",
      "Davis",
      "Rodriguez",
      "Martinez",
    ],
    last: [
      "James",
      "John",
      "Robert",
      "Michael",
      "William",
      "David",
      "Richard",
      "Joseph",
      "Thomas",
      "Christopher",
    ],
  },
  UK: {
    first: [
      "Smith",
      "Jones",
      "Williams",
      "Taylor",
      "Brown",
      "Davies",
      "Evans",
      "Wilson",
      "Thomas",
      "Roberts",
    ],
    last: [
      "Oliver",
      "Jack",
      "Harry",
      "George",
      "Noah",
      "Charlie",
      "Jacob",
      "Oscar",
      "William",
      "Leo",
    ],
  },
  FR: {
    first: [
      "Martin",
      "Bernard",
      "Dubois",
      "Thomas",
      "Robert",
      "Richard",
      "Petit",
      "Durand",
      "Leroy",
      "Moreau",
    ],
    last: [
      "Lucas",
      "Louis",
      "Gabriel",
      "Arthur",
      "Jules",
      "Hugo",
      "Leo",
      "Adam",
      "Raphael",
      "Paul",
    ],
  },
  DE: {
    first: [
      "Mueller",
      "Schmidt",
      "Schneider",
      "Fischer",
      "Weber",
      "Meyer",
      "Wagner",
      "Becker",
      "Schulz",
      "Hoffmann",
    ],
    last: [
      "Ben",
      "Paul",
      "Leon",
      "Noah",
      "Luis",
      "Finn",
      "Felix",
      "Jonas",
      "Maximilian",
      "Henry",
    ],
  },
  IT: {
    first: [
      "Rossi",
      "Ferrari",
      "Russo",
      "Bianchi",
      "Romano",
      "Gallo",
      "Costa",
      "Fontana",
      "Conti",
      "Esposito",
    ],
    last: [
      "Leonardo",
      "Francesco",
      "Alessandro",
      "Lorenzo",
      "Matteo",
      "Andrea",
      "Gabriele",
      "Marco",
      "Antonio",
      "Giuseppe",
    ],
  },
  ES: {
    first: [
      "Garcia",
      "Rodriguez",
      "Gonzalez",
      "Fernandez",
      "Lopez",
      "Martinez",
      "Sanchez",
      "Perez",
      "Martin",
      "Gomez",
    ],
    last: [
      "Antonio",
      "Jose",
      "Manuel",
      "Francisco",
      "David",
      "Juan",
      "Miguel",
      "Javier",
      "Rafael",
      "Carlos",
    ],
  },
  BR: {
    first: [
      "Silva",
      "Santos",
      "Oliveira",
      "Souza",
      "Rodrigues",
      "Ferreira",
      "Alves",
      "Pereira",
      "Lima",
      "Gomes",
    ],
    last: [
      "Miguel",
      "Arthur",
      "Heitor",
      "Pedro",
      "Davi",
      "Gabriel",
      "Bernardo",
      "Lucas",
      "Matheus",
      "Rafael",
    ],
  },
  RU: {
    first: [
      "Ivanov",
      "Smirnov",
      "Kuznetsov",
      "Popov",
      "Vasiliev",
      "Petrov",
      "Sokolov",
      "Mikhailov",
      "Fedorov",
      "Morozov",
    ],
    last: [
      "Alexander",
      "Dmitry",
      "Maxim",
      "Ivan",
      "Andrey",
      "Mikhail",
      "Artem",
      "Daniel",
      "Roman",
      "Sergey",
    ],
  },
  IN: {
    first: [
      "Kumar",
      "Singh",
      "Sharma",
      "Patel",
      "Gupta",
      "Shah",
      "Verma",
      "Rao",
      "Reddy",
      "Joshi",
    ],
    last: [
      "Aarav",
      "Vihaan",
      "Vivaan",
      "Aditya",
      "Arjun",
      "Reyansh",
      "Ayaan",
      "Sai",
      "Krishna",
      "Ishaan",
    ],
  },
  AU: {
    first: [
      "Smith",
      "Jones",
      "Williams",
      "Brown",
      "Wilson",
      "Taylor",
      "Johnson",
      "White",
      "Anderson",
      "Thompson",
    ],
    last: [
      "Oliver",
      "William",
      "Jack",
      "Noah",
      "Thomas",
      "James",
      "Lucas",
      "Henry",
      "Ethan",
      "Alexander",
    ],
  },
  CA: {
    first: [
      "Smith",
      "Brown",
      "Tremblay",
      "Martin",
      "Roy",
      "Wilson",
      "MacDonald",
      "Taylor",
      "Campbell",
      "Anderson",
    ],
    last: [
      "Liam",
      "Noah",
      "Oliver",
      "William",
      "James",
      "Benjamin",
      "Lucas",
      "Henry",
      "Theodore",
      "Jack",
    ],
  },
  MX: {
    first: [
      "Garcia",
      "Rodriguez",
      "Martinez",
      "Lopez",
      "Gonzalez",
      "Perez",
      "Sanchez",
      "Ramirez",
      "Torres",
      "Flores",
    ],
    last: [
      "Santiago",
      "Mateo",
      "Sebastian",
      "Leonardo",
      "Diego",
      "Daniel",
      "Gabriel",
      "Adrian",
      "David",
      "Alexander",
    ],
  },
  TR: {
    first: [
      "Yilmaz",
      "Kaya",
      "Demir",
      "Sahin",
      "Celik",
      "Yildiz",
      "Erdogan",
      "Ozturk",
      "Aydin",
      "Ozdemir",
    ],
    last: [
      "Yusuf",
      "Eymen",
      "Omer",
      "Mustafa",
      "Ali",
      "Mehmet",
      "Ahmet",
      "Emir",
      "Hamza",
      "Ibrahim",
    ],
  },
  SA: {
    first: [
      "Al-Saud",
      "Al-Sheikh",
      "Al-Rashid",
      "Al-Qahtani",
      "Al-Ghamdi",
      "Al-Zahrani",
      "Al-Dossari",
      "Al-Shammari",
      "Al-Otaibi",
      "Al-Harbi",
    ],
    last: [
      "Mohammed",
      "Abdullah",
      "Ahmed",
      "Ali",
      "Omar",
      "Ibrahim",
      "Khalid",
      "Hassan",
      "Fahad",
      "Abdul",
    ],
  },
  AR: {
    first: [
      "Gonzalez",
      "Rodriguez",
      "Garcia",
      "Fernandez",
      "Lopez",
      "Martinez",
      "Perez",
      "Romero",
      "Sanchez",
      "Diaz",
    ],
    last: [
      "Mateo",
      "Thiago",
      "Benjamin",
      "Valentino",
      "Santiago",
      "Juan",
      "Lucas",
      "Martin",
      "Nicolas",
      "Joaquin",
    ],
  },
  EG: {
    first: [
      "Mohamed",
      "Ahmed",
      "Mahmoud",
      "Ibrahim",
      "Ali",
      "Hassan",
      "Hussein",
      "Mostafa",
      "Kamal",
      "Samir",
    ],
    last: [
      "Omar",
      "Youssef",
      "Adam",
      "Malik",
      "Zain",
      "Hamza",
      "Kareem",
      "Hassan",
      "Ali",
      "Ibrahim",
    ],
  },
  NG: {
    first: [
      "Okafor",
      "Adebayo",
      "Okonkwo",
      "Eze",
      "Oluwaseun",
      "Adegoke",
      "Afolabi",
      "Ogunleye",
      "Adeniyi",
      "Adesina",
    ],
    last: [
      "Oluwadamilare",
      "Oluwatobiloba",
      "Ayomide",
      "Temitope",
      "Oluwaseun",
      "Adebayo",
      "Chibuike",
      "Chisom",
      "Chidi",
      "Obinna",
    ],
  },
  ID: {
    first: [
      "Wijaya",
      "Kusuma",
      "Suryanto",
      "Halim",
      "Santoso",
      "Tanaka",
      "Wibowo",
      "Susanto",
      "Hidayat",
      "Putra",
    ],
    last: [
      "Muhammad",
      "Ahmad",
      "Abdul",
      "Aditya",
      "Budi",
      "Dimas",
      "Eko",
      "Fajar",
      "Gading",
      "Hadi",
    ],
  },
  ZA: {
    first: [
      "Nkosi",
      "Van der Merwe",
      "Botha",
      "Mkhize",
      "Khumalo",
      "Pretorius",
      "Venter",
      "Ndlovu",
      "Fourie",
      "Nel",
    ],
    last: [
      "Bandile",
      "Themba",
      "Sipho",
      "Thabo",
      "Jabu",
      "Mandla",
      "Blessing",
      "Gift",
      "Lucky",
      "Precious",
    ],
  },
};

type PhoneFormat = {
  format: string;
  areaCodeRanges?: Array<[number, number]>;
  mobilePrefix?: string[];
};

const PHONE_FORMATS: Partial<Record<CountryCode, PhoneFormat>> = {
  US: {
    format: "+1 (XXX) XXX-XXXX",
    areaCodeRanges: [[201, 989]],
  },
  CN: {
    format: "+86 1XX-XXXX-XXXX",
    mobilePrefix: [
      "30",
      "31",
      "32",
      "33",
      "34",
      "35",
      "36",
      "37",
      "38",
      "39",
      "50",
      "51",
      "52",
      "53",
      "55",
      "56",
      "57",
      "58",
      "59",
      "66",
      "70",
      "71",
      "72",
      "73",
      "75",
      "76",
      "77",
      "78",
      "79",
      "80",
      "81",
      "82",
      "83",
      "84",
      "85",
      "86",
      "87",
      "88",
      "89",
    ],
  },
  JP: {
    format: "+81 XX-XXXX-XXXX",
    mobilePrefix: ["70", "80", "90"],
  },
  KR: {
    format: "+82 10-XXXX-XXXX",
  },
  UK: {
    format: "+44 7XXX XXXXXX",
    mobilePrefix: ["7"],
  },
  FR: {
    format: "+33 6 XX XX XX XX",
    mobilePrefix: ["6", "7"],
  },
  DE: {
    format: "+49 15X XXXXXXXX",
    mobilePrefix: ["15", "16", "17"],
  },
  TW: {
    format: "+886 9XX-XXX-XXX",
  },
  HK: {
    format: "+852 XXXX XXXX",
    mobilePrefix: ["5", "6", "9"],
  },
  AU: {
    format: "+61 4XX XXX XXX",
    mobilePrefix: ["4"],
  },
  CA: {
    format: "+1 (XXX) XXX-XXXX",
    areaCodeRanges: [[204, 989]],
  },
  MX: {
    format: "+52 1XX XXX XXXX",
  },
  TR: {
    format: "+90 5XX XXX XXXX",
    mobilePrefix: ["5"],
  },
  SA: {
    format: "+966 5XX XXX XXXX",
    mobilePrefix: ["5"],
  },
  AR: {
    format: "+54 9XX XXXX-XXXX",
  },
  EG: {
    format: "+20 1XX XXX XXXX",
    mobilePrefix: ["1"],
  },
  NG: {
    format: "+234 8XX XXX XXXX",
    mobilePrefix: ["7", "8", "9"],
  },
  ID: {
    format: "+62 8XX-XXXX-XXXX",
    mobilePrefix: ["8"],
  },
  ZA: {
    format: "+27 8X XXX XXXX",
    mobilePrefix: ["6", "7", "8"],
  },
};

const DEFAULT_PHONE_FORMAT: PhoneFormat = {
  format: "+1 (XXX) XXX-XXXX",
  areaCodeRanges: [[201, 989]],
};

const STORAGE_KEY = "zenith.address-generator.saved";
const MAX_ATTEMPTS = 12;
const ATTEMPT_DELAY_MS = 160;

const getRandomItem = <T,>(items: T[]) =>
  items[Math.floor(Math.random() * items.length)];

const getRandomLocation = (country: CountryCode): Coordinates => {
  const coordsArray = COUNTRY_COORDINATES[country];
  const city = getRandomItem(coordsArray);
  const jitter = 0.1;
  return {
    lat: city.lat + (Math.random() - 0.5) * jitter,
    lng: city.lng + (Math.random() - 0.5) * jitter,
  };
};

const getRandomName = (country: CountryCode) => {
  const names = NAMES_BY_COUNTRY[country];
  const firstName = getRandomItem(names.first);
  const lastName = getRandomItem(names.last);
  return `${firstName} ${lastName}`;
};

const generateAreaCode = (ranges: Array<[number, number]>) => {
  const [min, max] = getRandomItem(ranges);
  return Math.floor(min + Math.random() * (max - min + 1));
};

const getRandomPhoneNumber = (country: CountryCode) => {
  const format = PHONE_FORMATS[country] ?? DEFAULT_PHONE_FORMAT;
  let phone = format.format;

  if (format.areaCodeRanges) {
    const areaCode = generateAreaCode(format.areaCodeRanges);
    phone = phone.replace("XXX", String(areaCode));
    phone = phone.replace(/X/g, () => String(Math.floor(Math.random() * 10)));
  } else if (format.mobilePrefix) {
    const prefix = getRandomItem(format.mobilePrefix);
    if (prefix.length === 2) {
      phone = phone.replace(/XX/, prefix);
    } else {
      phone = phone.replace(/X/, prefix);
    }
    phone = phone.replace(/X/g, () => String(Math.floor(Math.random() * 10)));
  } else {
    phone = phone.replace(/X/g, () => String(Math.floor(Math.random() * 10)));
  }

  return phone;
};

type ReverseGeocodeResponse = {
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    postcode?: string;
  };
  error?: string;
};

const isValidAddress = (data: ReverseGeocodeResponse) => {
  const address = data.address;
  if (!address) return false;
  if (!address.house_number || !address.road) return false;
  return Boolean(address.city || address.town || address.village);
};

const formatAddress = (data: ReverseGeocodeResponse, country: CountryCode) => {
  const address = data.address;
  if (!address) return "";
  const street = `${address.house_number ?? ""} ${address.road ?? ""}`.trim();
  const city = address.city || address.town || address.village || "";
  const postal = address.postcode ?? "";
  const countryLabel = COUNTRY_LABELS[country] ?? country;
  return [street, city, postal, countryLabel]
    .filter(Boolean)
    .join(", ")
    .replace(/\s+/g, " ")
    .trim();
};

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

type AddressResult = {
  name: string;
  gender: string;
  phone: string;
  address: string;
  coordinates: Coordinates;
  country: CountryCode;
};

type SavedEntry = AddressResult & {
  id: string;
  note: string;
  savedAt: string;
};

const createId = () => {
  const cryptoRef =
    typeof globalThis !== "undefined"
      ? (globalThis.crypto as { randomUUID?: () => string } | undefined)
      : undefined;
  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export default function AddressGeneratorTool() {
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(
    COUNTRIES[0].code
  );
  const [current, setCurrent] = useState<AddressResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [savedEntries, setSavedEntries] = useState<SavedEntry[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  const generateAddress = useCallback(async (country: CountryCode) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");
    setError(null);
    setCopied(null);

    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        const coordinates = getRandomLocation(country);
        const url = new URL("https://nominatim.openstreetmap.org/reverse");
        url.searchParams.set("format", "json");
        url.searchParams.set("lat", coordinates.lat.toString());
        url.searchParams.set("lon", coordinates.lng.toString());
        url.searchParams.set("zoom", "18");
        url.searchParams.set("addressdetails", "1");

        const response = await fetch(url.toString(), {
          signal: controller.signal,
          headers: {
            "Accept-Language": "en",
          },
        });

        if (!response.ok) {
          if (attempt < MAX_ATTEMPTS - 1) {
            await delay(ATTEMPT_DELAY_MS);
            continue;
          }
          throw new Error("OpenStreetMap lookup failed.");
        }

        const data = (await response.json()) as ReverseGeocodeResponse;
        if (data.error || !isValidAddress(data)) {
          if (attempt < MAX_ATTEMPTS - 1) {
            await delay(ATTEMPT_DELAY_MS);
            continue;
          }
          throw new Error("Could not resolve a full street address.");
        }

        const address = formatAddress(data, country);
        const result: AddressResult = {
          name: getRandomName(country),
          gender: Math.random() > 0.5 ? "Male" : "Female",
          phone: getRandomPhoneNumber(country),
          address,
          coordinates,
          country,
        };

        setCurrent(result);
        setStatus("idle");
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message =
        err instanceof Error ? err.message : "Unable to generate address.";
      setError(message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    generateAddress(selectedCountry);
    return () => {
      abortRef.current?.abort();
    };
  }, [generateAddress, selectedCountry]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHasLoaded(true);
        return;
      }
      const parsed = JSON.parse(raw) as SavedEntry[];
      if (Array.isArray(parsed)) {
        setSavedEntries(parsed);
      }
    } catch {
      setSavedEntries([]);
    } finally {
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded || typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedEntries));
  }, [hasLoaded, savedEntries]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const copyValue = useCallback(async (label: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied("Clipboard unavailable");
    }
  }, []);

  const copyAll = useCallback(() => {
    if (!current) return;
    const text = [
      current.name,
      current.gender,
      current.phone,
      current.address,
    ]
      .filter(Boolean)
      .join(" | ");
    copyValue("All fields", text);
  }, [copyValue, current]);

  const saveAddress = useCallback(() => {
    if (!current) return;
    const entry: SavedEntry = {
      ...current,
      id: createId(),
      note: note.trim(),
      savedAt: new Date().toISOString(),
    };
    setSavedEntries((prev) => [entry, ...prev]);
    setNote("");
  }, [current, note]);

  const deleteEntry = useCallback((id: string) => {
    setSavedEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const clearEntries = useCallback(() => {
    setSavedEntries([]);
  }, []);

  const mapUrl = useMemo(() => {
    if (!current) return "";
    const { lat, lng } = current.coordinates;
    const bbox = `${lng - 0.02},${lat - 0.02},${lng + 0.02},${lat + 0.02}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
      bbox
    )}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`;
  }, [current]);

  const mapLink = useMemo(() => {
    if (!current) return "";
    const { lat, lng } = current.coordinates;
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
  }, [current]);

  const statusMessage = useMemo(() => {
    if (status === "loading") return "Generating a fresh address...";
    if (error) return error;
    if (copied) return `Copied ${copied}.`;
    return "Powered by OpenStreetMap Nominatim.";
  }, [copied, error, status]);

  const infoItems = [
    { label: "Name", value: current?.name ?? "-" },
    { label: "Gender", value: current?.gender ?? "-" },
    { label: "Phone", value: current?.phone ?? "-" },
    { label: "Address", value: current?.address ?? "-" },
  ];

  const isLoading = status === "loading";

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-2 text-sm shadow-[var(--glass-shadow)]">
            <span className="text-xs text-[color:var(--text-secondary)]">
              Country
            </span>
            <select
              value={selectedCountry}
              onChange={(event) =>
                setSelectedCountry(event.target.value as CountryCode)
              }
              className="bg-transparent text-sm text-[color:var(--text-primary)] outline-none"
            >
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => generateAddress(selectedCountry)}
            disabled={isLoading}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold shadow-[0_12px_24px_-14px_rgba(0,122,255,0.6)] transition-colors",
              isLoading
                ? "cursor-wait bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)]"
                : "bg-[color:var(--accent-blue)] text-white"
            )}
          >
            {isLoading ? "Generating..." : "Generate"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyAll}
            disabled={!current}
            className={cn(
              "rounded-full border border-[color:var(--glass-border)] px-3 py-2 text-xs shadow-[var(--glass-shadow)] transition-colors",
              current
                ? "bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
                : "cursor-not-allowed bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)]"
            )}
          >
            Copy all
          </button>
          <button
            type="button"
            onClick={saveAddress}
            disabled={!current}
            className={cn(
              "rounded-full border border-[color:var(--glass-border)] px-3 py-2 text-xs shadow-[var(--glass-shadow)] transition-colors",
              current
                ? "bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
                : "cursor-not-allowed bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)]"
            )}
          >
            Save
          </button>
        </div>
      </div>

      <p
        className={cn(
          "text-xs",
          error ? "text-rose-500/80" : "text-[color:var(--text-secondary)]"
        )}
        aria-live="polite"
      >
        {statusMessage}
      </p>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-4">
          <div className="rounded-[18px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-5 shadow-[var(--glass-shadow)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
              Generated profile
            </p>
            <div className="mt-4 grid gap-3">
              {infoItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => copyValue(item.label, item.value)}
                  disabled={!current}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] px-4 py-3 text-left transition-colors",
                    current
                      ? "hover:bg-[color:var(--glass-hover-bg)]"
                      : "cursor-not-allowed"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                      {item.label}
                    </p>
                    <p className="mt-1 text-sm text-[color:var(--text-primary)]">
                      {item.value}
                    </p>
                  </div>
                  <span className="text-[11px] text-[color:var(--text-secondary)]">
                    Copy
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[18px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-5 shadow-[var(--glass-shadow)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
              Notes
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional note for this address"
                className="w-full rounded-[12px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
              />
              <button
                type="button"
                onClick={saveAddress}
                disabled={!current}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                  current
                    ? "bg-[color:var(--accent-green)] text-white"
                    : "cursor-not-allowed bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)]"
                )}
              >
                Save address
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-[18px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-5 shadow-[var(--glass-shadow)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
              Map preview
            </p>
            <div className="mt-4 overflow-hidden rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)]">
              {current ? (
                <iframe
                  title="Map preview"
                  src={mapUrl}
                  className="h-[260px] w-full"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-[260px] items-center justify-center text-xs text-[color:var(--text-secondary)]">
                  Generate an address to preview the map.
                </div>
              )}
            </div>
            {current ? (
              <a
                href={mapLink}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center text-xs text-[color:var(--accent-blue)] transition-colors hover:text-[color:var(--text-primary)]"
              >
                Open in OpenStreetMap
              </a>
            ) : null}
          </div>

          <div className="rounded-[18px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-5 shadow-[var(--glass-shadow)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
              Coordinates
            </p>
            <p className="mt-3 text-sm text-[color:var(--text-primary)]">
              {current
                ? `${current.coordinates.lat.toFixed(
                    5
                  )}, ${current.coordinates.lng.toFixed(5)}`
                : "Waiting for data"}
            </p>
            <p className="mt-2 text-xs text-[color:var(--text-secondary)]">
              Reverse geocoding may require multiple attempts.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[18px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-5 shadow-[var(--glass-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
            Saved addresses
          </p>
          <button
            type="button"
            onClick={clearEntries}
            disabled={savedEntries.length === 0}
            className={cn(
              "rounded-full border border-[color:var(--glass-border)] px-3 py-1 text-xs transition-colors",
              savedEntries.length
                ? "bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
                : "cursor-not-allowed bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)]"
            )}
          >
            Clear all
          </button>
        </div>
        {savedEntries.length === 0 ? (
          <p className="mt-3 text-xs text-[color:var(--text-secondary)]">
            No saved entries yet.
          </p>
        ) : (
          <div className="mt-4 max-h-[280px] space-y-3 overflow-y-auto pr-1">
            {savedEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                      {entry.name} / {entry.gender}
                    </p>
                    <p className="text-xs text-[color:var(--text-secondary)]">
                      {entry.phone}
                    </p>
                    <p className="text-xs text-[color:var(--text-secondary)]">
                      {entry.address}
                    </p>
                    {entry.note ? (
                      <p className="text-xs text-[color:var(--text-secondary)]">
                        Note: {entry.note}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        copyValue(
                          "Saved entry",
                          [
                            entry.name,
                            entry.gender,
                            entry.phone,
                            entry.address,
                            entry.note,
                          ]
                            .filter(Boolean)
                            .join(" | ")
                        )
                      }
                      className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-1 text-[11px] text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--glass-hover-bg)]"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteEntry(entry.id)}
                      className="rounded-full border border-transparent bg-rose-500/10 px-3 py-1 text-[11px] text-rose-500 transition-colors hover:bg-rose-500/20"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
