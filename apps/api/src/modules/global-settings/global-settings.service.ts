import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import {
  GlobalSettings,
  UpdateGlobalSettingsInput,
} from './dto/global-settings.dto';

/** The single GlobalSettings row (id 1, created by its migration). */
const ID = 1;

/** Platform-wide switches that admins flip in "Configuración global". */
@Injectable()
export class GlobalSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<GlobalSettings> {
    const row = await this.prisma.globalSettings.findUnique({
      where: { id: ID },
      include: { updatedBy: { select: { name: true, email: true } } },
    });
    // No row (e.g. deleted by hand): the defaults, everything on.
    if (!row) return { bankSyncEnabled: true };
    return {
      bankSyncEnabled: row.bankSyncEnabled,
      updatedByName: row.updatedBy
        ? row.updatedBy.name || row.updatedBy.email
        : undefined,
      updatedAt: row.updatedAt,
    };
  }

  async isBankSyncEnabled(): Promise<boolean> {
    return (await this.get()).bankSyncEnabled;
  }

  async update(
    input: UpdateGlobalSettingsInput,
    actorId: string,
  ): Promise<GlobalSettings> {
    const data = {
      ...(input.bankSyncEnabled !== undefined && {
        bankSyncEnabled: input.bankSyncEnabled,
      }),
      updatedById: actorId,
    };
    await this.prisma.globalSettings.upsert({
      where: { id: ID },
      create: { id: ID, ...data },
      update: data,
    });
    return this.get();
  }
}
