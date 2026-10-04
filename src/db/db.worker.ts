import * as Comlink from 'comlink';
import { createDatabaseWorkerHostApi } from './db.worker.service';

Comlink.expose(createDatabaseWorkerHostApi());
