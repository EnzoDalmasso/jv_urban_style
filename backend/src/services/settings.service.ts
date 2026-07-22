import { supabase } from '../lib/supabase.js';
import { HttpError } from '../utils/httpError.js';
import { isMissingSchemaError } from '../utils/supabaseError.js';

export type ShopSettings = {
  cancellation_notice_minutes: number;
  deposit_percentage: number | string;
  require_deposit_for_late_cancellation: boolean;
};

export const defaultSettings: ShopSettings = {
  cancellation_notice_minutes: 120,
  deposit_percentage: 50,
  require_deposit_for_late_cancellation: true
};

export async function getShopSettings() {
  if (!supabase) {
    return defaultSettings;
  }

  const { data, error } = await supabase
    .from('shop_settings')
    .select('cancellation_notice_minutes, deposit_percentage, require_deposit_for_late_cancellation')
    .eq('id', true)
    .maybeSingle<ShopSettings>();

  if (error) {
    if (isMissingSchemaError(error)) {
      return defaultSettings;
    }

    throw new HttpError(502, 'No se pudo obtener la configuración del negocio.', error);
  }

  return data ?? defaultSettings;
}
