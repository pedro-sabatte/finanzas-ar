// ============================================================
// backups.gs — Export semanal de todas las hojas a Google Drive como CSV
// ============================================================

/**
 * Exporta todas las hojas como CSV a la carpeta de Drive configurada.
 * Se llama automáticamente los domingos a las 3am.
 * La primera vez que se ejecuta pide la carpeta de destino al usuario (ver setup).
 */
function backupSemanal() {
  const HOJAS_A_BACKUPEAR = [
    'movimientos', 'cuotas', 'inversiones_compras', 'inversiones_valuaciones',
    'recurrentes', 'cuentas', 'tarjetas', 'categorias', 'objetivos',
    'cotizaciones', 'patrimonio_historico'
  ];
  const folderId = PropertiesService.getScriptProperties().getProperty('BACKUP_FOLDER_ID');
  if (!folderId) {
    console.warn('BACKUP_FOLDER_ID no configurado. Ve a Propiedades del script y agrega el ID de la carpeta de Drive.');
    return;
  }

  let carpeta;
  try {
    carpeta = DriveApp.getFolderById(folderId);
  } catch (err) {
    console.error('No se puede acceder a la carpeta de backup:', err.message);
    return;
  }

  const fechaHoy = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
  const nombreSubcarpeta = `backup-${fechaHoy}`;

  // Crear subcarpeta con la fecha
  let subcarpeta;
  const existentes = carpeta.getFoldersByName(nombreSubcarpeta);
  if (existentes.hasNext()) {
    subcarpeta = existentes.next();
  } else {
    subcarpeta = carpeta.createFolder(nombreSubcarpeta);
  }

  const ss = getSpreadsheet();
  let exportadas = 0;

  HOJAS_A_BACKUPEAR.forEach(nombreHoja => {
    try {
      const hoja = ss.getSheetByName(nombreHoja);
      if (!hoja) return;

      const datos = hoja.getDataRange().getValues();
      if (datos.length === 0) return;

      // Generar CSV
      const csv = datos.map(fila =>
        fila.map(celda => {
          const str = String(celda);
          // Escapar comillas y envolver en comillas si tiene coma, comilla o newline
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',')
      ).join('\n');

      const blob = Utilities.newBlob(csv, MimeType.CSV, `${nombreHoja}.csv`);

      // Si ya existe, reemplazar
      const archivosExistentes = subcarpeta.getFilesByName(`${nombreHoja}.csv`);
      while (archivosExistentes.hasNext()) {
        archivosExistentes.next().setTrashed(true);
      }

      subcarpeta.createFile(blob);
      exportadas++;
    } catch (err) {
      console.error(`Error exportando hoja ${nombreHoja}:`, err.message);
    }
  });

  console.log(`Backup completado: ${exportadas} hojas exportadas a "${nombreSubcarpeta}"`);

  // Limpiar backups de más de 90 días
  limpiarBackupsAntiguos_(carpeta, 90);
}

/**
 * Elimina subcarpetas de backup con más de maxDias días de antigüedad.
 */
function limpiarBackupsAntiguos_(carpeta, maxDias) {
  const limite = new Date();
  limite.setDate(limite.getDate() - maxDias);

  const subcarpetas = carpeta.getFolders();
  while (subcarpetas.hasNext()) {
    const sub = subcarpetas.next();
    if (sub.getDateCreated() < limite) {
      sub.setTrashed(true);
      console.log(`Backup antiguo eliminado: ${sub.getName()}`);
    }
  }
}

/**
 * Para configurar la carpeta de backup la primera vez.
 * Ejecutar manualmente desde el editor; pide la URL de la carpeta.
 */
function configurarCarpetaBackup() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt(
    'Configurar carpeta de backups',
    'Pegá la URL o el ID de la carpeta de Google Drive donde guardar los backups:',
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;

  let input = resp.getResponseText().trim();
  // Extraer ID de una URL de Drive si pegaron la URL completa
  const match = input.match(/[-\w]{25,}/);
  const id = match ? match[0] : input;

  PropertiesService.getScriptProperties().setProperty('BACKUP_FOLDER_ID', id);
  ui.alert(`✓ Carpeta de backups configurada. ID: ${id}`);
}
