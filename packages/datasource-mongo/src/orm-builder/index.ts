import { Connection, Schema } from 'mongoose';

import { CollectionIntrospection, NodeAnalysis, Primitive } from '../introspection/types';

export default class OdmBuilder {
  private static readonly primitives: Partial<Record<Primitive, unknown>> = {
    boolean: Boolean,
    number: Number,
    string: String,
    Date,
    Binary: Buffer,
    ObjectId: Schema.Types.ObjectId,
  };

  static defineModels(connection: Connection, introspection: CollectionIntrospection[]) {
    for (const collection of introspection) {
      const definition = this.buildDefinition(collection.analysis);

      connection.model(collection.name, new Schema(definition));
    }
  }

  private static buildDefinition(analysis: NodeAnalysis): unknown {
    const types = Object.keys(analysis.types).filter(type => type !== 'null');

    if (types.length === 1) {
      if (types[0] === 'array') {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return [this.buildDefinition(analysis.arrayElement!)];
      }

      if (types[0] === 'object') {
        return Object.fromEntries(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          Object.entries(analysis.object!).map(([path, child]) => [
            path,
            this.buildDefinition(child),
          ]),
        );
      }

      if (types[0] in this.primitives) {
        return this.primitives[types[0]];
      }
    }

    return 'Mixed';
  }
}
