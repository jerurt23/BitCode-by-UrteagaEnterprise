import { Project } from '../types/workspace';

/**
 * Nombre del archivo local que guarda una copia de seguridad de todo el
 * espacio de trabajo (proyectos, módulos, notas, ramas e historial).
 *
 * Se escribe en el almacenamiento privado del navegador (OPFS) para que la
 * app instalada conserve los datos en el teléfono, y se puede exportar como
 * archivo real `Datos BitCode.json` para guardarlo en Archivos/Descargas.
 */
export const LOCAL_DATA_FILE_NAME = 'Datos BitCode.json';

const PAYLOAD_APP = 'BitCode';
const PAYLOAD_VERSION = 1;

export interface DataFilePayload {
  app: typeof PAYLOAD_APP;
  version: number;
  fileName: string;
  savedAt: string;
  projects: Project[];
}

export type ExportResult = 'shared' | 'downloaded';

function serialize(projects: Project[]): string {
  const payload: DataFilePayload = {
    app: PAYLOAD_APP,
    version: PAYLOAD_VERSION,
    fileName: LOCAL_DATA_FILE_NAME,
    savedAt: new Date().toISOString(),
    projects,
  };
  return JSON.stringify(payload, null, 2);
}

function opfsAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage?.getDirectory === 'function'
  );
}

async function getLocalFileHandle(create: boolean): Promise<FileSystemFileHandle | null> {
  if (!opfsAvailable()) return null;
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getFileHandle(LOCAL_DATA_FILE_NAME, { create });
  } catch {
    return null;
  }
}

/**
 * Guarda el workspace en el archivo interno `Datos BitCode.json`.
 * Es silencioso y automático: se llama en cada cambio de la app.
 */
export async function saveLocalDataFile(projects: Project[]): Promise<boolean> {
  const handle = await getLocalFileHandle(true);
  if (!handle) return false;
  try {
    const writable = await handle.createWritable();
    await writable.write(serialize(projects));
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

/** Lee el archivo interno `Datos BitCode.json` si existe. */
export async function loadLocalDataFile(): Promise<Project[] | null> {
  const handle = await getLocalFileHandle(false);
  if (!handle) return null;
  try {
    const file = await handle.getFile();
    return parseDataFileText(await file.text());
  } catch {
    return null;
  }
}

/** Metadatos del archivo interno (fecha de última escritura y tamaño). */
export async function getLocalDataFileInfo(): Promise<{
  savedAt: Date;
  size: number;
} | null> {
  const handle = await getLocalFileHandle(false);
  if (!handle) return null;
  try {
    const file = await handle.getFile();
    return { savedAt: new Date(file.lastModified), size: file.size };
  } catch {
    return null;
  }
}

/** Pide al navegador que no borre los datos por falta de espacio. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // El navegador puede rechazarlo; no es crítico.
  }
}

export function parseDataFileText(text: string): Project[] {
  const parsed: unknown = JSON.parse(text);

  const candidate = Array.isArray(parsed)
    ? parsed
    : (parsed as { projects?: unknown } | null)?.projects;

  if (!Array.isArray(candidate) || candidate.length === 0) {
    throw new Error('El archivo no contiene proyectos de BitCode.');
  }

  const valid = candidate.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Project).id === 'string' &&
      Array.isArray((item as Project).modules),
  );

  if (!valid) {
    throw new Error('El archivo no tiene el formato de BitCode.');
  }

  return candidate as Project[];
}

/**
 * Exporta el workspace como archivo real `Datos BitCode.json`.
 * En el teléfono abre la hoja de compartir (Guardar en Archivos/Drive);
 * en escritorio descarga el archivo.
 */
export async function exportDataFile(projects: Project[]): Promise<ExportResult> {
  const text = serialize(projects);
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const file = new File([blob], LOCAL_DATA_FILE_NAME, {
    type: 'application/json',
    lastModified: Date.now(),
  });

  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }));

  if (canShareFiles) {
    try {
      await navigator.share({
        files: [file],
        title: 'Datos BitCode',
        text: 'Copia de seguridad del espacio de trabajo BitCode',
      });
      return 'shared';
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error;
      // Si compartir falla, caemos a la descarga normal.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = LOCAL_DATA_FILE_NAME;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return 'downloaded';
}
