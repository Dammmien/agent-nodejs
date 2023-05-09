/* eslint-disable import/prefer-default-export */
import { MongooseDatasource, MongooseOptions } from '@forestadmin/datasource-mongoose';
import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';
import mongoose from 'mongoose';

import connect from './connection';
import Introspector from './introspection';
import OdmBuilder from './orm-builder';

export function createMongoDataSource(
  url: string,
  options: MongooseOptions = {},
): DataSourceFactory {
  return async (logger: Logger) => {
    const client = await connect(url, false);
    const introspection = await Introspector.introspect(client);

    const connection = mongoose.createConnection(url);
    OdmBuilder.defineModels(connection, introspection);

    return new MongooseDatasource(connection, options, logger);
  };
}
