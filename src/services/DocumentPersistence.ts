/**
 * AristoColors v2 - IndexedDB Document Persistence Service
 *
 * Implements Step 3 of the AristoColors Studio architecture.
 *
 * Provides a robust, browser-native IndexedDB persistence layer for
 * storing and retrieving ProjectDocument instances (Single Source of Truth).
 *
 * Guarantees:
 * 1. Independent deep-cloned copies returned to callers (zero mutable reference sharing).
 * 2. Strict document integrity verification before save and after load using validateDocumentIntegrity().
 * 3. Schema versioning to support backward-compatible database upgrades.
 * 4. Proper transaction and error lifecycle management (abort, error, blocked, upgrade).
 * 5. Environment-safe checks for non-browser or disabled IndexedDB contexts.
 */

import type { ProjectDocument, ColorSpace } from '../types/DocumentModel.ts';
import type { ProjectMetadata } from '../types/shell.ts';
import { validateDocumentIntegrity } from '../state/useDocumentStore.ts';

// ============================================================================
// Database & Store Constants
// ============================================================================

export const DB_NAME = 'aristocolors_db';
export const DB_VERSION = 2;
export const DOCUMENTS_STORE_NAME = 'documents';
export const ASSETS_STORE_NAME = 'project_assets';

// ============================================================================
// Custom Error Class
// ============================================================================

export class DocumentPersistenceError extends Error {
  public override readonly name = 'DocumentPersistenceError';
  public readonly code: string;
  public readonly causeDetails?: unknown;

  constructor(message: string, code: string, causeDetails?: unknown) {
    super(message);
    this.code = code;
    this.causeDetails = causeDetails;
  }
}

// ============================================================================
// Helper Utilities
// ============================================================================

/**
 * Safely deep-clones a JSON-serializable ProjectDocument.
 */
function cloneDocument(doc: ProjectDocument): ProjectDocument {
  return JSON.parse(JSON.stringify(doc));
}

/**
 * Resolves the global indexedDB factory or throws if unavailable in the environment.
 */
function getIndexedDBFactory(): IDBFactory {
  if (typeof window === 'undefined' || !window.indexedDB) {
    throw new DocumentPersistenceError(
      'IndexedDB is not supported or not available in the current environment.',
      'INDEXEDDB_UNAVAILABLE'
    );
  }
  return window.indexedDB;
}

/**
 * Opens or upgrades the AristoColors IndexedDB database.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let factory: IDBFactory;
    try {
      factory = getIndexedDBFactory();
    } catch (err) {
      reject(err);
      return;
    }

    let isSettled = false;
    const request = factory.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = request.result;

      // 1. Preserve or create primary documents store
      if (!db.objectStoreNames.contains(DOCUMENTS_STORE_NAME)) {
        const store = db.createObjectStore(DOCUMENTS_STORE_NAME, { keyPath: 'id' });
        // Indexes to optimize future queries and sorting
        store.createIndex('by_updatedAt', 'updatedAt', { unique: false });
        store.createIndex('by_createdAt', 'createdAt', { unique: false });
        store.createIndex('by_name', 'name', { unique: false });
      }

      // 2. Create binary assets store if it does not exist (added in DB_VERSION 2)
      if (!db.objectStoreNames.contains(ASSETS_STORE_NAME)) {
        const assetStore = db.createObjectStore(ASSETS_STORE_NAME, { keyPath: 'storageKey' });
        assetStore.createIndex('by_createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      const db = request.result;

      // Handle spontaneous database version changes or closures
      db.onversionchange = () => {
        db.close();
      };

      if (isSettled) {
        // If the promise was already rejected (e.g., due to onblocked or timeout), close connection immediately
        db.close();
        return;
      }

      isSettled = true;
      resolve(db);
    };

    request.onerror = () => {
      if (isSettled) return;
      isSettled = true;
      reject(
        new DocumentPersistenceError(
          `Failed to open IndexedDB database "${DB_NAME}": ${request.error?.message ?? 'Unknown error'}`,
          'DB_OPEN_FAILED',
          request.error
        )
      );
    };

    request.onblocked = () => {
      if (isSettled) return;
      isSettled = true;
      reject(
        new DocumentPersistenceError(
          `Database open request blocked for "${DB_NAME}". Another tab or connection is preventing the database upgrade.`,
          'DB_OPEN_BLOCKED'
        )
      );
    };
  });
}

// ============================================================================
// Exported Core Persistence API
// ============================================================================

/**
 * Persists a ProjectDocument to IndexedDB.
 *
 * Pre-conditions:
 * 1. Document must pass validateDocumentIntegrity().
 * 2. Document is deep-cloned before storage to prevent external mutations.
 *
 * @throws {DocumentPersistenceError} If document is invalid, or if database transaction fails.
 */
