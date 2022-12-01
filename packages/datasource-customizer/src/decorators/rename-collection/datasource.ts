import { DataSource } from '@forestadmin/datasource-toolkit';

import DataSourceDecorator from '../datasource-decorator';
import RenameCollectionCollectionDecorator from './collection';

export default class RenameCollectionDataSourceDecorator extends DataSourceDecorator<RenameCollectionCollectionDecorator> {
  constructor(childDataSource: DataSource) {
    super(childDataSource, RenameCollectionCollectionDecorator);
  }

  renameCollection(oldName: string, newName: string): void {
    // Ensure the new collection name is not already used.
    try {
      this.getCollection(newName);
      throw new Error(`The collection name "${newName}" is already defined in the dataSource`);
    } catch {
      // The collection name is not already used => continue.
    }

    // Rename the collection
    const collection = this.getCollection(oldName);

    if (oldName !== newName) collection.rename(newName);
  }

  renameCollections(rename?: { [newName: string]: string }): void {
    for (const [oldName, newName] of Object.entries(rename ?? {})) {
      this.renameCollection(oldName, newName);
    }
  }
}
