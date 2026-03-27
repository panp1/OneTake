import { getDb } from '../db';
import type { OptionRegistryItem } from '@/lib/types';

export async function getRegistryOptions(registryName: string): Promise<OptionRegistryItem[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM option_registries
    WHERE registry_name = ${registryName} AND is_active = TRUE
    ORDER BY sort_order
  `;
  return rows as OptionRegistryItem[];
}

export async function addRegistryOption(data: {
  registry_name: string;
  option_value: string;
  option_label: string;
  metadata?: Record<string, unknown>;
  sort_order?: number;
}): Promise<OptionRegistryItem> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO option_registries (registry_name, option_value, option_label, metadata, sort_order)
    VALUES (
      ${data.registry_name},
      ${data.option_value},
      ${data.option_label},
      ${data.metadata ? JSON.stringify(data.metadata) : null},
      ${data.sort_order ?? 0}
    )
    RETURNING *
  `;
  return rows[0] as OptionRegistryItem;
}
