import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import { QueryFailedError, Repository } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';
import { StockCheck } from '../inventory/entities/stock-check.entity';
import { Sale } from '../sales/entities/sale.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UserStatus } from './enums/user-status.enum';

type SafeUser = Omit<User, 'passwordHash' | 'totpSecret'>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findAll(): Promise<SafeUser[]> {
    const users = await this.usersRepository.find({
      relations: { location: true },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
    return users.map((user) => this.toSafe(user));
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: { location: true },
    });
  }

  async findSafeById(id: string): Promise<SafeUser> {
    return this.toSafe(await this.getOrFail(id));
  }

  count(): Promise<number> {
    return this.usersRepository.count();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  findByEmailForAuth(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect(['user.passwordHash', 'user.totpSecret'])
      .where('user.email = :email', { email: email.toLowerCase() })
      .getOne();
  }

  findByEmailForAuthById(id: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect(['user.passwordHash', 'user.totpSecret'])
      .where('user.id = :id', { id })
      .getOne();
  }

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const passwordHash = await hash(dto.password, 10);
    try {
      const user = await this.usersRepository.save(
        this.usersRepository.create({
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role,
          phone: dto.phone ?? null,
          locationId: dto.locationId ?? null,
          status: dto.status ?? UserStatus.ACTIVE,
          totpEnabled: false,
          totpSecret: null,
        }),
      );
      return this.toSafe(user);
    } catch (error) {
      this.rethrowUniqueEmail(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    const user = await this.getOrFail(id);

    if (dto.email !== undefined) {
      const email = dto.email.toLowerCase();
      if (email !== user.email) {
        const existing = await this.findByEmail(email);
        if (existing && existing.id !== id) {
          throw new ConflictException('Email already registered');
        }
        user.email = email;
      }
    }
    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.phone !== undefined) user.phone = dto.phone || null;
    if (dto.locationId !== undefined) user.locationId = dto.locationId;
    if (dto.status !== undefined) {
      if (
        dto.status === UserStatus.BLOCKED &&
        user.role === UserRole.ADMIN &&
        user.status !== UserStatus.BLOCKED
      ) {
        await this.assertNotLastAdmin();
      }
      user.status = dto.status;
    }
    if (dto.role !== undefined && dto.role !== user.role) {
      if (user.role === UserRole.ADMIN && dto.role !== UserRole.ADMIN) {
        await this.assertNotLastAdmin();
      }
      user.role = dto.role;
    }

    try {
      return this.toSafe(await this.usersRepository.save(user));
    } catch (error) {
      this.rethrowUniqueEmail(error);
      throw error;
    }
  }

  async setPassword(id: string, password: string): Promise<void> {
    await this.getOrFail(id);
    const passwordHash = await hash(password, 10);
    await this.updatePassword(id, passwordHash);
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.usersRepository.update({ id }, { passwordHash });
  }

  async remove(id: string, actorId: string): Promise<void> {
    if (id === actorId) {
      throw new BadRequestException('Cannot delete your own account');
    }
    const user = await this.getOrFail(id);
    if (user.role === UserRole.ADMIN) {
      await this.assertNotLastAdmin();
    }

    const manager = this.usersRepository.manager;
    const [sales, shifts, stockChecks] = await Promise.all([
      manager.count(Sale, { where: { sellerId: id } }),
      manager.count(Shift, { where: { cashierId: id } }),
      manager.count(StockCheck, { where: { responsibleUserId: id } }),
    ]);
    if (sales + shifts + stockChecks > 0) {
      throw new ConflictException(
        'Cannot delete a user with sales, shifts or stock checks. Block the account instead.',
      );
    }

    await this.usersRepository.remove(user);
  }

  async updateTotp(
    id: string,
    totpSecret: string | null,
    totpEnabled: boolean,
  ): Promise<void> {
    await this.usersRepository.update({ id }, { totpSecret, totpEnabled });
  }

  async getOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private async assertNotLastAdmin(): Promise<void> {
    const count = await this.usersRepository.count({
      where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });
    if (count <= 1) {
      throw new BadRequestException('Cannot remove the last admin');
    }
  }

  private toSafe(user: User): SafeUser {
    const { passwordHash: _p, totpSecret: _t, ...safe } = user;
    return safe;
  }

  private rethrowUniqueEmail(error: unknown): void {
    if (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23505'
    ) {
      throw new ConflictException('Email already registered');
    }
  }
}
