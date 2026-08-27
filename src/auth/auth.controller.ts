import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import {
  ForgotPasswordResponseDto,
  LoginOkResponseDto,
  MeResponseDto,
  ProfileLocationDto,
  RoleMetaDto,
  TokenPairDto,
  TokenPairResponseDto,
  TotpEnrollmentResponseDto,
  TotpRequiredResponseDto,
  TotpSetupResponseDto,
  TotpStatusResponseDto,
} from './dto/auth-responses.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TotpCodeDto } from './dto/totp-code.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyTotpDto } from './dto/verify-totp.dto';
import { AuthUser } from './types/auth.types';
import { Request } from 'express';

@ApiTags('auth')
@ApiExtraModels(
  LoginOkResponseDto,
  TotpRequiredResponseDto,
  TotpEnrollmentResponseDto,
  MeResponseDto,
  RoleMetaDto,
  ProfileLocationDto,
)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Регистрация кассира (роль cashier)' })
  @ApiCreatedResponse({ type: TokenPairResponseDto })
  @ApiConflictResponse({ description: 'Email уже зарегистрирован' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @SkipThrottle()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Логин по email и паролю',
    description:
      'Сейчас 2FA выключена (`AUTH_2FA_ENABLED=false`): все роли сразу получают JWT. Эндпоинты /login/2fa и /2fa/* отвечают 400, пока флаг не включат.',
  })
  @ApiOkResponse({
    description: 'ok | totp_required | totp_enrollment',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(LoginOkResponseDto) },
        { $ref: getSchemaPath(TotpRequiredResponseDto) },
        { $ref: getSchemaPath(TotpEnrollmentResponseDto) },
      ],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Неверный email или пароль' })
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, requestMeta(request));
  }

  @Public()
  @Post('login/2fa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Подтверждение TOTP после логина' })
  @ApiOkResponse({ type: TokenPairResponseDto })
  @ApiUnauthorizedResponse({ description: 'Неверный или просроченный challenge/код' })
  confirmTwoFactor(@Body() dto: VerifyTotpDto, @Req() request: Request) {
    return this.authService.confirmTwoFactor(
      dto.challengeId,
      dto.code,
      requestMeta(request),
    );
  }

  @ApiAuth()
  @Post('2fa/setup')
  @ApiOperation({ summary: 'Начать подключение TOTP (для ролей без обязательной 2FA)' })
  @ApiCreatedResponse({ type: TotpSetupResponseDto })
  setupTotp(@CurrentUser() user: AuthUser) {
    return this.authService.setupTotp(user.id);
  }

  @ApiAuth()
  @Post('2fa/enable')
  @ApiOperation({ summary: 'Включить TOTP по коду из приложения-аутентификатора' })
  @ApiCreatedResponse({ type: TotpStatusResponseDto })
  enableTotp(@CurrentUser() user: AuthUser, @Body() dto: VerifyTotpDto) {
    return this.authService.enableTotp(user.id, dto.challengeId, dto.code);
  }

  @ApiAuth()
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Выключить TOTP',
    description: 'Запрещено для admin и store_manager.',
  })
  @ApiOkResponse({ type: TotpStatusResponseDto })
  disableTotp(@CurrentUser() user: AuthUser, @Body() dto: TotpCodeDto) {
    return this.authService.disableTotp(user.id, dto.code);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Обновить пару токенов по refresh-токену' })
  @ApiOkResponse({ type: TokenPairDto })
  @ApiUnauthorizedResponse({ description: 'Refresh отозван или невалиден' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Отозвать текущий refresh-токен' })
  @ApiNoContentResponse()
  async logout(@Body() dto: RefreshTokenDto, @Req() request: Request): Promise<void> {
    await this.authService.logout(dto.refreshToken, requestMeta(request));
  }

  @ApiAuth()
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Отозвать все сессии пользователя' })
  @ApiNoContentResponse()
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
  ): Promise<void> {
    await this.authService.logoutAll(user.id, requestMeta(request));
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Запросить одноразовый код сброса пароля' })
  @ApiOkResponse({ type: ForgotPasswordResponseDto })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Сбросить пароль по одноразовому токену' })
  @ApiNoContentResponse()
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto);
  }

  @ApiAuth()
  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Сменить свой пароль' })
  @ApiNoContentResponse()
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(user.id, dto.password);
  }

  @ApiAuth()
  @Get('history')
  @ApiOperation({ summary: 'История входов и выходов из аккаунта' })
  @ApiOkResponse({ description: 'События auth' })
  history(@CurrentUser() user: AuthUser) {
    return this.authService.loginHistory(user.id);
  }

  @ApiAuth()
  @Get('me')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Профиль текущей роли',
    description:
      'ФИО, точка, roleMeta (лейбл, цвет, навигация), карта прав и workspace под роль.',
  })
  @ApiOkResponse({ type: MeResponseDto })
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }

  @ApiAuth()
  @Patch('me')
  @AuditLog('auth')
  @ApiOperation({
    summary: 'Изменить свои данные профиля',
    description:
      'Имя, фамилия, телефон, email. Точку продаж может менять только admin.',
  })
  @ApiOkResponse({ type: MeResponseDto })
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.id, user.role, dto);
  }
}

function requestMeta(request: Request) {
  const forwarded = request.headers['x-forwarded-for'];
  const ip =
    (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ||
    request.ip ||
    request.socket?.remoteAddress ||
    null;
  const userAgent = request.headers['user-agent'] ?? null;
  return { ip, userAgent };
}
