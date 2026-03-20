// ============================================================
// GET /api/genes/info/:gene
// Returns gene metadata from ENSEMBL: description, chromosome,
// coordinates, biotype, and ENSEMBL ID.
// Used by GeneInfoPanel as a fallback when the local DB has no
// description for a gene (e.g. database not yet seeded).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface EnsemblLookup {
  id: string;
  display_name: string;
  description?: string;
  seq_region_name: string;
  start: number;
  end: number;
  strand: number;
  biotype: string;
  assembly_name: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { gene: string } }
) {
  const gene = params.gene.toUpperCase().trim();
  if (!gene) {
    return NextResponse.json({ error: 'Gene symbol is required.' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://rest.ensembl.org/lookup/symbol/homo_sapiens/${gene}?expand=0`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Gene '${gene}' not found in ENSEMBL.` },
        { status: 404 }
      );
    }

    const data: EnsemblLookup = await res.json();

    // Strip the "[Source:…]" annotation from ENSEMBL descriptions
    const rawDesc = data.description ?? '';
    const description = rawDesc.replace(/\s*\[Source:[^\]]*\]/g, '').trim();

    return NextResponse.json({
      symbol: gene,
      ensembl_id: data.id,
      description: description || null,
      chromosome: `chr${data.seq_region_name}`,
      start_pos: data.start,
      end_pos: data.end,
      strand: data.strand === 1 ? '+' : '-',
      biotype: data.biotype,
      assembly: data.assembly_name,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch gene info from ENSEMBL.' },
      { status: 502 }
    );
  }
}