export async function saveDocument(document: ProjectDocument): Promise<void> {
  if (!document || typeof document !== 'object' || !document.id) {
    throw new DocumentPersistenceError(
      'Cannot save invalid or null document. A valid document with a non-empty "id" is required.',
      'INVALID_DOCUMENT_INPUT'
    );
  }

  // 1. Validate document integrity before persisting
  const validation = validateDocumentIntegrity(document);
  if (!validation.isValid) {
    throw new DocumentPersistenceError(
      `Cannot save document "${document.id}": integrity check failed:\n- ${validation.errors.join('\n- ')}`,
      'INTEGRITY_CHECK_FAILED',
      validation.errors
    );
  }

  // 2. Clone to guarantee storage of isolated JSON snapshot
  const serializableDoc = cloneDocument(document);

  // 3. Open DB and perform transaction
  const db = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction([DOCUMENTS_STORE_NAME], 'readwrite');
    } catch (txError) {
      db.close();
      reject(
        new DocumentPersistenceError(
          `Failed to start transaction on store "${DOCUMENTS_STORE_NAME}": ${txError instanceof Error ? txError.message : String(txError)}`,
          'TRANSACTION_INIT_FAILED',
          txError
        )
      );
      return;
    }

    const store = transaction.objectStore(DOCUMENTS_STORE_NAME);
    const putRequest = store.put(serializableDoc);

    putRequest.onerror = () => {
      // Error will bubble to transaction.onerror
    };

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(
        new DocumentPersistenceError(
          `Failed to save document "${document.id}": ${transaction.error?.message ?? 'Transaction failed'}`,
          'SAVE_TRANSACTION_FAILED',
          transaction.error
        )
      );
    };

    transaction.onabort = () => {
      db.close();
      reject(
        new DocumentPersistenceError(
          `Save transaction for document "${document.id}" was aborted.`,
          'TRANSACTION_ABORTED',
          transaction.error
        )
      );
    };
  });
}

/**
 * Loads a ProjectDocument from IndexedDB by its unique ID.
 *
 * Post-conditions:
 * 1. Stored record must pass validateDocumentIntegrity(). If corrupted, throws DocumentPersistenceError.
 * 2. Returns an independent deep copy of the document, or null if not found.
 *
 * @throws {DocumentPersistenceError} If stored record is corrupt or transaction fails.
 */
