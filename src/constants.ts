export function AOS_MODULE(): string {
  return isMainnet()
    ? "Md-unO1WeOFeDev8hsetrk-JYhzZDuB73ypzxKiE4Hc" // TODO: Replace with actual mainnet AOS module ID (set in Release 27 - 2025-02-20)
    : "28gHGe_ARwPfCL7zYD2HB5oGvvP74mbfbHLESNFo55o";
}

export function ARWEAVE_URL(): string {
  return isMainnet() ? "arweave.net" : "arweave.velocity.cloudnet.marshal.ao";
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
    ? "_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA" // Default scheduler from ao-deploy (may need update to actual mainnet scheduler)
    : "Tm7v2ddwSr_5UxjmuCmhkMSZpzhtKJkkpLMZK_p6mQU";
}

export function toUrl(tx: string) {
  return "https://" + ARWEAVE_URL() + "/" + tx;
}

export function WAR_TOKEN(): string {
  return "WPyLgOqELOyN_BoTNdeEMZp5sz3RxDL19IGcs3A9IPc";
}

function isMainnet(): boolean {
  return process.env.NODE_ENV === "production";
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
