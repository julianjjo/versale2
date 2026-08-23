import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    signup: jest.fn(),
    login: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('should call authService.signup and return the result', async () => {
      const signupDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        acceptedTerms: true,
      };

      const mockResult = {
        access_token: 'fake-jwt-token',
        user: {
          id: '1',
          email: signupDto.email,
          name: signupDto.name,
          role: 'USER',
        },
      };

      mockAuthService.signup.mockResolvedValue(mockResult);

      const result = await controller.signup(signupDto);

      expect(mockAuthService.signup).toHaveBeenCalledWith(
        signupDto.email,
        signupDto.password,
        signupDto.name,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('login', () => {
    it('should call authService.login and return the result', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockResult = {
        access_token: 'fake-jwt-token',
        user: {
          id: '1',
          email: loginDto.email,
          name: 'Test User',
          role: 'USER',
        },
      };

      mockAuthService.login.mockResolvedValue(mockResult);

      const result = await controller.login(loginDto);

      expect(mockAuthService.login).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('forgotPassword', () => {
    it('should call authService.forgotPassword and return the result', async () => {
      const dto = { email: 'test@example.com' };
      const mockResult = {
        message:
          'Si el correo existe, enviaremos instrucciones para restablecer la contraseña',
      };

      mockAuthService.forgotPassword.mockResolvedValue(mockResult);

      const result = await controller.forgotPassword(dto);

      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(dto.email);
      expect(result).toEqual(mockResult);
    });
  });

  describe('resetPassword', () => {
    it('should call authService.resetPassword and return the result', async () => {
      const dto = { token: 'reset-token', password: 'newPassword123' };
      const mockResult = {
        message: 'Tu contraseña se actualizó correctamente',
      };

      mockAuthService.resetPassword.mockResolvedValue(mockResult);

      const result = await controller.resetPassword(dto);

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        dto.token,
        dto.password,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('verifyEmail', () => {
    it('should call authService.verifyEmail and return the result', async () => {
      const dto = { token: 'verification-token' };
      const mockResult = { message: 'Tu correo se verificó correctamente' };

      mockAuthService.verifyEmail.mockResolvedValue(mockResult);

      const result = await controller.verifyEmail(dto);

      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith(dto.token);
      expect(result).toEqual(mockResult);
    });
  });

  describe('resendVerification (item 17)', () => {
    it('delega en authService.resendVerification con el id del usuario autenticado', async () => {
      const mockResult = {
        message: 'Te enviamos un nuevo enlace de verificación',
      };
      mockAuthService.resendVerification.mockResolvedValue(mockResult);

      const result = await controller.resendVerification({
        user: { id: 'user-1' },
      } as never);

      expect(mockAuthService.resendVerification).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual(mockResult);
    });
  });
});