export async function loadDocument(documentId: string): Promise<ProjectDocument | null> {
  if (!documentId || typeof documentId !== 'string' || documentId.trim().length === 0) {
    throw new DocumentPersistenceError(
      'Cannot load document: A non-empty string "documentId" must be provided.',
      'INVALID_ID_INPUT'
    );
  }

  const db = await openDatabase();

  return new Promise<ProjectDocument | null>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction([DOCUMENTS_STORE_NAME], 'readonly');
    } catch (txError) {
      db.close();
      reject(
        new DocumentPersistenceError(
          `Failed to start transaction on store "${DOCUMENTS_STORE_NAME}": ${txError instanceof Error ? txError.message : String(txError)}`,
          'TRANSACTION_INIT_FAILED',
          txError
        )
      );
      return;
    }

    const store = transaction.objectStore(DOCUMENTS_STORE_NAME);
    const getRequest = store.get(documentId);

    let corruptionError: DocumentPersistenceError | null = null;

    getRequest.onsuccess = () => {
      const result = getRequest.result as ProjectDocument | undefined;

      if (!result) {
        // Document with this ID does not exist
        return; // Handled in transaction.oncomplete
      }

      // Validate integrity of loaded document. Do NOT silently return or replace corrupted documents.
      const validation = validateDocumentIntegrity(result);
      if (!validation.isValid) {
        corruptionError = new DocumentPersistenceError(
          `Loaded document "${documentId}" is corrupted and failed integrity validation:\n- ${validation.errors.join('\n- ')}`,
          'CORRUPTED_DOCUMENT_RECORD',
          validation.errors
        );
      }
    };

    transaction.oncomplete = () => {
      db.close();
      if (corruptionError) {
        reject(corruptionError);
        return;
      }

      const result = getRequest.result as ProjectDocument | undefined;
      if (!result) {
        resolve(null);
      } else {
        // Return independent deep clone
        resolve(cloneDocument(result));
      }
    };

    transaction.onerror = () => {
      db.close();
      if (corruptionError) {
        reject(corruptionError);
        return;
      }
      reject(
        new DocumentPersistenceError(
          `Failed to load document "${documentId}": ${transaction.error?.message ?? 'Transaction error'}`,
          'LOAD_TRANSACTION_FAILED',
          transaction.error
        )
      );
    };

    transaction.onabort = () => {
      db.close();
      if (corruptionError) {
        reject(corruptionError);
        return;
      }
      reject(
        new DocumentPersistenceError(
          `Load transaction for document "${documentId}" was aborted.`,
          'TRANSACTION_ABORTED',
          transaction.error
        )
      );
    };
  });
}

/**
 * Deletes a ProjectDocument from IndexedDB by its unique ID.
 *
 * @throws {DocumentPersistenceError} If transaction fails.
 */
export async function deleteDocument(documentId: string): Promise<void> {
  if (!documentId || typeof documentId !== 'string' || documentId.trim().length === 0) {
    throw new DocumentPersistenceError(
      'Cannot delete document: A non-empty string "documentId" must be provided.',
      'INVALID_ID_INPUT'
    );
  }

  const db = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction([DOCUMENTS_STORE_NAME], 'readwrite');
    } catch (txError) {
      db.close();
      reject(
        new DocumentPersistenceError(
          `Failed to start transaction on store "${DOCUMENTS_STORE_NAME}": ${txError instanceof Error ? txError.message : String(txError)}`,
          'TRANSACTION_INIT_FAILED',
          txError
        )
      );
      return;
    }

    const store = transaction.objectStore(DOCUMENTS_STORE_NAME);
    store.delete(documentId);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(
        new DocumentPersistenceError(
          `Failed to delete document "${documentId}": ${transaction.error?.message ?? 'Transaction error'}`,
          'DELETE_TRANSACTION_FAILED',
          transaction.error
        )
      );
    };

    transaction.onabort = () => {
      db.close();
      reject(
        new DocumentPersistenceError(
          `Delete transaction for document "${documentId}" was aborted.`,
          'TRANSACTION_ABORTED',
          transaction.error
        )
      );
    };
  });
}

/**
 * Lists all ProjectDocument records currently stored in IndexedDB.
 *
 * Records are verified for integrity. Corrupted records will throw
 * a DocumentPersistenceError to protect against silent corruption.
 * Returned documents are independent deep clones.
 *
 * @throws {DocumentPersistenceError} If transaction fails or any stored document is corrupted.
 */
