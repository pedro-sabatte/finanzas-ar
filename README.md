# Finanzas Pedro & Juani

Sistema de gestión de finanzas personales para Argentina. Pesos y dólares en paralelo.

**Backend**: Google Sheets + Google Apps Script  
**Frontend**: 3 PWAs instalables en el celu (Form, Cierre, Dashboard)  
**Stack**: HTML + Alpine.js + Tailwind + Chart.js (vanilla, sin frameworks)

---

## Cómo arrancar HOY

> Orden exacto. No saltear pasos.

### 1. Clonar el repo

```bash
git clone https://github.com/pedro-sabatte/finanzas-ar.git
cd finanzas-ar
```

### 2. Configurar Apps Script

1. Abrí [script.google.com](https://script.google.com)
2. Creá un nuevo proyecto → Configuración del proyecto → vinculalo a tu Google Sheet (ID: `1FfIeMW7jk6hEJgmPJufSfo_iLZfLnDUoHt6ZCMFoeXg`)
3. Copiá el contenido de cada archivo de `/apps-script/*.gs` en el editor
4. En **Configuración del proyecto → Propiedades del script**, agregá:
   - `API_TOKEN` = (generá un token aleatorio, ej: una cadena larga de letras y números)
   - `BACKUP_FOLDER_ID` = (ID de la carpeta de Google Drive donde guardar backups — opcional al inicio)
5. Publicá como **Aplicación web**:
   - Ejecutar como: **Yo (tu usuario)**
   - Quién tiene acceso: **Cualquier usuario**
   - Copiá la URL del despliegue

### 3. Configurar cada PWA

En cada carpeta (`/form/`, `/cierre/`, `/dashboard/`), copiá `config.local.example.js` → `config.local.js` y completá:

```js
// form/config.local.js
const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/TU_ID/exec',
  API_TOKEN: 'el-mismo-token-que-pusiste-en-apps-script'
};
```

### 4. Ejecutar el seed inicial

En el editor de Apps Script, seleccioná la función `setup` y ejecutala manualmente (botón ▶). Esto crea todas las hojas y carga los datos iniciales (cuentas, tarjetas, categorías, meta).

### 5. Configurar triggers

En el editor de Apps Script, seleccioná `setupTriggers` y ejecutala. Esto instala los triggers automáticos (cotización diaria, recurrentes mensuales, snapshot patrimonial, backup semanal).

### 6. Publicar en GitHub Pages

```bash
git push origin main
```

En GitHub → Settings → Pages → Source: `main` branch, root `/`.  
Las PWAs quedan en:
- `https://pedro-sabatte.github.io/finanzas-ar/form/`
- `https://pedro-sabatte.github.io/finanzas-ar/cierre/`
- `https://pedro-sabatte.github.io/finanzas-ar/dashboard/`

---

## Si cambio de máquina mañana

> Checklist completo para migrar sin perder nada.

- [ ] Clonar el repo: `git clone https://github.com/pedro-sabatte/finanzas-ar.git`
- [ ] En cada carpeta de PWA, crear `config.local.js` a partir de `config.local.example.js`
- [ ] **Los datos viven en Google Sheets** — no se migra nada de base de datos
- [ ] **El token de API** está en las Propiedades del script en Apps Script (no en el repo). Anotarlo en un lugar seguro (ej: Bitwarden)
- [ ] **El backup_folder_id** ídem — anotarlo
- [ ] **GitHub Personal Access Token**: generá uno nuevo en github.com → Settings → Developer Settings → Personal Access Tokens
- [ ] No hay nada instalado globalmente que sea necesario (no se usa Node ni clasp en producción)
- [ ] Las PWAs funcionan desde cualquier navegador apuntando a las URLs de GitHub Pages

---

## Cómo instalar las 3 PWAs en el celu

### Android (Chrome)
1. Abrí la URL de la PWA en Chrome
2. Tocá el menú (⋮) → **"Añadir a pantalla de inicio"**
3. Confirmá el nombre y tocá **Añadir**
4. Repetí para las 3 PWAs

### iOS (Safari)
1. Abrí la URL de la PWA en **Safari** (no Chrome — en iOS solo Safari puede instalar PWAs)
2. Tocá el botón de compartir (□↑)
3. Scrolleá y tocá **"Añadir a pantalla de inicio"**
4. Confirmá el nombre y tocá **Añadir**
5. Repetí para las 3 PWAs

> Cada PWA tiene su propio ícono y nombre, así que aparecen como 3 apps separadas.

---

## Estructura del proyecto

```
/
├── apps-script/     ← Código del backend (copiar en script.google.com)
├── form/            ← PWA carga rápida de movimientos
├── cierre/          ← PWA wizard de cierre mensual
├── dashboard/       ← PWA consulta y análisis
├── shared/          ← Código compartido entre las 3 PWAs
└── docs/            ← Documentación técnica
```

## Links útiles

- [Google Sheet de datos](https://docs.google.com/spreadsheets/d/1FfIeMW7jk6hEJgmPJufSfo_iLZfLnDUoHt6ZCMFoeXg)
- [Editor de Apps Script](https://script.google.com)
- [Docs: modelo de datos](docs/modelo-datos.md)
- [Docs: deploy](docs/deploy.md)
