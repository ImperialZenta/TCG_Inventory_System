import type { Prisma } from "@prisma/client";
import type { DomainContext } from "@/lib/context/domain-context";
import { inventoryEventActor } from "@/lib/context/actor";
import {
  EVENT_PAYLOAD_SCHEMAS,
  type EventPayloadMap,
  type RecordableEventType,
} from "@/lib/events/types";
import { buildEventSummary } from "@/lib/events/summaries";

type TransactionClient = Prisma.TransactionClient;

export interface RecordInventoryEventInput<T extends RecordableEventType> {
  eventType: T;
  payload: EventPayloadMap[T];
  correlationId?: string;
  blockId?: string | null;
  stagingImportId?: string | null;
  pickListId?: string | null;
  externalOrderId?: string | null;
  uploadSessionId?: string | null;
  stockItemId?: string | null;
  actor?: string | null;
}

export async function recordInventoryEvent<T extends RecordableEventType>(
  tx: TransactionClient,
  inputOrCtx: RecordInventoryEventInput<T> | DomainContext,
  inputMaybe?: RecordInventoryEventInput<T>,
): Promise<void> {
  const input =
    inputMaybe ??
    (inputOrCtx as RecordInventoryEventInput<T>);
  const ctx = inputMaybe ? (inputOrCtx as DomainContext) : undefined;

  const schema = EVENT_PAYLOAD_SCHEMAS[input.eventType];
  const payload = schema.parse(input.payload);
  const summary = buildEventSummary(input.eventType, payload as EventPayloadMap[T]);

  await tx.inventoryEvent.create({
    data: {
      eventType: input.eventType,
      summary,
      payload: payload as Prisma.InputJsonValue,
      correlationId: input.correlationId ?? null,
      blockId: input.blockId ?? null,
      stagingImportId: input.stagingImportId ?? null,
      pickListId: input.pickListId ?? null,
      externalOrderId: input.externalOrderId ?? null,
      uploadSessionId: input.uploadSessionId ?? null,
      stockItemId: input.stockItemId ?? null,
      actor: input.actor ?? (ctx ? inventoryEventActor(ctx) : null),
    },
  });
}
