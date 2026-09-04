import type { DocumentRecord, IntegrationIncidentInput } from "../system-a/document-repository.js";

export interface IntegrationEvents {
  documentStatusChanged(document: DocumentRecord): void;
  integrationIncident(incident: IntegrationIncidentInput): void;
}

export const noopIntegrationEvents: IntegrationEvents = {
  documentStatusChanged: () => undefined,
  integrationIncident: () => undefined,
};
