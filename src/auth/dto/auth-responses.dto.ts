import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserStatus } from '../../users/enums/user-status.enum';
import { LocationType } from '../../locations/enums/location-type.enum';

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'cashier@example.com' })
  email: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty({ format: 'uuid', nullable: true })
  locationId: string | null;
}

export class TokenPairDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ example: 900, description: 'TTL access-токена в секундах' })
  expiresIn: number;
}

export class TokenPairResponseDto extends TokenPairDto {
  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}

export class LoginOkResponseDto extends TokenPairResponseDto {
  @ApiProperty({ example: 'ok' })
  status: 'ok';
}

export class TotpRequiredResponseDto {
  @ApiProperty({ example: 'totp_required' })
  status: 'totp_required';

  @ApiProperty({ format: 'uuid' })
  challengeId: string;
}

export class TotpEnrollmentResponseDto {
  @ApiProperty({ example: 'totp_enrollment' })
  status: 'totp_enrollment';

  @ApiProperty({ format: 'uuid' })
  challengeId: string;

  @ApiProperty({
    example: 'otpauth://totp/Platinum%20CRM%20(admin@example.com)?secret=...',
  })
  otpauthUrl: string;

  @ApiProperty({ description: 'Секрет для приложения-аутентификатора (только при enrollment)' })
  secret: string;
}

export class TotpSetupResponseDto {
  @ApiProperty({ format: 'uuid' })
  challengeId: string;

  @ApiProperty()
  secret: string;

  @ApiProperty()
  otpauthUrl: string;
}

export class TotpStatusResponseDto {
  @ApiProperty()
  totpEnabled: boolean;
}

export class ForgotPasswordResponseDto {
  @ApiProperty({ example: 'If the email exists, a reset code was sent' })
  message: string;

  @ApiPropertyOptional({
    description: 'Одноразовый токен сброса. Возвращается только вне production.',
  })
  devToken?: string;
}

export class RoleNavItemDto {
  @ApiProperty({ example: 'users' })
  id: string;

  @ApiProperty({ example: 'Сотрудники' })
  label: string;

  @ApiProperty({ example: '/admin/users' })
  href: string;

  @ApiProperty({ example: 'users' })
  icon: string;
}

export class RoleMetaDto {
  @ApiProperty({ example: 'Администратор' })
  label: string;

  @ApiProperty({ example: 'Управление сетью' })
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ example: '#1f4b8f' })
  accent: string;

  @ApiProperty({ type: [RoleNavItemDto] })
  nav: RoleNavItemDto[];
}

export class ProfileLocationDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: LocationType })
  type: LocationType;

  @ApiProperty({ format: 'uuid', nullable: true })
  parentId: string | null;
}

export class MeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ nullable: true })
  phone: string | null;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ example: 'Анна Кассирова' })
  displayName: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty({ enum: UserStatus })
  status: UserStatus;

  @ApiProperty({ format: 'uuid', nullable: true })
  locationId: string | null;

  @ApiProperty()
  totpEnabled: boolean;

  @ApiProperty({ type: ProfileLocationDto, nullable: true })
  location: ProfileLocationDto | null;

  @ApiProperty({ type: RoleMetaDto })
  roleMeta: RoleMetaDto;

  @ApiProperty({
    description: 'Карта прав: ресурс → CRUD (C/R/U/D)',
    example: { users: ['C', 'R', 'U', 'D'], settings: ['C', 'R', 'U', 'D'] },
  })
  permissions: Record<string, string[]>;

  @ApiProperty({
    description:
      'Контекст рабочего места: у admin — counts, у кассира — currentShift, у управляющего — subtreeLocationIds, у склада — defaultWarehouse, у online — channel.',
  })
  workspace: Record<string, unknown>;
}
