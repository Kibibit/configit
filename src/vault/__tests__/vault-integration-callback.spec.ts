/**
 * Unit tests for VaultIntegration callback wiring.
 * Mocks VaultProvider, VaultCache, and SecretRefreshManager — no Vault required.
 */

import { SecretRefreshManager } from '../secret-refresh-manager';
import { VaultIntegration } from '../vault-integration';
import { VaultCache } from '../vault-cache';
import { VaultProvider } from '../vault-provider';
import { IVaultConfigOptions } from '../types';

jest.mock('../vault-provider');
jest.mock('../vault-cache');
jest.mock('../secret-refresh-manager');

const BASE_CONFIG: IVaultConfigOptions = {
  endpoint: 'http://127.0.0.1:8200',
  auth: { method: 'token' as const, token: 'test-token' }
};

describe('VaultIntegration callback wiring', () => {
  let mockRefreshManager: jest.Mocked<SecretRefreshManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRefreshManager = {
      onSecretRefreshed: jest.fn(),
      scheduleRefresh: jest.fn(),
      cancelRefresh: jest.fn(),
      getRefreshStatus: jest.fn().mockReturnValue([]),
      getRefreshStatusForProperty: jest.fn().mockReturnValue(null),
      shutdown: jest.fn()
    } as unknown as jest.Mocked<SecretRefreshManager>;

    (SecretRefreshManager as jest.MockedClass<typeof SecretRefreshManager>)
      .mockImplementation(() => mockRefreshManager);
  });

  it('should register onSecretRefreshed from config in constructor', () => {
    const callback = jest.fn();
    new VaultIntegration({ ...BASE_CONFIG, onSecretRefreshed: callback });

    expect(mockRefreshManager.onSecretRefreshed).toHaveBeenCalledWith(callback);
  });

  it('should not call onSecretRefreshed when not provided in config', () => {
    new VaultIntegration(BASE_CONFIG);

    expect(mockRefreshManager.onSecretRefreshed).not.toHaveBeenCalled();
  });

  it('should delegate runtime onSecretRefreshed to refreshManager', () => {
    const integration = new VaultIntegration(BASE_CONFIG);
    const runtimeCallback = jest.fn();

    integration.onSecretRefreshed(runtimeCallback);

    expect(mockRefreshManager.onSecretRefreshed).toHaveBeenCalledWith(runtimeCallback);
  });

  it('should support both constructor and runtime callbacks', () => {
    const constructorCb = jest.fn();
    const runtimeCb = jest.fn();

    const integration = new VaultIntegration({ ...BASE_CONFIG, onSecretRefreshed: constructorCb });
    integration.onSecretRefreshed(runtimeCb);

    expect(mockRefreshManager.onSecretRefreshed).toHaveBeenCalledTimes(2);
    expect(mockRefreshManager.onSecretRefreshed).toHaveBeenCalledWith(constructorCb);
    expect(mockRefreshManager.onSecretRefreshed).toHaveBeenCalledWith(runtimeCb);
  });
});
