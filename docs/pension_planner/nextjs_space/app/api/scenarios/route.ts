export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const userId = (session.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const scenarios = await prisma.scenario.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(scenarios ?? []);
  } catch (error: any) {
    console.error('GET /api/scenarios error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const userId = (session.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body?.name || !body?.data) {
      return NextResponse.json({ error: 'Name und Daten sind erforderlich.' }, { status: 400 });
    }

    const scenario = await prisma.scenario.create({
      data: {
        userId,
        name: body.name,
        data: body.data ?? {},
      },
    });

    return NextResponse.json(scenario, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/scenarios error:', error);
    return NextResponse.json({ error: 'Speichern fehlgeschlagen.' }, { status: 500 });
  }
}
