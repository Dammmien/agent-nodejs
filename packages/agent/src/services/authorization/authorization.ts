import { Context } from 'koa';

import {
  Aggregation,
  Caller,
  Collection,
  ConditionTree,
  ConditionTreeFactory,
  Filter,
  GenericTree,
} from '@forestadmin/datasource-toolkit';
import { CollectionActionEvent, ForestAdminClient } from '@forestadmin/forestadmin-client';

import { HttpCode } from '../../types';
import ApprovalNotAllowedError from './errors/approvalNotAllowedError';
import ConditionTreeParser from '../../utils/condition-tree-parser';
import CustomActionRequiresApprovalError from './errors/CustomActionRequiresApprovalError';
import CustomActionTriggerForbiddenError from './errors/customActionTriggerForbiddenError';
import InvalidActionConditionError from './errors/invalidActionConditionError';

export default class AuthorizationService {
  constructor(private readonly forestAdminClient: ForestAdminClient) {}

  public async assertCanBrowse(context: Context, collectionName: string) {
    await this.assertCanOnCollection(CollectionActionEvent.Browse, context, collectionName);
  }

  public async assertCanRead(context: Context, collectionName: string) {
    await this.assertCanOnCollection(CollectionActionEvent.Read, context, collectionName);
  }

  public async assertCanAdd(context: Context, collectionName: string) {
    await this.assertCanOnCollection(CollectionActionEvent.Add, context, collectionName);
  }

  public async assertCanEdit(context: Context, collectionName: string) {
    await this.assertCanOnCollection(CollectionActionEvent.Edit, context, collectionName);
  }

  public async assertCanDelete(context: Context, collectionName: string) {
    await this.assertCanOnCollection(CollectionActionEvent.Delete, context, collectionName);
  }

  public async assertCanExport(context: Context, collectionName: string) {
    await this.assertCanOnCollection(CollectionActionEvent.Export, context, collectionName);
  }

  private async assertCanOnCollection(
    event: CollectionActionEvent,
    context: Context,
    collectionName: string,
  ) {
    const { id: userId } = context.state.user;

    const canOnCollection = await this.forestAdminClient.permissionService.canOnCollection({
      userId,
      event,
      collectionName,
    });

    if (!canOnCollection) {
      context.throw(HttpCode.Forbidden, 'Forbidden');
    }
  }

  // Question: How to have a nicer signature caller collectionAggregate requestConditionTree
  // are used for the same purpose
  public async assertCanTriggerCustomAction({
    context,
    customActionName,
    collectionName,
    collectionAggregate,
    requestConditionTreeForCaller,
    caller,
  }: {
    context: Context;
    customActionName: string;
    collectionName: string;
    collectionAggregate: Collection['aggregate'];
    requestConditionTreeForCaller: ConditionTree;
    requestConditionTreeForAllCaller: ConditionTree;
    caller: Caller;
  }): Promise<void> {
    const { id: userId } = context.state.user;
    const canTrigger = await this.forestAdminClient.permissionService.canTriggerCustomAction({
      userId,
      customActionName,
      collectionName,
    });

    if (!canTrigger) {
      context.throw(HttpCode.Forbidden, 'Forbidden');
    }

    const preBakedIntersectAggregate = this.makeBakedIntersectAggregate(
      caller,
      collectionAggregate,
      requestConditionTreeForCaller,
    );

    // Checking conditional trigger filter
    const conditionalTriggerRawFilter =
      await this.forestAdminClient.permissionService.getConditionalTriggerFilter({
        userId,
        customActionName,
        collectionName,
      });

    if (conditionalTriggerRawFilter) {
      // Promise.all()
      const requestRecordsCount = await preBakedIntersectAggregate();
      const matchingRecordsCount = await preBakedIntersectAggregate(conditionalTriggerRawFilter);

      // CASE: Condition partially respected -> CustomAction TriggerForbidden
      // if some records don't match the condition the user is not allow to perform the action

      if (matchingRecordsCount !== requestRecordsCount) {
        throw new CustomActionTriggerForbiddenError();
      }
    }

    // STATE: Trigger is OK let see if requires approval

    const doesTriggerRequiresApproval =
      await await this.forestAdminClient.permissionService.doesTriggerCustomActionRequiresApproval({
        userId,
        customActionName,
        collectionName,
      });

    // CASE: User can trigger without approval required -> return
    if (!doesTriggerRequiresApproval) {
      return;
    }

    // Checking conditional Requires Approval filter
    const conditionalRequiresApprovalRawFilter =
      await this.forestAdminClient.permissionService.getConditionalRequiresApprovalFilter({
        userId,
        customActionName,
        collectionName,
      });

    if (conditionalRequiresApprovalRawFilter) {
      const matchingRecordsCount = await preBakedIntersectAggregate(
        conditionalRequiresApprovalRawFilter,
      );

      // CASE: No records match the condition -> User can trigger without approval -> return
      if (matchingRecordsCount === 0) {
        return;
      }
    }

    // CASE: Some records match the condition -> CustomAction RequiresApproval
    // OR CASE: No conditional RequireApproval filter -> CustomAction always RequiresApproval
    const rolesIdsAllowedToApprove = await this.getRolesIdsAllowedToApprove(
      customActionName,
      collectionName,
      preBakedIntersectAggregate,
    );
    throw new CustomActionRequiresApprovalError(rolesIdsAllowedToApprove);
  }

