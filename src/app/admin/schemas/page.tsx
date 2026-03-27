'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TaskTypeSchema } from '@/lib/types';

export default function SchemasPage() {
  const [schemas, setSchemas] = useState<TaskTypeSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSchemas = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/schemas');
      if (!res.ok) throw new Error('Failed to load schemas');
      setSchemas(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchemas();
  }, [fetchSchemas]);

  async function handleToggleActive(taskType: string, currentActive: boolean) {
    try {
      const res = await fetch(`/api/schemas/${taskType}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive, change_summary: `Toggled active: ${!currentActive}` }),
      });
      if (!res.ok) throw new Error('Failed to update schema');
      await fetchSchemas();
    } catch {
      alert('Failed to toggle schema status');
    }
  }

  function toggleExpand(id: string) {
    setExpandedId(expandedId === id ? null : id);
  }

  const allFields = (schema: TaskTypeSchema) => [
    ...schema.schema.base_fields,
    ...schema.schema.task_fields,
    ...schema.schema.conditional_fields,
    ...schema.schema.common_fields,
  ];

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)]">Schema Management</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          Manage task type schemas and their field definitions
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="card p-5 mb-6 border-[var(--oneforma-error)]">
          <p className="text-sm text-[var(--oneforma-error)]">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5">
              <div className="flex gap-4">
                <div className="skeleton w-8 h-8 rounded-full" />
                <div className="skeleton flex-1 h-5" />
                <div className="skeleton w-20 h-5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schema list */}
      {!loading && !error && (
        <div className="space-y-3">
          {schemas.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm text-[var(--muted-foreground)]">No schemas found. Run the seed script to create task type schemas.</p>
            </div>
          ) : (
            schemas.map((schema) => (
              <div key={schema.id} className="card overflow-hidden">
                {/* Schema header row */}
                <div className="p-5 flex items-center gap-4">
                  <span className="text-xl">{schema.icon}</span>
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => toggleExpand(schema.id)}
                      className="text-left cursor-pointer"
                    >
                      <h3 className="text-sm font-semibold text-[var(--foreground)]">
                        {schema.display_name}
                      </h3>
                      <p className="text-xs text-[var(--muted-foreground)] truncate">
                        {schema.description}
                      </p>
                    </button>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="tag-pill">v{schema.version}</span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {allFields(schema).length} fields
                    </span>
                    <button
                      onClick={() => handleToggleActive(schema.task_type, schema.is_active)}
                      className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                        schema.is_active
                          ? 'bg-[#f0fdf4] text-[#16a34a] hover:bg-[#dcfce7]'
                          : 'bg-[#f5f5f5] text-[#737373] hover:bg-[#e5e5e5]'
                      }`}
                    >
                      {schema.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>

                {/* Expanded fields view */}
                {expandedId === schema.id && (
                  <div className="border-t border-[var(--border)] bg-[var(--muted)] p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {['base_fields', 'task_fields', 'conditional_fields', 'common_fields'].map((group) => {
                        const fields = schema.schema[group as keyof TaskTypeSchema['schema']];
                        if (!fields || fields.length === 0) return null;
                        return (
                          <div key={group}>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
                              {group.replace(/_/g, ' ')}
                            </h4>
                            <div className="space-y-1">
                              {fields.map((field) => (
                                <div
                                  key={field.key}
                                  className="flex items-center gap-2 text-xs bg-white rounded-lg px-3 py-2 border border-[var(--border)]"
                                >
                                  <span className="font-medium text-[var(--foreground)]">{field.label}</span>
                                  <span className="tag-pill !text-[10px]">{field.type}</span>
                                  {field.required && (
                                    <span className="text-[var(--oneforma-error)] text-[10px]">required</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
