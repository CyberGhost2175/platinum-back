import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../auth/types/auth.types';
import { isLocationUnrestricted } from '../common/location-scope';
import { Env } from '../config/env.validation';
import { Item } from '../inventory/entities/item.entity';
import { StockCheck } from '../inventory/entities/stock-check.entity';
import { Sale } from '../sales/entities/sale.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { User } from '../users/entities/user.entity';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';
import { Location } from './entities/location.entity';
import { LocationType } from './enums/location-type.enum';
import { parentWouldCycle } from './location-tree';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private readonly locations: Repository<Location>,
    private readonly config: ConfigService<Env, true>,
  ) {}

  findById(id: string): Promise<Location | null> {
    return this.locations.findOne({ where: { id } });
  }

  async getOrFail(id: string): Promise<Location> {
    const location = await this.findById(id);
    if (!location) {
      throw new NotFoundException('Location not found');
    }
    return location;
  }

  async findDefaultWarehouse(): Promise<Location> {
    const configured = this.config.get('DEFAULT_WAREHOUSE_LOCATION_ID', {
      infer: true,
    });
    if (configured) {
      return this.getOrFail(configured);
    }
    const warehouse = await this.locations.findOne({
      where: { type: LocationType.WAREHOUSE },
      order: { createdAt: 'ASC' },
    });
    if (!warehouse) {
      throw new NotFoundException('Warehouse location is not configured');
    }
    return warehouse;
  }

  async getOrCreateDefaultWarehouse(): Promise<Location> {
    try {
      return await this.findDefaultWarehouse();
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }
    }
    const fallback = await this.locations.findOne({
      order: { createdAt: 'ASC' },
    });
    if (fallback) {
      return fallback;
    }
    const saved = await this.locations.save(
      this.locations.create({
        name: 'Центральный склад',
        type: LocationType.WAREHOUSE,
        parentId: null,
      }),
    );
    return this.findOneWithParent(saved.id);
  }

  async isAccessible(user: AuthUser, locationId: string): Promise<boolean> {
    if (isLocationUnrestricted(user.role)) {
      return true;
    }
    if (!user.locationId) {
      return false;
    }
    if (user.locationId === locationId) {
      return true;
    }
    let current = await this.findById(locationId);
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      if (current.id === user.locationId) {
        return true;
      }
      seen.add(current.id);
      if (!current.parentId) {
        break;
      }
      current = await this.findById(current.parentId);
    }
    return false;
  }

  async assertAccessible(user: AuthUser, locationId: string): Promise<void> {
    if (!(await this.isAccessible(user, locationId))) {
      throw new ForbiddenException('Access to this sales location is denied');
    }
  }

  async findSubtreeIds(rootId: string): Promise<string[]> {
    const rows = (await this.locations.query(
      `
      WITH RECURSIVE tree AS (
        SELECT id FROM locations WHERE id = $1
        UNION ALL
        SELECT child.id
        FROM locations child
        INNER JOIN tree parent ON child.parent_id = parent.id
      )
      SELECT id FROM tree
      `,
      [rootId],
    )) as Array<{ id: string }>;
    return rows.map((row) => row.id);
  }

  count(): Promise<number> {
    return this.locations.count();
  }

  async findAllForUser(user: AuthUser): Promise<Location[]> {
    const all = await this.locations.find({
      relations: { parent: true },
      order: { name: 'ASC' },
    });
    if (isLocationUnrestricted(user.role)) {
      return all;
    }
    if (!user.locationId) {
      return [];
    }
    const allowed = new Set(await this.findSubtreeIds(user.locationId));
    return all.filter((location) => allowed.has(location.id));
  }

  async findOneForUser(user: AuthUser, id: string): Promise<Location> {
    await this.assertAccessible(user, id);
    const location = await this.locations.findOne({
      where: { id },
      relations: { parent: true },
    });
    if (!location) {
      throw new NotFoundException('Location not found');
    }
    return location;
  }

  async create(dto: CreateLocationDto): Promise<Location> {
    if (dto.parentId) {
      await this.getOrFail(dto.parentId);
    }
    const saved = await this.locations.save(
      this.locations.create({
        name: dto.name.trim(),
        type: dto.type,
        parentId: dto.parentId ?? null,
      }),
    );
    return this.findOneWithParent(saved.id);
  }

  async update(id: string, dto: UpdateLocationDto): Promise<Location> {
    const location = await this.getOrFail(id);
    if (dto.name !== undefined) {
      location.name = dto.name.trim();
    }
    if (dto.type !== undefined) {
      location.type = dto.type;
    }
    if (dto.parentId !== undefined) {
      if (dto.parentId) {
        await this.getOrFail(dto.parentId);
        const descendants = await this.findSubtreeIds(id);
        if (parentWouldCycle(id, dto.parentId, descendants)) {
          throw new BadRequestException(
            'Cannot set a location as a child of itself or its descendant',
          );
        }
      }
      location.parentId = dto.parentId;
    }
    await this.locations.save(location);
    return this.findOneWithParent(id);
  }

  async remove(id: string): Promise<void> {
    const location = await this.getOrFail(id);
    const manager = this.locations.manager;
    const [children, users, items, sales, shifts, stockChecks] =
      await Promise.all([
        this.locations.count({ where: { parentId: id } }),
        manager.count(User, { where: { locationId: id } }),
        manager.count(Item, { where: { locationId: id } }),
        manager.count(Sale, { where: { locationId: id } }),
        manager.count(Shift, { where: { locationId: id } }),
        manager.count(StockCheck, { where: { locationId: id } }),
      ]);
    if (children + users + items + sales + shifts + stockChecks > 0) {
      throw new ConflictException(
        'Cannot delete a location that has children, staff, items, sales or shifts',
      );
    }
    await this.locations.remove(location);
  }

  private async findOneWithParent(id: string): Promise<Location> {
    const location = await this.locations.findOne({
      where: { id },
      relations: { parent: true },
    });
    if (!location) {
      throw new NotFoundException('Location not found');
    }
    return location;
  }
}