  public async assertCanApproveCustomAction({
    context,
    customActionName,
    collectionName,
    requesterId,
    collectionAggregate,
    requestConditionTreeForCaller,
    caller,
  }: {
    context: Context;
    customActionName: string;
    collectionName: string;
    requesterId: number | string;
    collectionAggregate: Collection['aggregate'];
    requestConditionTreeForCaller: ConditionTree;
    requestConditionTreeForAllCaller: ConditionTree;
    caller: Caller;
  }): Promise<void> {
    const { id: userId } = context.state.user;
    const canApprove = await this.forestAdminClient.permissionService.canApproveCustomAction({
      userId,
      customActionName,
      collectionName,
      requesterId,
    });

    const preBakedIntersectAggregate = this.makeBakedIntersectAggregate(
      caller,
      collectionAggregate,
      requestConditionTreeForCaller,
    );

    if (!canApprove) {
      // CASE: ApprovalNotAllowedError
      const rolesIdsAllowedToApprove = await this.getRolesIdsAllowedToApprove(
        customActionName,
        collectionName,
        preBakedIntersectAggregate,
      );

      throw new ApprovalNotAllowedError(rolesIdsAllowedToApprove);
    }

    // Checking conditional approve filter
    const conditionalApproveRawFilter =
      await this.forestAdminClient.permissionService.getConditionalApproveFilter({
        userId,
        customActionName,
        collectionName,
      });

    if (conditionalApproveRawFilter) {
      // Promise.all()
      const requestRecordsCount = await preBakedIntersectAggregate();
      const matchingRecordsCount = await preBakedIntersectAggregate(conditionalApproveRawFilter);

      // CASE: Condition partially respected -> CustomAction ApprovalNotAllowedError
      // if some records don't match the condition the user is not allow to approve the action
      if (matchingRecordsCount !== requestRecordsCount) {
        // WARNING requestConditionTreeForCaller have scope inside !
        const rolesIdsAllowedToApprove = await this.getRolesIdsAllowedToApprove(
          customActionName,
          collectionName,
          preBakedIntersectAggregate,
        );
        throw new ApprovalNotAllowedError(rolesIdsAllowedToApprove);
      }
    }

    // CASE: No conditional approve -> User can approve
    // CASE: All records match the condition -> User can approve
  }

  public async assertCanRequestCustomActionParameters(
    context: Context,
    customActionName: string,
    collectionName: string,
  ) {
    const { id: userId } = context.state.user;

    const canRequest =
      await this.forestAdminClient.permissionService.canRequestCustomActionParameters({
        userId,
        customActionName,
        collectionName,
      });

    if (!canRequest) {
      context.throw(HttpCode.Forbidden, 'Forbidden');
    }
  }

  public async assertCanRetrieveChart(context: Context): Promise<void> {
    const { renderingId, id: userId } = context.state.user;
    const { body: chartRequest } = context.request;

    const canRetrieve = await this.forestAdminClient.permissionService.canRetrieveChart({
      renderingId,
      userId,
      chartRequest,
    });

    if (!canRetrieve) {
      context.throw(HttpCode.Forbidden, 'Forbidden');
    }
  }

  public async getScope(collection: Collection, context: Context): Promise<ConditionTree> {
    const { user } = context.state;

    const scope = await this.forestAdminClient.getScope({
      renderingId: user.renderingId,
      userId: user.id,
      collectionName: collection.name,
    });

    if (!scope) return null;

    return ConditionTreeParser.fromPlainObject(collection, scope);
  }

  public invalidateScopeCache(renderingId: number | string) {
    this.forestAdminClient.markScopesAsUpdated(renderingId);
  }

  public verifySignedActionParameters<TSignedParameters>(signedToken: string): TSignedParameters {
    return this.forestAdminClient.verifySignedActionParameters(signedToken);
  }

  private makeBakedIntersectAggregate(
    caller: Caller,
    collectionAggregate: Collection['aggregate'],
    requestConditionTree: ConditionTree,
  ) {
    return async (conditionalRawFilter?: GenericTree) => {
      try {
        // Build filter format with the right format
        const conditionalFilter = new Filter({
          conditionTree: conditionalRawFilter
            ? ConditionTreeFactory.intersect(
                ConditionTreeFactory.fromPlainObject(conditionalRawFilter),
                requestConditionTree,
              )
            : requestConditionTree,
        });

        const rows = await collectionAggregate(
          caller,
          conditionalFilter,
          new Aggregation({
            operation: 'Count',
          }),
        );

        return (rows?.[0]?.value as number) ?? 0;
      } catch (error) {
        throw new InvalidActionConditionError();
      }
    };
  }

  private async getRolesIdsAllowedToApprove(
    customActionName: string,
    collectionName: string,
    aggregate: (conditionalRawFilter?: GenericTree) => Promise<number>,
  ) {
    const rolesIdsAllowedToApprove = [];

    const conditionsByRoleId =
      await this.forestAdminClient.permissionService.getConditionalApproveFilters({
        customActionName,
        collectionName,
      });

    // No optimized way to do it
    const requestRecordsCount = await aggregate();

    // No optimized way to do it
    conditionsByRoleId.forEach(async (filter, roleId) => {
      const matchingRecordsCount = await aggregate(filter);

      if (requestRecordsCount === matchingRecordsCount) {
        rolesIdsAllowedToApprove.push(roleId);
      }
    });

    return rolesIdsAllowedToApprove;
  }
}
