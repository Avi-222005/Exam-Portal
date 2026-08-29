import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError, Not } from 'typeorm';
import { User } from '../entities/user.entity';
import { RegisterDto } from '../auth/dto/register.dto';
import { CreateUserDto } from '../admin/dto/create-user.dto';
import { UpdateUserDto } from '../admin/dto/update-user.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(dto: RegisterDto): Promise<User> {
    const existing = await this.userRepo.findOne({
      where: [{ email: dto.email }, { rollNumber: dto.rollNumber }],
    });

    if (existing) {
      const field = existing.email === dto.email ? 'email' : 'roll number';
      throw new ConflictException(`User with this ${field} already exists`);
    }

    const { qaRoleOptIn, ...rest } = dto;
    const hashedPassword = await bcrypt.hash(rest.password, 10);
    const user = this.userRepo.create({
      ...rest,
      password: hashedPassword,
      metadata: { qaRoleOptIn: qaRoleOptIn ?? false },
    });

    try {
      return await this.userRepo.save(user);
    } catch (err) {
      // Concurrent registration can slip through the findOne check above;
      // convert the DB unique-constraint violation to a clean 409 response.
      if (
        err instanceof QueryFailedError &&
        (err as QueryFailedError & { code?: string }).code === '23505'
      ) {
        throw new ConflictException(
          'User with this email or roll number already exists',
        );
      }
      throw err;
    }
  }

  async findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async findByIdWithPassword(id: number): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .getOne();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findByIdOrFail(id: number): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async count(excludeAdmins: boolean = false): Promise<number> {
    return this.userRepo.count({
      where: excludeAdmins ? { role: UserRole.STUDENT } : undefined,
    });
  }

  async countAdmins(): Promise<number> {
    return this.userRepo.count({
      where: [{ role: UserRole.ADMIN }, { role: UserRole.SUPER_ADMIN }],
    });
  }

  async updateRole(id: number, role: User['role']): Promise<User> {
    const user = await this.findByIdOrFail(id);
    user.role = role;
    return this.userRepo.save(user);
  }

  async findAll(
    pagination?: PaginationDto,
    options?: { qaRoleOptIn?: boolean; requestingUser?: User },
  ): Promise<PaginatedResponse<User>> {
    const page = pagination?.page ?? 1;
    const limit = Math.min(pagination?.limit ?? 10, 100);
    const search = pagination?.search?.trim();

    const qb = this.userRepo
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC');

    // If requesting user is a regular Admin (not Super Admin), hide all Super Admin accounts
    if (options?.requestingUser && options.requestingUser.role !== UserRole.SUPER_ADMIN) {
      qb.andWhere('user.role != :superAdminRole', {
        superAdminRole: UserRole.SUPER_ADMIN,
      });
    }

    if (search) {
      qb.andWhere(
        '(LOWER(user.firstName) LIKE :search OR LOWER(user.lastName) LIKE :search OR LOWER(user.email) LIKE :search OR LOWER(user.rollNumber) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    if (options?.qaRoleOptIn) {
      qb.andWhere("user.metadata->>'qaRoleOptIn' = :qaVal", {
        qaVal: 'true',
      });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async adminCreate(dto: CreateUserDto, requestingAdminId?: number): Promise<User> {
    if (dto.role === UserRole.ADMIN || dto.role === UserRole.SUPER_ADMIN) {
      if (!requestingAdminId) {
        throw new ForbiddenException(
          'Administrator accounts can only be created by an authenticated Super Administrator.',
        );
      }
      const requestingAdmin = await this.findByIdWithPassword(requestingAdminId);
      if (!requestingAdmin || requestingAdmin.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException(
          'Permission denied: Only Super Administrators have permission to create or elevate administrator accounts.',
        );
      }
      if (!dto.currentAdminPassword) {
        throw new BadRequestException(
          'Your Super Administrator password is required to authorize creating an admin account.',
        );
      }
      if (
        !(await bcrypt.compare(dto.currentAdminPassword, requestingAdmin.password))
      ) {
        throw new UnauthorizedException('Invalid Super Administrator password.');
      }
    }

    const existing = await this.userRepo.findOne({
      where: [{ email: dto.email }, { rollNumber: dto.rollNumber }],
    });
    if (existing) {
      const field = existing.email === dto.email ? 'email' : 'roll number';
      throw new ConflictException(`User with this ${field} already exists`);
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      rollNumber: dto.rollNumber,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      password: hashedPassword,
      role: dto.role ?? UserRole.STUDENT,
    });

    try {
      return await this.userRepo.save(user);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as QueryFailedError & { code?: string }).code === '23505'
      ) {
        throw new ConflictException(
          'User with this email or roll number already exists',
        );
      }
      throw err;
    }
  }

  async update(
    id: number,
    dto: UpdateUserDto,
    requestingAdmin?: User,
  ): Promise<User> {
    const user = await this.findByIdOrFail(id);

    if (requestingAdmin) {
      // 1. Regular admin cannot modify Super Admin accounts
      if (
        user.role === UserRole.SUPER_ADMIN &&
        requestingAdmin.role !== UserRole.SUPER_ADMIN
      ) {
        throw new ForbiddenException(
          'Access denied: You do not have permission to modify Super Administrator accounts.',
        );
      }

      // 2. Super Admin role is permanent and immutable
      if (
        user.role === UserRole.SUPER_ADMIN &&
        dto.role !== undefined &&
        dto.role !== UserRole.SUPER_ADMIN
      ) {
        throw new BadRequestException(
          'The Super Administrator role is permanent and cannot be modified.',
        );
      }

      // 3. Prevent any user (Admin or Super Admin) from modifying their own role
      if (
        user.id === requestingAdmin.id &&
        dto.role !== undefined &&
        dto.role !== user.role
      ) {
        throw new BadRequestException('You cannot modify your own role.');
      }

      // 4. Regular Admins cannot change user roles
      if (
        dto.role !== undefined &&
        dto.role !== user.role &&
        requestingAdmin.role !== UserRole.SUPER_ADMIN
      ) {
        throw new ForbiddenException(
          'Permission denied: Only Super Administrators have permission to modify user roles.',
        );
      }

      // 5. Nobody can promote anyone to Super Admin
      if (
        dto.role === UserRole.SUPER_ADMIN &&
        user.role !== UserRole.SUPER_ADMIN
      ) {
        throw new BadRequestException(
          'The Super Administrator role cannot be assigned.',
        );
      }
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.email !== undefined) user.email = dto.email;
    if (dto.countryCode !== undefined) user.countryCode = dto.countryCode;
    if (dto.phoneNumber !== undefined) user.phoneNumber = dto.phoneNumber;
    if (dto.role !== undefined) user.role = dto.role;
    return this.userRepo.save(user);
  }

  async updateMetadata(
    id: number,
    patch: Record<string, string | number | boolean>,
  ): Promise<User> {
    const user = await this.findByIdOrFail(id);
    user.metadata = { ...user.metadata, ...patch };
    return this.userRepo.save(user);
  }

  async delete(id: number, requestingAdmin?: User): Promise<{ deleted: true }> {
    const user = await this.findByIdOrFail(id);

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Super Administrator accounts cannot be deleted.',
      );
    }

    if (requestingAdmin) {
      if (user.id === requestingAdmin.id) {
        throw new BadRequestException('You cannot delete your own account.');
      }

      if (
        user.role === UserRole.ADMIN &&
        requestingAdmin.role !== UserRole.SUPER_ADMIN
      ) {
        throw new ForbiddenException(
          'Permission denied: Only Super Administrators can delete Administrator accounts.',
        );
      }
    }

    await this.userRepo.remove(user);
    return { deleted: true };
  }
}
