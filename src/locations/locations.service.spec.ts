import { LocationType } from './enums/location-type.enum';
import { LocationsService } from './locations.service';

describe('LocationsService.getOrCreateDefaultWarehouse', () => {
  it('creates a warehouse when none exist', async () => {
    const created = {
      id: 'wh-1',
      name: 'Центральный склад',
      type: LocationType.WAREHOUSE,
      parentId: null,
    };
    const repo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(created),
      find: jest.fn().mockResolvedValueOnce([]),
      create: jest.fn((row: unknown) => row),
      save: jest.fn().mockResolvedValue(created),
    };
    const service = new LocationsService(repo as never, {
      get: jest.fn().mockReturnValue(undefined),
    } as never);

    const location = await service.getOrCreateDefaultWarehouse();

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Центральный склад',
        type: LocationType.WAREHOUSE,
      }),
    );
    expect(location.id).toBe('wh-1');
  });

  it('returns an existing warehouse without creating another', async () => {
    const warehouse = { id: 'wh-2', type: LocationType.WAREHOUSE };
    const repo = {
      findOne: jest.fn().mockResolvedValue(warehouse),
      save: jest.fn(),
    };
    const service = new LocationsService(repo as never, {
      get: jest.fn().mockReturnValue(undefined),
    } as never);

    await expect(service.getOrCreateDefaultWarehouse()).resolves.toBe(
      warehouse,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('uses any location if there is no warehouse type', async () => {
    const salon = { id: 'salon-1', type: LocationType.STORE };
    const repo = {
      findOne: jest.fn().mockResolvedValueOnce(null),
      find: jest.fn().mockResolvedValueOnce([salon]),
      save: jest.fn(),
    };
    const service = new LocationsService(repo as never, {
      get: jest.fn().mockReturnValue(undefined),
    } as never);

    await expect(service.getOrCreateDefaultWarehouse()).resolves.toBe(salon);
    expect(repo.find).toHaveBeenCalledWith({
      order: { createdAt: 'ASC' },
      take: 1,
    });
    expect(repo.save).not.toHaveBeenCalled();
  });
});
