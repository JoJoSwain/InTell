export type Transport = "wifi" | "ethernet" | "cellular" | "none" | "unknown";

export async function decideDownload(
  transport: Transport,
  confirmCellular: () => Promise<boolean>,
): Promise<boolean> {
  if (transport === "none") return false;
  if (transport === "wifi" || transport === "ethernet") return true;
  return confirmCellular();
}

export function transportFromNetworkType(type: string | null | undefined): Transport {
  switch (type) {
    case "WIFI":
      return "wifi";
    case "ETHERNET":
      return "ethernet";
    case "CELLULAR":
      return "cellular";
    case "NONE":
      return "none";
    default:
      return "unknown";
  }
}
