import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    signup: jest.fn(),
    login: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
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

      expect(authService.signup).toHaveBeenCalledWith(
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

      expect(authService.login).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
      expect(result).toEqual(mockResult);
    });
  });
});