import { JWKInterface } from "arweave/node/lib/wallet.js";

import type { Tag } from "./models/Tag.js";

import {
  Eval,
  FetchEvents,
  GetZoneById,
  GetZones,
  Info,
  Register,
} from "./messageFactory.js";
// VIP01Filter types replaced with manual interfaces
interface Filter {
  authors?: string[];
  ids?: string[];
  kinds?: string[];
  limit?: number;
  search?: string;
  since?: number;
  tags?: Record<string, string[]>;
  until?: number;
}

interface FilterOptions {
  enableClientLimiting?: boolean;
  enableSorting?: boolean;
  includeMetadata?: boolean;
}

interface FilterResult {
  events: unknown[];
  hasMore?: boolean;
  newestTimestamp?: number;
  oldestTimestamp?: number;
  totalCount?: number;
}
import { read, send } from "./process.js";
import { processVIP01Results } from "./utils/vip01Processing.js";

export const evalProcess = async (
  signer: JWKInterface,
  data: string,
  processId: string,
) => {
  try {
    const tags = Eval();
    return await send(signer, processId, tags, data);
  } catch {
    // Silent error handling for evaluation process
    return null;
  }
};

export const event = async (
  signer: JWKInterface,
  hub: string,
  tags: Array<Tag>,
  data?: string,
) => {
  const actionTag: Tag = {
    name: "Action",
    value: "Event",
  };
  const idTag: Tag = {
    name: "Original-Id",
    value: "",
  };
  tags.push(actionTag);
  tags.push(idTag);
  try {
    await send(signer, hub, tags, data || null);
  } catch {
    // Silent error handling for events
  }
};

export const info = async (
  processId: string,
): Promise<Record<string, unknown>> => {
  const message = Info();
  const result = await read(processId, message);
  if (result) {
    const json = JSON.parse(result.Data);
    return json;
  } else {
    throw new Error("Not Found");
  }
};

export const fetchEvents = async (
  processId: string,
  filters: string,
): Promise<Record<string, unknown>[]> => {
  let events: Record<string, unknown>[] = [];
  try {
    const message = FetchEvents(filters);
    const result = await read(processId, message);

    if (result) {
      const json = JSON.parse(result.Data);
      events = json;
    }
  } catch {
    // Silent error handling for fetch events
  }
  return events;
};

/**
 * Enhanced fetchEvents with VIP-01 compliant result processing
 */
export const fetchEventsVIP01 = async (
  processId: string,
  filter: Filter,
  options: FilterOptions = {},
): Promise<FilterResult> => {
  try {
    const filtersJson = JSON.stringify([filter]);
    const message = FetchEvents(filtersJson);
    const result = await read(processId, message);

    let events: Record<string, unknown>[] = [];
    if (result) {
      const json = JSON.parse(result.Data);
      events = Array.isArray(json) ? json : [];
    }

    // Apply VIP-01 compliant result processing
    return processVIP01Results(events, filter, {
      enableClientLimiting: true,
      enableSorting: true,
      includeMetadata: true,
      ...options,
    });
  } catch {
    // Return empty result with error metadata
    return {
      events: [],
      hasMore: false,
      totalCount: 0,
    };
  }
};

export const register = async (
  signer: JWKInterface,
  processId: string,
  spec: Record<string, unknown>,
): Promise<void> => {
  try {
    const message = Register();
    await send(signer, processId, message, JSON.stringify(spec));
  } catch {
    // Silent error handling for register
  }
};

export const getZones = async (
  processId: string,
  filters: string,
  page: number,
  limit: number,
): Promise<Record<string, unknown>[]> => {
  let events: Record<string, unknown>[] = [];
  try {
    const message = GetZones(filters, page.toString(), limit.toString());
    const result = await read(processId, message);
    if (result) {
      const json = JSON.parse(result.Data);
      events = json;
    }
  } catch {
    // Silent error handling for get zones
  }
  return events;
};

export const getZone = async (
  processId: string,
  zoneId: string,
): Promise<Record<string, unknown>> => {
  try {
    const message = GetZoneById(zoneId);
    const result = await read(processId, message);
    if (result) {
      const json = JSON.parse(result.Data);
      return json;
    }
  } catch {
    // Silent error handling for get zone
  }
  return {};
};
