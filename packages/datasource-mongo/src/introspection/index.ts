/* eslint-disable no-underscore-dangle */

import { Collection, Db } from 'mongodb';

import { CollectionIntrospection, NodeAnalysis, Primitive } from './types';

export default class Introspector {
  private static readonly MAX_NODES = 100;
  private static readonly MAX_SAMPLES = 10;

  static async introspect(connection: Db): Promise<CollectionIntrospection[]> {
    const collections = await connection.collections();
    const structure = collections.map(c => this.analyzeCollection(c));

    return Promise.all(structure);
  }

  private static async analyzeCollection(collection: Collection): Promise<CollectionIntrospection> {
    const root = this.createNode();

    for await (const doc of collection.find().limit(this.MAX_NODES)) {
      this.walkNode(root, doc);
    }

    return { name: collection.collectionName, analysis: root };
  }

  private static createNode(): NodeAnalysis {
    return { types: {}, seen: 0, samples: new Set() };
  }

  private static walkNode(memo: NodeAnalysis, doc: unknown): void {
    if (Array.isArray(doc)) this.walkArrayNode(memo, doc);
    else if (doc?.constructor === Object) this.walkObjectNode(memo, doc as Record<string, unknown>);
    else this.walkPrimitiveNode(memo, doc);
  }

  private static walkArrayNode(memo: NodeAnalysis, doc: unknown[]): void {
    this.incrementTypeCount(memo, 'array');

    if (!memo.arrayElement) memo.arrayElement = this.createNode();
    for (const item of doc) this.walkNode(memo.arrayElement, item);
  }

  private static walkObjectNode(memo: NodeAnalysis, doc: Record<string, unknown>): void {
    this.incrementTypeCount(memo, 'object');

    for (const [key, subDoc] of Object.entries(doc)) {
      if (!memo.object) memo.object = {};
      if (!memo.object[key]) memo.object[key] = this.createNode();

      this.walkNode(memo.object[key], subDoc);
    }
  }

  private static walkPrimitiveNode(memo: NodeAnalysis, doc: unknown): void {
    let type: Primitive = typeof doc as Primitive;
    if (doc === null) type = 'null';
    else if (typeof doc === 'object' && '_bsontype' in doc) type = doc._bsontype as Primitive;
    else if (doc instanceof Date) type = 'Date';

    this.incrementTypeCount(memo, type);

    // For evaluation of foreign keys
    if (doc && memo.samples.size < this.MAX_SAMPLES) memo.samples.add(doc);
  }

  private static incrementTypeCount(memo: NodeAnalysis, type: Primitive): void {
    memo.seen += 1;
    memo.types[type] = (memo.types[type] || 0) + 1;
  }
}
