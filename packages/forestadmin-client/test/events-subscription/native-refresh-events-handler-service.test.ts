import NativeRefreshEventsHandlerService from '../../src/events-subscription/native-refresh-events-handler-service';
import * as factories from '../__factories__';

const events = {};
const addEventListener = jest.fn((event, callback) => {
  events[event] = callback;
});

jest.mock('eventsource', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    addEventListener,
  })),
}));

describe('NativeRefreshEventsHandlerService', () => {
  beforeEach(() => jest.clearAllMocks());

  const actionPermission = factories.actionPermission.mockAllMethods().build();
  const usersPermission = factories.userPermission.mockAllMethods().build();
  const renderingPermission = factories.renderingPermission.mockAllMethods().build();

  describe('refreshUsers', () => {
    test('should invalidate users cache', async () => {
      const refreshEventsHandler = new NativeRefreshEventsHandlerService(
        actionPermission,
        usersPermission,
        renderingPermission,
      );

      refreshEventsHandler.refreshUsers();

      expect(usersPermission.invalidateCache).toHaveBeenCalled();

      expect(actionPermission.invalidateCache).not.toHaveBeenCalled();
      expect(renderingPermission.invalidateCache).not.toHaveBeenCalled();
    });
  });

  describe('refreshRoles', () => {
    test('should invalidate roles cache', async () => {
      const refreshEventsHandler = new NativeRefreshEventsHandlerService(
        actionPermission,
        usersPermission,
        renderingPermission,
      );

      refreshEventsHandler.refreshRoles();

      expect(actionPermission.invalidateCache).toHaveBeenCalled();

      expect(usersPermission.invalidateCache).not.toHaveBeenCalled();
      expect(renderingPermission.invalidateCache).not.toHaveBeenCalled();
    });
  });

  describe('refreshRenderings', () => {
    test('should invalidate renderings cache', async () => {
      const refreshEventsHandler = new NativeRefreshEventsHandlerService(
        actionPermission,
        usersPermission,
        renderingPermission,
      );

      const renderingsIds = ['13', 24];
      refreshEventsHandler.refreshRenderings(renderingsIds);

      expect(renderingPermission.invalidateCache).toHaveBeenCalledTimes(2);
      expect(renderingPermission.invalidateCache).toHaveBeenNthCalledWith(1, '13');
      expect(renderingPermission.invalidateCache).toHaveBeenNthCalledWith(2, 24);

      expect(actionPermission.invalidateCache).not.toHaveBeenCalled();
      expect(usersPermission.invalidateCache).not.toHaveBeenCalled();
    });
  });

  describe('refreshCustomizations', () => {
    test('should emit RefreshCustomizations (it will call listener)', async () => {
      const refreshEventsHandler = new NativeRefreshEventsHandlerService(
        actionPermission,
        usersPermission,
        renderingPermission,
      );

      const spyEmit = jest.spyOn(refreshEventsHandler, 'emit');

      refreshEventsHandler.refreshCustomizations();

      expect(spyEmit).toHaveBeenCalled();
      expect(spyEmit).toHaveBeenCalledWith('RefreshCustomizations');

      expect(usersPermission.invalidateCache).not.toHaveBeenCalled();
      expect(actionPermission.invalidateCache).not.toHaveBeenCalled();
      expect(renderingPermission.invalidateCache).not.toHaveBeenCalled();
    });
  });

  describe('refreshEverything', () => {
    test('should refresh all cached data', async () => {
      const refreshEventsHandler = new NativeRefreshEventsHandlerService(
        actionPermission,
        usersPermission,
        renderingPermission,
      );

      const spyEmit = jest.spyOn(refreshEventsHandler, 'emit');

      refreshEventsHandler.refreshEverything();

      expect(usersPermission.invalidateCache).toHaveBeenCalled();
      expect(actionPermission.invalidateCache).toHaveBeenCalled();
      expect(renderingPermission.invalidateAllCache).toHaveBeenCalled();

      expect(spyEmit).toHaveBeenCalled();
    });
  });
});
