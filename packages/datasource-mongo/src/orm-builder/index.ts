import { Connection, Schema } from 'mongoose';

import { CollectionIntrospection, NodeAnalysis } from '../introspection/types';

export default class OdmBuilder {
  static defineModels(connection: Connection, introspection: CollectionIntrospection[]) {
    for (const collection of introspection) {
      const definition = this.buildDefinition(collection.analysis);

      connection.model(collection.name, new Schema(definition));
    }
  }

  private static buildDefinition(analysis: NodeAnalysis): unknown {
    const types = Object.keys(analysis.types).filter(type => type !== 'null');

    if (types.length === 1) {
      const type = types[0];

      switch (type) {
        case 'boolean':
          return Boolean;
        case 'number':
          return Number;
        case 'string':
          return String;
        case 'Date':
          return Date;
        case 'Binary':
          return Buffer;
        case 'ObjectId':
          return Schema.Types.ObjectId;
        case 'array':
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          return [this.buildDefinition(analysis.arrayElement!)];
        case 'object':
          return Object.fromEntries(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            Object.entries(analysis.object!).map(([path, child]) => [
              path,
              this.buildDefinition(child),
            ]),
          );

        default:
      }
    }

    return { type: 'Mixed' };
  }
}