export async function listDocuments(): Promise<ProjectDocument[]> {
  const db = await openDatabase();

  return new Promise<ProjectDocument[]>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction([DOCUMENTS_STORE_NAME], 'readonly');
    } catch (txError) {
      db.close();
      reject(
        new DocumentPersistenceError(
          `Failed to start transaction on store "${DOCUMENTS_STORE_NAME}": ${txError instanceof Error ? txError.message : String(txError)}`,
          'TRANSACTION_INIT_FAILED',
          txError
        )
      );
      return;
    }

    const store = transaction.objectStore(DOCUMENTS_STORE_NAME);
    const getAllRequest = store.getAll();
    let corruptionError: DocumentPersistenceError | null = null;

    getAllRequest.onsuccess = () => {
      const records = getAllRequest.result as ProjectDocument[] | undefined;
      if (Array.isArray(records)) {
        for (const doc of records) {
          const validation = validateDocumentIntegrity(doc);
          if (!validation.isValid) {
            corruptionError = new DocumentPersistenceError(
              `Found corrupted document record "${doc?.id ?? 'unknown'}" during listDocuments:\n- ${validation.errors.join('\n- ')}`,
              'CORRUPTED_DOCUMENT_RECORD',
              validation.errors
            );
            break;
          }
        }
      }
    };

    transaction.oncomplete = () => {
      db.close();
      if (corruptionError) {
        reject(corruptionError);
        return;
      }

      const records = getAllRequest.result as ProjectDocument[] | undefined;
      if (!Array.isArray(records)) {
        resolve([]);
        return;
      }

      // Return deep copies sorted by updatedAt descending (newest first)
      const cloned = records.map((doc) => cloneDocument(doc));
      cloned.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      resolve(cloned);
    };

    transaction.onerror = () => {
      db.close();
      if (corruptionError) {
        reject(corruptionError);
        return;
      }
      reject(
        new DocumentPersistenceError(
          `Failed to list documents: ${transaction.error?.message ?? 'Transaction error'}`,
          'LIST_TRANSACTION_FAILED',
          transaction.error
        )
      );
    };

    transaction.onabort = () => {
      db.close();
      if (corruptionError) {
        reject(corruptionError);
        return;
      }
      reject(
        new DocumentPersistenceError(
          'List transaction was aborted.',
          'TRANSACTION_ABORTED',
          transaction.error
        )
      );
    };
  });
}

// ============================================================================
// Document Factory
// ============================================================================

/**
 * Creates a valid, empty ProjectDocument based on ProjectMetadata.
 *
 * Invariants:
 * 1. Preserves project ID, title (as name), dimensions, and metadata.
 * 2. Initializes an EMPTY document with no placeholder layers or fake assets:
 *    layers: {}, rootLayerIds: [], activeLayerId: null, selectedLayerIds: [], selection: null, assets: {}.
 * 3. Enforces strict integrity validation via validateDocumentIntegrity().
 *    Throws DocumentPersistenceError if validation fails.
 *
 * @throws {DocumentPersistenceError} If metadata is missing/invalid or document fails integrity checks.
 */
