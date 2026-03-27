// ============================================================
// Pipeline Orchestrator
// Runs the 5-stage pipeline sequentially for a given request ID
// ============================================================

import { updateIntakeRequest } from '@/lib/db/intake';
import { createPipelineRun, updatePipelineRun } from '@/lib/db/pipeline-runs';
import { runStage1 } from './stage1-intelligence';
import { runStage2 } from './stage2-images';
import { runStage3 } from './stage3-copy';
import { runStage4 } from './stage4-compose';
import { runStage5 } from './stage5-surface';

interface PipelineResult {
  success: boolean;
  failed_stage?: number;
  error?: string;
}

type StageFn = (requestId: string) => Promise<Record<string, unknown>>;

interface StageDefinition {
  num: number;
  name: string;
  fn: StageFn;
}

export async function runPipeline(requestId: string): Promise<PipelineResult> {
  // Mark the request as generating
  await updateIntakeRequest(requestId, { status: 'generating' });

  const stages: StageDefinition[] = [
    { num: 1, name: 'Strategic Intelligence', fn: runStage1 },
    { num: 2, name: 'Character-Driven Image Generation', fn: runStage2 },
    { num: 3, name: 'Copy Generation', fn: runStage3 },
    { num: 4, name: 'Layout Composition', fn: runStage4 },
    { num: 5, name: 'Surface & Distribute', fn: runStage5 },
  ];

  for (const stage of stages) {
    const startTime = Date.now();

    // Create a pipeline run record (status: running)
    const run = await createPipelineRun({
      request_id: requestId,
      stage: stage.num,
      stage_name: stage.name,
      status: 'running',
    });

    try {
      const output = await stage.fn(requestId);
      const durationMs = Date.now() - startTime;

      // Mark stage as passed
      await updatePipelineRun(run.id, {
        status: 'passed',
        output_data: output,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      });
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Mark stage as failed
      await updatePipelineRun(run.id, {
        status: 'failed',
        error_message: errorMessage,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      });

      // Mark the request as failed (back to draft so user can retry)
      await updateIntakeRequest(requestId, { status: 'draft' });

      return {
        success: false,
        failed_stage: stage.num,
        error: `Stage ${stage.num} (${stage.name}) failed: ${errorMessage}`,
      };
    }
  }

  // All stages passed — mark request as ready for review
  await updateIntakeRequest(requestId, { status: 'review' });

  return { success: true };
}
