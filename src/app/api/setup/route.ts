import { auth } from '@clerk/nextjs/server';
import { createTables } from '@/lib/db/schema';
import { seedDatabase } from '@/lib/seed-schemas';

export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('[api/setup] Starting database setup, initiated by:', userId);

    console.log('[api/setup] Creating tables...');
    await createTables();
    console.log('[api/setup] Tables created successfully');

    console.log('[api/setup] Seeding database...');
    await seedDatabase();
    console.log('[api/setup] Database seeded successfully');

    return Response.json({
      success: true,
      message: 'Database tables created and seed data inserted',
      initiated_by: userId,
    });
  } catch (error) {
    console.error('[api/setup] Database setup failed:', {
      error: String(error),
      stack: (error as Error).stack,
    });

    return Response.json(
      {
        error: 'Database setup failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
