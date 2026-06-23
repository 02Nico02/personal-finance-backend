import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly prismaService: PrismaService,
  ) {}

  @Get()
  getHealth(): { status: string } {
    return this.healthService.getHealth();
  }

  @Get('db')
  async getDatabaseHealth(): Promise<{ status: string; database: string }> {
    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'disconnected',
      });
    }
  }
}
