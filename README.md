# 🎨 PSD Viewer

Aplicación web para previsualizar archivos PSD usando Node.js.

## 📋 Requisitos

- Node.js (v16 o superior)
- npm

## 🚀 Instalación

```bash
npm install
```

## ▶️ Uso

1. Asegúrate de que el archivo `01.psd` esté en la carpeta `psd/`
2. Inicia el servidor:

```bash
node server.js
```

3. Abre tu navegador en: **http://localhost:3000**

## 🏗️ Estructura del Proyecto

```
psdViewer/
├── server.js          # Servidor Express con API para procesar PSD
├── public/
│   └── index.html     # Interfaz web
├── psd/
│   └── 01.psd        # Archivo PSD a visualizar
└── package.json
```

## 🔧 Tecnologías

- **Express**: Servidor web
- **psd**: Librería para parsear archivos PSD
- **CORS**: Manejo de CORS

## 📝 Notas

- El servidor procesa el PSD en el backend y lo convierte a PNG
- La interfaz es responsive y moderna
- El procesamiento puede tardar unos segundos dependiendo del tamaño del PSD