export function createDefaultProjectDocument(projectMeta: ProjectMetadata): ProjectDocument {
  if (!projectMeta || typeof projectMeta !== 'object') {
    throw new DocumentPersistenceError(
      'Cannot create default project document: "projectMeta" must be an object.',
      'INVALID_METADATA_INPUT'
    );
  }

  if (!projectMeta.id || typeof projectMeta.id !== 'string' || projectMeta.id.trim().length === 0) {
    throw new DocumentPersistenceError(
      'Cannot create default project document: "projectMeta.id" must be a non-empty string.',
      'INVALID_METADATA_INPUT'
    );
  }

  const name = (projectMeta.title || '').trim() || 'Untitled Project';

  const width = projectMeta.width;
  if (!Number.isFinite(width) || width <= 0) {
    throw new DocumentPersistenceError(
      `Cannot create default project document: Invalid canvas width (${width}). Must be a positive finite number.`,
      'INVALID_DIMENSIONS'
    );
  }

  const height = projectMeta.height;
  if (!Number.isFinite(height) || height <= 0) {
    throw new DocumentPersistenceError(
      `Cannot create default project document: Invalid canvas height (${height}). Must be a positive finite number.`,
      'INVALID_DIMENSIONS'
    );
  }

  const dpi = Number.isFinite(projectMeta.dpi) && projectMeta.dpi > 0 ? projectMeta.dpi : 300;
  const colorSpace: ColorSpace = projectMeta.colorSpace === 'display-p3' ? 'display-p3' : 'srgb';

  const createdAtMs = projectMeta.createdAt ? new Date(projectMeta.createdAt).getTime() : Date.now();
  const updatedAtMs = projectMeta.updatedAt ? new Date(projectMeta.updatedAt).getTime() : Date.now();
  const safeCreatedAt = Number.isFinite(createdAtMs) && createdAtMs > 0 ? createdAtMs : Date.now();
  const safeUpdatedAt = Number.isFinite(updatedAtMs) && updatedAtMs > 0 ? updatedAtMs : Date.now();

  const doc: ProjectDocument = {
    id: projectMeta.id.trim(),
    name,
    width: Math.round(width),
    height: Math.round(height),
    dpi: Math.round(dpi),
    colorSpace,
    createdAt: safeCreatedAt,
    updatedAt: safeUpdatedAt,
    rootLayerIds: [],
    layers: {},
    activeLayerId: null,
    selectedLayerIds: [],
    selection: null,
    assets: {},
    viewport: {
      zoom: 1,
      panX: 0,
      panY: 0,
    },
  };

  const validation = validateDocumentIntegrity(doc);
  if (!validation.isValid) {
    throw new DocumentPersistenceError(
      `Failed to create valid default project document for "${projectMeta.id}":\n- ${validation.errors.join('\n- ')}`,
      'INTEGRITY_VALIDATION_FAILED',
      validation.errors
    );
  }

  return doc;
}

// ============================================================================
// Binary Asset Persistence API (Step 1)
// ============================================================================

export interface StoredBinaryAssetRecord {
  storageKey: string;
  blob: Blob;
  createdAt: number;
}

/**
 * Stores a native binary Blob associated with a unique storage key in the `project_assets` store.
 *
 * Guarantees:
 * 1. Uses IndexedDB structured cloning to store the native Blob directly (no base64 overhead).
 * 2. Resolves only after the transaction completes successfully (`transaction.oncomplete`).
 * 3. Does not overwrite or delete existing document data.
 *
 * @throws {DocumentPersistenceError} If storageKey is empty, data is not a Blob, or transaction fails.
 */
export async function storeBinaryAsset(storageKey: string, data: Blob): Promise<void> {
  if (!storageKey || typeof storageKey !== 'string' || storageKey.trim().length === 0) {
    throw new DocumentPersistenceError(
      'Cannot store binary asset: A non-empty string "storageKey" is required.',
      'INVALID_STORAGE_KEY'
    );
  }

  if (!data || !(data instanceof Blob)) {
    throw new DocumentPersistenceError(
      'Cannot store binary asset: "data" must be a valid Blob instance.',
      'INVALID_BLOB_DATA'
    );
  }

  const cleanKey = storageKey.trim();
  const record: StoredBinaryAssetRecord = {
    storageKey: cleanKey,
    blob: data,
    createdAt: Date.now(),
  };

  const db = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction([ASSETS_STORE_NAME], 'readwrite');
    } catch (txError) {
      db.close();
      reject(
        new DocumentPersistenceError(
          `Failed to start transaction on store "${ASSETS_STORE_NAME}": ${txError instanceof Error ? txError.message : String(txError)}`,
          'TRANSACTION_INIT_FAILED',
          txError
        )
      );
      return;
    }

    const store = transaction.objectStore(ASSETS_STORE_NAME);
    const putRequest = store.put(record);

    putRequest.onerror = () => {
      // Error bubbles to transaction.onerror
    };

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(
        new DocumentPersistenceError(
          `Failed to store binary asset "${cleanKey}": ${transaction.error?.message ?? 'Transaction failed'}`,
          'STORE_ASSET_FAILED',
          transaction.error
        )
      );
    };

    transaction.onabort = () => {
      db.close();
      reject(
        new DocumentPersistenceError(
          `Store transaction for binary asset "${cleanKey}" was aborted.`,
          'TRANSACTION_ABORTED',
          transaction.error
        )
      );
    };
  });
}

