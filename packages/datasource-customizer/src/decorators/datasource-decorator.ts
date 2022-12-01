import {
  Caller,
  Chart,
  Collection,
  DataSource,
  DataSourceSchema,
} from '@forestadmin/datasource-toolkit';

type CollectionDecoratorConstructor<CollectionDecorator extends Collection> = {
  new (c: Collection, d: DataSource): CollectionDecorator;
};

export default class DataSourceDecorator<CollectionDecorator extends Collection = Collection>
  implements DataSource<CollectionDecorator>
{
  protected readonly childDataSource: DataSource;
  private readonly CollectionDecoratorCtor: CollectionDecoratorConstructor<CollectionDecorator>;
  private readonly decorators: WeakMap<Collection, CollectionDecorator> = new WeakMap();

  get schema(): DataSourceSchema {
    return this.childDataSource.schema;
  }

  get collections(): CollectionDecorator[] {
    return this.childDataSource.collections.map(collection => {
      if (!this.decorators.has(collection))
        this.decorators.set(collection, new this.CollectionDecoratorCtor(collection, this));

      return this.decorators.get(collection);
    });
  }

  constructor(
    childDataSource: DataSource,
    CollectionDecoratorCtor: CollectionDecoratorConstructor<CollectionDecorator>,
  ) {
    this.childDataSource = childDataSource;
    this.CollectionDecoratorCtor = CollectionDecoratorCtor;
  }

  getCollection(name: string): CollectionDecorator {
    return this.collections.find(c => c.name === name);
  }

  renderChart(caller: Caller, name: string): Promise<Chart> {
    return this.childDataSource.renderChart(caller, name);
  }
}
