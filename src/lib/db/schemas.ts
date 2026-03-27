import { getDb } from '../db';
import type { TaskTypeSchema } from '@/lib/types';

export async function listActiveSchemas(): Promise<TaskTypeSchema[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM task_type_schemas
    WHERE is_active = TRUE
    ORDER BY sort_order
  `;
  return rows as TaskTypeSchema[];
}

export async function getSchemaByTaskType(taskType: string): Promise<TaskTypeSchema | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM task_type_schemas
    WHERE task_type = ${taskType} AND is_active = TRUE
  `;
  return (rows[0] as TaskTypeSchema) ?? null;
}

export async function createSchema(data: {
  task_type: string;
  display_name: string;
  icon: string;
  description: string;
  schema: TaskTypeSchema['schema'];
  sort_order?: number;
  created_by?: string;
}): Promise<TaskTypeSchema> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO task_type_schemas (task_type, display_name, icon, description, schema, sort_order, created_by)
    VALUES (
      ${data.task_type},
      ${data.display_name},
      ${data.icon},
      ${data.description},
      ${JSON.stringify(data.schema)},
      ${data.sort_order ?? 0},
      ${data.created_by ?? null}
    )
    RETURNING *
  `;
  return rows[0] as TaskTypeSchema;
}

export async function updateSchema(
  taskType: string,
  data: {
    display_name?: string;
    icon?: string;
    description?: string;
    schema?: TaskTypeSchema['schema'];
    sort_order?: number;
    is_active?: boolean;
    change_summary?: string;
    updated_by?: string;
  }
): Promise<TaskTypeSchema> {
  const sql = getDb();

  // Get the current schema first
  const existing = await sql`
    SELECT * FROM task_type_schemas WHERE task_type = ${taskType}
  `;
  if (existing.length === 0) {
    throw new Error(`Schema not found for task_type: ${taskType}`);
  }
  const current = existing[0];

  // Save old version to schema_versions
  await sql`
    INSERT INTO schema_versions (schema_id, version, schema, change_summary, created_by)
    VALUES (
      ${current.id},
      ${current.version},
      ${JSON.stringify(current.schema)},
      ${data.change_summary ?? null},
      ${data.updated_by ?? null}
    )
  `;

  // Update with incremented version
  const newVersion = (current.version as number) + 1;
  const rows = await sql`
    UPDATE task_type_schemas
    SET
      display_name = COALESCE(${data.display_name ?? null}, display_name),
      icon = COALESCE(${data.icon ?? null}, icon),
      description = COALESCE(${data.description ?? null}, description),
      schema = COALESCE(${data.schema ? JSON.stringify(data.schema) : null}, schema),
      sort_order = COALESCE(${data.sort_order ?? null}, sort_order),
      is_active = COALESCE(${data.is_active ?? null}, is_active),
      version = ${newVersion},
      updated_at = NOW()
    WHERE task_type = ${taskType}
    RETURNING *
  `;
  return rows[0] as TaskTypeSchema;
}
