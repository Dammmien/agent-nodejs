import { MongooseDatasource } from '@forestadmin/datasource-mongoose';
import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';
import { readFile, writeFile } from 'fs/promises';
import stringify from 'json-stringify-pretty-compact';
import mongoose, { Connection } from 'mongoose';

import Introspection from './introspection';
import { ModelStudyDef } from './introspection/types';
import OdmBuilder from './orm-builder';
import { IntrospectOptions, MongoOptions } from './type';

export { ModelStudyDef };

export async function introspect(options: IntrospectOptions): Promise<ModelStudyDef[]> {
  const { uri, connectOptions, introspectionOptions } = options;
  let connection: Connection;

  try {
    connection = mongoose.createConnection(uri, connectOptions);

    return await Introspection.introspect(connection.getClient().db(), introspectionOptions);
  } finally {
    await connection?.close(true);
  }
}

export function createMongoDataSource(options: MongoOptions): DataSourceFactory {
  const {
    uri,
    introspectionPath,
    introspection,
    connectOptions,
    introspectionOptions,
    ...otherOptions
  } = options;
  let introspectionCopy = introspection;

  if (!introspectionCopy && !introspectionPath)
    throw new Error('You must provide either introspection or introspectionPath');
  if (introspectionCopy && introspectionPath)
    throw new Error('You cannot provide both introspection and introspectionPath');

  return async (logger: Logger) => {
    const connection = mongoose.createConnection(uri, connectOptions);
    const db = connection.getClient().db();

    if (!introspectionCopy) {
      try {
        introspectionCopy = JSON.parse(await readFile(introspectionPath, 'utf-8'));
        logger('Info', `Loaded MongoDB structure from: '${introspectionPath}'`);
      } catch {
        logger('Info', `MongoDB structure file not found at '${introspectionPath}'`);
        introspectionCopy = await Introspection.introspect(db, introspectionOptions);

        await writeFile(
          introspectionPath,
          stringify(introspectionCopy, { indent: 2, maxLength: 100 }),
        );
        logger('Info', `Saved MongoDB structure to: '${introspectionPath}'`);
      }
    }

    OdmBuilder.defineModels(connection, introspectionCopy);

    return new MongooseDatasource(connection, otherOptions, logger);
  };
}
