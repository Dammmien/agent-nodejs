/* eslint-disable no-underscore-dangle */

import { ModelStudy, MongoCollection, MongoDb, NodeStudy, Primitive } from './types';

export default class Structure {
  static async introspect(
    connection: MongoDb,
    maxDocuments: number,
    maxReferences: number,
  ): Promise<ModelStudy[]> {
    const collections = await connection.collections();
    const structure = collections.map(c => this.analyzeCollection(c, maxDocuments, maxReferences));

    return Promise.all(structure);
  }

  private static async analyzeCollection(
    collection: MongoCollection,
    maxDocuments: number,
    maxReferences: number,
  ): Promise<ModelStudy> {
    const node = this.createNode();

    for await (const sample of collection.find().limit(maxDocuments)) {
      this.walkNode(node, sample, maxReferences);
    }

    return { name: collection.collectionName, analysis: node };
  }

  private static createNode(): NodeStudy {
    return { types: {}, seen: 0, referenceSamples: new Set() };
  }

  private static walkNode(node: NodeStudy, sample: unknown, maxReferences: number): void {
    if (Array.isArray(sample)) this.walkArrayNode(node, sample, maxReferences);
    if (sample?.constructor === Object)
      this.walkObjectNode(node, sample as Record<string, unknown>, maxReferences);

    this.annotateNode(node, sample, maxReferences);
  }

  private static walkArrayNode(node: NodeStudy, sample: unknown[], maxReferences: number): void {
    if (!node.arrayElement) node.arrayElement = this.createNode();
    for (const subSample of sample) this.walkNode(node.arrayElement, subSample, maxReferences);
  }

  private static walkObjectNode(
    node: NodeStudy,
    sample: Record<string, unknown>,
    maxReferences: number,
  ): void {
    if (!node.object) node.object = {};

    for (const [key, subSample] of Object.entries(sample)) {
      if (!node.object[key]) node.object[key] = this.createNode();
      this.walkNode(node.object[key], subSample, maxReferences);
    }
  }

  private static annotateNode(node: NodeStudy, sample: unknown, maxReferences: number): void {
    const type = this.getSampleType(sample);

    // Increment counters
    node.seen += 1;
    node.types[type] = (node.types[type] || 0) + 1;

    // Check if node is a potential reference candidate
    if (node.referenceSamples) {
      const isSingleType = Object.keys(node.types).every(t => t === type || t === 'null');

      if (isSingleType && this.isCandidateForReference(type, sample)) {
        if (sample && node.referenceSamples.size < maxReferences) node.referenceSamples.add(sample);
      } else {
        delete node.referenceSamples;
      }
    }
  }

  private static getSampleType(sample: unknown): Primitive {
    if (sample === null) return 'null';
    if (typeof sample === 'object' && '_bsontype' in sample) return sample._bsontype as Primitive;
    if (sample instanceof Date) return 'Date';
    if (Array.isArray(sample)) return 'array';
    if (sample?.constructor === Object) return 'object';

    return typeof sample as Primitive;
  }

  private static isCandidateForReference(type: Primitive, sample: unknown): boolean {
    return (
      type === 'null' ||
      type === 'ObjectId' ||
      (type === 'Binary' && (sample as Buffer).length <= 16) ||
      (type === 'string' && (sample as string).length <= 36)
    );
  }
}
