// ============================================================
// POST /api/crispr/safety
// Assess CRISPR edit safety for a gene at a specific position.
//
// Request body:
//   { gene: string, position: number, chromosome?: string }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { CRISPRSafetyAnalyzer } from '@/lib/algorithms/crispr-safety';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const RequestSchema = z.object({
  gene: z.string().min(1).max(20),
  position: z.number().int().positive(),
  chromosome: z.string().optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed.', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { gene, position, chromosome } = parsed.data;

  try {
    const analyzer = new CRISPRSafetyAnalyzer();
    const safety = await analyzer.assessEditSafety(gene.toUpperCase(), position, chromosome);
    return NextResponse.json(safety);
  } catch (error) {
    console.error('[POST /api/crispr/safety] Error:', error);
    return NextResponse.json(
      { error: 'CRISPR safety analysis failed.' },
      { status: 500 }
    );
  }
}
