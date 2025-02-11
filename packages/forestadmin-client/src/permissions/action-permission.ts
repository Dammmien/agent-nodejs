import type { RawTreeWithSources } from './types';
import type { ForestAdminClientOptionsWithDefaults } from '../types';

import generateActionsFromPermissions, {
  ActionPermissions,
} from './generate-actions-from-permissions';
import { ForestAdminServerInterface } from '../types';

export default class ActionPermissionService {
  private permissionsPromise: Promise<ActionPermissions> | undefined;
  private permissionExpirationTimestamp: number | undefined;

  constructor(
    private readonly options: ForestAdminClientOptionsWithDefaults,
    private readonly forestAdminServerInterface: ForestAdminServerInterface,
  ) {}

  public async isDevelopmentPermission(): Promise<boolean> {
    const permissions = await this.getPermissions();

    // isDevelopment is true only for development environment
    return permissions.isDevelopment;
  }

  public can(roleId: number, actionName: string): Promise<boolean> {
    return this.hasPermissionOrRefetch({
      roleId,
      actionName,
      // Only allow refetch when not using server events
      allowRefetch: !this.options.instantCacheRefresh,
    });
  }

  private async hasPermissionOrRefetch({
    roleId,
    actionName,
    allowRefetch,
  }: {
    roleId: number;
    actionName: string;
    allowRefetch: boolean;
  }): Promise<boolean> {
    const permissions = await this.getPermissions();
    const isAllowed = this.isAllowed({ permissions, actionName, roleId });

    if (!isAllowed && allowRefetch) {
      this.invalidateCache();

      return this.hasPermissionOrRefetch({
        roleId,
        actionName,
        allowRefetch: false,
      });
    }

    this.options.logger(
      'Debug',
      `User ${roleId} is ${isAllowed ? '' : 'not '}allowed to perform ${actionName}`,
    );

    return isAllowed;
  }

  private isAllowed({
    permissions,
    actionName,
    roleId,
  }: {
    permissions: ActionPermissions;
    actionName: string;
    roleId: number;
  }): boolean {
    // In development everything is allowed
    return Boolean(
      permissions.isDevelopment ||
        permissions.actionsGloballyAllowed.has(actionName) ||
        permissions.actionsByRole.get(actionName)?.allowedRoles.has(roleId),
    );
  }

  private async getPermissions(): Promise<ActionPermissions> {
    if (
      this.permissionsPromise &&
      this.permissionExpirationTimestamp &&
      this.permissionExpirationTimestamp > Date.now()
    ) {
      return this.permissionsPromise;
    }

    this.permissionsPromise = this.fetchEnvironmentPermissions();
    this.permissionExpirationTimestamp =
      Date.now() + this.options.permissionsCacheDurationInSeconds * 1000;

    return this.permissionsPromise;
  }

  private async fetchEnvironmentPermissions(): Promise<ActionPermissions> {
    this.options.logger('Debug', 'Fetching environment permissions');

    const rawPermissions = await this.forestAdminServerInterface.getEnvironmentPermissions(
      this.options,
    );

    return generateActionsFromPermissions(rawPermissions);
  }

  public async getCustomActionCondition(
    roleId: number,
    actionName: string,
  ): Promise<RawTreeWithSources | undefined> {
    const permissions = await this.getPermissions();

    const conditionFilter = permissions.actionsByRole.get(actionName)?.conditionsByRole.get(roleId);

    return conditionFilter;
  }

  public async getAllCustomActionConditions(
    actionName: string,
  ): Promise<Map<number, RawTreeWithSources> | undefined> {
    const permissions = await this.getPermissions();

    return permissions.actionsByRole.get(actionName)?.conditionsByRole;
  }

  public async getRoleIdsAllowedToApproveWithoutConditions(
    actionName: string,
  ): Promise<Array<number>> {
    const permissions = await this.getPermissions();

    const approvalPermission = permissions.actionsByRole.get(actionName);

    if (!approvalPermission) {
      return [];
    }

    // All allowed roles excluding the one with conditions
    return Array.from(approvalPermission.allowedRoles).filter(
      roleId => !approvalPermission.conditionsByRole?.has(roleId),
    );
  }

  public invalidateCache() {
    this.options.logger('Debug', 'Invalidating roles permissions cache..');

    this.permissionsPromise = undefined;
    this.permissionExpirationTimestamp = undefined;
  }
}
