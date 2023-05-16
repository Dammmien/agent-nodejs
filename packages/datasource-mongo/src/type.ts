import { MongooseOptions } from '@forestadmin/datasource-mongoose';
import { ConnectOptions } from 'mongoose';

import { ModelStudyDef } from './introspection/types';

export type MongoOptions = ConnectOptions &
  MongooseOptions & { uri: string; introspection?: ModelStudyDef[]; introspectionPath?: string };
