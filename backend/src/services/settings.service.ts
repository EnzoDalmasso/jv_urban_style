import { supabase } from '../lib/supabase.js';
import { HttpError } from '../utils/httpError.js';
import { isMissingSchemaError } from '../utils/supabaseError.js';

export type ShopSettings = {
  cancellation_notice_minutes: number;
  deposit_percentage: number | string;
  require_deposit_for_late_cancellation: boolean;
  transfer_holder: string;
  transfer_alias: string;
  transfer_cbu: string;
};

export const defaultSettings: ShopSettings = {
  cancellation_notice_minutes: 120,
  deposit_percentage: 50,
  require_deposit_for_late_cancellation: true,
  transfer_holder: 'JV Urban Style Barberia',
  transfer_alias: 'JVURBANSTYLE',
  transfer_cbu: 'Configurar en admin'
};

const settingsSelect = `
  cancellation_notice_minutes,
  deposit_percentage,
  require_deposit_for_late_cancellation,
  transfer_holder,
  transfer_alias,
  transfer_cbu
`;

const legacySettingsSelect = `
  cancellation_notice_minutes,
  deposit_percentage,
  require_deposit_for_late_cancellation
`;

export async function getShopSettings() {
  if (!supabase) {
    return defaultSettings;
  }

  const { data, error } = await supabase
    .from('shop_settings')
    .select(settingsSelect)
    .eq('id', true)
    .maybeSingle<ShopSettings>();

  if (error) {
    if (isMissingSchemaError(error)) {
      return getLegacyShopSettings();
    }

    throw new HttpError(502, 'No se pudo obtener la configuracion del negocio.', error);
  }

  return mergeSettings(data);
}

async function getLegacyShopSettings() {
  if (!supabase) {
    return defaultSettings;
  }

  const { data, error } = await supabase
    .from('shop_settings')
    .select(legacySettingsSelect)
    .eq('id', true)
    .maybeSingle<Omit<ShopSettings, 'transfer_holder' | 'transfer_alias' | 'transfer_cbu'>>();

  if (error) {
    if (isMissingSchemaError(error)) {
      return defaultSettings;
    }

    throw new HttpError(502, 'No se pudo obtener la configuracion del negocio.', error);
  }

  return mergeSettings(data);
}

export function mergeSettings(settings?: Partial<ShopSettings> | null): ShopSettings {
  return {
    ...defaultSettings,
    ...(settings ?? {}),
    transfer_holder: settings?.transfer_holder || defaultSettings.transfer_holder,
    transfer_alias: settings?.transfer_alias || defaultSettings.transfer_alias,
    transfer_cbu: settings?.transfer_cbu || defaultSettings.transfer_cbu
  };
}
