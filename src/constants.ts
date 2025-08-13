export function AOS_MODULE(): string {
  return isMainnet()
    ? "ISShJH1ij-hPPt9St5UFFr_8Ys3Kj5cyg7zrMGt7H9s" // Production mainnet AOS module
    : "28gHGe_ARwPfCL7zYD2HB5oGvvP74mbfbHLESNFo55o";
}

export function ARWEAVE_URL(): string {
  return isMainnet() ? "arweave.net" : "arweave.velocity.cloudnet.marshal.ao";
}

export function AUTHORITY(): string {
  return isMainnet()
    ? "fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY"
    : "5btmdnmjWiFugymH7BepSig8cq1_zE-EQVumcXn0i_4";
}

export function CU_URL(): string {
  return isMainnet()
    ? "https://cu.ao-testnet.xyz" // Official AO mainnet CU URL (despite "testnet" in domain name)
    : "https://cu.velocity.cloudnet.marshal.ao";
}

export function GATEWAY_URL(): string {
  return isMainnet()
    ? "https://arweave.net"
    : "https://gateway.velocity.cloudnet.marshal.ao";
}

export function HUB_REGISTRY_ID(): string {
  return "g_eSbkmD4LzfZtXaCLmeMcLIBQrqxnY-oFQJJNMIn4w";
}

export function isMainnet(): boolean {
  return process.env.NODE_ENV === "production";
}

export function MU_URL(): string {
  return isMainnet()
    ? "https://mu.ao-testnet.xyz" // Official AO mainnet MU URL (despite "testnet" in domain name)
    : "https://mu.velocity.cloudnet.marshal.ao";
}

export function ProcessHub(): string {
  return "-a5m_wyuxstuhBotGvkvTeao3BjACRdR2z4FcLHQfc8";
}

export function SCHEDULER(): string {
  return isMainnet()
    ? "_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA"
    : "Tm7v2ddwSr_5UxjmuCmhkMSZpzhtKJkkpLMZK_p6mQU";
}

export function toUrl(tx: string) {
  return "https://" + ARWEAVE_URL() + "/" + tx;
}

export function WAR_TOKEN(): string {
  return "WPyLgOqELOyN_BoTNdeEMZp5sz3RxDL19IGcs3A9IPc";
}

export const DEFAULT_QUANTITY = "1000000000000000000";
export const DECIMALS = 1000000000000;

export const AR_Token = "xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10";
export const AO_Token = "0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc";
export const BazarUCM = "U3TjJAZWJjlWBB4KAXSHKzuky81jtyh0zqH8rUL4Wd0";

export function formatNumber(num: number) {
  return num.toLocaleString();
}

//Y3EMIurCZKqO8Dm_86dsbdHNdwM86Yswk7v4hsGp45I Hello test

// Cache Configuration
export const CACHE_DIR = ".permamind";
export const KEYS_CACHE_DIR = "keys";
export const CACHE_DIR_PERMISSIONS = 0o700;
export const CACHE_FILE_PERMISSIONS = 0o600;
export const CACHE_VERSION = "1.0.0";
export const CACHE_EXPIRATION_HOURS = 24 * 7; // 1 week default
export const MEMORY_CACHE_MAX_SIZE = 100; // Maximum number of keys in memory cache

// Worker Thread Configuration
export const DEFAULT_MAX_WORKERS = 2; // Maximum number of worker threads
export const DEFAULT_MAX_QUEUE_SIZE = 50; // Maximum number of queued requests
export const DEFAULT_WORKER_TIMEOUT_MS = 30000; // 30 second timeout per worker task
export const DEFAULT_ENABLE_PRE_GENERATION = false; // Background pre-generation disabled by default
export const DEFAULT_PRE_GENERATION_IDLE_THRESHOLD_MS = 60000; // 1 minute idle threshold
