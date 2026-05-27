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

    const profile = await prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profil nicht gefunden.' }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error: any) {
    console.error('GET /api/profile error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
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
    if (!body) {
      return NextResponse.json({ error: 'Ungültige Daten.' }, { status: 400 });
    }

    const updated = await prisma.profile.upsert({
      where: { userId },
      update: {
        birthDate: body.birthDate ?? null,
        gender: body.gender ?? null,
        employmentStartYear: body.employmentStartYear ?? null,
        retirementAge: body.retirementAge ?? null,
        currentSalaryBrutto: body.currentSalaryBrutto ?? null,
        bvgCurrentCapital: body.bvgCurrentCapital ?? null,
        pillar3aCurrentCapital: body.pillar3aCurrentCapital ?? null,
        freeAssets: body.freeAssets ?? null,
        bvgInterestRate: body.bvgInterestRate ?? null,
        bvgConversionRate: body.bvgConversionRate ?? null,
        bvgContributionRates: body.bvgContributionRates ?? null,
        pillar3aInterestRate: body.pillar3aInterestRate ?? null,
        freeAssetsInterestRate: body.freeAssetsInterestRate ?? null,
      },
      create: {
        userId,
        birthDate: body.birthDate ?? null,
        gender: body.gender ?? null,
        employmentStartYear: body.employmentStartYear ?? null,
        retirementAge: body.retirementAge ?? 65,
        currentSalaryBrutto: body.currentSalaryBrutto ?? 0,
        bvgCurrentCapital: body.bvgCurrentCapital ?? 0,
        pillar3aCurrentCapital: body.pillar3aCurrentCapital ?? 0,
        freeAssets: body.freeAssets ?? 0,
        bvgInterestRate: body.bvgInterestRate ?? null,
        bvgConversionRate: body.bvgConversionRate ?? null,
        bvgContributionRates: body.bvgContributionRates ?? null,
        pillar3aInterestRate: body.pillar3aInterestRate ?? null,
        freeAssetsInterestRate: body.freeAssetsInterestRate ?? null,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PUT /api/profile error:', error);
    return NextResponse.json({ error: 'Speichern fehlgeschlagen.' }, { status: 500 });
  }
}
