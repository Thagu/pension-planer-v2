export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const userId = (session.user as any)?.id;
    const scenarioId = params?.id;
    if (!userId || !scenarioId) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    // Verify ownership
    const existing = await prisma.scenario.findFirst({
      where: { id: scenarioId, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Szenario nicht gefunden.' }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body?.name || !body?.data) {
      return NextResponse.json({ error: 'Name und Daten sind erforderlich.' }, { status: 400 });
    }

    const updated = await prisma.scenario.update({
      where: { id: scenarioId },
      data: {
        name: body.name,
        data: body.data ?? {},
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PUT /api/scenarios/[id] error:', error);
    return NextResponse.json({ error: 'Aktualisierung fehlgeschlagen.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const userId = (session.user as any)?.id;
    const scenarioId = params?.id;
    if (!userId || !scenarioId) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    // Verify ownership
    const existing = await prisma.scenario.findFirst({
      where: { id: scenarioId, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Szenario nicht gefunden.' }, { status: 404 });
    }

    await prisma.scenario.delete({ where: { id: scenarioId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/scenarios/[id] error:', error);
    return NextResponse.json({ error: 'Löschen fehlgeschlagen.' }, { status: 500 });
  }
}
