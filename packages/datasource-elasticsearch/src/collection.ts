import { Client } from '@elastic/elasticsearch';
import {
  AggregateResult,
  Aggregation,
  BaseCollection,
  Caller,
  DataSource,
  Filter,
  Logger,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import ModelElasticsearch from './model-builder/model';
import AggregationUtils from './utils/aggregation-converter';
import handleErrors from './utils/error-handler';
import ModelConverter from './utils/model-to-collection-schema-converter';
import QueryConverter from './utils/query-converter';

export default class ElasticsearchCollection extends BaseCollection {
  protected elasticsearchClient: Client;

  protected internalModel: ModelElasticsearch;

  private queryConverter: QueryConverter;

  constructor(datasource: DataSource, model: ModelElasticsearch, logger?: Logger) {
    if (!model) throw new Error('Invalid (null) model instance.');

    super(model.name, datasource);

    this.internalModel = model;

    this.queryConverter = new QueryConverter();

    const modelSchema = ModelConverter.convert(this.internalModel, logger);

    this.enableCount();
    this.addFields(modelSchema.fields);
    this.addSegments(modelSchema.segments);

    logger?.('Debug', `ElasticsearchCollection - ${this.name} added`);
  }

  async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const recordsResponse = await handleErrors('create', async () =>
      this.internalModel.bulkCreate(data),
    );

    return recordsResponse;
  }

  async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    // This code was needed to include models needed for the projection.
    // In our case such case does not exist !
    // if (filter.conditionTree) {
    //   include = include.concat(
    //     this.queryConverter.getIncludeFromProjection(filter.conditionTree.projection),
    //   );
    // }

    const searchBody = {
      query: this.queryConverter.getBoolQueryFromConditionTree(filter.conditionTree),
      ...(filter.sort?.length > 0
        ? { sort: this.queryConverter.getOrderFromSort(filter.sort) }
        : {}),
    };

    // TODO handle projection post search (only return required fields?)
    const recordsResponse = await handleErrors('list', async () =>
      this.internalModel.search(searchBody, filter.page?.skip, filter.page?.limit),
    );

    return recordsResponse;
  }

  async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    const records = await this.list(caller, filter, new Projection('_id'));
    // eslint-disable-next-line no-underscore-dangle
    const ids = records.map(record => record._id as string);

    // We should list them then update them using the right ids and indices ?

    await handleErrors('update', () => this.internalModel.update(ids, patch));
  }

  async delete(caller: Caller, filter: Filter): Promise<void> {
    const records = await this.list(caller, filter, new Projection('_id'));
    // eslint-disable-next-line no-underscore-dangle
    const ids = records.map(record => record._id as string);

    // We should list them then delete them using the right ids and indices ?

    await handleErrors('delete', () => this.internalModel.delete(ids));
  }

  async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const lookupProjection = aggregation.projection.union(filter.conditionTree?.projection);

    // const order = AggregationUtils.getOrder(aggregationFunction);
    const query = this.queryConverter.getBoolQueryFromConditionTree(filter.conditionTree);
    const aggs = AggregationUtils.aggs(aggregation, query);

    console.log(JSON.stringify(query), aggs);
    const searchBody = {
      query,
      aggs,
      // ...(order
      //   ? { order }
      //   : {}),
    };

    const aggregationResults = await handleErrors('list', async () =>
      this.internalModel.aggregateSearch(searchBody),
    );

    console.log(searchBody, aggregationResults);

    return AggregationUtils.computeResult(aggregationResults, aggregation);
  }
}

// { lat: -0.129166667, lon: -78.3575 } => { "coordinates": [ 121.3359985, 31.19790077 ], "type": "Point" }
