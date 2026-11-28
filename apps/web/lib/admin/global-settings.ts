/** Admin panel, "Configuración global": GraphQL documents and types. */

export interface GlobalSettings {
  bankSyncEnabled: boolean;
  updatedByName: string | null;
  updatedAt: string | null;
}

export interface GlobalSettingsData {
  globalSettings: GlobalSettings;
}

const FIELDS = 'bankSyncEnabled updatedByName updatedAt';

export const GLOBAL_SETTINGS_QUERY = `query GlobalSettings {
  globalSettings { ${FIELDS} }
}`;

export const UPDATE_GLOBAL_SETTINGS_MUTATION = `mutation UpdateGlobalSettings($input: UpdateGlobalSettingsInput!) {
  updateGlobalSettings(input: $input) { ${FIELDS} }
}`;
