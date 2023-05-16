/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Connection, Schema } from 'mongoose';

import { ModelStudyDef, NodeStudyDef, PrimitiveDef } from '../introspection/types';

export default class OdmBuilder {
  private static readonly primitives: Partial<Record<PrimitiveDef, unknown>> = {
    boolean: Boolean,
    number: Number,
    string: String,
    Date,
    Binary: Buffer,
    Mixed: Schema.Types.Mixed,
    ObjectId: Schema.Types.ObjectId,
  };

  static defineModels(connection: Connection, study: ModelStudyDef[]) {
    for (const collection of study) {
      const definition = this.buildDefinition(collection.analysis);
      connection.model(collection.name, new Schema(definition));
    }
  }

  private static buildDefinition(node: NodeStudyDef): unknown {
    if (node.type === 'array') {
      return [this.buildDefinition(node.arrayElement!)];
    }

    if (node.type === 'object') {
      const entries = Object.entries(node.object!).map(([path, child]) => [
        path,
        this.buildDefinition(child),
      ]);

      return Object.fromEntries(entries);
    }

    const result: Record<string, unknown> = {
      type: this.primitives[node.type],
      required: !node.nullable,
    };

    if (node.referenceTo) result.ref = node.referenceTo;

    return result;
  }
}
