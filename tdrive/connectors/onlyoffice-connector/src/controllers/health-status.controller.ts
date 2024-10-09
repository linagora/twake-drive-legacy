import { Request, Response } from 'express';
import { getProviders } from '@/services/health-providers.service';
import { OOCONNECTOR_HEALTH_SECRET } from '@/config';

/**
 * Health response for devops operational purposes. Should not be exposed.
 */
export const HealthStatusController = {
  async get(req: Request<{}, {}, {}, { secret: string }>, res: Response): Promise<void> {
    if (req.query.secret !== OOCONNECTOR_HEALTH_SECRET) return void res.status(404).send(`Cannot GET ${req.path}`);
    const entries = await Promise.all(getProviders().map(p => p.getHealthData()));
    let result = {};
    entries.forEach(entry => (result = { ...result, ...entry }));
    res.send(result);
  },
};