/**
 * Retrieves a native binary Blob by its storageKey from the `project_assets` store.
 * Returns null if no record exists for the given key.
 *
 * @throws {DocumentPersistenceError} If storageKey is empty or transaction fails.
 */
export async function loadBinaryAsset(storageKey: string): Promise<Blob | null> {
  if (!storageKey || typeof storageKey !== 'string' || storageKey.trim().length === 0) {
    throw new DocumentPersistenceError(
      'Cannot load binary asset: A non-empty string "storageKey" is required.',
      'INVALID_STORAGE_KEY'
    );
  }

  const cleanKey = storageKey.trim();
  const db = await openDatabase();

  return new Promise<Blob | null>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction([ASSETS_STORE_NAME], 'readonly');
    } catch (txError) {
      db.close();
      reject(
        new DocumentPersistenceError(
          `Failed to start transaction on store "${ASSETS_STORE_NAME}": ${txError instanceof Error ? txError.message : String(txError)}`,
          'TRANSACTION_INIT_FAILED',
          txError
        )
      );
      return;
    }

    const store = transaction.objectStore(ASSETS_STORE_NAME);
    const getRequest = store.get(cleanKey);
    let resolvedBlob: Blob | null = null;

    getRequest.onsuccess = () => {
      const result = getRequest.result as StoredBinaryAssetRecord | undefined;
      if (result && result.blob instanceof Blob) {
        resolvedBlob = result.blob;
      } else {
        resolvedBlob = null;
      }
    };

    getRequest.onerror = () => {
      // Error bubbles to transaction.onerror
    };

    transaction.oncomplete = () => {
      db.close();
      resolve(resolvedBlob);
    };

    transaction.onerror = () => {
      db.close();
      reject(
        new DocumentPersistenceError(
          `Failed to read binary asset "${cleanKey}": ${transaction.error?.message ?? 'Transaction failed'}`,
          'LOAD_ASSET_FAILED',
          transaction.error
        )
      );
    };

    transaction.onabort = () => {
      db.close();
      reject(
        new DocumentPersistenceError(
          `Read transaction for binary asset "${cleanKey}" was aborted.`,
          'TRANSACTION_ABORTED',
          transaction.error
        )
      );
    };
  });
}

/**
 * Deletes a binary asset record by its storageKey from the `project_assets` store.
 * Does not throw if the record does not exist.
 *
 * @throws {DocumentPersistenceError} If storageKey is empty or transaction fails.
 */
export async function deleteBinaryAsset(storageKey: string): Promise<void> {
  if (!storageKey || typeof storageKey !== 'string' || storageKey.trim().length === 0) {
    throw new DocumentPersistenceError(
      'Cannot delete binary asset: A non-empty string "storageKey" is required.',
      'INVALID_STORAGE_KEY'
    );
  }

  const cleanKey = storageKey.trim();
  const db = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction([ASSETS_STORE_NAME], 'readwrite');
    } catch (txError) {
      db.close();
      reject(
        new DocumentPersistenceError(
          `Failed to start transaction on store "${ASSETS_STORE_NAME}": ${txError instanceof Error ? txError.message : String(txError)}`,
          'TRANSACTION_INIT_FAILED',
          txError
        )
      );
      return;
    }

    const store = transaction.objectStore(ASSETS_STORE_NAME);
    const deleteRequest = store.delete(cleanKey);

    deleteRequest.onerror = () => {
      // Error bubbles to transaction.onerror
    };

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(
        new DocumentPersistenceError(
          `Failed to delete binary asset "${cleanKey}": ${transaction.error?.message ?? 'Transaction failed'}`,
          'DELETE_ASSET_FAILED',
          transaction.error
        )
      );
    };

    transaction.onabort = () => {
      db.close();
      reject(
        new DocumentPersistenceError(
          `Delete transaction for binary asset "${cleanKey}" was aborted.`,
          'TRANSACTION_ABORTED',
          transaction.error
        )
      );
    };
  });
}
