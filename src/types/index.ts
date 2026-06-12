export type UserRole = "user" | "seller" | "admin";
export type SellerStatus = "pending" | "approved" | "rejected";
export type ListingStatus = "active" | "sold" | "pending" | "rejected";
export type ListingCondition = "New" | "Like New" | "Used" | "For Parts";
export type ApplicationStatus = "pending" | "approved" | "rejected";
export type SellerType = "Foreign Resident" | "Algerian Self-Entrepreneur";

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  location: string | null;
  bio: string | null;
  role: UserRole;
  seller_status: SellerStatus | null;
  is_verified: boolean;
  avg_rating: number;
  total_reviews: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface Listing {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price: number;
  category_id: string | null;
  condition: ListingCondition | null;
  city: string;
  origin_country: string | null;
  images: string[];
  is_featured: boolean;
  is_negotiable: boolean;
  status: ListingStatus;
  views: number;
  specifications: Record<string, string>;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  seller?: Profile;
  category?: Category;
  is_favorited?: boolean;
}

export interface FeaturedBoost {
  id: string;
  listing_id: string;
  seller_id: string;
  payment_provider: "stripe" | "chargily";
  payment_id: string | null;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed";
  boost_days: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  listing_id: string;
  created_at: string;
  listing?: Listing;
}

export interface Conversation {
  id: string;
  listing_id: string | null;
  buyer_id: string;
  seller_id: string;
  last_message: string | null;
  last_message_at: string;
  buyer_unread: number;
  seller_unread: number;
  created_at: string;
  // joined
  listing?: Listing;
  buyer?: Profile;
  seller?: Profile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  read_at: string | null;
  created_at: string;
  sender?: Profile;
}

export interface Review {
  id: string;
  reviewer_id: string;
  seller_id: string;
  listing_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer?: Profile;
  listing?: Listing;
}

export interface ListingFilters {
  search?: string;
  category_id?: string;
  cities?: string[];
  min_price?: number;
  max_price?: number;
  condition?: ListingCondition;
  sort?: "newest" | "price_asc" | "price_desc" | "oldest";
  featured?: boolean;
}

// Supported import platforms come first; names MUST match platforms.ts
// `source_country` values so contractor trips match scraped products.
export const IMPORT_COUNTRIES = [
  "France",
  "United Kingdom",
  "United Arab Emirates",
  "Germany",
  "Turkey",
  "China",
  "Italy",
  "Spain",
  "Saudi Arabia",
  "Morocco",
  "Tunisia",
  "Egypt",
  "Japan",
  "South Korea",
  "USA",
  "Portugal",
  "Belgium",
  "Netherlands",
  "Algeria",
] as const;

export type ImportCountry = (typeof IMPORT_COUNTRIES)[number];

/** Flag emoji for a country name (handles both full names and short forms). */
export const COUNTRY_FLAGS: Record<string, string> = {
  France: "🇫🇷",
  "United Kingdom": "🇬🇧",
  UK: "🇬🇧",
  "United Arab Emirates": "🇦🇪",
  UAE: "🇦🇪",
  Germany: "🇩🇪",
  Turkey: "🇹🇷",
  China: "🇨🇳",
  Italy: "🇮🇹",
  Spain: "🇪🇸",
  "Saudi Arabia": "🇸🇦",
  Morocco: "🇲🇦",
  Tunisia: "🇹🇳",
  Egypt: "🇪🇬",
  Japan: "🇯🇵",
  "South Korea": "🇰🇷",
  USA: "🇺🇸",
  Portugal: "🇵🇹",
  Belgium: "🇧🇪",
  Netherlands: "🇳🇱",
  Algeria: "🇩🇿",
  Qatar: "🇶🇦",
};

export function countryFlag(name?: string | null): string {
  return (name && COUNTRY_FLAGS[name]) || "✈️";
}

export interface SellerApplication {
  id: string;
  user_id: string;
  seller_type: SellerType;
  applicant_name: string | null;
  whatsapp_number: string | null;
  residence_country: string | null;
  document_url: string;
  document_name: string | null;
  document_size_kb: number | null;
  status: ApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  user?: Profile;
}

// ============================================================
// MICRO-IMPORTATION — Phase 1
// ============================================================
export type TravelTripStatus = "active" | "completed" | "cancelled";
export type UsedItemCondition = "like_new" | "good" | "fair";
export type UsedItemStatus   = "available" | "pending" | "sold";

export interface TravelTrip {
  id: string;
  user_id: string;
  source_country: string;
  source_city: string | null;
  departure_date: string;
  return_date: string;
  max_weight_kg: number | null;
  notes: string | null;
  status: TravelTripStatus;
  created_at: string;
  updated_at: string;
  contractor?: Profile;
}

export interface UsedInternationalProduct {
  id: string;
  contractor_id: string;
  title: string;
  description: string | null;
  condition: UsedItemCondition;
  price_dzd: number;
  source_country: string;
  source_city: string | null;
  images: string[];
  trip_id: string | null;
  status: UsedItemStatus;
  views: number;
  created_at: string;
  updated_at: string;
  contractor?: Profile;
  trip?: TravelTrip;
}

export const CONDITION_LABELS: Record<UsedItemCondition, string> = {
  like_new: "Like New",
  good:     "Good",
  fair:     "Fair",
};

// ── Import Requests ──────────────────────────────────────────
export type ImportRequestStatus =
  | "pending_deposit"
  | "awaiting_verification"
  | "deposit_held"
  | "in_transit"
  | "released_to_seller"
  | "disputed"
  | "liquidated"
  | "refunded";

export interface ImportRequest {
  id: string;
  buyer_id: string;
  contractor_id: string;
  trip_id: string | null;
  product_title: string;
  product_url: string | null;
  product_image: string | null;
  product_platform: string;
  product_price_original: number | null;
  product_currency: string;
  platform_rate_used: number;
  contractor_total_dzd: number;
  deposit_dzd: number;
  buyer_fee_dzd: number;
  seller_fee_dzd: number;
  upfront_dzd: number;
  cod_dzd: number;
  status: ImportRequestStatus;
  receipt_url: string | null;
  buyer_confirmed_at: string | null;
  contractor_confirmed_at: string | null;
  admin_reviewed_by: string | null;
  admin_reviewed_at: string | null;
  admin_notes: string | null;
  dispute_evidence_urls: string[];
  created_at: string;
  updated_at: string;
  buyer?: Profile;
  contractor?: Profile;
}

export const STATUS_LABELS: Record<ImportRequestStatus, string> = {
  pending_deposit:       "Awaiting Deposit",
  awaiting_verification: "Admin Verifying",
  deposit_held:          "Deposit Secured",
  in_transit:            "In Transit",
  released_to_seller:    "Completed",
  disputed:              "Disputed",
  liquidated:            "Buyer Defaulted",
  refunded:              "Refunded",
};

export const ALGERIAN_CITIES = [
  "Algiers",
  "Oran",
  "Constantine",
  "Annaba",
  "Blida",
  "Batna",
  "Djelfa",
  "Sétif",
  "Sidi Bel Abbès",
  "Biskra",
  "Tébessa",
  "El Oued",
  "Skikda",
  "Tiaret",
  "Béjaïa",
  "Tlemcen",
  "Ouargla",
  "Béchar",
  "Mostaganem",
  "Bordj Bou Arréridj",
  "Chlef",
  "Souk Ahras",
  "M'Sila",
  "Médéa",
  "Tizi Ouzou",
  "Jijel",
  "Mascara",
  "Relizane",
  "Guelma",
  "Khenchela",
] as const;

export type AlgerianCity = (typeof ALGERIAN_CITIES)[number];
